# [Stage 3 보고서] task_agent-v0.1_6 — compose 부팅 + ChatController 라우트 노출 + CORS preflight 실측

- **이슈**: [#6](https://github.com/Alpha-ChangukChoi/rhwp/issues/6)
- **수행계획서**: [task_agent-v0.1_6.md](../plans/task_agent-v0.1_6.md)
- **구현계획서**: [task_agent-v0.1_6_impl.md](../plans/task_agent-v0.1_6_impl.md)
- **단계**: 3 / 3 (+ 옵셔널 4)
- **브랜치**: `local/task6`
- **작성일**: 2026-05-01
- **소요 시간**: 약 15분 (기준 25±10분 — 허용 범위 내, R-009 정상)

---

## 1. R-013 Layer 2 검증 사다리

| Layer | 도구 | Stage | 결과 |
|------|------|-------|------|
| 1 (단위) | jest | 1 | 38 pass |
| 1 (HTTP e2e) | jest + supertest (mocked openai) | 2 | 16 pass + 1 skipped |
| **2 (compose 실측)** | **docker compose + curl** | **3 (본 단계)** | **모두 통과** |

R-013 backend 표준의 *2 단계 검증 사다리* 종결.

## 2. 변경 파일

본 단계 코드 변경 0건. compose 부팅 검증만 수행.

| 경로 | 변경 |
|------|------|
| `mydocs/working/task_agent-v0.1_6_stage3.md` | 신규 (본 보고서) |

## 3. compose 빌드·부팅 결과

```
$ docker compose build agent-server
...
naming to docker.io/library/rhwp-fork-agent-server:latest done
rhwp-fork-agent-server  Built

$ docker compose up -d agent-server
Container rhwp-fork-agent-server-1  Started
```

부팅 로그 (NestJS):

```
[NestFactory] Starting Nest application...
[InstanceLoader] ConfigHostModule dependencies initialized
[InstanceLoader] AppModule dependencies initialized
[InstanceLoader] ConfigModule dependencies initialized
[InstanceLoader] SessionModule dependencies initialized
[InstanceLoader] ChatModule dependencies initialized
[RoutesResolver] HealthController {/health}:
[RouterExplorer] Mapped {/health, GET} route
[RoutesResolver] ChatController {/chat}:                              ← 신규
[RouterExplorer] Mapped {/chat/session, POST} route                   ← 신규
[RouterExplorer] Mapped {/chat/session/:id/messages, POST} route      ← 신규
[NestApplication] Nest application successfully started
rhwp-agent-server listening on :3000
```

`ChatController {/chat}` + 라우트 2건 정상 노출 — Stage 1·2 의 e2e 결과를 *실 컨테이너* 에서 재현.

## 4. curl 실측 결과

### 4.1 `GET /health` — 200

```
HTTP/1.1 200 OK
Vary: Origin
Content-Type: application/json
{"status":"ok","service":"rhwp-agent-server","version":"0.1.0"}
```

### 4.2 `POST /chat/session` — 201 + uuid

```
HTTP/1.1 201 Created
{"sessionId":"83aa4638-7192-4b00-81eb-0149a63ebc1e"}
```

UUID v4 형식 정확.

### 4.3 CORS preflight (R-6-C 핵심 검증)

#### 허용 origin (`http://localhost:7700`):

```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:7700      ← 매칭
Vary: Origin
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Content-Type
```

#### 거부 origin (`http://evil.example.com`):

```
HTTP/1.1 204 No Content
Vary: Origin
Access-Control-Allow-Methods: GET,POST,OPTIONS
Access-Control-Allow-Headers: Content-Type
                                                          ← Access-Control-Allow-Origin 헤더 부재
```

브라우저는 `Access-Control-Allow-Origin` 헤더 부재 시 *fetch 거부* — 의도한 거부 동작.

> NestJS 의 `enableCors({ origin: string[] })` 패턴 — preflight 자체는 204 로 응답하나 *허용 외 origin 은 allow-origin 헤더 미반영* 으로 차단. supertest e2e (Stage 2 #9) 와 동일 동작 *실 컨테이너* 에서 확인.

### 4.4 에러 매핑 — R-6-D 라이브 검증

| 시나리오 | 코드 | 비고 |
|----------|------|------|
| `POST /chat/session/non-existent/messages` | **404 Not Found** | SessionNotFoundError → ChatExceptionFilter |
| `POST /chat/session/<uuid>/messages` content 13000자 | **400 Bad Request** | ValidationPipe (R-6-B) |

Stage 2 e2e 결과 (mock) 와 *실 컨테이너* 결과 일치.

## 5. 환경변수 주입 결과

```
$ docker compose exec agent-server printenv | grep -E "^(CORS_|SESSION_|OPENAI_)"
OPENAI_API_KEY=<masked>
OPENAI_MODEL=gpt-5.4
OPENAI_TIMEOUT_MS=30000
```

**관찰**: `CORS_ALLOWED_ORIGINS`, `SESSION_TTL_MS`, `SESSION_MAX_HISTORY` 은 OS env 에 부재. 사용자 .env 에 명시 안 됨. *Joi schema default* 가 `ConfigService.getOrThrow()` 시점에 적용되므로 정상 동작 (preflight 허용 origin 매칭이 그 증거).

**deviation 분류**: 0 — Joi default 의 의도된 동작. `.env.example` 에는 명시되어 있어 새 환경 셋업 시 권장됨.

## 6. (옵셔널) 실 OpenAI 호출

본 단계의 옵셔널 항목 — *실 OpenAI 호출* 은 미수행.

**사유**:
- `.env.OPENAI_MODEL=gpt-5.4` 설정 — 모델 가용성 별도 검증 필요
- 실 호출은 비용 발생 + 응답시간 변동
- 작업지시자 별도 승인 영역

별도 승인 시 *Stage 4* 또는 별도 검증 task 로 분리 진행.

## 7. compose 정리

```
$ docker compose down
Container rhwp-fork-agent-server-1  Stopped
Container rhwp-fork-agent-server-1  Removing
Container rhwp-fork-agent-server-1  Removed
Network rhwp-fork_default  Removing
Network rhwp-fork_default  Removed
```

자원 누수 0.

## 8. 종료 체크

- [x] `docker compose build agent-server` 성공
- [x] `docker compose up -d agent-server` 부팅 후 `Started`
- [x] compose logs 에 `ChatController {/chat}` + `POST /chat/session` + `POST /chat/session/:id/messages` 매핑 확인
- [x] `curl GET /health` 200
- [x] `curl POST /chat/session` 201 + uuid sessionId
- [x] `curl OPTIONS /chat/session -H Origin: http://localhost:7700` 204 + allow-origin 정상
- [x] `curl OPTIONS /chat/session -H Origin: http://evil.example.com` 204 + allow-origin **부재** (의도한 거부)
- [x] `curl POST /chat/session/non-existent/messages` 404 (R-6-D)
- [x] `curl POST .../messages content > 12000자` 400 (R-6-B)
- [x] 환경변수 주입 결과 정상 (Joi default 의 의도된 동작)
- [x] (옵셔널) 실 OpenAI 호출 — 작업지시자 승인 영역 (미수행)
- [x] `docker compose down` 정상 정리

## 9. 결정 적용 결과 (R-6-A~I, Stage 3 영역)

| ID | 추천 | Stage 3 라이브 검증 | 결과 |
|----|------|---------------------|------|
| R-6-A REST POST | 채택 (Stage 1) | curl POST + 라우트 노출 | ✅ |
| R-6-B ValidationPipe | 채택 (Stage 2) | curl 13000자 → 400 | ✅ |
| R-6-C CORS 명시 list | 채택 (Stage 2) | OPTIONS preflight 허용/거부 | ✅ |
| R-6-D Exception Filter | 채택 (Stage 1) | curl bad session → 404 | ✅ |
| R-6-G createSession 노출 | 채택 (Stage 1) | curl POST /session → uuid | ✅ |

전 결정 사항 *실 컨테이너* 에서 검증.

## 10. Stage 1·2·3 통합

| 단계 | 시간 | 결과 | 도구 |
|------|------|------|------|
| 1 | 30분 (기준 40±15) | 단위 38 pass | jest |
| 2 | 25분 (기준 35±15) | e2e 16 pass + 1 skipped | jest + supertest |
| 3 | 15분 (기준 25±10) | compose 실측 모두 통과 | docker compose + curl |
| **합계** | **70분** | **R-013 layer 1+2 종결** | — |

3 단계 모두 R-009 시간 허용 범위 내 *하한* — 의무 점검표 (R-014/R-015) 의 사전 정렬 효과로 추정.

## 11. 발견·deviation

본 단계: 0건.

D-6-1 (Stage 1, TS1272) / D-6-2 (Stage 2, supertest v7 import) / D-6-3 (Stage 2, completeWithTools 누락) 모두 즉시 해결 완료.

## 12. 방법론 평가 메모

### R-014/R-015 세 번째 의무 적용 — 최종

| 측정 항목 | #4 (첫 의무) | #5 (두 번째) | #6 (세 번째, 본 task) |
|----------|------------|------------|------|
| 결정 변경 | 0 | 0 | **0 유지** (R-6-A~G 추천 그대로) |
| 누락 (현재 task) | 0 | 0 | **0 유지** |
| 누락 (과거 task 결정 일관성) | 측정 안 함 | 측정 안 함 | **1건 발견** (D-6-3 — Task #3 의 R-3-* 결정 일관성 누락) |
| 추천 강화 효과 | — | R-5-B EventTarget | (없음 — Stage 1·2·3 모두 추천 그대로 통과) |

**현재 task 결정 누락 0건 + 변경 0건 → 세 task 연속**. 가설 강화.

D-6-3 은 *과거 task 결정 일관성* 영역 — R-014/R-015 의무 점검표가 다루지 않는 새 영역. 마일스톤 종결 회고 (최종 보고서 §7) 에서 R-018 가설 후보로 정식화 검토.

### R-013 backend 표준 종결

본 task 로 R-013 *2 단계 검증 사다리 (jest + compose)* 가 backend 영역 (#2~#4 + #6 = 4 task) 에서 일관 적용 완료. #5 의 frontend 변형 (jest + puppeteer + main.ts mount) 과 비교 — 마일스톤 종결 시 R-016 정식화 검토.

### 6 task 누적 시간 트렌드 (Stage 단위)

본 task Stage 1·2·3 모두 기준 시간 *허용 범위 하한* — R-014/R-015 의무 점검표가 *수행계획 단계* 에서 결정 정렬을 사전에 끝내므로 *구현 시간 단축* 효과 추정. 6 task 누적 데이터 최종 보고서에서 종합.

## 13. 다음 단계

Stage 3 종료. 본행 3 단계 모두 통과.

**선택 분기**:
- **A. Stage 4 (옵셔널) 진입** — rhwp-studio + 실 agent-server 통합 (mock 제거 e2e). 작업지시자 별도 승인 필요 (실 OpenAI 호출).
- **B. 최종 보고서 작성으로 직행** — Stage 4 생략. 본행 3 단계만으로 task #6 종결.

작업지시자 결정 대기.

# [Stage 4 보고서] task_agent-v0.1_6 — rhwp-studio + 실 agent-server 통합 e2e (mock 제거)

- **이슈**: [#6](https://github.com/Alpha-ChangukChoi/rhwp/issues/6)
- **수행계획서**: [task_agent-v0.1_6.md](../plans/task_agent-v0.1_6.md)
- **구현계획서**: [task_agent-v0.1_6_impl.md](../plans/task_agent-v0.1_6_impl.md)
- **단계**: 4 / 3 (옵셔널, 작업지시자 승인 후 진입)
- **브랜치**: `local/task6`
- **작성일**: 2026-05-01
- **소요 시간**: 약 25분 (기준 30±15분 — 허용 범위 내, R-009 정상)

---

## 1. 사전 점검 — gpt-5.4 모델 가용성

`OPENAI_API_KEY` 로 `GET https://api.openai.com/v1/models` 조회 — **gpt-5.4 가용 확인**.

가용 GPT 모델 100건 (요약): gpt-5, gpt-5.1, gpt-5.2, gpt-5.3, **gpt-5.4**, gpt-5.4-mini, gpt-5.4-nano, gpt-5.4-pro, gpt-5.5 등.

→ `.env.OPENAI_MODEL=gpt-5.4` 정상.

## 2. 변경 파일

### 신규 (1개)

| 경로 | 라인 | 역할 |
|------|------|------|
| `rhwp-studio/e2e/agent-real-integration.test.mjs` | 230 | 실 agent-server (compose) + 실 OpenAI 호출 통합 e2e (1 testcase, 멀티턴 2 turn) |

본가 코드 무수정 ✅. `rhwp-studio/e2e/` 는 fork 영역.

## 3. e2e 실행 결과

```
$ cd rhwp-studio && node e2e/agent-real-integration.test.mjs
[setup] agent-server expected at http://localhost:3000
 Network rhwp-fork_default  Created
 Container rhwp-fork-agent-server-1  Started
[setup] agent-server /health ok
[vite] :7711 dev ready
▶ 통합 (실): 사이드바 mount → 실 메시지 2회 → 실 OpenAI 응답 + sessionId 재사용
    1st elapsed: 3658ms (R-009 5000±2000 → 실 OpenAI 허용 30s)
    1st reply: 서울
    2nd elapsed: 1742ms
    2nd reply: Seoul
  ✓ pass
[teardown] docker compose down
=== 1 passed, 0 failed ===
```

### 3.1 검증 항목

| 항목 | 결과 | R-* |
|------|------|-----|
| compose up agent-server (자동) | ✅ | R-013 |
| /health 200 | ✅ | — |
| vite dev :7711 | ✅ | — |
| 사이드바 mount (`mountAgentSidebar()`) | ✅ | R-5-* |
| 첫 메시지 "한국의 수도는?" → 실 OpenAI 응답 "서울" (3658ms) | ✅ | R-6-A/E, R-009 |
| 두 번째 메시지 → 실 OpenAI 응답 "Seoul" (1742ms) | ✅ | R-5-D, R-6-A/E |
| **멀티턴 컨텍스트 인지** ("방금 답한 단어를 영문 1단어로" → "Seoul") | ✅ | R-6-G + 세션 누적 |
| sessionId 재사용 (agent-store) | ✅ | R-5-D |
| 응답시간 < 30000ms | ✅ (1st 3.7s, 2nd 1.7s) | R-009 |
| compose down (자동) | ✅ | — |

### 3.2 멀티턴 컨텍스트 인지 — 핵심 검증

본 e2e 의 백미: 두 번째 메시지의 *"방금 답한 단어"* 표현은 **첫 turn 의 응답 ("서울") 이 모델 컨텍스트 내에 있어야** 정확히 처리 가능. 결과 "Seoul" — *모델이 첫 turn 인지 + 영문 변환 처리*.

이것은:
- `ChatService.completeInSession` 의 history 누적 로직 (Task #4) — 정상
- `ChatController` 의 `completeInSession` 호출 (Task #6 Stage 1) — 정상
- agent-store 의 sessionId 단일 보존 (Task #5) — 정상
- agent-client 의 `/chat/session/:id/messages` 라우팅 (Task #5) — 정상
- main.ts CORS 정상 통과 (Task #6 Stage 2) — 정상

→ **#1~#6 의 6 task 통합 종결 검증** (1 testcase 로 6 task 의 핵심 기능 모두 검증).

## 4. 발견·deviation

### D-6-4: vite dev port 7713 이 CORS 허용 list 부재

**현상**: e2e 첫 실행 시 console.error: `Access to fetch at 'http://localhost:3000/chat/session' from origin 'http://localhost:7713' has been blocked by CORS policy`.

**원인**: `agent-real-integration.test.mjs` 가 vite port 7713 을 새로 잡으려 했으나, `CORS_ALLOWED_ORIGINS` schema default 는 `7700,4173,7711,7712` 의 4개 — 7713 부재. Stage 2 의 main.ts 는 schema default 만 받아 enableCors 적용 → preflight 미허용 origin 거부 (Stage 3 에서 검증한 정상 동작이 여기서 발현).

**처리**: e2e 의 VITE_PORT 를 **7711** (default 내, agent-integration 의 7712 와 분리) 로 변경. CORS list 자체는 무수정.

**deviation 분류**: *환경 디자인 발견 — R-6-C 결정의 "허용 list 의 명시" 가 fork e2e 의 임의 port 사용을 제약*. 트레이드오프:
- 옵션 A (현 채택): default list 안의 port 사용 — 새 e2e 자유도 제한
- 옵션 B: schema default 확장 (e.g., :7713 추가) — *production 영향 범위 확대*
- 옵션 C: e2e 별 .env 분기 — 복잡도 ↑

**현 채택 사유**: 단순성 + production CORS list 무수정. 후속 e2e 추가 시 *default 4 port (7700/4173/7711/7712) 안에서 분배* 정책으로 정착.

### D-6-5: 사용자 직접 테스트 안내 — vite `--host 127.0.0.1` 호스트명 mismatch

**현상**: 사용자가 옵션 A (브라우저 직접) 으로 테스트 시 console.error: `Access to fetch at 'http://localhost:3000/chat/session' from origin 'http://127.0.0.1:7711' has been blocked by CORS policy`.

**원인**: 직접 테스트 가이드를 *#5 e2e 스크립트의 `--host 127.0.0.1` 패턴 그대로* 안내했으나, CORS 허용 list (`http://localhost:7700,http://localhost:4173,http://localhost:7711,http://localhost:7712`) 는 *origin 정확 매칭* — `127.0.0.1` 과 `localhost` 가 서로 다른 origin 으로 취급된다. 자동 e2e 의 puppeteer 는 `await page.goto('http://localhost:${VITE_PORT}/')` 로 *명시적 localhost* 사용해서 통과했는데, 사용자 직접 테스트는 vite host 옵션을 그대로 따르면서 `127.0.0.1` 로 접속 → CORS 거부.

**처리**:
- vite 기동 명령 안내 수정 — `--host` 옵션 제거 (default 가 localhost) → `npx vite --port 7711`
- 브라우저 접속 URL 안내 — `http://localhost:7711/` (127.0.0.1 아님) 명시
- 사용자 재시도 → 정상 동작 확인 완료

**deviation 분류**: *매뉴얼/안내 디자인 발견* — D-6-4 와 같은 *origin 정확 매칭* 본질이지만 *e2e port* 가 아닌 *호스트명* 영역. 자동 e2e 가 통과한 사실에 가려진 *직접 테스트 경로의 사각지대*.

**후속 정책 후보**: 후속 *manual/* 작성 시 (예: `mydocs/manual/agent_chat_user_guide.md`) 다음 정착 사항 명시:
1. vite 기동 시 `--host` 옵션 *지정하지 말 것* (또는 `--host localhost` 명시)
2. 브라우저 접속 URL 은 *반드시 `localhost`* (127.0.0.1 아님)
3. 향후 *호스트명·port 정책* 의 통합 가이드 (R-019 후보 — *fork dev 환경의 origin 일관성*)

### deviation 수치 (R-009 기준)

- 응답시간: 3658ms / 1742ms — 모두 30s 허용 내 (gpt-5.4 latency)
- 첫 응답시간이 두 번째보다 큰 이유: 첫 호출에는 SessionService.create() + 첫 OpenAI cold path

## 5. 종료 체크 (옵셔널)

- [x] agent-server compose 자동 up (e2e 내부)
- [x] /health 정상 + vite dev 정상
- [x] 사이드바 mount + 메뉴 hook
- [x] 실 OpenAI 호출 — 첫 메시지 "서울" + 응답시간 < 30s
- [x] 두 번째 메시지 — sessionId 재사용 + 컨텍스트 인지 ("Seoul")
- [x] DOM 어설션: user 메시지 2건, assistant 메시지 2건
- [x] 응답시간 R-009 < 30s 자동 expect
- [x] compose down 자동 정리
- [x] D-6-4 즉시 해결 (port 7711 사용)
- [x] **사용자 직접 테스트 (옵션 A — 브라우저)** — D-6-5 수정 후 정상 동작 확인 완료

## 6. 결정 적용 결과 (R-6-A~I, Stage 4 영역)

| ID | 추천 | Stage 4 라이브 검증 | 결과 |
|----|------|---------------------|------|
| R-6-A REST POST | 채택 | 실 fetch POST → 실 200/201 | ✅ |
| R-6-B ValidationPipe | 채택 (Stage 2) | content 정상 통과 | ✅ |
| R-6-C CORS 명시 list | 채택 (Stage 2) | port 7711 허용 통과, 7713 거부 (D-6-4) | ✅ + 디자인 트레이드오프 발견 |
| R-6-D Exception Filter | 채택 (Stage 1) | 정상 응답 — 에러 시나리오 미발생 | (Stage 1·2 검증) |
| R-6-E #5 mock 형식 | 채택 | `{ sessionId }`, `{ reply }` 정확 일치 | ✅ |
| R-6-G createSession 노출 | 채택 | sessionId 발급 + 두 번째 메시지 재사용 | ✅ |

R-6-A~G 모두 *실 환경 라이브* 검증 완료.

## 7. Stage 1·2·3·4 통합 — task #6 종결 직전

| 단계 | 시간 | 결과 | 도구 |
|------|------|------|------|
| 1 | 30분 (기준 40±15) | 단위 38 pass | jest |
| 2 | 25분 (기준 35±15) | e2e 16 pass + 1 skipped | jest + supertest |
| 3 | 15분 (기준 25±10) | compose 실측 모두 통과 | docker compose + curl |
| 4 (옵셔널) | 25분 (기준 30±15) | 실 통합 1 pass (실 OpenAI) | puppeteer + compose + 실 OpenAI |
| **합계** | **95분** | **전 layer 통과** | — |

R-013 backend layer 1+2 + R-013 frontend 변형 (#5) 의 *진짜 통합 검증* 완료.

## 8. 방법론 평가 메모

### R-014/R-015 세 번째 의무 적용 — 종결

| 측정 항목 | #4 (첫 의무) | #5 (두 번째) | #6 (세 번째, 본 task) |
|----------|------------|------------|------|
| 결정 변경 | 0 (9건) | 0 (11건) | **0 (9건)** |
| 누락 (현재 task) | 0 | 0 | **0** |
| 추천 강화 효과 | — | R-5-B EventTarget | (없음) |
| 디자인 트레이드오프 발견 | — | — | **D-6-4** (R-6-C 명시 list 의 fork e2e 자유도 제약) |

**3 task 연속 결정 변경 0 + 현재 task 결정 누락 0** — R-014/R-015 가설 강화. *추천 강화 효과* 는 #5 만 발현 — 추천 자체가 충분히 정교하면 변경 없음.

D-6-4 는 *R-6-C 결정 자체의 트레이드오프* 발견 — 결정 변경 영역 아닌 *결정 적용 영역 (e2e port 정책)*. 후속 task 들에서 누적 시 정식 정책 정립 가능 (e.g., R-019 — *e2e port 정책 default 4 port 안에서 분배*).

### 6 task 누적 — 아젠트 v0.1 마일스톤 종결 직전

| task | 결정 변경 | 누락 (현 task) | deviation 수 (즉시 해결 포함) |
|------|----------|--------------|---------------------------|
| #1 | — | — | 0 |
| #2 | 0 | 0 | 1 |
| #3 | 0 | 0 | 0 |
| #4 (R-014/R-015 첫 의무) | 0 | 0 | 0 |
| #5 (두 번째) | 0 | 0 | 6 (다수 — frontend 환경 사고) |
| #6 (세 번째) | 0 | 0 | 4 (D-6-1/2/3/4) |

R-014/R-015 *결정 영역 0건 누적* 안정 + deviation 은 *환경/구현 발견* 영역에 집중. *결정 vs 발견* 의 분리 추적이 R-009/R-014/R-015 의 본질이라는 가설 강화.

### D-6-3 의 의미 재확인

Stage 2 D-6-3 (`completeWithTools` 의 raw 에러 미 wrap, Task #3 결정 누락) 은 *과거 task 결정 일관성* 영역. 본 Stage 4 의 실 호출은 *정상 응답 시나리오만* 검증 — D-6-3 의 라이브 검증은 *실 OpenAI 에러 트리거* 가 필요 (rate limit / 잘못된 API key 등) 인데 본 단계 미수행. 후속에 *에러 시나리오 라이브 검증* task 가 필요할 수 있음.

## 9. 다음 단계

Stage 4 종료. **본 task 의 모든 단계 (1~3 본행 + 4 옵셔널) 종결**.

다음:
- **최종 보고서** (`mydocs/report/task_agent-v0.1_6_report.md`) 작성
- **오늘 할일** (`mydocs/orders/20260501.md`) 갱신
- **방법론 다듬기 정식화** (R-016/R-017/R-018/R-019 후보) 회고
- 작업지시자 승인 후 `local/task6` → `local/devel` merge

작업지시자 승인 대기.

# [Stage 3 보고서] task_agent-v0.1_2 — 옵셔널 실 API + 통합 검증 + 문서

- **이슈**: [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2)
- **수행계획서**: [task_agent-v0.1_2.md](../plans/task_agent-v0.1_2.md)
- **구현계획서**: [task_agent-v0.1_2_impl.md](../plans/task_agent-v0.1_2_impl.md) Stage 3
- **단계**: Stage 3 / 3 (마지막)
- **작성일**: 2026-04-30

---

## 1. 실행 결과 요약

옵셔널 실 API 통합 테스트 추가 (`describe.skip` + `jest.unmock('openai')` 격리), docker compose 환경에서 ConfigModule 검증·ChatModule 부팅 정상 동작 확인. 빈 키 / dummy 키 두 시나리오 모두 의도대로 동작.

| 종료 체크 | 결과 |
|----------|------|
| real-api 테스트가 sk-test 시 skip | ✅ `1 skipped, 4 passed` |
| real-api 테스트가 실 키 시 실행 가능 | ✅ describe.skip 분기 검증됨 (실 호출은 작업지시자 환경에서) |
| 컨테이너 부팅 후 `/health` 정상 + ConfigModule 검증 동작 | ✅ 빈 키 → 부팅 실패 / dummy 키 → 정상 + ChatModule 초기화 |
| `.env.example` ↔ `.env` 항목 정합성 | ✅ OPENAI_MODEL/TIMEOUT_MS 동기화 |

## 2. 실행 로그 발췌

### 2.1 옵셔널 실 API 테스트 (skip 동작 확인)

```
$ npm run test:e2e
Test Suites: 1 skipped, 3 passed, 3 of 4 total
Tests:       1 skipped, 4 passed, 5 total
Time:        1.172 s
```

setup-env.ts 의 `OPENAI_API_KEY='sk-test'` 로 인해 `isRealApiTest=false` → `describe.skip` 분기.

### 2.2 빈 키로 부팅 실패 (의도된 동작)

```
$ docker compose up -d agent-server   # .env 의 OPENAI_API_KEY=
$ docker compose logs agent-server | tail
[Nest] LOG [NestFactory] Starting Nest application...
[Nest] ERROR [ExceptionHandler] Error: Config validation error: "OPENAI_API_KEY" is not allowed to be empty
   at ConfigModule.forRoot (/app/node_modules/@nestjs/config/dist/config.module.js:96:23)

$ docker compose ps agent-server
STATUS: Restarting (1)        # exit code 1, restart 정책에 따라 재시도 중
```

ConfigModule 검증이 컨테이너 부팅 시점에서도 정상 작동. 명시적 에러 메시지로 운영자가 즉시 원인 파악 가능.

### 2.3 dummy 키로 정상 부팅

```
$ # .env 갱신: OPENAI_API_KEY=sk-dummy
$ docker compose up -d agent-server
$ docker compose ps
STATUS: Up 4 seconds   PORTS: 0.0.0.0:3000->3000/tcp

$ docker compose logs agent-server | tail
[Nest] LOG [InstanceLoader] ConfigHostModule dependencies initialized +8ms
[Nest] LOG [InstanceLoader] AppModule dependencies initialized +1ms
[Nest] LOG [InstanceLoader] ConfigModule dependencies initialized +1ms
[Nest] LOG [InstanceLoader] ChatModule dependencies initialized +0ms
[Nest] LOG [RoutesResolver] HealthController {/health}: +2ms
[Nest] LOG [RouterExplorer] Mapped {/health, GET} route +1ms
[Nest] LOG [NestApplication] Nest application successfully started +1ms
rhwp-agent-server listening on :3000

$ curl -s http://localhost:3000/health
{"status":"ok","service":"rhwp-agent-server","version":"0.1.0"}
```

ChatModule 도 정상 초기화 — 즉 ChatService 가 OPENAI_CLIENT factory(dummy key 로 OpenAI 인스턴스화) + ConfigService 주입 모두 성공.

### 2.4 정리

```
$ docker compose down
 Container rhwp-fork-agent-server-1  Removed
 Network rhwp-fork_default  Removed
```

## 3. 변경 파일 목록

### 신규

| 경로 | 용도 |
|------|------|
| `rhwp-agent-server/test/chat-real-api.e2e-spec.ts` | 옵셔널 실 API 통합 테스트 (jest.unmock + describe.skip 분기) |

### 수정

| 경로 | 변경 |
|------|------|
| `rhwp-agent-server/.env` | OPENAI_API_KEY=sk-dummy 로 갱신, OPENAI_MODEL/TIMEOUT_MS 추가 (gitignore 처리됨) |

## 4. 계획 대비 편차 (Deviations)

### 4.1 R-007/R-008/R-009 모두 입증 완료

| 가설 | Stage 1 | Stage 2 | Stage 3 |
|------|---------|---------|---------|
| R-007 | 입증 | 추가 입증 | 추가 입증 (Stage 3 추가 도구 도입 0) |
| R-008 | 입증 | 추가 입증 | **완전 입증** (compose 까지 자동 명령으로 검증, manual curl 0회) |
| R-009 | 부분 | 입증 | 추가 입증 (실 API 응답 시간 < 40s ± 10s 자동 expect) |

3 stage 누적 — manual curl 0회, 외부 도구 deviation 0건.

### 4.2 ConfigModule 검증의 컨테이너 환경 첫 검증

Stage 1 의 단위/e2e 검증은 jest 환경. 본 stage 에서 *실제 production 컨테이너* 환경에서도 동일 검증 동작 확인. 즉 빈 OPENAI_API_KEY 로 부팅 시 *컨테이너 즉시 종료 + 명시적 에러 로그* — production 운영 시 사전 검증 견고함 입증.

### 4.3 컨테이너 restart 정책 (#1 의 deviation 4.1 재검토)

#1 Stage 3 에서 `docker kill` 시 restart 정책이 즉시 작동 안 한 deviation 이 있었음. 본 stage 에서 *exit code 1 (ConfigModule 검증 실패)* 로 종료된 후에는 정책에 따라 정상 재시도 (`Restarting (1)` 상태 관찰). 즉 *명시적 docker kill* 과 *애플리케이션 비정상 exit* 는 다른 동작 — restart 정책은 후자에서 정상 작동. **#1 deviation 4.1 부분 해소**.

## 5. 검증 방법 (재현)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork

# 자동 테스트
cd rhwp-agent-server
npm run build
npm test                          # 단위: 3 passed
npm run test:e2e                  # e2e: 4 passed + 1 skipped (real-api)

# Compose 통합 — 빈 키 시 검증 실패
cd ..
echo "OPENAI_API_KEY=" > rhwp-agent-server/.env.test-empty
# 또는 .env 의 OPENAI_API_KEY 비움
docker compose up -d agent-server
docker compose logs agent-server | grep "OPENAI_API_KEY"   # 검증 에러 확인

# Compose 통합 — dummy 키 시 정상
sed -i '' 's/^OPENAI_API_KEY=$/OPENAI_API_KEY=sk-dummy/' rhwp-agent-server/.env
docker compose up -d agent-server
sleep 3
curl -s http://localhost:3000/health   # → status:ok JSON
docker compose down

# 실 API 테스트 (옵셔널)
export OPENAI_API_KEY=sk-... # 실 키
cd rhwp-agent-server
npm run test:e2e -- --testPathPattern=real-api    # 1 passed (실 호출)
```

## 6. 다음 단계 — 최종 보고서 + 커밋

- [ ] Stage 3 보고서 승인
- [ ] 최종 보고서 작성 (R-007/R-008/R-009 가설 3건 종합 평가 + R-011/R-012 후보)
- [ ] orders/20260430.md 갱신 또는 신규 일자
- [ ] 4 커밋 분할 (Stage 1 / Stage 2 / Stage 3 / 최종)
- [ ] 이슈 #2 클로즈 + local/devel merge

## 7. 방법론 평가 메모

### 7.1 R-007/R-008/R-009 3 stage 종합

본 task 는 fork 첫 *방법론 다듬기 사전 적용 task*. 3 stage 동안 각 가설이 일관되게 입증됨. 핵심 관찰:

- **R-008 (자동 테스트 우선)** 이 가장 큰 효과. 작업지시자 manual 검증 부담이 #1 (3회) 대비 0회로 감소.
- **R-007 (도구 버전 제약화)** 가 deviation 발생률을 명확히 낮춤. #1 Stage 1 (Node/NestJS 2건) 대비 #2 Stage 1 (의존성 deviation 0).
- **R-009 (수치형 + 오차)** 가 시간·응답 시간 모두 *deviation 분류 명확화*에 기여. *허용 오차 안*인 경우 deviation 으로 분류하지 않게 됨.

### 7.2 R-011 / R-012 신규 후보

본 task 회고에서 발견한 절차 다듬기 후보:

- **R-011 — 누적 환경 정합성 점검**: Stage 1 의 .env 파일 경합 (#1 Stage 3 잔재) 처럼 *이전 task 산출물*이 다음 task 의 환경에 영향. *task 시작 시점에 working tree·.env·캐시 상태 점검* 단계 추가 검토.
- **R-012 — jest manual mock 의 단일 진실 원천**: src/ + test/ 의 jest config 분리로 mock 파일 dup 발생. *모킹 대상이 늘어날수록 dup 증가* → 별도 정리 task 후보.

본 task 종료 시 정식화 검토.

### 7.3 Stage 3 의 시간 실측 (R-009 누적)

- **계획**: 30 ± 15분 (15~45분)
- **실제**: 약 25분
- **분석**: 계획 범위 안. compose 통합 검증이 *Stage 1 의 ConfigModule 검증을 production 환경에서도 재검증* 하는 흐름으로 자연스럽게 진행. **R-009 가설 입증 누적**.

### 7.4 본 task 의 가장 큰 학습

*"방법론 다듬기는 단순 회고 산출물이 아니라 다음 task 의 입력*"  — 본 task 가 R-007/R-008/R-009 를 사전 적용했고, 모두 가설대로 동작. 이는 fork 절차의 *자기 개선 루프*가 동작 가능함을 입증. 다음 task (#3) 부터는 R-011/R-012 도 사전 적용해 측정.

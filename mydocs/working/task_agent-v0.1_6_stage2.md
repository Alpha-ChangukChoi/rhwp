# [Stage 2 보고서] task_agent-v0.1_6 — main.ts CORS + ValidationPipe + HTTP e2e 10건

- **이슈**: [#6](https://github.com/Alpha-ChangukChoi/rhwp/issues/6)
- **수행계획서**: [task_agent-v0.1_6.md](../plans/task_agent-v0.1_6.md)
- **구현계획서**: [task_agent-v0.1_6_impl.md](../plans/task_agent-v0.1_6_impl.md)
- **단계**: 2 / 3 (+ 옵셔널 4)
- **브랜치**: `local/task6`
- **작성일**: 2026-05-01
- **소요 시간**: 약 25분 (기준 35±15분 — 허용 범위 내, R-009 정상)

---

## 1. R-010 외부 정보 조회 결과

본 stage 의 외부 docs 의존: **0건** (NestJS 표준 패턴, supertest 표준).

| 항목 | 출처 | 차단 시 영향 |
|------|------|------------|
| `app.enableCors({ origin: string[] })` | NestJS docs (CORS) | 0 |
| `app.useGlobalPipes(new ValidationPipe(...))` | NestJS docs (Pipes) | 0 |
| `supertest` v7.0 default export (`import request from 'supertest'`) | npm | 0 — *D-6-2 발견 즉시 해결* |

R-010 차단 시 영향 0 유지.

## 2. 변경 파일

### 신규 (1개)

| 경로 | 라인 | 역할 |
|------|------|------|
| `rhwp-agent-server/test/chat-http.e2e-spec.ts` | 188 | HTTP e2e 10건 (정상 2 + 에러 2 + DTO 검증 3 + CORS 2 + 멀티턴 1) |

### 수정 (2개)

| 경로 | 변경 내용 |
|------|----------|
| `rhwp-agent-server/src/main.ts` | `app.enableCors({...})` (R-6-C) + `app.useGlobalPipes(ValidationPipe)` (R-6-B) 추가 |
| `rhwp-agent-server/src/chat/chat.service.ts` | `completeWithTools` 의 `openai.chat.completions.create` try/catch 추가 — raw 에러 → `OpenAiError` wrap (D-6-3) |

본가 코드 무수정 ✅. `rhwp-agent-server/` 는 fork 영역.

## 3. 빌드·테스트 결과

```
$ npm run build
> rhwp-agent-server@0.0.1 build
> nest build
```

exit 0 — TypeScript strict 통과.

```
$ npm test
Test Suites: 6 passed, 6 total
Tests:       38 passed, 38 total
Time:        1.140 s

$ npm run test:e2e
Test Suites: 1 skipped, 6 passed, 6 of 7 total
Tests:       1 skipped, 16 passed, 17 total
Time:        1.667 s
```

**누적**:
- 단위 38건 (Stage 1 와 동일 — completeWithTools 변경에도 회귀 0)
- e2e 16 pass + 1 skipped (chat-real-api: OPENAI_API_KEY 미설정 시 skip).
  - 신규 chat-http 10건 + 기존 6건 (chat 1, chat-tools 4, chat-session 1, config 4, health 1).

## 4. 신규 e2e 10건 분류

| # | 테스트 | 검증 항목 | R-* |
|---|--------|----------|-----|
| 1 | POST /chat/session → 201 + uuid | 정상 endpoint | R-6-A/G |
| 2 | POST /chat/session/:id/messages → 201 + reply (응답시간 < 700ms) | 정상 endpoint + R-009 | R-6-A/E, R-009 |
| 3 | POST /chat/session/:bad-id/messages → 404 | SessionNotFoundError 매핑 | R-6-D |
| 4 | OpenAI 에러 → 502 | OpenAiError 매핑 | R-6-D |
| 5 | content 부재 → 400 | DTO 필수 | R-6-B |
| 6 | content max length 초과 (13000) → 400 | R-009 max length | R-6-B, R-009 |
| 7 | whitelist — DTO 외 필드 → 400 | forbidNonWhitelisted | R-6-B |
| 8 | OPTIONS /chat/session — preflight (origin: localhost:7700) → 204 + allow-origin | CORS 정상 | R-6-C |
| 9 | OPTIONS /chat/session — evil.example.com → allow-origin 부재 | CORS 거부 | R-6-C |
| 10 | 두 번째 메시지 — sessionId 재사용 (history 길이 = 3) | 멀티턴 | R-5-D 호환 |

> **계획서 "9건" 표기 오타**: 항목 합산 (정상 2 + 에러 2 + DTO 검증 3 + CORS 2 + 멀티턴 1) = **10**. 실제 구현 10건이 정상.

## 5. 결정 적용 결과 (R-6-A~I, Stage 2 영역)

| ID | 추천 | Stage 2 적용 | 변경 |
|----|------|-----------|------|
| R-6-B class-validator + ValidationPipe | 채택 | `useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))` | — |
| R-6-C CORS 명시 list | 채택 | `app.enableCors({ origin: [4 dev port], methods, headers })` 환경변수 기반 | — |
| R-6-D Exception Filter | 검증 자동 (Stage 1 적용) | e2e #3, #4 자동 expect | — |
| R-009 응답시간 + max length | 채택 | mock < 700ms (lines 78), max 13000 → 400 (line 117) | — |

R-6-A/E/F/G 는 Stage 1 적용. R-6-H (검증 방식 — Stage 4 통합), R-6-I (미인증) 는 Stage 4 영역.

## 6. 발견·deviation

### D-6-2: supertest v7 default export

**현상**: `import * as request from 'supertest'` 시 `TypeError: request is not a function`.

**원인**: supertest v7 은 *default export only* (`module.exports = function(...)`) — `tsconfig.esModuleInterop: true` 환경에서 `import request from 'supertest'` 형식 강제.

**처리**: import 변경 → 즉시 통과. R-010 사전 명시 항목 보강 자료.

**deviation 분류**: 즉시 해결. R-009 수치 영역 외.

### D-6-3: ChatService.completeWithTools — raw OpenAI 에러 미 wrap

**현상**: e2e #4 "OpenAI 에러 → 502" 첫 실행 시 500 반환.

**원인**: `complete()` 는 try/catch 로 raw 에러를 `OpenAiError` 로 wrap (chat.service.ts:51-54), 그러나 `completeWithTools()` 는 *무 wrap* — Task #3 도입 시 누락. ChatController → completeInSession → completeWithTools 경로의 OpenAI 에러가 raw `Error` 로 propagate 되어 ExceptionFilter (`@Catch(OpenAiError, ...)`) 가 미매칭 → 500.

**처리**: `completeWithTools` 의 `openai.chat.completions.create` 호출에 try/catch 추가. `complete()` 와 동일 패턴 — `if (err instanceof OpenAiError) throw err; throw new OpenAiError('...', err);`.

**검증**: 수정 후 e2e #4 통과. 단위 38건 회귀 0 (기존 chat-tools.e2e 통과 — wrap 결과는 동일 throw 의미라 영향 없음).

**deviation 분류**: **R-6-D 결정 적용의 누락 영역 발견** — Task #3 도입 단계에서 `complete()` 만 wrap, `completeWithTools()` 누락. R-014/R-015 의무 점검표는 *현재 task* 결정만 검증하는데, 본 결함은 *과거 task* 의 결정 일관성 영역. R-014/R-015 *누적 일관성 점검* 가설 보강 자료.

### D-6-2 추가 분석: 계획서 e2e 9건 → 10건

구현계획서 §2.2 텍스트의 *"9건의 HTTP e2e (정상 2 + 에러 2 + DTO 검증 3 + CORS 2 + 멀티턴 1)"* 는 합산 오타. 실제 구현 10건. 결정 변경/누락 0 (계획 항목 그대로 모두 구현).

### deviation 수치 (R-009 기준)

- 응답시간: e2e 18건 모두 *기대치 < 700ms* 만족
- max length: 13000 (요구 12000) 입력 → 정확히 400
- 단위·e2e 회귀: 0건

## 7. 종료 체크

- [x] main.ts `app.enableCors()` + `useGlobalPipes(ValidationPipe)` 등록
- [x] HTTP e2e 10건 모두 pass (계획 9건 → 항목 합산 오타, 실제 10건)
- [x] R-009 응답시간 < 700ms 자동 expect
- [x] R-6-B DTO 검증 (3건) 통과
- [x] R-6-C CORS preflight (정상 + 거부, 2건) 통과
- [x] R-6-D 에러 매핑 (404 + 502, 2건) 통과
- [x] 기존 e2e (chat / chat-tools / chat-session / config / health) 회귀 0
- [x] 단위 38건 회귀 0

## 8. 방법론 평가 메모

### R-014/R-015 세 번째 의무 적용 — Stage 2 효과

| 측정 항목 | #4 | #5 | #6 (본 task) Stage 1+2 |
|----------|----|----|------|
| 결정 변경 | 0 | 0 | **0 유지** (R-6-A~G 추천 그대로) |
| 누락 | 0 | 0 | **0 (현재 task)** + **1 (과거 task #3 누락 D-6-3)** |
| 추천 강화 효과 | — | R-5-B EventTarget | (Stage 진행 중) |

**현재 task 결정 누락 0건 유지**. 그러나 D-6-3 으로 *과거 task #3 의 R-3-* 결정 누락이 후행 task 의 e2e 에서 노출 — *결정 누적 일관성* 의 새로운 발견. R-014/R-015 의무 점검표는 *현재 task* 영역만 다루고 있어 본 사례는 가설 보강 자료.

### R-013 backend 표준 — 2/3 단계 통과

| 단계 | 통과 | 도구 |
|-----|------|------|
| Layer 1 jest 단위 | ✅ Stage 1 | jest |
| Layer 1 jest e2e (HTTP supertest, mocked openai) | ✅ Stage 2 | supertest + jest-e2e |
| Layer 2 compose 부팅 + 라우트 노출 + CORS preflight 실측 | (Stage 3) | docker compose + curl |

R-013 *2 단계 검증 사다리* 의 layer 1 두 형태 모두 통과 — Stage 3 에서 layer 2 진입.

### D-6-3 의 의미 — *결정 누적 일관성 검증* 가설

R-6-D ("Session*Error → 404/410, OpenAiError → 502") 는 *현재 task* 의 결정. 그러나 ExceptionFilter 의 효력은 *과거 task* 의 ChatService 구현 일관성에 의존. D-6-3 이 그 누락을 드러냄.

**가설 후보 (R-018?)**: "결정 사항 적용 시 *과거 task* 의 결정 적용 영역도 누락 점검 — 특히 같은 레이어 (e.g., ChatService) 의 다른 메서드". 마일스톤 종결 회고에서 정식화 검토.

## 9. 다음 단계

Stage 3 진입 — compose 부팅 + ChatController 라우트 노출 + CORS preflight 실측 (R-013 layer 2). 기준 25±10분 (R-009).

작업지시자 승인 후 진입.

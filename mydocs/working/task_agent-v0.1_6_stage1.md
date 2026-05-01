# [Stage 1 보고서] task_agent-v0.1_6 — DTO + ChatController + ExceptionFilter + 단위 테스트

- **이슈**: [#6](https://github.com/Alpha-ChangukChoi/rhwp/issues/6)
- **수행계획서**: [task_agent-v0.1_6.md](../plans/task_agent-v0.1_6.md)
- **구현계획서**: [task_agent-v0.1_6_impl.md](../plans/task_agent-v0.1_6_impl.md)
- **단계**: 1 / 3 (+ 옵셔널 4)
- **브랜치**: `local/task6`
- **작성일**: 2026-05-01
- **소요 시간**: 약 30분 (기준 40±15분 — 허용 범위 내, R-009 정상)

---

## 1. R-010 외부 정보 조회 결과

본 stage 의 외부 docs 의존: **0건** (NestJS 표준 패턴).

| 항목 | 출처 | 차단 시 영향 |
|------|------|------------|
| `class-validator` v0.15.1 / `class-transformer` v0.5.1 | npm latest stable | 0 |
| NestJS `@Catch` exception filter + `APP_FILTER` 글로벌 등록 | NestJS docs | 0 |
| NestJS `@Controller`, `@Post`, `@Body`, `@Param` | NestJS docs | 0 |
| `import type` (TS isolatedModules + emitDecoratorMetadata) | TS docs (빌드 시 발견) | 0 — *D-6-1 발견 즉시 해결* |

R-010 차단 시 영향 0 유지.

## 2. 변경 파일

### 신규 (4개)

| 경로 | 라인 | 역할 |
|------|------|------|
| `rhwp-agent-server/src/chat/chat.dto.ts` | 11 | `SendMessageDto` (R-009 max length 12000 server, 10000 client 보다 약간 관대) |
| `rhwp-agent-server/src/chat/chat.exception-filter.ts` | 47 | `ChatExceptionFilter` — Session*Error → 404/410, OpenAiError → 502 (R-6-D) |
| `rhwp-agent-server/src/chat/chat.controller.ts` | 33 | `@Controller('chat')` + 2 endpoint, ChatService 만 의존 (R-6-F) |
| `rhwp-agent-server/src/chat/chat.controller.spec.ts` | 38 | ChatController 단위 테스트 (mock ChatService, 2건) |
| `rhwp-agent-server/src/chat/chat.exception-filter.spec.ts` | 53 | ChatExceptionFilter 단위 테스트 (3건) |

### 수정 (4개)

| 경로 | 변경 내용 |
|------|----------|
| `rhwp-agent-server/package.json` | `class-validator ^0.15.1`, `class-transformer ^0.5.1` 추가 |
| `rhwp-agent-server/src/config/env.schema.ts` | `CORS_ALLOWED_ORIGINS` Joi 검증 추가 (default 4 dev port) |
| `rhwp-agent-server/.env.example` | `CORS_ALLOWED_ORIGINS` 명시 |
| `rhwp-agent-server/src/chat/chat.service.ts` | `createSession(): SessionId` 메서드 추가 (R-6-G, SessionService.create() wrapper) |
| `rhwp-agent-server/src/chat/chat.module.ts` | `controllers: [ChatController]` + `APP_FILTER` 글로벌 등록 |
| `rhwp-agent-server/src/chat/chat.service.spec.ts` | createSession 1건 추가 |

본가 코드 무수정 ✅. `rhwp-agent-server/` 는 fork 영역.

## 3. 빌드 결과

```
$ npm run build
> rhwp-agent-server@0.0.1 build
> nest build
```

exit 0 — TypeScript strict 통과.

## 4. 단위 테스트 결과

```
$ npm test
Test Suites: 6 passed, 6 total
Tests:       38 passed, 38 total
Time:        1.585 s
```

**누적 38건** = 기존 32건 (#1~#4) + Stage 1 신규 6건.

### 신규 6건 분류

| # | 테스트 | 검증 항목 | R-* |
|---|--------|----------|-----|
| 1 | ChatController POST /chat/session — createSession 호출 + sessionId 반환 | endpoint 정상 동작 | R-6-G |
| 2 | ChatController POST /chat/session/:id/messages — completeInSession 호출 + reply 반환 | endpoint 정상 동작 | R-6-A, R-6-E, R-6-F |
| 3 | ChatExceptionFilter — SessionNotFoundError → 404 | Filter 매핑 | R-6-D |
| 4 | ChatExceptionFilter — SessionExpiredError → 410 | Filter 매핑 | R-6-D |
| 5 | ChatExceptionFilter — OpenAiError → 502 | Filter 매핑 | R-6-D |
| 6 | ChatService.createSession — SessionService.create() wrapper | 신규 메서드 | R-6-G |

## 5. 결정 적용 결과 (R-6-A~I)

| ID | 추천 | Stage 1 적용 | 변경 |
|----|------|-----------|------|
| R-6-A REST POST | 채택 | `@Post('session')`, `@Post('session/:id/messages')` | — |
| R-6-B class-validator | 채택 | `SendMessageDto` + `@IsString()`, `@MaxLength(12000)` | — |
| R-6-D Exception Filter | 채택 | `@Catch(SessionNotFoundError, SessionExpiredError, OpenAiError)` + APP_FILTER 글로벌 | — |
| R-6-E #5 mock 형식 | 채택 | `{ sessionId }`, `{ reply: ChatMessage }` | — |
| R-6-F ChatService 만 의존 | 채택 | constructor 1 의존 | — |
| R-6-G createSession 노출 | 채택 | `ChatService.createSession()` (1 라인 wrapper) | — |

R-6-C (CORS 명시 list), R-6-H (검증 방식 — Stage 4 통합), R-6-I (미인증) 는 Stage 2/3/4 영역.

## 6. 발견·deviation

### D-6-1: TypeScript `TS1272` — type-only import 강제

**현상**: 첫 빌드 시 `chat.controller.ts:26 @Param('id') id: SessionId` 에러 — `isolatedModules + emitDecoratorMetadata` 조합에서 *decorator 가 참조하는 type 은 `import type` 강제*.

**원인**: NestJS reflect-metadata 가 *runtime metadata* 를 emit 하는데 `SessionId` 가 *type alias* (`type SessionId = string`) — runtime value 부재. `import type` 으로 명시해야 컴파일러가 *metadata 에 string 으로 emit*.

**처리**: `import type { ChatMessage }`, `import type { SessionId }` 로 변경 → 빌드 통과.

**deviation 분류**: 즉시 해결. R-010 의 *외부 정보 조회 사전 명시* 항목에 *NestJS + isolatedModules type-only import* 패턴이 사전 미명시 — 차후 R-010 가설 보강 자료.

### deviation: 0건 (R-009 기준)

D-6-1 은 *기술 발견 (해결됨)* — R-009 수치 영역 외.

## 7. 종료 체크

- [x] R-010 외부 docs 의존 명시 + D-6-1 발견 즉시 해결
- [x] `npm install class-validator class-transformer` 성공 + `package.json` 갱신
- [x] `npm run build` exit 0
- [x] DTO + ChatService.createSession + ChatController + ExceptionFilter + ChatModule 갱신
- [x] 단위 테스트 +6건 모두 pass (누적 38)
- [x] R-6-D Filter 매핑: 404/410/502 검증 자동
- [x] R-6-F/G ChatController 가 ChatService 만 의존 + createSession 노출

## 8. 방법론 평가 메모

### R-014/R-015 세 번째 의무 적용 — Stage 1 효과

| 측정 항목 | #4 | #5 | #6 (본 task) Stage 1 |
|----------|----|----|------|
| 결정 변경 | 0 | 0 | **0 유지** (R-6-A/B/D/E/F/G 모두 추천 그대로) |
| 누락 | 0 | 0 | **0 유지** (Stage 1 영역 6 결정 모두 적용) |
| 추천 강화 효과 | — | R-5-B EventTarget | (Stage 진행 중) |

**결정 변경 0건 + 누락 0건** — 세 task 연속 유지. R-014/R-015 가설 강화.

### R-013 backend 표준 (#2~#4 와 동일)

본 task 는 backend 라 R-013 의 *jest + compose* 사다리 (frontend 변형 R-5-K 비적용). Stage 1 = layer 1 (jest 단위) 통과. Stage 2/3 에서 layer 1 (jest e2e) + layer 2 (compose) 진행.

### 복구 사태 — shadow 디렉토리 (방법론 외)

본 task Stage 0 commit 시점에 *작업 디렉토리 shadow* 발견 (Desktop/open-source/rhwp-fork 가 빈 폴더로 자동 생성, 진짜 저장소는 Desktop/side-projects/rhwp-fork). 두 plan 파일을 진짜 저장소로 이동 + shadow 삭제 + 정상 commit. 방법론 외 환경 사태 — 향후 *모든 명령 절대 경로 + `git -C`* 회피 패턴 정립.

## 9. 다음 단계

Stage 2 진입 — `main.ts` CORS + ValidationPipe 등록 + HTTP e2e 9건 (supertest, mocked OpenAI). 기준 35±15분 (R-009).

작업지시자 승인 후 진입.

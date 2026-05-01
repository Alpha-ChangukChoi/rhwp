# [수행계획서] task_agent-v0.1_6 — agent-server HTTP endpoint (ChatController) + CORS

- **이슈**: [#6](https://github.com/Alpha-ChangukChoi/rhwp/issues/6)
- **마일스톤**: agent-v0.1 (**마지막 task** — 종결 시 100% 완성)
- **브랜치**: `local/task6`
- **선행 task**: [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1) ✅ + [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2) ✅ + [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3) ✅ + [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4) ✅ + [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5) ✅
- **작성일**: 2026-05-01
- **방법론 근거**: 본가 [CLAUDE.md](../../CLAUDE.md) 절차 3단계 + fork [methodology_refinements.md](../manual/methodology_refinements.md) R-001/R-007/R-008/R-009/R-010/R-011/R-013/R-014/R-015

---

## 1. 목적 / 배경

agent-v0.1 마일스톤의 **마지막 task** — 백엔드와 프런트엔드 통합 완성.

#5 의 Stage 0 사전 점검 §2.1 발견:

> agent-server 가 *이미 HTTP 모드* (`app.listen(3000)`). 단지 `ChatController` 부재. 즉 **#6 의 작업 범위가 좁아짐** — ChatController 등록 + 인증/CORS + sessionId 발급 endpoint 만.

#5 가 mock 가정한 인터페이스를 **실 endpoint 로 구현**:

```
POST /chat/session                          → { sessionId: string }
POST /chat/session/:id/messages  body { content }  → { reply: ChatMessage }
```

본 task 종결 시 rhwp-studio 사이드바 (#5) ↔ agent-server (#1~#4) 의 **실 OpenAI 채팅** 동작 가능 → **agent-v0.1 마일스톤 100% 완성**.

```
사용자 입력 → 사이드바 (#5)
        ↓ POST /chat/session/:id/messages
ChatController (#6 본 task)
        ├─ SessionExpiredError → 410
        ├─ SessionNotFoundError → 404
        ├─ OpenAI 에러 → 502
        └─ 정상 → ChatService.completeInSession() → reply
                   ↑ #4 의 멀티턴 세션 그대로 활용
```

## 2. 종료 조건

이슈 #6 의 종료 조건을 그대로 인용 (R-009 적용된 수치 포함).

- [ ] `ChatController` — `POST /chat/session`, `POST /chat/session/:id/messages` 단위 테스트
- [ ] DTO + 입력 검증 — invalid body 시 400 응답
- [ ] CORS — preflight (OPTIONS) + Origin 허용 list 동작 검증
- [ ] 에러 매핑: `SessionNotFoundError` → 404, `SessionExpiredError` → 410, OpenAI 에러 → 502
- [ ] 응답 시간 (R-009): mock OpenAI < **500 ± 200 ms**, 실 OpenAI < **15 ± 5초** (옵셔널 Stage)
- [ ] **#5 의 mock 가정 인터페이스와 실 endpoint 정합 검증** — rhwp-studio 통합 e2e 가 mock 제거 후 실 호출로도 통과
- [ ] compose 부팅 — ChatController 라우트 정상 노출 (R-013 layer 2)
- [ ] 수행계획서 / 구현계획서 / 단계별 보고서 / 최종 보고서

## 3. 영향 범위

| 종류 | 경로 | 변경 형태 |
|------|------|----------|
| 신규 | `rhwp-agent-server/src/chat/chat.controller.ts` | ChatController — 2 endpoint |
| 신규 | `rhwp-agent-server/src/chat/chat.dto.ts` | SendMessageDto (content) — DTO + class-validator decorator |
| 신규 | `rhwp-agent-server/src/chat/chat.exception-filter.ts` | SessionExceptionFilter — Session*Error → HttpException 매핑 |
| 신규 | `rhwp-agent-server/src/chat/chat.controller.spec.ts` | ChatController 단위 테스트 (mock ChatService) |
| 신규 | `rhwp-agent-server/test/chat-http.e2e-spec.ts` | HTTP e2e — supertest + mocked OpenAI |
| 수정 | `rhwp-agent-server/src/chat/chat.module.ts` | ChatController 등록 + ExceptionFilter 등록 (또는 APP_FILTER) |
| 수정 | `rhwp-agent-server/src/chat/chat.service.ts` | `createSession()` 메서드 추가 (R-6-G) — SessionService.create() wrapper |
| 수정 | `rhwp-agent-server/src/main.ts` | `app.enableCors()` + ValidationPipe 글로벌 등록 |
| 수정 | `rhwp-agent-server/src/config/env.schema.ts` | `CORS_ALLOWED_ORIGINS` 환경변수 추가 (Joi 검증) |
| 수정 | `rhwp-agent-server/.env.example` | 위 환경변수 default 명시 |
| 수정 | `rhwp-agent-server/package.json` | `class-validator`, `class-transformer` (R-6-B 채택 시) — 안정 채널 |

본가 코드 무수정 ✅ (`rhwp-agent-server/` 는 fork 신규 영역). `rhwp-studio/` 도 본 task 무수정 (단 *통합 검증 Stage 4 옵셔널* 시 e2e 추가 가능).

### 누적 환경 점검 (R-011)

본 task 시작 시 점검 완료:

- working tree clean ✅ (`local/task6` 분기 직후)
- `rhwp-agent-server/.env`: OPENAI_* 3개 (5 task 누적 일관)
- `rhwp-agent-server/{node_modules,dist}` 캐시 유효 ✅
- `rhwp-fork-agent-server:latest` (286MB) 캐시 유효 ✅
- `rhwp-studio/{node_modules,dist}` 유효 ✅
- `pkg/` WASM 보강 완료 (`local/env-pkg-wasm`, 2026-05-01)
- agent-server HTTP 모드 (#5 Stage 0 발견) — `app.listen(3000)`, 현재 `/health` 만
- ChatService.completeInSession() + SessionService.create() 인터페이스 안정 (#4)

## 4. 외부 의존성

R-007 적용 (모두 *제약*으로 명시):

| 항목 | 제약 | 비고 |
|------|------|------|
| `class-validator` | 안정 채널 (R-6-B 채택 시) | `class-transformer` 필수 페어 |
| `class-transformer` | 안정 채널 | NestJS ValidationPipe 의존 |
| `@nestjs/common` (HttpException, etc) | #1 그대로 | 변경 없음 |
| `@nestjs/config` Joi 검증 | #2 그대로 | `CORS_ALLOWED_ORIGINS` 추가 |
| `supertest` | NestJS e2e 표준 (#1 부터 사용) | 변경 없음 |

**신규 의존성 2개** (`class-validator`, `class-transformer` 페어). 단지 *NestJS 표준 DTO 검증* 도구라 위험 작음. R-6-B 가 zod 채택 시 이 두 의존성 제거 + 별도 zod pipe 작성 부담.

## 5. 단계 분할 개요 (잠정, 구현계획서에서 확정)

| Stage | 내용 | 검증 |
|-------|------|------|
| **Stage 1** | DTO + ChatService.createSession() + ChatController + Exception filter + 단위 테스트 | `npm test` 단위 검증 |
| **Stage 2** | main.ts CORS + ValidationPipe 등록 + HTTP e2e (supertest, mocked OpenAI) | `npm run test:e2e` |
| **Stage 3** | compose 부팅 검증 (R-013 layer 2) — ChatController 라우트 노출 + CORS preflight 실측 | `docker compose up agent-server` + curl OPTIONS/POST |
| **Stage 4** (선택) | rhwp-studio 통합 검증 — agent-server 띄운 상태에서 puppeteer 가 mock 제거 + 실 호출 | host CDP 모드 + Stage 3 의 mock OpenAI |

3 stage (본가 절차 최소치 — backend 표준) + Stage 4 옵셔널 (rhwp-studio 통합).

## 6. 리스크 / 미해결 결정사항

R-015 적용 — 각 항목별 추천 + 이유 + **반대 입장 근거**.

### R-6-A. 프로토콜 (REST POST vs. WebSocket vs. SSE)
- **추천**: **REST POST**
- **이유**:
  1. #5 의 mock 가정 인터페이스 (`POST /chat/session`, `POST /chat/session/:id/messages`) 정합 — 변경 시 #5 e2e 모두 갱신
  2. NestJS Controller 표준 패턴 (Decorator 기반 라우팅) — 도구 표준
  3. *멀티턴 채팅의 *호출 단위 = 메시지 1건*에 자연스러움 (1 round trip per turn)
- **반대 입장 근거 (WebSocket)**:
  1. *스트리밍 응답* (token-by-token) 가능 — UX 우수
  2. *연결 유지* 로 round trip 비용 ↓
  3. 그러나 *멀티턴 sessionId* 가 *connection 단위* 가 되어 *#4 의 in-memory store 단일 프로세스 가정* 와 정합 (그러나 인프라 복잡도 ↑)
- **반대 입장 근거 (SSE)**:
  1. 단방향 server push — 스트리밍 가능
  2. 그러나 *클라이언트 → 서버* 는 별도 POST 필요 → 비대칭
  3. WebSocket 보다 단순하나 *양방향 인터페이스* 는 부재
- **결정 경위**: agent-v0.1 의 *MVP* 범위 + #5 mock 가정 정합 우선. 스트리밍은 후속 마일스톤.

### R-6-B. 입력 검증 (class-validator vs. zod)
- **추천**: **class-validator + class-transformer**
- **이유**:
  1. NestJS 표준 — `ValidationPipe` 글로벌 등록만으로 *모든 DTO 자동 검증*
  2. NestJS 의 *Decorator-driven 패턴* 정합 (`@Body()`, `@IsString()`, `@MaxLength()`)
  3. 학습 비용 0 (NestJS 도큐먼트 표준)
- **반대 입장 근거 (zod)**:
  1. #3 의 *tool 인자 검증* 에서 zod 채택 → 한 프로젝트 내 *2 검증 라이브러리 공존* 회피
  2. zod 의 *런타임 타입 추론* 우수 (TypeScript 타입 자동 생성)
  3. 그러나 NestJS 와 zod 결합은 *별도 pipe 작성* 필요 — class-validator 의 zero-config 우위
- **결정 경위**: 도메인 분리 — *tool 인자 (도메인 데이터)* = zod (#3), *HTTP DTO (외부 인터페이스)* = class-validator (본 task). 두 도구의 *책임 영역 분리* 가 *coexistence 정당*.

### R-6-C. CORS 정책 (명시 origin list vs. wildcard `*`)
- **추천**: **명시 origin list** — 환경변수 `CORS_ALLOWED_ORIGINS` (default: `http://localhost:7700,http://localhost:4173,http://localhost:7711,http://localhost:7712`)
- **이유**:
  1. 보안 — `*` 는 *credential cookie* 사용 시 거부됨 (브라우저 표준)
  2. 환경변수로 *prod/dev 환경 별 분리* 가능
  3. R-009 적용 — default 값 명시 + 운영 시점 조정
- **반대 입장 근거 (`*`)**:
  1. 개발 단계 편의 — port 변경 시 환경변수 수정 부담 0
  2. 본 task 의 *MVP* 범위 — 보안 부담 작음 (미인증 단계)
  3. 그러나 *명시 list* 와 비교 시 default 동일 효과 (모든 dev port 등록)
- **결정 경위**: 명시 list 가 *prod 시 변경 부담 0* — dev 단계 편의 + 보안 양립.

### R-6-D. 에러 매핑 메커니즘 (HttpException 직접 throw vs. exception filter)
- **추천**: **Exception Filter** (`@Catch(SessionNotFoundError, SessionExpiredError)` + `APP_FILTER`)
- **이유**:
  1. ChatService/SessionService 가 *HTTP 무관* 유지 — 단위 테스트 시 HTTP 의존 0
  2. 책임 분리 — domain error → HTTP status 변환은 *transport layer* 책임
  3. 새 에러 타입 추가 시 filter 1곳만 수정
- **반대 입장 근거 (HttpException 직접 throw)**:
  1. ChatController 가 직접 try/catch + throw HttpException — 흐름 명시적
  2. filter 는 *암묵적* (NestJS lifecycle hook) — 디버깅 시 흐름 파악 어려움
  3. NestJS 표준 패턴은 *둘 다 허용*
- **결정 경위**: domain layer 의 HTTP 무관 유지가 R-013 layer 1 (jest 단위) 의 격리도 강화. 본 task 의 long-term 유지보수성 우선.

### R-6-E. 응답 형식 (#5 mock 가정 형식 vs. wrapper)
- **추천**: **#5 mock 가정 형식 그대로** — `{ sessionId: string }`, `{ reply: ChatMessage }`
- **이유**:
  1. #5 의 mock e2e 가 정상 동작 → 변경 0
  2. 단순 — wrapper (`{ data, error }`) 는 *에러 표현 통일* 가치이나 HTTP status 가 이미 그 역할
  3. JSON Schema 표준 패턴
- **반대 입장 근거 (wrapper)**:
  1. 향후 *epoch / version / metadata* 추가 여유 (`{ data, meta }`)
  2. 에러 응답 형식 통일 (`{ error: { code, message } }`)
  3. 그러나 본 task 의 *MVP* 범위에서 미리 도입 시 *YAGNI*
- **결정 경위**: #5 정합 우선. wrapper 도입은 *다음 마일스톤 (스트리밍/스키마 versioning) 시점* 에 검토.

### R-6-F. ChatController ↔ SessionService 의존 (직접 주입 vs. ChatService 만)
- **추천**: **ChatService 만 의존** (createSession 도 ChatService 에 추가, R-6-G)
- **이유**:
  1. ChatController 의존성 단일화 — 단위 테스트 mock 1개
  2. *대화 라이프사이클* 의 단일 진입점 = ChatService → 책임 명확
  3. 후속 *system prompt 자동 설정* / *initial messages* 추가 시 ChatService 가 자연 hook
- **반대 입장 근거 (SessionService 직접)**:
  1. *create / get / expire* 등 *세션 관리 endpoint* 가 후속 추가 시 ChatService wrapper 가 *과도한 indirection*
  2. SessionService 의 *ownership* 명확 — Controller 가 직접 호출이 *flatter*
  3. ChatService 가 *세션 + 대화 + 도구* 모두 짊어지면 *모놀리식*
- **결정 경위**: 본 task 범위 = *create + send* 만. 후속 *세션 관리 endpoint (list, expire 직접)* 시점에 SessionService 직접 노출 가능. 본 task 는 ChatService 만 의존.

### R-6-G. createSession 노출 형태 (ChatService 메서드 추가 vs. SessionService 직접)
- **추천**: **`ChatService.createSession(): SessionId`** 추가 — SessionService.create() wrapper
- **이유**:
  1. R-6-F 와 정합 — Controller 의 단일 의존성
  2. 미래 hook (system prompt, initial messages 자동 설정) 의 자연 진입점
  3. 본 task 시점 wrapper 는 *1 라인* (`return this.sessions.create();`) — 부담 0
- **반대 입장 근거**:
  1. *현재 사용처 없는 wrapper* 추가 = R-002 정신 (계획 해상도 조절) 에서 과해상도 후보
  2. 후속에 변경 가능
- **결정 경위**: R-6-F 의 단일 의존성 결정과 묶음. 후속 *세션 관리 endpoint* 추가 시 재검토.

### R-6-H. 검증 방식 (jest e2e mocked OpenAI + 별도 통합 vs. puppeteer 가 실 agent-server 호출)
- **추천**: **jest e2e (supertest, mocked OpenAI) Stage 1·2 + Stage 3 compose + Stage 4 옵셔널 (rhwp-studio + 실 agent-server)**
- **이유**:
  1. R-013 backend 표준 (jest + compose) — 본 task 는 backend
  2. supertest 는 *agent-server 자체 검증* 의 표준 도구 — *CORS / DTO / exception filter* 모두 검증 가능
  3. rhwp-studio 통합 e2e 는 *Stage 4 옵셔널* — 본 task 의 *backend 책임* 분리
- **반대 입장 근거 (puppeteer 가 실 agent-server 호출)**:
  1. *진짜 통합 검증* — frontend ↔ backend 실 호출
  2. CORS preflight 도 실 브라우저 환경에서 검증
  3. 그러나 *agent-server 별도 실행 + 정리* 의 인프라 부담 — Stage 4 옵셔널이 적정
- **결정 경위**: Stage 1·2·3 = backend 자체 검증 (jest + compose). Stage 4 = 옵셔널 통합 (rhwp-studio mock 제거 패턴). 본 task 의 *마일스톤 종결 task* 라 Stage 4 도 *권장* 으로 강화.

### R-6-I. 인증 정책 명시 (미인증 + 후속 task 권장 vs. 옵셔널 토큰 도입)
- **추천**: **본 task 미인증** — README 또는 보고서에 *인증 후속 task* 권장 명시
- **이유**:
  1. agent-v0.1 = *MVP* — 개발 단계 self-hosted 가정
  2. 토큰 도입은 *생성/저장/회전 정책* 동반 — 별도 task 규모
  3. CORS 명시 origin list (R-6-C) 가 *외부 직접 호출* 차단 1차 방어
- **반대 입장 근거 (옵셔널 토큰)**:
  1. 인증 인프라를 *처음부터* 반영 — 후속 도입 시 *백워드 호환* 부담 ↓
  2. 옵셔널 (default 비활성) 이라 미인증 시나리오와 양립
  3. 그러나 *옵셔널 = 사용 안 함* 패턴이 *YAGNI* — 실제 도입 시점에 정의
- **결정 경위**: 본 task 미인증 유지. agent-v0.1 종결 후 *prod-readiness* 별도 task 에서 인증 + rate limit + monitoring 통합.

## 7. 일정 가이드 (R-009)

backend task 라 #4 와 비교 (110±45분).

| 단계 | 코드 작업 (기준 ± 오차) | 비고 |
|------|----------------------|------|
| 수행계획서 | — | 본 문서 |
| 구현계획서 | — | 다음 단계 |
| Stage 1 | 40 ± 15분 | DTO + ChatController + ChatService.createSession + Exception filter + 단위 테스트 |
| Stage 2 | 35 ± 15분 | main.ts CORS + ValidationPipe + HTTP e2e (supertest) |
| Stage 3 | 25 ± 10분 | compose 부팅 + curl OPTIONS/POST + 라우트 노출 검증 |
| Stage 4 (선택) | 30 ± 15분 | rhwp-studio + 실 agent-server 통합 (mock 제거 e2e) |
| 최종 보고서 | — | 마일스톤 종결 회고 + 5 task 누적 평가 |

총 코드 작업 100±40분 (Stage 4 제외). #4 (110±45) 와 유사 — backend 표준.

## 8. 방법론 평가 메모 (사전)

### 8.1 R-007~R-015 사전 적용 (6번째 task) + R-5-K (frontend 한정, 본 task 비적용)

본 task 는 **R-014/R-015 세 번째 의무 적용 사례** + **agent-v0.1 마일스톤 종결 task**.

| ID | 본 task 가설 | 검증 방법 |
|----|-------------|---------|
| R-007 | 신규 의존성 (class-validator + class-transformer) 안정 채널 | npm install latest stable |
| R-008 | 종료 체크 모두 자동 (jest 단위 + supertest e2e + curl) → manual 0 |
| R-009 | 응답시간 (mock < 500±200ms, 실 < 15±5초) / DTO max length 등 자동 expect |
| R-010 | NestJS CORS / ValidationPipe / Exception filter 패턴 — 사전 명시 → 진행 끊김 0 |
| R-011 | 본 task 시작 전 환경 점검 + 자동 회귀 통과 (#5 e2e 16건 + agent-server 자동) |
| R-013 | jest (Stage 1·2) + compose (Stage 3) — backend 표준 |
| R-014 | 이슈 #6 본문 점검표 — 세 번째 의무 적용 |
| R-015 | §6 결정사항 9건 (R-6-A~I) — *반대 입장 근거* 명시 |

### 8.2 R-015 적용 효과 사전 예측

§6 의 R-6-A~I 중 *반대 입장 근거가 추천 변경을 유도할 가능성* 이 높은 항목:

- **R-6-B** (입력 검증): zod 일관성 vs class-validator NestJS 표준 — 도메인 분리 명확화
- **R-6-D** (에러 매핑): exception filter 의 *암묵적 흐름* vs. 직접 throw 의 *명시적 흐름*
- **R-6-G** (createSession 노출): wrapper 추가 vs. SessionService 직접 — *YAGNI 경계*

위 3개는 작업지시자 검증 질문 가능성. 클로드 self-check 단계에서 *반대 입장 근거가 추천 변경 유도하는지* 본 task 종료 시 평가.

### 8.3 마일스톤 종결 회고 — 5+1 task 누적

본 task 는 agent-v0.1 마일스톤의 *마지막 task*. 종결 회고 항목:

| 영역 | 측정 |
|------|------|
| Deviation 트렌드 | #1 (6건) → #2 (3) → #3 (1) → #4 (2) → #5 (6) → #6 (?) |
| 결정 변경 | #3 (1) → #4 (0) → #5 (0) → #6 (?) — R-014/R-015 효과 누적 검증 |
| 시간 (계획 대비) | 5 task 누적 단축 트렌드 유지 |
| Manual 검증 | 0회 유지 |
| 본가 무수정 정책 | 첫 변형 (#5) 안정 → backend 영역에서는 무수정 유지 |

### 8.4 정식화 후보 (마일스톤 종결 시점)

본 task 종료 + 마일스톤 회고 시점에 다음 정식화 검토:

- **R-016 (또는 R-013 보강)** — frontend 검증 사다리 (#5 자료 + 본 task 의 backend 사다리 일관성)
- **R-017 (가설)** — *본가 무수정 정책 변형 패턴* 정식화 (#5 의 옵션 2 변형 + 메뉴 hook 위임 dispatcher 우회 패턴)
- **R-012** (placeholder) jest manual mock dup 정리 후속 task 후보

본 task 는 *정식화 시도 안 함* — 마일스톤 종결 시점에 *5+1 task 누적 자료* 로 일괄 검토.

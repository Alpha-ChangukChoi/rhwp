# [수행계획서] task_agent-v0.1_4 — 멀티턴 세션 히스토리 관리 (in-memory)

- **이슈**: [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4)
- **마일스톤**: agent-v0.1
- **브랜치**: `local/task4`
- **선행 task**: [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1) ✅ + [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2) ✅ + [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3) ✅
- **작성일**: 2026-04-30
- **방법론 근거**: 본가 [CLAUDE.md](../../CLAUDE.md) 절차 3단계 + fork [methodology_refinements.md](../manual/methodology_refinements.md) R-001/R-007/R-008/R-009/R-010/R-011/R-013/R-014/R-015

---

## 1. 목적 / 배경

agent-v0.1 마일스톤의 **멀티턴 대화 인프라**. #2 의 `complete()` 와 #3 의
`completeWithTools()` 는 *단일 호출* 만 처리 — 클라이언트가 매 호출마다 전체 히스토리를
직접 들고 있어야 함. 본 task 는 *세션 단위로 메시지 히스토리를 누적·재사용* 하는
`SessionService` 와 `ChatService.completeInSession()` 메서드를 추가.

```
사용자 입력 + sessionId
    ↓ (#5/#6 에서 만들 채팅 UI)
ChatService.completeInSession(sessionId, userMessage)
    ├─ SessionService.get(sessionId) ── 만료/없음 → 에러 throw
    │     ↓ 누적 history
    ├─ history.concat([userMessage]) → conversation
    ├─ completeWithTools(conversation)  ← #3 그대로 활용
    └─ SessionService.append(sessionId, userMessage + assistantReply)
                                     ↑ 응답까지 누적
```

본 task 는 *in-memory* 까지만. 영속 저장 (DB/redis), HTTP 엔드포인트 외부 노출,
사이드바 UI, sessionId 발급 정책은 모두 **마일스톤 외 또는 후속 #5/#6** 에서 처리.

## 2. 종료 조건

이슈 #4 의 종료 조건을 그대로 인용 (R-009 적용된 수치 포함).

- [ ] `SessionService.create()`, `append(sessionId, message)`, `get(sessionId)`, `expire(sessionId)` 단위 테스트
- [ ] `ChatService.completeInSession(sessionId, userMessage)` 가 세션 히스토리를 자동 prepend 후 `completeWithTools` 호출 (자동 e2e 모킹)
- [ ] 세션 TTL 기본값 (R-009): **30분 ± 10분** (즉 20~40분 허용 범위)
- [ ] max history length 기본값 (R-009): **50 messages ± 20** (즉 30~70 허용 범위)
- [ ] compose 부팅·초기화 정상 (R-013): SessionModule + ChatService 정상 DI
- [ ] 응답 시간 (R-009):
  - 모킹 단일 turn `completeInSession` < 100ms
  - 모킹 다단계 (히스토리 30개 + tool 2 iter) < 500ms
- [ ] 수행계획서 / 구현계획서 / 단계별 보고서 / 최종 보고서 작성

## 3. 영향 범위

| 종류 | 경로 | 변경 형태 |
|------|------|----------|
| 신규 | `rhwp-agent-server/src/session/session.module.ts` | SessionModule (Provider: SessionService) |
| 신규 | `rhwp-agent-server/src/session/session.service.ts` | SessionService (in-memory Map + lazy expire) |
| 신규 | `rhwp-agent-server/src/session/session.types.ts` | Session, SessionId 타입 |
| 신규 | `rhwp-agent-server/src/session/session.errors.ts` | SessionNotFoundError, SessionExpiredError |
| 신규 | `rhwp-agent-server/src/session/session.service.spec.ts` | SessionService 단위 테스트 (TTL, max history, expire, lifecycle) |
| 수정 | `rhwp-agent-server/src/chat/chat.service.ts` | `completeInSession(sessionId, userMessage)` 메서드 추가 (기존 `complete()`, `completeWithTools()` 유지) |
| 수정 | `rhwp-agent-server/src/chat/chat.module.ts` | SessionModule import |
| 수정 | `rhwp-agent-server/src/app.module.ts` | SessionModule 등록 (필요 시) |
| 신규/수정 | `rhwp-agent-server/src/chat/chat.service.spec.ts` | `completeInSession()` 단위 테스트 추가 |
| 신규 | `rhwp-agent-server/test/chat-session.e2e-spec.ts` | 멀티턴 세션 e2e (모킹) |
| 신규 | `rhwp-agent-server/src/config/env.schema.ts` (수정) | `SESSION_TTL_MS`, `SESSION_MAX_HISTORY` 환경변수 추가 (default + Joi 검증) |
| 신규 | `rhwp-agent-server/.env.example` (수정) | 위 두 환경변수 default 명시 |

본가 코드 무수정 — `src/`, `rhwp-studio/`, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/` 모두 변경 없음.

### 누적 환경 점검 (R-011)

본 task 시작 시 점검 완료:

- working tree clean ✅
- `rhwp-agent-server/.env`: `OPENAI_API_KEY` 실 키 + `OPENAI_MODEL=gpt-5.4` + `OPENAI_TIMEOUT_MS=30000` (3 task 누적 일관)
- `node_modules`, `dist` 캐시 유효 ✅
- `rhwp-fork-agent-server:latest` (286MB) 캐시 유효 ✅
- `npm test` (18/18 passed), `npm run test:e2e` (5/6 passed, 1 skipped 옵셔널 실 API) — 회귀 0 ✅

## 4. 외부 의존성

R-007 적용 (모두 *제약*으로 명시):

| 항목 | 제약 | 비고 |
|------|------|------|
| `openai` | 안정 채널 (#2 v6.35.0 그대로) | 변경 없음 |
| `@nestjs/config` | #2 그대로 | `SESSION_TTL_MS`, `SESSION_MAX_HISTORY` Joi 검증 추가 |
| `zod` | #3 그대로 | tool 인자 검증 — 변경 없음 |
| `crypto.randomUUID()` (Node 19+) | Node 22 ✅ | sessionId 자동 발급 (R-4-B) |

**신규 의존성 없음**. `crypto.randomUUID()` 는 Node 표준 라이브러리. R-007 (안정 채널) 자연스럽게 충족.

## 5. 단계 분할 개요

| Stage | 내용 | 검증 |
|-------|------|------|
| **Stage 1** | SessionService + 타입 + 에러 + 단위 테스트 + env.schema 추가 | `npm test` (단위) lifecycle/TTL/max history 검증 |
| **Stage 2** | `ChatService.completeInSession()` + 모킹 e2e + ChatModule 통합 | `npm run test:e2e` 멀티턴 자동 검증 |
| **Stage 3** | compose 부팅 검증 (R-013 2단계 사다리) + 문서 정리 | `docker compose up agent-server` + `/health` 200 + log 로 SessionModule init 확인 |

3 stage (본가 절차 최소치). #3 와 동일한 구조.

## 6. 리스크 / 미해결 결정사항

R-015 적용 — 각 항목별 추천 + 이유 + **반대 입장 근거**.

### R-4-A. 저장소 형태 (in-memory Map vs. NestJS Cache Manager)
- **추천**: **in-memory Map** (`Map<SessionId, Session>`)
- **이유**:
  1. 이슈 본문 *"백엔드 메모리에 in-memory 저장까지만"* 범위 명시 — 추상화 layer 불필요
  2. Cache Manager 도입 시 `cache-manager` 의존성 + DI provider 추가 — 후속 영속 저장 (마일스톤 외) 시점에 도입해도 늦지 않음
  3. lifecycle/TTL/max history 동작 *직접 검증 가능* (Cache Manager 사용 시 라이브러리 동작 신뢰)
  4. 단일 프로세스 + in-memory 가정에서 Map 의 GC 만으로 충분
- **반대 입장 근거**:
  1. Cache Manager 는 TTL 자동 만료 / LRU eviction 표준 제공 → sweep 직접 구현 부담 회피
  2. 후속 redis 교체 시 추상 layer 가 이미 있으면 단순 driver 교체로 종료
  3. NestJS 표준 패턴 → 프로젝트 일관성
- **결정 경위**: 본 task 의 *in-memory only* 명시 범위와 *후속 마일스톤 외 영속 저장* 의 명확한 분리상 미리 추상화 시 *YAGNI* 위험. R-3-D (zod 단일 진실 원천) 와 달리 *현재 가치 명확하지 않음*.

### R-4-B. 세션 키 발급 (서버 자동 vs. 클라이언트 발급)
- **추천**: **서버 자동 발급** — `SessionService.create(): SessionId`, `crypto.randomUUID()` 사용
- **이유**:
  1. 백엔드가 *유일성 보장* 책임 — 클라이언트 발급 시 충돌 검출/거부 로직 추가 필요
  2. 이슈 본문에서 *sessionId 의 클라이언트 전달은 #6* 으로 분리 → 본 task 는 *발급 메커니즘만* 단순화
  3. `crypto.randomUUID()` 는 Node 19+ 표준, 충돌 확률 무시 가능
- **반대 입장 근거**:
  1. 클라이언트 발급 시 *오프라인 첫 요청* 가능 (PWA 시나리오)
  2. UUID 사용 시 충돌 확률은 양쪽 모두 동일 (1/2^122)
  3. 백엔드 발급은 *한 번 더 round-trip* 추가 (create → append) — 첫 메시지에서 두 호출 발생
- **결정 경위**: 본 task 는 *최소 인프라*. #6 에서 프로토콜 결정 시 변경 가능하도록 `create()` 시그니처를 *외부 sessionId 인자 옵셔널* 로 확장 가능 ([R-4-B 보강](#r-4-b-보강)).

### R-4-B 보강. `create()` 시그니처
- **추천**: `create(initialMessages?: ChatMessage[]): SessionId` — sessionId 는 항상 자동 발급
- **이유**: #6 에서 클라이언트 발급 채택 시 `create(externalId?: SessionId, initialMessages?: ChatMessage[])` 로 확장. 본 task 시점에는 단순.
- **반대 입장 근거**: 처음부터 `externalId?` 받게 하면 #6 변경 비용 0. 다만 *현재 사용처 없는 인자 추가* 는 R-002 정신 (계획 해상도 조절) 에서 과해상도 후보.

### R-4-C. TTL 정책 (sliding vs. fixed)
- **추천**: **sliding** — `lastAccessedAt` 기준, `get()`/`append()` 호출 시 갱신
- **이유**:
  1. 활발히 대화 중인 세션이 30분 후 강제 만료되면 UX 깨짐 — 사용자 입력이 이미 진행 중인데 *세션 만료* 응답
  2. 일반 채팅 UX (Slack, Telegram 등) 의 표준 패턴
  3. expire 검사가 *get/append 시 lazy* 라 sliding 자연스러움 (별도 sweep 불필요)
- **반대 입장 근거**:
  1. fixed TTL 은 *세션 절대 한계* 명확 — 메모리 leak 보호 강함 (영원히 활동하는 봇/스크립트 차단)
  2. fixed 는 *예측 가능* — 세션 시작 시점에 만료 시간 확정
- **결정 경위**: 본 task 의 max history (50±20) 가 이미 메모리 한계 가드. sliding 만으로 충분. 절대 한계 (예: 24h) 는 후속 task 에서 추가 가능.

### R-4-D. max history 정책 (메시지 수 vs. 토큰 수)
- **추천**: **메시지 수** — `MAX_HISTORY = 50 ± 20` (.env 로 조정 가능)
- **이유**:
  1. 토큰 수 가드는 `tiktoken` 또는 OpenAI SDK token counter 의존 → 본 task 범위 외 (의존성 추가 + 모델별 토크나이저 분기)
  2. 메시지 수만으로도 *대부분 시나리오* 충분 (한 메시지가 수천 토큰 넘는 경우 드뭄)
  3. R-009 (수치 + 허용 오차) 자연 적용
- **반대 입장 근거**:
  1. 토큰 수 가드는 *모델 context window 와 직접 매핑* (예: gpt-5.4 의 가정 128k 토큰)
  2. 한 메시지가 매우 길면 (예: 본문 전체 붙여넣기) 메시지 수 가드만으로 *context overflow*
  3. 사용자가 *예측 가능한 한계* 인지 가능 (50 messages 가 토큰으로 얼마인지 불명확)
- **결정 경위**: 본 task 는 *최소 인프라*. 토큰 정확도는 후속 *세션 압축/요약* 별도 task 에서 도입 — `MAX_HISTORY` 환경변수로 조정 가능하므로 운영 시점에 실측 후 조정.

### R-4-E. expired 세션 호출 시 동작 (자동 새 세션 vs. 에러 throw)
- **추천**: **에러 throw** — `SessionExpiredError` (별도) / `SessionNotFoundError` (없는 ID)
- **이유**:
  1. 자동 새 세션 생성 시 *클라이언트가 세션 만료를 인지 못 함* → 새 sessionId 가 응답에 포함돼야 함 → API 복잡도 ↑
  2. 명확한 에러는 *클라이언트가 재생성 후 재호출* 흐름을 결정 → 정책 결정권 클라이언트로
  3. 후속 #6 에서 채택할 프로토콜 (REST/WebSocket) 와 무관하게 일관 동작
- **반대 입장 근거**:
  1. 자동 새 세션은 *사용자 경험 자연스러움* — 만료 모르고 계속 입력 가능
  2. *대화 맥락 손실* 은 어차피 발생 (히스토리 비어 있음) 이라 클라이언트 인지 가치 낮음
  3. 에러 throw 시 모든 호출처가 try/catch + 재생성 로직 필요 → 각 호출처 코드 부담 ↑
- **결정 경위**: 본 task 는 *백엔드 인프라*. UX 결정은 #5 (UI) 에서 *자동 재생성 wrapper* 형태로 추가 가능. 백엔드는 *진실을 그대로 보고*.

### R-4-F. max history 초과 시 동작 (이슈 본문 명시 안 됨)
- **추천**: **FIFO drop** — 가장 오래된 사용자/assistant 메시지부터 제거. *system 메시지는 보존* (있다면).
- **이유**:
  1. 회전형 윈도우 — 최신 N개 보존이 *맥락 유지에 가장 자연스러움*
  2. system 메시지 (도구 사용 가이드 등) 는 *대화 시작 시 1회 입력* + *항상 효력 유지* 패턴 → 보존 정당
  3. 사용자에게 알리지 않고 *조용히 drop* (UX 자연스러움) — drop 사실은 로그에만
- **반대 입장 근거**:
  1. 단순 에러 throw — 클라이언트가 *의도적으로 새 세션 생성* 결정 → 맥락 압축/요약 기회
  2. FIFO drop 시 *과거 결정사항* 손실 → 모델이 *맥락 모순* 가능성
  3. 토큰 기반 윈도우와 결합 시 더 정확 (R-4-D 와 묶음)
- **결정 경위**: 본 task 는 *최소 동작*. 압축/요약은 후속 별도 task. 모순 위험은 *max history 50* 범위에서 작음.

### R-4-G. SessionService ↔ ChatService 책임 분리
- **추천**: **평행 — `ChatService.completeInSession()` 가 SessionService 를 DI 의존성으로 주입**
- **이유**:
  1. 이슈 본문 명시 — `ChatService.completeInSession(sessionId, userMessage)` 메서드 추가
  2. ChatService 는 *대화 진행* 책임, SessionService 는 *상태 저장* 책임 → SRP 충족
  3. 후속 task 에서 SessionService 만 redis 교체 시 ChatService 영향 없음
- **반대 입장 근거**:
  1. ChatSessionService 새 layer (= SessionService + ChatService 합성) 는 *책임 분리 더 명확*
  2. ChatService 가 SessionService 를 알면 *순환 의존* 위험 (현재는 단방향이라 OK)
- **결정 경위**: 이슈 본문 따름. 후속에서 layer 추가 시점에 재검토.

### R-4-H. 만료 sweep 메커니즘 (lazy on-access vs. setInterval)
- **추천**: **lazy on-access** — `get()`/`append()` 시 expire 검사 + 별도 setInterval 없음
- **이유**:
  1. 본 task 가 *in-memory only + 단일 프로세스* — sweep 부담 작음
  2. setInterval 은 NestJS lifecycle hook (`OnModuleInit`/`OnApplicationShutdown`) 추가 + 정리 책임 ↑
  3. *비활성 세션의 메모리 leak* 은 max history 가드로 *세션당 한계* 보장 → 전체 메모리 한계는 *세션 수 × max history × 평균 메시지 크기*로 예측 가능
- **반대 입장 근거**:
  1. setInterval 은 *완전 비활성 세션 자동 정리* → 메모리 leak 절대 방어
  2. lazy 만 사용 시 *영영 접근 안 되는 expired 세션* 이 메모리 점유 (next access 까지)
  3. 운영 모니터링 시 *sweep 로그* 가 정상성 신호로 유용
- **결정 경위**: 본 task 는 *최소 인프라*. 정기 sweep 필요 시 후속 *운영성 보강 task* 에서 `@nestjs/schedule` 도입 검토.

### R-4-I. 환경변수 추가 정책
- **추천**: `SESSION_TTL_MS` (default 1800000 = 30분), `SESSION_MAX_HISTORY` (default 50) — Joi 검증 + `.env.example` 명시
- **이유**:
  1. R-009 (기준치 + 허용 오차) 에 따라 default 명시 + 운영 시점 조정 가능
  2. 단위 테스트에서 *짧은 TTL* (예: 100ms) 주입하기 편함 — 테스트 시간 단축
  3. #2 의 `OPENAI_*` 환경변수 패턴과 일관
- **반대 입장 근거**:
  1. 환경변수가 늘어날수록 *.env 관리 부담* ↑
  2. 코드 상수 (e.g. `const SESSION_TTL_MS = 1_800_000`) 가 *변경 시 코드 리뷰 통과* 라는 통제 강함
- **결정 경위**: 단위 테스트 편의 + 운영 조정 가능성 기준으로 환경변수 채택. 테스트에서 ConfigService override 패턴이 #2/#3 에서 검증됨.

## 7. 일정 가이드 (R-009)

| 단계 | 코드 작업 (기준 ± 오차) | 비고 |
|------|----------------------|------|
| 수행계획서 | — | 본 문서 |
| 구현계획서 | — | 다음 단계 |
| Stage 1 | 35 ± 15분 | SessionService + 타입 + env.schema + 단위 테스트 |
| Stage 2 | 50 ± 20분 | completeInSession + 모킹 e2e (가장 큰 단계) |
| Stage 3 | 25 ± 10분 | compose 부팅 검증 + 문서 |
| 최종 보고서 | — | 방법론 평가 누적 |

## 8. 방법론 평가 메모 (사전)

### 8.1 R-007~R-015 사전 적용 (3번째 task)

본 task 는 **R-014 첫 의무 적용 사례** + **R-015 첫 의무 적용 사례**.

검증할 가설:

| ID | 본 task 가설 | 검증 방법 |
|----|-------------|---------|
| R-007 | 도구 버전 *제약* 표현 → deviation 0 | Stage 종료 시 도구 버전 deviation 집계 |
| R-008 | 자동 검증 우선 → manual curl 0회 | Stage 종료 시 manual 명령 횟수 집계 |
| R-009 | TTL/max history *기준 + 오차* → deviation 발생 시 *허용 범위 내*인가 자동 분류 |
| R-010 | 외부 정보 조회 (NestJS Cache Manager 검토? `crypto.randomUUID` 호환?) → 사전 명시 → 진행 끊김 0 | §4 외부 의존성 표 |
| R-011 | 누적 환경 점검 → 시작 시점 deviation 0 | §3 R-011 점검 결과 |
| R-013 | 2단계 검증 사다리 → Stage 1·2 jest + Stage 3 compose 모두 통과 |
| R-014 | 이슈 본문 점검표 → *어떤 다듬기가 적용되는지* 작업지시자 즉시 파악 가능 |
| R-015 | §6 결정사항 9건 모두 *반대 입장 근거* 명시 → 작업지시자 검증 시 *직접 입력* 제공 |

### 8.2 R-015 적용 효과 사전 예측

§6 의 9개 결정사항 중 *반대 입장 근거가 추천 변경을 유도할 가능성*이 있는 항목:

- **R-4-A** (저장소 형태): Cache Manager 의 *TTL 자동 처리* 장점이 강함 → 추천 in-memory Map 이 흔들릴 수 있음
- **R-4-D** (max history): 토큰 수 가드의 *context window 직접 매핑* 장점 → 본 task 범위 확장 검토 가능
- **R-4-H** (sweep): setInterval 의 *완전 비활성 세션 자동 정리* 장점 → `@nestjs/schedule` 도입 검토 가능

위 3개는 작업지시자 검증 질문 가능성 높음. 클로드 self-check 단계에서 *반대 입장 근거가 추천 변경을 유도하는지* 본 task 종료 시 평가.

### 8.3 R-014 적용 효과 사전 예측

이슈 #4 본문 (등록 단계) 에 R-007~R-015 점검표 포함됨. 본 task 진행 시 *어떤 다듬기가 어떻게 작동하는지* 가시성 ↑. 작업지시자가 이슈 단계에서 진행 흐름 즉시 파악 가능.

### 8.4 *4번째 task (#4)* 의 의의

#1: R-007/R-008/R-009 신규 정식화 (적용 0건)
#2: R-007~R-009 첫 사전 적용 + R-010~R-013 신규 정식화
#3: R-007~R-013 사전 적용 → deviation 0건 + R-014/R-015 신규 정식화
**#4 (본 task)**: R-007~R-015 모두 사전 적용 → 첫 *완전 누적* 적용 사례

deviation 0 유지 가능한지 + R-014/R-015 효과 측정이 본 task 의 핵심 평가 항목.

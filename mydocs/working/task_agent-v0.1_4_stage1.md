# [Stage 1 보고서] task_agent-v0.1_4 — SessionService + 타입 + 에러 + env.schema + 단위 테스트

- **이슈**: [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4)
- **수행계획서**: [task_agent-v0.1_4.md](../plans/task_agent-v0.1_4.md)
- **구현계획서**: [task_agent-v0.1_4_impl.md](../plans/task_agent-v0.1_4_impl.md)
- **단계**: 1 / 3
- **브랜치**: `local/task4`
- **작성일**: 2026-04-30
- **소요 시간**: 약 25분 (기준 35±15분 — 허용 범위 내, R-009 정상)

---

## 1. R-010 외부 정보 조회 결과

본 stage 의 외부 docs 의존: **0건**

- `crypto.randomUUID()`: Node 19+ 표준, Node 22 환경 ✅ — 외부 docs 조회 불필요
- NestJS `@Injectable` + `ConfigService`: #2/#3 와 동일 패턴 — 추가 조회 불필요

R-010 의 가설 (외부 정보 조회 단계 명시 → 진행 끊김 0) 자연 충족. fallback 경로 활용 0회.

## 2. 변경 파일

### 신규 (5개)

| 경로 | 라인 수 | 역할 |
|------|--------|------|
| `rhwp-agent-server/src/session/session.types.ts` | 11 | `Session`, `SessionId` 타입 |
| `rhwp-agent-server/src/session/session.errors.ts` | 13 | `SessionNotFoundError`, `SessionExpiredError` |
| `rhwp-agent-server/src/session/session.service.ts` | 86 | SessionService (in-memory Map + lazy expire + FIFO drop) |
| `rhwp-agent-server/src/session/session.module.ts` | 9 | NestJS module |
| `rhwp-agent-server/src/session/session.service.spec.ts` | 122 | 단위 테스트 11건 |

### 수정 (2개)

| 경로 | 변경 내용 |
|------|----------|
| `rhwp-agent-server/src/config/env.schema.ts` | `SESSION_TTL_MS` (default 1800000), `SESSION_MAX_HISTORY` (default 50) Joi 검증 추가 |
| `rhwp-agent-server/.env.example` | 위 두 환경변수 default 명시 추가 |

본가 코드 무수정 ✅

## 3. 단위 테스트 결과

```
Test Suites: 4 passed, 4 total
Tests:       29 passed, 29 total
Snapshots:   0 total
Time:        1.095 s
```

내역: 기존 18건 + 본 stage 신규 11건.

### 본 stage 신규 11건 분류

| # | 테스트 | 검증 항목 |
|---|--------|----------|
| 1 | `create() returns unique sessionId` | UUID 자동 발급 + `size()` |
| 2 | `create() with initialMessages preserves them` | 옵셔널 인자 (R-4-B 보강) |
| 3 | `get() throws SessionNotFoundError for unknown id` | R-4-E 에러 throw |
| 4 | `append() adds message and reflects on subsequent get()` | append 정상 |
| 5 | `expire() removes session` | 명시적 만료 |
| 6 | `expire() throws SessionNotFoundError for unknown id` | 에러 throw |
| 7 | `TTL: get() throws SessionExpiredError after ttl elapsed` | R-009 + R-4-E (TTL 50ms 주입) |
| 8 | `TTL sliding: get() resets ttl` | R-4-C (sliding TTL) |
| 9 | `max history: FIFO drop preserves system message` | R-4-F (system 보존) |
| 10 | `max history: works with no system message` | R-4-F (system 없는 경우) |
| 11 | `append() on expired throws SessionExpiredError` | R-4-E (append 도 expire 검사) |

## 4. 결정 적용 결과 (R-4-A~I)

| 결정 | 적용 내용 |
|------|----------|
| **R-4-A** in-memory Map | `private readonly store = new Map<SessionId, Session>()` — Cache Manager 미도입 |
| **R-4-B** 서버 자동 발급 | `randomUUID()` (Node 표준) — `create()` 시그니처에 `initialMessages?` 만 노출 |
| **R-4-B 보강** | `create(initialMessages: ChatMessage[] = [])` — externalId 인자는 미노출 (후속 #6 시점에 확장) |
| **R-4-C** sliding TTL | `get()`, `append()` 시 `lastAccessedAt = Date.now()` 갱신 (테스트 #8 검증) |
| **R-4-D** 메시지 수 가드 | `enforceMaxHistory()` 가 메시지 개수 기준 (토큰 미사용) |
| **R-4-E** expired/없음 → 에러 | `SessionExpiredError`, `SessionNotFoundError` 분리 throw |
| **R-4-F** FIFO drop + system 보존 | `enforceMaxHistory()` 가 system 분리 후 non-system 만 trim (테스트 #9 검증) |
| **R-4-G** ChatService↔SessionService 평행 | (Stage 2 에서 적용) |
| **R-4-H** lazy on-access expire | `get()` 진입 시 `isExpired()` 검사 + 즉시 `store.delete()` |
| **R-4-I** 환경변수 채택 | `SESSION_TTL_MS`, `SESSION_MAX_HISTORY` Joi default + `.env.example` 명시 |

## 5. 발견·Deviation

### 5.1 사소한 변경 — 빈 list 가 아닌 *non-system 보존* 우선순위

구현계획서 §1.4 의 `enforceMaxHistory()` 초안:

```ts
const overflow = session.messages.length - this.maxHistory;
const trimmed = nonSystem.slice(overflow);
```

→ 실제 구현:

```ts
const totalBudget = this.maxHistory - systemMessages.length;
const trimmed = totalBudget > 0 ? nonSystem.slice(-totalBudget) : [];
```

**이유**: 초안은 *전체 메시지 길이에서 overflow 만 drop* 이지만, system 보존이 강제되면 *budget = max - system count* 가 더 정확. system 메시지가 max 이상이면 non-system 0개로 trim. 테스트 #9 (max 3 + system 1) 에서 `non-system 2 보존`이 정확히 동작.

R-009 (수치형 + 허용 오차) 정신상 *경계 조건*에서 deviation 발생할 여지를 사전 차단.

### 5.2 deviation 0건 (계획서 종료 체크 기준)

- 환경 점검 0 deviation
- 빌드 exit 0
- 단위 11건 100% pass
- 시간 25분 (기준 35±15 = 20~50, 허용 범위 내)

### 5.3 TTL 테스트의 setTimeout 정확도

구현계획서 §리스크 에서 "TTL 50ms → 80ms 대기" 마진 충분 — 실측 1.095s 내 11건 모두 안정 통과 (CI 환경 부하 변동 없음).

## 6. 방법론 평가 메모

### R-007 (도구 버전 *제약*)
- 신규 의존성 0 → 자동 충족 (검증 항목 자체 적용 안 됨)

### R-008 (자동 검증 우선)
- 종료 체크 6건 모두 자동 (`npm run build`, `npm test`) — manual 검증 0회
- 작업지시자 시간 소모 0 (목표 유지)

### R-009 (기준치 + 허용 오차)
- TTL: 30분 ± 10분 (기본값) → 테스트는 50ms 주입 (편의)
- max history: 50 ± 20 (기본값) → 테스트는 2/3 주입 (편의)
- 시간: 35±15분 (기준) → 25분 (허용 범위 내)
- 모두 *기준치 + 오차* 형식이 자동 expect 와 일관

### R-010 (외부 정보 조회)
- 외부 docs 의존 0 → 명시화 효과 없음 (검증 항목 자체 적용 안 됨)
- 차기 task 에 외부 의존 발생 시 효과 측정

### R-011 (누적 환경 점검)
- 본 task 진입 직전 환경 점검 통과 → Stage 1 시작 deviation 0
- 효과 입증 (#3 와 일관)

### R-014 (이슈 점검표 의무) — 첫 의무 적용
- 이슈 #4 본문에 R-007~R-015 점검표 포함 → Stage 1 진행 시 *어떤 다듬기를 어떻게 적용할지* 작업지시자/클로드 모두 즉시 파악 가능
- 누락 항목 0 (R-4-* 결정사항 9건 모두 §4 에 체크됨)

### R-015 (반대 입장 근거 명시) — 첫 의무 적용
- §6 결정 9건 모두 *반대 입장 근거* 사전 명시
- Stage 1 진행 중 *반대 입장 근거가 추천 변경을 유도한 사례* 0건 (모두 추천대로 구현)
- §5.1 의 사소한 코드 변경은 *경계 조건 정확화* 라 §6 결정 변경 아님

## 7. Stage 1 종료 체크

- [x] R-010 외부 정보 조회 결과 기록 (의존 0, fallback 사용 0)
- [x] `npm install` 신규 의존성 0건 (계획대로)
- [x] `npm run build` exit 0
- [x] env.schema.ts 에 `SESSION_TTL_MS`, `SESSION_MAX_HISTORY` Joi 검증 추가
- [x] `.env.example` 에 두 환경변수 default 명시
- [x] 단위 테스트 신규 11건 100% pass
- [x] R-009 수치형 동작 자동 expect (TTL 만료, sliding, FIFO drop)

## 8. 다음 단계

Stage 2 — `ChatService.completeInSession` + ChatModule 통합 + 모킹 e2e

- ChatModule 의 SessionModule import
- ChatService 생성자에 SessionService DI 추가
- 기존 `chat.service.spec.ts` providers 갱신 (구현계획서 §리스크 명시 항목)
- `completeInSession()` 메서드 + 단위 3건 + e2e 1건

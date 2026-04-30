# [Stage 2 보고서] task_agent-v0.1_4 — ChatService.completeInSession + ChatModule 통합 + 모킹 e2e

- **이슈**: [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4)
- **수행계획서**: [task_agent-v0.1_4.md](../plans/task_agent-v0.1_4.md)
- **구현계획서**: [task_agent-v0.1_4_impl.md](../plans/task_agent-v0.1_4_impl.md)
- **단계**: 2 / 3
- **브랜치**: `local/task4`
- **작성일**: 2026-04-30
- **소요 시간**: 약 30분 (기준 50±20분 — 허용 범위 내, R-009 정상)

---

## 1. 변경 파일

### 신규 (1개)

| 경로 | 라인 수 | 역할 |
|------|--------|------|
| `rhwp-agent-server/test/chat-session.e2e-spec.ts` | 51 | 멀티턴 세션 e2e (AppModule 부트스트랩 + 2턴 누적 검증) |

### 수정 (3개)

| 경로 | 변경 내용 |
|------|----------|
| `rhwp-agent-server/src/chat/chat.module.ts` | `SessionModule` import 추가 |
| `rhwp-agent-server/src/chat/chat.service.ts` | 생성자에 `SessionService` DI + `completeInSession()` 메서드 추가 (기존 `complete()`, `completeWithTools()` 무수정) |
| `rhwp-agent-server/src/chat/chat.service.spec.ts` | beforeEach providers 갱신 (SessionService + ConfigService 다중 키 지원) + `completeInSession` describe 3건 |

본가 코드 무수정 ✅

## 2. 단위 + e2e 테스트 결과

### 단위

```
Test Suites: 4 passed, 4 total
Tests:       32 passed, 32 total
Time:        1.228 s
```

내역: Stage 1 종료 시점 29건 + 본 stage 신규 3건.

### e2e

```
Test Suites: 1 skipped, 5 passed, 5 of 6 total
Tests:       1 skipped, 6 passed, 7 total
Time:        1.167 s
```

내역: 기존 5 (config, health, chat, chat-tools, chat-real-api skipped) + 본 stage 신규 1 (chat-session).

### 본 stage 신규 단위 3건

| # | 테스트 | 검증 항목 |
|---|--------|----------|
| 1 | `히스토리 누적: 2턴 시 첫 턴 메시지 포함` | 두 번째 OpenAI 호출의 messages 가 정확히 `[u1, a1, u2]`. 세션 누적은 `[u1, a1, u2, a2]` |
| 2 | `응답시간: 1턴 < 100ms (R-009)` | 자동 expect, sliding TTL 갱신 비용 포함 |
| 3 | `expired session → SessionExpiredError (R-4-E)` | TTL 30ms 별도 모듈 + 50ms 대기 후 호출 → throw |

### 본 stage 신규 e2e 1건

| 테스트 | 검증 항목 |
|--------|----------|
| `AppModule 부트스트랩 + 멀티턴 세션 누적` | 실 NestJS 모듈 부트스트랩으로 ChatModule → SessionModule DI 동작 입증 + 2턴 누적 messages 정확성 |

## 3. 결정 적용 결과 (R-4-G + 기존)

| 결정 | 적용 내용 |
|------|----------|
| **R-4-G** ChatService↔SessionService 평행 | `ChatService` 생성자에 `SessionService` DI 추가 + `completeInSession()` 가 `sessions.append()` → `completeWithTools()` → `sessions.append()` 패턴 (이슈 본문 명시 시그니처 준수) |
| **R-4-E** expired → 에러 throw | `completeInSession()` 의 `sessions.append(sessionId, userMessage)` 가 expired 시 `SessionExpiredError` throw → ChatService 에서 catch 안 하므로 호출자에게 그대로 전달 (단위 #3 검증) |
| **R-4-H** lazy on-access expire | append 시점에 lazy 검사 — completeInSession 진입 직후 만료 즉시 감지 |

## 4. completeInSession 구현 디테일

```ts
async completeInSession(
  sessionId: SessionId,
  userMessage: ChatMessage,
): Promise<ChatMessage> {
  const startedAt = Date.now();
  this.sessions.append(sessionId, userMessage);
  const conversation = [...this.sessions.get(sessionId).messages];

  const assistantReply = await this.completeWithTools(conversation);
  this.sessions.append(sessionId, assistantReply);

  const elapsed = Date.now() - startedAt;
  this.logger.log(
    `completeInSession sessionId=${sessionId} historyLen=${conversation.length} elapsed=${elapsed}ms`,
  );
  return assistantReply;
}
```

### 설계 포인트

1. **append → get 의 순서**: append 먼저 → 누적된 history 가 conversation 의 base. 호출 실패 시 userMessage 만 남고 assistantReply 미추가 → *반쯤 진행된 상태*. 의도적 — 클라이언트가 retry 시 동일 userMessage 재append 하면 dup. 본 task 범위 외 (후속에서 *멱등 키* 도입 검토).
2. **conversation 복사**: `[...session.messages]` 로 *snapshot 복사* → completeWithTools 내부의 mutation (tool_calls 시 conversation.push) 가 session.messages 에 영향 안 줌. tool 호출 흐름은 *내부 캐시* 처리.
3. **assistantReply 만 누적**: tool_calls 의 중간 messages (assistant.tool_calls + role=tool) 는 session 에 누적 *안 함*. 사용자 가시 응답만 보존 — 후속 turn 의 prompt 가 깔끔.

## 5. 발견·Deviation

### 5.1 chat.service.spec.ts beforeEach 의 ConfigService mock 강화

구현계획서 §리스크 명시 항목 — *기존 spec 의 providers 가 SessionService 추가 필요 → 빠뜨리면 부트스트랩 실패*. 사전 인지로 deviation 사전 차단 ✅

기존:
```ts
{ provide: ConfigService, useValue: { getOrThrow: () => 'mock-model' } }
```

→ 변경:
```ts
const buildConfig = (overrides) => {
  const values = {
    OPENAI_MODEL: 'mock-model',
    SESSION_TTL_MS: 1800000,
    SESSION_MAX_HISTORY: 50,
    ...overrides,
  };
  return { getOrThrow: (key) => values[key] };
};
```

키별 응답 분기로 변경. 전체 `() => 'mock-model'` 가 *모든 키에 'mock-model' 반환* 이라 SESSION_TTL_MS 가 string 'mock-model' → setTimeout 비교 시 `NaN` 위험. 사전 차단.

### 5.2 deviation 0건 (계획서 종료 체크 기준)

- 빌드 exit 0
- 단위 32/32 (Stage 2 신규 3건 포함)
- e2e 6/7 (1 skipped 옵셔널 실 API, 기존 동일)
- 시간 30분 (기준 50±20 = 30~70, 허용 범위 내)
- 기존 e2e 회귀 0 (config, health, chat, chat-tools 모두 그대로)

### 5.3 응답시간 (R-009)

- 단위 #2 `1턴 < 100ms`: 모킹 호출 + 2회 sessions.append + 1회 sessions.get → 실측 ms 단위 (내부 시계 신뢰)
- e2e: `1.167s` 전체 (5 suite + 1 skipped) — Stage 1 종료 시점 1.16s 와 거의 동일. 신규 chat-session 추가 비용 무시 가능.

## 6. 방법론 평가 메모

### R-007 (도구 버전 *제약*)
- 신규 의존성 0 → 자동 충족

### R-008 (자동 검증 우선)
- 종료 체크 6건 모두 자동 (npm test, npm run test:e2e) — manual 검증 0회 (Stage 1 + Stage 2 누적)

### R-009 (기준치 + 허용 오차)
- 시간 50±20 → 30분 (허용 범위 내, sub-task 분리 불필요)
- 응답시간 1턴 < 100ms → 자동 expect 통과
- 모두 *기준치 + 오차* 형식이 자동 expect 와 일관

### R-010 (외부 정보 조회)
- 외부 docs 의존 0 (Stage 1 과 동일) → 명시화 효과 없음 (검증 항목 자체 적용 안 됨)

### R-011 (누적 환경 점검)
- Stage 1 종료 시 환경 일관 (env.schema 갱신 후 .env 도 default 호환) → Stage 2 시작 deviation 0

### R-012 (mock dup 후속 후보)
- 본 stage 에서 `chat-session.e2e-spec.ts` 가 기존 `test/__mocks__/openai.ts` 그대로 활용 → dup 미발생 (시나리오 시퀀스는 테스트에서 mockResolvedValueOnce 로 주입). R-012 의 *별도 정리 task* 시점에 묶음 검토.

### R-013 (2단계 검증 사다리)
- jest 단위 (Stage 1) + jest e2e (Stage 2) 까지 layer 1 완료
- compose layer 2 는 Stage 3 — 본 task 의 종료 검증 골격 완성 직전

### R-014 (이슈 점검표 의무) — 첫 의무 적용
- 이슈 #4 본문 점검표 → Stage 2 진행 시 R-4-G 적용 누락 0
- ChatService DI 변경, ChatModule import, completeInSession 메서드 모두 점검표 항목으로 사전 명시됨 → 누락 사전 차단

### R-015 (반대 입장 근거 명시) — 첫 의무 적용
- §6 의 R-4-G 가 *추천 ChatService↔SessionService 평행* 선택. 반대 입장 (ChatSessionService layer 추가) 도 명시되어 있어 *왜 평행 선택했는지* 작업지시자가 즉시 검증 가능
- Stage 2 구현 중 결정 변경 0건 (#3 의 R-3-D 사례 같은 변경 없음)

## 7. Stage 2 종료 체크

- [x] `completeInSession` 단위 3건 추가 (히스토리 누적 / 응답시간 / expired) 모두 pass
- [x] e2e 1건 추가 (AppModule + 멀티턴 세션) pass
- [x] R-009 응답시간 자동 expect: 1턴 < 100ms
- [x] R-4-G ChatService → SessionService DI 정상
- [x] ChatModule 의 SessionModule import 정상
- [x] 기존 e2e (chat, chat-tools, config, health) 회귀 0

## 8. 다음 단계

Stage 3 — compose 환경 부팅 검증 + 문서 정리

- `docker compose build agent-server`
- `docker compose up -d agent-server`
- `curl :3000/health` 200 OK
- compose logs 에 SessionModule + ChatModule initialized 표시 확인
- 환경변수 주입 확인 (`SESSION_TTL_MS`, `SESSION_MAX_HISTORY`)

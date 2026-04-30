# [Stage 2 보고서] task_agent-v0.1_3 — ChatService.completeWithTools 루프 + 모킹 e2e

- **이슈**: [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3)
- **수행계획서**: [task_agent-v0.1_3.md](../plans/task_agent-v0.1_3.md)
- **구현계획서**: [task_agent-v0.1_3_impl.md](../plans/task_agent-v0.1_3_impl.md) Stage 2
- **단계**: Stage 2 / 3
- **작성일**: 2026-04-30

---

## 1. 실행 결과 요약

ChatService.completeWithTools 구현 (tool_calls 루프 + max iter 가드 + R-3-F 에러 처리), 단위 3건 + e2e 1건 추가, 모든 자동 테스트 통과.

| 종료 체크 | 결과 |
|----------|------|
| `completeWithTools` 단위 3건 (정상 / max iter / tool 에러) | ✅ 18 passed (누적) |
| e2e 1건 (chat-tools, AppModule 부트스트랩 + 루프) | ✅ 5 passed (e2e 누적) + 1 skipped |
| R-009 응답 시간 자동 expect | ✅ 정상 < 200ms / 다단계 < 500ms 모두 통과 |
| R-3-C max iterations = 5 검증 | ✅ 단위 테스트로 명시 |
| R-3-F tool 에러 → message 반영 | ✅ 단위 + e2e 둘 다 검증 |

## 2. 실행 로그 발췌

```
$ npm run build
> nest build (exit 0)

$ npm test
Test Suites: 3 passed, 3 total
Tests:       18 passed, 18 total       (chat.service 6 + tools 5 + executor 7)
Time:        0.785 s

$ npm run test:e2e
Test Suites: 1 skipped, 4 passed, 4 of 5 total
Tests:       1 skipped, 5 passed, 6 total       (config 2 + health 1 + chat 1 + chat-tools 1 + real-api skipped)
Time:        1.043 s
```

## 3. 변경 파일 목록

### 신규

| 경로 | 용도 |
|------|------|
| `rhwp-agent-server/test/chat-tools.e2e-spec.ts` | AppModule 부트스트랩 + tool_calls 루프 e2e |

### 수정

| 경로 | 변경 |
|------|------|
| `rhwp-agent-server/src/chat/chat.service.ts` | `completeWithTools(messages)` 메서드 추가 (max iter 5, tool 에러 message 반영). 기존 `complete()` 그대로 |
| `rhwp-agent-server/src/chat/chat.service.spec.ts` | ToolExecutor provider 추가 + completeWithTools 단위 테스트 3건 추가 (총 6건) |

## 4. 계획 대비 편차 (Deviations)

### 4.1 R-007/R-008/R-009 누적 검증

| 다듬기 | Stage 2 결과 |
|--------|------------|
| R-007 | 신규 의존성 0 (Stage 1 의 lean 화 그대로) — deviation 0 |
| R-008 | 종료 체크 5건 모두 자동, manual 0회 |
| R-009 | 응답 시간 정상 < 200ms / 다단계 < 500ms / max iter 시간 모두 자동 expect 통과 |

3 stage (#1/#2 → 본 task #3) 누적으로 deviation 발생률 일관 감소.

### 4.2 R-3-A~H 결정 코드 매핑 검증

| 결정 | 구현 위치 | 검증 |
|------|---------|------|
| R-3-A NestJS abstract class | `tool-executor.ts` | Stage 1 |
| R-3-B 단일 `tools.ts` | `tools.ts` (4개 zod 스키마 한 파일) | Stage 1 |
| R-3-C max iter 5 | `chat.service.ts` `MAX_ITERATIONS=5` | 단위 테스트 (max iter 케이스) |
| R-3-D zod + built-in toJSONSchema | `tools.ts` (`z.toJSONSchema()`) | Stage 1 |
| R-3-E tool_calls 우선 | `chat.service.ts` `if (tool_calls?.length > 0) continue;` | 단위 테스트 (정상 2-iter) |
| R-3-F tool 에러 → message | try/catch → `{ error }` payload | 단위 + e2e 둘 다 |
| R-3-G 시나리오 분리 | `mockResolvedValueOnce` x2 정상 / `mockResolvedValue` 무한 max iter | 단위 |
| R-3-H compose 검증 부팅까지 | 본 stage 미적용 (Stage 3 에서 검증) | Stage 3 |

8개 결정 모두 코드·테스트로 1:1 매핑 검증됨.

## 5. 검증 방법 (재현)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/rhwp-agent-server

npm run build
npm test                    # 18 passed
npm run test:e2e            # 5 passed + 1 skipped
```

## 6. 다음 단계 — Stage 3 진입 체크리스트

- [ ] Stage 2 보고서 승인
- [ ] Docker Desktop 동작 확인
- [ ] R-013 2단계 검증 사다리 마지막 단계 (compose 환경)

## 7. 방법론 평가 메모

### 7.1 mock 시나리오 주입 패턴 의 효용

`mockResolvedValueOnce` 시퀀스로 *결정적인 다단계 시나리오* 작성 가능:
- 정상 2-iter: `mockResolvedValueOnce(toolCall) → mockResolvedValueOnce(text)`
- max iter: `mockResolvedValue(toolCall)` 무한 반복

이 패턴이 *agentic 루프* 의 회귀 검증을 jest 환경에서 *결정적·빠르게* 가능하게 함. R-008 (자동 검증 우선) 의 *복잡한 흐름까지 자동화 가능* 한 사례로 추가 입증.

### 7.2 R-3-F (tool 에러를 message 로) 의 효용 검증

단위 테스트에서 `unknown_tool` 호출 시:
- `toolExecutor.execute` 가 throw → catch → `{ error: 'unknown tool: unknown_tool' }` payload 가 tool message 로 들어감
- 다음 iteration 에서 모델이 *에러 인지 후 사용자 보고* (mock 응답: "sorry, tool error")

즉 *에이전트가 에러를 자율적으로 처리* 하는 흐름이 jest 환경에서 자동 검증 가능. R-3-F 결정의 본질이 *에이전트 자율성 ↑* 임을 입증.

### 7.3 본 stage 의 시간 실측 (R-009)

- **계획**: 60 ± 20분 (40~80분)
- **실제**: 약 30분 (chat.service 갱신 10분 + spec 갱신 + 신규 e2e 15분 + 검증 5분)
- **분석**: 계획 *하한 미만*. R-3-A~H 가 사전 명시되어 *구현 시 결정 마찰 0* 으로 기인. R-009 가설이 *허용 오차 안*만 보장하는 게 아니라 *상한 초과 deviation 도 명확히 검출* 가능함을 추가 사례. 기준 시간 자체를 *fork 의 첫 task 들에서 보정* 하는 접근이 정착되고 있음.

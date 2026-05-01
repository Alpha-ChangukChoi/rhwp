# [수행계획서] task_agent-v0.1_3 — hwpctl Action ↔ OpenAI tool 매핑 + 도구 호출 루프

- **이슈**: [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3)
- **마일스톤**: agent-v0.1
- **브랜치**: `local/task3`
- **선행 task**: [#1](https://github.com/Alpha-ChangukChoi/rhwp/issues/1) ✅ + [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2) ✅
- **작성일**: 2026-04-30
- **방법론 근거**: 본가 [CLAUDE.md](../../CLAUDE.md) 절차 3단계 + fork [methodology_refinements.md](../manual/methodology_refinements.md) R-001/R-007/R-008/R-009/R-010/R-011/R-013

---

## 1. 목적 / 배경

agent-v0.1 마일스톤의 **에이전트 능력 핵심**. #2 의 `ChatService.complete()` 위에
**OpenAI tool calling** 을 얹어, 사용자 자연어 입력 → 모델이 도구 호출 결정 →
도구 실행 → 결과 반영 → 최종 응답까지의 *autonomous loop* 을 백엔드에서 완성한다.

본 task 의 *도구 실행*은 stub. 실제 hwpctl 호출은 후속 (#5/#6) — 이는 *백엔드와 프런트엔드의 책임 분리* 를 위함.
백엔드는 *어떤 도구가 호출되었는지* 까지 책임지고, *그 도구를 어떻게 실행하는지* 는 클라이언트(rhwp-studio)가 결정.

```
사용자 입력
    ↓ (#5/#6 에서 만들 채팅 UI)
ChatService.completeWithTools(messages, tools, executor)
    ├─ openai.chat.completions.create(messages, tools)
    ├─ assistant.tool_calls 있으면:
    │     for each tool_call:
    │       executor.execute(name, args)  ← StubToolExecutor (본 task)
    │                                     ← RealToolExecutor (#5/#6)
    │     messages 에 tool 결과 추가
    │     다시 chat.completions.create() ← 루프
    └─ tool_calls 없으면 최종 텍스트 응답 반환
```

## 2. 종료 조건

이슈 #3 의 종료 조건을 그대로 인용 (R-009 적용된 수치 포함).

- [ ] 4개 도구 OpenAI tool spec 형식 정의 (자동 단위 테스트로 schema 검증)
- [ ] ToolExecutor 인터페이스 + StubToolExecutor 구현 (자동 단위 테스트)
- [ ] ChatService 가 tool_calls 응답 시 도구 실행 → 결과 message 반영 → 다시 호출 (자동 e2e 모킹)
- [ ] max iterations 제한 (R-009): **기준치 5 ± 2** (즉 최대 7) 초과 시 안전하게 중단 + 명확한 에러
- [ ] 응답 시간 (R-009):
  - 모킹 단일 단계 < 100ms
  - 모킹 다단계 (3 iterations 가정) < 500ms
- [ ] compose 부팅·초기화 정상 (R-013): jest e2e 통과 + `docker compose up agent-server` + `/health` 200 OK
- [ ] 수행계획서 / 구현계획서 / 단계별 보고서 / 최종 보고서 작성

## 3. 영향 범위

| 종류 | 경로 | 변경 형태 |
|------|------|----------|
| 신규 | `rhwp-agent-server/src/chat/tools.ts` | zod 스키마 4개 + `zodToJsonSchema` 변환된 OpenAI tool spec export (단일 진실 원천) |
| 신규 | `rhwp-agent-server/src/chat/tool-executor.ts` | ToolExecutor 인터페이스 + StubToolExecutor (zod parse 로 인자 검증) |
| 신규 | `rhwp-agent-server/src/chat/tools.spec.ts` | zod 스키마 / OpenAI tool spec 변환 검증 단위 테스트 |
| 신규 | `rhwp-agent-server/src/chat/tool-executor.spec.ts` | StubToolExecutor + 인자 검증 실패 케이스 단위 테스트 |
| 신규 | `rhwp-agent-server/test/chat-tools.e2e-spec.ts` | tool_calls 루프 e2e (모킹) |
| 수정 | `rhwp-agent-server/src/chat/chat.service.ts` | `completeWithTools(messages, tools?, executor?)` 추가 (기존 `complete()` 유지) |
| 수정 | `rhwp-agent-server/src/chat/chat.module.ts` | StubToolExecutor provider 등록 |
| 수정 | `rhwp-agent-server/src/__mocks__/openai.ts` + `test/__mocks__/openai.ts` | tool_calls 응답 시나리오 모킹 강화 (R-012 dup 영향) |
| 신규/수정 | `rhwp-agent-server/src/chat/chat.service.spec.ts` | `completeWithTools()` 단위 테스트 추가 |
| 수정 | `rhwp-agent-server/package.json`, `package-lock.json` | `zod`, `zod-to-json-schema` 추가 |

본가 코드 무수정 — `src/`, `rhwp-studio/`, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/` 모두 변경 없음.

## 4. 외부 의존성

R-007 적용 (모두 *제약*으로 명시):

| 항목 | 제약 | 비고 |
|------|------|------|
| `openai` | 안정 채널 (#2 v6.35.0 그대로) | tool calling API 사용 |
| `@nestjs/config` | #2 그대로 | |
| `zod` | 안정 채널 (`@latest`) | tool 인자 zod 스키마 → 런타임 검증 + TS 타입 추론 |
| `zod-to-json-schema` | 안정 채널 (`@latest`) | zod 스키마 → JSON Schema (OpenAI tool spec 의 `parameters` 필드) |
| OpenAI tool spec 형식 | OpenAI docs 또는 `openai` SDK 의 `ChatCompletionTool` 타입 | R-010: Stage 1 시작 시 SDK 타입 정의 인용 (외부 docs 차단 시 fallback) |

**zod 도입 효과**: tool 정의·런타임 검증·TypeScript 타입 *3가지를 단일 zod 스키마에서 자동 도출*. 직접 검증 시 발생하는 spec/검증/타입 drift 위험 제거. R-008 (자동 검증 우선) 정신과 일관.

## 5. 단계 분할 개요

| Stage | 내용 | 검증 |
|-------|------|------|
| **Stage 1** | tool spec 4개 + ToolExecutor 인터페이스 + StubToolExecutor + 단위 테스트 | `npm test` (단위) tool spec / executor 검증 |
| **Stage 2** | ChatService.completeWithTools() 구현 + tool_calls 루프 + max iterations 가드 + 모킹 e2e | `npm run test:e2e` 다단계 호출 자동 검증 |
| **Stage 3** | compose 부팅 검증 (R-013 2단계 사다리) + 문서 정리 | `docker compose up agent-server` + `/health` 200 |

3 stage (본가 절차 최소치).

## 6. 리스크 / 미해결 결정사항

각 항목별 추천안 + 이유.

### R-3-A. ToolExecutor 인터페이스 형태
- **추천**: NestJS 표준 — abstract class (DI token + impl 분리 친화)
  ```ts
  export abstract class ToolExecutor {
    abstract execute(name: string, args: Record<string, unknown>): Promise<unknown>;
  }
  ```
- **이유**: 후속 #5/#6 에서 `RealToolExecutor` 구현체로 교체 시 DI 변경만으로 완료. 함수 타입은 NestJS DI 와 어색.

### R-3-B. tool spec 정의 위치
- **추천**: 단일 `tools.spec.ts` — 4개 도구를 한 파일에서 export
- **이유**: 도구별 분리는 4개 시점에 가독성 ↓. 후속 task 에서 도구 수 증가 시점에 분리 검토.

### R-3-C. max iterations 기본값
- **추천**: **5** (R-009: ± 2 → 3~7 허용)
- **이유**: 일반 편집 시나리오 (입력 → 도구 호출 → 결과 → 응답) 는 1~2 iterations. 5 면 복잡한 다단계 도구 호출도 충분.

### R-3-D. tool 인자 검증 [수정 2026-04-30 — 작업지시자 재검토 후]
- **추천**: **zod + zod-to-json-schema** (단일 진실 원천 패턴)
- **이유**:
  1. OpenAI tool spec 의 `parameters` 필드는 본질적으로 JSON Schema → zod 스키마에서 자동 변환 가능
  2. 한 zod 스키마에서 *(a) OpenAI 에 보낼 tool spec + (b) 런타임 인자 검증 + (c) TypeScript 타입 추론* 3가지 자동 도출 → spec/검증/타입 drift 제거
  3. R-008 (자동 검증 우선) 정신과 일관 — 선언형 검증
  4. 의존성 부담 미미 (~50KB), NestJS 11 + openai 6 + joi 18 트리에 비해 무시 가능
- **반대 입장 (참고)**: 직접 if/else 검증은 의존성 0 + 단순. 다만 *spec/검증/타입 분리* 와 *후속 task 의 도구 추가 시 매번 3곳 수정* 비용을 감수해야 함.
- **결정 경위**: 초안에서 "단순 인자라 직접 검증" 추천 → 작업지시자 검증 질문에서 *zod 의 단일 진실 원천 가치* 누락 발견 → 수정. R-015 후보 (수행계획서 §6 결정사항은 추천뿐 아니라 *반대 입장 근거*도 함께) 의 첫 적용 사례로 본 task 종료 시 정식화 검토.

### R-3-E. assistant message 의 tool_calls + content 동시 처리
- **추천**: tool_calls 우선, content 무시. 다음 iteration 에서만 content 추출.
- **이유**: OpenAI 의 일반적 패턴. content 가 함께 있으면 *중간 reasoning* 이지 최종 응답 아님.

### R-3-F. tool 실행 에러 처리
- **추천**: StubToolExecutor 가 throw → ChatService 가 *tool 결과 message 에 에러 텍스트 포함* + 다음 iteration 진행 (모델이 에러 인지 후 사용자에게 보고)
- **대안**: 즉시 throw → 사용자 보고
- **이유**: 에이전트가 *에러를 자연스럽게 인지하고 대응*하는 게 자율성 ↑. 다만 무한 에러 루프는 max iterations 가드.

### R-3-G. 모킹 시나리오 디자인
- **추천**: 단일 시나리오 — assistant 응답이 *항상 tool_call → 결과 받으면 텍스트 응답* 의 2-iteration 패턴. max iterations 테스트는 *항상 tool_call 만 반복하는* 별도 시나리오.
- **이유**: 단일 시나리오는 *정상 흐름 검증*, max iterations 시나리오는 *가드 동작 검증*. 분리.

### R-3-H. compose 검증 범위
- **추천**: 본 task 는 *부팅 정상* 까지만. tool_calls 실 동작은 jest 환경에서만.
- **이유**: compose 환경에서 tool_calls 까지 실 검증하려면 OpenAI 실 키 + 비용. R-007 정신상 *각 layer 의 책임 명확화*.

## 7. 일정 가이드 (R-009)

| 단계 | 코드 작업 (기준 ± 오차) | 비고 |
|------|----------------------|------|
| 수행계획서 | — | 본 문서 |
| 구현계획서 | — | 다음 단계 |
| Stage 1 | 30 ± 15분 | tool spec + executor 인터페이스 + 단위 |
| Stage 2 | 60 ± 20분 | tool_calls 루프 + 모킹 e2e (가장 큰 단계) |
| Stage 3 | 25 ± 10분 | compose 부팅 검증 + 문서 |
| 최종 보고서 | — | 방법론 평가 누적 |

## 8. 방법론 평가 메모 (사전)

### 8.1 R-007~R-013 사전 적용 사례 (2번째 task)

본 task 는 R-010/R-011/R-013 까지 합쳐 *모든 누적 다듬기*가 사전 적용되는 첫 사례.
검증할 가설:
- **R-010** (외부 정보 조회): OpenAI tool calling spec 조회가 stage 1 시작 시 명시 → 진행 끊김 없음
- **R-011** (누적 환경 점검): 본 task 시작 전 환경 점검 완료 (위) → 시작 시점 deviation 0
- **R-013** (2단계 검증 사다리): 종료 조건에 명시 → Stage 1·2 의 jest 검증 + Stage 3 의 compose 검증

### 8.2 R-014 후보 (이슈 등록 시 다듬기 점검표)

본 이슈 본문에 "R-007~R-013 사전 적용 점검 표" 를 포함했음. 이 패턴이 정착되면
*"이슈 등록 시 활성 R-* 다듬기 점검표 의무화"* 로 정식 등록 검토.

### 8.3 R-3-A~H 8개 결정사항 사전 명시 효과

수행계획서 §6 의 결정사항 8개 모두 추천 + 이유 명시. R-001 (b) 승인이
*8개 결정사항 일괄 승인*으로 명확화 — 결정 가시성 ↑. 본 패턴이
#1/#2 와 일관 작동하는지 본 task 종료 시 평가.

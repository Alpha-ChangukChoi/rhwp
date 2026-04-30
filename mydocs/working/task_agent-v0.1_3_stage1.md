# [Stage 1 보고서] task_agent-v0.1_3 — 도구 정의 + ToolExecutor + StubToolExecutor

- **이슈**: [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3)
- **수행계획서**: [task_agent-v0.1_3.md](../plans/task_agent-v0.1_3.md)
- **구현계획서**: [task_agent-v0.1_3_impl.md](../plans/task_agent-v0.1_3_impl.md) Stage 1
- **단계**: Stage 1 / 3
- **작성일**: 2026-04-30

---

## 1. 실행 결과 요약

OpenAI tool calling spec 조회 (SDK fallback), zod 스키마 4개 + JSON Schema 자동 변환, ToolExecutor 인터페이스 + StubToolExecutor 구현, 단위 테스트 12건 자동 검증 완료.

| 종료 체크 | 결과 |
|----------|------|
| R-010 spec 조회 (SDK fallback) | ✅ openai SDK 의 ChatCompletionFunctionTool/ToolMessageParam 타입 인용 |
| zod 의존성 설치 | ✅ `zod@4.4.1` (zod-to-json-schema 는 deviation §4.1 로 제거) |
| `npm run build` exit 0 | ✅ |
| 단위 테스트 신규 12건 (tools 5 + executor 7) | ✅ 누적 15 passed |
| zod 단일 진실 원천 검증 | ✅ `tools.ts` 한 파일에서 (a) 검증 (b) JSON Schema (c) TS 타입 자동 도출 |

## 2. 실행 로그 발췌

### 2.1 R-010 외부 정보 조회

- 1차 시도: `https://platform.openai.com/docs/guides/function-calling` → **403 차단** (예상됨, R-010 fallback 발동)
- fallback: SDK 타입 정의 직접 인용 (`node_modules/openai/resources/chat/completions/completions.d.ts`)
  - `ChatCompletionFunctionTool { type: 'function', function: Shared.FunctionDefinition }`
  - `ChatCompletionMessageFunctionToolCall { id, type: 'function', function: { name, arguments: string } }`
  - `ChatCompletionToolMessageParam { role: 'tool', content, tool_call_id }`
- **검증**: 우리 디자인의 `JSON.parse(call.function.arguments)` + `tool` role message 구조가 SDK 타입과 정합

### 2.2 의존성 설치

```
$ npm install zod zod-to-json-schema
added 2 packages, found 0 vulnerabilities

(빌드 시 호환성 이슈 발견 — deviation §4.1)

$ npm uninstall zod-to-json-schema
removed 1 package, found 0 vulnerabilities

최종: zod@^4.4.1 (단일 의존성)
```

### 2.3 빌드 + 자동 테스트

```
$ npm run build
> nest build (exit 0)

$ npm test
Test Suites: 3 passed, 3 total
Tests:       15 passed, 15 total       (chat.service 3 + tools 5 + executor 7)
Time:        0.72 s
```

## 3. 변경 파일 목록

### 신규

| 경로 | 용도 |
|------|------|
| `rhwp-agent-server/src/chat/tools.ts` | zod 스키마 4개 + `z.toJSONSchema()` 변환된 TOOLS array (단일 진실 원천) |
| `rhwp-agent-server/src/chat/tool-executor.ts` | abstract `ToolExecutor` + `StubToolExecutor` (zod parse 검증) |
| `rhwp-agent-server/src/chat/tools.spec.ts` | tools 단위 테스트 (5건) |
| `rhwp-agent-server/src/chat/tool-executor.spec.ts` | StubToolExecutor 단위 테스트 (7건) |

### 수정

| 경로 | 변경 |
|------|------|
| `rhwp-agent-server/src/chat/chat.module.ts` | `{ provide: ToolExecutor, useClass: StubToolExecutor }` provider 등록 |
| `rhwp-agent-server/package.json`, `package-lock.json` | `zod` 추가 (zod-to-json-schema 는 제거) |

## 4. 계획 대비 편차 (Deviations)

### 4.1 `zod-to-json-schema` 패키지 제거 + zod v4 built-in 사용

- **계획**: 수행계획서 §4 + 구현계획서 §1.1 에서 `zod-to-json-schema` 패키지 도입
- **현상**: 빌드 시 TypeScript 에러 4건 — `zodToJsonSchema(GetDocumentTextArgs)` 의 인자 타입이 `ZodType<...>` 와 호환 안 됨
  ```
  Argument of type 'ZodObject<{...}, $strip>' is not assignable to parameter of type 'ZodType<any, ZodTypeDef, any>'
  ```
- **원인 분석**: zod v4 의 ZodObject 가 v3 의 ZodType 인터페이스와 internal shape 다름. zod-to-json-schema v3 패키지가 v3 인터페이스 기대.
- **해결**: zod v4 가 `z.toJSONSchema()` 를 **built-in** 으로 제공 (`node_modules/zod/v4/classic/external.d.cts:10`). 외부 패키지 제거 + built-in 사용.
- **결과**:
  - 의존성 1개 감소 (긍정적 — R-007 정신상 *최신 도구가 기능 흡수 시 별도 의존성 제거*)
  - `tools.ts` 의 import 단순화: `import { z } from 'zod'` 한 줄
  - 코드 변경: `zodToJsonSchema(X)` → `z.toJSONSchema(X)` (sed replacement)
- **재검토**: zod v3 다운그레이드도 가능했으나 *최신 안정 채널 우선* (R-007) 정신상 zod v4 + built-in 이 더 적합.

### 4.2 R-007 적용 결과 (3 stage 누적 검증)

본 stage 의 deviation 1건 (4.1) 은 **새 도구 도입 시 발생한 호환성 이슈**. 의존성 제거로 *오히려 lean 한 트리* 결과 → R-007 가설 (버전 제약화 → deviation ↓ + 발생해도 *제거 가능한 형태*) 추가 입증.

### 4.3 R-008 적용 결과 (자동 검증)

종료 체크 5건 모두 자동 명령. 작업지시자 manual 검증 0회.

### 4.4 R-010 적용 결과 (외부 정보 조회)

- 1차 자동 fetch 차단 발생 → fallback 즉시 발동 → 진행 끊김 0초
- 본 task 의 R-010 첫 실측: **가설 입증** (사전 명시된 fallback 으로 외부 차단 우회)

## 5. 검증 방법 (재현)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/rhwp-agent-server

npm install                 # zod@^4.4.1 (zod-to-json-schema 제거 후)
npm run build               # exit 0
npm test                    # 15 passed
```

## 6. 다음 단계 — Stage 2 진입 체크리스트

- [ ] Stage 1 보고서 승인
- [ ] ChatService.completeWithTools 디자인 합의 (구현계획서 §2.2 그대로)
- [ ] mock 응답 시나리오 주입 패턴 (mockResolvedValueOnce 시퀀스) 설계 검토

## 7. 방법론 평가 메모

### 7.1 R-007~R-013 사전 적용 결과 (Stage 1 차원)

| 다듬기 | Stage 1 결과 |
|--------|------------|
| R-007 | 신규 의존성 deviation 1건 → 의존성 제거로 lean 화 (가설 추가 입증) |
| R-008 | 종료 체크 5건 모두 자동, manual 0회 |
| R-009 | 시간 25분 (계획 30 ± 15분 안) |
| R-010 | docs 차단 → SDK fallback → 진행 끊김 0 (**가설 첫 입증**) |
| R-011 | 본 task 시작 전 환경 점검 완료 → Stage 1 시작 시 deviation 0 |

R-008/R-009/R-010 모두 본 stage 에서 *작동*. 특히 R-010 의 fallback 패턴이 첫 실측에서 *진행 끊김 없음* 으로 입증.

### 7.2 zod v4 가 도입된 *예상 외 효과*

- *spec/검증/타입 단일 진실 원천* 디자인이 zod v4 의 built-in toJSONSchema 와 결합해 *제로 외부 의존성*까지 도달.
- R-3-D 변경 결정이 잘 작동했음을 추가 입증 — 작업지시자 검증 질문이 디자인 변경의 입력이 됨.

### 7.3 본 stage 의 시간 실측 (R-009)

- **계획**: 30 ± 15분 (15~45분)
- **실제**: 약 25분 (R-010 fallback 5분 + 의존성·코드 10분 + 빌드 디버그 5분 + 검증 5분)
- **분석**: 계획 범위 안. zod-to-json-schema 호환성 이슈 디버그가 *예상 외 5분* 이지만 R-009 허용 오차 안 → deviation 으로 분류 안 됨. **R-009 가설 추가 입증**.

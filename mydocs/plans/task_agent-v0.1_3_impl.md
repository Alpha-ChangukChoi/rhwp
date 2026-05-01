# [구현계획서] task_agent-v0.1_3 — hwpctl Action ↔ OpenAI tool 매핑 + 도구 호출 루프

- **이슈**: [#3](https://github.com/Alpha-ChangukChoi/rhwp/issues/3)
- **수행계획서**: [task_agent-v0.1_3.md](./task_agent-v0.1_3.md) (작업지시자 승인 완료, 2026-04-30, R-3-D 수정 반영)
- **브랜치**: `local/task3`
- **단계 수**: 3 (본가 절차 최소치)
- **작업 위치**: `/Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/`

---

## 단계 분할 원칙 (R-008 + R-013)

각 stage 종료 체크는 자동 명령. Stage 1·2 는 jest 환경, Stage 3 는 컨테이너 환경 — *2단계 검증 사다리*가 본 task 의 검증 골격.

```
Stage 1: 도구 정의 + Executor (자동 단위 테스트로 검증)
   ↓
Stage 2: ChatService.completeWithTools 루프 + max iter (자동 e2e 모킹)
   ↓
Stage 3: compose 환경 부팅 + 의존성 정상 (R-013 2단계 사다리 마지막 단계)
```

---

## Stage 1 — 도구 정의 + ToolExecutor + StubToolExecutor

**기준 시간**: 30 ± 15분 (R-009)

### 1.0 사전 점검 + R-010 외부 정보 조회

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork
git branch --show-current   # local/task3 확인
node --version              # v22 확인
```

**R-010: OpenAI tool calling spec 조회**
- 1차 시도: OpenAI docs (`https://platform.openai.com/docs/guides/function-calling`) — 자동 fetch 차단 가능
- **fallback (사전 합의)**: `openai` SDK 의 `ChatCompletionTool` 타입 정의 직접 인용 (`node_modules/openai/resources/chat/completions/completions.d.ts`)

본 stage 시작 시 fallback 우선 — 차단 무관하게 진행 가능.

### 1.1 의존성 설치 (R-007)

```bash
cd rhwp-agent-server
npm install zod zod-to-json-schema
```

설치 후 `package.json` 반영 확인 (`zod`, `zod-to-json-schema` 둘 다 dependencies).

### 1.2 도구 정의 — `src/chat/tools.ts`

zod 스키마 4개 + `zodToJsonSchema` 변환된 OpenAI tool spec array export.

```ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

// ===== zod 스키마 (단일 진실 원천) =====
export const GetDocumentTextArgs = z.object({
  range: z
    .object({
      start: z.number().int().min(0),
      end: z.number().int().min(0),
    })
    .optional(),
});

export const InsertTextArgs = z.object({
  position: z.number().int().min(0),
  text: z.string().min(1),
});

export const DeleteRangeArgs = z.object({
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});

export const ReplaceTextArgs = z.object({
  query: z.string().min(1),
  replacement: z.string(),
});

// ===== TS 타입 (zod 추론) =====
export type GetDocumentTextArgsT = z.infer<typeof GetDocumentTextArgs>;
export type InsertTextArgsT = z.infer<typeof InsertTextArgs>;
export type DeleteRangeArgsT = z.infer<typeof DeleteRangeArgs>;
export type ReplaceTextArgsT = z.infer<typeof ReplaceTextArgs>;

// ===== zod 스키마 → 도구 이름 매핑 (executor 용) =====
export const TOOL_SCHEMAS = {
  get_document_text: GetDocumentTextArgs,
  insert_text: InsertTextArgs,
  delete_range: DeleteRangeArgs,
  replace_text: ReplaceTextArgs,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

// ===== OpenAI tool spec (zod → JSON Schema 자동 변환) =====
export const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_document_text',
      description: '현재 문서 또는 지정 범위의 텍스트를 읽는다',
      parameters: zodToJsonSchema(GetDocumentTextArgs),
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'insert_text',
      description: '지정 위치에 텍스트를 삽입한다',
      parameters: zodToJsonSchema(InsertTextArgs),
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_range',
      description: 'start ~ end 범위의 텍스트를 삭제한다',
      parameters: zodToJsonSchema(DeleteRangeArgs),
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'replace_text',
      description: 'query 와 일치하는 텍스트를 replacement 로 치환한다',
      parameters: zodToJsonSchema(ReplaceTextArgs),
    },
  },
];
```

### 1.3 ToolExecutor — `src/chat/tool-executor.ts`

```ts
import { Injectable, Logger } from '@nestjs/common';
import { TOOL_SCHEMAS, ToolName } from './tools';

export abstract class ToolExecutor {
  abstract execute(name: string, rawArgs: unknown): Promise<unknown>;
}

@Injectable()
export class StubToolExecutor extends ToolExecutor {
  private readonly logger = new Logger(StubToolExecutor.name);

  async execute(name: string, rawArgs: unknown): Promise<unknown> {
    if (!(name in TOOL_SCHEMAS)) {
      throw new Error(`unknown tool: ${name}`);
    }
    const schema = TOOL_SCHEMAS[name as ToolName];
    const args = schema.parse(rawArgs);
    this.logger.log(`stub tool=${name} args=${JSON.stringify(args)}`);

    switch (name) {
      case 'get_document_text':
        return { text: 'stub document text. lorem ipsum.' };
      case 'insert_text':
        return { ok: true, inserted_at: (args as any).position };
      case 'delete_range':
        return {
          ok: true,
          deleted_chars: (args as any).end - (args as any).start,
        };
      case 'replace_text':
        return { ok: true, replaced_count: 0 };
    }
  }
}
```

### 1.4 ChatModule 갱신 — `src/chat/chat.module.ts`

```ts
import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { openAiClientProvider } from './openai.factory';
import { ToolExecutor, StubToolExecutor } from './tool-executor';

@Module({
  providers: [
    openAiClientProvider,
    ChatService,
    { provide: ToolExecutor, useClass: StubToolExecutor },
  ],
  exports: [ChatService, ToolExecutor],
})
export class ChatModule {}
```

### 1.5 단위 테스트

**`src/chat/tools.spec.ts`** — zod 스키마 + JSON Schema 변환 검증

```ts
import {
  TOOLS,
  TOOL_SCHEMAS,
  InsertTextArgs,
  GetDocumentTextArgs,
} from './tools';

describe('tools (zod schemas + OpenAI spec)', () => {
  it('TOOLS array 에 4개 도구 정의', () => {
    expect(TOOLS).toHaveLength(4);
    const names = TOOLS.map((t) => t.function.name);
    expect(names).toEqual([
      'get_document_text',
      'insert_text',
      'delete_range',
      'replace_text',
    ]);
  });

  it('각 tool 의 parameters 가 JSON Schema 형식', () => {
    for (const tool of TOOLS) {
      expect(tool.function.parameters).toBeDefined();
      expect((tool.function.parameters as any).type).toBe('object');
    }
  });

  it('TOOL_SCHEMAS 의 zod 스키마가 정상 인자 parse', () => {
    expect(InsertTextArgs.parse({ position: 0, text: 'hi' })).toEqual({
      position: 0,
      text: 'hi',
    });
    expect(GetDocumentTextArgs.parse({})).toEqual({});
  });

  it('잘못된 인자 reject', () => {
    expect(() => InsertTextArgs.parse({ position: -1, text: 'x' })).toThrow();
    expect(() => InsertTextArgs.parse({ position: 0, text: '' })).toThrow();
  });
});
```

**`src/chat/tool-executor.spec.ts`** — StubToolExecutor 단위 테스트

```ts
import { StubToolExecutor } from './tool-executor';

describe('StubToolExecutor', () => {
  let executor: StubToolExecutor;

  beforeEach(() => {
    executor = new StubToolExecutor();
  });

  it('get_document_text 응답', async () => {
    const result = await executor.execute('get_document_text', {});
    expect(result).toEqual({ text: expect.stringContaining('stub') });
  });

  it('insert_text 응답', async () => {
    const result = await executor.execute('insert_text', {
      position: 5,
      text: 'hello',
    });
    expect(result).toEqual({ ok: true, inserted_at: 5 });
  });

  it('delete_range 응답', async () => {
    const result = await executor.execute('delete_range', {
      start: 0,
      end: 10,
    });
    expect(result).toEqual({ ok: true, deleted_chars: 10 });
  });

  it('replace_text 응답', async () => {
    const result = await executor.execute('replace_text', {
      query: 'a',
      replacement: 'b',
    });
    expect(result).toEqual({ ok: true, replaced_count: 0 });
  });

  it('unknown tool throw', async () => {
    await expect(executor.execute('not_a_tool', {})).rejects.toThrow(
      'unknown tool',
    );
  });

  it('잘못된 인자 throw (zod 검증)', async () => {
    await expect(
      executor.execute('insert_text', { position: -1, text: 'x' }),
    ).rejects.toThrow();
  });
});
```

### 1.6 검증

```bash
cd rhwp-agent-server
npm run build               # exit 0
npm test                    # 단위: 기존 3 + 신규 (tools 4 + executor 6) = 13 passed
```

### 1.7 Stage 1 종료 체크

- [ ] R-010 OpenAI tool calling spec 조회 (또는 SDK 타입 정의 fallback) 완료·기록
- [ ] `npm install zod zod-to-json-schema` 성공 (안정 채널)
- [ ] `npm run build` exit 0
- [ ] 단위 테스트 신규 10건 (tools 4 + executor 6) 모두 pass
- [ ] zod 스키마 → JSON Schema 변환이 자동 단위 테스트로 검증됨

### 1.8 Stage 1 보고서

**경로**: `mydocs/working/task_agent-v0.1_3_stage1.md`

내용 항목:
1. R-010 결과 (조회 또는 fallback 사용 여부)
2. 의존성 변경 diff
3. 단위 테스트 출력 + 신규 테스트 수
4. zod 단일 진실 원천 검증 결과 (parameters 가 자동 도출됨)
5. 발견·deviation
6. 방법론 평가 메모

---

## Stage 2 — ChatService.completeWithTools 루프 + max iter + 모킹 e2e

**기준 시간**: 60 ± 20분 (R-009)

### 2.1 모킹 강화 — `src/__mocks__/openai.ts` + `test/__mocks__/openai.ts`

기존 단순 응답에 더해, *시나리오별 응답을 mockResolvedValueOnce 로 주입* 가능하도록 jest.fn() 의 자유도 활용. 모킹 본체는 그대로 두고 테스트에서 동적 응답 주입.

(현재 mock 의 `chat.completions.create` 가 jest.fn() 이므로 추가 변경 없음. 양 dup 파일 동기화 확인.)

### 2.2 ChatService.completeWithTools — `src/chat/chat.service.ts`

기존 `complete()` 유지 + 새 메서드 추가:

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './openai.factory';
import { OpenAiError } from './chat.errors';
import { ChatMessage } from './chat.types';
import { ToolExecutor } from './tool-executor';
import { TOOLS } from './tools';

const MAX_ITERATIONS = 5;   // R-3-C, R-009 (±2 → 3~7)

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly model: string;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    config: ConfigService,
    private readonly toolExecutor: ToolExecutor,   // R-3-A DI
  ) {
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
  }

  async complete(messages: ChatMessage[]): Promise<ChatMessage> {
    /* 기존 그대로 */
  }

  async completeWithTools(messages: ChatMessage[]): Promise<ChatMessage> {
    const conversation: any[] = [...messages];
    const startedAt = Date.now();

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: conversation,
        tools: TOOLS,
      });

      const choice = response.choices?.[0]?.message;
      if (!choice) throw new OpenAiError('empty choice');

      // tool_calls 우선 처리 (R-3-E: content 동시 시 tool_calls 우선)
      if (choice.tool_calls && choice.tool_calls.length > 0) {
        conversation.push(choice);   // assistant 의 tool_calls 응답 보존

        for (const call of choice.tool_calls) {
          if (call.type !== 'function') continue;
          const name = call.function.name;
          let toolResultPayload: unknown;
          try {
            const args = JSON.parse(call.function.arguments || '{}');
            toolResultPayload = await this.toolExecutor.execute(name, args);
          } catch (err) {
            // R-3-F: 에러를 tool 결과 message 로 반영, 모델이 인지
            toolResultPayload = {
              error: err instanceof Error ? err.message : String(err),
            };
          }
          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(toolResultPayload),
          });
        }
        continue;   // 다음 iteration
      }

      // tool_calls 없음 → 최종 텍스트 응답
      if (!choice.content) {
        throw new OpenAiError('empty choice content');
      }
      const elapsed = Date.now() - startedAt;
      this.logger.log(
        `completeWithTools iters=${i + 1} elapsed=${elapsed}ms`,
      );
      return { role: 'assistant', content: choice.content };
    }

    // R-3-C: max iterations 초과
    const elapsed = Date.now() - startedAt;
    throw new OpenAiError(
      `max iterations (${MAX_ITERATIONS}) exceeded after ${elapsed}ms`,
    );
  }
}
```

### 2.3 단위 테스트 — `src/chat/chat.service.spec.ts` 추가

기존 3건 유지 + completeWithTools 시나리오 3건 추가 (총 6건):

```ts
describe('completeWithTools', () => {
  // ... 같은 beforeEach (toolExecutor 추가 provider 필요)

  it('정상 2-iter: tool_call → 결과 → 텍스트 응답 (R-009 < 200ms)', async () => {
    const create = openai.chat.completions.create as unknown as jest.Mock;
    create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'tc1',
                  type: 'function',
                  function: {
                    name: 'get_document_text',
                    arguments: '{}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { message: { role: 'assistant', content: 'final answer' } },
        ],
      });

    const start = Date.now();
    const result = await service.completeWithTools([
      { role: 'user', content: 'read the doc' },
    ]);
    expect(result.content).toBe('final answer');
    expect(create).toHaveBeenCalledTimes(2);
    expect(Date.now() - start).toBeLessThan(200);   // R-009 다단계 < 500ms (2-iter < 200)
  });

  it('max iterations (5) 초과 시 OpenAiError throw', async () => {
    const create = openai.chat.completions.create as unknown as jest.Mock;
    // 매번 tool_call 만 반환
    create.mockResolvedValue({
      choices: [
        {
          message: {
            role: 'assistant',
            tool_calls: [
              {
                id: 'tc1',
                type: 'function',
                function: { name: 'get_document_text', arguments: '{}' },
              },
            ],
          },
        },
      ],
    });

    await expect(
      service.completeWithTools([{ role: 'user', content: 'loop' }]),
    ).rejects.toThrow('max iterations');
    expect(create).toHaveBeenCalledTimes(5);
  });

  it('tool 실행 에러는 tool 결과 message 에 반영 (모델이 인지)', async () => {
    const create = openai.chat.completions.create as unknown as jest.Mock;
    create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'tc1',
                  type: 'function',
                  function: { name: 'unknown_tool', arguments: '{}' },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          { message: { role: 'assistant', content: 'sorry, tool error' } },
        ],
      });

    const result = await service.completeWithTools([
      { role: 'user', content: 'use unknown' },
    ]);
    expect(result.content).toBe('sorry, tool error');
    // 두 번째 호출의 messages 에 error 텍스트 포함되었는지 검증
    const secondCall = create.mock.calls[1][0];
    const toolMsg = secondCall.messages.find((m: any) => m.role === 'tool');
    expect(toolMsg.content).toMatch(/error/);
  });
});
```

(beforeEach 에 `{ provide: ToolExecutor, useClass: StubToolExecutor }` 추가 필요)

### 2.4 e2e 테스트 — `test/chat-tools.e2e-spec.ts`

```ts
jest.mock('openai');

import { Test } from '@nestjs/testing';
import OpenAI from 'openai';
import { AppModule } from './../src/app.module';
import { ChatService } from './../src/chat/chat.service';

describe('ChatService.completeWithTools (e2e, mocked openai)', () => {
  it('AppModule 부트스트랩 후 tool_calls → stub 실행 → 최종 응답', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const chat = moduleRef.get(ChatService);

    // 모킹 응답 시퀀스 주입
    // (mock 인스턴스에 직접 접근하기 위해 module 안의 OPENAI_CLIENT provider 통해)
    // ... 시나리오: tool_call → 결과 → 텍스트
    // (구현 시 실제 코드로 검증)

    await moduleRef.close();
  });
});
```

### 2.5 검증

```bash
cd rhwp-agent-server
npm run build               # exit 0
npm test                    # 단위: 기존 + ChatService.completeWithTools 추가 = ~16건
npm run test:e2e            # e2e: 기존 4건 + chat-tools 1건 = 5건
```

### 2.6 Stage 2 종료 체크

- [ ] `completeWithTools` 단위 3건 추가 (정상 2-iter / max iter / tool 에러) 모두 pass
- [ ] e2e 1건 추가 (AppModule 부트스트랩 + tool_calls 루프) pass
- [ ] R-009 응답 시간 자동 expect: 정상 2-iter < 200ms, max iter (5번 반복 후 throw) < 500ms
- [ ] R-3-C max iterations = 5 가 코드 + 테스트로 검증됨
- [ ] R-3-F tool 에러 처리 (message 에 반영) 가 단위 테스트로 검증됨

### 2.7 Stage 2 보고서

**경로**: `mydocs/working/task_agent-v0.1_3_stage2.md`

---

## Stage 3 — compose 환경 부팅 검증 + 문서 정리

**기준 시간**: 25 ± 10분 (R-009)

### 3.1 compose 통합 검증 (R-013 2단계 검증 사다리)

R-3-H: 본 task 의 compose 검증은 *부팅 정상*까지만. tool_calls 실 동작은 jest 환경에서만.

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork

# .env 점검 (sk-dummy 그대로)
cat rhwp-agent-server/.env

# 빌드·기동
docker compose build agent-server
docker compose up -d agent-server
sleep 4

# 부팅 정상 확인
docker compose logs agent-server | tail -10
# 기대: ConfigModule + ChatModule + AppModule + StubToolExecutor 모두 initialized
curl -s http://localhost:3000/health | jq .
# 기대: status:ok JSON

docker compose down
```

### 3.2 부팅 로그 검증

`docker compose logs` 출력에 다음이 포함되어야 함:

- `ConfigHostModule dependencies initialized`
- `AppModule dependencies initialized`
- `ConfigModule dependencies initialized`
- `ChatModule dependencies initialized`
- `RoutesResolver HealthController {/health}`
- `Nest application successfully started`

ChatModule 이 새 ToolExecutor provider 와 함께 정상 등록됐다는 증거. NestJS 의 logger 가 자동 출력.

### 3.3 Stage 3 종료 체크

- [ ] `docker compose build agent-server` 성공
- [ ] `docker compose up -d agent-server` 후 `Up` 상태
- [ ] `curl :3000/health` 200 OK + 기존 JSON
- [ ] compose logs 에 ChatModule initialized 표시
- [ ] `docker compose down` 정상 정리

### 3.4 Stage 3 보고서

**경로**: `mydocs/working/task_agent-v0.1_3_stage3.md`

내용 항목:
1. compose 빌드·기동 로그
2. 부팅 logs 의 ChatModule + 의존성 트리 검증
3. R-013 2단계 검증 사다리 종합
4. 방법론 평가 메모

### 3.5 최종 보고서

**경로**: `mydocs/report/task_agent-v0.1_3_report.md`

내용 항목:
1. 요약
2. 변경 파일 목록
3. 통합 검증 결과
4. 결정 추적 (R-3-A~H)
5. Deviation 종합
6. 회고 (예상 대비 실제, 재작업, 학습)
7. **방법론 평가** — 사전 적용된 R-007~R-013 의 *2회차* 검증 결과 (R-014 후보 + R-015 후보 정식화 검토)
8. 다음 이슈 후보 (#4)
9. 종료 처리 체크

### 3.6 커밋 전략

- 커밋 1 (Stage 1): tools.ts + tool-executor.ts + 단위 테스트 + 의존성 + Stage 1 보고서 + 수행/구현계획서
- 커밋 2 (Stage 2): ChatService.completeWithTools + 단위·e2e 테스트 + Stage 2 보고서
- 커밋 3 (Stage 3): Stage 3 보고서 (compose 검증 결과만, 코드 수정 없음)
- 커밋 4: 최종 보고서 + orders + (필요 시) methodology_refinements (R-014/R-015)

커밋 메시지 패턴: `Task #3: <단계 요약>`

---

## 의존성·전제

| 항목 | 상태 | 비고 |
|------|------|------|
| #1 / #2 task 완료 | ✅ | local/devel merge 완료 |
| 신규 의존성 (zod, zod-to-json-schema) | Stage 1.1 에서 install | |
| OPENAI_API_KEY (실 API 테스트) | 본 task 미사용 | 모킹만 |

## 리스크 (Stage 1 시작 직전)

- **R-010 OpenAI docs 차단**: 자동 fetch 실패해도 SDK 타입 정의 fallback 으로 진행 가능
- **zod-to-json-schema 의 출력 형식 차이**: OpenAI 가 기대하는 JSON Schema 와 미세 차이 가능 — 단위 테스트로 *parameters 가 object type 인지* 검증해 조기 발견
- **mock 의 시나리오 시퀀스 주입**: `mockResolvedValueOnce` 가 정확히 *호출 순서대로* 적용됨을 단위 테스트에서 검증

## 방법론 평가 메모 (구현계획서 차원)

### R-007~R-013 사전 적용 결과의 2회차 측정 디자인

| 다듬기 | 본 task 의 측정 항목 |
|--------|---------------------|
| R-007 | 신규 의존성(zod, zod-to-json-schema) 안정 채널 명시 → 실제 설치 버전이 제약 안 |
| R-008 | 종료 체크 모두 자동 명령 → 작업지시자 manual 검증 0회 (#2 와 동일 유지 가정) |
| R-009 | max iterations 5±2, 응답 시간 < 200ms / 500ms — 자동 expect |
| R-010 | OpenAI docs 조회 (또는 SDK fallback) 의 진행 끊김 없음 |
| R-011 | 본 task 시작 전 환경 점검 완료 (수행계획서 §6 외부 단계) |
| R-013 | jest (Stage 1·2) + compose (Stage 3) 2단계 검증 사다리 |

### R-014 후보 (이슈 등록 시 다듬기 점검표)

본 task 의 이슈 본문에 *R-7~R-13 사전 적용 점검 표*를 포함했음 — 정식화 첫 시도. 본 task 종료 시 효과 평가.

### R-015 후보 (반대 입장 근거 명시)

R-3-D 의 결정 경위에서 *zod 도입 vs 직접 검증* 의 양쪽 근거가 결정 변경의 입력이 됨. 추천 + *반대 입장 근거*를 사전에 함께 명시하면 작업지시자 검증의 인센티브 ↑. 본 task 종료 시 정식화 검토.

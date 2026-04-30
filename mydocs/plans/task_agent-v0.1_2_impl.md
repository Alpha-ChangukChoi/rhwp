# [구현계획서] task_agent-v0.1_2 — OpenAI Chat Completions 클라이언트 + 환경변수 검증

- **이슈**: [#2](https://github.com/Alpha-ChangukChoi/rhwp/issues/2)
- **수행계획서**: [task_agent-v0.1_2.md](./task_agent-v0.1_2.md) (작업지시자 승인 완료, 2026-04-30)
- **브랜치**: `local/task2`
- **단계 수**: 3 (본가 절차 최소치)
- **작업 위치**: `/Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/`

---

## 단계 분할 원칙

각 stage 종료 체크는 **자동 검증 가능 명령** 으로 표현 (R-008 적용). Stage 간 의존:

```
Stage 1: 환경변수 검증 인프라 (자동 e2e: 키 누락 시 부팅 실패 확인)
   ↓
Stage 2: ChatService + 모킹 (자동 e2e: complete() 응답 형태 검증)
   ↓
Stage 3: 옵셔널 실 API 통합 (jest 조건부) + 통합 검증 + 문서
```

---

## Stage 1 — 의존성 + ConfigModule + 환경변수 검증

**기준 시간**: 30 ± 15분 (R-009)

### 1.0 사전 점검 + R-2 결정 (외부 정보 조회)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork
git branch --show-current   # local/task2 확인
node --version              # v22.x 확인
```

**R-2: OpenAI 모델 기본값 결정** — 작업지시자 또는 OpenAI docs 의 권장 채팅 모델을 1회 조회 후 결정. 결정된 모델명을 `<MODEL>` placeholder 자리에 채워 넣음. 예시 후보 (실시점 변동 가능):
- 비용·속도 우선: `gpt-5-mini` 또는 그 시점 mini 라인업
- 품질 우선: `gpt-5` 또는 그 시점 flagship

본 stage 시작 직전 작업지시자 확인 → 1줄 답변으로 확정.

### 1.1 의존성 설치

```bash
cd rhwp-agent-server
npm install openai @nestjs/config joi
npm install --save-dev @types/joi    # joi 타입 (필요 시)
```

설치 후 `package.json` 의 `dependencies` / `devDependencies` 정상 반영 확인.

### 1.2 환경 스키마 작성

**경로**: `rhwp-agent-server/src/config/env.schema.ts`

```ts
import * as Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().default(3000),

  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('<MODEL>'),       // R-2 결정값
  OPENAI_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
}).unknown(true);    // 다른 환경변수 허용 (PATH 등)
```

### 1.3 ConfigModule 등록

**경로**: `rhwp-agent-server/src/app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { envSchema } from './config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
      validationOptions: { abortEarly: false },
    }),
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
```

### 1.4 .env.example 업데이트

**경로**: `rhwp-agent-server/.env.example`

```
PORT=3000

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=<MODEL>           # R-2 결정값
OPENAI_TIMEOUT_MS=30000
```

### 1.5 부팅 검증 e2e 테스트

**경로**: `rhwp-agent-server/test/config.e2e-spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';

describe('ConfigModule (e2e)', () => {
  const originalKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
  });

  it('OPENAI_API_KEY 누락 시 모듈 컴파일 실패', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(
      Test.createTestingModule({ imports: [AppModule] }).compile(),
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('OPENAI_API_KEY 있으면 정상 컴파일', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
```

### 1.6 검증

```bash
cd rhwp-agent-server
npm run build               # exit 0
npm run test:e2e            # 2 e2e files (config + health) 모두 pass
```

### 1.7 Stage 1 종료 체크

- [ ] R-2 (OPENAI_MODEL 기본값) 결정·기록
- [ ] `npm install openai @nestjs/config joi` 성공, package.json 반영
- [ ] `npm run build` exit 0
- [ ] `npm run test:e2e` 모두 pass (config 2건 + health 1건 = 3건)
- [ ] `.env.example` 에 OPENAI_MODEL / OPENAI_TIMEOUT_MS 추가됨

### 1.8 Stage 1 보고서

**경로**: `mydocs/working/task_agent-v0.1_2_stage1.md`

내용 항목 (R-008 적용 — 자동 명령 + 출력 위주):
1. R-2 결정 결과 + 근거 (사용자 응답 또는 OpenAI docs 조회)
2. 의존성 변경 diff 발췌
3. 자동 테스트 출력
4. 발견·deviation
5. 방법론 평가 메모

---

## Stage 2 — ChatService 구현 + 모킹 e2e

**기준 시간**: 60 ± 20분 (R-009)

### 2.1 OpenAI SDK 수동 모킹

**경로**: `rhwp-agent-server/test/__mocks__/openai.ts`

```ts
export class OpenAI {
  apiKey: string;
  baseURL?: string;

  constructor(opts: { apiKey: string; baseURL?: string; timeout?: number }) {
    this.apiKey = opts.apiKey;
    this.baseURL = opts.baseURL;
  }

  chat = {
    completions: {
      create: jest.fn(async (params: any) => ({
        id: 'chatcmpl-mock-1',
        model: params.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: `mock response to: ${
                params.messages?.[params.messages.length - 1]?.content ?? ''
              }`,
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      })),
    },
  };
}

export default OpenAI;
```

### 2.2 ChatService 구현

**경로**: `rhwp-agent-server/src/chat/chat.types.ts`

```ts
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}
```

**경로**: `rhwp-agent-server/src/chat/openai.factory.ts`

```ts
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export const OPENAI_CLIENT = Symbol('OPENAI_CLIENT');

export const openAiClientProvider = {
  provide: OPENAI_CLIENT,
  useFactory: (config: ConfigService) =>
    new OpenAI({
      apiKey: config.getOrThrow<string>('OPENAI_API_KEY'),
      timeout: config.getOrThrow<number>('OPENAI_TIMEOUT_MS'),
    }),
  inject: [ConfigService],
};
```

**경로**: `rhwp-agent-server/src/chat/chat.errors.ts`

```ts
export class OpenAiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'OpenAiError';
  }
}
```

**경로**: `rhwp-agent-server/src/chat/chat.service.ts`

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './openai.factory';
import { OpenAiError } from './chat.errors';
import { ChatMessage } from './chat.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly model: string;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    config: ConfigService,
  ) {
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
  }

  async complete(messages: ChatMessage[]): Promise<ChatMessage> {
    const startedAt = Date.now();
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
      });
      const elapsed = Date.now() - startedAt;
      this.logger.log(
        `chat.completions.create model=${this.model} elapsed=${elapsed}ms`,
      );

      const choice = response.choices?.[0]?.message;
      if (!choice?.content) {
        throw new OpenAiError('empty choice from openai');
      }
      return { role: 'assistant', content: choice.content };
    } catch (err) {
      if (err instanceof OpenAiError) throw err;
      throw new OpenAiError('openai chat completions failed', err);
    }
  }
}
```

**경로**: `rhwp-agent-server/src/chat/chat.module.ts`

```ts
import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { openAiClientProvider } from './openai.factory';

@Module({
  providers: [openAiClientProvider, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
```

**경로 수정**: `rhwp-agent-server/src/app.module.ts` 에 `ChatModule` 추가

### 2.3 단위 테스트

**경로**: `rhwp-agent-server/src/chat/chat.service.spec.ts`

```ts
jest.mock('openai');

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatService } from './chat.service';
import { OPENAI_CLIENT } from './openai.factory';

describe('ChatService', () => {
  let service: ChatService;
  let openai: jest.Mocked<OpenAI>;

  beforeEach(async () => {
    openai = new OpenAI({ apiKey: 'sk-test' }) as jest.Mocked<OpenAI>;
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: OPENAI_CLIENT, useValue: openai },
        { provide: ConfigService, useValue: { getOrThrow: () => 'mock-model' } },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  it('complete() returns assistant message', async () => {
    const start = Date.now();
    const result = await service.complete([
      { role: 'user', content: 'hello' },
    ]);
    expect(result.role).toBe('assistant');
    expect(result.content).toMatch(/mock response to: hello/);
    expect(Date.now() - start).toBeLessThan(100);   // R-009: mocked < 100ms
  });

  it('complete() throws OpenAiError when choice empty', async () => {
    (openai.chat.completions.create as jest.Mock).mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: '' } }],
    });
    await expect(
      service.complete([{ role: 'user', content: 'x' }]),
    ).rejects.toThrow('empty choice');
  });
});
```

### 2.4 e2e 테스트

**경로**: `rhwp-agent-server/test/chat.e2e-spec.ts`

```ts
jest.mock('openai');

import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { ChatService } from './../src/chat/chat.service';

describe('ChatService (e2e)', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test';
  });

  it('AppModule 부트스트랩 후 ChatService.complete() 응답', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const chat = moduleRef.get(ChatService);
    const result = await chat.complete([
      { role: 'system', content: 'you are a test' },
      { role: 'user', content: 'ping' },
    ]);
    expect(result.role).toBe('assistant');
    expect(result.content).toMatch(/mock response to: ping/);
    await moduleRef.close();
  });
});
```

### 2.5 검증

```bash
cd rhwp-agent-server
npm run test                # 단위 테스트 (chat.service.spec.ts)
npm run test:e2e            # e2e (config + health + chat)
npm run build               # exit 0
```

### 2.6 Stage 2 종료 체크

- [ ] `npm run test` 모두 pass (단위 chat.service.spec.ts 2건 추가)
- [ ] `npm run test:e2e` 모두 pass (chat.e2e-spec.ts 신규 1건 + 기존)
- [ ] R-009: 모킹 응답 시간 100ms 이하 검증 (테스트 안에 포함)
- [ ] OpenAiError 도메인 에러 정상 throw 검증
- [ ] `npm run build` exit 0
- [ ] ChatService 가 ConfigModule 의 OPENAI_MODEL 값을 사용함이 코드 리뷰로 확인됨

### 2.7 Stage 2 보고서

**경로**: `mydocs/working/task_agent-v0.1_2_stage2.md`

내용 항목:
1. 추가된 파일 목록 + 라인 수
2. 단위/e2e 테스트 출력 발췌
3. 모킹 동작 결정성 검증
4. R-009 응답 시간 실측
5. 방법론 평가 메모

---

## Stage 3 — 옵셔널 실 API 통합 + 통합 검증 + 문서

**기준 시간**: 30 ± 15분 (R-009)

### 3.1 옵셔널 실 API 통합 테스트

**경로**: `rhwp-agent-server/test/chat-real-api.e2e-spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { ChatService } from './../src/chat/chat.service';

const realKey = process.env.OPENAI_API_KEY;
const isRealApiTest = !!realKey && !realKey.startsWith('sk-test');

const maybe = isRealApiTest ? describe : describe.skip;

maybe('ChatService (real OpenAI API)', () => {
  jest.setTimeout(40_000);    // R-009: 30s ± 10s

  it('실제 prompt 1회 호출 후 응답 받음', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const chat = moduleRef.get(ChatService);
    const start = Date.now();
    const result = await chat.complete([
      { role: 'user', content: 'Reply with the single word: pong' },
    ]);
    const elapsed = Date.now() - start;

    expect(result.role).toBe('assistant');
    expect(result.content.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(40_000);
    console.log(`[real api] elapsed=${elapsed}ms, content="${result.content}"`);
    await moduleRef.close();
  });
});
```

이 파일은 `OPENAI_API_KEY` 가 설정되어 있고 `sk-test` 가 아닐 때만 describe 가 동작 → 키 없으면 자동 skip.

### 3.2 jest 모킹 격리 보강

`test/__mocks__/openai.ts` 가 단위·일반 e2e 에서는 자동 선택되지만, real API 파일에서는 모킹을 끄고 실제 SDK 사용해야 함.

**경로**: `rhwp-agent-server/test/chat-real-api.e2e-spec.ts` 상단에 `jest.unmock('openai')` 추가, 또는 별도 jest config 분리.

권장: 파일 상단 명시:
```ts
jest.unmock('openai');
```

### 3.3 통합 검증 (compose 환경)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork

# .env 갱신 확인 (Stage 1 의 .env.example 변경 반영)
diff rhwp-agent-server/.env rhwp-agent-server/.env.example  # OPENAI_MODEL/TIMEOUT 항목 동기화
# 필요 시 .env 갱신 (사용자가 OPENAI_API_KEY 채움)

# 컨테이너 빌드·기동
docker compose build agent-server
docker compose up -d agent-server
sleep 3

# Stage 1 의 부팅 검증 — 컨테이너에서도 ConfigModule 검증 작동하는지
# (.env 의 OPENAI_API_KEY 비어있으면 컨테이너 즉시 종료, 채워져 있으면 정상 기동)
docker compose logs agent-server | tail -20
curl -s http://localhost:3000/health | jq .   # 기존 헬스체크 정상

docker compose down
```

### 3.4 문서·메모리 정리

- `mydocs/orders/` 의 오늘 할일 갱신 (또는 신규 날짜로)
- 본 task 의 최종 보고서 작성 (다음 stage)

### 3.5 Stage 3 종료 체크

- [ ] real-api 테스트가 OPENAI_API_KEY 미설정 시 skip
- [ ] real-api 테스트가 OPENAI_API_KEY 설정 시 실행 가능 (실 호출은 작업지시자 환경에서 1회 검증)
- [ ] 컨테이너 빌드·기동 후 `/health` 정상 + ConfigModule 검증 정상 동작 (compose logs 확인)
- [ ] `.env.example` ↔ `.env` 항목 정합성 확인

### 3.6 Stage 3 보고서

**경로**: `mydocs/working/task_agent-v0.1_2_stage3.md`

### 3.7 최종 보고서

**경로**: `mydocs/report/task_agent-v0.1_2_report.md`

내용 항목 (수행계획서 §8 가설 3건 검증 포함):
1. 요약
2. 변경 파일 목록
3. 통합 검증 결과
4. 결정 추적 (R-1~R-8)
5. Deviation 종합
6. 회고
7. **방법론 평가** (수행계획서 §8 가설 3건 — R-007/R-008/R-009 의 첫 실측 결과)
8. 다음 이슈 후보 (#3)
9. 종료 처리 체크

### 3.8 커밋 전략

- 커밋 1 (Stage 1): 의존성 + ConfigModule + env schema + Stage 1 보고서
- 커밋 2 (Stage 2): ChatService + 모킹 + 단위/e2e + Stage 2 보고서
- 커밋 3 (Stage 3): real-api 테스트 + Stage 3 보고서
- 커밋 4: 최종 보고서 + orders 갱신 + (필요 시) methodology_refinements 갱신

수행계획서·구현계획서는 첫 커밋(Stage 1)에 포함.

커밋 메시지 패턴: `Task #2: <단계 요약>`

---

## 의존성·전제

| 항목 | 상태 | 비고 |
|------|------|------|
| #1 task 완료 | ✅ | local/devel merge 완료 |
| Node.js v22 | ✅ | #1 .nvmrc 그대로 |
| Docker (compose v2) | ✅ | Stage 3 통합 검증 시 |
| OPENAI_API_KEY (실 API 테스트) | 작업지시자 결정 | 실 API 테스트는 옵셔널 |

## 리스크 (Stage 1 시작 직전)

- **R-2 결정 지연**: OpenAI 모델 기본값을 stage 1 시작 시점에 사용자 응답 받기 — 짧은 대기 가능. 결정 안 되면 잠정값(`gpt-5-mini` 등)으로 진행 후 보고서에 deviation 기록.
- **joi 의존성 호환**: NestJS 11 + joi 17/18 호환은 일반적이나, 발견 시 `class-validator` 로 대체 (구현계획서 변경 사이클).
- **모킹 격리**: jest 의 자동 모킹이 *일반 e2e 와 real-api e2e 사이에 누수*되면 가짜 응답이 실 API 테스트를 감출 위험 — `jest.unmock('openai')` 또는 별도 jest config 로 격리.

---

## 방법론 평가 메모 (구현계획서 차원)

### 가설 검증 디자인 (R-007/R-008/R-009 첫 실측)

본 구현계획서는 #1 의 회고에서 정식화한 R-007/R-008/R-009 를 *처음 사전 적용*. 본 task 종료 시점에 다음 측정:

| 가설 | 측정 방법 |
|------|---------|
| R-007 (도구 버전 제약화 → deviation ↓) | 본 task 의 deviation 건수가 #1 (6건) 보다 적은지 |
| R-008 (자동 테스트로 manual 검증 ↓) | 작업지시자 manual 검증 횟수 / curl 명령 횟수 |
| R-009 (수치형 + 오차 → deviation 분류 명확화) | deviation 발생 시 *허용 오차 안* / *분리 가능한 후속 task* 분류 가능 비율 |

### R-010 후보 — 외부 정보 조회 단계 명시화

R-2 (OPENAI_MODEL 기본값) 가 *Stage 1 시작 시 외부 docs 조회 필요* — 본가 절차에 명시되지 않은 단계. 본 task 의 진행 결과를 회고하여 R-010 정식 등록 검토.

# [구현계획서] task_agent-v0.1_6 — agent-server HTTP endpoint (ChatController) + CORS

- **이슈**: [#6](https://github.com/Alpha-ChangukChoi/agentserver/issues/6)
- **수행계획서**: [task_agent-v0.1_6.md](./task_agent-v0.1_6.md) (작업지시자 승인 완료, 2026-05-01)
- **브랜치**: `local/task6`
- **단계 수**: 3 (본행) + 1 (옵셔널)
- **작업 위치**: `/Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/`

---

## 단계 분할 원칙 (R-008 + R-013 backend 표준)

```
Stage 1: DTO + ChatService.createSession + ChatController + Exception filter (jest 단위)
   ↓
Stage 2: main.ts CORS + ValidationPipe + HTTP e2e (supertest, mocked OpenAI)
   ↓
Stage 3: compose 부팅 + ChatController 라우트 노출 + CORS preflight 실측 (R-013 layer 2)
   ↓
Stage 4 (선택): rhwp-studio + 실 agent-server 통합 (puppeteer mock 제거 e2e)
```

---

## Stage 1 — DTO + ChatService.createSession + ChatController + Exception filter

**기준 시간**: 40 ± 15분 (R-009)

### 1.1 R-010 외부 정보 조회 결과

| 항목 | 출처 | fallback |
|------|------|----------|
| `class-validator` v0.14.x | npm latest stable | NestJS docs 표준 |
| `class-transformer` v0.5.x | npm latest stable | class-validator 페어 |
| NestJS `ValidationPipe` 글로벌 등록 | NestJS docs (Pipes) | 0 |
| NestJS `@Catch` exception filter + APP_FILTER | NestJS docs (Exception filters) | 0 |
| NestJS `@Controller`, `@Post`, `@Body`, `@Param` | NestJS docs (Controllers) | 0 |
| `app.enableCors()` Origin 함수 형태 | NestJS docs (CORS) | 0 |

R-010 — 모두 NestJS 공식 docs. 차단 시 영향 0.

### 1.2 의존성 추가 (R-007)

```bash
cd rhwp-agent-server
npm install class-validator class-transformer
```

`package.json` dependencies 추가. 안정 채널 (`@latest`).

### 1.3 환경변수 추가 — `src/config/env.schema.ts`

```ts
import * as Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('gpt-5.4'),
  OPENAI_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  SESSION_TTL_MS: Joi.number().integer().min(1000).default(1800000),
  SESSION_MAX_HISTORY: Joi.number().integer().min(1).default(50),
  // R-6-C: CORS 허용 origin (comma-separated)
  CORS_ALLOWED_ORIGINS: Joi.string().default(
    'http://localhost:7700,http://localhost:4173,http://localhost:7711,http://localhost:7712',
  ),
});
```

`.env.example` 갱신:

```
CORS_ALLOWED_ORIGINS=http://localhost:7700,http://localhost:4173,http://localhost:7711,http://localhost:7712
```

### 1.4 DTO — `src/chat/chat.dto.ts`

```ts
import { IsString, MaxLength, MinLength } from 'class-validator';

// R-009: 메시지 max length 10000 ± 2000 (rhwp-studio chat-input.ts 와 정합)
const MAX_CONTENT_LENGTH = 12000;   // server side 가 약간 더 관대 (client 10000)

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_CONTENT_LENGTH)
  content!: string;
}
```

### 1.5 ChatService.createSession() 추가 — `src/chat/chat.service.ts`

기존 ChatService 에 메서드 추가:

```ts
import { SessionId } from '../session/session.types';

@Injectable()
export class ChatService {
  // ... 기존 (constructor with SessionService DI)

  // R-6-G: createSession 노출 — SessionService.create() wrapper
  // 후속에 system prompt 자동 설정 등 hook 자연 진입점
  createSession(): SessionId {
    return this.sessions.create();
  }

  // ... 기존 complete / completeWithTools / completeInSession
}
```

### 1.6 Exception Filter — `src/chat/chat.exception-filter.ts`

```ts
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  SessionExpiredError,
  SessionNotFoundError,
} from '../session/session.errors';
import { OpenAiError } from './chat.errors';

@Catch(SessionNotFoundError, SessionExpiredError, OpenAiError)
export class ChatExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ChatExceptionFilter.name);

  catch(
    exception: SessionNotFoundError | SessionExpiredError | OpenAiError,
    host: ArgumentsHost,
  ): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = exception.message;

    if (exception instanceof SessionNotFoundError) {
      status = HttpStatus.NOT_FOUND;        // 404
    } else if (exception instanceof SessionExpiredError) {
      status = HttpStatus.GONE;             // 410
    } else if (exception instanceof OpenAiError) {
      status = HttpStatus.BAD_GATEWAY;      // 502
      this.logger.error(`OpenAI error: ${exception.message}`);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: exception.name,
    });
  }
}
```

### 1.7 ChatController — `src/chat/chat.controller.ts`

```ts
import {
  Body,
  Controller,
  Param,
  Post,
  UseFilters,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './chat.dto';
import { ChatMessage } from './chat.types';
import { SessionId } from '../session/session.types';
import { ChatExceptionFilter } from './chat.exception-filter';

@Controller('chat')
@UseFilters(ChatExceptionFilter)
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  // POST /chat/session — sessionId 발급 (R-6-G)
  @Post('session')
  createSession(): { sessionId: SessionId } {
    const sessionId = this.chat.createSession();
    return { sessionId };
  }

  // POST /chat/session/:id/messages — 메시지 전송 + AI 응답
  @Post('session/:id/messages')
  async sendMessage(
    @Param('id') id: SessionId,
    @Body() dto: SendMessageDto,
  ): Promise<{ reply: ChatMessage }> {
    const userMessage: ChatMessage = { role: 'user', content: dto.content };
    const reply = await this.chat.completeInSession(id, userMessage);
    return { reply };
  }
}
```

### 1.8 ChatModule 등록 — `src/chat/chat.module.ts`

```ts
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SessionModule } from '../session/session.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatExceptionFilter } from './chat.exception-filter';
import { openAiClientProvider } from './openai.factory';
import { ToolExecutor, StubToolExecutor } from './tool-executor';

@Module({
  imports: [SessionModule],
  controllers: [ChatController],
  providers: [
    openAiClientProvider,
    ChatService,
    { provide: ToolExecutor, useClass: StubToolExecutor },
    // R-6-D: ExceptionFilter 글로벌 등록 — 다른 모듈도 효력
    { provide: APP_FILTER, useClass: ChatExceptionFilter },
  ],
  exports: [ChatService, ToolExecutor],
})
export class ChatModule {}
```

### 1.9 단위 테스트 — `src/chat/chat.controller.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let chat: jest.Mocked<ChatService>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [
        {
          provide: ChatService,
          useValue: {
            createSession: jest.fn().mockReturnValue('sid-test-1'),
            completeInSession: jest.fn().mockResolvedValue({
              role: 'assistant',
              content: 'hi reply',
            }),
          },
        },
      ],
    }).compile();
    controller = moduleRef.get(ChatController);
    chat = moduleRef.get(ChatService);
  });

  it('POST /chat/session — createSession 호출 + sessionId 반환', () => {
    const result = controller.createSession();
    expect(result).toEqual({ sessionId: 'sid-test-1' });
    expect(chat.createSession).toHaveBeenCalledTimes(1);
  });

  it('POST /chat/session/:id/messages — completeInSession 호출 + reply 반환', async () => {
    const result = await controller.sendMessage('sid-test-1', { content: 'hi' });
    expect(result).toEqual({ reply: { role: 'assistant', content: 'hi reply' } });
    expect(chat.completeInSession).toHaveBeenCalledWith(
      'sid-test-1',
      { role: 'user', content: 'hi' },
    );
  });
});
```

### 1.10 ChatExceptionFilter 단위 테스트 — `src/chat/chat.exception-filter.spec.ts`

```ts
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ChatExceptionFilter } from './chat.exception-filter';
import {
  SessionExpiredError,
  SessionNotFoundError,
} from '../session/session.errors';
import { OpenAiError } from './chat.errors';

describe('ChatExceptionFilter', () => {
  let filter: ChatExceptionFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new ChatExceptionFilter();
    response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ArgumentsHost;
  });

  it('SessionNotFoundError → 404', () => {
    filter.catch(new SessionNotFoundError('sid-x'), host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: 404,
      error: 'SessionNotFoundError',
    }));
  });

  it('SessionExpiredError → 410', () => {
    filter.catch(new SessionExpiredError('sid-x'), host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.GONE);
  });

  it('OpenAiError → 502', () => {
    filter.catch(new OpenAiError('upstream fail'), host);
    expect(response.status).toHaveBeenCalledWith(HttpStatus.BAD_GATEWAY);
  });
});
```

### 1.11 ChatService.createSession 테스트 추가 — `src/chat/chat.service.spec.ts`

기존 spec 에 추가:

```ts
it('createSession() — SessionService.create() wrapper (R-6-G)', () => {
  const sid = service.createSession();
  expect(sid).toBeDefined();
  expect(sessions.has(sid)).toBe(true);
});
```

### 1.12 검증

```bash
cd rhwp-agent-server
npm install class-validator class-transformer
npm run build              # tsc 통과 (exit 0)
npm test                   # 단위: 기존 + 신규 (createSession 1건 + Controller 2건 + Filter 3건 = +6건)
```

### 1.13 Stage 1 종료 체크

- [ ] R-010 외부 docs 의존 명시 완료 (NestJS 공식 docs 패턴 4종)
- [ ] `npm install class-validator class-transformer` 성공 + `package.json` 갱신
- [ ] `npm run build` exit 0
- [ ] DTO + ChatService.createSession() + ChatController + ExceptionFilter + ChatModule 갱신
- [ ] 단위 테스트 +6건 모두 pass (누적)
- [ ] R-6-D Filter 매핑: 404/410/502 검증 자동
- [ ] R-6-F/G ChatController 가 ChatService 만 의존 + createSession 노출

### 1.14 Stage 1 보고서

**경로**: `mydocs/working/task_agent-v0.1_6_stage1.md`

내용:
1. R-010 결과
2. 의존성 추가 + 환경변수 + DTO
3. ChatController + ExceptionFilter 코드 요약
4. 단위 테스트 출력
5. R-6-A~I 결정 적용 결과 (Stage 1 영역)
6. 발견·deviation
7. 방법론 평가 메모

---

## Stage 2 — main.ts CORS + ValidationPipe + HTTP e2e (supertest)

**기준 시간**: 35 ± 15분 (R-009)

### 2.1 main.ts 갱신 — `src/main.ts`

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // R-6-C: CORS — 환경변수의 명시 origin list
  const allowedOrigins = config
    .getOrThrow<string>('CORS_ALLOWED_ORIGINS')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false,   // 본 task 미인증 (R-6-I)
  });

  // R-6-B: ValidationPipe 글로벌 — 모든 DTO 자동 검증
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // DTO 외 필드 제거
    forbidNonWhitelisted: true,// 허용 외 필드 시 400
    transform: true,           // class-transformer 자동
  }));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`rhwp-agent-server listening on :${port}`);
}
bootstrap();
```

### 2.2 HTTP e2e 테스트 — `test/chat-http.e2e-spec.ts`

```ts
jest.mock('openai');

import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './../src/chat/openai.factory';
import { AppModule } from './../src/app.module';

describe('ChatController (HTTP e2e, mocked openai)', () => {
  let app: INestApplication;
  let openaiCreate: jest.Mock;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }));
    await app.init();

    const openai = moduleRef.get<OpenAI>(OPENAI_CLIENT);
    openaiCreate = openai.chat.completions.create as unknown as jest.Mock;
  });

  afterEach(async () => {
    await app.close();
  });

  // ── 1. 정상 시나리오
  it('POST /chat/session → 201 + sessionId', async () => {
    const res = await request(app.getHttpServer())
      .post('/chat/session')
      .expect(201);
    expect(res.body.sessionId).toMatch(/^[0-9a-f-]{36}$/);   // UUID
  });

  it('POST /chat/session/:id/messages → 201 + reply', async () => {
    openaiCreate.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'hello!' } }],
    });
    // 1. 세션 발급
    const sessionRes = await request(app.getHttpServer())
      .post('/chat/session')
      .expect(201);
    const sid = sessionRes.body.sessionId;
    // 2. 메시지 전송
    const t0 = Date.now();
    const messageRes = await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'hi' })
      .expect(201);
    const elapsed = Date.now() - t0;
    expect(messageRes.body.reply).toEqual({
      role: 'assistant', content: 'hello!',
    });
    // R-009: mock OpenAI < 500 ± 200 ms
    expect(elapsed).toBeLessThan(700);
  });

  // ── 2. R-6-D 에러 매핑
  it('POST /chat/session/:bad-id/messages → 404 (SessionNotFoundError)', async () => {
    await request(app.getHttpServer())
      .post('/chat/session/non-existent/messages')
      .send({ content: 'x' })
      .expect(404);
  });

  it('OpenAI 에러 → 502', async () => {
    openaiCreate.mockRejectedValueOnce(new Error('upstream rate limit'));
    const sessionRes = await request(app.getHttpServer()).post('/chat/session');
    const sid = sessionRes.body.sessionId;
    await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'x' })
      .expect(502);
  });

  // ── 3. R-6-B DTO 검증
  it('POST /chat/session/:id/messages — content 부재 → 400', async () => {
    const sessionRes = await request(app.getHttpServer()).post('/chat/session');
    const sid = sessionRes.body.sessionId;
    await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({})
      .expect(400);
  });

  it('content max length 초과 → 400 (R-009)', async () => {
    const sessionRes = await request(app.getHttpServer()).post('/chat/session');
    const sid = sessionRes.body.sessionId;
    await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'x'.repeat(13000) })   // > 12000
      .expect(400);
  });

  it('whitelist — DTO 외 필드 → 400', async () => {
    const sessionRes = await request(app.getHttpServer()).post('/chat/session');
    const sid = sessionRes.body.sessionId;
    await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'hi', evil: 'extra' })
      .expect(400);
  });

  // ── 4. R-6-C CORS preflight
  it('OPTIONS /chat/session — preflight 응답 (R-6-C)', async () => {
    const res = await request(app.getHttpServer())
      .options('/chat/session')
      .set('Origin', 'http://localhost:7700')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:7700');
    expect(res.headers['access-control-allow-methods']).toMatch(/POST/);
  });

  it('CORS — 허용 외 Origin 거부 (R-6-C)', async () => {
    const res = await request(app.getHttpServer())
      .options('/chat/session')
      .set('Origin', 'http://evil.example.com')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  // ── 5. 멀티턴 (R-5-D, #5 호환)
  it('두 번째 메시지 — sessionId 재사용', async () => {
    openaiCreate
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: 'r1' } }] })
      .mockResolvedValueOnce({ choices: [{ message: { role: 'assistant', content: 'r2' } }] });
    const sessionRes = await request(app.getHttpServer()).post('/chat/session');
    const sid = sessionRes.body.sessionId;

    const r1 = await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'first' });
    expect(r1.body.reply.content).toBe('r1');

    const r2 = await request(app.getHttpServer())
      .post(`/chat/session/${sid}/messages`)
      .send({ content: 'second' });
    expect(r2.body.reply.content).toBe('r2');

    // 두 번째 호출 시 messages 에 first + r1 + second 포함
    const secondCallMessages = openaiCreate.mock.calls[1][0].messages;
    expect(secondCallMessages.length).toBe(3);
  });
});
```

총 9건의 HTTP e2e (정상 2 + 에러 2 + DTO 검증 3 + CORS 2 + 멀티턴 1).

### 2.3 검증

```bash
cd rhwp-agent-server
npm run build                   # 통과
npm test                        # 단위 (Stage 1 의 +6건 + 기존)
npm run test:e2e                # e2e: 기존 + chat-http 9건
```

### 2.4 Stage 2 종료 체크

- [ ] main.ts 의 `app.enableCors()` + `useGlobalPipes(ValidationPipe)` 등록
- [ ] HTTP e2e 9건 모두 pass
- [ ] R-009 응답시간 mock < 500 ± 200ms 자동 expect
- [ ] R-6-B DTO 검증 (3건) 모두 통과
- [ ] R-6-C CORS preflight + 거부 (2건) 통과
- [ ] R-6-D 에러 매핑 (2건) 통과
- [ ] 기존 e2e (chat / chat-tools / chat-session / config / health) 회귀 0

### 2.5 Stage 2 보고서

**경로**: `mydocs/working/task_agent-v0.1_6_stage2.md`

내용:
1. main.ts diff (CORS + ValidationPipe)
2. HTTP e2e 9건 출력 + 응답시간 측정
3. R-009 / R-6-B / R-6-C / R-6-D 검증 결과
4. 발견·deviation
5. 방법론 평가 메모

---

## Stage 3 — compose 부팅 + 라우트 노출 + CORS preflight 실측

**기준 시간**: 25 ± 10분 (R-009)

### 3.1 compose 통합 검증 (R-013 layer 2)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork

# .env 점검 (CORS_ALLOWED_ORIGINS 추가 반영)
cat rhwp-agent-server/.env

# 빌드·기동
docker compose build agent-server
docker compose up -d agent-server
sleep 5

# 부팅 로그 — ChatController 라우트 노출 확인
docker compose logs agent-server | tail -20
# 기대: 'RoutesResolver ChatController {/chat}' + 'POST /chat/session' + 'POST /chat/session/:id/messages'

# health 정상
curl -s http://localhost:3000/health | jq .

# 라우트 정상
curl -s -X POST http://localhost:3000/chat/session | jq .
# 기대: { "sessionId": "<uuid>" }

# CORS preflight 실측
curl -i -X OPTIONS http://localhost:3000/chat/session \
  -H "Origin: http://localhost:7700" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
# 기대: 204 + Access-Control-Allow-Origin: http://localhost:7700

# 메시지 전송 (실 OpenAI — 옵셔널, OPENAI_API_KEY 사용)
SID=$(curl -s -X POST http://localhost:3000/chat/session | jq -r .sessionId)
curl -s -X POST http://localhost:3000/chat/session/$SID/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "안녕하세요. 짧게 한 문장으로 답해주세요."}' | jq .
# 기대: { "reply": { "role": "assistant", "content": "..." } }

docker compose down
```

### 3.2 부팅 로그 검증 항목

`docker compose logs agent-server` 출력에 다음 포함:
- `ConfigHostModule dependencies initialized`
- `AppModule dependencies initialized`
- `ConfigModule dependencies initialized`
- `SessionModule dependencies initialized`
- `ChatModule dependencies initialized`
- `RoutesResolver HealthController {/health}`
- `RoutesResolver ChatController {/chat}` ← 신규
- `Mapped {/chat/session, POST}` ← 신규
- `Mapped {/chat/session/:id/messages, POST}` ← 신규
- `Nest application successfully started`

### 3.3 환경변수 검증

```bash
docker compose exec agent-server printenv | grep -E "CORS_|SESSION_|OPENAI_"
# 기대: CORS_ALLOWED_ORIGINS=http://localhost:7700,...
```

### 3.4 Stage 3 종료 체크

- [ ] `docker compose build agent-server` 성공
- [ ] `docker compose up -d agent-server` 후 `Up`
- [ ] compose logs 에 ChatController 라우트 매핑 확인
- [ ] `curl /health` 200
- [ ] `curl -X POST /chat/session` 201 + uuid sessionId
- [ ] `curl -X OPTIONS /chat/session -H Origin: http://localhost:7700` 204 + allow-origin 정상
- [ ] (옵셔널, 실 OpenAI) `curl POST /messages` 응답시간 < 15±5초
- [ ] `docker compose down` 정상 정리

### 3.5 Stage 3 보고서

**경로**: `mydocs/working/task_agent-v0.1_6_stage3.md`

내용:
1. compose 빌드·기동 로그
2. ChatController 라우트 매핑 검증
3. CORS preflight 실측 결과
4. 환경변수 주입 결과
5. (옵셔널) 실 OpenAI 응답시간 측정
6. R-013 2단계 검증 사다리 종합 (jest + compose)
7. 방법론 평가 메모

---

## Stage 4 (선택) — rhwp-studio + 실 agent-server 통합 (mock 제거)

**기준 시간**: 30 ± 15분 (R-009)

### 4.1 rhwp-studio 통합 e2e 변형

`rhwp-studio/e2e/agent-real-integration.test.mjs` 신규 — Stage 3 의 mock 가정 제거 + agent-server 실 호출.

```js
// 사전 조건: agent-server 실행 중 (compose 또는 npm run start)
// 사용: cd rhwp-studio && node e2e/agent-real-integration.test.mjs
//       (OPENAI_API_KEY 환경변수 사용 — 실 OpenAI 호출)

import puppeteer from 'puppeteer-core';
// ... 기존 setup 패턴
// 차이: page.setRequestInterception 의 fetch 핸들러가 *agent-server URL 인터셉트 안 함*
//      → 실 fetch → 실 agent-server (port 3000) → 실 OpenAI

// 검증:
// 1. 사이드바 mount 후 메시지 입력 → 실 응답 표시
// 2. R-009 응답시간 < 15 ± 5초 (실 OpenAI)
// 3. 두 번째 메시지 → sessionId 재사용
```

### 4.2 사용 절차

```bash
# Terminal 1: agent-server 띄우기
docker compose up agent-server

# Terminal 2: rhwp-studio dev 서버
cd rhwp-studio && npm run dev

# Terminal 3: 실 통합 e2e
cd rhwp-studio && node e2e/agent-real-integration.test.mjs
```

또는 *Chrome 직접 띄워서 사용자가 시각 확인* (host CDP 모드).

### 4.3 Stage 4 종료 체크 (옵셔널)

- [ ] agent-server 실 실행 + ChatController 라우트 노출
- [ ] rhwp-studio 사이드바 → 메시지 입력 → 실 OpenAI 응답 표시
- [ ] 응답시간 < 15 ± 5초 (R-009 기준 안에서)
- [ ] 두 번째 메시지 sessionId 재사용 검증

---

## 최종 보고서

**경로**: `mydocs/report/task_agent-v0.1_6_report.md`

내용 항목:
1. 요약
2. 변경 파일 목록
3. 통합 검증 결과 (Stage 1·2·3 + 옵셔널 4)
4. 결정 추적 (R-6-A~I → 실제)
5. Deviation 종합
6. 회고 (예상 대비 실제, 재작업, 학습)
7. **방법론 평가 — 6 task 누적 + agent-v0.1 마일스톤 종결 회고**
   - R-014/R-015 세 번째 의무 적용 효과 (#4·#5·#6 트렌드)
   - R-013 backend / frontend 변형 통합 (#5 + 본 task) — R-016 정식화 후보
   - R-017 (가설) — 본가 무수정 정책 변형 패턴 정식화 (#5 자료)
   - 6 task 누적 트렌드 — deviation / 결정 변경 / 시간 / manual 검증 / 재작업
8. 다음 마일스톤 후보 / 후속 task
9. 종료 처리 체크

---

## 커밋 전략

| 커밋 | Stage | 내용 |
|------|-------|------|
| 커밋 1 | Stage 0 | 수행계획서 + 구현계획서 (코드 변경 0) |
| 커밋 2 | Stage 1 | 의존성 추가 + DTO + ChatService.createSession + ChatController + ExceptionFilter + 단위 테스트 + Stage 1 보고서 |
| 커밋 3 | Stage 2 | main.ts CORS + ValidationPipe + HTTP e2e 9건 + Stage 2 보고서 |
| 커밋 4 | Stage 3 | Stage 3 보고서 (compose 검증, 코드 변경 0) |
| 커밋 5 | (선택) Stage 4 | 실 통합 e2e + Stage 4 보고서 |
| 커밋 6 | 최종 | 최종 보고서 + orders + (필요 시) methodology_refinements 갱신 + _NEXT_SESSION.md 갱신 |

커밋 메시지 패턴: `Task #6: <단계 요약>`

---

## 의존성·전제

| 항목 | 상태 | 비고 |
|------|------|------|
| #1~#5 task 완료 | ✅ | local/devel merge 완료 |
| `pkg/` WASM | ✅ (`local/env-pkg-wasm`, 2026-05-01) | rhwp-studio 통합 e2e 영향 |
| 신규 의존성 | class-validator + class-transformer (2개) | 안정 채널 |
| OPENAI_API_KEY | Stage 3 옵셔널 + Stage 4 필수 | mock 만으로도 Stage 1·2 충분 |
| ChatService 의존성 변화 | createSession() 메서드 추가 — 기존 인터페이스 유지 | 백워드 호환 |

## 리스크 (Stage 1 시작 직전)

- **`forbidNonWhitelisted: true` 의 영향**: 기존 e2e 호환 — DTO 외 필드 시 400. 본 task 첫 도입이라 *기존 호출처 0* (ChatController 신규).
- **`APP_FILTER` 글로벌 등록 vs `@UseFilters` Controller 단위**: 글로벌이 더 일관. 본 task 는 ChatModule 의 provider 로 등록 (사실상 글로벌). 다른 controller 영향 0 (HealthController 만 존재).
- **ChatExceptionFilter 의 `@Catch` 매개변수**: SessionNotFoundError, SessionExpiredError, OpenAiError 3종 명시 — 새 도메인 에러 추가 시 filter 갱신 필요. 명시적 trade-off.
- **CORS 의 `credentials: false`**: 본 task 미인증 (R-6-I). 추후 토큰 기반 인증 시 *credentials: true* + cookie 정책 재검토.
- **rhwp-studio 통합 호환성**: #5 의 mock 가정 인터페이스 (`POST /chat/session`, `POST /chat/session/:id/messages`) 정확 일치. Stage 4 (옵셔널) 에서 실 호출 검증.

## 방법론 평가 메모 (구현계획서 차원)

### R-007~R-015 누적 사전 적용 (6번째 task)

본 task 는 R-007 ~ R-015 모두 적용 + R-014/R-015 *세 번째* 의무 적용 사례. 백엔드 마지막 task 라 *5+1 누적 효과 측정* 의 핵심.

| 다듬기 | 본 task 의 측정 항목 |
|--------|---------------------|
| R-007 | class-validator + class-transformer 안정 채널 |
| R-008 | 종료 체크 모두 자동 (jest + supertest + curl) → manual 0 (Stage 4 제외) |
| R-009 | 응답시간 / max length / port — 모두 자동 expect |
| R-010 | NestJS 공식 docs 패턴 4종 — 사전 명시 |
| R-011 | 환경 점검 + #5 e2e 16건 자동 회귀 |
| R-013 | jest + compose backend 표준 |
| R-014 | 이슈 #6 본문 점검표 — 세 번째 의무 적용 |
| R-015 | 9건 결정사항 *반대 입장 근거* 명시 |

### R-014/R-015 효과 측정 (#4·#5·#6 트렌드)

| 측정 항목 | #4 (첫 의무) | #5 (두 번째) | #6 (세 번째, 본 task) |
|----------|------------|------------|------------------|
| 결정 변경 | 0 (9건) | 0 (11건) | ? (9건) |
| 누락 | 0 | 0 | ? |
| 추천 강화 효과 | 측정 안 됨 | R-5-B EventTarget | ? (R-6-B/D/G 후보) |

세 번째 누적 시 *R-014/R-015 의무 효과* 가 *0건 트렌드 강하게 유지* 되는지 회고.

### 마일스톤 종결 시점 정식화 후보

본 task 종료 시점에 다음 정식화 검토 (별도 task 또는 즉시):
- **R-016** — frontend 검증 사다리 (#5 + 본 task 의 backend 일관성)
- **R-017** — 본가 무수정 정책 변형 패턴 (#5 옵션 2 변형 + 메뉴 hook 위임 우회)
- **R-012** — jest manual mock dup 정리 (placeholder 회수)

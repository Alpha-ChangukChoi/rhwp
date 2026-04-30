# [구현계획서] task_agent-v0.1_4 — 멀티턴 세션 히스토리 관리 (in-memory)

- **이슈**: [#4](https://github.com/Alpha-ChangukChoi/rhwp/issues/4)
- **수행계획서**: [task_agent-v0.1_4.md](./task_agent-v0.1_4.md) (작업지시자 승인 완료, 2026-04-30)
- **브랜치**: `local/task4`
- **단계 수**: 3 (본가 절차 최소치)
- **작업 위치**: `/Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/`

---

## 단계 분할 원칙 (R-008 + R-013)

각 stage 종료 체크는 자동 명령. Stage 1·2 는 jest 환경, Stage 3 는 컨테이너 환경 — *2단계 검증 사다리*가 본 task 의 검증 골격.

```
Stage 1: SessionService + 타입 + 에러 + env.schema (자동 단위 테스트로 검증)
   ↓
Stage 2: ChatService.completeInSession + ChatModule 통합 (자동 e2e 모킹)
   ↓
Stage 3: compose 환경 부팅 + SessionModule 정상 DI (R-013 2단계 사다리 마지막 단계)
```

---

## Stage 1 — SessionService + 타입 + 에러 + env.schema + 단위 테스트

**기준 시간**: 35 ± 15분 (R-009)

### 1.0 사전 점검 + R-010 외부 정보 조회

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork
git branch --show-current   # local/task4 확인
node --version              # v22 확인 (crypto.randomUUID 지원)
```

**R-010: 외부 정보 조회 — 본 task 는 표준 라이브러리만 사용**
- `crypto.randomUUID()`: Node 19+ 표준 (Node 22 ✅) — 외부 docs 조회 불필요
- NestJS `@Injectable` 패턴: #2/#3 와 동일 — 추가 조회 불필요
- *fallback 불필요* (외부 docs 차단 무관)

### 1.1 의존성 변경 (R-007)

**신규 의존성 없음**. `crypto.randomUUID()` 는 Node 표준 라이브러리.

### 1.2 환경변수 추가 — `src/config/env.schema.ts`

```ts
import * as Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  OPENAI_API_KEY: Joi.string().required(),
  OPENAI_MODEL: Joi.string().default('gpt-5.4'),
  OPENAI_TIMEOUT_MS: Joi.number().integer().min(1000).default(30000),
  // R-4-I: SessionService 환경변수 (default + 운영 시점 조정 가능)
  SESSION_TTL_MS: Joi.number().integer().min(1000).default(1800000),     // 30분
  SESSION_MAX_HISTORY: Joi.number().integer().min(1).default(50),
});
```

`.env.example` 에 default 명시 추가:

```
SESSION_TTL_MS=1800000
SESSION_MAX_HISTORY=50
```

### 1.3 타입 + 에러 — `src/session/`

**`src/session/session.types.ts`**:

```ts
import { ChatMessage } from '../chat/chat.types';

export type SessionId = string;

export interface Session {
  id: SessionId;
  messages: ChatMessage[];
  createdAt: number;        // ms epoch
  lastAccessedAt: number;   // ms epoch (sliding TTL 기준)
}
```

**`src/session/session.errors.ts`**:

```ts
export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`session not found: ${id}`);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionExpiredError extends Error {
  constructor(id: string) {
    super(`session expired: ${id}`);
    this.name = 'SessionExpiredError';
  }
}
```

### 1.4 SessionService — `src/session/session.service.ts`

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { ChatMessage } from '../chat/chat.types';
import { Session, SessionId } from './session.types';
import { SessionExpiredError, SessionNotFoundError } from './session.errors';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);
  private readonly store = new Map<SessionId, Session>();
  private readonly ttlMs: number;
  private readonly maxHistory: number;

  constructor(config: ConfigService) {
    this.ttlMs = config.getOrThrow<number>('SESSION_TTL_MS');
    this.maxHistory = config.getOrThrow<number>('SESSION_MAX_HISTORY');
  }

  // R-4-B: 서버 자동 발급 (UUID v4)
  // R-4-B 보강: initialMessages 옵셔널 — 후속 #6 에서 externalId 인자 확장 가능
  create(initialMessages: ChatMessage[] = []): SessionId {
    const id = randomUUID();
    const now = Date.now();
    this.store.set(id, {
      id,
      messages: [...initialMessages],
      createdAt: now,
      lastAccessedAt: now,
    });
    this.logger.log(`session created id=${id}`);
    return id;
  }

  // R-4-C: sliding TTL (lastAccessedAt 갱신)
  // R-4-E: expired/없음 → 에러 throw
  // R-4-H: lazy on-access expire 검사
  get(id: SessionId): Session {
    const session = this.store.get(id);
    if (!session) throw new SessionNotFoundError(id);
    if (this.isExpired(session)) {
      this.store.delete(id);
      throw new SessionExpiredError(id);
    }
    session.lastAccessedAt = Date.now();
    return session;
  }

  // append 도 lazy expire 검사 + lastAccessedAt 갱신
  // R-4-F: max history 초과 시 FIFO drop (system 메시지 보존)
  append(id: SessionId, message: ChatMessage): void {
    const session = this.get(id);   // expire 검사 + 갱신 위임
    session.messages.push(message);
    this.enforceMaxHistory(session);
  }

  expire(id: SessionId): void {
    if (!this.store.has(id)) throw new SessionNotFoundError(id);
    this.store.delete(id);
    this.logger.log(`session expired id=${id}`);
  }

  // 테스트용 헬퍼 (size, has)
  size(): number {
    return this.store.size;
  }

  has(id: SessionId): boolean {
    return this.store.has(id);
  }

  private isExpired(session: Session): boolean {
    return Date.now() - session.lastAccessedAt > this.ttlMs;
  }

  // R-4-F: FIFO drop, system 메시지 보존
  private enforceMaxHistory(session: Session): void {
    if (session.messages.length <= this.maxHistory) return;

    const systemMessages = session.messages.filter((m) => m.role === 'system');
    const nonSystem = session.messages.filter((m) => m.role !== 'system');
    const overflow = session.messages.length - this.maxHistory;
    const trimmed = nonSystem.slice(overflow);
    session.messages = [...systemMessages, ...trimmed];
    this.logger.log(
      `session ${session.id} history trimmed: dropped=${overflow}`,
    );
  }
}
```

### 1.5 SessionModule — `src/session/session.module.ts`

```ts
import { Module } from '@nestjs/common';
import { SessionService } from './session.service';

@Module({
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
```

### 1.6 단위 테스트 — `src/session/session.service.spec.ts`

```ts
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import {
  SessionExpiredError,
  SessionNotFoundError,
} from './session.errors';

const buildService = async (overrides: Record<string, unknown> = {}) => {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        ignoreEnvFile: true,
        validate: () => ({
          SESSION_TTL_MS: 1800000,
          SESSION_MAX_HISTORY: 50,
          ...overrides,
        }),
      }),
    ],
    providers: [SessionService],
  }).compile();
  return moduleRef.get(SessionService);
};

describe('SessionService', () => {
  it('create() returns unique sessionId', async () => {
    const service = await buildService();
    const id1 = service.create();
    const id2 = service.create();
    expect(id1).not.toBe(id2);
    expect(service.size()).toBe(2);
  });

  it('create() with initialMessages preserves them', async () => {
    const service = await buildService();
    const id = service.create([{ role: 'system', content: 'be brief' }]);
    expect(service.get(id).messages).toEqual([
      { role: 'system', content: 'be brief' },
    ]);
  });

  it('get() throws SessionNotFoundError for unknown id', async () => {
    const service = await buildService();
    expect(() => service.get('nonexistent')).toThrow(SessionNotFoundError);
  });

  it('append() adds message and updates lastAccessedAt', async () => {
    const service = await buildService();
    const id = service.create();
    service.append(id, { role: 'user', content: 'hi' });
    expect(service.get(id).messages).toHaveLength(1);
  });

  it('expire() removes session', async () => {
    const service = await buildService();
    const id = service.create();
    service.expire(id);
    expect(service.has(id)).toBe(false);
    expect(() => service.get(id)).toThrow(SessionNotFoundError);
  });

  it('expire() throws SessionNotFoundError for unknown id', async () => {
    const service = await buildService();
    expect(() => service.expire('x')).toThrow(SessionNotFoundError);
  });

  it('TTL: get() throws SessionExpiredError after ttl elapsed', async () => {
    const service = await buildService({ SESSION_TTL_MS: 50 });
    const id = service.create();
    await new Promise((r) => setTimeout(r, 80));
    expect(() => service.get(id)).toThrow(SessionExpiredError);
    // expired session is also removed from store
    expect(service.has(id)).toBe(false);
  });

  it('TTL sliding: get() resets ttl, prevent expiry', async () => {
    const service = await buildService({ SESSION_TTL_MS: 100 });
    const id = service.create();
    await new Promise((r) => setTimeout(r, 60));
    service.get(id);   // refresh
    await new Promise((r) => setTimeout(r, 60));
    expect(() => service.get(id)).not.toThrow();   // still alive (60+60=120 > 100, but reset between)
  });

  it('max history: FIFO drop preserves system message', async () => {
    const service = await buildService({ SESSION_MAX_HISTORY: 3 });
    const id = service.create([{ role: 'system', content: 'sys' }]);
    service.append(id, { role: 'user', content: 'u1' });
    service.append(id, { role: 'assistant', content: 'a1' });
    service.append(id, { role: 'user', content: 'u2' });
    service.append(id, { role: 'assistant', content: 'a2' });
    // total 5 messages → 4 over max(3) so 2 non-system dropped
    const msgs = service.get(id).messages;
    expect(msgs.length).toBeLessThanOrEqual(3 + 1); // system 보존 + max 3 non-system
    expect(msgs[0]).toEqual({ role: 'system', content: 'sys' });
    // 가장 오래된 user/assistant 가 drop
    expect(msgs.find((m) => m.content === 'u1')).toBeUndefined();
  });

  it('max history: works with no system message', async () => {
    const service = await buildService({ SESSION_MAX_HISTORY: 2 });
    const id = service.create();
    service.append(id, { role: 'user', content: 'u1' });
    service.append(id, { role: 'assistant', content: 'a1' });
    service.append(id, { role: 'user', content: 'u2' });
    const msgs = service.get(id).messages;
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('a1');
    expect(msgs[1].content).toBe('u2');
  });

  it('append() on expired throws SessionExpiredError', async () => {
    const service = await buildService({ SESSION_TTL_MS: 30 });
    const id = service.create();
    await new Promise((r) => setTimeout(r, 50));
    expect(() => service.append(id, { role: 'user', content: 'x' })).toThrow(
      SessionExpiredError,
    );
  });
});
```

총 11건의 단위 테스트.

### 1.7 검증

```bash
cd rhwp-agent-server
npm run build               # exit 0
npm test                    # 단위: 기존 18 + 신규 11 = 29 passed
```

### 1.8 Stage 1 종료 체크

- [ ] R-010 외부 정보 조회 결과 (본 task: 외부 docs 의존 0 → 자동 통과)
- [ ] `npm run build` exit 0
- [ ] env.schema.ts 에 `SESSION_TTL_MS`, `SESSION_MAX_HISTORY` Joi 검증 추가
- [ ] `.env.example` 에 두 환경변수 default 명시
- [ ] 단위 테스트 신규 11건 모두 pass
- [ ] R-009 수치형 동작이 자동 expect 로 검증됨 (TTL 만료, sliding, FIFO drop)

### 1.9 Stage 1 보고서

**경로**: `mydocs/working/task_agent-v0.1_4_stage1.md`

내용 항목:
1. R-010 결과 (외부 의존 0)
2. env.schema 변경 diff
3. SessionService 코드 요약 + 단위 테스트 출력
4. R-4-A~I 결정 적용 결과 (잠정)
5. 발견·deviation
6. 방법론 평가 메모

---

## Stage 2 — ChatService.completeInSession + 모킹 e2e + ChatModule 통합

**기준 시간**: 50 ± 20분 (R-009)

### 2.1 ChatModule 통합 — `src/chat/chat.module.ts`

```ts
import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { ChatService } from './chat.service';
import { openAiClientProvider } from './openai.factory';
import { ToolExecutor, StubToolExecutor } from './tool-executor';

@Module({
  imports: [SessionModule],
  providers: [
    openAiClientProvider,
    ChatService,
    { provide: ToolExecutor, useClass: StubToolExecutor },
  ],
  exports: [ChatService, ToolExecutor],
})
export class ChatModule {}
```

### 2.2 ChatService.completeInSession — `src/chat/chat.service.ts`

기존 `complete()`, `completeWithTools()` 유지 + 새 메서드 추가:

```ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './openai.factory';
import { OpenAiError } from './chat.errors';
import { ChatMessage } from './chat.types';
import { ToolExecutor } from './tool-executor';
import { TOOLS } from './tools';
import { SessionService } from '../session/session.service';
import { SessionId } from '../session/session.types';

const MAX_ITERATIONS = 5;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly model: string;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    config: ConfigService,
    private readonly toolExecutor: ToolExecutor,
    private readonly sessions: SessionService,   // R-4-G: DI
  ) {
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
  }

  async complete(messages: ChatMessage[]): Promise<ChatMessage> {
    /* 기존 그대로 — 수정 없음 */
  }

  async completeWithTools(messages: ChatMessage[]): Promise<ChatMessage> {
    /* 기존 그대로 — 수정 없음 */
  }

  // 신규: 멀티턴 세션 진입점
  async completeInSession(
    sessionId: SessionId,
    userMessage: ChatMessage,
  ): Promise<ChatMessage> {
    const session = this.sessions.get(sessionId);   // R-4-E: 만료/없음 → 에러
    const startedAt = Date.now();

    // 사용자 메시지 누적 + completeWithTools 호출
    this.sessions.append(sessionId, userMessage);
    const conversation = [...session.messages];   // append 후 최신 상태

    const assistantReply = await this.completeWithTools(conversation);
    this.sessions.append(sessionId, assistantReply);

    const elapsed = Date.now() - startedAt;
    this.logger.log(
      `completeInSession sessionId=${sessionId} historyLen=${conversation.length} elapsed=${elapsed}ms`,
    );
    return assistantReply;
  }
}
```

**주의**: `session.messages` 와 `append` 호출의 순서 — `append` 가 먼저 실행되어 *userMessage 가 누적된 후* 의 messages 를 conversation 에 복사. (위 코드는 이미 그 순서)

### 2.3 단위 테스트 — `src/chat/chat.service.spec.ts` 추가

기존 테스트에 ChatService 의 4번째 dependency (`SessionService`) 가 추가되므로 beforeEach 의 providers 갱신 필요. 테스트 모듈에서 SessionModule 또는 mock SessionService 주입.

```ts
// describe('ChatService', () => {
//   let service: ChatService;
//   let openai: OpenAI;
//   let sessions: SessionService;

//   beforeEach(async () => {
//     const moduleRef = await Test.createTestingModule({
//       imports: [
//         ConfigModule.forRoot({
//           ignoreEnvFile: true,
//           validate: () => ({
//             OPENAI_API_KEY: 'sk-test',
//             OPENAI_MODEL: 'gpt-5.4',
//             OPENAI_TIMEOUT_MS: 5000,
//             SESSION_TTL_MS: 1800000,
//             SESSION_MAX_HISTORY: 50,
//           }),
//         }),
//       ],
//       providers: [
//         openAiClientProvider,
//         ChatService,
//         { provide: ToolExecutor, useClass: StubToolExecutor },
//         SessionService,
//       ],
//     }).compile();
//     service = moduleRef.get(ChatService);
//     openai = moduleRef.get(OPENAI_CLIENT);
//     sessions = moduleRef.get(SessionService);
//   });

describe('completeInSession', () => {
  it('히스토리 누적: 1턴 → 2턴 시 첫 턴 메시지 포함', async () => {
    const create = openai.chat.completions.create as unknown as jest.Mock;
    create
      // 1턴 응답
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'reply 1' } }],
      })
      // 2턴 응답
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'reply 2' } }],
      });

    const sid = sessions.create();
    await service.completeInSession(sid, { role: 'user', content: 'turn 1' });
    await service.completeInSession(sid, { role: 'user', content: 'turn 2' });

    // 두 번째 호출 시 messages 에 [turn 1, reply 1, turn 2] 포함
    const secondCallMessages = create.mock.calls[1][0].messages;
    expect(secondCallMessages).toHaveLength(3);
    expect(secondCallMessages[0]).toEqual({ role: 'user', content: 'turn 1' });
    expect(secondCallMessages[1]).toEqual({
      role: 'assistant',
      content: 'reply 1',
    });
    expect(secondCallMessages[2]).toEqual({ role: 'user', content: 'turn 2' });
  });

  it('expired session → SessionExpiredError', async () => {
    // service 를 짧은 TTL 로 별도 생성 필요 — 또는 ConfigService override
    // (실제 구현 시 별도 buildService(50ms) 헬퍼)
  });

  it('응답시간: 1턴 < 100ms (R-009)', async () => {
    const create = openai.chat.completions.create as unknown as jest.Mock;
    create.mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: 'fast' } }],
    });
    const sid = sessions.create();
    const start = Date.now();
    await service.completeInSession(sid, { role: 'user', content: 'q' });
    expect(Date.now() - start).toBeLessThan(100);
  });
});
```

### 2.4 e2e 테스트 — `test/chat-session.e2e-spec.ts`

```ts
jest.mock('openai');

import { Test } from '@nestjs/testing';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './../src/chat/openai.factory';
import { AppModule } from './../src/app.module';
import { ChatService } from './../src/chat/chat.service';
import { SessionService } from './../src/session/session.service';

describe('ChatService.completeInSession (e2e, mocked openai)', () => {
  it('AppModule 부트스트랩 + 멀티턴 세션 누적', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const chat = moduleRef.get(ChatService);
    const sessions = moduleRef.get(SessionService);
    const openai = moduleRef.get<OpenAI>(OPENAI_CLIENT);
    const create = openai.chat.completions.create as unknown as jest.Mock;
    create
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'first' } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'second' } }],
      });

    const sid = sessions.create();
    const r1 = await chat.completeInSession(sid, {
      role: 'user',
      content: 'a',
    });
    const r2 = await chat.completeInSession(sid, {
      role: 'user',
      content: 'b',
    });

    expect(r1.content).toBe('first');
    expect(r2.content).toBe('second');
    // 누적: [a, first, b, second]
    expect(sessions.get(sid).messages).toHaveLength(4);

    await moduleRef.close();
  });
});
```

### 2.5 검증

```bash
cd rhwp-agent-server
npm run build               # exit 0
npm test                    # 단위: 기존 18 + Stage 1의 11 + Stage 2 신규 = ~32건
npm run test:e2e            # e2e: 기존 6 + chat-session 1 = 7건 (1 skipped 옵셔널)
```

### 2.6 Stage 2 종료 체크

- [ ] `completeInSession` 단위 3건 추가 (히스토리 누적 / expired / 응답시간) 모두 pass
- [ ] e2e 1건 추가 (AppModule + 멀티턴 세션) pass
- [ ] R-009 응답시간 자동 expect: 1턴 < 100ms
- [ ] R-4-G ChatService → SessionService DI 정상
- [ ] ChatModule 의 SessionModule import 정상
- [ ] 기존 e2e (chat, chat-tools, config, health) 회귀 0

### 2.7 Stage 2 보고서

**경로**: `mydocs/working/task_agent-v0.1_4_stage2.md`

내용 항목:
1. ChatService.completeInSession 코드 요약
2. 단위 + e2e 테스트 출력
3. R-4-E (만료 throw) / R-4-F (FIFO drop) / R-4-G (DI) 검증 결과
4. 응답시간 측정 (R-009)
5. 발견·deviation
6. 방법론 평가 메모

---

## Stage 3 — compose 환경 부팅 검증 + 문서 정리

**기준 시간**: 25 ± 10분 (R-009)

### 3.1 compose 통합 검증 (R-013 2단계 검증 사다리)

본 task 의 compose 검증은 *부팅 정상*까지만. 멀티턴 실 동작은 jest 환경에서만.

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork

# .env 점검 (SESSION_* 추가 반영)
cat rhwp-agent-server/.env

# 빌드·기동
docker compose build agent-server
docker compose up -d agent-server
sleep 4

# 부팅 정상 확인
docker compose logs agent-server | tail -15
# 기대: ConfigModule + ChatModule + SessionModule + AppModule 모두 initialized
curl -s http://localhost:3000/health | jq .
# 기대: status:ok JSON

docker compose down
```

### 3.2 부팅 로그 검증

`docker compose logs` 출력에 다음이 포함되어야 함:

- `ConfigHostModule dependencies initialized`
- `AppModule dependencies initialized`
- `ConfigModule dependencies initialized`
- `SessionModule dependencies initialized` ← 신규
- `ChatModule dependencies initialized`
- `RoutesResolver HealthController {/health}`
- `Nest application successfully started`

SessionModule 이 ChatModule 의 의존성으로 정상 등록됐다는 증거.

### 3.3 환경변수 검증

```bash
docker compose exec agent-server printenv | grep SESSION_
# 기대: SESSION_TTL_MS=1800000, SESSION_MAX_HISTORY=50 (compose 의 environment 또는 .env 에서)
```

(만약 compose 가 .env 를 자동 주입하지 않으면 docker-compose.yml 의 environment 섹션 점검 — Stage 3 deviation 후보)

### 3.4 Stage 3 종료 체크

- [ ] `docker compose build agent-server` 성공
- [ ] `docker compose up -d agent-server` 후 `Up` 상태
- [ ] `curl :3000/health` 200 OK
- [ ] compose logs 에 SessionModule + ChatModule initialized 표시
- [ ] `docker compose down` 정상 정리
- [ ] (옵셔널) 컨테이너 환경에 SESSION_* 환경변수 주입 확인

### 3.5 Stage 3 보고서

**경로**: `mydocs/working/task_agent-v0.1_4_stage3.md`

내용 항목:
1. compose 빌드·기동 로그
2. SessionModule + ChatModule 의존성 트리 검증
3. R-013 2단계 검증 사다리 종합
4. 환경변수 주입 검증 결과
5. 방법론 평가 메모

### 3.6 최종 보고서

**경로**: `mydocs/report/task_agent-v0.1_4_report.md`

내용 항목:
1. 요약
2. 변경 파일 목록
3. 통합 검증 결과
4. 결정 추적 (R-4-A~I)
5. Deviation 종합
6. 회고 (예상 대비 실제, 재작업, 학습)
7. **방법론 평가** — R-007~R-015 의 *완전 누적* 사전 적용 결과 (R-014/R-015 의 첫 의무 적용 효과)
8. 다음 이슈 후보 (#5/#6)
9. 종료 처리 체크

### 3.7 커밋 전략

- 커밋 1 (Stage 1): SessionService + 타입 + 에러 + env.schema + 단위 테스트 + Stage 1 보고서 + 수행/구현계획서
- 커밋 2 (Stage 2): ChatService.completeInSession + ChatModule 통합 + 단위·e2e 테스트 + Stage 2 보고서
- 커밋 3 (Stage 3): Stage 3 보고서 (compose 검증 결과만, 코드 수정 없음)
- 커밋 4: 최종 보고서 + orders + (필요 시) methodology_refinements 갱신

커밋 메시지 패턴: `Task #4: <단계 요약>`

---

## 의존성·전제

| 항목 | 상태 | 비고 |
|------|------|------|
| #1 / #2 / #3 task 완료 | ✅ | local/devel merge 완료 |
| 신규 의존성 | 없음 | crypto.randomUUID 표준 라이브러리 |
| OPENAI_API_KEY (실 API 테스트) | 본 task 미사용 | 모킹만 |
| ChatService 의존성 변화 | ToolExecutor + SessionService 추가됨 | 기존 테스트 모듈 갱신 필요 |

## 리스크 (Stage 1 시작 직전)

- **TTL 테스트의 setTimeout 정확도**: jest 의 timer mock 대신 *실제 setTimeout* 사용 — 테스트 머신 부하에 따라 ±10ms 변동 가능. 기준값을 충분히 넓게 (50ms TTL → 80ms 대기) 잡아 안정성 확보
- **max history 시 system 메시지 보존**: 구현이 누락 없도록 단위 테스트로 system 보존 + drop 동시 검증
- **ChatService DI 변화**: 기존 `chat.service.spec.ts` 의 providers 가 SessionService 추가 필요 — 빠뜨리면 e2e 부트스트랩 실패. 사전 점검 필수
- **compose 환경변수 주입**: docker-compose.yml 의 environment 섹션 점검 — SESSION_* 가 자동 주입 안 되면 Stage 3 deviation 후보 (default 값으로 동작 가능하므로 critical 아님)

## 방법론 평가 메모 (구현계획서 차원)

### R-007~R-015 *완전 누적* 사전 적용

본 task 는 R-007 ~ R-015 모두 적용되는 **첫 사례**. #3 의 R-014/R-015 정식화 직후 첫 의무 적용.

| 다듬기 | 본 task 의 측정 항목 |
|--------|---------------------|
| R-007 | 신규 의존성 0 → 안정 채널 충족 자동 |
| R-008 | 종료 체크 모두 자동 명령 → manual 검증 0회 (목표) |
| R-009 | TTL 30분±10분, max history 50±20, 응답시간 < 100ms — 자동 expect |
| R-010 | 외부 docs 의존 0 (표준 라이브러리) → 진행 끊김 0 |
| R-011 | 본 task 시작 전 환경 점검 + 자동 테스트 회귀 통과 |
| R-013 | jest (Stage 1·2) + compose (Stage 3) 2단계 검증 사다리 |
| R-014 | 이슈 #4 본문에 R-007~R-015 점검표 포함 — 첫 의무 적용 |
| R-015 | 수행계획서 §6 의 R-4-A~I 9개 결정사항 모두 *반대 입장 근거* 명시 — 첫 의무 적용 |

### R-014 효과 측정 (본 task 종료 시)

- 작업지시자가 이슈 단계에서 다듬기 적용 *즉시 파악* 가능했는가
- 클로드가 다듬기 적용 시 *놓친 항목* 0건 유지했는가

### R-015 효과 측정 (본 task 종료 시)

- §6 9개 결정사항 중 작업지시자 검증 질문이 *반대 입장 근거 활용* 한 비율
- 추천 변경된 항목 수 (#3 의 R-3-D 처럼)

### R-4-* 결정 9건의 *추천 + 반대 근거* 형식 효과

본 task 에서 *추천 + 이유 + 반대 입장 근거* 의 첫 의무 적용 → 작업지시자가 *9개 결정사항 일괄 검토* 시간 단축 가능성 측정.

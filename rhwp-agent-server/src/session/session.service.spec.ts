import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import {
  SessionExpiredError,
  SessionNotFoundError,
} from './session.errors';

const buildService = async (overrides: Record<string, unknown> = {}) => {
  const values: Record<string, unknown> = {
    SESSION_TTL_MS: 1800000,
    SESSION_MAX_HISTORY: 50,
    ...overrides,
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      SessionService,
      {
        provide: ConfigService,
        useValue: { getOrThrow: (key: string) => values[key] },
      },
    ],
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

  it('append() adds message and reflects on subsequent get()', async () => {
    const service = await buildService();
    const id = service.create();
    service.append(id, { role: 'user', content: 'hi' });
    expect(service.get(id).messages).toHaveLength(1);
    expect(service.get(id).messages[0].content).toBe('hi');
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

  it('TTL: get() throws SessionExpiredError after ttl elapsed (R-009)', async () => {
    const service = await buildService({ SESSION_TTL_MS: 50 });
    const id = service.create();
    await new Promise((r) => setTimeout(r, 80));
    expect(() => service.get(id)).toThrow(SessionExpiredError);
    expect(service.has(id)).toBe(false);
  });

  it('TTL sliding (R-4-C): get() resets ttl', async () => {
    const service = await buildService({ SESSION_TTL_MS: 100 });
    const id = service.create();
    await new Promise((r) => setTimeout(r, 60));
    service.get(id); // refresh lastAccessedAt
    await new Promise((r) => setTimeout(r, 60));
    // 60 + 60 = 120ms > 100ms 이지만 sliding 으로 reset 됐으므로 alive
    expect(() => service.get(id)).not.toThrow();
  });

  it('max history (R-4-F): FIFO drop preserves system message', async () => {
    const service = await buildService({ SESSION_MAX_HISTORY: 3 });
    const id = service.create([{ role: 'system', content: 'sys' }]);
    service.append(id, { role: 'user', content: 'u1' });
    service.append(id, { role: 'assistant', content: 'a1' });
    service.append(id, { role: 'user', content: 'u2' });
    service.append(id, { role: 'assistant', content: 'a2' });
    const msgs = service.get(id).messages;
    // system 1 + non-system trimmed: max 3 → system 1 + non-system 2
    expect(msgs).toHaveLength(3);
    expect(msgs[0]).toEqual({ role: 'system', content: 'sys' });
    // 가장 오래된 user/assistant 가 drop (u1, a1)
    expect(msgs.find((m) => m.content === 'u1')).toBeUndefined();
    expect(msgs.find((m) => m.content === 'a1')).toBeUndefined();
    expect(msgs.find((m) => m.content === 'u2')).toBeDefined();
    expect(msgs.find((m) => m.content === 'a2')).toBeDefined();
  });

  it('max history (R-4-F): works with no system message', async () => {
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

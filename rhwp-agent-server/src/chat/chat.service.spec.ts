jest.mock('openai');

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatService } from './chat.service';
import { OPENAI_CLIENT } from './openai.factory';
import { ToolExecutor, StubToolExecutor } from './tool-executor';
import { SessionService } from '../session/session.service';
import { SessionExpiredError } from '../session/session.errors';

const buildConfig = (overrides: Record<string, unknown> = {}) => {
  const values: Record<string, unknown> = {
    OPENAI_MODEL: 'mock-model',
    SESSION_TTL_MS: 1800000,
    SESSION_MAX_HISTORY: 50,
    ...overrides,
  };
  return { getOrThrow: (key: string) => values[key] };
};

describe('ChatService', () => {
  let service: ChatService;
  let openai: OpenAI;
  let sessions: SessionService;

  beforeEach(async () => {
    openai = new OpenAI({ apiKey: 'sk-test', timeout: 1000 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        SessionService,
        { provide: OPENAI_CLIENT, useValue: openai },
        { provide: ConfigService, useValue: buildConfig() },
        { provide: ToolExecutor, useClass: StubToolExecutor },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
    sessions = moduleRef.get(SessionService);
  });

  // ===== complete() — 기존 3 건 =====

  describe('complete (no tools)', () => {
    it('returns assistant message (R-009: <100ms)', async () => {
      const start = Date.now();
      const result = await service.complete([
        { role: 'user', content: 'hello' },
      ]);
      const elapsed = Date.now() - start;
      expect(result.role).toBe('assistant');
      expect(result.content).toMatch(/mock response to: hello/);
      expect(elapsed).toBeLessThan(100);
    });

    it('throws OpenAiError when choice empty', async () => {
      (openai.chat.completions.create as unknown as jest.Mock).mockResolvedValueOnce(
        { choices: [{ message: { role: 'assistant', content: '' } }] },
      );
      await expect(
        service.complete([{ role: 'user', content: 'x' }]),
      ).rejects.toThrow('empty choice');
    });

    it('wraps unknown error into OpenAiError', async () => {
      (openai.chat.completions.create as unknown as jest.Mock).mockRejectedValueOnce(
        new Error('network down'),
      );
      await expect(
        service.complete([{ role: 'user', content: 'x' }]),
      ).rejects.toThrow('openai chat completions failed');
    });
  });

  // ===== completeWithTools() — 신규 3 건 =====

  describe('completeWithTools', () => {
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
      const elapsed = Date.now() - start;

      expect(result.content).toBe('final answer');
      expect(create).toHaveBeenCalledTimes(2);
      expect(elapsed).toBeLessThan(200);

      // 두 번째 호출 messages 에 tool 결과가 포함되었는지
      const secondCallArgs = create.mock.calls[1][0];
      const toolMsg = secondCallArgs.messages.find(
        (m: any) => m.role === 'tool',
      );
      expect(toolMsg).toBeDefined();
      expect(toolMsg.tool_call_id).toBe('tc1');
      expect(toolMsg.content).toMatch(/stub document text/);
    });

    it('max iterations (5) 초과 시 OpenAiError', async () => {
      const create = openai.chat.completions.create as unknown as jest.Mock;
      // 매 호출 tool_call 만 반환
      create.mockResolvedValue({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'tc-loop',
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
      ).rejects.toThrow(/max iterations \(5\)/);
      expect(create).toHaveBeenCalledTimes(5);
    });

    it('tool 실행 에러는 tool 결과 message 에 반영 (R-3-F)', async () => {
      const create = openai.chat.completions.create as unknown as jest.Mock;
      create
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: 'assistant',
                tool_calls: [
                  {
                    id: 'tc-bad',
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
            {
              message: {
                role: 'assistant',
                content: 'sorry, tool error',
              },
            },
          ],
        });

      const result = await service.completeWithTools([
        { role: 'user', content: 'use unknown' },
      ]);
      expect(result.content).toBe('sorry, tool error');

      const secondCallArgs = create.mock.calls[1][0];
      const toolMsg = secondCallArgs.messages.find(
        (m: any) => m.role === 'tool',
      );
      expect(toolMsg.content).toMatch(/error/);
      expect(toolMsg.content).toMatch(/unknown tool/);
    });
  });

  // ===== completeInSession() — 신규 (R-4-G) =====

  describe('completeInSession', () => {
    it('히스토리 누적: 2턴 시 첫 턴 메시지 포함 (R-4-G)', async () => {
      const create = openai.chat.completions.create as unknown as jest.Mock;
      create
        .mockResolvedValueOnce({
          choices: [{ message: { role: 'assistant', content: 'reply 1' } }],
        })
        .mockResolvedValueOnce({
          choices: [{ message: { role: 'assistant', content: 'reply 2' } }],
        });

      const sid = sessions.create();
      const r1 = await service.completeInSession(sid, {
        role: 'user',
        content: 'turn 1',
      });
      const r2 = await service.completeInSession(sid, {
        role: 'user',
        content: 'turn 2',
      });

      expect(r1.content).toBe('reply 1');
      expect(r2.content).toBe('reply 2');

      // 두 번째 호출 messages 에 첫 턴 누적
      const secondCallMessages = create.mock.calls[1][0].messages;
      expect(secondCallMessages).toEqual([
        { role: 'user', content: 'turn 1' },
        { role: 'assistant', content: 'reply 1' },
        { role: 'user', content: 'turn 2' },
      ]);

      // 세션 누적: [u1, a1, u2, a2]
      expect(sessions.get(sid).messages).toHaveLength(4);
    });

    it('응답시간: 1턴 < 100ms (R-009)', async () => {
      const create = openai.chat.completions.create as unknown as jest.Mock;
      create.mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'fast' } }],
      });

      const sid = sessions.create();
      const start = Date.now();
      await service.completeInSession(sid, {
        role: 'user',
        content: 'q',
      });
      expect(Date.now() - start).toBeLessThan(100);
    });

    it('expired session → SessionExpiredError (R-4-E)', async () => {
      // 짧은 TTL 로 별도 service 생성
      const moduleRef = await Test.createTestingModule({
        providers: [
          ChatService,
          SessionService,
          { provide: OPENAI_CLIENT, useValue: openai },
          {
            provide: ConfigService,
            useValue: buildConfig({ SESSION_TTL_MS: 30 }),
          },
          { provide: ToolExecutor, useClass: StubToolExecutor },
        ],
      }).compile();
      const shortLifeService = moduleRef.get(ChatService);
      const shortLifeSessions = moduleRef.get(SessionService);

      const sid = shortLifeSessions.create();
      await new Promise((r) => setTimeout(r, 50));

      await expect(
        shortLifeService.completeInSession(sid, {
          role: 'user',
          content: 'too late',
        }),
      ).rejects.toThrow(SessionExpiredError);
    });
  });
});

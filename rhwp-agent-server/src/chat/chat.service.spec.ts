jest.mock('openai');

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatService } from './chat.service';
import { OPENAI_CLIENT } from './openai.factory';
import { ToolExecutor, StubToolExecutor } from './tool-executor';

describe('ChatService', () => {
  let service: ChatService;
  let openai: OpenAI;

  beforeEach(async () => {
    openai = new OpenAI({ apiKey: 'sk-test', timeout: 1000 });
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: OPENAI_CLIENT, useValue: openai },
        { provide: ConfigService, useValue: { getOrThrow: () => 'mock-model' } },
        { provide: ToolExecutor, useClass: StubToolExecutor },
      ],
    }).compile();
    service = moduleRef.get(ChatService);
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
});

jest.mock('openai');

import { Test } from '@nestjs/testing';
import OpenAI from 'openai';
import { AppModule } from './../src/app.module';
import { ChatService } from './../src/chat/chat.service';
import { OPENAI_CLIENT } from './../src/chat/openai.factory';

describe('ChatService.completeWithTools (e2e, mocked openai)', () => {
  it('AppModule 부트스트랩 후 tool_calls → stub 실행 → 최종 응답', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const chat = moduleRef.get(ChatService);
    const openai = moduleRef.get<OpenAI>(OPENAI_CLIENT);
    const create = openai.chat.completions.create as unknown as jest.Mock;

    create
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'tc-e2e',
                  type: 'function',
                  function: {
                    name: 'insert_text',
                    arguments: JSON.stringify({
                      position: 0,
                      text: 'hello agent',
                    }),
                  },
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
              content: 'inserted "hello agent" at position 0',
            },
          },
        ],
      });

    const start = Date.now();
    const result = await chat.completeWithTools([
      { role: 'user', content: 'insert hello agent at the start' },
    ]);
    const elapsed = Date.now() - start;

    expect(result.role).toBe('assistant');
    expect(result.content).toMatch(/inserted/);
    expect(create).toHaveBeenCalledTimes(2);
    expect(elapsed).toBeLessThan(500); // R-009: 다단계 < 500ms

    // tool 결과 message 에 StubToolExecutor 의 응답이 포함되었는지
    const secondCallArgs = create.mock.calls[1][0];
    const toolMsg = secondCallArgs.messages.find(
      (m: any) => m.role === 'tool',
    );
    expect(toolMsg).toBeDefined();
    const payload = JSON.parse(toolMsg.content);
    expect(payload).toEqual({ ok: true, inserted_at: 0 });

    await moduleRef.close();
  });
});

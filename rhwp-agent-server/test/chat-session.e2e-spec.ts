jest.mock('openai');

import { Test } from '@nestjs/testing';
import OpenAI from 'openai';
import { AppModule } from './../src/app.module';
import { ChatService } from './../src/chat/chat.service';
import { OPENAI_CLIENT } from './../src/chat/openai.factory';
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
        choices: [{ message: { role: 'assistant', content: 'first reply' } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { role: 'assistant', content: 'second reply' } }],
      });

    const sid = sessions.create();
    const r1 = await chat.completeInSession(sid, {
      role: 'user',
      content: 'turn 1',
    });
    const r2 = await chat.completeInSession(sid, {
      role: 'user',
      content: 'turn 2',
    });

    expect(r1.content).toBe('first reply');
    expect(r2.content).toBe('second reply');

    // 두 번째 호출 시 첫 턴이 history 로 prepend
    const secondCallMessages = create.mock.calls[1][0].messages;
    expect(secondCallMessages).toEqual([
      { role: 'user', content: 'turn 1' },
      { role: 'assistant', content: 'first reply' },
      { role: 'user', content: 'turn 2' },
    ]);

    // 세션 누적: [u1, a1, u2, a2]
    expect(sessions.get(sid).messages).toHaveLength(4);

    await moduleRef.close();
  });
});

import { Test } from '@nestjs/testing';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

describe('ChatController', () => {
  let controller: ChatController;
  let chat: jest.Mocked<Pick<ChatService, 'createSession' | 'completeInSession'>>;

  beforeEach(async () => {
    chat = {
      createSession: jest.fn().mockReturnValue('sid-test-1'),
      completeInSession: jest.fn().mockResolvedValue({
        role: 'assistant',
        content: 'hi reply',
      }),
    } as unknown as jest.Mocked<Pick<ChatService, 'createSession' | 'completeInSession'>>;

    const moduleRef = await Test.createTestingModule({
      controllers: [ChatController],
      providers: [{ provide: ChatService, useValue: chat }],
    }).compile();
    controller = moduleRef.get(ChatController);
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

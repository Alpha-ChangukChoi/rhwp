jest.mock('openai');

import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { ChatService } from './../src/chat/chat.service';

describe('ChatService (e2e, mocked openai)', () => {
  it('AppModule 부트스트랩 후 ChatService.complete() 응답', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const chat = moduleRef.get(ChatService);
    const start = Date.now();
    const result = await chat.complete([
      { role: 'system', content: 'you are a test' },
      { role: 'user', content: 'ping' },
    ]);
    const elapsed = Date.now() - start;

    expect(result.role).toBe('assistant');
    expect(result.content).toMatch(/mock response to: ping/);
    expect(elapsed).toBeLessThan(100);

    await moduleRef.close();
  });
});

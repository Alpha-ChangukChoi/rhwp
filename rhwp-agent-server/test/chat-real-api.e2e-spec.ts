jest.unmock('openai');

import { Test } from '@nestjs/testing';
import { AppModule } from './../src/app.module';
import { ChatService } from './../src/chat/chat.service';

const realKey = process.env.OPENAI_API_KEY;
const isRealApiTest = !!realKey && !realKey.startsWith('sk-test');

const maybe = isRealApiTest ? describe : describe.skip;

maybe('ChatService (real OpenAI API)', () => {
  jest.setTimeout(40_000); // R-009: 30s ± 10s

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

    // eslint-disable-next-line no-console
    console.log(`[real api] elapsed=${elapsed}ms content="${result.content}"`);

    await moduleRef.close();
  });
});

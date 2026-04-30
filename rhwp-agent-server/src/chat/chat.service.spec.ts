jest.mock('openai');

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatService } from './chat.service';
import { OPENAI_CLIENT } from './openai.factory';

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
      ],
    }).compile();
    service = moduleRef.get(ChatService);
  });

  it('complete() returns assistant message (R-009: <100ms)', async () => {
    const start = Date.now();
    const result = await service.complete([
      { role: 'user', content: 'hello' },
    ]);
    const elapsed = Date.now() - start;
    expect(result.role).toBe('assistant');
    expect(result.content).toMatch(/mock response to: hello/);
    expect(elapsed).toBeLessThan(100);
  });

  it('complete() throws OpenAiError when choice empty', async () => {
    (openai.chat.completions.create as unknown as jest.Mock).mockResolvedValueOnce({
      choices: [{ message: { role: 'assistant', content: '' } }],
    });
    await expect(
      service.complete([{ role: 'user', content: 'x' }]),
    ).rejects.toThrow('empty choice');
  });

  it('complete() wraps unknown error into OpenAiError', async () => {
    (openai.chat.completions.create as unknown as jest.Mock).mockRejectedValueOnce(
      new Error('network down'),
    );
    await expect(
      service.complete([{ role: 'user', content: 'x' }]),
    ).rejects.toThrow('openai chat completions failed');
  });
});

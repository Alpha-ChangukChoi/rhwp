import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './openai.factory';
import { OpenAiError } from './chat.errors';
import { ChatMessage } from './chat.types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly model: string;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    config: ConfigService,
  ) {
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
  }

  async complete(messages: ChatMessage[]): Promise<ChatMessage> {
    const startedAt = Date.now();
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages,
      });
      const elapsed = Date.now() - startedAt;
      this.logger.log(
        `chat.completions.create model=${this.model} elapsed=${elapsed}ms`,
      );

      const choice = response.choices?.[0]?.message;
      if (!choice?.content) {
        throw new OpenAiError('empty choice from openai');
      }
      return { role: 'assistant', content: choice.content };
    } catch (err) {
      if (err instanceof OpenAiError) throw err;
      throw new OpenAiError('openai chat completions failed', err);
    }
  }
}

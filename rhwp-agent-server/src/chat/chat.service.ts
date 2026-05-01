import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OPENAI_CLIENT } from './openai.factory';
import { OpenAiError } from './chat.errors';
import { ChatMessage } from './chat.types';
import { ToolExecutor } from './tool-executor';
import { TOOLS } from './tools';
import { SessionService } from '../session/session.service';
import { SessionId } from '../session/session.types';

const MAX_ITERATIONS = 5; // R-3-C, R-009 (±2 → 3~7)

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly model: string;

  constructor(
    @Inject(OPENAI_CLIENT) private readonly openai: OpenAI,
    config: ConfigService,
    private readonly toolExecutor: ToolExecutor,
    private readonly sessions: SessionService,
  ) {
    this.model = config.getOrThrow<string>('OPENAI_MODEL');
  }

  // R-6-G: createSession 노출 — SessionService.create() wrapper.
  // 후속 hook (system prompt 자동 설정 등) 의 자연 진입점.
  createSession(): SessionId {
    return this.sessions.create();
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

  async completeWithTools(messages: ChatMessage[]): Promise<ChatMessage> {
    const conversation: any[] = [...messages];
    const startedAt = Date.now();

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: conversation,
        tools: TOOLS as any,
      });

      const choice = response.choices?.[0]?.message;
      if (!choice) throw new OpenAiError('empty choice');

      // R-3-E: tool_calls 우선 (content 동시 시 무시)
      if (choice.tool_calls && choice.tool_calls.length > 0) {
        conversation.push(choice);

        for (const call of choice.tool_calls) {
          if (call.type !== 'function') continue;
          const name = call.function.name;
          let toolResultPayload: unknown;
          try {
            const args = JSON.parse(call.function.arguments || '{}');
            toolResultPayload = await this.toolExecutor.execute(name, args);
          } catch (err) {
            // R-3-F: 에러를 tool 결과 message 로 반영, 모델이 인지
            toolResultPayload = {
              error: err instanceof Error ? err.message : String(err),
            };
          }
          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify(toolResultPayload),
          });
        }
        continue;
      }

      if (!choice.content) {
        throw new OpenAiError('empty choice content');
      }
      const elapsed = Date.now() - startedAt;
      this.logger.log(
        `completeWithTools iters=${i + 1} elapsed=${elapsed}ms`,
      );
      return { role: 'assistant', content: choice.content };
    }

    // R-3-C: max iterations 초과
    const elapsed = Date.now() - startedAt;
    throw new OpenAiError(
      `max iterations (${MAX_ITERATIONS}) exceeded after ${elapsed}ms`,
    );
  }

  // R-4-G: SessionService 위에 멀티턴 진입점
  async completeInSession(
    sessionId: SessionId,
    userMessage: ChatMessage,
  ): Promise<ChatMessage> {
    const startedAt = Date.now();
    this.sessions.append(sessionId, userMessage);
    const conversation = [...this.sessions.get(sessionId).messages];

    const assistantReply = await this.completeWithTools(conversation);
    this.sessions.append(sessionId, assistantReply);

    const elapsed = Date.now() - startedAt;
    this.logger.log(
      `completeInSession sessionId=${sessionId} historyLen=${conversation.length} elapsed=${elapsed}ms`,
    );
    return assistantReply;
  }
}

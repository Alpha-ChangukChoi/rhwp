import { Body, Controller, Param, Post } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SendMessageDto } from './chat.dto';
import type { ChatMessage } from './chat.types';
import type { SessionId } from '../session/session.types';

/**
 * R-6-A: REST POST 프로토콜.
 * R-6-E: 응답 형식은 #5 mock 가정 그대로 ({ sessionId } / { reply: ChatMessage }).
 * R-6-F: ChatService 만 의존 (단일 의존성).
 */
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  // POST /chat/session — sessionId 발급 (R-6-G)
  @Post('session')
  createSession(): { sessionId: SessionId } {
    const sessionId = this.chat.createSession();
    return { sessionId };
  }

  // POST /chat/session/:id/messages — 메시지 전송 + AI 응답
  @Post('session/:id/messages')
  async sendMessage(
    @Param('id') id: SessionId,
    @Body() dto: SendMessageDto,
  ): Promise<{ reply: ChatMessage }> {
    const userMessage: ChatMessage = { role: 'user', content: dto.content };
    const reply = await this.chat.completeInSession(id, userMessage);
    return { reply };
  }
}

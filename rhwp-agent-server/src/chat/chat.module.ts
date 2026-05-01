import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SessionModule } from '../session/session.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatExceptionFilter } from './chat.exception-filter';
import { openAiClientProvider } from './openai.factory';
import { ToolExecutor, StubToolExecutor } from './tool-executor';

@Module({
  imports: [SessionModule],
  controllers: [ChatController],
  providers: [
    openAiClientProvider,
    ChatService,
    { provide: ToolExecutor, useClass: StubToolExecutor },
    // R-6-D: ExceptionFilter 글로벌 등록 — domain error → HTTP status 변환
    { provide: APP_FILTER, useClass: ChatExceptionFilter },
  ],
  exports: [ChatService, ToolExecutor],
})
export class ChatModule {}

import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { openAiClientProvider } from './openai.factory';
import { ToolExecutor, StubToolExecutor } from './tool-executor';

@Module({
  providers: [
    openAiClientProvider,
    ChatService,
    { provide: ToolExecutor, useClass: StubToolExecutor },
  ],
  exports: [ChatService, ToolExecutor],
})
export class ChatModule {}

import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { ChatService } from './chat.service';
import { openAiClientProvider } from './openai.factory';
import { ToolExecutor, StubToolExecutor } from './tool-executor';

@Module({
  imports: [SessionModule],
  providers: [
    openAiClientProvider,
    ChatService,
    { provide: ToolExecutor, useClass: StubToolExecutor },
  ],
  exports: [ChatService, ToolExecutor],
})
export class ChatModule {}

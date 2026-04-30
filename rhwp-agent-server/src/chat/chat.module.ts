import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { openAiClientProvider } from './openai.factory';

@Module({
  providers: [openAiClientProvider, ChatService],
  exports: [ChatService],
})
export class ChatModule {}

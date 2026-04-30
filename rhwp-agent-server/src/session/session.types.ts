import { ChatMessage } from '../chat/chat.types';

export type SessionId = string;

export interface Session {
  id: SessionId;
  messages: ChatMessage[];
  createdAt: number;
  lastAccessedAt: number;
}

export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
}

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCalls?: ToolCall[];
  toolResult?: ToolResult;
}

export type SessionId = string;

export interface AgentClientConfig {
  baseUrl: string;
  timeoutMs: number;
}

export interface AgentStoreState {
  sessionId: SessionId | null;
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
}

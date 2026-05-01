import type {
  AgentClientConfig,
  ChatMessage,
  SessionId,
} from './types';

const DEFAULT_CONFIG: AgentClientConfig = {
  baseUrl: 'http://localhost:3000',
  timeoutMs: 30000,
};

export class AgentClient {
  private readonly config: AgentClientConfig;

  constructor(config: Partial<AgentClientConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async createSession(): Promise<SessionId> {
    const res = await this.fetchWithTimeout('/chat/session', {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`createSession failed: ${res.status}`);
    }
    const body = (await res.json()) as { sessionId: SessionId };
    return body.sessionId;
  }

  async sendMessage(
    sessionId: SessionId,
    userMessage: string,
  ): Promise<ChatMessage> {
    const path = `/chat/session/${encodeURIComponent(sessionId)}/messages`;
    const res = await this.fetchWithTimeout(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: userMessage }),
    });
    if (!res.ok) {
      throw new Error(`sendMessage failed: ${res.status}`);
    }
    const body = (await res.json()) as { reply: ChatMessage };
    return body.reply;
  }

  private async fetchWithTimeout(
    path: string,
    init: RequestInit,
  ): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.config.timeoutMs);
    try {
      return await fetch(`${this.config.baseUrl}${path}`, {
        ...init,
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

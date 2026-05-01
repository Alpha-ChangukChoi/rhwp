import { AgentClient } from './agent-client';
import type { AgentStoreState, ChatMessage } from './types';

const INITIAL_STATE: AgentStoreState = {
  sessionId: null,
  messages: [],
  pending: false,
  error: null,
};

export class AgentStore extends EventTarget {
  private state: AgentStoreState = { ...INITIAL_STATE };

  constructor(private readonly client: AgentClient) {
    super();
  }

  getState(): Readonly<AgentStoreState> {
    return this.state;
  }

  async send(userMessage: string): Promise<void> {
    if (this.state.pending) return;
    this.update({ pending: true, error: null });

    try {
      let sid = this.state.sessionId;
      if (!sid) {
        sid = await this.client.createSession();
        this.update({ sessionId: sid });
      }

      const userMsg: ChatMessage = { role: 'user', content: userMessage };
      this.update({ messages: [...this.state.messages, userMsg] });

      const reply = await this.client.sendMessage(sid, userMessage);
      this.update({ messages: [...this.state.messages, reply] });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.update({ error: message });
    } finally {
      this.update({ pending: false });
    }
  }

  reset(): void {
    this.state = { ...INITIAL_STATE };
    this.dispatchEvent(new CustomEvent('change'));
  }

  private update(partial: Partial<AgentStoreState>): void {
    this.state = { ...this.state, ...partial };
    this.dispatchEvent(new CustomEvent('change'));
  }
}

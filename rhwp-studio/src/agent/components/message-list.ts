import type { AgentStore } from '../agent-store';
import type { ChatMessage, ToolCall, ToolResult } from '../types';
import { ToolResultCard } from './tool-result-card';

export class MessageList {
  readonly root: HTMLElement;
  private readonly listener: () => void;

  constructor(private readonly store: AgentStore) {
    this.root = document.createElement('div');
    this.root.className = 'agent-message-list';

    this.listener = () => this.render();
    this.store.addEventListener('change', this.listener);
    this.render();
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  unmount(): void {
    this.store.removeEventListener('change', this.listener);
    this.root.remove();
  }

  private render(): void {
    const { messages, error, pending } = this.store.getState();
    this.root.replaceChildren();

    for (const msg of messages) {
      this.root.appendChild(this.renderMessage(msg));
    }

    if (pending) {
      const indicator = document.createElement('div');
      indicator.className = 'agent-message-list__pending';
      indicator.textContent = '응답 생성 중…';
      this.root.appendChild(indicator);
    }

    if (error) {
      const errEl = document.createElement('div');
      errEl.className = 'agent-message-list__error';
      errEl.textContent = `오류: ${error}`;
      this.root.appendChild(errEl);
    }
  }

  private renderMessage(msg: ChatMessage): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = `agent-message agent-message--${msg.role}`;
    wrapper.dataset.role = msg.role;

    if (msg.content) {
      const text = document.createElement('div');
      text.className = 'agent-message__text';
      text.textContent = msg.content;
      wrapper.appendChild(text);
    }

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      const tools = document.createElement('div');
      tools.className = 'agent-message__tools';
      for (const call of msg.toolCalls) {
        const result = MessageList.findResult(this.store.getState().messages, call);
        new ToolResultCard(call, result).mount(tools);
      }
      wrapper.appendChild(tools);
    }

    return wrapper;
  }

  private static findResult(
    messages: ChatMessage[],
    call: ToolCall,
  ): ToolResult | undefined {
    for (const m of messages) {
      if (m.toolResult && m.toolResult.toolCallId === call.id) {
        return m.toolResult;
      }
    }
    return undefined;
  }
}

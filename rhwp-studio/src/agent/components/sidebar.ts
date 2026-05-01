import type { AgentStore } from '../agent-store';
import { ChatInput } from './chat-input';
import { MessageList } from './message-list';

export class AgentSidebar {
  readonly root: HTMLElement;
  private readonly chatInput: ChatInput;
  private readonly messageList: MessageList;

  constructor(private readonly store: AgentStore) {
    this.root = document.createElement('aside');
    this.root.id = 'agent-sidebar';
    this.root.dataset.open = 'false';
    this.root.setAttribute('aria-label', 'AI 채팅');

    const header = document.createElement('header');
    header.className = 'agent-sidebar__header';
    header.textContent = 'AI 채팅';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'agent-sidebar__close';
    closeBtn.setAttribute('aria-label', '닫기');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);

    const messageContainer = document.createElement('div');
    messageContainer.className = 'agent-sidebar__messages';

    this.messageList = new MessageList(store);
    this.messageList.mount(messageContainer);

    const inputContainer = document.createElement('div');
    inputContainer.className = 'agent-sidebar__input';

    this.chatInput = new ChatInput((msg) => {
      void store.send(msg);
    });
    this.chatInput.mount(inputContainer);

    this.root.appendChild(header);
    this.root.appendChild(messageContainer);
    this.root.appendChild(inputContainer);

    store.addEventListener('change', () => {
      this.chatInput.setDisabled(store.getState().pending);
    });
  }

  mount(parent: HTMLElement = document.body): void {
    parent.appendChild(this.root);
  }

  unmount(): void {
    this.messageList.unmount();
    this.root.remove();
  }

  isOpen(): boolean {
    return this.root.dataset.open === 'true';
  }

  open(): void {
    this.root.dataset.open = 'true';
    this.chatInput.focus();
  }

  close(): void {
    this.root.dataset.open = 'false';
  }

  toggle(): void {
    if (this.isOpen()) this.close();
    else this.open();
  }
}

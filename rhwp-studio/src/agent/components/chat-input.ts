export const CHAT_INPUT_MAX_LENGTH = 10000;

export class ChatInput {
  readonly root: HTMLElement;
  private readonly textarea: HTMLTextAreaElement;
  private readonly button: HTMLButtonElement;

  constructor(private readonly onSend: (msg: string) => void) {
    this.root = document.createElement('div');
    this.root.className = 'agent-chat-input';

    this.textarea = document.createElement('textarea');
    this.textarea.className = 'agent-chat-input__textarea';
    this.textarea.maxLength = CHAT_INPUT_MAX_LENGTH;
    this.textarea.placeholder = '메시지를 입력하세요…';
    this.textarea.rows = 3;

    this.button = document.createElement('button');
    this.button.className = 'agent-chat-input__send';
    this.button.type = 'button';
    this.button.textContent = '전송';

    this.button.addEventListener('click', () => this.handleSend());
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    this.root.appendChild(this.textarea);
    this.root.appendChild(this.button);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  setDisabled(disabled: boolean): void {
    this.textarea.disabled = disabled;
    this.button.disabled = disabled;
  }

  focus(): void {
    this.textarea.focus();
  }

  private handleSend(): void {
    const msg = this.textarea.value.trim();
    if (!msg) return;
    this.onSend(msg);
    this.textarea.value = '';
  }
}

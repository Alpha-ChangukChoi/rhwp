import type { ToolCall, ToolResult } from '../types';

export class ToolResultCard {
  readonly root: HTMLElement;

  constructor(call: ToolCall, result?: ToolResult) {
    this.root = document.createElement('details');
    this.root.className = 'agent-tool-card';
    this.root.dataset.toolCallId = call.id;

    const summary = document.createElement('summary');
    summary.className = 'agent-tool-card__summary';

    const name = document.createElement('span');
    name.className = 'agent-tool-card__name';
    name.textContent = call.name;

    const args = document.createElement('span');
    args.className = 'agent-tool-card__args';
    args.textContent = ToolResultCard.formatArgs(call.args);

    summary.appendChild(name);
    summary.appendChild(args);
    this.root.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'agent-tool-card__body';
    if (result) {
      body.textContent = ToolResultCard.formatResult(result.result);
    } else {
      body.textContent = '(결과 대기 중)';
      body.classList.add('agent-tool-card__body--pending');
    }
    this.root.appendChild(body);
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.root);
  }

  private static formatArgs(args: unknown): string {
    try {
      const json = JSON.stringify(args);
      if (!json) return '';
      return json.length > 80 ? json.slice(0, 77) + '…' : json;
    } catch {
      return String(args);
    }
  }

  private static formatResult(result: unknown): string {
    try {
      return JSON.stringify(result, null, 2);
    } catch {
      return String(result);
    }
  }
}

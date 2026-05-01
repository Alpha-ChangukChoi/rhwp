import './agent.css';
import { AgentClient } from './agent-client';
import { AgentStore } from './agent-store';
import { AgentSidebar } from './components/sidebar';

let mounted: AgentSidebar | null = null;

export function mountAgentSidebar(): AgentSidebar {
  if (mounted) return mounted;

  const client = new AgentClient();
  const store = new AgentStore(client);
  const sidebar = new AgentSidebar(store);
  sidebar.mount();
  hookMenuToggle(sidebar);
  mounted = sidebar;
  return sidebar;
}

function hookMenuToggle(sidebar: AgentSidebar): void {
  const viewMenu = document.querySelector(
    '[data-menu="view"] .menu-dropdown',
  );
  if (!viewMenu) return;

  const sep = document.createElement('div');
  sep.className = 'md-sep';

  const item = document.createElement('div');
  item.className = 'md-item agent-menu-item';
  const icon = document.createElement('span');
  icon.className = 'md-icon';
  const label = document.createElement('span');
  label.className = 'md-label';
  label.textContent = 'AI 채팅';
  item.appendChild(icon);
  item.appendChild(label);
  item.addEventListener('click', () => sidebar.toggle());

  viewMenu.appendChild(sep);
  viewMenu.appendChild(item);
}

export { AgentClient, AgentStore, AgentSidebar };

# [구현계획서] task_agent-v0.1_5 — rhwp-studio 우측 사이드바 채팅 UI

- **이슈**: [#5](https://github.com/Alpha-ChangukChoi/rhwp/issues/5)
- **수행계획서**: [task_agent-v0.1_5.md](./task_agent-v0.1_5.md) (R-5-K 보강 + R-001 (b) 재승인 대기, 2026-05-01)
- **브랜치**: `local/task5`
- **단계 수**: 3 (본행) + 1 (옵셔널)
- **작업 위치**: `/Users/a111-04-2402-01/Desktop/open-source/rhwp-fork/`

---

## 단계 분할 원칙 (R-008 + R-013 frontend 변형)

각 stage 종료 체크는 자동 명령. 본 task 는 **R-013 layer 1·2 모두 puppeteer** (R-5-K 결정) — *동일 인프라* 에서 *mount 범위* 만 다름.

```
Stage 0: 사전 점검 — agent-server 인터페이스 재확인 + #6 미등록 확인 + 본가 무수정 정책 재점검
   ↓
Stage 1: agent-client + agent-store + puppeteer 격리 컴포넌트 테스트 (R-013 layer 1 frontend 변형)
   ↓
Stage 2: UI 컴포넌트 (Sidebar / ChatInput / MessageList / ToolResultCard) + puppeteer DOM 어설션
   ↓
Stage 3: main.ts 진입점 통합 + Vite preview + 통합 e2e + PWA SW 점검 (R-013 layer 2 — production 정합성)
   ↓
Stage 4 (선택): 실 agent-server CDP 수동 점검 (OPENAI_API_KEY 필요)
```

**검증 방식 분리**:
- **layer 1 (단위 격리)**: `vite dev` + puppeteer 가 *단일 컴포넌트 mount* HTML 페이지 로드 + DOM 어설션 + mocked fetch 인터셉트
- **layer 2 (통합 production)**: `vite build && vite preview` + puppeteer 가 *실제 main.ts 진입점* 로드 + 사이드바 toggle + mocked fetch 인터셉트 + PWA SW 점검

---

## Stage 0 — 사전 점검 (코드 변경 없음)

**기준 시간**: 15 ± 10분 (R-009)

### 0.1 agent-server 인터페이스 재확인 (R-5-D)

```bash
cd /Users/a111-04-2402-01/Desktop/open-source/rhwp-fork
grep -n "completeInSession\|create\|append" rhwp-agent-server/src/chat/chat.service.ts \
  rhwp-agent-server/src/session/session.service.ts | head -30
```

**확인 사항** (이미 본 task 진입 시 R-010 결과 일부 확인됨):

| 항목 | 현재 상태 | 본 task 영향 |
|------|---------|-----------|
| `ChatService.completeInSession(sessionId, userMessage)` | sessionId *반드시* 기존 유효 | 클라이언트가 *별도 create()* 호출 필요 |
| `SessionService.create(initialMessages?)` | sessionId 자동 발급 (UUID), 외부 인자 *비수용* | *서버 자동 발급* 만 가능 (R-5-D 추천 강제) |
| HTTP endpoint | **부재** — NestJS CLI 만 활성 | *#6 영역* — 본 task 는 mock 으로 진행 |

### 0.2 #6 마일스톤 등록 상태 (R-5-J)

```bash
gh issue list --repo Alpha-ChangukChoi/rhwp --milestone "agent-v0.1" --state all --json number,title,state
```

**확인 결과** (사전 조사):

- 마일스톤 진행률 표기: *4/6 closed* — 6개 중 미등록 1개
- 등록된 5개: #1~#5 (#1~#4 closed, #5 open)
- **#6 (또는 #7) 은 미등록** — agent-v0.1 마일스톤 *마지막 task*

### 0.3 본 task 의 mock 가정 결정 (R-5-J 보강)

**결정**: 본 task 는 **agent-server HTTP endpoint 가정** 으로 mock 진행. 가정 인터페이스:

```
POST /chat/session                  → { sessionId: string }       (세션 생성)
POST /chat/session/:id/messages     → { reply: ChatMessage }     (메시지 전송)
```

- 위 인터페이스는 **#6 등록 시 확정** — 본 task 는 인터페이스 가정만, 실 구현 0
- agent-client.ts 가 실 fetch 호출하지만 Stage 1~3 의 puppeteer 테스트는 모두 *mocked fetch* (page.route 로 인터셉트)
- Stage 4 옵셔널 — 실 agent-server 연결 시 *임시 HTTP wrapper 스크립트* 별도 작성 (본 task 산출물 외)

### 0.4 본가 무수정 정책 재점검

```bash
git diff local/devel..HEAD --stat   # 본 task 진입 후 누적 변경
ls rhwp-studio/src/agent/ 2>/dev/null && echo "exists" || echo "신규 필요"
```

본 task 변경 영역 (예상):

- 신규: `rhwp-studio/src/agent/` (옵션 2 변형 영역)
- 신규: `rhwp-studio/e2e/agent-component.test.mjs`
- 신규: `rhwp-studio/e2e/agent-integration.test.mjs`
- 수정: `rhwp-studio/src/main.ts` (진입점 1~2줄, 분리 커밋)
- 수정 (선택): `rhwp-studio/index.html` 또는 `rhwp-studio/src/style.css` — 사이드바 컨테이너 슬롯 시 (가능한 한 회피)

본가 다른 영역 (`src/` Rust, `rhwp-chrome/`, `rhwp-firefox/`, `rhwp-safari/`, `rhwp-vscode/`, `rhwp-shared/`) 무수정 유지.

### 0.5 Stage 0 종료 체크

- [ ] `completeInSession()` 시그니처 재확인 결과 — sessionId 자동 발급 만 (R-5-D 추천 유지)
- [ ] HTTP endpoint 부재 확인 + mock 가정 인터페이스 명시
- [ ] #6 미등록 확인 + 본 task 종료 시 *#6 등록 추천* 으로 보고 (작업지시자 결정 사항)
- [ ] 본가 무수정 정책 변경 영역 5건 사전 명시 (본가 위반 0)

### 0.6 Stage 0 보고서

**경로**: `mydocs/working/task_agent-v0.1_5_stage0.md`

내용 항목 (간결):
1. agent-server 인터페이스 재확인 결과
2. #6 미등록 + mock 가정 인터페이스
3. 본가 무수정 정책 재점검
4. Stage 1 진입 가능 여부 판단

---

## Stage 1 — agent-client + agent-store + 격리 puppeteer 테스트

**기준 시간**: 50 ± 25분 (R-009)

### 1.1 R-010 외부 정보 조회 결과 정리

본 task 의 외부 docs 의존:

| 항목 | 출처 | fallback |
|------|------|----------|
| `crypto.randomUUID()` (브라우저) | MDN — Chrome 92+ | 사용자 환경 = 최신 Chrome (보장) |
| `EventTarget` API (R-5-B) | MDN — 브라우저 표준 | 사용자 환경 보장 |
| `fetch` API + AbortController | MDN — 브라우저 표준 | 사용자 환경 보장 |
| Vite alias `@/...` | rhwp-studio/vite.config (이미 정의) | 신규 코드 사용 가능 |
| TypeScript ^6.0.3 | rhwp-studio/package.json | `tsc && vite build` 통과 필수 |

R-010 결과: **외부 docs 차단 시 영향 0** (모두 표준 라이브러리 + 기존 rhwp-studio 인프라).

### 1.2 의존성 변경 (R-007)

**신규 의존성 0** (R-5-K 결정 — puppeteer-only).

### 1.3 `rhwp-studio/src/agent/types.ts`

```ts
export type ChatRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  // tool 호출/결과 (선택) — #3 의 도구 호출 시각화용
  toolCalls?: Array<{
    id: string;
    name: string;
    args: unknown;
  }>;
  toolResult?: {
    toolCallId: string;
    result: unknown;
  };
}

export type SessionId = string;

export interface AgentClientConfig {
  baseUrl: string;       // 기본 'http://localhost:3000'
  timeoutMs: number;     // 기본 30000
}
```

### 1.4 `rhwp-studio/src/agent/agent-client.ts` (R-5-I 채택안)

```ts
import type { ChatMessage, SessionId, AgentClientConfig } from './types';

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
    if (!res.ok) throw new Error(`createSession failed: ${res.status}`);
    const body = await res.json() as { sessionId: SessionId };
    return body.sessionId;
  }

  async sendMessage(
    sessionId: SessionId,
    userMessage: string,
  ): Promise<ChatMessage> {
    const res = await this.fetchWithTimeout(
      `/chat/session/${encodeURIComponent(sessionId)}/messages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: userMessage }),
      },
    );
    if (!res.ok) throw new Error(`sendMessage failed: ${res.status}`);
    const body = await res.json() as { reply: ChatMessage };
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
```

### 1.5 `rhwp-studio/src/agent/agent-store.ts` (R-5-B EventTarget 패턴)

```ts
import type { ChatMessage, SessionId } from './types';
import { AgentClient } from './agent-client';

interface AgentStoreState {
  sessionId: SessionId | null;
  messages: ChatMessage[];
  pending: boolean;
  error: string | null;
}

export class AgentStore extends EventTarget {
  private state: AgentStoreState = {
    sessionId: null,
    messages: [],
    pending: false,
    error: null,
  };

  constructor(private readonly client: AgentClient) {
    super();
  }

  getState(): Readonly<AgentStoreState> {
    return this.state;
  }

  // R-5-C: 첫 메시지 전송 시 sessionId 발급
  async send(userMessage: string): Promise<void> {
    if (this.state.pending) return;   // 동시성 가드
    this.update({ pending: true, error: null });

    try {
      let sid = this.state.sessionId;
      if (!sid) {
        sid = await this.client.createSession();
        this.update({ sessionId: sid });
      }

      // 사용자 메시지 즉시 표시
      const userMsg: ChatMessage = { role: 'user', content: userMessage };
      this.update({ messages: [...this.state.messages, userMsg] });

      const reply = await this.client.sendMessage(sid, userMessage);
      this.update({ messages: [...this.state.messages, reply] });
    } catch (err) {
      this.update({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      this.update({ pending: false });
    }
  }

  reset(): void {
    this.state = { sessionId: null, messages: [], pending: false, error: null };
    this.dispatchEvent(new CustomEvent('change'));
  }

  private update(partial: Partial<AgentStoreState>): void {
    this.state = { ...this.state, ...partial };
    this.dispatchEvent(new CustomEvent('change'));
  }
}
```

**R-5-B self-check**: EventTarget 채택. *module singleton + 직접 함수 호출* 단순화 가능성 검토 결과 — *4개 컴포넌트가 동일 상태 구독* 시나리오에서 EventTarget 의 *변경 broadcast* 가 코드량 절감. 단, 컴포넌트 간 직접 의존이 *2개 이하* 로 줄면 module singleton 으로 *1차 단순화* 가능 (Stage 2 진행 후 재평가).

### 1.6 mount 헬퍼 — `rhwp-studio/src/agent/__mount__.ts` (테스트 전용)

격리 puppeteer 테스트가 단일 컴포넌트만 mount 하기 위한 진입점. Stage 1 에서는 *agent-client 만 expose*, Stage 2 에서 컴포넌트 mount 추가.

```ts
// __mount__.ts — Vite dev 가 이 파일을 진입점으로 격리 페이지 (e2e/agent-mount.html) 에서 로드
import { AgentClient } from './agent-client';
import { AgentStore } from './agent-store';

declare global {
  interface Window {
    __agent: {
      AgentClient: typeof AgentClient;
      AgentStore: typeof AgentStore;
    };
  }
}

window.__agent = { AgentClient, AgentStore };
```

### 1.7 격리 mount 페이지 — `rhwp-studio/e2e/agent-mount.html`

```html
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>agent mount</title></head>
<body><script type="module" src="/src/agent/__mount__.ts"></script></body>
</html>
```

Vite dev 가 자동으로 `e2e/agent-mount.html` 을 서빙 (Vite multi-entry — `vite.config` 수정 필요 시 점검). 또는 `public/agent-mount.html` 로 두면 정적 자원으로 서빙.

**점검 사항**: Vite 의 multi-page 설정. `rhwp-studio/vite.config.ts` 에서 `build.rollupOptions.input` 에 추가 entry 가 정의되어 있는지 확인. 없으면 `agent-mount.html` 만 dev 모드에서 직접 접근 (build 시 미포함). Stage 1 진입 시 vite.config 점검 → 필요 시 추가 (이는 *본가 무수정 정책 위반 후보* — main.ts 1~2줄 외 또 다른 본가 영역. **주의**).

**대안 (위반 회피)**: agent-mount.html 을 `rhwp-studio/src/agent/` 하위로 두고 *Vite dev 의 임의 경로 서빙* 활용 — `http://localhost:5173/src/agent/__mount__.ts` 직접 import 후 puppeteer 가 동적 HTML 생성. 

**최종 채택**: puppeteer 의 `page.setContent()` 로 *HTML 동적 주입* — Vite dev 의 정적 자원 의존 0 + 본가 vite.config 무수정. 단, ES module import 가 *부모 origin* 에서만 가능 → puppeteer 가 `http://localhost:5173/__nothing__` 같은 경로에서 setContent 후 module import 가능 (Vite 가 모든 경로 fallback 처리).

### 1.8 puppeteer 격리 테스트 — `rhwp-studio/e2e/agent-component.test.mjs`

```js
/**
 * R-013 layer 1 (frontend 변형) — agent-client + agent-store 격리 테스트
 */
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';

const VITE_PORT = 7700;

async function startVite() {
  const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', String(VITE_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // 부팅 대기 — Vite 가 'Local:' 출력 시까지
  await new Promise((resolve) => {
    child.stdout.on('data', (b) => {
      if (b.toString().includes('Local:')) resolve();
    });
  });
  return child;
}

async function getBrowser() {
  // host CDP 모드 (mode=host) 또는 headless
  const useHost = process.argv.includes('--mode=host');
  if (useHost) {
    return puppeteer.connect({
      browserURL: 'http://localhost:9222',
      defaultViewport: null,
    });
  }
  return puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
}

const HTML = `<!DOCTYPE html><html><body>
<script type="module">
  import { AgentClient } from '/src/agent/agent-client.ts';
  import { AgentStore } from '/src/agent/agent-store.ts';
  window.__agent = { AgentClient, AgentStore };
</script>
</body></html>`;

async function runTest(name, fn) {
  console.log(`▶ ${name}`);
  try { await fn(); console.log(`  ✓ pass`); }
  catch (e) { console.error(`  ✗ ${e.message}`); process.exit(1); }
}

const vite = await startVite();
const browser = await getBrowser();

try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${VITE_PORT}/__init__`);  // Vite fallback
  await page.setContent(HTML);
  await page.waitForFunction(() => !!window.__agent, { timeout: 5000 });

  await runTest('AgentClient.createSession() POST /chat/session 호출', async () => {
    await page.setRequestInterception(true);
    const handler = (req) => {
      if (req.url().endsWith('/chat/session')) {
        req.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ sessionId: 'sid-123' }),
        });
      } else req.continue();
    };
    page.on('request', handler);

    const sid = await page.evaluate(async () => {
      const c = new window.__agent.AgentClient({ baseUrl: 'http://localhost:3000' });
      return c.createSession();
    });
    if (sid !== 'sid-123') throw new Error(`expected sid-123, got ${sid}`);

    page.off('request', handler);
    await page.setRequestInterception(false);
  });

  await runTest('AgentStore.send() — 첫 메시지 시 createSession + sendMessage 순차 호출', async () => {
    /* 위와 유사 구조: page.route 로 두 endpoint 응답 → store.send() 호출 후 state 어설션 */
    /* 응답시간 < 5초 ± 2초 (R-009 기준) */
  });

  await runTest('AgentStore.send() — pending 중 재호출 시 무시 (동시성 가드)', async () => { /* ... */ });

  await runTest('AgentClient — fetch 타임아웃 30초 (R-009)', async () => { /* AbortController 검증 */ });

} finally {
  await browser.close();
  vite.kill('SIGTERM');
}
```

**총 4건의 격리 테스트** (Stage 1 분).

### 1.9 main.ts 진입점 *미수정* (Stage 3 에서)

Stage 1 시점에 main.ts 변경 0. *agent-client + agent-store 만* 격리 검증.

### 1.10 검증

```bash
cd rhwp-studio
npm run build           # tsc + vite build 통과 (신규 agent/* 가 컴파일 에러 없음)
node e2e/agent-component.test.mjs   # 4건 격리 테스트 pass
```

### 1.11 Stage 1 종료 체크

- [ ] R-010 외부 docs 의존 0 자동 통과
- [ ] `tsc && vite build` exit 0 (신규 agent/* 가 빌드 통과)
- [ ] puppeteer 격리 4건 모두 pass
- [ ] R-009 응답시간 자동 어설션 (mock 응답 < 5초 ± 2초)
- [ ] AgentStore의 EventTarget 동작 검증 (change 이벤트 dispatch)
- [ ] R-5-B 재평가 (EventTarget 유지 vs. module singleton 단순화) — Stage 1 종료 시 보고서에 명시

### 1.12 Stage 1 보고서

**경로**: `mydocs/working/task_agent-v0.1_5_stage1.md`

내용 항목:
1. R-010 결과 (외부 의존 0)
2. agent-client + agent-store 코드 요약
3. puppeteer 격리 4건 출력 + 응답시간 측정
4. R-5-B 재평가 결과
5. 발견·deviation
6. 방법론 평가 메모

---

## Stage 2 — UI 컴포넌트 + DOM 격리 puppeteer 테스트

**기준 시간**: 70 ± 30분 (R-009)

### 2.1 UI 컴포넌트 — `rhwp-studio/src/agent/components/`

| 파일 | 책임 |
|------|------|
| `sidebar.ts` | 사이드바 컨테이너 + toggle 동작 (메뉴바 보기 메뉴 hook은 Stage 3) |
| `chat-input.ts` | 메시지 입력창 (max length 10000 ± 2000자, R-009) |
| `message-list.ts` | 메시지 누적 표시 (사용자/AI 구분, AgentStore 'change' 구독) |
| `tool-result-card.ts` | 도구 호출 결과 시각화 — collapsible card (R-5-E) |

각 컴포넌트는 *vanilla DOM API* (R-5-A 채택). 클래스 형태 + `mount(parent: HTMLElement)` + `unmount()` 인터페이스 통일.

**예시 — `chat-input.ts`**:

```ts
const MAX_LENGTH = 10000;

export class ChatInput {
  private readonly textarea: HTMLTextAreaElement;
  private readonly button: HTMLButtonElement;

  constructor(private readonly onSend: (msg: string) => void) {
    this.textarea = document.createElement('textarea');
    this.textarea.maxLength = MAX_LENGTH;   // R-009: 10000 ± 2000
    this.textarea.placeholder = '메시지를 입력하세요…';

    this.button = document.createElement('button');
    this.button.textContent = '전송';
    this.button.addEventListener('click', () => this.handleSend());
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  mount(parent: HTMLElement): void {
    parent.appendChild(this.textarea);
    parent.appendChild(this.button);
  }

  setDisabled(disabled: boolean): void {
    this.textarea.disabled = disabled;
    this.button.disabled = disabled;
  }

  private handleSend(): void {
    const msg = this.textarea.value.trim();
    if (!msg) return;
    this.onSend(msg);
    this.textarea.value = '';
  }
}
```

(다른 컴포넌트는 보고서 단계 산출.)

### 2.2 sidebar.ts — 본가 무수정 정책 영향 점검

사이드바 컨테이너는 *body 의 직속 자식* 으로 mount. *기존 `#studio-root` 내부 변경 0*.

```ts
export class AgentSidebar {
  private readonly root: HTMLElement;
  private readonly chatInput: ChatInput;
  private readonly messageList: MessageList;
  // ...

  constructor(store: AgentStore) {
    this.root = document.createElement('aside');
    this.root.id = 'agent-sidebar';
    this.root.dataset.open = 'false';   // R-5-H: 기본 닫힘
    // ...
  }

  mount(): void {
    document.body.appendChild(this.root);   // 본가 #studio-root 무영향
  }

  toggle(): void {
    const cur = this.root.dataset.open === 'true';
    this.root.dataset.open = String(!cur);
  }
}
```

### 2.3 agent.css

`#agent-sidebar` 가 `position: fixed; right: 0; width: 360px; ...` (R-009: 360 ± 60px). `[data-open="false"]` 시 `transform: translateX(100%)`.

```css
#agent-sidebar {
  position: fixed;
  right: 0; top: 0; bottom: 0;
  width: 360px;            /* R-009: 360 ± 60 */
  background: #fff;
  border-left: 1px solid #ddd;
  transform: translateX(0);
  transition: transform 200ms ease;
  z-index: 50;
}
#agent-sidebar[data-open="false"] {
  transform: translateX(100%);
}
```

### 2.4 격리 puppeteer 테스트 — `rhwp-studio/e2e/agent-component.test.mjs` 추가

Stage 1 의 mount 패턴 그대로 + 컴포넌트 격리 테스트 추가:

```js
await runTest('AgentSidebar — 기본 닫힘 (R-5-H)', async () => {
  // setContent 로 sidebar 만 mount + dataset.open 어설션
});

await runTest('AgentSidebar.toggle() — 열림/닫힘 전환', async () => { /* ... */ });

await runTest('ChatInput — Enter 키 전송, Shift+Enter 줄바꿈', async () => { /* ... */ });

await runTest('ChatInput — max length 10000 (R-009)', async () => {
  // textarea.maxLength === 10000 어설션
});

await runTest('MessageList — AgentStore change 구독 + 사용자/AI 구분 렌더링', async () => { /* ... */ });

await runTest('ToolResultCard — collapsible (R-5-E)', async () => {
  // 도구명 + 인자 항상 표시, 결과는 클릭 시 펼침
});
```

**총 6건의 컴포넌트 격리 테스트** (Stage 2 분, 누적 10건).

### 2.5 검증

```bash
cd rhwp-studio
npm run build                              # 통과
node e2e/agent-component.test.mjs          # 누적 10건 모두 pass
```

### 2.6 Stage 2 종료 체크

- [ ] 컴포넌트 4종 신규 + agent.css
- [ ] 컴포넌트 격리 6건 추가 모두 pass (누적 10건)
- [ ] `#agent-sidebar` 가 *body 직속* — `#studio-root` 무영향 (본가 무수정 정책)
- [ ] R-009 사이드바 너비 360 ± 60px (CSS 검증), max length 10000 ± 2000자 (DOM 어설션)
- [ ] R-5-A vanilla DOM 정합 — 신규 의존성 0 유지
- [ ] R-5-E collapsible card — *도구 결과 토글* 동작 확인

### 2.7 Stage 2 보고서

**경로**: `mydocs/working/task_agent-v0.1_5_stage2.md`

내용:
1. 컴포넌트 4종 코드 요약 + DOM 트리
2. 격리 puppeteer 6건 출력
3. R-009 수치 어설션 결과
4. R-5-A/E/H 검증
5. 발견·deviation
6. 방법론 평가 메모

---

## Stage 3 — main.ts 진입점 통합 + Vite preview + 통합 e2e + PWA SW 점검

**기준 시간**: 70 ± 30분 (R-009)

### 3.1 main.ts 진입점 (본가 무수정 정책 *예외* — 분리 커밋)

`rhwp-studio/src/main.ts` 마지막에 1~2줄 추가:

```ts
// 기존 코드…
import { mountAgentSidebar } from '@/agent';
mountAgentSidebar();
```

`rhwp-studio/src/agent/index.ts` (신규 export 진입점):

```ts
import { AgentClient } from './agent-client';
import { AgentStore } from './agent-store';
import { AgentSidebar } from './components/sidebar';

export function mountAgentSidebar(): void {
  const client = new AgentClient();
  const store = new AgentStore(client);
  const sidebar = new AgentSidebar(store);
  sidebar.mount();
  // R-5-G: 메뉴바 보기 메뉴 hook
  hookMenuToggle(sidebar);
}

function hookMenuToggle(sidebar: AgentSidebar): void {
  // 본가 #menu-bar 의 보기 드롭다운에 동적으로 항목 추가 — DOM 조작만 (HTML 무수정)
  const viewMenu = document.querySelector('[data-menu="view"] .menu-dropdown');
  if (!viewMenu) return;
  const item = document.createElement('div');
  item.className = 'md-item';
  item.dataset.cmd = 'view:agent-sidebar';
  item.innerHTML = '<span class="md-icon"></span><span class="md-label">AI 채팅</span>';
  item.addEventListener('click', () => sidebar.toggle());
  viewMenu.appendChild(item);
}
```

**본가 무수정 정책 자기 점검**:
- `main.ts`: 2줄 추가 (`import` + `mountAgentSidebar()`) — *분리 커밋*. 본가 동기화 시 cherry-pick / revert 가능.
- `index.html` 의 `[data-menu="view"]` 영역: **DOM 조작만** (HTML 파일 수정 0). 기존 `.menu-dropdown` 에 *런타임 항목 추가* — 본가 정의된 메뉴 구조 무수정.

### 3.2 통합 e2e 테스트 — `rhwp-studio/e2e/agent-integration.test.mjs`

**R-013 layer 2** — Vite preview (production 번들 + PWA SW) + main.ts 진입점 + mocked agent-server.

```js
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const PREVIEW_PORT = 7710;

async function startPreview() {
  // 사전: npm run build 로 dist 생성 됐는지 점검
  const child = spawn('npx', ['vite', 'preview', '--host', '0.0.0.0', '--port', String(PREVIEW_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve) => {
    child.stdout.on('data', (b) => {
      if (b.toString().includes('Local:')) resolve();
    });
  });
  return child;
}

const browser = await /* ... */;
const preview = await startPreview();

try {
  const page = await browser.newPage();
  // R-5-F 보강: PWA SW 가 fetch 인터셉트 가능성 — page.setRequestInterception 가 SW 보다 우선되는지 확인
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.endsWith('/chat/session') && req.method() === 'POST') {
      req.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ sessionId: 'sid-int-1' }) });
    } else if (url.includes('/chat/session/sid-int-1/messages')) {
      req.respond({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ reply: { role: 'assistant', content: '안녕하세요!' } }),
      });
    } else req.continue();
  });

  await page.goto(`http://localhost:${PREVIEW_PORT}/`);
  await page.waitForSelector('#agent-sidebar', { timeout: 10000 });

  await runTest('통합: 사이드바 기본 닫힘 (R-5-H)', async () => {
    const open = await page.$eval('#agent-sidebar', (el) => el.dataset.open);
    if (open !== 'false') throw new Error(`expected closed, got ${open}`);
  });

  await runTest('통합: 보기 메뉴 → AI 채팅 클릭 → 사이드바 열림 (R-5-G)', async () => {
    await page.click('[data-menu="view"]');
    await page.click('[data-cmd="view:agent-sidebar"]');
    await page.waitForFunction(() => document.querySelector('#agent-sidebar')?.dataset.open === 'true');
  });

  await runTest('통합: 첫 메시지 전송 → createSession + sendMessage + AI 응답 표시 (R-5-C/D)', async () => {
    await page.type('#agent-sidebar textarea', '안녕');
    await page.click('#agent-sidebar button');
    // 응답 표시까지 5초 ± 2초 (R-009)
    await page.waitForFunction(
      () => document.querySelector('#agent-sidebar')?.textContent?.includes('안녕하세요!'),
      { timeout: 7000 },
    );
  });

  await runTest('통합: 두 번째 메시지 — sessionId 재사용 (createSession 재호출 안 함)', async () => {
    /* 두 번째 send 후 mocked /chat/session POST 가 한 번만 호출되었는지 검증 */
  });

  await runTest('R-5-F PWA SW 점검: SW 가 fetch 인터셉트 안 함 (또는 화이트리스트 처리)', async () => {
    // navigator.serviceWorker 존재 + agent-server 호출 mocked 응답 정상 도달
    const swActive = await page.evaluate(() => navigator.serviceWorker?.controller != null);
    console.log(`  SW active: ${swActive}`);
    // SW 가 활성이라도 page.route 가 우선되어 mock 응답 도달 — 위 테스트들이 통과하면 자동 OK
  });

} finally {
  await browser.close();
  preview.kill('SIGTERM');
}
```

**총 5건의 통합 e2e** (Stage 3 분).

### 3.3 PWA SW 점검 결과 분기 (R-5-F 보강)

| 시나리오 | 처리 |
|----------|------|
| SW 가 mock fetch 를 인터셉트 안 함 | 정상 — Stage 3 통과 |
| SW 가 인터셉트 — agent-server 호출 fail | **deviation 보고** — workbox runtime caching 의 `urlPattern` 화이트리스트 또는 *agent-client 의 fetch URL prefix 분리* 검토. Stage 3 보고서에 명시 |

### 3.4 검증

```bash
cd rhwp-studio
npm run build                                # production 번들 생성 (필수)
node e2e/agent-integration.test.mjs          # 통합 5건 모두 pass
node e2e/agent-component.test.mjs            # Stage 1·2 격리 회귀 (10건 누적 pass)

# 전체 회귀 (rhwp-studio 의 기존 e2e 26건이 신규 사이드바로 영향받지 않는지)
node e2e/text-flow.test.mjs                  # 기존 e2e 회귀 1건 표본
```

### 3.5 Stage 3 종료 체크

- [ ] `main.ts` 진입점 1~2줄 추가 (분리 커밋, 본가 무수정 정책 예외)
- [ ] `npm run build` 통과 (production 번들)
- [ ] `vite preview` + puppeteer 통합 5건 pass
- [ ] R-009 응답시간 5초 ± 2초 자동 어설션
- [ ] R-5-G 메뉴바 보기 메뉴 hook 정상 (DOM 조작만, HTML 무수정)
- [ ] R-5-H 기본 닫힘 동작
- [ ] R-5-F PWA SW 점검 결과 보고서 명시
- [ ] 기존 e2e (text-flow.test.mjs 등 1건 표본) 회귀 0

### 3.6 Stage 3 보고서

**경로**: `mydocs/working/task_agent-v0.1_5_stage3.md`

내용:
1. main.ts 진입점 변경 diff (분리 커밋 명시)
2. 통합 e2e 5건 출력
3. PWA SW 점검 결과
4. R-013 layer 2 frontend 변형 회고 — *Vite preview + puppeteer* 가 *compose 부팅* 의 동등 검증
5. R-5-F/G/H 검증
6. 발견·deviation
7. 방법론 평가 메모

---

## Stage 4 (선택) — 실 agent-server 통합 검증

**기준 시간**: 30 ± 15분 (R-009)

본 task 종결 후, 또는 #6 등록 전 *agent-v0.1 마일스톤 회고* 시점에 옵셔널.

### 4.1 임시 HTTP wrapper (본 task 산출물 외)

`rhwp-agent-server/src/main.ts` 의 NestJS CLI 모드 → HTTP 모드 임시 전환 + agent-client 의 baseUrl 일치. 실 OPENAI_API_KEY 사용.

### 4.2 host CDP 수동 점검

```bash
# Chrome 원격 디버깅
chrome --remote-debugging-port=9222 --remote-allow-origins=*

# preview + e2e (host 모드)
cd rhwp-studio
npm run preview &
node e2e/agent-integration.test.mjs --mode=host
```

작업지시자가 직접 사이드바 열고 "오늘 날씨 알려줘" 등 입력 → 실 OpenAI 응답 확인.

### 4.3 Stage 4 종료 체크 (옵셔널)

- [ ] 실 agent-server 가동 + 임시 HTTP wrapper 동작
- [ ] 사용자 입력 → 실 OpenAI 응답 표시
- [ ] 응답시간 5초 ± 2초 (R-009 기준 안에서)

---

## 최종 보고서

**경로**: `mydocs/report/task_agent-v0.1_5_report.md`

내용 항목:
1. 요약
2. 변경 파일 목록 (rhwp-studio/src/agent/* 신규 + main.ts 1~2줄 + e2e 2건)
3. 통합 검증 결과 (Stage 0~3 누적 + 옵셔널 Stage 4)
4. 결정 추적 (R-5-0, R-5-A~K)
5. Deviation 종합
6. 회고 (예상 대비 실제, 재작업, 학습)
7. **방법론 평가** —
   - R-013 layer 2 *frontend 변형* 정식화 후보 (R-016 또는 R-013 보강)
   - R-5-K 신규 결정사항의 R-014/R-015 의무 적용 효과
   - 본가 무수정 정책 *첫 변형* (옵션 2 변형) 의 적합성
8. 다음 이슈 후보 (#6 등록 추천 — agent-server HTTP endpoint + 인증/CORS)
9. 종료 처리 체크

---

## 커밋 전략

| 커밋 | Stage | 내용 |
|------|-------|------|
| 커밋 1 | Stage 0 | 사전 점검 보고서 + 수행계획서 + 구현계획서 |
| 커밋 2 | Stage 1 | agent/types.ts + agent-client.ts + agent-store.ts + 격리 4건 + Stage 1 보고서 |
| 커밋 3 | Stage 2 | components/* (4종) + agent.css + 격리 6건 추가 + Stage 2 보고서 |
| 커밋 4 | Stage 3 (a) | main.ts 진입점 1~2줄 (**본가 무수정 정책 예외, 단독 커밋**) |
| 커밋 5 | Stage 3 (b) | agent/index.ts (mountAgentSidebar) + 통합 e2e 5건 + Stage 3 보고서 |
| 커밋 6 | (선택) Stage 4 | 임시 wrapper 스크립트 + Stage 4 보고서 (옵셔널) |
| 커밋 7 | 최종 | 최종 보고서 + orders + (필요 시) methodology_refinements 갱신 + _NEXT_SESSION.md 갱신 |

커밋 메시지 패턴: `Task #5: <단계 요약>`. 커밋 4 만 별도 패턴 (`Task #5: main.ts 진입점 추가 (본가 무수정 정책 예외, 분리 커밋)`).

---

## 의존성·전제

| 항목 | 상태 | 비고 |
|------|------|------|
| #1~#4 task 완료 | ✅ | local/devel merge 완료 |
| 신규 의존성 | 없음 | R-5-K puppeteer-only 채택 |
| #6 등록 | ❌ 미등록 | 본 task 종결 후 등록 추천 |
| OPENAI_API_KEY (실 API) | Stage 4 옵셔널만 | Stage 1~3 모두 mock |
| ChatService 의존성 | 변화 없음 | 본 task 가 백엔드 코드 미수정 |
| Vite multi-page 설정 | 회피 | puppeteer setContent 로 동적 mount |

## 리스크 (Stage 1 시작 직전)

- **Vite dev 의 module 직접 import**: `page.setContent(HTML)` 후 `<script type="module">` 의 import 경로가 Vite dev 의 *모든 경로 fallback* 처리에 의존. 동작 안 하면 vite.config 의 `appType: 'mpa'` 또는 별도 entry 추가 필요 (본가 무수정 정책 위반 후보 — 발생 시 deviation 보고 + 작업지시자 결정).
- **PWA Service Worker 인터셉트**: Stage 3 의 mock fetch 가 SW 에 의해 *캐시 응답* 으로 대체될 가능성. 이 경우 *agent-server 호출 URL 화이트리스트* 또는 *workbox-window 의 SW 비활성 모드* 별도 처리.
- **TypeScript ^6.0.3 의 strict 모드**: 신규 코드의 *strict null check* 누락 시 빌드 실패. Stage 1 첫 빌드에서 즉시 검출.
- **AgentSidebar 의 menu-bar hook**: `hookMenuToggle` 가 *DOM ready* 시점에 의존. main.ts 진입점이 *DOM 완전 로드 후* 호출되는지 확인 (이미 main.ts 의 다른 import 들이 그 시점에 실행 → OK 가정, Stage 3 통합 e2e 로 검증).
- **#6 미등록 영향**: 본 task 의 mock 가정이 *#6 의 실 인터페이스* 와 다를 수 있음. 본 task 종결 시 *#6 등록 + 인터페이스 협의* 추천.

## 방법론 평가 메모 (구현계획서 차원)

### R-007~R-015 + R-5-K 사전 적용 (5번째 task)

본 task 는 R-007~R-015 모두 적용 + R-5-K 신설 (frontend 단위 테스트 형태) — *#5 의 고유 R-* 결정.

| 다듬기 | 본 task 의 측정 항목 |
|--------|---------------------|
| R-007 | 신규 의존성 0 → 안정 채널 충족 자동 (puppeteer 기존, vanilla DOM 표준) |
| R-008 | 종료 체크 모두 puppeteer 자동 명령 → manual 검증 0회 (Stage 4 제외) |
| R-009 | 응답시간 5±2초, max length 10000±2000자, 사이드바 360±60px — 모두 자동 어설션 |
| R-010 | 외부 docs 의존 0 (브라우저 표준 + rhwp-studio 인프라) |
| R-011 | 본 task 시작 전 환경 점검 + dist 부재 발견 (정상) |
| R-013 | **layer 1·2 모두 puppeteer (frontend 변형)** — 본 task 가 첫 사례 |
| R-014 | 이슈 #5 본문에 R-007~R-015 점검표 포함 — 두 번째 의무 적용 |
| R-015 | §6 의 R-5-A~K (11개) 모두 *반대 입장 근거* 명시 — 두 번째 의무 적용 |
| **R-5-K** | puppeteer-only 채택 — *frontend 첫 사례* 의 신규 결정 |

### R-013 frontend 변형 정식화 후보

본 task 종료 시 R-013 정의를 다음과 같이 *backend / frontend 분기* 로 정식화 후보:

```
R-013 (보강) — 2단계 검증 사다리

backend:
  layer 1 = jest (단위/e2e, 가짜 환경)
  layer 2 = docker compose (production 환경 정합)

frontend:
  layer 1 = puppeteer (단일 컴포넌트 격리 mount, Vite dev)
  layer 2 = puppeteer (전체 진입점 통합 mount, Vite preview = production 번들 + PWA SW)
```

또는 별도 R-016 으로 분리. 본 task 회고에서 결정.

### R-014/R-015 두 번째 의무 적용 효과 측정

- 결정 변경 0건 유지 가능한지 (#4 와 동일 가설)
- R-5-K 처럼 *이슈 등록 단계에서 미발견* 된 결정사항이 *수행계획서 작성 단계* 에서 발견되는 빈도 — R-001 미니사이클의 *수행계획서 (a) 단계 self-check* 로 조기 발견되는 효과

/**
 * R-013 layer 1 (frontend 변형) — agent-client + agent-store 격리 puppeteer 테스트
 *
 * 패턴: vite dev 자체 spawn → page.goto fallback → page.setContent + dynamic import
 *       → window.__agent expose → page.evaluate 로 어설션
 *
 * 모드:
 *   node e2e/agent-component.test.mjs              # headless (default)
 *   node e2e/agent-component.test.mjs --mode=host  # host CDP (CHROME_CDP env)
 *
 * 환경변수:
 *   CHROME_PATH (default: macOS Chrome)
 *   CHROME_CDP  (default: http://localhost:9222)
 *   VITE_PORT   (default: 7711)
 */
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

const VITE_PORT = process.env.VITE_PORT ? Number(process.env.VITE_PORT) : 7711;
const CHROME_PATH = process.env.CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_CDP = process.env.CHROME_CDP ?? 'http://localhost:9222';
const HOST_MODE = process.argv.includes('--mode=host');
const STUDIO_ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

async function runTest(name, fn) {
  process.stdout.write(`▶ ${name}\n`);
  try {
    await fn();
    console.log(`  ✓ pass`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${e?.stack ?? e}`);
    failed++;
  }
}

function startVite() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'npx',
      ['vite', '--host', '127.0.0.1', '--port', String(VITE_PORT)],
      { stdio: ['ignore', 'pipe', 'pipe'], cwd: STUDIO_ROOT },
    );
    let resolved = false;
    let stderrBuf = '';
    child.stderr.on('data', (b) => { stderrBuf += b.toString(); });
    child.stdout.on('data', (b) => {
      const s = b.toString();
      if (!resolved && (s.includes('Local:') || s.includes('ready in'))) {
        resolved = true;
        // vite 가 'ready in' 출력 직후 listen 활성화까지 약간 지연
        setTimeout(() => resolve(child), 300);
      }
    });
    child.on('error', reject);
    setTimeout(() => {
      if (!resolved) reject(new Error(`vite startup timeout. stderr: ${stderrBuf}`));
    }, 15000);
  });
}

async function getBrowser() {
  if (HOST_MODE) {
    return puppeteer.connect({ browserURL: CHROME_CDP, defaultViewport: null });
  }
  return puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

const MOUNT_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script type="module">
  try {
    const { AgentClient } = await import('/src/agent/agent-client.ts');
    const { AgentStore } = await import('/src/agent/agent-store.ts');
    window.__agent = { AgentClient, AgentStore };
  } catch (e) {
    window.__agentError = String(e?.stack ?? e);
  }
</script>
</body></html>`;

async function setupPage(browser) {
  const page = await browser.newPage();
  // vite SPA fallback 으로 index.html 로드 → base URL 확정
  await page.goto(`http://localhost:${VITE_PORT}/__agent_test__`, {
    waitUntil: 'domcontentloaded',
  });
  await page.setContent(MOUNT_HTML);
  await page.waitForFunction(
    () => !!(window).__agent || !!(window).__agentError,
    { timeout: 10000 },
  );
  const err = await page.evaluate(() => (window).__agentError ?? null);
  if (err) throw new Error(`agent module load failed: ${err}`);
  return page;
}

// agent-server (localhost:3000) cross-origin 호출용 CORS preflight + 응답 헬퍼
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

function respondJson(req, body) {
  req.respond({
    status: 200,
    contentType: 'application/json',
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  });
}

function handlePreflight(req) {
  if (req.method() === 'OPTIONS'
      && req.url().startsWith('http://localhost:3000')) {
    req.respond({ status: 204, headers: CORS_HEADERS });
    return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────
//  실행
// ─────────────────────────────────────────────────────────

const vite = await startVite();
console.log(`[vite] :${VITE_PORT} ready`);
const browser = await getBrowser();

try {
  // ─── 테스트 1 ──────────────────────────────────────
  await runTest('AgentClient.createSession() POST /chat/session 호출', async () => {
    const page = await setupPage(browser);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (handlePreflight(req)) return;
      if (req.url().endsWith('/chat/session') && req.method() === 'POST') {
        respondJson(req, { sessionId: 'sid-123' });
      } else {
        req.continue();
      }
    });
    const sid = await page.evaluate(async () => {
      const c = new (window).__agent.AgentClient({
        baseUrl: 'http://localhost:3000',
      });
      return c.createSession();
    });
    if (sid !== 'sid-123') throw new Error(`expected sid-123, got ${sid}`);
    await page.close();
  });

  // ─── 테스트 2 ──────────────────────────────────────
  await runTest('AgentStore.send() — 첫 메시지: createSession + sendMessage + state 갱신 (R-009 응답시간)', async () => {
    const page = await setupPage(browser);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (handlePreflight(req)) return;
      const url = req.url();
      const method = req.method();
      if (url.endsWith('/chat/session') && method === 'POST') {
        respondJson(req, { sessionId: 'sid-abc' });
      } else if (url.includes('/chat/session/') && url.endsWith('/messages')) {
        respondJson(req, { reply: { role: 'assistant', content: '안녕!' } });
      } else {
        req.continue();
      }
    });

    const t0 = Date.now();
    const state = await page.evaluate(async () => {
      const c = new (window).__agent.AgentClient({
        baseUrl: 'http://localhost:3000',
      });
      const s = new (window).__agent.AgentStore(c);
      await s.send('hi');
      return s.getState();
    });
    const elapsed = Date.now() - t0;

    if (state.sessionId !== 'sid-abc') throw new Error(`sid: ${state.sessionId}`);
    if (state.messages.length !== 2) throw new Error(`messages.length: ${state.messages.length}`);
    if (state.messages[0].role !== 'user' || state.messages[0].content !== 'hi')
      throw new Error(`first message: ${JSON.stringify(state.messages[0])}`);
    if (state.messages[1].role !== 'assistant' || state.messages[1].content !== '안녕!')
      throw new Error(`reply: ${JSON.stringify(state.messages[1])}`);
    if (state.error !== null) throw new Error(`unexpected error: ${state.error}`);
    if (state.pending) throw new Error('still pending');

    // R-009: 응답시간 < 5초 ± 2초 (mock 기준 — 충분히 빠름)
    if (elapsed > 5000) throw new Error(`elapsed ${elapsed}ms > 5000ms (R-009)`);
    console.log(`    elapsed: ${elapsed}ms (R-009 < 5000ms)`);
    await page.close();
  });

  // ─── 테스트 3 ──────────────────────────────────────
  await runTest('AgentStore.send() — pending 중 재호출 즉시 return (동시성 가드)', async () => {
    const page = await setupPage(browser);
    await page.setRequestInterception(true);
    let sessionCalls = 0;
    let messagesCalls = 0;
    page.on('request', (req) => {
      if (handlePreflight(req)) return;
      const url = req.url();
      if (url.endsWith('/chat/session') && req.method() === 'POST') {
        sessionCalls++;
        const sid = sessionCalls;
        setTimeout(() => respondJson(req, { sessionId: `sid-${sid}` }), 150);
      } else if (url.includes('/messages')) {
        messagesCalls++;
        setTimeout(() =>
          respondJson(req, { reply: { role: 'assistant', content: 'r' } }),
          50);
      } else {
        req.continue();
      }
    });

    const result = await page.evaluate(async () => {
      const c = new (window).__agent.AgentClient({
        baseUrl: 'http://localhost:3000',
      });
      const s = new (window).__agent.AgentStore(c);
      const p1 = s.send('a');
      const p2 = s.send('b');   // 첫 호출이 pending 인 동안 즉시 return
      await Promise.all([p1, p2]);
      return s.getState();
    });

    if (sessionCalls !== 1)
      throw new Error(`createSession called ${sessionCalls}x, expected 1`);
    if (messagesCalls !== 1)
      throw new Error(`sendMessage called ${messagesCalls}x, expected 1`);
    if (result.messages.length !== 2)
      throw new Error(`messages: ${result.messages.length}, expected 2`);
    if (result.messages[0].content !== 'a')
      throw new Error(`first: ${result.messages[0].content}, expected 'a'`);
    await page.close();
  });

  // ─── 테스트 4: AgentStore — change 이벤트 dispatch ────────────
  await runTest('AgentStore — change 이벤트 dispatch (EventTarget pub/sub)', async () => {
    const page = await setupPage(browser);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (handlePreflight(req)) return;
      const url = req.url();
      if (url.endsWith('/chat/session') && req.method() === 'POST') {
        respondJson(req, { sessionId: 'sid-x' });
      } else if (url.includes('/messages')) {
        respondJson(req, { reply: { role: 'assistant', content: 'ok' } });
      } else {
        req.continue();
      }
    });

    const events = await page.evaluate(async () => {
      const c = new (window).__agent.AgentClient({
        baseUrl: 'http://localhost:3000',
      });
      const s = new (window).__agent.AgentStore(c);
      const captured = [];
      s.addEventListener('change', () => {
        captured.push({
          sid: s.getState().sessionId,
          msgs: s.getState().messages.length,
          pending: s.getState().pending,
        });
      });
      await s.send('hi');
      return captured;
    });

    // 최소 4회 dispatch: pending 시작 / sid 발급 / user 추가 / assistant 추가 / pending 종료
    if (events.length < 4)
      throw new Error(`only ${events.length} change events, expected >= 4`);
    const last = events[events.length - 1];
    if (last.pending !== false)
      throw new Error(`last event pending=${last.pending}, expected false`);
    if (last.msgs !== 2)
      throw new Error(`last event msgs=${last.msgs}, expected 2`);
    console.log(`    change events: ${events.length}`);
    await page.close();
  });

  // ─── 테스트 5: AbortController 타임아웃 ────────────
  await runTest('AgentClient — fetch 타임아웃 (AbortController, R-009 timeoutMs)', async () => {
    const page = await setupPage(browser);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (handlePreflight(req)) return;
      if (req.url().endsWith('/chat/session')) {
        // 응답 안 함 → AbortController 작동까지 대기
        // (req.continue/respond 둘 다 호출 안 함 — pending 상태 유지)
      } else {
        req.continue();
      }
    });

    const result = await page.evaluate(async () => {
      try {
        const c = new (window).__agent.AgentClient({
          baseUrl: 'http://localhost:3000',
          timeoutMs: 200,   // R-009: 30000 default 의 짧은 override
        });
        await c.createSession();
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          name: err?.name ?? null,
          message: err?.message ?? String(err),
        };
      }
    });

    if (result.ok) throw new Error('expected timeout error');
    // AbortError 또는 abort 관련 메시지 패턴
    const isAbort = (result.name && /Abort/i.test(result.name))
      || /abort|aborted|signal/i.test(result.message ?? '');
    if (!isAbort)
      throw new Error(`unexpected error: name=${result.name} msg=${result.message}`);
    console.log(`    aborted: ${result.name ?? '(no name)'}`);
    await page.close();
  });

} finally {
  await browser.close().catch(() => {});
  vite.kill('SIGTERM');
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);

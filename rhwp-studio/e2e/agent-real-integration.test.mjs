/**
 * Task #6 Stage 4 — rhwp-studio + 실 agent-server 통합 e2e (mock 제거)
 *
 * 환경:
 *   - vite dev :7713 + 실 agent-server (compose) :3000 + 실 OpenAI 호출
 *   - setRequestInterception 미적용 — 실 fetch 가 agent-server 로 직행
 *
 * 사전조건:
 *   - rhwp-agent-server/.env 의 OPENAI_API_KEY 유효 + OPENAI_MODEL 가용 (예: gpt-5.4)
 *   - docker compose 사용 가능
 *
 * 본 테스트는 실 OpenAI 호출 → 비용 발생. 멀티턴 1 testcase = OpenAI 호출 2회.
 *
 * 모드:
 *   node e2e/agent-real-integration.test.mjs              # headless
 *   node e2e/agent-real-integration.test.mjs --mode=host  # host CDP
 */
import puppeteer from 'puppeteer-core';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';

// CORS_ALLOWED_ORIGINS default 4 dev port 중 하나 사용 (7711 — agent-integration 의 7712 와 분리).
const VITE_PORT = process.env.VITE_PORT ? Number(process.env.VITE_PORT) : 7711;
const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL ?? 'http://localhost:3000';
const CHROME_PATH = process.env.CHROME_PATH
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_CDP = process.env.CHROME_CDP ?? 'http://localhost:9222';
const HOST_MODE = process.argv.includes('--mode=host');
const STUDIO_ROOT = pathResolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = pathResolve(STUDIO_ROOT, '..');

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
    let stderr = '';
    child.stderr.on('data', (b) => { stderr += b.toString(); });
    child.stdout.on('data', (b) => {
      const s = b.toString();
      if (!resolved && (s.includes('Local:') || s.includes('ready in'))) {
        resolved = true;
        setTimeout(() => resolve(child), 300);
      }
    });
    child.on('error', reject);
    setTimeout(() => {
      if (!resolved) reject(new Error(`vite startup timeout. stderr: ${stderr}`));
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

async function waitForAgentServer(timeoutMs = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`${AGENT_SERVER_URL}/health`);
      if (res.ok) {
        const body = await res.json();
        if (body.status === 'ok') return;
      }
    } catch {
      // not yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`agent-server not ready after ${timeoutMs}ms`);
}

async function setupIntegration(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  page.on('pageerror', (err) => console.log(`    [page error] ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`    [console.error] ${msg.text()}`);
  });
  await page.goto(`http://localhost:${VITE_PORT}/`, {
    waitUntil: 'domcontentloaded',
    timeout: 15000,
  });
  await page.waitForSelector('[data-menu="view"] .menu-dropdown', { timeout: 5000 });
  await new Promise((r) => setTimeout(r, 200));
  return page;
}

async function openSidebar(page) {
  await page.evaluate(() => {
    document.querySelector('#agent-sidebar').dataset.open = 'true';
  });
  await new Promise((r) => setTimeout(r, 250));
}

async function mountSidebar(page) {
  await page.evaluate(async () => {
    const mod = await import('/src/agent/index.ts');
    mod.mountAgentSidebar();
  });
  await page.waitForSelector('#agent-sidebar', { timeout: 5000 });
}

// ─────────────────────────────────────────────────────────
//  실행
// ─────────────────────────────────────────────────────────

console.log(`[setup] agent-server expected at ${AGENT_SERVER_URL}`);
const composeUp = spawnSync(
  'docker', ['compose', 'up', '-d', 'agent-server'],
  { cwd: REPO_ROOT, stdio: 'inherit' },
);
if (composeUp.status !== 0) {
  console.error('[setup] docker compose up failed');
  process.exit(1);
}
await waitForAgentServer();
console.log('[setup] agent-server /health ok');

const vite = await startVite();
console.log(`[vite] :${VITE_PORT} dev ready`);
const browser = await getBrowser();

try {
  // ─── Stage 4 통합 1: 실 OpenAI 호출 — 멀티턴 1 세션 (호출 2회)
  await runTest('통합 (실): 사이드바 mount → 실 메시지 2회 → 실 OpenAI 응답 + sessionId 재사용', async () => {
    const page = await setupIntegration(browser);
    await mountSidebar(page);
    await openSidebar(page);

    // ── 첫 메시지 ─────────────────────────────
    const t0 = Date.now();
    await page.type(
      '#agent-sidebar textarea',
      '한 단어로만 답해주세요. 한국의 수도는?',
    );
    await page.evaluate(() => {
      document.querySelector('#agent-sidebar .agent-chat-input__send').click();
    });
    await page.waitForFunction(
      () => {
        const els = document.querySelectorAll(
          '#agent-sidebar .agent-message--assistant',
        );
        return els.length >= 1 && (els[0].textContent?.trim().length ?? 0) > 0;
      },
      { timeout: 30000 },
    );
    const elapsed1 = Date.now() - t0;
    console.log(`    1st elapsed: ${elapsed1}ms (R-009 5000±2000 → 실 OpenAI 허용 30s)`);

    const dom1 = await page.evaluate(() => ({
      users: Array.from(document.querySelectorAll('#agent-sidebar .agent-message--user'))
        .map((e) => e.textContent?.trim()),
      assistants: Array.from(document.querySelectorAll('#agent-sidebar .agent-message--assistant'))
        .map((e) => e.textContent?.trim()),
    }));
    if (dom1.users.length !== 1) throw new Error(`1st user msgs: ${JSON.stringify(dom1.users)}`);
    if (dom1.assistants.length !== 1)
      throw new Error(`1st assistant msgs: ${JSON.stringify(dom1.assistants)}`);
    console.log(`    1st reply: ${dom1.assistants[0]?.slice(0, 80)}`);

    // ── 두 번째 메시지 (sessionId 재사용 — agent-store 가 세션 유지) ─────
    await page.waitForFunction(
      () => !document.querySelector('#agent-sidebar textarea').disabled,
      { timeout: 30000 },
    );
    const t1 = Date.now();
    await page.type(
      '#agent-sidebar textarea',
      '방금 답한 단어를 영문 1단어로 다시 답해주세요.',
    );
    await page.evaluate(() => {
      document.querySelector('#agent-sidebar .agent-chat-input__send').click();
    });
    await page.waitForFunction(
      () => document.querySelectorAll('#agent-sidebar .agent-message--assistant').length >= 2,
      { timeout: 30000 },
    );
    const elapsed2 = Date.now() - t1;
    console.log(`    2nd elapsed: ${elapsed2}ms`);

    const dom2 = await page.evaluate(() => ({
      users: Array.from(document.querySelectorAll('#agent-sidebar .agent-message--user'))
        .map((e) => e.textContent?.trim()),
      assistants: Array.from(document.querySelectorAll('#agent-sidebar .agent-message--assistant'))
        .map((e) => e.textContent?.trim()),
    }));
    if (dom2.users.length !== 2) throw new Error(`2nd user msgs: ${JSON.stringify(dom2.users)}`);
    if (dom2.assistants.length !== 2)
      throw new Error(`2nd assistant msgs: ${JSON.stringify(dom2.assistants)}`);
    console.log(`    2nd reply: ${dom2.assistants[1]?.slice(0, 80)}`);

    // R-009 응답시간 — 실 OpenAI 30초 허용 (gpt-5.4 latency 변동)
    if (elapsed1 > 30000) throw new Error(`1st elapsed ${elapsed1}ms > 30000ms`);
    if (elapsed2 > 30000) throw new Error(`2nd elapsed ${elapsed2}ms > 30000ms`);

    await page.close();
  });

} finally {
  await browser.close().catch(() => {});
  vite.kill('SIGTERM');
  console.log('[teardown] docker compose down');
  spawnSync('docker', ['compose', 'down'], { cwd: REPO_ROOT, stdio: 'inherit' });
}

console.log(`\n=== ${passed} passed, ${failed} failed ===`);
process.exit(failed === 0 ? 0 : 1);

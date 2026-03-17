import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import {
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
  OpenClawBrowserHostExecutor,
  OpenClawBrowserRuntimeCommandClient,
  OpenClawBrowserToolTransport,
  createBrowserAssistService,
} from '../packages/browser-assist/src/index.js';

async function main() {
  if (!(await canSpawnNodeSubprocess())) {
    console.log(JSON.stringify({ ok: true, smoke: 'openclaw-bridge', status: 'skipped', reason: 'Subprocess transport is unavailable in this environment.' }, null, 2));
    return;
  }

  const liveRequested = process.argv.includes('--live');
  if (liveRequested) {
    await runLiveSmoke();
    return;
  }
  await runMockServerSmoke();
}

async function runLiveSmoke() {
  if (!process.env.OPENCLAW_BROWSER_SERVER_URL) {
    console.log(JSON.stringify({ ok: true, smoke: 'openclaw-bridge-live', status: 'skipped', reason: 'OPENCLAW_BROWSER_SERVER_URL is not configured.' }, null, 2));
    return;
  }
  const result = await runBridgeFlow({
    command: process.execPath,
    args: ['node_modules/tsx/dist/cli.mjs', 'scripts/openclaw-browser-runtime.ts'],
    env: process.env,
    ids: ['live-open-session', 'live-open-auth', 'live-open-review', 'live-attach-session', 'live-attach-auth', 'live-attach-review'],
  });
  console.log(JSON.stringify({ ok: true, smoke: 'openclaw-bridge-live', status: 'completed', result }, null, 2));
}

async function runMockServerSmoke() {
  const serverState = createMockBrowserState();
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/browser') {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    const body = await readBody(req);
    const request = JSON.parse(body) as { action?: string; url?: string; profile?: string };
    const response = handleBrowserAction(serverState, request);
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(response));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  assert(address && typeof address === 'object');
  try {
    const result = await runBridgeFlow({
      command: process.execPath,
      args: ['node_modules/tsx/dist/cli.mjs', 'scripts/openclaw-browser-runtime.ts'],
      env: {
        ...process.env,
        OPENCLAW_BROWSER_SERVER_URL: `http://127.0.0.1:${address.port}`,
        OPENCLAW_BROWSER_PROFILE: 'chrome',
      },
      ids: ['mock-open-session', 'mock-open-auth', 'mock-open-review', 'mock-attach-session', 'mock-attach-auth', 'mock-attach-review'],
      expectedOpenTargetId: 'target-opened',
      expectedAttachTargetId: 'target-attached',
    });
    console.log(JSON.stringify({ ok: true, smoke: 'openclaw-bridge-mock', status: 'completed', result }, null, 2));
  } finally {
    server.close();
  }
}

async function runBridgeFlow(input: { command: string; args: string[]; env: NodeJS.ProcessEnv; ids: string[]; expectedOpenTargetId?: string; expectedAttachTargetId?: string }) {
  const createId = (() => {
    let index = 0;
    return () => input.ids[Math.min(index++, input.ids.length - 1)] as string;
  })();
  const client = new OpenClawBrowserRuntimeCommandClient({
    command: input.command,
    args: input.args,
    env: input.env,
    timeoutMs: 15000,
  });
  const runtime = new BrowserHostRuntimeAdapter({
    executor: new OpenClawBrowserHostExecutor({
      transport: new OpenClawBrowserToolTransport({ client }),
      transportLabel: 'openclaw-browser-tool-live-bridge',
    }),
  });
  const service = createBrowserAssistService({
    store: new InMemoryBrowserAssistSessionStore(),
    runtime,
    createId,
  });

  const opened = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr/t6-open',
    requestedBy: 'smoke-openclaw-bridge',
  });
  const openStatus = await service.getHomeTaxAssistStatus(opened.session.id);
  const openAfterAuth = await service.resumeHomeTaxAssist({ sessionId: opened.session.id });

  const attached = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr/t6-attach',
    requestedBy: 'smoke-openclaw-bridge',
  });
  const attachStatus = await service.getHomeTaxAssistStatus(attached.session.id);
  const attachAfterAuth = await service.resumeHomeTaxAssist({ sessionId: attached.session.id });

  if (input.expectedOpenTargetId) {
    assert.equal(opened.session.runtimeState.runtimeTargetId, input.expectedOpenTargetId);
    assert.equal(openAfterAuth.session.runtimeState.runtimeTargetId, input.expectedOpenTargetId);
  } else {
    assert.ok(opened.session.runtimeState.runtimeTargetId);
    assert.equal(openAfterAuth.session.runtimeState.runtimeTargetId, opened.session.runtimeState.runtimeTargetId);
  }
  assert.equal(openStatus.session.runtimeState.currentTargetUrl, 'https://hometax.go.kr/t6-open/ready');
  if (input.expectedAttachTargetId) {
    assert.equal(attached.session.runtimeState.runtimeTargetId, input.expectedAttachTargetId);
    assert.equal(attachAfterAuth.session.runtimeState.runtimeTargetId, input.expectedAttachTargetId);
  } else {
    assert.ok(attached.session.runtimeState.runtimeTargetId);
    assert.equal(attachAfterAuth.session.runtimeState.runtimeTargetId, attached.session.runtimeState.runtimeTargetId);
  }
  assert.equal(attachStatus.session.runtimeState.currentTargetUrl, 'https://hometax.go.kr/t6-attach/ready');

  return {
    open: summarize(opened, openStatus, openAfterAuth),
    attach: summarize(attached, attachStatus, attachAfterAuth),
  };
}

function summarize(started: any, status: any, afterAuth: any) {
  return {
    sessionId: started.session.id,
    runtimeTargetId: started.session.runtimeState.runtimeTargetId,
    refreshedUrl: status.session.runtimeState.currentTargetUrl,
    nextCheckpoint: afterAuth.activeCheckpoint?.code,
  };
}

function createMockBrowserState() {
  return {
    tabs: [
      { id: 'target-attached', url: 'https://hometax.go.kr/t6-attach/ready', title: 'Attached HomeTax', active: true },
      { id: 'target-opened', url: 'https://hometax.go.kr/t6-open/ready', title: 'Opened HomeTax', active: false },
    ],
  };
}

function handleBrowserAction(state: ReturnType<typeof createMockBrowserState>, request: { action?: string; url?: string }) {
  switch (request.action) {
    case 'status':
      return { running: true };
    case 'tabs':
      return state.tabs;
    case 'open':
      return { id: 'target-opened', url: request.url, title: 'Opened HomeTax' };
    default:
      return {};
  }
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function canSpawnNodeSubprocess(): Promise<boolean> {
  return await new Promise((resolve) => {
    try {
      const child = spawn(process.execPath, [
        '-e',
        "process.stdin.resume(); process.stdin.on('end', () => process.exit(0));",
      ], {
        windowsHide: true,
      });
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      child.once('error', () => finish(false));
      child.once('exit', (code) => finish(code === 0));
      child.stdin?.end('{}');
    } catch {
      resolve(false);
    }
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

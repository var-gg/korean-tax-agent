import {
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
  OpenClawBrowserHostExecutor,
  OpenClawBrowserRuntimeCommandClient,
  OpenClawBrowserToolTransport,
  createBrowserAssistService,
} from '../packages/browser-assist/src/index.js';

async function main() {
  if (!process.env.OPENCLAW_BROWSER_SERVER_URL) {
    console.log(JSON.stringify({
      ok: true,
      status: 'skipped',
      reason: 'OPENCLAW_BROWSER_SERVER_URL is not configured.',
    }, null, 2));
    return;
  }

  const client = new OpenClawBrowserRuntimeCommandClient({
    command: process.execPath,
    args: ['node_modules/tsx/dist/cli.mjs', 'scripts/openclaw-browser-runtime.ts'],
    env: process.env,
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
  });

  const started = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr',
    requestedBy: 'openclaw-live-bridge-example',
  });

  console.log(JSON.stringify({
    sessionId: started.session.id,
    runtimeTargetId: started.session.runtimeState.runtimeTargetId,
    transport: started.session.runtimeState.transport,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

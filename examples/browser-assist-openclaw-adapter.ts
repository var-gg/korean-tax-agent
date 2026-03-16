import {
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
  OpenClawBrowserHostExecutor,
  OpenClawBrowserToolTransport,
  createBrowserAssistService,
} from '../packages/browser-assist/src/index.js';

async function main() {
  const tabs = [
    {
      targetId: 'openclaw-tab:session-openclaw-live-example',
      url: 'https://hometax.go.kr/openclaw-live-example/ready',
      attached: true,
      available: true,
      sessionId: 'session-openclaw-live-example',
    },
  ];
  const transport = new OpenClawBrowserToolTransport({
    client: {
      async status() {
        return { available: true, connected: true, attached: true };
      },
      async open(input) {
        return {
          targetId: 'openclaw-tab:session-openclaw-live-example',
          url: input.url,
        };
      },
      async tabs() {
        return tabs;
      },
    },
  });
  const executor = new OpenClawBrowserHostExecutor({
    transport,
    transportLabel: 'openclaw-browser-tool-live',
  });
  const runtime = new BrowserHostRuntimeAdapter({ executor });

  const service = createBrowserAssistService({
    store: new InMemoryBrowserAssistSessionStore(),
    runtime,
    createId: (() => {
      const ids = ['session-openclaw-live-example', 'checkpoint-auth-openclaw-live-example', 'checkpoint-review-openclaw-live-example'];
      let index = 0;
      return () => ids[Math.min(index++, ids.length - 1)] as string;
    })(),
  });

  const started = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr/openclaw-live-example',
    requestedBy: 'openclaw-example',
  });
  const current = await service.getHomeTaxAssistStatus(started.session.id);
  const afterAuth = await service.resumeHomeTaxAssist({
    sessionId: started.session.id,
    note: 'Authentication complete.',
  });

  console.log(
    JSON.stringify(
      {
        sessionId: afterAuth.session.id,
        runtimeTargetId: afterAuth.session.runtimeState.runtimeTargetId,
        currentTargetUrl: current.session.runtimeState.currentTargetUrl,
        nextCheckpoint: afterAuth.activeCheckpoint?.code,
        executorMethods: executor.executions.map((execution) => execution.method),
        capabilities: await runtime.getCapabilities({
          sessionId: afterAuth.session.id,
          runtimeState: afterAuth.session.runtimeState,
        }),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

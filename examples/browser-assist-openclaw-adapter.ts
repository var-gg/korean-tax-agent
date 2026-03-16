import {
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
  InMemoryBrowserHostExecutor,
  createBrowserAssistService,
} from '../packages/browser-assist/src/index.js';

async function main() {
  const executor = new InMemoryBrowserHostExecutor({
    transport: 'openclaw-browser-tool',
    runtimeTargetPrefix: 'openclaw-tab',
  });
  const runtime = new BrowserHostRuntimeAdapter({ executor });

  const service = createBrowserAssistService({
    store: new InMemoryBrowserAssistSessionStore(),
    runtime,
  });

  const started = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr/openclaw-smoke',
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

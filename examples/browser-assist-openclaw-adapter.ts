import {
  InMemoryBrowserAssistSessionStore,
  OpenClawBrowserRuntimeAdapter,
  createBrowserAssistService,
} from '../packages/browser-assist/src/index.js';

async function main() {
  const clientCalls: Array<Record<string, string | null | undefined>> = [];
  const runtime = new OpenClawBrowserRuntimeAdapter({
    client: {
      async openTarget(input) {
        clientCalls.push({
          method: 'openTarget',
          sessionId: input.sessionId,
          targetUrl: input.target.entryUrl,
        });
        return {
          runtimeTargetId: `openclaw-tab:${input.sessionId}`,
          transport: 'openclaw-browser-tool',
          currentTargetUrl: `${input.target.entryUrl}/login`,
        };
      },
      async getRuntimeState(input) {
        clientCalls.push({
          method: 'getRuntimeState',
          sessionId: input.sessionId,
          runtimeTargetId: input.runtimeState?.runtimeTargetId,
        });
        return {
          runtimeTargetId: input.runtimeState?.runtimeTargetId,
          transport: 'openclaw-browser-tool',
          currentTargetUrl: `${input.target.entryUrl}/ready`,
          lastOpenedUrl: input.runtimeState?.lastOpenedUrl ?? input.target.entryUrl,
        };
      },
      async handoffCheckpoint(input) {
        clientCalls.push({
          method: 'handoffCheckpoint',
          sessionId: input.sessionId,
          runtimeTargetId: input.runtimeState?.runtimeTargetId,
          nextCheckpointId: input.nextCheckpoint?.id,
        });
        return {
          runtimeTargetId: input.runtimeState?.runtimeTargetId,
          transport: 'openclaw-browser-tool',
          currentTargetUrl: input.targetUrl,
          lastOpenedUrl: input.runtimeState?.lastOpenedUrl ?? input.target.entryUrl,
          activeCheckpointId: input.nextCheckpoint ? input.nextCheckpoint.id : null,
          updatedAt: input.handedOffAt,
        };
      },
    },
  });

  const service = createBrowserAssistService({
    store: new InMemoryBrowserAssistSessionStore(),
    runtime,
  });

  const started = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr',
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
        startedRuntime: started.session.runtimeState,
        currentRuntime: current.session.runtimeState,
        nextCheckpoint: afterAuth.activeCheckpoint?.code,
        clientCalls,
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

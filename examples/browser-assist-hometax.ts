import {
  InMemoryBrowserAssistSessionStore,
  RecordingBrowserRuntimeAdapter,
  createBrowserAssistService,
} from '../packages/browser-assist/src/index.js';

async function main() {
  const service = createBrowserAssistService({
    store: new InMemoryBrowserAssistSessionStore(),
    runtime: new RecordingBrowserRuntimeAdapter(),
  });

  const started = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr',
    requestedBy: 'example',
    filingDraftId: 'draft-example-001',
  });

  console.log(
    JSON.stringify(
      {
        sessionId: started.session.id,
        status: started.session.status,
        activeCheckpoint: started.activeCheckpoint?.code,
        instructions: started.activeCheckpoint?.instructions,
        runtimeState: started.session.runtimeState,
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

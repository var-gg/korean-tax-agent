import assert from 'node:assert/strict';
import {
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
  InMemoryOpenClawBrowserRelay,
  OpenClawBrowserHostExecutor,
  createBrowserAssistService,
} from '../packages/browser-assist/src/index.js';

async function main() {
  const relay = new InMemoryOpenClawBrowserRelay({
    targetPrefix: 'openclaw-tab',
  });
  const executor = new OpenClawBrowserHostExecutor({
    relay,
    transportLabel: 'openclaw-browser-tool',
  });
  const runtime = new BrowserHostRuntimeAdapter({ executor });
  const service = createBrowserAssistService({
    store: new InMemoryBrowserAssistSessionStore(),
    runtime,
  });

  const started = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr/openclaw-smoke',
    requestedBy: 'smoke-openclaw-runtime',
  });
  relay.setTargetState(started.session.runtimeState.runtimeTargetId as string, {
    url: 'https://hometax.go.kr/openclaw-smoke/ready',
  });
  const current = await service.getHomeTaxAssistStatus(started.session.id);
  const afterAuth = await service.resumeHomeTaxAssist({
    sessionId: started.session.id,
    note: 'Authentication complete.',
  });

  assert.equal(started.session.openReceipt.transport, 'openclaw-browser-tool');
  assert.equal(started.session.openReceipt.runtimeTargetId, 'openclaw-tab:' + started.session.id);
  assert.equal(current.session.runtimeState.runtimeTargetId, started.session.runtimeState.runtimeTargetId);
  assert.equal(current.session.runtimeState.currentTargetUrl, 'https://hometax.go.kr/openclaw-smoke/ready');
  assert.equal(afterAuth.activeCheckpoint?.code, 'target-page-review');
  assert.deepEqual(executor.executions.map((execution) => execution.method), [
    'openTarget',
    'getRuntimeState',
    'handoffCheckpoint',
  ]);
  assert.deepEqual(relay.operations.map((operation) => operation.method), [
    'getCapabilities',
    'attach',
    'open',
    'getCapabilities',
    'getTarget',
    'getCapabilities',
    'getTarget',
    'getCapabilities',
    'handoffCheckpoint',
  ]);

  console.log(
    JSON.stringify(
      {
        sessionId: afterAuth.session.id,
        runtimeTargetId: afterAuth.session.runtimeState.runtimeTargetId,
        currentTargetUrl: current.session.runtimeState.currentTargetUrl,
        nextCheckpoint: afterAuth.activeCheckpoint?.code,
        executorMethods: executor.executions.map((execution) => execution.method),
        relayMethods: relay.operations.map((operation) => operation.method),
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

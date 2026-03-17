import assert from 'node:assert/strict';
import {
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
  OpenClawBrowserHostExecutor,
  OpenClawBrowserToolTransport,
  createBrowserAssistService,
} from '../packages/browser-assist/src/index.js';

async function main() {
  const runtime = new BrowserHostRuntimeAdapter({
    executor: new OpenClawBrowserHostExecutor({
      transport: new OpenClawBrowserToolTransport({
        client: {
          async getCapabilities() {
            return {
              hostAvailable: true,
              activeTarget: null,
              runtimeInspection: true,
              snapshotInspection: true,
              checkpointHandoff: true,
            };
          },
          async listTargets() {
            return [
              {
                targetId: 'openclaw-tab:session-reconnect:2',
                sessionId: 'session-reconnect',
                url: 'https://hometax.go.kr/reconnect/ready',
                title: 'HomeTax ready',
                attached: true,
                available: true,
              },
            ];
          },
          async openTarget(input) {
            return {
              targetId: `openclaw-tab:${input.sessionId}`,
              sessionId: input.sessionId,
              url: input.url,
              attached: true,
              available: true,
            };
          },
          async getTarget(input) {
            if (input.targetId === 'openclaw-tab:session-reconnect') return null;
            return {
              targetId: input.targetId,
              sessionId: 'session-reconnect',
              url: 'https://hometax.go.kr/reconnect/ready',
              title: 'HomeTax ready',
              attached: true,
              available: true,
            };
          },
          async snapshotTarget(input) {
            return {
              targetId: input.targetId,
              sessionId: 'session-reconnect',
              url: 'https://hometax.go.kr/reconnect/ready',
              title: 'HomeTax ready',
              inspection: {
                source: 'snapshot',
                title: 'HomeTax ready',
                url: 'https://hometax.go.kr/reconnect/ready',
                normalizedUrl: 'https://hometax.go.kr/reconnect/ready',
                textSnippet: '신고서 제출 화면',
                capturedAt: '2026-03-16T00:00:05.000Z',
                snapshotContext: {
                  artifact: {
                    artifactId: 'snapshot:openclaw-tab:session-reconnect:2',
                    version: 'snapshot-v1',
                    capturedAt: '2026-03-16T00:00:05.000Z',
                  },
                },
              },
              attached: true,
              available: true,
            };
          },
          async handoffCheckpoint(input) {
            return {
              targetId: input.targetId,
              sessionId: input.sessionId,
              url: input.targetUrl,
              attached: true,
              available: true,
            };
          },
        },
      }),
    }),
  });

  const service = createBrowserAssistService({
    store: new InMemoryBrowserAssistSessionStore(),
    runtime,
    createId: (() => {
      const ids = ['session-reconnect', 'checkpoint-auth-reconnect', 'checkpoint-review-reconnect'];
      let index = 0;
      return () => ids[index++] as string;
    })(),
  });

  const started = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr/reconnect',
    requestedBy: 'smoke-openclaw-reconnect-snapshot',
  });
  const status = await service.getHomeTaxAssistStatus(started.session.id);

  assert.equal(started.session.runtimeState.runtimeTargetId, 'openclaw-tab:session-reconnect:2');
  assert.equal(status.session.runtimeState.runtimeTargetId, 'openclaw-tab:session-reconnect:2');
  assert.equal(status.session.runtimeState.inspection?.title, 'HomeTax ready');
  assert.equal(status.session.runtimeState.inspection?.source, 'snapshot');
  assert.equal(status.session.runtimeState.inspection?.textSnippet, '신고서 제출 화면');
  assert.equal(status.session.runtimeState.snapshotContext?.artifact.artifactId, 'snapshot:openclaw-tab:session-reconnect:2');
  assert.equal(status.session.runtimeState.snapshotContext?.artifact.version, 'snapshot-v1');

  console.log(JSON.stringify({
    ok: true,
    sessionId: status.session.id,
    reboundTargetId: status.session.runtimeState.runtimeTargetId,
    title: status.session.runtimeState.inspection?.title,
    inspectionSource: status.session.runtimeState.inspection?.source,
    snapshotArtifactId: status.session.runtimeState.snapshotContext?.artifact.artifactId,
    snapshotVersion: status.session.runtimeState.snapshotContext?.artifact.version,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

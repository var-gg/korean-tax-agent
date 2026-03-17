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
              activeTarget: true,
              runtimeInspection: true,
              snapshotInspection: true,
              checkpointHandoff: true,
              domActions: true,
              supportedDomActionKinds: ['click', 'fill', 'press'],
              supportedLocatorKinds: ['aria-ref'],
            };
          },
          async listTargets() {
            return [];
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
            return {
              targetId: input.targetId,
              sessionId: 'session-openclaw-action-smoke',
              url: 'https://hometax.go.kr/openclaw/action/ready',
              attached: true,
              available: true,
            };
          },
          async executeDomAction(input) {
            return {
              targetId: input.runtimeTargetId,
              actedAt: '2026-03-16T00:00:05.000Z',
              hostActionId: 'host-action-1',
              metadata: { locatorKind: input.locator.kind, actionKind: input.action.kind },
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
      const ids = ['session-openclaw-action-smoke', 'checkpoint-auth-openclaw-action-smoke', 'checkpoint-review-openclaw-action-smoke'];
      let index = 0;
      return () => ids[Math.min(index++, ids.length - 1)] as string;
    })(),
  });

  const started = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr/openclaw/action',
    requestedBy: 'smoke-openclaw-action',
  });

  const success = await runtime.executeDomAction({
    sessionId: started.session.id,
    runtimeState: started.session.runtimeState,
    locator: { kind: 'aria-ref', ref: 'e12', description: 'Submit button' },
    action: { kind: 'click' },
  });
  const locatorFailure = await runtime.executeDomAction({
    sessionId: started.session.id,
    runtimeState: started.session.runtimeState,
    locator: { kind: 'role-name', role: 'button', name: 'Submit' },
    action: { kind: 'click' },
  });

  assert.equal(success.ok, true);
  assert.equal(locatorFailure.ok, false);
  if (!success.ok) throw new Error('expected success receipt');
  assert.equal(success.receipt.runtimeTargetId, 'openclaw-tab:session-openclaw-action-smoke');
  assert.equal(locatorFailure.code, 'locator_unsupported');

  console.log(JSON.stringify({
    ok: true,
    smoke: 'openclaw-action',
    successReceipt: success.receipt,
    locatorFailure,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

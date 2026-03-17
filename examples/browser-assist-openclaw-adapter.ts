import {
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
  OpenClawBrowserHostExecutor,
  OpenClawBrowserToolTransport,
  createBrowserAssistService,
} from '../packages/browser-assist/src/index.js';

function createSnapshotDerivedAriaRefProvenance(input: {
  snapshotContext: { artifact: { artifactId: string; version: string; capturedAt?: string } };
  inspection?: { source?: 'target' | 'snapshot' | 'runtime'; url?: string; normalizedUrl?: string; capturedAt?: string };
  evidence?: { title?: string; textSnippet?: string; description?: string };
}) {
  return {
    kind: 'snapshot-derived' as const,
    inspection: {
      source: input.inspection?.source ?? 'snapshot',
      url: input.inspection?.url,
      normalizedUrl: input.inspection?.normalizedUrl,
      capturedAt: input.inspection?.capturedAt,
    },
    snapshotContext: input.snapshotContext,
    derivation: { locatorKind: 'aria-ref' as const, basis: 'snapshot-ref' as const },
    evidence: input.evidence,
  };
}

async function main() {
  const transport = new OpenClawBrowserToolTransport({
    client: {
      async getCapabilities() {
        return {
          hostAvailable: true,
          activeTarget: null,
          runtimeInspection: true,
          snapshotInspection: true,
          checkpointHandoff: true,
          domActions: true,
          supportedDomActionKinds: ['click', 'fill', 'press'],
          supportedLocatorKinds: ['aria-ref'],
        };
      },
      async listTargets() {
        return [
          {
            targetId: 'openclaw-tab:session-openclaw-live-example',
            url: 'https://hometax.go.kr/openclaw-live-example/ready',
            attached: true,
            available: true,
            sessionId: 'session-openclaw-live-example',
          },
        ];
      },
      async openTarget(input) {
        return {
          targetId: 'openclaw-tab:session-openclaw-live-example',
          sessionId: input.sessionId,
          url: input.url,
        };
      },
      async getTarget(input) {
        return {
          targetId: input.targetId,
          sessionId: 'session-openclaw-live-example',
          url: 'https://hometax.go.kr/openclaw-live-example/ready',
          attached: true,
          available: true,
        };
      },
      async snapshotTarget(input) {
        return {
          targetId: input.targetId,
          sessionId: 'session-openclaw-live-example',
          url: 'https://hometax.go.kr/openclaw-live-example/ready',
          title: 'Example Ready',
          attached: true,
          available: true,
          inspection: {
            source: 'snapshot',
            title: 'Example Ready',
            url: 'https://hometax.go.kr/openclaw-live-example/ready',
            normalizedUrl: 'https://hometax.go.kr/openclaw-live-example/ready',
            textSnippet: '예시 제출 버튼',
            capturedAt: '2026-03-16T00:00:04.000Z',
            snapshotContext: { artifact: { artifactId: 'snapshot:example-openclaw', version: 'v1', capturedAt: '2026-03-16T00:00:04.000Z' } },
          },
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
      async executeDomAction(input) {
        return {
          targetId: input.runtimeTargetId,
          actedAt: '2026-03-16T00:00:05.000Z',
          hostActionId: 'example-action-1',
          metadata: { locatorKind: input.locator.kind, actionKind: input.action.kind },
        };
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

  const actionResult = await runtime.executeDomAction({
    sessionId: afterAuth.session.id,
    runtimeState: afterAuth.session.runtimeState,
    locator: { kind: 'aria-ref', ref: 'e12', description: 'Example continue button' },
    action: { kind: 'click' },
    snapshotContext: afterAuth.session.runtimeState.snapshotContext,
  });
  const explicitRebindResult = await runtime.executeDomAction({
    sessionId: afterAuth.session.id,
    runtimeState: afterAuth.session.runtimeState,
    locator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old continue button' },
    action: { kind: 'click' },
    snapshotContext: afterAuth.session.runtimeState.snapshotContext,
    rebinding: {
      snapshotContext: afterAuth.session.runtimeState.snapshotContext!,
      locator: { kind: 'aria-ref', ref: 'e12', description: 'Fresh continue button' },
      previousLocator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old continue button' },
    },
  });
  const staleRefFailure = await runtime.executeDomAction({
    sessionId: afterAuth.session.id,
    runtimeState: afterAuth.session.runtimeState,
    locator: { kind: 'aria-ref', ref: 'e12', description: 'Example continue button' },
    action: { kind: 'click' },
    snapshotContext: {
      artifact: {
        ...afterAuth.session.runtimeState.snapshotContext!.artifact,
        version: 'stale-v0',
      },
    },
  });

  console.log(
    JSON.stringify(
      {
        sessionId: afterAuth.session.id,
        runtimeTargetId: afterAuth.session.runtimeState.runtimeTargetId,
        currentTargetUrl: current.session.runtimeState.currentTargetUrl,
        nextCheckpoint: afterAuth.activeCheckpoint?.code,
        actionResult,
        explicitRebindResult,
        staleRefFailure,
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

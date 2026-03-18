import assert from 'node:assert/strict';
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

function createSnapshotDerivedAriaRefCandidate(input: {
  ref: string;
  label?: string;
  description?: string;
  snapshotContext: { artifact: { artifactId: string; version: string; capturedAt?: string } };
  inspection?: { source?: 'target' | 'snapshot' | 'runtime'; url?: string; normalizedUrl?: string; capturedAt?: string };
  evidence?: { title?: string; textSnippet?: string; description?: string };
}) {
  const description = input.description ?? input.evidence?.description ?? input.label ?? input.ref;
  const label = input.label ?? description;
  return {
    kind: 'snapshot-derived' as const,
    label,
    snapshotContext: input.snapshotContext,
    staleness: {
      status: 'current' as const,
      tiedToCurrentSnapshot: true,
      reason: 'matches_bound_snapshot' as const,
      candidateSnapshotContext: input.snapshotContext,
      currentSnapshotContext: input.snapshotContext,
      detail: 'Candidate is still tied to the currently bound snapshot artifact/version.',
    },
    guidance: {
      manualSelectionOnly: true as const,
      ranking: {
        ordinal: 1,
        sortKey: ['1', '6', label.toLocaleLowerCase('en-US'), input.ref.toLocaleLowerCase('en-US')].join('|'),
        criteria: ['label-kind', 'evidence-fields', 'label', 'ref'] as const,
      },
      signals: {
        labelKind: label.includes(':') ? 'role-name' as const : label.trim() === input.ref.trim() ? 'ref' as const : 'text' as const,
        evidenceFields: [input.evidence?.title ? 'title' : undefined, input.evidence?.textSnippet ? 'textSnippet' : undefined, (input.evidence?.description ?? description) ? 'description' : undefined].filter(Boolean) as Array<'title' | 'textSnippet' | 'description'>,
      },
      rationale: 'Manual choice metadata only.',
    },
    locator: {
      kind: 'aria-ref' as const,
      ref: input.ref,
      description,
      provenance: createSnapshotDerivedAriaRefProvenance({
        snapshotContext: input.snapshotContext,
        inspection: input.inspection,
        evidence: input.evidence ?? { description },
      }),
    },
  };
}

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
              actionReadiness: true,
              snapshotRefLocators: true,
              explicitSnapshotRebinding: true,
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
          async snapshotTarget(input) {
            const snapshotContext = { artifact: { artifactId: 'snapshot:action-smoke', version: 'v1', capturedAt: '2026-03-16T00:00:04.000Z' } };
            return {
              targetId: input.targetId,
              sessionId: 'session-openclaw-action-smoke',
              url: 'https://hometax.go.kr/openclaw/action/ready',
              title: 'Action Ready',
              attached: true,
              available: true,
              inspection: {
                source: 'snapshot',
                title: 'Action Ready',
                url: 'https://hometax.go.kr/openclaw/action/ready',
                normalizedUrl: 'https://hometax.go.kr/openclaw/action/ready',
                textSnippet: '제출 버튼',
                capturedAt: '2026-03-16T00:00:04.000Z',
                snapshotContext,
                locatorCandidates: [
                  createSnapshotDerivedAriaRefCandidate({
                    ref: 'e44',
                    label: 'button: 새 제출',
                    description: 'Fresh submit button',
                    snapshotContext,
                    inspection: {
                      source: 'snapshot',
                      url: 'https://hometax.go.kr/openclaw/action/ready',
                      normalizedUrl: 'https://hometax.go.kr/openclaw/action/ready',
                      capturedAt: '2026-03-16T00:00:04.000Z',
                    },
                    evidence: {
                      title: 'button: 새 제출',
                      textSnippet: '제출 버튼',
                      description: 'Fresh submit button',
                    },
                  }),
                ],
              },
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
  const selectedCandidate = [...(started.session.runtimeState.inspection?.locatorCandidates ?? [])].sort((left, right) => left.guidance.ranking.ordinal - right.guidance.ranking.ordinal)[0];
  if (!selectedCandidate) throw new Error('expected inspection locator candidate');

  const success = await runtime.executeDomAction({
    sessionId: started.session.id,
    runtimeState: started.session.runtimeState,
    locator: { kind: 'aria-ref', ref: 'e12', description: 'Submit button' },
    action: { kind: 'click' },
    snapshotContext: started.session.runtimeState?.snapshotContext,
  });
  const explicitRebind = await runtime.executeDomAction({
    sessionId: started.session.id,
    runtimeState: started.session.runtimeState,
    locator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old submit button' },
    action: { kind: 'click' },
    snapshotContext: selectedCandidate.snapshotContext,
    rebinding: selectedCandidate
      ? {
          snapshotContext: selectedCandidate.snapshotContext,
          locator: selectedCandidate.locator,
          previousLocator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old submit button' },
        }
      : undefined,
  });
  const rebindingMismatch = await runtime.executeDomAction({
    sessionId: started.session.id,
    runtimeState: started.session.runtimeState,
    locator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old submit button' },
    action: { kind: 'click' },
    snapshotContext: selectedCandidate.snapshotContext,
    rebinding: selectedCandidate
      ? {
          snapshotContext: { artifact: { ...selectedCandidate.snapshotContext.artifact, version: 'other-v0' } },
          locator: selectedCandidate.locator,
          previousLocator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old submit button' },
        }
      : undefined,
  });
  const locatorFailure = await runtime.executeDomAction({
    sessionId: started.session.id,
    runtimeState: started.session.runtimeState,
    locator: { kind: 'role-name', role: 'button', name: 'Submit' },
    action: { kind: 'click' },
  });
  const staleRefFailure = await runtime.executeDomAction({
    sessionId: started.session.id,
    runtimeState: started.session.runtimeState,
    locator: { kind: 'aria-ref', ref: 'e12', description: 'Submit button' },
    action: { kind: 'click' },
    snapshotContext: started.session.runtimeState?.snapshotContext
      ? { artifact: { ...started.session.runtimeState.snapshotContext.artifact, version: 'stale-v0' } }
      : undefined,
  });

  assert.equal(success.ok, true);
  assert.equal(explicitRebind.ok, true);
  assert.equal(rebindingMismatch.ok, false);
  assert.equal(locatorFailure.ok, false);
  if (!success.ok) throw new Error('expected success receipt');
  assert.equal(success.receipt.runtimeTargetId, 'openclaw-tab:session-openclaw-action-smoke');
  if (!explicitRebind.ok) throw new Error('expected explicit rebinding success receipt');
  assert.equal(explicitRebind.receipt.locator.kind, 'aria-ref');
  assert.equal(explicitRebind.receipt.locator.ref, 'e44');
  assert.equal(explicitRebind.receipt.requestedLocator.kind, 'aria-ref');
  assert.equal(explicitRebind.receipt.requestedLocator.ref, 'stale-e12');
  assert.equal(explicitRebind.receipt.rebinding?.accepted, true);
  assert.equal(success.receipt.readiness.snapshot, 'present');
  assert.equal(success.receipt.readiness.snapshotRef.freshness, 'current');
  assert.equal(success.receipt.snapshotContext?.artifact.artifactId, 'snapshot:action-smoke');
  if (rebindingMismatch.ok) throw new Error('expected rebinding mismatch failure');
  assert.equal(rebindingMismatch.code, 'rebinding_artifact_mismatch');
  assert.equal(rebindingMismatch.receipt?.rebinding?.rejectionCode, 'rebinding_artifact_mismatch');
  assert.equal(locatorFailure.code, 'locator_unsupported');
  assert.equal(staleRefFailure.ok, false);
  if (staleRefFailure.ok) throw new Error('expected stale ref failure');
  assert.equal(staleRefFailure.code, 'stale_ref');
  assert.deepEqual(staleRefFailure.recoveryAdvice?.steps.map((step) => `${step.action}:${step.resource}:${step.state}`), [
    'reacquire:snapshot_ref:obsolete',
  ]);

  console.log(JSON.stringify({
    ok: true,
    smoke: 'openclaw-action',
    selectedCandidate,
    successReceipt: success.receipt,
    explicitRebindReceipt: explicitRebind.receipt,
    rebindingMismatch,
    locatorFailure,
    staleRefFailure,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

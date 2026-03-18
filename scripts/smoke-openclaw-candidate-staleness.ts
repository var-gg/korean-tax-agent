import assert from 'node:assert/strict';
import {
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
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
  label: string;
  description: string;
  snapshotContext: { artifact: { artifactId: string; version: string; capturedAt?: string } };
  inspection: { source?: 'target' | 'snapshot' | 'runtime'; url?: string; normalizedUrl?: string; capturedAt?: string };
  evidence?: { title?: string; textSnippet?: string; description?: string };
}) {
  return {
    kind: 'snapshot-derived' as const,
    label: input.label,
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
        sortKey: ['1', '6', input.label.toLocaleLowerCase('en-US'), input.ref.toLocaleLowerCase('en-US')].join('|'),
        criteria: ['label-kind', 'evidence-fields', 'label', 'ref'] as const,
      },
      signals: {
        labelKind: 'role-name' as const,
        evidenceFields: ['title', 'textSnippet', 'description'] as Array<'title' | 'textSnippet' | 'description'>,
      },
      rationale: 'Manual choice metadata only.',
    },
    locator: {
      kind: 'aria-ref' as const,
      ref: input.ref,
      description: input.description,
      provenance: createSnapshotDerivedAriaRefProvenance({
        snapshotContext: input.snapshotContext,
        inspection: input.inspection,
        evidence: input.evidence ?? { title: input.label, textSnippet: input.description, description: input.description },
      }),
    },
  };
}

async function main() {
  const initialSnapshotContext = { artifact: { artifactId: 'snapshot:staleness-smoke', version: 'v1', capturedAt: '2026-03-17T10:00:00.000Z' } };
  const currentSnapshotContext = { artifact: { artifactId: 'snapshot:staleness-smoke', version: 'v2', capturedAt: '2026-03-17T10:05:00.000Z' } };
  const staleCandidate = createSnapshotDerivedAriaRefCandidate({
    ref: 'old-e12',
    label: 'button: 이전 제출',
    description: 'Old submit button',
    snapshotContext: initialSnapshotContext,
    inspection: { source: 'snapshot', url: 'https://hometax.go.kr/staleness-smoke', normalizedUrl: 'https://hometax.go.kr/staleness-smoke', capturedAt: '2026-03-17T10:00:00.000Z' },
  });
  const freshCandidate = createSnapshotDerivedAriaRefCandidate({
    ref: 'fresh-e44',
    label: 'button: 새 제출',
    description: 'Fresh submit button',
    snapshotContext: currentSnapshotContext,
    inspection: { source: 'snapshot', url: 'https://hometax.go.kr/staleness-smoke', normalizedUrl: 'https://hometax.go.kr/staleness-smoke', capturedAt: '2026-03-17T10:05:00.000Z' },
  });
  const dispatchedRefs: string[] = [];

  const runtime = new BrowserHostRuntimeAdapter({
    executor: {
      async getCapabilities() {
        return {
          hostAvailable: true,
          activeTarget: true,
          runtimeInspection: true,
          snapshotInspection: true,
          targetResolution: true,
          checkpointHandoff: true,
          domActions: true,
          actionReadiness: true,
          snapshotRefLocators: true,
          explicitSnapshotRebinding: true,
          snapshotLocatorProvenance: true,
          inspectionCandidateGuidance: true,
          inspectionCandidateStaleness: true,
          supportedDomActionKinds: ['click'],
          supportedLocatorKinds: ['aria-ref'],
        };
      },
      async openTarget(input: any) {
        return {
          sessionId: input.sessionId,
          runtimeTargetId: 'target-staleness-smoke',
          targetUrl: input.url,
          currentTargetUrl: input.url,
          transport: 'staleness-smoke',
          openedAt: '2026-03-17T10:00:00.000Z',
          updatedAt: '2026-03-17T10:00:00.000Z',
          inspection: {
            source: 'snapshot' as const,
            url: input.url,
            normalizedUrl: input.url,
            capturedAt: '2026-03-17T10:00:00.000Z',
            snapshotContext: initialSnapshotContext,
            locatorCandidates: [staleCandidate],
          },
          snapshotContext: initialSnapshotContext,
        };
      },
      async getRuntimeState(input: any) {
        return {
          sessionId: input.sessionId,
          runtimeTargetId: 'target-staleness-smoke',
          currentTargetUrl: input.target.entryUrl,
          updatedAt: '2026-03-17T10:05:00.000Z',
          inspection: {
            source: 'snapshot' as const,
            url: input.target.entryUrl,
            normalizedUrl: input.target.entryUrl,
            capturedAt: '2026-03-17T10:05:00.000Z',
            snapshotContext: currentSnapshotContext,
            locatorCandidates: [staleCandidate, freshCandidate],
          },
          snapshotContext: currentSnapshotContext,
        };
      },
      async executeDomAction(input: any) {
        const usedRef = input.rebinding?.locator.kind === 'aria-ref' ? input.rebinding.locator.ref : input.locator.kind === 'aria-ref' ? input.locator.ref : 'non-aria';
        dispatchedRefs.push(usedRef);
        return {
          ok: true as const,
          receipt: {
            sessionId: input.sessionId,
            actionId: 'action-staleness-smoke-1',
            runtimeTargetId: 'target-staleness-smoke',
            targetUrl: 'https://hometax.go.kr/staleness-smoke',
            action: input.action,
            locator: input.rebinding?.locator ?? input.locator,
            requestedLocator: input.locator,
            actedAt: '2026-03-17T10:06:00.000Z',
            readiness: {
              preconditions: { target: 'required', inspection: 'optional', snapshot: 'required', locatorNeedsSnapshotRef: true },
              target: 'ready' as const,
              inspection: 'present' as const,
              snapshot: 'present' as const,
              snapshotRef: { freshness: 'current' as const, current: currentSnapshotContext, requested: input.snapshotContext },
              rebinding: input.rebinding ? { status: 'accepted' as const, submitted: input.rebinding, accepted: input.rebinding } : { status: 'not-provided' as const },
            },
            rebinding: {
              provided: Boolean(input.rebinding),
              accepted: Boolean(input.rebinding),
              submission: input.rebinding,
              usedLocator: input.rebinding?.locator,
              usedSnapshotContext: input.rebinding?.snapshotContext,
            },
            host: 'staleness-smoke',
          },
        };
      },
    },
  });

  const service = createBrowserAssistService({
    store: new InMemoryBrowserAssistSessionStore(),
    runtime,
    createId: (() => {
      const ids = ['session-staleness-smoke', 'checkpoint-auth-staleness-smoke', 'checkpoint-review-staleness-smoke'];
      let index = 0;
      return () => ids[Math.min(index++, ids.length - 1)] as string;
    })(),
  });

  const started = await service.startHomeTaxAssist({
    targetUrl: 'https://hometax.go.kr/staleness-smoke',
    requestedBy: 'smoke-openclaw-candidate-staleness',
  });
  const refreshed = await service.getHomeTaxAssistStatus(started.session.id);
  const candidates = refreshed.session.runtimeState.inspection?.locatorCandidates ?? [];

  assert.deepEqual(candidates.map((candidate) => ({ ref: candidate.locator.ref, status: candidate.staleness.status, reason: candidate.staleness.reason })), [
    { ref: 'old-e12', status: 'stale', reason: 'snapshot_turnover' },
    { ref: 'fresh-e44', status: 'current', reason: 'matches_bound_snapshot' },
  ]);

  const fresh = candidates.find((candidate) => candidate.staleness.status === 'current');
  if (!fresh) throw new Error('expected a fresh candidate after turnover');

  const explicitRebind = await runtime.executeDomAction({
    sessionId: refreshed.session.id,
    runtimeState: refreshed.session.runtimeState,
    locator: { kind: 'aria-ref', ref: 'old-e12', description: 'Old submit button' },
    action: { kind: 'click' },
    snapshotContext: fresh.snapshotContext,
    rebinding: {
      snapshotContext: fresh.snapshotContext,
      locator: fresh.locator,
      previousLocator: { kind: 'aria-ref', ref: 'old-e12', description: 'Old submit button' },
    },
  });

  assert.equal(explicitRebind.ok, true);
  assert.deepEqual(dispatchedRefs, ['fresh-e44']);

  console.log(JSON.stringify({
    ok: true,
    smoke: 'openclaw-candidate-staleness',
    initialCandidate: started.session.runtimeState.inspection?.locatorCandidates?.[0],
    candidatesAfterTurnover: candidates,
    explicitRebind,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});

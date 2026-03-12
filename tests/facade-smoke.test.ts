import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { KoreanTaxMCPFacade, SUPPORTED_RUNTIME_TOOLS } from '../packages/mcp-server/src/facade.js';
import { routeFilingAlert } from '../packages/mcp-server/src/alert-routing.js';
import { shouldSendFilingAlert } from '../packages/mcp-server/src/alert-dedupe.js';
import { InMemoryFilingAlertStore } from '../packages/mcp-server/src/alert-store.js';
import { FileBackedFilingAlertStore } from '../packages/mcp-server/src/alert-file-store.js';
import { buildFilingAlertDigests } from '../packages/mcp-server/src/alert-digest.js';
import { planFilingAlertDelivery } from '../packages/mcp-server/src/alert-delivery-policy.js';
import { buildFilingAlertSenderBatch, discordFilingAlertChannel } from '../packages/mcp-server/src/alert-sender-adapter.js';
import { buildFilingAlertDispatchPlan } from '../packages/mcp-server/src/alert-transport.js';
import { formatFilingSummaryForDiscord } from '../packages/mcp-server/src/reply-formatters.js';
import { decideFilingAlert, toFilingAlertSnapshot } from '../packages/mcp-server/src/status-alerts.js';
import type { ClassificationDecision, ConsentRecord, LedgerTransaction, SourceConnection, SyncAttempt } from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  workspace: import('../packages/core/src/types.js').FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: Array<{ description: string }>;
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

describe('mcp facade', () => {
  it('exposes supported runtime tools through invokeTool', async () => {
    const facade = new KoreanTaxMCPFacade({
      consentRecords: demo.consentRecords,
      workspaces: [demo.workspace],
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps.map((gap) => gap.description),
      },
      transactions: demo.transactions,
      decisions: demo.decisions,
    });

    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.sources.connect');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.workspace.get_status');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.filing.get_summary');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.filing.compute_draft');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.filing.compare_with_hometax');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.filing.refresh_official_data');
    expect(SUPPORTED_RUNTIME_TOOLS).toContain('tax.profile.detect_filing_path');

    const statusResult = facade.invokeTool({
      name: 'tax.sources.get_collection_status',
      input: { workspaceId: demo.workspaceId },
    });

    expect(statusResult.ok).toBe(true);
    expect(Array.isArray(statusResult.data.connectedSources)).toBe(true);

    const pathResult = facade.invokeTool({
      name: 'tax.profile.detect_filing_path',
      input: { workspaceId: demo.workspaceId },
    });

    expect(pathResult.ok).toBe(true);
    expect(pathResult.data.workspaceId).toBe(demo.workspaceId);
    expect(typeof pathResult.data.supportTier).toBe('string');
    expect(pathResult.readiness).toBeTruthy();

    const workspaceStatusResult = facade.invokeTool({
      name: 'tax.workspace.get_status',
      input: { workspaceId: demo.workspaceId },
    });

    expect(workspaceStatusResult.ok).toBe(true);
    expect(workspaceStatusResult.data.workspace.workspaceId).toBe(demo.workspaceId);
    expect(typeof workspaceStatusResult.data.workspace.status).toBe('string');

    const filingSummaryResult = facade.invokeTool({
      name: 'tax.filing.get_summary',
      input: { workspaceId: demo.workspaceId, detailLevel: 'short' },
    });

    expect(filingSummaryResult.ok).toBe(true);
    expect(typeof filingSummaryResult.data.headline).toBe('string');
    expect(typeof filingSummaryResult.data.summaryText).toBe('string');
    expect(typeof filingSummaryResult.data.operatorUpdate).toBe('string');
    expect(filingSummaryResult.data.operatorUpdate).toContain('STATUS:');
    expect(filingSummaryResult.data.operatorUpdate).toContain('COLLECTION BLOCKED');
    expect(filingSummaryResult.data.summaryText).toContain('Recommended next action');
    expect(Array.isArray(filingSummaryResult.data.keyPoints)).toBe(true);

    const compareInvalid = facade.invokeTool({
      name: 'tax.filing.compare_with_hometax',
      input: { workspaceId: demo.workspaceId },
    });

    expect(compareInvalid.ok).toBe(false);
    expect(compareInvalid.errorCode).toBe('invalid_input');

    const standardSummaryResult = facade.invokeTool({
      name: 'tax.filing.get_summary',
      input: { workspaceId: demo.workspaceId, detailLevel: 'standard' },
    });

    expect(standardSummaryResult.ok).toBe(true);
    expect(standardSummaryResult.data.summaryText).toContain('Submission readiness');
    expect(standardSummaryResult.data.operatorUpdate).toContain('COLLECTION BLOCKED');
    expect(standardSummaryResult.data.operatorUpdate).toContain('COLLECTION:');

    const discordFormatted = formatFilingSummaryForDiscord(
      standardSummaryResult as Parameters<typeof formatFilingSummaryForDiscord>[0],
    );
    expect(discordFormatted).toContain('COLLECTION BLOCKED');

    const integratedDiscordReply = facade.invokeAndFormatFilingSummaryForDiscord({
      workspaceId: demo.workspaceId,
      detailLevel: 'short',
    });
    expect(integratedDiscordReply.message).toContain('COLLECTION BLOCKED');

    const integratedGenericReply = facade.invokeAndFormatFilingSummary(
      {
        workspaceId: demo.workspaceId,
        detailLevel: 'standard',
      },
      'generic',
    );
    expect(integratedGenericReply.message).toContain(standardSummaryResult.data.headline);
    expect(integratedGenericReply.message).toContain('Submission readiness');

    const currentAlertSnapshot = toFilingAlertSnapshot(
      standardSummaryResult.data as Parameters<typeof toFilingAlertSnapshot>[0],
    );
    const alertDecision = decideFilingAlert(undefined, currentAlertSnapshot);
    expect(alertDecision.shouldNotify).toBe(true);
    expect(alertDecision.severity).toBe('high');
    expect(alertDecision.message).toContain('COLLECTION BLOCKED');
    const immediateRouting = routeFilingAlert(alertDecision);
    expect(immediateRouting.route).toBe('operator-immediate');
    expect(
      buildFilingAlertDispatchPlan(immediateRouting, alertDecision, {
        immediateTarget: 'discord:#tax-operator-immediate',
        watchTarget: 'discord:#tax-operator-watch',
        updatesTarget: 'discord:#tax-operator-updates',
      }).target,
    ).toBe('discord:#tax-operator-immediate');

    const transitionedAlertDecision = decideFilingAlert(currentAlertSnapshot, {
      ...currentAlertSnapshot,
      status: 'ready_for_hometax_assist',
      blockers: [],
      nextRecommendedAction: 'tax.filing.prepare_hometax',
      operatorUpdate: '✅ READY FOR HOMETAX ASSIST\nNEXT: prepare the draft for HomeTax handoff',
    });
    expect(transitionedAlertDecision.shouldNotify).toBe(true);
    expect(transitionedAlertDecision.reason).toBe('status_changed');
    expect(transitionedAlertDecision.severity).toBe('info');
    expect(transitionedAlertDecision.message).toContain('READY FOR HOMETAX ASSIST');
    const updatesRouting = routeFilingAlert(transitionedAlertDecision);
    expect(updatesRouting.route).toBe('operator-updates');
    const updatesDispatchPlan = buildFilingAlertDispatchPlan(updatesRouting, transitionedAlertDecision, {
      immediateTarget: 'discord:#tax-operator-immediate',
      watchTarget: 'discord:#tax-operator-watch',
      updatesTarget: 'discord:#tax-operator-updates',
    });
    expect(updatesDispatchPlan.target).toBe('discord:#tax-operator-updates');
    expect(updatesDispatchPlan.shouldSend).toBe(true);
    const digestPlans = buildFilingAlertDigests([
      {
        workspaceId: demo.workspaceId,
        dispatchPlan: updatesDispatchPlan,
      },
      {
        workspaceId: 'workspace_beta',
        dispatchPlan: {
          ...updatesDispatchPlan,
          message: '✅ READY FOR HOMETAX ASSIST\nNEXT: prepare the draft for HomeTax handoff',
        },
      },
      {
        workspaceId: 'workspace_gamma',
        dispatchPlan: {
          shouldSend: true,
          target: 'discord:#tax-operator-watch',
          route: 'operator-watch',
          severity: 'medium',
          message: '⚠️ REVIEW PENDING\nNEXT: resolve review items before preparation',
        },
      },
    ]);
    expect(digestPlans).toHaveLength(2);
    expect(digestPlans[0]?.workspaceIds.length).toBeGreaterThanOrEqual(1);

    const deliveryPolicy = planFilingAlertDelivery([
      {
        workspaceId: 'workspace_high',
        dispatchPlan: {
          shouldSend: true,
          target: 'discord:#tax-operator-immediate',
          route: 'operator-immediate',
          severity: 'high',
          message: '⏸️ COLLECTION BLOCKED\nNEXT: resume the blocked source sync flow',
        },
      },
      {
        workspaceId: demo.workspaceId,
        dispatchPlan: updatesDispatchPlan,
      },
      {
        workspaceId: 'workspace_gamma',
        dispatchPlan: {
          shouldSend: true,
          target: 'discord:#tax-operator-watch',
          route: 'operator-watch',
          severity: 'medium',
          message: '⚠️ REVIEW PENDING\nNEXT: resolve review items before preparation',
        },
      },
    ]);
    expect(deliveryPolicy.immediateSends).toHaveLength(1);
    expect(deliveryPolicy.digests).toHaveLength(2);

    const senderBatch = buildFilingAlertSenderBatch({
      immediateSends: deliveryPolicy.immediateSends,
      digests: deliveryPolicy.digests,
      channel: discordFilingAlertChannel(),
    });
    expect(senderBatch.immediatePayloads).toHaveLength(1);
    expect(senderBatch.digestPayloads).toHaveLength(2);
    expect(senderBatch.immediatePayloads[0]?.channel).toBe('discord');

    const firstSendDecision = shouldSendFilingAlert(demo.workspaceId, updatesDispatchPlan, undefined, 0);
    expect(firstSendDecision.shouldSend).toBe(true);
    expect(firstSendDecision.reason).toBe('send');

    const duplicateSuppressed = shouldSendFilingAlert(
      demo.workspaceId,
      updatesDispatchPlan,
      {
        workspaceId: demo.workspaceId,
        fingerprint: firstSendDecision.fingerprint,
        sentAtMs: 30 * 60 * 1000,
        severity: updatesDispatchPlan.severity,
        route: updatesDispatchPlan.route,
      },
      31 * 60 * 1000,
    );
    expect(duplicateSuppressed.shouldSend).toBe(false);
    expect(duplicateSuppressed.reason).toBe('suppressed_duplicate');

    const store = new InMemoryFilingAlertStore();
    const storedFirstDecision = shouldSendFilingAlert(
      demo.workspaceId,
      updatesDispatchPlan,
      store.getLastRecord(demo.workspaceId),
      0,
    );
    const firstStoredRecord = store.applySendDecision(
      demo.workspaceId,
      updatesDispatchPlan,
      storedFirstDecision,
      0,
    );
    expect(firstStoredRecord?.workspaceId).toBe(demo.workspaceId);
    expect(store.getLastRecord(demo.workspaceId)?.fingerprint).toBe(storedFirstDecision.fingerprint);

    const storedSecondDecision = shouldSendFilingAlert(
      demo.workspaceId,
      updatesDispatchPlan,
      store.getLastRecord(demo.workspaceId),
      1,
    );
    expect(storedSecondDecision.shouldSend).toBe(false);
    expect(storedSecondDecision.reason).toBe('suppressed_duplicate');

    const tempDir = await mkdtemp(join(tmpdir(), 'filing-alert-test-'));
    try {
      const fileStore = new FileBackedFilingAlertStore(join(tempDir, 'alert-store.json'));
      const fileFirstDecision = shouldSendFilingAlert(
        demo.workspaceId,
        updatesDispatchPlan,
        await fileStore.getLastRecord(demo.workspaceId),
        0,
      );
      await fileStore.applySendDecision(demo.workspaceId, updatesDispatchPlan, fileFirstDecision, 0);

      const reloadedFileStore = new FileBackedFilingAlertStore(join(tempDir, 'alert-store.json'));
      const fileSecondDecision = shouldSendFilingAlert(
        demo.workspaceId,
        updatesDispatchPlan,
        await reloadedFileStore.getLastRecord(demo.workspaceId),
        1,
      );
      expect(fileSecondDecision.shouldSend).toBe(false);
      expect(fileSecondDecision.reason).toBe('suppressed_duplicate');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    const refreshResult = facade.invokeTool({
      name: 'tax.filing.refresh_official_data',
      input: { workspaceId: demo.workspaceId },
    });

    expect(refreshResult.ok).toBe(true);
    expect(Array.isArray(refreshResult.data.refreshedSources)).toBe(true);
    expect(refreshResult.readiness).toBeTruthy();

    const unsupported = facade.invokeTool({
      name: 'tax.not_real.tool',
      input: {},
    });

    expect(unsupported.ok).toBe(false);
    expect(unsupported.status).toBe('failed');
    expect(unsupported.errorCode).toBe('unsupported_tool');
  });

  it('returns failure envelope for invalid input instead of throwing', () => {
    const facade = new KoreanTaxMCPFacade();

    const result = facade.invokeTool({
      name: 'tax.classify.resolve_review_item',
      input: {
        selectedOption: 'exclude_from_expense',
        rationale: 'bad input test',
        approverIdentity: 'test_user',
      },
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('invalid_input');
  });
});

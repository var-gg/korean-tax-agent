import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { KoreanTaxMCPFacade, SUPPORTED_RUNTIME_TOOLS } from '../packages/mcp-server/src/facade.js';
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
  it('exposes supported runtime tools through invokeTool', () => {
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

    const alertDecision = decideFilingAlert(
      undefined,
      toFilingAlertSnapshot(standardSummaryResult.data as Parameters<typeof toFilingAlertSnapshot>[0]),
    );
    expect(alertDecision.shouldNotify).toBe(true);
    expect(alertDecision.message).toContain('COLLECTION BLOCKED');

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

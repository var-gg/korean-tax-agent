import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import type { ClassificationDecision, ConsentRecord, LedgerTransaction, ReviewItem, SourceConnection, SyncAttempt } from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: Array<{ description: string }>;
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

describe('in-memory runtime filing flow', () => {
  it('persists classification, review resolution, drafting, and hometax assist state', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps.map((gap) => gap.description),
      },
      transactions: demo.transactions,
      decisions: demo.decisions,
    });

    const classifyResult = runtime.invoke('tax.classify.run', {
      workspaceId: demo.workspaceId,
      rulesetVersion: 'runtime-test-v1',
    });

    expect(classifyResult.status).toBe('completed');
    expect(runtime.listReviewItems(demo.workspaceId).length).toBeGreaterThan(0);
    expect(runtime.listDecisions(demo.workspaceId).length).toBeGreaterThanOrEqual(classifyResult.data.decisions?.length ?? 0);

    const listedReviewItems = runtime.invoke('tax.classify.list_review_items', {
      workspaceId: demo.workspaceId,
    });

    expect(listedReviewItems.data.items.length).toBeGreaterThan(0);

    const initialDraft = runtime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'refresh',
      includeAssumptions: true,
    });

    expect(initialDraft.status).toBe('completed');
    expect(initialDraft.readiness?.blockerCodes).toContain('awaiting_review_decision');
    expect(runtime.getDraft(demo.workspaceId)?.draftId).toBe(initialDraft.data.draftId);

    const resolveResult = runtime.invoke('tax.classify.resolve_review_item', {
      reviewItemIds: listedReviewItems.data.items.map((item) => item.reviewItemId),
      selectedOption: 'exclude_from_expense',
      rationale: 'runtime test resolution',
      approverIdentity: 'runtime_test_user',
    });

    expect(resolveResult.status).toBe('completed');
    expect(runtime.listReviewItems(demo.workspaceId).every((item) => item.resolutionState === 'resolved')).toBe(true);

    const resolvedDraft = runtime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'new_version',
      includeAssumptions: true,
    });

    expect(resolvedDraft.status).toBe('completed');
    expect(resolvedDraft.readiness?.draftReadiness).toBe('draft_ready');

    const refreshResult = runtime.invoke('tax.filing.refresh_official_data', {
      workspaceId: demo.workspaceId,
      sourceIds: ['src_hometax_main'],
      refreshPolicy: 'if_stale_or_user_requested',
      recomputeDraft: true,
    });

    expect(refreshResult.status).toBe('completed');
    expect(refreshResult.data.refreshedSources.length).toBeGreaterThan(0);
    expect(runtime.getDraft(demo.workspaceId)?.fieldValues?.every((field) => field.freshnessState === 'current_enough')).toBe(true);

    const compareResult = runtime.invoke('tax.filing.compare_with_hometax', {
      workspaceId: demo.workspaceId,
      draftId: resolvedDraft.data.draftId,
      comparisonMode: 'visible_portal',
      sectionKeys: ['income', 'expenses', 'withholding'],
    });

    expect(compareResult.status).toBe('completed');
    expect(compareResult.data.sectionResults.length).toBeGreaterThan(0);
    expect(compareResult.readiness?.comparisonSummaryState).toBe('matched_enough');
    expect(runtime.getDraft(demo.workspaceId)?.fieldValues?.some((field) => field.comparisonState === 'matched')).toBe(true);

    const prepareResult = runtime.invoke('tax.filing.prepare_hometax', {
      workspaceId: demo.workspaceId,
      draftId: resolvedDraft.data.draftId,
    });

    expect(prepareResult.status).toBe('completed');
    expect(prepareResult.blockingReason).toBeUndefined();
    expect(prepareResult.data.browserAssistReady).toBe(true);
    expect(prepareResult.readiness?.submissionReadiness).toBe('submission_assist_ready');
  });
});

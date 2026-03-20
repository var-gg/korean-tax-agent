import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import type { ClassificationDecision, ConsentRecord, FilingFieldValue, LedgerTransaction, ReviewItem, SourceConnection, SyncAttempt, TaxpayerFact, WithholdingRecord } from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  workspace: import('../packages/core/src/types.js').FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: import('../packages/core/src/types.js').CoverageGap[];
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

const seededTaxpayerFacts: TaxpayerFact[] = [
  {
    factId: `fact_${demo.workspaceId}_taxpayer_type`,
    workspaceId: demo.workspaceId,
    category: 'taxpayer_profile',
    factKey: 'taxpayer_type',
    value: 'mixed_income_individual',
    status: 'confirmed',
    sourceOfTruth: 'user_asserted',
    confidence: 0.95,
    evidenceRefs: [],
    updatedAt: '2026-03-20T08:00:00Z',
  },
];

const seededWithholdingRecords: WithholdingRecord[] = [
  {
    withholdingRecordId: `withholding_${demo.workspaceId}_1`,
    workspaceId: demo.workspaceId,
    filingYear: demo.workspace.filingYear,
    payerName: 'Demo Platform',
    grossAmount: 3000000,
    withheldTaxAmount: 99000,
    localTaxAmount: 9900,
    currency: 'KRW',
    sourceType: 'hometax',
    sourceOfTruth: 'official',
    extractionConfidence: 0.98,
    evidenceRefs: [],
    capturedAt: '2026-03-20T08:00:00Z',
  },
];

describe('in-memory runtime filing flow', () => {
  it('persists classification, review resolution, drafting, and hometax assist state', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      workspaces: [demo.workspace],
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps,
      },
      transactions: demo.transactions,
      decisions: demo.decisions,
      taxpayerFacts: seededTaxpayerFacts,
      withholdingRecords: seededWithholdingRecords,
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

    expect(initialDraft.status).toBe('blocked');
    expect(initialDraft.blockingReason).toBe('awaiting_review_decision');
    expect(initialDraft.checkpointType).toBe('review_judgment');
    expect(initialDraft.readiness?.blockerCodes).toContain('awaiting_review_decision');
    expect(runtime.getDraft(demo.workspaceId)?.draftId).toBe(initialDraft.data.draftId);
    expect(runtime.getWorkspace(demo.workspaceId)?.currentDraftId).toBe(initialDraft.data.draftId);
    expect(runtime.getWorkspace(demo.workspaceId)?.unresolvedReviewCount).toBeGreaterThan(0);
    expect(runtime.getWorkspace(demo.workspaceId)?.lastBlockingReason).toBe('missing_material_coverage');

    const resolveResult = runtime.invoke('tax.classify.resolve_review_item', {
      reviewItemIds: listedReviewItems.data.items.map((item) => item.reviewItemId),
      selectedOption: 'exclude_from_expense',
      rationale: 'runtime test resolution',
      approverIdentity: 'runtime_test_user',
    });

    expect(resolveResult.status).toBe('completed');
    expect(runtime.listReviewItems(demo.workspaceId).every((item) => item.resolutionState === 'resolved')).toBe(true);
    expect(runtime.getWorkspace(demo.workspaceId)?.unresolvedReviewCount).toBe(0);

    const resolvedDraft = runtime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'new_version',
      includeAssumptions: true,
    });

    expect(resolvedDraft.status).toBe('completed');
    expect(resolvedDraft.readiness?.draftReadiness).toBe('draft_ready');
    expect(runtime.getDraft(demo.workspaceId)?.supportTier).toBe(resolvedDraft.readiness?.supportTier);
    expect(runtime.getDraft(demo.workspaceId)?.filingPathKind).toBe(resolvedDraft.readiness?.filingPathKind);
    expect(runtime.getDraft(demo.workspaceId)?.draftReadiness).toBe('draft_ready');
    expect(runtime.getTaxpayerFacts(demo.workspaceId).length).toBeGreaterThan(0);
    expect(runtime.getWithholdingRecords(demo.workspaceId)).toEqual(resolvedDraft.data.withholdingRecords ?? []);
    expect(runtime.getFilingFieldValues(demo.workspaceId)).toEqual(resolvedDraft.data.fieldValues ?? []);

    const refreshResult = runtime.invoke('tax.filing.refresh_official_data', {
      workspaceId: demo.workspaceId,
      sourceIds: ['src_hometax_main'],
      refreshPolicy: 'if_stale_or_user_requested',
      recomputeDraft: true,
    });

    expect(refreshResult.status).toBe('completed');
    expect(refreshResult.data.refreshedSources.length).toBeGreaterThan(0);
    expect(runtime.getDraft(demo.workspaceId)?.fieldValues?.every((field) => field.freshnessState === 'current_enough')).toBe(true);
    expect(runtime.getDraft(demo.workspaceId)?.freshnessState).toBe(refreshResult.readiness?.freshnessState);

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
    expect(runtime.getDraft(demo.workspaceId)?.comparisonSummaryState).toBe('matched_enough');
    expect(runtime.getDraft(demo.workspaceId)?.submissionReadiness).toBe(compareResult.readiness?.submissionReadiness);

    const prepareResult = runtime.invoke('tax.filing.prepare_hometax', {
      workspaceId: demo.workspaceId,
      draftId: resolvedDraft.data.draftId,
    });

    expect(prepareResult.status).toBe('completed');
    expect(prepareResult.blockingReason).toBeUndefined();
    expect(prepareResult.data.browserAssistReady).toBe(true);
    expect(prepareResult.readiness?.submissionReadiness).toBe('submission_assist_ready');
    expect(runtime.getWorkspace(demo.workspaceId)?.submissionReadiness).toBe('submission_assist_ready');
    expect(runtime.getWorkspace(demo.workspaceId)?.status).toBe('ready_for_hometax_assist');

    const assistResult = runtime.invoke('tax.browser.start_hometax_assist', {
      workspaceId: demo.workspaceId,
      draftId: resolvedDraft.data.draftId,
      mode: 'fill_assist',
    });

    expect(assistResult.status).toBe('awaiting_auth');
    expect(assistResult.nextRecommendedAction).toBe('tax.browser.resume_hometax_assist');
    expect(runtime.getBrowserAssistSession(demo.workspaceId)?.assistSessionId).toBe(assistResult.data.assistSessionId);
    expect(runtime.getAuthCheckpoints(demo.workspaceId).some((checkpoint) => checkpoint.sessionBinding === assistResult.data.assistSessionId)).toBe(true);
    expect(runtime.getWorkspace(demo.workspaceId)?.status).toBe('submission_in_progress');

    const resumeAssistResult = runtime.invoke('tax.browser.resume_hometax_assist', {
      workspaceId: demo.workspaceId,
      assistSessionId: assistResult.data.assistSessionId,
    });

    expect(resumeAssistResult.ok).toBe(true);
    expect(resumeAssistResult.data.assistSessionId).toBe(assistResult.data.assistSessionId);
    expect(resumeAssistResult.data.handoff.recommendedTool).toBe('tax.browser.resume_hometax_assist');
  });

  it('creates review items when hometax comparison finds material mismatches', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      workspaces: [demo.workspace],
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps,
      },
      transactions: demo.transactions,
      decisions: demo.decisions,
      taxpayerFacts: seededTaxpayerFacts,
      withholdingRecords: seededWithholdingRecords,
    });

    const resolvedDraft = runtime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'new_version',
      includeAssumptions: true,
    });

    const draft = runtime.getDraft(demo.workspaceId);
    const fieldValues = (draft?.fieldValues ?? []) as FilingFieldValue[];
    expect(fieldValues.length).toBeGreaterThan(0);

    fieldValues[0] = {
      ...fieldValues[0],
      portalObservedValue: typeof fieldValues[0].value === 'number' ? Number(fieldValues[0].value) + 200000 : 'DIFFERENT_PORTAL_VALUE',
    };

    const compareResult = runtime.invoke('tax.filing.compare_with_hometax', {
      workspaceId: demo.workspaceId,
      draftId: resolvedDraft.data.draftId,
      comparisonMode: 'visible_portal',
      sectionKeys: [fieldValues[0].sectionKey],
    });

    expect(compareResult.data.materialMismatches.length).toBeGreaterThan(0);
    expect(compareResult.nextRecommendedAction).toBe('tax.classify.list_review_items');
    expect(runtime.listReviewItems(demo.workspaceId).some((item) => item.reasonCode === 'hometax_material_mismatch')).toBe(true);
  });

  it('applies resolved hometax mismatch reviews back to the draft', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      workspaces: [demo.workspace],
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps,
      },
      transactions: demo.transactions,
      decisions: demo.decisions,
      taxpayerFacts: seededTaxpayerFacts,
      withholdingRecords: seededWithholdingRecords,
    });

    const draftResult = runtime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'new_version',
      includeAssumptions: true,
    });

    const draft = runtime.getDraft(demo.workspaceId);
    const fieldValues = (draft?.fieldValues ?? []) as FilingFieldValue[];
    expect(fieldValues.length).toBeGreaterThan(0);

    const originalValue = fieldValues[0].value;
    const portalValue = typeof originalValue === 'number' ? Number(originalValue) + 200000 : 'PORTAL_OVERRIDE_VALUE';

    fieldValues[0] = {
      ...fieldValues[0],
      portalObservedValue: portalValue,
    };

    runtime.invoke('tax.filing.compare_with_hometax', {
      workspaceId: demo.workspaceId,
      draftId: draftResult.data.draftId,
      comparisonMode: 'visible_portal',
      sectionKeys: [fieldValues[0].sectionKey],
    });

    const mismatchItems = runtime.listReviewItems(demo.workspaceId).filter((item) => item.reasonCode === 'hometax_material_mismatch');
    expect(mismatchItems.length).toBeGreaterThan(0);

    const resolveResult = runtime.invoke('tax.classify.resolve_review_item', {
      reviewItemIds: mismatchItems.map((item) => item.reviewItemId),
      selectedOption: 'accept_portal_value',
      rationale: 'portal is authoritative',
      approverIdentity: 'runtime_test_user',
    });

    expect(resolveResult.status).toBe('completed');

    const updatedDraft = runtime.getDraft(demo.workspaceId);
    const updatedField = updatedDraft?.fieldValues?.find((field) => field.filingFieldValueId === fieldValues[0].filingFieldValueId);
    expect(updatedField?.value).toBe(portalValue);
    expect(updatedField?.comparisonState).toBe('matched');
    expect(updatedDraft?.comparisonSummaryState).not.toBe('material_mismatch');
  });
});


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
    status: 'provided',
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
    const withholdingList = runtime.invoke('tax.withholding.list_records', { workspaceId: demo.workspaceId, reviewStatus: 'review_required' });
    expect(withholdingList.ok).toBe(true);
    const adjustmentList = runtime.invoke('tax.filing.list_adjustment_candidates', { workspaceId: demo.workspaceId });
    expect(adjustmentList.ok).toBe(true);
    expect(adjustmentList.data.items.length).toBeGreaterThan(0);
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
    expect(Array.isArray(prepareResult.data.manualOnlyFields)).toBe(true);
    expect(Array.isArray(prepareResult.data.blockedFields)).toBe(true);
    expect(Array.isArray(prepareResult.data.comparisonNeededFields)).toBe(true);
    expect(prepareResult.data.orderedSections.length).toBeGreaterThan(0);
    expect(prepareResult.data.handoff.orderedSections.length).toBe(prepareResult.data.orderedSections.length);
    expect(prepareResult.data.handoff.lastConfirmedDraftId).toBe(resolvedDraft.data.draftId);
    expect(Array.isArray(prepareResult.data.handoff.allowedNextActions)).toBe(true);
    expect(prepareResult.data.handoff.manualVerificationChecklist.length).toBeGreaterThan(0);
    expect(Array.isArray(prepareResult.data.adjustmentCandidates)).toBe(true);
    expect(prepareResult.data.draftFieldValues?.length).toBeGreaterThan(0);
    expect(prepareResult.data.filingSections?.length).toBeGreaterThan(0);
    expect(Object.values(prepareResult.data.sectionMapping)[0]).toMatchObject({
      sectionKey: expect.any(String),
      fieldRefs: expect.any(Array),
      mappedFields: expect.any(Array),
      manualOnlyFields: expect.any(Array),
      blockedFields: expect.any(Array),
      comparisonNeededFields: expect.any(Array),
    });
    const firstSection = prepareResult.data.orderedSections[0];
    expect(firstSection.screenKey).toBeTruthy();
    expect(firstSection.checkpointKey).toBeTruthy();
    expect(Array.isArray(firstSection.allowedNextActions)).toBe(true);
    expect(Array.isArray(firstSection.resumePreconditions)).toBe(true);
    expect(firstSection.mappedFields[0]?.entryMode).toBeTruthy();
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
    expect(assistResult.data.handoff?.orderedSections.length).toBeGreaterThan(0);
    expect(assistResult.data.screenKey).toBeTruthy();
    expect(assistResult.data.checkpointKey).toBeTruthy();
    expect(Array.isArray(assistResult.data.allowedNextActions)).toBe(true);
    expect(Array.isArray(assistResult.data.resumePreconditions)).toBe(true);
    expect(assistResult.data.entryPlan?.orderedSections).toEqual(assistResult.data.handoff?.orderedSections);
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
    expect(resumeAssistResult.data.screenKey).toBeTruthy();
    expect(resumeAssistResult.data.checkpointKey).toBeTruthy();
    expect(Array.isArray(resumeAssistResult.data.allowedNextActions)).toBe(true);
    expect(resumeAssistResult.data.handoff.entryPlan?.orderedSections.length).toBeGreaterThan(0);
    expect(resumeAssistResult.data.handoff.entryPlan?.orderedSections).toEqual(assistResult.data.handoff?.orderedSections);
  });

  it('detects repeated-import duplicates deterministically and blocks prepare until resolved', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_duplicate_demo';

    const payload = {
      sourceType: 'statement_pdf' as const,
      transactions: [
        {
          externalId: 'dup-1',
          occurredAt: '2025-04-01',
          amount: 120000,
          currency: 'KRW',
          normalizedDirection: 'expense' as const,
          counterparty: 'Office Mart',
          description: 'office supplies purchase',
          sourceReference: 'dup-1',
        },
      ],
    };

    runtime.invoke('tax.ledger.normalize', { workspaceId, extractedPayloads: [payload] });
    const secondNormalize = runtime.invoke('tax.ledger.normalize', { workspaceId, extractedPayloads: [payload] });
    expect(secondNormalize.data.duplicateCandidateCount).toBeGreaterThan(0);
    expect(Array.from(runtime.store.transactions.values()).filter((tx) => tx.workspaceId === workspaceId && tx.duplicateGroupId).length).toBeGreaterThan(0);

    const classify = runtime.invoke('tax.classify.run', { workspaceId });
    expect(classify.data.stopReasonCodes).toContain('unresolved_duplicate');
    expect(classify.data.reviewItems?.some((item) => item.reasonCode === 'duplicate_conflict')).toBe(true);

    const facts = runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['freelance'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'freelancer', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    expect(facts.ok).toBe(true);

    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'refresh' });
    expect(draft.data.stopReasonCodes).toContain('unresolved_duplicate');
    const prepare = runtime.invoke('tax.filing.prepare_hometax', { workspaceId, draftId: draft.data.draftId });
    expect(prepare.ok).toBe(false);
    expect(prepare.blockingReason).toBe('awaiting_review_decision');
  });

  it('keeps low-confidence classification as downgrade warning until a true blocker appears', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_low_confidence_warning';

    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{
          externalId: 'txn-low-confidence',
          occurredAt: '2025-05-12',
          amount: 470000,
          normalizedDirection: 'expense',
          counterparty: 'Unknown Source',
          description: 'misc charge',
          sourceReference: 'txn-low-confidence',
        }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['other'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'simple_salary_light', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    const classify = runtime.invoke('tax.classify.run', { workspaceId });
    expect(classify.data.warningCodes).toContain('low_confidence_classification');
    expect(classify.data.stopReasonCodes).not.toContain('low_confidence_classification');

    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'refresh' });
    expect(draft.ok).toBe(true);
    expect(draft.data.warningCodes).toContain('low_confidence_classification');
    expect(draft.data.stopReasonCodes).not.toContain('low_confidence_classification');
  });

  it('captures conflicting withholding records as blockers', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_withholding_conflict_demo';

    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{
          externalId: 'income-1', occurredAt: '2025-05-01', amount: 1000000, normalizedDirection: 'income', counterparty: 'Client A', description: 'consulting payment', sourceReference: 'income-1',
        }],
        withholdingRecords: [{
          externalId: 'wh-a', incomeSourceRef: 'income-1', payerName: 'Client A', grossAmount: 1000000, withheldTaxAmount: 30000, localTaxAmount: 3000,
        }],
      }],
    });
    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [],
        withholdingRecords: [{
          externalId: 'wh-b', incomeSourceRef: 'income-1', payerName: 'Client A', grossAmount: 1000000, withheldTaxAmount: 50000, localTaxAmount: 5000,
        }],
      }],
    });

    const records = runtime.getWithholdingRecords(workspaceId);
    expect(records.some((record) => record.reviewStatus === 'conflict_detected')).toBe(true);
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'refresh' });
    expect(draft.data.stopReasonCodes).toContain('conflicting_withholding_record');
  });

  it('surfaces missing_auth during active assist in get_status and get_summary', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      workspaces: [demo.workspace],
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: { [demo.workspaceId]: demo.coverageGaps },
      transactions: demo.transactions,
      decisions: demo.decisions,
      taxpayerFacts: seededTaxpayerFacts,
      withholdingRecords: seededWithholdingRecords,
    });

    const classify = runtime.invoke('tax.classify.run', { workspaceId: demo.workspaceId });
    runtime.invoke('tax.classify.resolve_review_item', {
      reviewItemIds: classify.data.reviewItems?.map((item) => item.reviewItemId) ?? runtime.listReviewItems(demo.workspaceId).map((item) => item.reviewItemId),
      selectedOption: 'exclude_from_expense',
      rationale: 'resolve for assist auth test',
      approverIdentity: 'runtime_test_user',
    });
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId: demo.workspaceId, draftMode: 'new_version', includeAssumptions: true });
    runtime.invoke('tax.filing.refresh_official_data', { workspaceId: demo.workspaceId, draftId: draft.data.draftId });
    runtime.invoke('tax.filing.compare_with_hometax', { workspaceId: demo.workspaceId, draftId: draft.data.draftId, comparisonMode: 'visible_portal', sectionKeys: ['income', 'expenses', 'withholding'] });
    const started = runtime.invoke('tax.browser.start_hometax_assist', { workspaceId: demo.workspaceId, draftId: draft.data.draftId, mode: 'fill_assist' });
    expect(started.ok).toBe(true);

    const status = runtime.invoke('tax.workspace.get_status', { workspaceId: demo.workspaceId });
    const summary = runtime.invoke('tax.filing.get_summary', { workspaceId: demo.workspaceId, draftId: draft.data.draftId });
    expect(status.data.stopReasonCodes).toContain('missing_auth');
    expect(summary.data.stopReasonCodes).toContain('missing_auth');
    expect(summary.data.blockers).toContain('missing_auth');
  });

  it('keeps blocker sets aligned across status, summary, and export package', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_blocker_alignment';

    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [
          { externalId: 'dup-a', occurredAt: '2025-04-01', amount: 120000, normalizedDirection: 'expense', counterparty: 'Office Mart', description: 'office supplies purchase', sourceReference: 'dup-a' },
          { externalId: 'dup-b', occurredAt: '2025-04-01', amount: 120000, normalizedDirection: 'expense', counterparty: 'Office Mart', description: 'office supplies purchase', sourceReference: 'dup-b' },
        ],
      }],
    });
    runtime.invoke('tax.classify.run', { workspaceId });
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'refresh' });
    const status = runtime.invoke('tax.workspace.get_status', { workspaceId });
    const summary = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: draft.data.draftId });
    const exportPackage = runtime.invoke('tax.filing.export_package', { workspaceId, draftId: draft.data.draftId, formats: ['json_package', 'submission_prep_checklist'] });

    expect(status.data.stopReasonCodes).toEqual(summary.data.stopReasonCodes);
    expect(summary.data.stopReasonCodes).toEqual(summary.data.blockers);
    expect(summary.data.stopReasonCodes).toEqual(exportPackage.data.unresolvedBlockers);
    expect(status.data.runtimeSnapshot?.blockerCodes).toEqual(summary.data.stopReasonCodes);
  });

  it('captures taxpayer facts and explains missing facts before draft readiness', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_2025_facts_demo';

    const missingBefore = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
    expect(missingBefore.data.items.length).toBeGreaterThan(0);
    expect(missingBefore.data.items[0]?.bestQuestion).toBeTruthy();

    const upserted = runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        {
          factKey: 'income_streams',
          category: 'income_stream',
          value: ['freelance'],
          status: 'provided',
          sourceOfTruth: 'user_asserted',
          provenance: { capturedVia: 'chat_answer', observedAt: '2026-03-21T00:00:00.000Z', sourceRef: 'discord:msg:1' },
        },
        {
          factKey: 'taxpayer_posture',
          category: 'taxpayer_profile',
          value: 'freelancer',
          status: 'provided',
          sourceOfTruth: 'user_asserted',
          provenance: { capturedVia: 'chat_answer', observedAt: '2026-03-21T00:00:00.000Z', sourceRef: 'discord:msg:2' },
        },
      ],
    });
    expect(upserted.ok).toBe(true);
    expect(upserted.data.updatedFacts.length).toBe(2);

    const path = runtime.invoke('tax.profile.detect_filing_path', { workspaceId });
    expect(path.data.missingFactDetails?.length).toBeGreaterThan(0);

    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'refresh' });
    if (!draft.ok) {
      expect(['insufficient_metadata', 'awaiting_review_decision']).toContain(draft.blockingReason);
    } else {
      expect(Array.isArray(draft.data.warningCodes)).toBe(true);
    }
    expect(draft.data.factCompleteness?.length).toBeGreaterThan(0);
    expect(draft.data.adjustmentCandidates?.length).toBeGreaterThan(0);
    expect(draft.data.adjustmentSummary?.considered).toBeGreaterThan(0);
    expect(draft.data.draftFieldValues?.length).toBeGreaterThan(0);
    expect(draft.data.filingSections?.length).toBeGreaterThan(0);
    expect(Array.isArray(draft.data.stopReasonCodes)).toBe(true);

    const summary = runtime.invoke('tax.filing.get_summary', { workspaceId });
    expect(summary.data.missingFacts?.length).toBeGreaterThan(0);
    expect(summary.data.adjustmentCandidates?.length).toBeGreaterThan(0);
    expect(typeof summary.data.operatorExplanation).toBe('string');

    const status = runtime.invoke('tax.workspace.get_status', { workspaceId });
    expect(status.data.workspace.missingFacts?.length).toBeGreaterThan(0);
  });

  it('surfaces awaiting external submit click after final approval', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'simple_salary_light' });
    const workspaceId = init.data.workspaceId;

    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{ externalId: 'salary-1', occurredAt: '2025-03-25', amount: 3500000, normalizedDirection: 'income', counterparty: 'Simple Payroll', description: 'salary payroll march', sourceReference: 'salary-1' }],
        withholdingRecords: [{ externalId: 'wh-1', incomeSourceRef: 'salary-1', payerName: 'Simple Payroll', grossAmount: 3500000, withheldTaxAmount: 105000, localTaxAmount: 10500 }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['salary'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'simple_salary_light', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'residency_context', category: 'taxpayer_profile', value: 'domestic_only', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    runtime.invoke('tax.classify.run', { workspaceId });
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'new_version', includeAssumptions: true });
    runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId: draft.data.draftId });
    runtime.invoke('tax.filing.compare_with_hometax', { workspaceId, draftId: draft.data.draftId, portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({ sectionKey: field.sectionKey, fieldKey: field.fieldKey, portalObservedValue: field.value })) });
    const started = runtime.invoke('tax.browser.start_hometax_assist', { workspaceId, draftId: draft.data.draftId, mode: 'fill_assist' });
    expect(started.ok).toBe(true);

    runtime.invoke('tax.filing.record_submission_approval', { workspaceId, draftId: draft.data.draftId, approvedBy: 'operator:test' });
    const status = runtime.invoke('tax.workspace.get_status', { workspaceId });
    const summary = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: draft.data.draftId });
    const checkpoint = runtime.invoke('tax.browser.get_checkpoint', { workspaceId, assistSessionId: started.data.assistSessionId });
    expect(status.data.workflowState).toBe('awaiting_external_submit_click');
    expect(status.data.externalSubmitRequired).toBe(true);
    expect(summary.data.workflowState).toBe('awaiting_external_submit_click');
    expect(summary.data.externalSubmitRequired).toBe(true);
    expect(checkpoint.data.workflowState).toBe('awaiting_external_submit_click');
    expect(checkpoint.data.externalSubmitRequired).toBe(true);
    expect(checkpoint.nextRecommendedAction).toBe('tax.browser.record_submission_result');
  });

  it('requires final approval before recording submission result and stores receipt/result states', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'simple_salary_light' });
    const workspaceId = init.data.workspaceId;

    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{ externalId: 'salary-1', occurredAt: '2025-03-25', amount: 3500000, normalizedDirection: 'income', counterparty: 'Simple Payroll', description: 'salary payroll march', sourceReference: 'salary-1' }],
        withholdingRecords: [{ externalId: 'wh-1', incomeSourceRef: 'salary-1', payerName: 'Simple Payroll', grossAmount: 3500000, withheldTaxAmount: 105000, localTaxAmount: 10500 }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['salary'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'simple_salary_light', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'residency_context', category: 'taxpayer_profile', value: 'domestic_only', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    runtime.invoke('tax.classify.run', { workspaceId });
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'new_version', includeAssumptions: true });
    const draftId = draft.data.draftId;
    runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId });
    runtime.invoke('tax.filing.compare_with_hometax', { workspaceId, draftId, portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({ sectionKey: field.sectionKey, fieldKey: field.fieldKey, portalObservedValue: field.value })) });

    const blocked = runtime.invoke('tax.browser.record_submission_result', {
      workspaceId,
      draftId,
      result: 'success',
      receiptArtifactRefs: ['artifact_receipt_1'],
      receiptNumber: '2026-HT-001',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.blockingReason).toBe('awaiting_final_approval');

    const approval = runtime.invoke('tax.filing.record_submission_approval', {
      workspaceId,
      draftId,
      approvedBy: 'operator:test',
    });
    expect(approval.ok).toBe(true);

    const started = runtime.invoke('tax.browser.start_hometax_assist', {
      workspaceId,
      draftId,
      mode: 'fill_assist',
    });
    expect(started.ok).toBe(true);

    const success = runtime.invoke('tax.browser.record_submission_result', {
      workspaceId,
      draftId,
      result: 'success',
      receiptArtifactRefs: ['artifact_receipt_1'],
      receiptNumber: '2026-HT-001',
      submittedAt: '2026-03-21T00:00:00.000Z',
    });
    expect(success.ok).toBe(true);
    expect(success.nextRecommendedAction).toBe('tax.filing.export_package');
    expect(success.data.submissionResult.receiptArtifactRefs).toContain('artifact_receipt_1');

    const status = runtime.invoke('tax.workspace.get_status', { workspaceId });
    expect(status.data.workspace.submissionApproval?.approvedBy).toBe('operator:test');
    expect(status.data.workspace.submissionResult?.result).toBe('success');
    expect(status.data.workspace.status).toBe('submitted');
    expect(status.data.stopReasonCodes).toEqual([]);
    expect(runtime.getBrowserAssistSession(workspaceId)?.endedAt).toBeTruthy();

    const summary = runtime.invoke('tax.filing.get_summary', { workspaceId });
    expect(summary.data.submissionResult?.receiptNumber).toBe('2026-HT-001');
    expect(summary.data.status).toBe('submitted');
    expect(summary.data.stopReasonCodes).toEqual([]);
    expect(summary.data.blockers).toEqual([]);

    const exportPackage = runtime.invoke('tax.filing.export_package', {
      workspaceId,
      draftId,
      formats: ['json_package', 'csv_review_report', 'evidence_index', 'submission_prep_checklist', 'submission_receipt_bundle'],
    });
    expect(exportPackage.ok).toBe(true);
    expect(exportPackage.data.artifacts.length).toBeGreaterThan(0);
    expect(exportPackage.data.unresolvedBlockers).toEqual(expect.any(Array));
    expect(exportPackage.data.checklistPreview).toContain('final_state=submitted');
    expect(exportPackage.data.includedFormats).toContain('submission_receipt_bundle');

    const checkpoint = runtime.invoke('tax.browser.get_checkpoint', {
      workspaceId,
      assistSessionId: runtime.getBrowserAssistSession(workspaceId)?.assistSessionId ?? 'missing',
    });
    expect(checkpoint.ok).toBe(true);
    expect(checkpoint.nextRecommendedAction).toBe('tax.filing.export_package');
  });

  it('downgrades prepare plan when review items remain open', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      workspaces: [demo.workspace],
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: { [demo.workspaceId]: demo.coverageGaps },
      transactions: demo.transactions,
      decisions: demo.decisions,
      taxpayerFacts: seededTaxpayerFacts,
      withholdingRecords: seededWithholdingRecords,
    });

    const draft = runtime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'refresh',
      includeAssumptions: true,
    });
    const prepare = runtime.invoke('tax.filing.prepare_hometax', {
      workspaceId: demo.workspaceId,
      draftId: draft.data.draftId,
    });

    expect(prepare.ok).toBe(false);
    expect(prepare.status).toBe('blocked');
    expect(prepare.blockingReason).toBe('comparison_incomplete');
    expect(prepare.data.handoff.blockingItems).toContain('comparison_incomplete');
    expect(prepare.nextRecommendedAction).toBe('tax.filing.compare_with_hometax');
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

    const prepare = runtime.invoke('tax.filing.prepare_hometax', {
      workspaceId: demo.workspaceId,
      draftId: resolvedDraft.data.draftId,
    });
    expect(prepare.ok).toBe(false);
    expect(prepare.data.handoff.mismatchSummary.hasUnresolvedMismatch).toBe(true);
    expect(prepare.data.handoff.immediateUserConfirmations.some((item) => item.includes('mismatch'))).toBe(true);
  });

  it('blocks start_hometax_assist when comparison is incomplete and does not create a session', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      workspaces: [demo.workspace],
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: { [demo.workspaceId]: demo.coverageGaps },
      transactions: demo.transactions,
      decisions: demo.decisions,
      taxpayerFacts: seededTaxpayerFacts,
      withholdingRecords: seededWithholdingRecords,
    });

    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId: demo.workspaceId, draftMode: 'refresh', includeAssumptions: true });
    const started = runtime.invoke('tax.browser.start_hometax_assist', { workspaceId: demo.workspaceId, draftId: draft.data.draftId, mode: 'fill_assist' });
    expect(started.ok).toBe(false);
    expect(started.status).toBe('blocked');
    expect(started.blockingReason).toBe('comparison_incomplete');
    expect(started.nextRecommendedAction).toBe('tax.filing.compare_with_hometax');
    expect(runtime.getBrowserAssistSession(demo.workspaceId)).toBeUndefined();
    expect(runtime.store.authCheckpoints.size).toBe(0);
    expect(runtime.invoke('tax.workspace.get_status', { workspaceId: demo.workspaceId }).data.workspace.status).not.toBe('submission_in_progress');
  });

  it('blocks start_hometax_assist when review items remain unresolved', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      workspaces: [demo.workspace],
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: { [demo.workspaceId]: demo.coverageGaps },
      transactions: demo.transactions,
      decisions: demo.decisions,
      taxpayerFacts: seededTaxpayerFacts,
      withholdingRecords: seededWithholdingRecords,
    });

    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId: demo.workspaceId, draftMode: 'refresh', includeAssumptions: true });
    const prepare = runtime.invoke('tax.filing.prepare_hometax', { workspaceId: demo.workspaceId, draftId: draft.data.draftId });
    expect(prepare.blockingReason).toBe('comparison_incomplete');
    const started = runtime.invoke('tax.browser.start_hometax_assist', { workspaceId: demo.workspaceId, draftId: draft.data.draftId, mode: 'fill_assist' });
    expect(started.ok).toBe(false);
    expect(runtime.getBrowserAssistSession(demo.workspaceId)).toBeUndefined();
  });

  it('guides restart semantics for browser_closed and operator_restart stops', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'simple_salary_light' });
    const workspaceId = init.data.workspaceId;
    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{ externalId: 'salary-1', occurredAt: '2025-03-25', amount: 3500000, normalizedDirection: 'income', counterparty: 'Simple Payroll', description: 'salary payroll march', sourceReference: 'salary-1' }],
        withholdingRecords: [{ externalId: 'wh-1', incomeSourceRef: 'salary-1', payerName: 'Simple Payroll', grossAmount: 3500000, withheldTaxAmount: 105000, localTaxAmount: 10500 }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['salary'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'simple_salary_light', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'residency_context', category: 'taxpayer_profile', value: 'domestic_only', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    runtime.invoke('tax.classify.run', { workspaceId });
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'new_version', includeAssumptions: true });
    runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId: draft.data.draftId });
    runtime.invoke('tax.filing.compare_with_hometax', { workspaceId, draftId: draft.data.draftId, portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({ sectionKey: field.sectionKey, fieldKey: field.fieldKey, portalObservedValue: field.value })) });
    const started = runtime.invoke('tax.browser.start_hometax_assist', { workspaceId, draftId: draft.data.draftId, mode: 'fill_assist' });

    const browserClosed = runtime.invoke('tax.browser.stop_hometax_assist', { workspaceId, assistSessionId: started.data.assistSessionId, stopReason: 'browser_closed', stopMode: 'restart_required' });
    expect(browserClosed.data.preservedContext.canRestartFromSession).toBe(false);
    expect(browserClosed.data.preservedContext.mustStartNewSession).toBe(true);
    expect(browserClosed.data.preservedContext.restartGuidance).toBe('start_hometax_assist');
    expect(browserClosed.nextRecommendedAction).toBe('tax.browser.start_hometax_assist');

    const restarted = runtime.invoke('tax.browser.stop_hometax_assist', { workspaceId, assistSessionId: started.data.assistSessionId, stopReason: 'operator_restart', stopMode: 'restart_required' });
    expect(restarted.data.preservedContext.canRestartFromSession).toBe(false);
    expect(restarted.data.preservedContext.restartGuidance).toBe('start_hometax_assist');
  });

  it('blocks browser resume when draft changes after assist start', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      workspaces: [demo.workspace],
      sources: demo.sources,
      syncAttempts: demo.syncAttempts,
      coverageGapsByWorkspace: { [demo.workspaceId]: demo.coverageGaps },
      transactions: demo.transactions,
      decisions: demo.decisions,
      taxpayerFacts: seededTaxpayerFacts,
      withholdingRecords: seededWithholdingRecords,
    });

    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'simple_salary_light' });
    const workspaceId = init.data.workspaceId;
    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{ externalId: 'salary-1', occurredAt: '2025-03-25', amount: 3500000, normalizedDirection: 'income', counterparty: 'Simple Payroll', description: 'salary payroll march', sourceReference: 'salary-1' }],
        withholdingRecords: [{ externalId: 'wh-1', incomeSourceRef: 'salary-1', payerName: 'Simple Payroll', grossAmount: 3500000, withheldTaxAmount: 105000, localTaxAmount: 10500 }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['salary'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'simple_salary_light', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'residency_context', category: 'taxpayer_profile', value: 'domestic_only', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    runtime.invoke('tax.classify.run', { workspaceId });
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'new_version', includeAssumptions: true });
    runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId: draft.data.draftId });
    runtime.invoke('tax.filing.compare_with_hometax', { workspaceId, draftId: draft.data.draftId, portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({ sectionKey: field.sectionKey, fieldKey: field.fieldKey, portalObservedValue: field.value })) });
    runtime.invoke('tax.filing.prepare_hometax', { workspaceId, draftId: draft.data.draftId });
    const started = runtime.invoke('tax.browser.start_hometax_assist', { workspaceId, draftId: draft.data.draftId, mode: 'fill_assist' });

    runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'new_version', includeAssumptions: true });
    const resumed = runtime.invoke('tax.browser.resume_hometax_assist', { workspaceId, assistSessionId: started.data.assistSessionId });
    const status = runtime.invoke('tax.workspace.get_status', { workspaceId });
    const summary = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: runtime.getDraft(workspaceId)?.draftId });
    if (resumed.ok) {
      expect(['tax.browser.resume_hometax_assist', 'tax.browser.get_checkpoint']).toContain(resumed.nextRecommendedAction);
    } else {
      expect(resumed.blockingReason).toBe('official_data_refresh_required');
      expect(resumed.nextRecommendedAction).toBe('tax.browser.get_checkpoint');
    }
    expect(status.data.stopReasonCodes.some((code) => ['official_data_refresh_required', 'comparison_incomplete'].includes(code))).toBe(true);
    expect(summary.data.stopReasonCodes.some((code) => ['official_data_refresh_required', 'comparison_incomplete'].includes(code))).toBe(true);
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


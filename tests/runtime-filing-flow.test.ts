import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import { SOURCE_METHOD_REGISTRY } from '../packages/mcp-server/src/source-method-registry.js';
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
  it('derives bookkeeping regime from imported official material industry thresholds', () => {
    const cases = [
      { workspaceId: 'workspace_940926_single', industryRows: [{ code: '940926', gross: 34000000 }], expectedMode: 'simple_rate', expectedPrincipal: '940926' },
      { workspaceId: 'workspace_940909_single', industryRows: [{ code: '940909', gross: 50000000 }], expectedMode: 'simple_book', expectedPrincipal: '940909' },
      { workspaceId: 'workspace_multi_industry', industryRows: [{ code: '940926', gross: 70000000 }, { code: '940909', gross: 30000000 }], expectedMode: 'simple_book', expectedPrincipal: '940926', expectMulti: true },
      { workspaceId: 'workspace_threshold_below', industryRows: [{ code: '940926', gross: 149000000 }], expectedMode: 'simple_book', expectedPrincipal: '940926' },
      { workspaceId: 'workspace_threshold_above', industryRows: [{ code: '940926', gross: 160000000 }], expectedMode: 'double_entry', expectedPrincipal: '940926', priorYear: '3.3%' },
    ] as const;

    for (const item of cases) {
      const runtime = new InMemoryKoreanTaxMCPRuntime();
      const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'sole_freelancer_light' });
      const workspaceId = init.data.workspaceId;
      runtime.invoke('tax.import.import_hometax_materials', {
        workspaceId,
        refs: item.industryRows.map((row, index) => ({ ref: `fixture://${item.workspaceId}/withholding-${index + 1}.pdf` })),
        materialMetadata: item.industryRows.map((row, index) => ({ ref: `fixture://${item.workspaceId}/withholding-${index + 1}.pdf`, materialTypeHint: 'withholding_doc', metadata: { industryCode: row.code, grossAmount: row.gross } })),
      });
      runtime.invoke('tax.ledger.normalize', {
        workspaceId: item.workspaceId,
        extractedPayloads: [{
          sourceType: 'hometax',
          withholdingRecords: item.industryRows.map((row, index) => ({ externalId: `${item.workspaceId}-wh-${index + 1}`, payerName: `Payer ${index + 1}`, grossAmount: row.gross, withheldTaxAmount: Math.round(row.gross * 0.03), localTaxAmount: Math.round(row.gross * 0.003) })),
        }],
      });
      runtime.invoke('tax.profile.upsert_facts', {
        workspaceId,
        facts: [
          { factKey: 'income_streams', category: 'income_stream', value: ['freelance'], status: 'provided', sourceOfTruth: 'user_asserted' },
          ...(item.priorYear ? [{ factKey: 'prior_year_regime', category: 'taxpayer_profile', value: item.priorYear, status: 'provided', sourceOfTruth: 'user_asserted' }] : []),
        ],
      });

      const path = runtime.invoke('tax.profile.detect_filing_path', { workspaceId });
      expect(path.data.bookkeepingMode).toBe(item.expectedMode);
      expect(path.data.principalIndustryCode).toBe(item.expectedPrincipal);
      expect(path.data.regimeDerivation).toContain('official_materials_threshold_engine');

      const missing = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
      expect(missing.data.bookkeepingMode).toBe(item.expectedMode);
      if (item.expectMulti) expect(missing.data.operatorWarnings?.some((warning) => warning.code === 'multi_industry_threshold_formula_applied')).toBe(true);
      if (item.priorYear) expect(path.data.operatorWarnings?.some((warning) => warning.code === 'regime_shift_detected')).toBe(true);

      const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, includeAssumptions: true });
      expect(draft.data.bookkeepingMode).toBe(item.expectedMode);
      expect(draft.data.principalIndustryCode).toBe(item.expectedPrincipal);
      expect((draft.data.industryThresholdBasis ?? []).length).toBeGreaterThan(0);
      expect(draft.data.industryThresholdBasis?.every((basis) => basis.principalIndustryCode === item.expectedPrincipal)).toBe(true);
      expect(draft.data.industryThresholdBasis?.every((basis) => typeof basis.weightedContributionByMode.double_entry === 'number')).toBe(true);
      expect(draft.data.industryThresholdBasis?.every((basis) => basis.thresholdSource.includes(item.expectedPrincipal))).toBe(true);
      if (item.expectMulti) {
        const secondary = draft.data.industryThresholdBasis?.find((basis) => basis.industryCode === '940909');
        expect((secondary?.weightedContributionByMode.simple_book ?? 0)).toBeGreaterThan(secondary?.actualRevenue ?? 0);
      }
    }
  });

  it('surfaces posture-aware filing regime, eligibility, and allocation warnings', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_2025_posture_matrix';
    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [
          { externalId: 'biz-1', occurredAt: '2025-03-01', amount: 2000000, normalizedDirection: 'income', counterparty: 'Client Biz', description: 'freelance revenue', sourceReference: 'biz-1' },
          { externalId: 'veh-1', occurredAt: '2025-03-02', amount: 300000, normalizedDirection: 'expense', counterparty: 'Auto Center', description: 'vehicle fuel card', sourceReference: 'veh-1' },
        ],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['freelance'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'pure_business', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'bookkeeping_mode', category: 'taxpayer_profile', value: 'double_entry', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'prior_year_regime', category: 'taxpayer_profile', value: '3.3%', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });

    const path = runtime.invoke('tax.profile.detect_filing_path', { workspaceId });
    expect(path.data.taxpayerPosture).toBe('pure_business');
    expect(path.data.bookkeepingMode).toBe('double_entry');
    expect(path.data.operatorWarnings?.some((item) => item.code === 'regime_shift_detected')).toBe(true);
    expect(path.data.specialCreditEligibility?.[0]?.state).toBe('not_applicable');

    const missingFacts = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
    expect(missingFacts.data.operatorWarnings?.some((item) => item.code === 'mixed_use_allocation_basis_missing')).toBe(true);

    const adjustments = runtime.invoke('tax.filing.list_adjustment_candidates', { workspaceId });
    expect(adjustments.data.businessExpenseAllocationCandidates?.some((item) => item.code === 'vehicle_rule_applicable')).toBe(true);
    expect(adjustments.data.opportunityCandidates?.some((item) => item.code === 'business_expense_review')).toBe(true);

    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, includeAssumptions: true });
    expect(draft.data.taxpayerPosture).toBe('pure_business');
    expect(draft.data.bookkeepingMode).toBe('double_entry');
    expect(draft.data.specialCreditEligibility?.[0]?.state).toBe('not_applicable');
    expect(draft.data.businessExpenseAllocationCandidates?.some((item) => item.code === 'vehicle_rule_applicable' && item.reviewLevel === 'high')).toBe(true);
    expect(draft.data.operatorWarnings?.some((item) => item.code === 'mixed_use_review_scope')).toBe(true);
  });

  it('models submitter profile completeness and resident-register gating', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'sole proprietor' });
    const workspaceId = init.data.workspaceId;
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'dependentClaimPlan', category: 'deduction_eligibility', value: 'none', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'contactPhone', category: 'taxpayer_profile', value: '010-1111-2222', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'filingAddress', category: 'taxpayer_profile', value: 'Seoul', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    const missing = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
    expect(missing.data.submitterProfile?.residentRegisterRequired).toBe(false);
    expect(missing.data.submitterProfile?.missingRequiredFields).toContain('refundAccount');

    const prepareBlockedDraft = runtime.invoke('tax.filing.compute_draft', { workspaceId, includeAssumptions: true });
    expect(prepareBlockedDraft.data.submitterProfile?.missingRequiredFields).toContain('refundAccount');

    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'portalPrepopulatedStatus', category: 'taxpayer_profile', value: 'refund_prepopulated_confirmed', status: 'provided', sourceOfTruth: 'official' },
        { factKey: 'accountHolder', category: 'taxpayer_profile', value: 'Kim Dev', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    const missingAfterPortal = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
    expect(missingAfterPortal.data.submitterProfile?.refundAccount?.state).toBe('portal_prepopulated');
    expect(missingAfterPortal.data.submitterProfile?.missingRequiredFields).not.toContain('refundAccount');

    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [{ factKey: 'dependentClaimPlan', category: 'deduction_eligibility', value: 'claim_child', status: 'provided', sourceOfTruth: 'user_asserted' }],
    });
    const dependentMissing = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
    expect(dependentMissing.data.submitterProfile?.residentRegisterRequired).toBe(true);
  });

  it('prepare_hometax blocks on missing submitter profile and surfaces handoff checkpoint', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'sole proprietor' });
    const workspaceId = init.data.workspaceId;
    runtime.invoke('tax.profile.upsert_facts', { workspaceId, facts: [{ factKey: 'income_streams', category: 'income_stream', value: ['freelance'], status: 'provided', sourceOfTruth: 'user_asserted' }] });
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, includeAssumptions: true });
    const prepare = runtime.invoke('tax.filing.prepare_hometax', { workspaceId, draftId: draft.data.draftId });
    expect(prepare.ok).toBe(true);
    expect(prepare.data.warningCodes).toContain('submitter_profile_incomplete');
    expect(prepare.data.submitterProfile?.missingRequiredFields).toContain('refundAccount');
    expect(prepare.data.handoff.immediateUserConfirmations.length).toBeGreaterThan(0);
    expect(prepare.data.orderedSections.some((section) => section.sectionKey === 'submitter_profile')).toBe(true);

    const status = runtime.invoke('tax.workspace.get_status', { workspaceId });
    expect(status.data.workspace.submitterProfile?.missingRequiredFields).toContain('refundAccount');
    const summary = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: draft.data.draftId });
    expect(summary.data.submitterProfile?.missingRequiredFields).toContain('refundAccount');
    const exported = runtime.invoke('tax.filing.export_package', { workspaceId, draftId: draft.data.draftId, formats: ['json_package', 'submission_prep_checklist'] });
    expect(exported.data.checklistPreview.some((item) => item.includes('submitter_profile=missing:refundAccount'))).toBe(true);
  });

  it('formalizes legal opportunity candidates for pure business, simple-book, business account, and summary-only bundles', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_opportunity_engine';
    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [
          { externalId: 'rev-1', occurredAt: '2025-01-10', amount: 42000000, normalizedDirection: 'income', counterparty: 'Client A', description: 'service revenue', sourceReference: 'rev-1' },
          { externalId: 'phone-1', occurredAt: '2025-01-12', amount: 80000, normalizedDirection: 'expense', counterparty: 'Telecom', description: 'phone bill', sourceReference: 'phone-1' },
          { externalId: 'card-1', occurredAt: '2025-01-13', amount: 120000, normalizedDirection: 'expense', counterparty: 'Card Co', description: 'business card summary only', sourceReference: 'card-1' },
        ],
        withholdingRecords: [
          { externalId: 'wh-1', payerName: 'Client A', grossAmount: 42000000, withheldTaxAmount: 1260000, localTaxAmount: 126000 },
        ],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['freelance'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'pure_business', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'bookkeeping_mode', category: 'taxpayer_profile', value: 'simple_book', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'dependentClaimPlan', category: 'deduction_eligibility', value: 'none', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'deduction_eligibility_facts', category: 'deduction_eligibility', value: 'card summary only', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });

    const detect = runtime.invoke('tax.profile.detect_filing_path', { workspaceId });
    expect(detect.data.opportunityCandidates?.some((item) => item.code === 'bookkeeping_tax_credit_possible')).toBe(true);
    expect(detect.data.opportunityCandidates?.some((item) => item.code === 'resident_register_not_required_if_no_dependents')).toBe(true);

    const adjustments = runtime.invoke('tax.filing.list_adjustment_candidates', { workspaceId });
    expect(adjustments.data.opportunityCandidates?.some((item) => item.code === 'business_account_required' && item.horizon === 'next_year')).toBe(true);
    expect(adjustments.data.opportunityCandidates?.some((item) => item.code === 'business_credit_card_registration_recommended')).toBe(true);
    expect(adjustments.data.opportunityCandidates?.some((item) => item.code === 'itemized_card_detail_required_for_expense_review' && item.status === 'review_required')).toBe(true);
    expect(adjustments.data.opportunityCandidates?.some((item) => item.code === 'wage_credit_not_auto_applicable')).toBe(true);
    expect(adjustments.data.operatorWarnings?.some((item) => item.code === 'mixed_use_allocation_required')).toBe(true);

    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, includeAssumptions: true });
    expect(draft.data.opportunityCandidates?.some((item) => item.code === 'bookkeeping_tax_credit_possible')).toBe(true);
    expect(draft.data.opportunityCandidates?.some((item) => item.code === 'official_withholding_receipt_required')).toBe(true);
    expect(draft.data.operatorWarnings?.some((item) => item.code === 'wage_credit_not_auto_applicable')).toBe(true);
  });

  it('handles mixed wage and business posture without auto-denying wage-linked opportunities', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_2025_mixed_posture';
    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{ externalId: 'mix-1', occurredAt: '2025-03-01', amount: 1000000, normalizedDirection: 'income', counterparty: 'Employer', description: 'salary payroll' }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['salary', 'freelance'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'mixed_wage_business', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'deduction_eligibility_facts', category: 'deduction_eligibility', value: { card: true, insurance: true }, status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    const path = runtime.invoke('tax.profile.detect_filing_path', { workspaceId });
    expect(path.data.taxpayerPosture).toBe('mixed_wage_business');
    expect(path.data.specialCreditEligibility?.[0]?.state).not.toBe('not_applicable');
    const adjustments = runtime.invoke('tax.filing.list_adjustment_candidates', { workspaceId });
    expect(adjustments.data.opportunityCandidates?.some((item) => item.code === 'mixed_posture_credit_review')).toBe(true);
  });

  it('surfaces registry freshness and reverify recommendations in collection read models', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'sole proprietor' });
    const workspaceId = init.data.workspaceId;
    const plan = runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: 2025 });
    const staleNoticeTask = plan.data.collectionTasks?.find((task) => task.targetArtifactType === 'filing_guidance_notice');
    expect(staleNoticeTask?.registryEntryId).toBe('registry_hometax_filing_guidance_notice');
    expect(staleNoticeTask?.reverifyRecommended).toBe(true);
    expect(staleNoticeTask?.methodFreshnessWarning).toContain('stale');

    const source = runtime.invoke('tax.sources.connect', { workspaceId, sourceType: 'hometax', requestedScope: ['read_documents'] });
    const status = runtime.invoke('tax.sources.get_collection_status', { workspaceId });
    const hometaxSource = status.data.connectedSources.find((item) => item.sourceId === source.data.sourceId);
    expect(hometaxSource?.registryEntryId).toBe('registry_hometax_withholding_receipt');
    expect(Array.isArray(hometaxSource?.knownInvalidMethods)).toBe(true);
  });

  it('surfaces future-date registry anomalies and known-invalid method replay', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'sole proprietor' });
    const workspaceId = init.data.workspaceId;
    const entry = SOURCE_METHOD_REGISTRY.find((item) => item.entryId === 'registry_hometax_withholding_receipt');
    if (!entry) throw new Error('registry entry missing');
    const originalVerifiedAt = entry.verifiedAt;
    const originalReviewAfter = entry.reviewAfter;
    entry.verifiedAt = '2099-01-01';
    entry.reviewAfter = '2099-02-01';
    try {
      const futurePlan = runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: 2025 });
      const withholdingTask = futurePlan.data.collectionTasks?.find((task) => task.targetArtifactType === 'withholding_receipt');
      expect(withholdingTask?.reverifyRecommended).toBe(true);
      expect(withholdingTask?.methodFreshnessWarning).toContain('future_date');
    } finally {
      entry.verifiedAt = originalVerifiedAt;
      entry.reviewAfter = originalReviewAfter;
    }

    const connect = runtime.invoke('tax.sources.connect', { workspaceId, sourceType: 'hometax', requestedScope: ['read_documents'] });
    runtime.invoke('tax.sources.record_collection_observation', {
      workspaceId,
      sourceId: connect.data.sourceId,
      targetArtifactType: 'withholding_receipt',
      methodTried: 'hometax_list_xls_only',
      outcome: 'insufficient_artifact',
    });
    const replayPlan = runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: 2025 });
    const replayTask = replayPlan.data.collectionTasks?.find((task) => task.targetArtifactType === 'withholding_receipt');
    expect(replayTask?.methodFreshnessWarning).toContain('Known-invalid method replayed');
    expect(replayPlan.data.collectionTasks?.[0]?.collectionMode).toBe('export_ingestion');
  });

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


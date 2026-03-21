import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';

type ScenarioFixture = {
  scenarioId: string;
  label: string;
  filingYear: number;
  taxpayerTypeHint: string;
  facts: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  withholdingRecords: Array<Record<string, unknown>>;
  expected: {
    finalStatus: string;
    remainingBlockers: string[];
    operatorQuestionCount: number;
  };
};

type GoldenTraceRow = {
  tool: string;
  nextRecommendedAction?: string;
  status?: string;
};

const fixtureDir = join(process.cwd(), 'examples', 'acceptance-fixtures');
const fixturePaths = [
  'tier-a-hometax-friendly-simple-path.json',
  'tier-a-freelancer-clear-withholding.json',
  'tier-a-mixed-income-limited-complexity.json',
].map((name) => join(fixtureDir, name));

function loadFixture(path: string): ScenarioFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as ScenarioFixture;
}

function runSupportedPathAcceptance(fixture: ScenarioFixture) {
  const runtime = new InMemoryKoreanTaxMCPRuntime();
  const trace: GoldenTraceRow[] = [];
  let operatorQuestionCount = 0;

  const init = runtime.invoke('tax.setup.init_config', {
    filingYear: fixture.filingYear,
    storageMode: 'local',
    taxpayerTypeHint: fixture.taxpayerTypeHint,
  });
  trace.push({ tool: 'tax.setup.init_config', nextRecommendedAction: init.nextRecommendedAction, status: init.status });
  expect(init.nextRecommendedAction).toBe('tax.sources.plan_collection');

  const workspaceId = init.data.workspaceId;
  const plan = runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: fixture.filingYear });
  trace.push({ tool: 'tax.sources.plan_collection', nextRecommendedAction: plan.nextRecommendedAction, status: plan.status });
  expect(plan.data.nextActionPlan?.recommendedNextAction).toBeTruthy();

  const uploadTransactions = runtime.invoke('tax.import.upload_transactions', {
    workspaceId,
    sourceType: 'statement_pdf',
    refs: [{ ref: `fixture://${fixture.scenarioId}/transactions.csv` }],
  });
  trace.push({ tool: 'tax.import.upload_transactions', nextRecommendedAction: uploadTransactions.nextRecommendedAction, status: uploadTransactions.status });
  expect(uploadTransactions.nextRecommendedAction).toBe('tax.ledger.normalize');

  const uploadDocuments = runtime.invoke('tax.import.upload_documents', {
    workspaceId,
    sourceType: 'evidence_folder',
    refs: fixture.documents.map((document, index) => ({ ref: `fixture://${fixture.scenarioId}/document-${index + 1}.pdf` })),
  });
  trace.push({ tool: 'tax.import.upload_documents', nextRecommendedAction: uploadDocuments.nextRecommendedAction, status: uploadDocuments.status });
  expect(uploadDocuments.nextRecommendedAction).toBeTruthy();

  const normalized = runtime.invoke('tax.ledger.normalize', {
    workspaceId,
    normalizationMode: 'default',
    extractedPayloads: [{
      sourceType: 'statement_pdf',
      transactions: fixture.transactions as never[],
      documents: fixture.documents as never[],
      withholdingRecords: fixture.withholdingRecords as never[],
      provenance: { fixture: fixture.scenarioId },
    }],
  });
  trace.push({ tool: 'tax.ledger.normalize', nextRecommendedAction: normalized.nextRecommendedAction, status: normalized.status });
  expect(normalized.nextRecommendedAction).toBe('tax.classify.run');

  const missingFacts = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
  trace.push({ tool: 'tax.profile.list_missing_facts', nextRecommendedAction: missingFacts.nextRecommendedAction, status: missingFacts.status });
  if ((missingFacts.data.items?.length ?? 0) > 0) operatorQuestionCount += 1;

  const upsertFacts = runtime.invoke('tax.profile.upsert_facts', {
    workspaceId,
    facts: fixture.facts as never[],
  });
  trace.push({ tool: 'tax.profile.upsert_facts', nextRecommendedAction: upsertFacts.nextRecommendedAction, status: upsertFacts.status });
  expect(upsertFacts.nextRecommendedAction).toBeTruthy();

  const filingPath = runtime.invoke('tax.profile.detect_filing_path', { workspaceId });
  trace.push({ tool: 'tax.profile.detect_filing_path', nextRecommendedAction: filingPath.nextRecommendedAction, status: filingPath.status });
  expect(['tier_a', 'tier_b']).toContain(filingPath.data.supportTier);

  const classification = runtime.invoke('tax.classify.run', { workspaceId });
  trace.push({ tool: 'tax.classify.run', nextRecommendedAction: classification.nextRecommendedAction, status: classification.status });
  expect(classification.data.reviewItems).toBeDefined();

  const reviewItems = runtime.invoke('tax.classify.list_review_items', { workspaceId });
  trace.push({ tool: 'tax.classify.list_review_items', nextRecommendedAction: reviewItems.nextRecommendedAction, status: reviewItems.status });
  if (reviewItems.data.items.length > 0) operatorQuestionCount += 1;

  if (reviewItems.data.items.length > 0) {
    const resolved = runtime.invoke('tax.classify.resolve_review_item', {
      reviewItemIds: reviewItems.data.items.map((item) => item.reviewItemId),
      selectedOption: 'keep_draft_value',
      rationale: 'acceptance suite grouped review resolution',
      approverIdentity: 'acceptance:operator',
    });
    trace.push({ tool: 'tax.classify.resolve_review_item', nextRecommendedAction: resolved.nextRecommendedAction, status: resolved.status });
    expect(resolved.nextRecommendedAction).toBe('tax.filing.compute_draft');
  }

  const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId });
  trace.push({ tool: 'tax.filing.compute_draft', nextRecommendedAction: draft.nextRecommendedAction, status: draft.status });
  expect(['draft_ready', 'submission_assist_ready']).toContain(draft.readiness?.draftReadiness ?? '');
  expect(draft.data.draftFieldValues?.length ?? 0).toBeGreaterThan(0);

  const refreshed = runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId: draft.data.draftId });
  trace.push({ tool: 'tax.filing.refresh_official_data', nextRecommendedAction: refreshed.nextRecommendedAction, status: refreshed.status });
  expect(refreshed.nextRecommendedAction).toBeTruthy();

  const compare = runtime.invoke('tax.filing.compare_with_hometax', {
    workspaceId,
    draftId: draft.data.draftId,
    portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({
      sectionKey: field.sectionKey,
      fieldKey: field.fieldKey,
      portalObservedValue: field.value,
    })),
  });
  trace.push({ tool: 'tax.filing.compare_with_hometax', nextRecommendedAction: compare.nextRecommendedAction, status: compare.status });
  expect(compare.data.materialMismatches.length).toBe(0);

  const prepare = runtime.invoke('tax.filing.prepare_hometax', { workspaceId, draftId: draft.data.draftId });
  trace.push({ tool: 'tax.filing.prepare_hometax', nextRecommendedAction: prepare.nextRecommendedAction, status: prepare.status });
  expect(prepare.data.orderedSections.length).toBeGreaterThan(0);

  const startAssist = runtime.invoke('tax.browser.start_hometax_assist', { workspaceId, draftId: draft.data.draftId });
  trace.push({ tool: 'tax.browser.start_hometax_assist', nextRecommendedAction: startAssist.nextRecommendedAction, status: startAssist.status });
  if (startAssist.requiresAuth || startAssist.data.authRequired) operatorQuestionCount += 1;
  expect(startAssist.data.entryPlan?.orderedSections.length).toBeGreaterThan(0);

  const resumeAssist = runtime.invoke('tax.browser.resume_hometax_assist', { workspaceId });
  trace.push({ tool: 'tax.browser.resume_hometax_assist', nextRecommendedAction: resumeAssist.nextRecommendedAction, status: resumeAssist.status });
  expect(resumeAssist.data.handoff.entryPlan?.orderedSections.length).toBeGreaterThan(0);

  const approval = runtime.invoke('tax.filing.record_submission_approval', {
    workspaceId,
    draftId: draft.data.draftId,
    approvedBy: 'acceptance:operator',
  });
  operatorQuestionCount += 1;
  trace.push({ tool: 'tax.filing.record_submission_approval', nextRecommendedAction: approval.nextRecommendedAction, status: approval.status });
  expect(approval.nextRecommendedAction).toBe('tax.browser.record_submission_result');

  const submissionResult = runtime.invoke('tax.browser.record_submission_result', {
    workspaceId,
    draftId: draft.data.draftId,
    result: 'success',
    portalSummary: `${fixture.scenarioId} success`,
    receiptArtifactRefs: [`receipt_${fixture.scenarioId}`],
    receiptNumber: `receipt-${fixture.scenarioId}`,
    submittedAt: '2026-03-21T03:00:00.000Z',
  });
  trace.push({ tool: 'tax.browser.record_submission_result', nextRecommendedAction: submissionResult.nextRecommendedAction, status: submissionResult.status });
  expect(submissionResult.data.submissionResult.result).toBe('success');

  const exportPackage = runtime.invoke('tax.filing.export_package', {
    workspaceId,
    draftId: draft.data.draftId,
    formats: ['json_package', 'csv_review_report', 'evidence_index', 'submission_prep_checklist', 'submission_receipt_bundle'],
  });
  trace.push({ tool: 'tax.filing.export_package', nextRecommendedAction: exportPackage.nextRecommendedAction, status: exportPackage.status });
  expect(exportPackage.data.unresolvedBlockers).toEqual(expect.any(Array));
  expect(exportPackage.data.checklistPreview).toEqual(expect.arrayContaining([
    expect.stringContaining('final_approval='),
    expect.stringContaining('receipt_confirmation='),
  ]));
  expect(exportPackage.data.includedFormats).toContain('submission_receipt_bundle');

  const finalStatus = runtime.invoke('tax.workspace.get_status', { workspaceId });
  trace.push({ tool: 'tax.workspace.get_status', nextRecommendedAction: finalStatus.nextRecommendedAction, status: finalStatus.status });

  const summary = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: draft.data.draftId });
  trace.push({ tool: 'tax.filing.get_summary', nextRecommendedAction: summary.nextRecommendedAction, status: summary.status });

  return {
    fixture,
    trace,
    finalStatus: finalStatus.data.workspace.status,
    remainingBlockers: finalStatus.data.stopReasonCodes ?? [],
    operatorQuestionCount,
    readinessTimeline: {
      estimate: filingPath.readiness?.estimateReadiness,
      draft: draft.readiness?.draftReadiness,
      submission: compare.readiness?.submissionReadiness,
    },
    exportPackage,
    summary,
  };
}

describe('supported-path acceptance suite', () => {
  for (const fixturePath of fixturePaths) {
    const fixture = loadFixture(fixturePath);

    it(`completes supported path acceptance for ${fixture.label}`, () => {
      const result = runSupportedPathAcceptance(fixture);

      expect(result.trace.map((row) => row.tool)).toEqual([
        'tax.setup.init_config',
        'tax.sources.plan_collection',
        'tax.import.upload_transactions',
        'tax.import.upload_documents',
        'tax.ledger.normalize',
        'tax.profile.list_missing_facts',
        'tax.profile.upsert_facts',
        'tax.profile.detect_filing_path',
        'tax.classify.run',
        'tax.classify.list_review_items',
        ...(result.trace.some((row) => row.tool === 'tax.classify.resolve_review_item') ? ['tax.classify.resolve_review_item'] : []),
        'tax.filing.compute_draft',
        'tax.filing.refresh_official_data',
        'tax.filing.compare_with_hometax',
        'tax.filing.prepare_hometax',
        'tax.browser.start_hometax_assist',
        'tax.browser.resume_hometax_assist',
        'tax.filing.record_submission_approval',
        'tax.browser.record_submission_result',
        'tax.filing.export_package',
        'tax.workspace.get_status',
        'tax.filing.get_summary',
      ]);
      expect(result.finalStatus).toBe(fixture.expected.finalStatus);
      expect(result.remainingBlockers).toEqual(fixture.expected.remainingBlockers);
      expect(result.operatorQuestionCount).toBe(fixture.expected.operatorQuestionCount);
      expect(result.readinessTimeline).toEqual({
        estimate: 'estimate_ready',
        draft: expect.stringMatching(/draft_ready|submission_assist_ready/),
        submission: 'submission_assist_ready',
      });
      expect(result.summary.data.submissionResult?.receiptNumber).toContain('receipt-');
    });
  }

  it('stops unsupported/manual-heavy case before submission assist', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const init = runtime.invoke('tax.setup.init_config', {
      filingYear: 2025,
      storageMode: 'local',
      taxpayerTypeHint: 'mixed_income_individual',
    });
    const workspaceId = init.data.workspaceId;

    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{
          externalId: 'txn-unsupported-1',
          occurredAt: '2025-04-01',
          amount: 1000000,
          normalizedDirection: 'income',
          counterparty: 'Platform X',
          description: 'platform payout',
          sourceReference: 'txn-unsupported-1',
        }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { category: 'taxpayer_profile', factKey: 'taxpayer_posture', value: 'mixed_income_individual', status: 'provided', sourceOfTruth: 'user_asserted', confidence: 0.95 },
        { category: 'income_stream', factKey: 'income_streams', value: ['platform'], status: 'provided', sourceOfTruth: 'user_asserted', confidence: 0.95 },
        { category: 'special_case', factKey: 'legal_interpretation_required', value: true, status: 'provided', sourceOfTruth: 'user_asserted', confidence: 0.95 },
      ],
    });
    const filingPath = runtime.invoke('tax.profile.detect_filing_path', { workspaceId });
    expect(filingPath.data.supportTier).toBe('tier_c');

    runtime.invoke('tax.classify.run', { workspaceId });
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId });
    expect(draft.data.stopReasonCodes).toEqual(expect.arrayContaining(['tier_c_stop']));

    const prepare = runtime.invoke('tax.filing.prepare_hometax', { workspaceId, draftId: draft.data.draftId });
    expect(prepare.ok).toBe(false);
    expect(prepare.blockingReason).toBeTruthy();
  });
});

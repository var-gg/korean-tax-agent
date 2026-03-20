import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { SUPPORTED_RUNTIME_TOOLS } from '../packages/mcp-server/src/facade.js';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import type {
  ClassificationDecision,
  ConsentRecord,
  CoverageGap,
  EvidenceDocument,
  FilingFieldValue,
  FilingWorkspace,
  LedgerTransaction,
  SourceArtifact,
  SourceConnection,
  SyncAttempt,
  TaxpayerFact,
  WithholdingRecord,
} from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  filingYear: number;
  workspace: FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: CoverageGap[];
  sourceArtifacts: SourceArtifact[];
  evidenceDocuments: EvidenceDocument[];
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

const VALID_NEXT_ACTIONS = new Set<string>(SUPPORTED_RUNTIME_TOOLS);

function expectCallableNextAction(action: string | undefined) {
  expect(action).toBeTruthy();
  expect(VALID_NEXT_ACTIONS.has(action as string)).toBe(true);
}

function createSeededRuntime(options?: { consentRecords?: ConsentRecord[]; withholdingRecords?: WithholdingRecord[] }) {
  return new InMemoryKoreanTaxMCPRuntime({
    consentRecords: options?.consentRecords ?? demo.consentRecords,
    workspaces: [demo.workspace],
    sources: demo.sources.filter((source) => source.sourceType !== 'hometax'),
    syncAttempts: [],
    coverageGapsByWorkspace: {
      [demo.workspaceId]: demo.coverageGaps,
    },
    sourceArtifacts: demo.sourceArtifacts,
    evidenceDocuments: demo.evidenceDocuments,
    transactions: demo.transactions,
    decisions: demo.decisions,
    taxpayerFacts: seededTaxpayerFacts,
    withholdingRecords: options?.withholdingRecords ?? seededWithholdingRecords,
  });
}

describe('external AI agent integration contract', () => {
  it('keeps the end-to-end happy path agent-callable from init to resume_hometax_assist', () => {
    const runtime = createSeededRuntime();

    const inspectResult = runtime.invoke('tax.setup.inspect_environment', {});
    expectCallableNextAction(inspectResult.nextRecommendedAction);
    expect(inspectResult.nextRecommendedAction).toBe('tax.setup.init_config');

    const initResult = runtime.invoke('tax.setup.init_config', {
      filingYear: demo.filingYear,
      storageMode: 'local',
      workspacePath: `./workspaces/${demo.workspaceId}`,
      taxpayerTypeHint: 'mixed_income_individual',
    });
    expectCallableNextAction(initResult.nextRecommendedAction);
    expect(initResult.nextRecommendedAction).toBe('tax.sources.plan_collection');

    const planResult = runtime.invoke('tax.sources.plan_collection', {
      workspaceId: demo.workspaceId,
      filingYear: demo.filingYear,
    });
    expectCallableNextAction(planResult.nextRecommendedAction);
    expect(planResult.nextRecommendedAction).toBe('tax.sources.connect');

    const connectResult = runtime.invoke('tax.sources.connect', {
      workspaceId: demo.workspaceId,
      sourceType: 'hometax',
      requestedScope: ['read_documents', 'prepare_import'],
    });
    expect(connectResult.status).toBe('awaiting_auth');
    expect(connectResult.requiresAuth).toBe(true);
    expect(connectResult.checkpointType).toBe('authentication');
    expectCallableNextAction(connectResult.nextRecommendedAction);
    expect(connectResult.nextRecommendedAction).toBe('tax.sources.resume_sync');

    const syncResult = runtime.invoke('tax.sources.sync', {
      sourceId: connectResult.data.sourceId,
      syncMode: 'full',
    });
    expect(syncResult.status).toBe('awaiting_user_action');
    expect(syncResult.blockingReason).toBe('export_required');
    expectCallableNextAction(syncResult.nextRecommendedAction);
    expect(syncResult.nextRecommendedAction).toBe('tax.sources.resume_sync');

    const resumeSyncResult = runtime.invoke('tax.sources.resume_sync', {
      sourceId: connectResult.data.sourceId,
      checkpointId: syncResult.checkpointId,
      resumeToken: syncResult.resumeToken,
    });
    expect(resumeSyncResult.status).toBe('completed');
    expectCallableNextAction(resumeSyncResult.nextRecommendedAction);
    expect(resumeSyncResult.nextRecommendedAction).toBe('tax.ledger.normalize');

    const normalizeResult = runtime.invoke('tax.ledger.normalize', {
      workspaceId: demo.workspaceId,
      artifactIds: ['artifact_csv_1'],
    });
    expect(normalizeResult.status).toBe('completed');
    expectCallableNextAction(normalizeResult.nextRecommendedAction);
    expect(normalizeResult.nextRecommendedAction).toBe('tax.classify.run');

    const classifyResult = runtime.invoke('tax.classify.run', {
      workspaceId: demo.workspaceId,
      rulesetVersion: 'agent-contract-v1',
    });
    expect(classifyResult.status).toBe('completed');
    expectCallableNextAction(classifyResult.nextRecommendedAction);
    expect(classifyResult.nextRecommendedAction).toBe('tax.classify.list_review_items');

    const reviewItems = runtime.invoke('tax.classify.list_review_items', {
      workspaceId: demo.workspaceId,
    });

    const blockedDraft = runtime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'refresh',
      includeAssumptions: true,
    });
    expect(blockedDraft.status).toBe('blocked');
    expect(blockedDraft.blockingReason).toBe('awaiting_review_decision');
    expectCallableNextAction(blockedDraft.nextRecommendedAction);
    expect(blockedDraft.nextRecommendedAction).toBe('tax.classify.list_review_items');

    const resolveReviewResult = runtime.invoke('tax.classify.resolve_review_item', {
      reviewItemIds: reviewItems.data.items.map((item) => item.reviewItemId),
      selectedOption: 'exclude_from_expense',
      rationale: 'clear unresolved review queue before drafting',
      approverIdentity: 'external_agent_test',
    });
    expect(resolveReviewResult.status).toBe('completed');
    expectCallableNextAction(resolveReviewResult.nextRecommendedAction);
    expect(resolveReviewResult.nextRecommendedAction).toBe('tax.filing.compute_draft');

    const draftResult = runtime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'new_version',
      includeAssumptions: true,
    });
    expect(draftResult.status).toBe('completed');
    expectCallableNextAction(draftResult.nextRecommendedAction);
    expect(draftResult.nextRecommendedAction).toBe('tax.filing.compare_with_hometax');

    const prepareBeforeCompare = runtime.invoke('tax.filing.prepare_hometax', {
      workspaceId: demo.workspaceId,
      draftId: draftResult.data.draftId,
    });
    expect(prepareBeforeCompare.status).toBe('blocked');
    expect(prepareBeforeCompare.blockingReason).toBe('comparison_incomplete');
    expectCallableNextAction(prepareBeforeCompare.nextRecommendedAction);
    expect(prepareBeforeCompare.nextRecommendedAction).toBe('tax.classify.list_review_items');

    const compareResult = runtime.invoke('tax.filing.compare_with_hometax', {
      workspaceId: demo.workspaceId,
      draftId: draftResult.data.draftId,
      comparisonMode: 'visible_portal',
      sectionKeys: ['income', 'expenses', 'withholding'],
    });
    expect(compareResult.status).toBe('completed');
    expectCallableNextAction(compareResult.nextRecommendedAction);
    expect(compareResult.nextRecommendedAction).toBe('tax.filing.prepare_hometax');

    const prepareResult = runtime.invoke('tax.filing.prepare_hometax', {
      workspaceId: demo.workspaceId,
      draftId: draftResult.data.draftId,
    });
    expect(prepareResult.status).toBe('completed');
    expectCallableNextAction(prepareResult.nextRecommendedAction);
    expect(prepareResult.nextRecommendedAction).toBe('tax.browser.start_hometax_assist');

    const startAssistResult = runtime.invoke('tax.browser.start_hometax_assist', {
      workspaceId: demo.workspaceId,
      draftId: draftResult.data.draftId,
      mode: 'fill_assist',
    });
    expect(startAssistResult.status).toBe('awaiting_auth');
    expectCallableNextAction(startAssistResult.nextRecommendedAction);
    expect(startAssistResult.nextRecommendedAction).toBe('tax.browser.resume_hometax_assist');

    const resumeAssistResult = runtime.invoke('tax.browser.resume_hometax_assist', {
      workspaceId: demo.workspaceId,
      assistSessionId: startAssistResult.data.assistSessionId,
    });
    expect(resumeAssistResult.status).toBe('awaiting_auth');
    expectCallableNextAction(resumeAssistResult.nextRecommendedAction);
    expect(resumeAssistResult.nextRecommendedAction).toBe('tax.browser.resume_hometax_assist');
  });

  it('surfaces blocked states the external agent must stop on and exposes typed workspace status', () => {
    const noConsentRuntime = createSeededRuntime({ consentRecords: [] });
    const consentBlocked = noConsentRuntime.invoke('tax.sources.connect', {
      workspaceId: demo.workspaceId,
      sourceType: 'hometax',
      requestedScope: ['read_documents', 'prepare_import'],
    });
    expect(consentBlocked.status).toBe('awaiting_consent');
    expect(consentBlocked.blockingReason).toBe('missing_consent');
    expect(consentBlocked.checkpointType).toBe('source_consent');
    expect(consentBlocked.requiresConsent).toBe(true);
    expect(consentBlocked.nextRecommendedAction).toBeUndefined();

    const noWithholdingRuntime = createSeededRuntime({ withholdingRecords: [] });
    const normalizeResult = noWithholdingRuntime.invoke('tax.ledger.normalize', {
      workspaceId: demo.workspaceId,
      artifactIds: ['artifact_csv_1'],
    });
    expect(normalizeResult.data.coverageGapsCreated.some((gap) => gap.gapType === 'missing_expense_evidence')).toBe(true);

    const collectionStatus = noWithholdingRuntime.invoke('tax.sources.get_collection_status', {
      workspaceId: demo.workspaceId,
    });
    expect(collectionStatus.data.coverageGaps.some((gap) => gap.gapType === 'missing_withholding_record')).toBe(true);
    expect(collectionStatus.data.coverageGaps.some((gap) => gap.gapType === 'missing_expense_evidence')).toBe(true);

    const workspaceStatus = noWithholdingRuntime.invoke('tax.workspace.get_status', {
      workspaceId: demo.workspaceId,
    });
    expect(workspaceStatus.data.workspace.openCoverageGapCount).toBeGreaterThan(0);
    expect(workspaceStatus.data.workspace.lastBlockingReason).toBe('comparison_incomplete');
    expectCallableNextAction(workspaceStatus.data.nextRecommendedAction);
    expect(workspaceStatus.data.nextRecommendedAction).toBe('tax.filing.compare_with_hometax');

    noWithholdingRuntime.invoke('tax.classify.run', {
      workspaceId: demo.workspaceId,
      rulesetVersion: 'agent-contract-v1',
    });

    const reviewItems = noWithholdingRuntime.invoke('tax.classify.list_review_items', {
      workspaceId: demo.workspaceId,
    });
    const blockedDraft = noWithholdingRuntime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'refresh',
      includeAssumptions: true,
    });
    expect(blockedDraft.status).toBe('blocked');
    expect(blockedDraft.blockingReason).toBe('awaiting_review_decision');
    expectCallableNextAction(blockedDraft.nextRecommendedAction);

    noWithholdingRuntime.invoke('tax.classify.resolve_review_item', {
      reviewItemIds: reviewItems.data.items.map((item) => item.reviewItemId),
      selectedOption: 'exclude_from_expense',
      rationale: 'resolve initial review blockers before checking coverage blockers',
      approverIdentity: 'external_agent_test',
    });

    const coverageBlockedDraft = noWithholdingRuntime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'new_version',
      includeAssumptions: true,
    });
    expect(coverageBlockedDraft.status).toBe('blocked');
    expect(coverageBlockedDraft.blockingReason).toBe('missing_material_coverage');
    expectCallableNextAction(coverageBlockedDraft.nextRecommendedAction);
    expect(coverageBlockedDraft.nextRecommendedAction).toBe('tax.classify.list_review_items');

    const blockedWorkspaceStatus = noWithholdingRuntime.invoke('tax.workspace.get_status', {
      workspaceId: demo.workspaceId,
    });
    expect(blockedWorkspaceStatus.data.runtimeSnapshot?.coverageByDomain?.withholdingPrepaidTax).toBe('weak');
    expect(blockedWorkspaceStatus.data.runtimeSnapshot?.coverageByDomain?.expenseEvidence).toBe('weak');
  });

  it('routes comparison mismatches back into review and keeps compare inputs aligned with portal-observed values', () => {
    const runtime = createSeededRuntime();

    const draftResult = runtime.invoke('tax.filing.compute_draft', {
      workspaceId: demo.workspaceId,
      draftMode: 'new_version',
      includeAssumptions: true,
    });

    const draft = runtime.getDraft(demo.workspaceId);
    const fieldValues = (draft?.fieldValues ?? []) as FilingFieldValue[];
    expect(fieldValues.length).toBeGreaterThan(0);

    const targetField = fieldValues[0]!;
    const portalObservedValue = typeof targetField.value === 'number' ? Number(targetField.value) + 200000 : 'PORTAL_OVERRIDE_VALUE';

    const compareResult = runtime.invoke('tax.filing.compare_with_hometax', {
      workspaceId: demo.workspaceId,
      draftId: draftResult.data.draftId,
      comparisonMode: 'visible_portal',
      sectionKeys: [targetField.sectionKey],
      portalObservedFields: [{
        fieldKey: targetField.fieldKey,
        sectionKey: targetField.sectionKey,
        observedValue: portalObservedValue,
        observedAt: '2026-03-20T09:00:00Z',
        evidenceRef: 'browser://snapshot/section-income',
      }],
    });

    expect(compareResult.data.materialMismatches.length).toBeGreaterThan(0);
    expect(compareResult.nextRecommendedAction).toBe('tax.classify.list_review_items');
    expectCallableNextAction(compareResult.nextRecommendedAction);
    expect(runtime.listReviewItems(demo.workspaceId).some((item) => item.reasonCode === 'hometax_material_mismatch')).toBe(true);

    const filingSummary = runtime.invoke('tax.filing.get_summary', { workspaceId: demo.workspaceId });
    expect(filingSummary.data.blockers).toContain('comparison_incomplete');
    expect(filingSummary.data.nextRecommendedAction).toBe('tax.filing.compare_with_hometax');
    expectCallableNextAction(filingSummary.data.nextRecommendedAction);
  });
});

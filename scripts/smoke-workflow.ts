import rawDemo from '../examples/demo-workspace.json';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import type {
  ClassificationDecision,
  ConsentRecord,
  EvidenceDocument,
  FilingWorkspace,
  LedgerTransaction,
  SourceArtifact,
  SourceConnection,
  SyncAttempt,
} from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  filingYear: number;
  workspace: FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: Array<{ description: string }>;
  sourceArtifacts: SourceArtifact[];
  evidenceDocuments: EvidenceDocument[];
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`SMOKE FAILED: ${message}`);
  }
}

const runtime = new InMemoryKoreanTaxMCPRuntime({
  consentRecords: demo.consentRecords,
  sources: demo.sources.filter((source) => source.sourceType !== 'hometax'),
  syncAttempts: [],
  coverageGapsByWorkspace: {
    [demo.workspaceId]: demo.coverageGaps.map((gap) => gap.description),
  },
  sourceArtifacts: demo.sourceArtifacts,
  evidenceDocuments: demo.evidenceDocuments,
  transactions: demo.transactions,
  decisions: demo.decisions,
});

const inspectResult = runtime.invoke('tax.setup.inspect_environment', {});
assert(inspectResult.status === 'completed', 'inspect_environment should complete');
assert(inspectResult.nextRecommendedAction === 'tax.setup.init_config', 'inspect_environment should recommend init_config');

const initResult = runtime.invoke('tax.setup.init_config', {
  filingYear: demo.filingYear,
  storageMode: 'local',
  workspacePath: `./workspaces/${demo.workspaceId}`,
  taxpayerTypeHint: 'demo',
});
assert(initResult.status === 'completed', 'init_config should complete');
assert(initResult.nextRecommendedAction === 'tax.sources.plan_collection', 'init_config should recommend source planning');

const planResult = runtime.invoke('tax.sources.plan_collection', {
  workspaceId: demo.workspaceId,
  filingYear: demo.filingYear,
});
assert(planResult.status === 'completed', 'plan_collection should complete');
assert(planResult.nextRecommendedAction === 'tax.sources.connect', 'plan_collection should recommend connect');

const connectResult = runtime.invoke('tax.sources.connect', {
  workspaceId: demo.workspaceId,
  sourceType: 'hometax',
  requestedScope: ['read_documents', 'prepare_import'],
});
assert(connectResult.status === 'awaiting_auth', 'connect should reach auth checkpoint');

const syncResult = runtime.invoke('tax.sources.sync', {
  sourceId: connectResult.data.sourceId,
  syncMode: 'full',
});
assert(syncResult.status === 'awaiting_user_action', 'sync should block awaiting user action');

const resumeResult = runtime.invoke('tax.sources.resume_sync', {
  sourceId: connectResult.data.sourceId,
  checkpointId: syncResult.checkpointId,
  resumeToken: syncResult.resumeToken,
});
assert(resumeResult.status === 'completed', 'resume_sync should complete');
assert(resumeResult.nextRecommendedAction === 'tax.ledger.normalize', 'resume_sync should recommend normalize');

const normalizeResult = runtime.invoke('tax.ledger.normalize', {
  workspaceId: demo.workspaceId,
  artifactIds: ['artifact_csv_1'],
});
assert(normalizeResult.status === 'completed', 'normalize should complete');
assert(normalizeResult.data.transactionCount === 3, 'normalize should report all demo transactions');
assert(normalizeResult.data.documentCount === 2, 'normalize should report linked demo documents');
assert(normalizeResult.nextRecommendedAction === 'tax.classify.run', 'normalize should recommend classification');

const detectResult = runtime.invoke('tax.profile.detect_filing_path', {
  workspaceId: demo.workspaceId,
});

assert(detectResult.status === 'completed', 'detect_filing_path should complete');
assert(!!detectResult.readiness?.supportTier, 'detect_filing_path should return readiness supportTier');

const classifyResult = runtime.invoke('tax.classify.run', {
  workspaceId: demo.workspaceId,
  rulesetVersion: 'smoke-v2',
});

assert(classifyResult.status === 'completed', 'classification should complete');
assert((classifyResult.data.reviewItems ?? []).length > 0, 'classification should generate review items');

const listedReviewItems = runtime.invoke('tax.classify.list_review_items', {
  workspaceId: demo.workspaceId,
});

assert(listedReviewItems.data.items.length > 0, 'review queue should contain items');

const initialDraftResult = runtime.invoke('tax.filing.compute_draft', {
  workspaceId: demo.workspaceId,
  draftMode: 'refresh',
  includeAssumptions: true,
});

assert(initialDraftResult.status === 'blocked', 'initial draft compute should be blocked until review decisions are resolved');
assert(initialDraftResult.blockingReason === 'awaiting_review_decision', 'initial draft should expose awaiting_review_decision as the blocking reason');
assert(initialDraftResult.checkpointType === 'review_judgment', 'initial draft should surface review_judgment checkpoint');
assert(initialDraftResult.readiness?.blockerCodes?.includes('awaiting_review_decision'), 'initial draft should flag awaiting review decision');

const resolveReviewResult = runtime.invoke('tax.classify.resolve_review_item', {
  reviewItemIds: listedReviewItems.data.items.map((item) => item.reviewItemId),
  selectedOption: 'exclude_from_expense',
  rationale: 'smoke test baseline resolution',
  approverIdentity: 'smoke_user',
});

assert(resolveReviewResult.status === 'completed', 'baseline review resolution should complete');

const resolvedDraftResult = runtime.invoke('tax.filing.compute_draft', {
  workspaceId: demo.workspaceId,
  draftMode: 'new_version',
  includeAssumptions: true,
});

assert(resolvedDraftResult.status === 'completed', 'resolved draft should complete');
assert(resolvedDraftResult.readiness?.draftReadiness === 'draft_ready', 'resolved draft should be draft_ready');

const refreshResult = runtime.invoke('tax.filing.refresh_official_data', {
  workspaceId: demo.workspaceId,
  sourceIds: ['src_hometax_main'],
  refreshPolicy: 'if_stale_or_user_requested',
  recomputeDraft: true,
});

assert(refreshResult.status === 'completed', 'official data refresh should complete');
assert(refreshResult.readiness?.freshnessState === 'current_enough', 'refresh should move freshness to current_enough');

const draft = runtime.getDraft(demo.workspaceId);
assert((draft?.fieldValues?.length ?? 0) > 0, 'runtime draft should contain field values');

const targetField = draft!.fieldValues![0]!;
const portalOverride = typeof targetField.value === 'number' ? Number(targetField.value) + 200000 : 'PORTAL_OVERRIDE_VALUE';
draft!.fieldValues![0] = {
  ...targetField,
  portalObservedValue: portalOverride,
};

const compareMismatchResult = runtime.invoke('tax.filing.compare_with_hometax', {
  workspaceId: demo.workspaceId,
  draftId: resolvedDraftResult.data.draftId,
  comparisonMode: 'visible_portal',
  sectionKeys: ['income', 'expenses', 'withholding'],
});

assert(compareMismatchResult.data.materialMismatches.length > 0, 'comparison should find a material mismatch after portal override');
assert(compareMismatchResult.nextRecommendedAction === 'tax.classify.list_review_items', 'mismatch should recommend review queue');

const mismatchReviewItems = runtime
  .listReviewItems(demo.workspaceId)
  .filter((item) => item.reasonCode === 'hometax_material_mismatch');

assert(mismatchReviewItems.length > 0, 'mismatch comparison should create review items');

const resolveMismatchResult = runtime.invoke('tax.classify.resolve_review_item', {
  reviewItemIds: mismatchReviewItems.map((item) => item.reviewItemId),
  selectedOption: 'accept_portal_value',
  rationale: 'portal is authoritative in smoke flow',
  approverIdentity: 'smoke_user',
});

assert(resolveMismatchResult.status === 'completed', 'mismatch review resolution should complete');

const postResolveDraft = runtime.getDraft(demo.workspaceId);
const updatedField = postResolveDraft?.fieldValues?.find((field) => field.filingFieldValueId === targetField.filingFieldValueId);
assert(updatedField?.value === portalOverride, 'resolved mismatch should update draft field value from portal');
assert(updatedField?.comparisonState === 'matched', 'resolved mismatch should leave field matched');
assert(postResolveDraft?.comparisonSummaryState !== 'material_mismatch', 'resolved mismatch should clear material_mismatch summary');

const prepareResult = runtime.invoke('tax.filing.prepare_hometax', {
  workspaceId: demo.workspaceId,
  draftId: resolvedDraftResult.data.draftId,
});

assert(prepareResult.status === 'completed', 'prepare_hometax should complete after mismatch resolution');
assert(prepareResult.data.browserAssistReady === true, 'prepare_hometax should mark browser assist ready');
assert(prepareResult.readiness?.submissionReadiness === 'submission_assist_ready', 'prepare_hometax should be submission_assist_ready');

const assistResult = runtime.invoke('tax.browser.start_hometax_assist', {
  workspaceId: demo.workspaceId,
  draftId: resolvedDraftResult.data.draftId,
  mode: 'guide_only',
});

assert(assistResult.status === 'awaiting_auth', 'browser assist should begin at auth checkpoint');
assert(assistResult.checkpointType === 'authentication', 'browser assist checkpointType should be authentication');

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: 'workflow',
      summary: {
        inspectStatus: inspectResult.status,
        initStatus: initResult.status,
        planStatus: planResult.status,
        connectStatus: connectResult.status,
        syncStatus: syncResult.status,
        resumeStatus: resumeResult.status,
        normalizeStatus: normalizeResult.status,
        detectStatus: detectResult.status,
        classifyStatus: classifyResult.status,
        initialDraftStatus: initialDraftResult.status,
        refreshStatus: refreshResult.status,
        compareMismatchStatus: compareMismatchResult.status,
        mismatchReviewCount: mismatchReviewItems.length,
        resolveMismatchStatus: resolveMismatchResult.status,
        prepareStatus: prepareResult.status,
        assistStatus: assistResult.status,
      },
    },
    null,
    2,
  ),
);

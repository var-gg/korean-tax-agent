import rawDemo from '../examples/demo-workspace.json';
import { summarizeReviewQueue } from '../packages/core/src/review.js';
import { evaluateConsent } from '../packages/core/src/consent.js';
import {
  completeSyncAttempt,
  createAuditEvent,
  createCoverageGap,
  createSourceConnection,
  deriveWorkspaceStatus,
  startSyncAttempt,
  summarizeCoverageGaps,
  transitionSourceState,
  updateWorkspaceProgress,
} from '../packages/core/src/state.js';
import type { ClassificationDecision, ConsentRecord, FilingWorkspace, LedgerTransaction, ReviewItem } from '../packages/core/src/types.js';
import {
  taxBrowserStartHomeTaxAssist,
  taxClassifyResolveReviewItem,
  taxClassifyRun,
  taxFilingComputeDraft,
  taxFilingPrepareHomeTax,
  taxSourcesConnect,
  taxSourcesGetCollectionStatus,
  taxSourcesPlanCollection,
  taxSourcesResumeSync,
  taxSourcesSync,
} from '../packages/mcp-server/src/tools.js';

const demo = rawDemo as {
  workspaceId: string;
  filingYear: number;
  consentRecords: ConsentRecord[];
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

const planResult = taxSourcesPlanCollection({
  workspaceId: demo.workspaceId,
  filingYear: demo.filingYear,
});

const initialWorkspace: FilingWorkspace = {
  workspaceId: demo.workspaceId,
  taxpayerId: 'taxpayer_demo',
  filingYear: demo.filingYear,
  status: 'initialized',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  unresolvedReviewCount: 0,
};

const plannedSource = createSourceConnection({
  workspaceId: demo.workspaceId,
  sourceType: 'hometax',
  collectionMode: 'browser_assist',
  requestedScope: ['read_documents', 'prepare_import'],
});

const connectResult = taxSourcesConnect(
  {
    workspaceId: demo.workspaceId,
    sourceType: 'hometax',
    requestedScope: ['read_documents', 'prepare_import'],
  },
  demo.consentRecords,
);

const awaitingAuthSource = transitionSourceState(
  {
    ...plannedSource,
    sourceId: connectResult.data.sourceId,
  },
  connectResult.data.authRequired ? 'awaiting_auth' : 'ready',
  new Date().toISOString(),
  connectResult.data.authRequired ? 'missing_auth' : undefined,
);

const syncAttempt = startSyncAttempt({
  workspaceId: demo.workspaceId,
  sourceId: connectResult.data.sourceId,
  mode: 'full',
  checkpointId: connectResult.checkpointId,
});

const evidenceGap = createCoverageGap({
  workspaceId: demo.workspaceId,
  gapType: 'missing_supporting_evidence',
  severity: 'medium',
  description: 'Potential supporting evidence still missing',
  affectedArea: 'expense_evidence',
  recommendedNextAction: 'Import local receipts or statements after HomeTax collection',
  relatedSourceIds: [connectResult.data.sourceId],
});

const collectionStatusBeforeResume = taxSourcesGetCollectionStatus(
  { workspaceId: demo.workspaceId },
  [awaitingAuthSource],
  [evidenceGap.description],
);

const syncResult = taxSourcesSync({
  sourceId: connectResult.data.sourceId,
  syncMode: 'full',
});

const blockedSyncAttempt = {
  ...syncAttempt,
  state: 'blocked' as const,
  blockingReason: 'user_action_required' as const,
  fallbackOptions: syncResult.fallbackOptions,
  endedAt: new Date().toISOString(),
};

const resumeResult = taxSourcesResumeSync({
  sourceId: connectResult.data.sourceId,
  checkpointId: syncResult.checkpointId,
  resumeToken: syncResult.resumeToken,
});

const completedSyncAttempt = completeSyncAttempt({
  attempt: {
    ...blockedSyncAttempt,
    state: 'running',
  },
  attemptSummary: `Imported ${resumeResult.data.importedArtifactCount} artifacts after resume`,
});

const completedSource = transitionSourceState(awaitingAuthSource, 'completed');

const workspaceAfterCollection = updateWorkspaceProgress(initialWorkspace, {
  sources: [completedSource],
  syncAttempts: [completedSyncAttempt],
  coverageGaps: [evidenceGap],
  unresolvedReviewCount: 0,
});

const classifyResult = taxClassifyRun(
  {
    workspaceId: demo.workspaceId,
    rulesetVersion: 'demo-v1',
  },
  demo.transactions,
);

const classifiedReviewItems: ReviewItem[] = classifyResult.data.reviewItems ?? [];
const classifiedDecisions: ClassificationDecision[] = classifyResult.data.decisions ?? [];

const initialDraftResult = taxFilingComputeDraft(
  {
    workspaceId: demo.workspaceId,
    draftMode: 'refresh',
    includeAssumptions: true,
  },
  demo.transactions,
  classifiedDecisions,
  classifiedReviewItems,
);

const initialPrepareResult = taxFilingPrepareHomeTax(
  {
    workspaceId: demo.workspaceId,
    draftId: initialDraftResult.data.draftId,
  },
  classifiedReviewItems,
);

const resolutionResult = taxClassifyResolveReviewItem(
  {
    reviewItemIds: classifiedReviewItems.map((item) => item.reviewItemId),
    selectedOption: 'exclude_from_expense',
    rationale: 'Demo override to show financial impact of review resolution',
    approverIdentity: 'demo_user',
  },
  classifiedReviewItems,
  classifiedDecisions,
);

const resolvedItems = resolutionResult.data.updatedItems;
const effectiveDecisions = [...classifiedDecisions, ...resolutionResult.data.generatedDecisions];
const resolvedDraftResult = taxFilingComputeDraft(
  {
    workspaceId: demo.workspaceId,
    draftMode: 'new_version',
    includeAssumptions: true,
  },
  demo.transactions,
  effectiveDecisions,
  resolvedItems,
);

const resolvedPrepareResult = taxFilingPrepareHomeTax(
  {
    workspaceId: demo.workspaceId,
    draftId: resolvedDraftResult.data.draftId,
  },
  resolvedItems,
);

const assistResult = taxBrowserStartHomeTaxAssist({
  workspaceId: demo.workspaceId,
  draftId: resolvedDraftResult.data.draftId,
  mode: 'guide_only',
});

const workspaceAfterReview = updateWorkspaceProgress(workspaceAfterCollection, {
  sources: [completedSource],
  syncAttempts: [completedSyncAttempt],
  coverageGaps: [evidenceGap],
  unresolvedReviewCount: resolvedItems.filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed').length,
  readyForHomeTaxAssist: resolvedPrepareResult.data.browserAssistReady,
});

const collectionAudit = createAuditEvent({
  workspaceId: demo.workspaceId,
  eventType: 'import_completed',
  actorType: 'system',
  entityRefs: [completedSource.sourceId, completedSyncAttempt.syncAttemptId],
  summary: completedSyncAttempt.attemptSummary,
});

const explicitConsentCheck = evaluateConsent(demo.consentRecords, {
  consentType: 'source_access',
  sourceType: 'hometax',
  filingYear: demo.filingYear,
  requiredActions: ['read_documents'],
});

console.log(
  JSON.stringify(
    {
      planResult,
      stateHelpers: {
        plannedSource,
        awaitingAuthSource,
        syncAttempt,
        blockedSyncAttempt,
        completedSyncAttempt,
        evidenceGap,
        coverageGapSummary: summarizeCoverageGaps([evidenceGap]),
        derivedWorkspaceStatusAfterCollection: deriveWorkspaceStatus({
          sources: [completedSource],
          syncAttempts: [completedSyncAttempt],
          coverageGaps: [evidenceGap],
        }),
        workspaceAfterCollection,
        workspaceAfterReview,
        collectionAudit,
      },
      connectResult,
      collectionStatusBeforeResume,
      syncResult,
      resumeResult,
      explicitConsentCheck,
      classifyResult: {
        classifiedCount: classifyResult.data.classifiedCount,
        lowConfidenceCount: classifyResult.data.lowConfidenceCount,
        generatedReviewItemCount: classifyResult.data.generatedReviewItemCount,
        summaryByCategory: classifyResult.data.summaryByCategory,
        decisions: classifyResult.data.decisions,
      },
      initialReviewQueue: {
        totalItems: classifiedReviewItems.length,
        summary: summarizeReviewQueue(classifiedReviewItems),
      },
      initialDraftResult,
      initialPrepareResult,
      resolutionResult: {
        resolvedCount: resolutionResult.data.resolvedCount,
        generatedDecisionIds: resolutionResult.data.generatedDecisionIds,
        generatedDecisions: resolutionResult.data.generatedDecisions,
        summary: summarizeReviewQueue(resolvedItems),
      },
      resolvedDraftResult,
      resolvedPrepareResult,
      assistResult,
    },
    null,
    2,
  ),
);

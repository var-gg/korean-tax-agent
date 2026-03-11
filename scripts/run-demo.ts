import rawDemo from '../examples/demo-workspace.json';
import { summarizeReviewQueue } from '../packages/core/src/review.js';
import { evaluateConsent } from '../packages/core/src/consent.js';
import {
  completeSyncAttempt,
  createAuditEvent,
  deriveWorkspaceStatus,
  summarizeCoverageGaps,
  transitionSourceState,
  updateWorkspaceProgress,
} from '../packages/core/src/state.js';
import type {
  AuditEvent,
  ClassificationDecision,
  ConsentRecord,
  CoverageGap,
  FilingWorkspace,
  LedgerTransaction,
  ReviewItem,
  SourceConnection,
  SyncAttempt,
} from '../packages/core/src/types.js';
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
  workspace: FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: CoverageGap[];
  auditEvents: AuditEvent[];
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

const planResult = taxSourcesPlanCollection({
  workspaceId: demo.workspaceId,
  filingYear: demo.filingYear,
});

const initialWorkspace = demo.workspace;
const seededHomeTaxSource = demo.sources.find((source) => source.sourceType === 'hometax');
if (!seededHomeTaxSource) {
  throw new Error('Demo fixture missing hometax source');
}
const seededSyncAttempt = demo.syncAttempts.find((attempt) => attempt.sourceId === seededHomeTaxSource.sourceId);
if (!seededSyncAttempt) {
  throw new Error('Demo fixture missing hometax sync attempt');
}
const evidenceGap = demo.coverageGaps[0];
if (!evidenceGap) {
  throw new Error('Demo fixture missing coverage gap');
}

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
    ...seededHomeTaxSource,
    sourceId: connectResult.data.sourceId,
  },
  connectResult.data.authRequired ? 'awaiting_auth' : 'ready',
  new Date().toISOString(),
  connectResult.data.authRequired ? 'missing_auth' : undefined,
);

const collectionStatusBeforeResume = taxSourcesGetCollectionStatus(
  { workspaceId: demo.workspaceId },
  demo.sources.map((source) => (source.sourceId === awaitingAuthSource.sourceId ? awaitingAuthSource : source)),
  demo.coverageGaps.map((gap) => gap.description),
);

const syncResult = taxSourcesSync({
  sourceId: connectResult.data.sourceId,
  syncMode: 'full',
});

const blockedSyncAttempt: SyncAttempt = {
  ...seededSyncAttempt,
  checkpointId: syncResult.checkpointId ?? seededSyncAttempt.checkpointId,
  state: 'blocked',
  checkpointType: 'collection_blocker',
  blockingReason: 'export_required',
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
  sources: demo.sources.map((source) => (source.sourceId === completedSource.sourceId ? completedSource : source)),
  syncAttempts: [completedSyncAttempt],
  coverageGaps: demo.coverageGaps,
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
  sources: demo.sources.map((source) => (source.sourceId === completedSource.sourceId ? completedSource : source)),
  syncAttempts: [completedSyncAttempt],
  coverageGaps: demo.coverageGaps,
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
      fixtureSummary: {
        workspaceStatus: demo.workspace.status,
        sourceCount: demo.sources.length,
        syncAttemptCount: demo.syncAttempts.length,
        coverageGapCount: demo.coverageGaps.length,
        auditEventCount: demo.auditEvents.length,
      },
      planResult,
      fixtureState: {
        initialWorkspace,
        seededHomeTaxSource,
        seededSyncAttempt,
        seededCoverageGap: evidenceGap,
        seededAuditEvents: demo.auditEvents,
      },
      derivedState: {
        awaitingAuthSource,
        blockedSyncAttempt,
        completedSyncAttempt,
        coverageGapSummary: summarizeCoverageGaps(demo.coverageGaps),
        derivedWorkspaceStatusAfterCollection: deriveWorkspaceStatus({
          sources: demo.sources.map((source) => (source.sourceId === completedSource.sourceId ? completedSource : source)),
          syncAttempts: [completedSyncAttempt],
          coverageGaps: demo.coverageGaps,
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

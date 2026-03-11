import rawDemo from '../examples/demo-workspace.json';
import {
  taxBrowserStartHomeTaxAssist,
  taxClassifyResolveReviewItem,
  taxClassifyRun,
  taxFilingComputeDraft,
  taxFilingPrepareHomeTax,
  taxSourcesConnect,
  taxSourcesResumeSync,
  taxSourcesSync,
} from '../packages/mcp-server/src/tools.js';
import type {
  ClassificationDecision,
  ConsentRecord,
  FilingWorkspace,
  LedgerTransaction,
  ReviewItem,
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
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`SMOKE FAILED: ${message}`);
  }
}

const connectResult = taxSourcesConnect(
  {
    workspaceId: demo.workspaceId,
    sourceType: 'hometax',
    requestedScope: ['read_documents', 'prepare_import'],
  },
  demo.consentRecords,
);

assert(connectResult.status === 'awaiting_auth', 'connect should require auth for hometax');
assert(connectResult.checkpointType === 'authentication', 'connect checkpointType should be authentication');
assert(connectResult.data.sourceState === 'awaiting_auth', 'connected source should be awaiting_auth');

const syncResult = taxSourcesSync({
  sourceId: connectResult.data.sourceId,
  syncMode: 'full',
});

assert(syncResult.status === 'awaiting_user_action', 'sync should pause for user action');
assert(syncResult.checkpointType === 'collection_blocker', 'sync checkpointType should be collection_blocker');
assert(syncResult.blockingReason === 'export_required', 'sync blockingReason should be export_required');
assert(syncResult.data.syncAttemptState === 'blocked', 'syncAttemptState should be blocked');
assert(!!syncResult.resumeToken, 'sync should provide a resume token');

const resumeResult = taxSourcesResumeSync({
  sourceId: connectResult.data.sourceId,
  checkpointId: syncResult.checkpointId,
  resumeToken: syncResult.resumeToken,
});

assert(resumeResult.status === 'completed', 'resume should complete');
assert(resumeResult.data.syncAttemptState === 'completed', 'resume syncAttemptState should be completed');
assert(resumeResult.data.importedArtifactCount > 0, 'resume should import artifacts');

const classifyResult = taxClassifyRun(
  {
    workspaceId: demo.workspaceId,
    rulesetVersion: 'smoke-v1',
  },
  demo.transactions,
);

const reviewItems: ReviewItem[] = classifyResult.data.reviewItems ?? [];
const decisions: ClassificationDecision[] = classifyResult.data.decisions ?? [];
assert(reviewItems.length > 0, 'classification should generate review items in the fixture');

const initialDraftResult = taxFilingComputeDraft(
  {
    workspaceId: demo.workspaceId,
    draftMode: 'refresh',
    includeAssumptions: true,
  },
  demo.transactions,
  decisions,
  reviewItems,
);

assert(initialDraftResult.status === 'blocked', 'initial draft should be blocked before review resolution');
assert(initialDraftResult.checkpointType === 'review_judgment', 'initial draft should require review_judgment');
assert(initialDraftResult.blockingReason === 'awaiting_review_decision', 'initial draft should wait for review decision');

const resolutionResult = taxClassifyResolveReviewItem(
  {
    reviewItemIds: reviewItems.map((item) => item.reviewItemId),
    selectedOption: 'exclude_from_expense',
    rationale: 'smoke test resolution',
    approverIdentity: 'smoke_user',
  },
  reviewItems,
  decisions,
);

const resolvedItems = resolutionResult.data.updatedItems;
const effectiveDecisions = [...decisions, ...resolutionResult.data.generatedDecisions];

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

assert(resolvedDraftResult.status === 'completed', 'resolved draft should complete');

const prepareResult = taxFilingPrepareHomeTax(
  {
    workspaceId: demo.workspaceId,
    draftId: resolvedDraftResult.data.draftId,
  },
  resolvedItems,
);

assert(prepareResult.status === 'completed', 'prepare_hometax should complete after review resolution');
assert(prepareResult.data.browserAssistReady === true, 'prepare_hometax should mark browser assist ready');

const assistResult = taxBrowserStartHomeTaxAssist({
  workspaceId: demo.workspaceId,
  draftId: resolvedDraftResult.data.draftId,
  mode: 'guide_only',
});

assert(assistResult.status === 'awaiting_auth', 'browser assist should begin at auth checkpoint');
assert(assistResult.checkpointType === 'authentication', 'browser assist checkpointType should be authentication');
assert(assistResult.data.checkpointType === 'authentication', 'browser assist data checkpointType should be authentication');

console.log(
  JSON.stringify(
    {
      ok: true,
      smoke: 'workflow',
      summary: {
        connectStatus: connectResult.status,
        syncStatus: syncResult.status,
        resumeStatus: resumeResult.status,
        initialDraftStatus: initialDraftResult.status,
        resolvedDraftStatus: resolvedDraftResult.status,
        prepareStatus: prepareResult.status,
        assistStatus: assistResult.status,
      },
    },
    null,
    2,
  ),
);

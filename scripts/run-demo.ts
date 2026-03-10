import rawDemo from '../examples/demo-workspace.json';
import { summarizeReviewQueue } from '../packages/core/src/review.js';
import { evaluateConsent } from '../packages/core/src/consent.js';
import type { ClassificationDecision, ConsentRecord, LedgerTransaction, ReviewItem } from '../packages/core/src/types.js';
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

const connectResult = taxSourcesConnect(
  {
    workspaceId: demo.workspaceId,
    sourceType: 'hometax',
    requestedScope: ['read_documents', 'prepare_import'],
  },
  demo.consentRecords,
);

const collectionStatusBeforeResume = taxSourcesGetCollectionStatus(
  { workspaceId: demo.workspaceId },
  [
    {
      sourceId: connectResult.data.sourceId,
      workspaceId: demo.workspaceId,
      sourceType: 'hometax',
      state: connectResult.data.authRequired ? 'awaiting_auth' : 'ready',
      lastBlockingReason: connectResult.data.authRequired ? 'missing_auth' : undefined,
    },
  ],
  ['Potential supporting evidence still missing'],
);

const syncResult = taxSourcesSync({
  sourceId: connectResult.data.sourceId,
  syncMode: 'full',
});

const resumeResult = taxSourcesResumeSync({
  sourceId: connectResult.data.sourceId,
  checkpointId: syncResult.checkpointId,
  resumeToken: syncResult.resumeToken,
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

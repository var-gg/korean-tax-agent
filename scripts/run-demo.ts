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
} from '../packages/mcp-server/src/tools.js';

const demo = rawDemo as {
  workspaceId: string;
  filingYear: number;
  consentRecords: ConsentRecord[];
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

const connectResult = taxSourcesConnect(
  {
    workspaceId: demo.workspaceId,
    sourceType: 'hometax',
    requestedScope: ['read_documents', 'prepare_import'],
  },
  demo.consentRecords,
);

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
    selectedOption: 'accepted_in_demo',
    rationale: 'Demo resolution to advance workflow state',
    approverIdentity: 'demo_user',
  },
  classifiedReviewItems,
);

const resolvedItems = resolutionResult.data.updatedItems;
const resolvedDraftResult = taxFilingComputeDraft(
  {
    workspaceId: demo.workspaceId,
    draftMode: 'new_version',
    includeAssumptions: true,
  },
  demo.transactions,
  classifiedDecisions,
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
      connectResult,
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

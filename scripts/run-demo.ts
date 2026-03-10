import rawDemo from '../examples/demo-workspace.json';
import { buildReviewQueue, summarizeReviewQueue } from '../packages/core/src/review.js';
import { evaluateConsent } from '../packages/core/src/consent.js';
import { buildDraft, evaluateDraftReadiness } from '../packages/core/src/draft.js';
import type { ClassificationDecision, ConsentRecord, LedgerTransaction } from '../packages/core/src/types.js';
import {
  taxBrowserStartHomeTaxAssist,
  taxClassifyResolveReviewItem,
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

const initialReviewQueue = buildReviewQueue({
  workspaceId: demo.workspaceId,
  transactions: demo.transactions,
  decisions: demo.decisions,
});

const initialReadiness = evaluateDraftReadiness(initialReviewQueue.items);
const initialDraft = buildDraft({
  workspaceId: demo.workspaceId,
  filingYear: demo.filingYear,
  draftVersion: 1,
  incomeSummary: { totalIncome: 450000 },
  expenseSummary: { totalExpense: 1920000 },
  deductionsSummary: { totalDeductions: 0 },
  withholdingSummary: { totalWithheld: 0 },
  assumptions: ['Demo-only computation'],
  warnings: initialReadiness.blockerReasons,
});

const initialPrepareResult = taxFilingPrepareHomeTax(
  {
    workspaceId: demo.workspaceId,
    draftId: initialDraft.draftId,
  },
  initialReviewQueue.items,
);

const resolutionResult = taxClassifyResolveReviewItem(
  {
    reviewItemIds: initialReviewQueue.items.map((item) => item.reviewItemId),
    selectedOption: 'accepted_in_demo',
    rationale: 'Demo resolution to advance workflow state',
    approverIdentity: 'demo_user',
  },
  initialReviewQueue.items,
);

const resolvedItems = resolutionResult.data.updatedItems;
const resolvedReadiness = evaluateDraftReadiness(resolvedItems);
const resolvedDraft = buildDraft({
  workspaceId: demo.workspaceId,
  filingYear: demo.filingYear,
  draftVersion: 2,
  incomeSummary: { totalIncome: 450000 },
  expenseSummary: { totalExpense: 1920000 },
  deductionsSummary: { totalDeductions: 0 },
  withholdingSummary: { totalWithheld: 0 },
  assumptions: ['Demo-only computation after review resolution'],
  warnings: resolvedReadiness.blockerReasons,
});

const resolvedPrepareResult = taxFilingPrepareHomeTax(
  {
    workspaceId: demo.workspaceId,
    draftId: resolvedDraft.draftId,
  },
  resolvedItems,
);

const assistResult = taxBrowserStartHomeTaxAssist({
  workspaceId: demo.workspaceId,
  draftId: resolvedDraft.draftId,
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
      initialReviewQueue: {
        totalItems: initialReviewQueue.items.length,
        batches: initialReviewQueue.batches,
        summary: summarizeReviewQueue(initialReviewQueue.items),
      },
      initialDraft: {
        draftId: initialDraft.draftId,
        readiness: initialReadiness,
        warnings: initialDraft.warnings,
      },
      initialPrepareResult,
      resolutionResult: {
        resolvedCount: resolutionResult.data.resolvedCount,
        generatedDecisionIds: resolutionResult.data.generatedDecisionIds,
        summary: summarizeReviewQueue(resolvedItems),
      },
      resolvedDraft: {
        draftId: resolvedDraft.draftId,
        readiness: resolvedReadiness,
        warnings: resolvedDraft.warnings,
      },
      resolvedPrepareResult,
      assistResult,
    },
    null,
    2,
  ),
);

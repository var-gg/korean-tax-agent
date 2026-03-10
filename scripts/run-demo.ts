import rawDemo from '../examples/demo-workspace.json';
import { buildReviewQueue, summarizeReviewQueue } from '../packages/core/src/review.js';
import { evaluateConsent } from '../packages/core/src/consent.js';
import { buildDraft, evaluateDraftReadiness } from '../packages/core/src/draft.js';
import type { ClassificationDecision, ConsentRecord, LedgerTransaction } from '../packages/core/src/types.js';
import {
  taxBrowserStartHomeTaxAssist,
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

const reviewQueue = buildReviewQueue({
  workspaceId: demo.workspaceId,
  transactions: demo.transactions,
  decisions: demo.decisions,
});

const reviewSummary = summarizeReviewQueue(reviewQueue.items);
const readiness = evaluateDraftReadiness(reviewQueue.items);
const draft = buildDraft({
  workspaceId: demo.workspaceId,
  filingYear: demo.filingYear,
  draftVersion: 1,
  incomeSummary: { totalIncome: 450000 },
  expenseSummary: { totalExpense: 1920000 },
  deductionsSummary: { totalDeductions: 0 },
  withholdingSummary: { totalWithheld: 0 },
  assumptions: ['Demo-only computation'],
  warnings: readiness.blockerReasons,
});

const prepareResult = taxFilingPrepareHomeTax(
  {
    workspaceId: demo.workspaceId,
    draftId: draft.draftId,
  },
  reviewQueue.items,
);

const assistResult = taxBrowserStartHomeTaxAssist({
  workspaceId: demo.workspaceId,
  draftId: draft.draftId,
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
      reviewQueue: {
        totalItems: reviewQueue.items.length,
        batches: reviewQueue.batches,
        summary: reviewSummary,
      },
      draft: {
        draftId: draft.draftId,
        readiness,
        warnings: draft.warnings,
      },
      prepareResult,
      assistResult,
    },
    null,
    2,
  ),
);

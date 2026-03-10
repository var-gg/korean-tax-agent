import type { ClassificationDecision, FilingDraft, LedgerTransaction, ReviewItem, ReviewSeverity } from './types.js';

export type DraftReadiness = {
  readyForReview: boolean;
  readyForSubmission: boolean;
  unresolvedCount: number;
  unresolvedBySeverity: Partial<Record<ReviewSeverity, number>>;
  blockerReasons: string[];
};

export type DraftComputationInput = {
  workspaceId: string;
  filingYear: number;
  draftVersion: number;
  incomeSummary?: Record<string, unknown>;
  expenseSummary?: Record<string, unknown>;
  deductionsSummary?: Record<string, unknown>;
  withholdingSummary?: Record<string, unknown>;
  assumptions?: string[];
  warnings?: string[];
};

export type ComputeDraftFromLedgerInput = {
  workspaceId: string;
  filingYear: number;
  draftVersion: number;
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
  reviewItems: ReviewItem[];
  assumptions?: string[];
};

export type DraftAggregateSummary = {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  incomeByCategory: Record<string, number>;
  expenseByCategory: Record<string, number>;
  deductibleExpenseTotal: number;
  candidateExpenseTotal: number;
  lowConfidenceDecisionCount: number;
};

export function evaluateDraftReadiness(reviewItems: ReviewItem[]): DraftReadiness {
  const unresolved = reviewItems.filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed');
  const unresolvedBySeverity = unresolved.reduce<Partial<Record<ReviewSeverity, number>>>((acc, item) => {
    acc[item.severity] = (acc[item.severity] ?? 0) + 1;
    return acc;
  }, {});

  const blockerReasons = unresolved
    .filter((item) => item.severity === 'critical' || item.severity === 'high')
    .map((item) => item.reasonCode);

  return {
    readyForReview: true,
    readyForSubmission: blockerReasons.length === 0,
    unresolvedCount: unresolved.length,
    unresolvedBySeverity,
    blockerReasons: [...new Set(blockerReasons)],
  };
}

export function aggregateDraftSummary(transactions: LedgerTransaction[], decisions: ClassificationDecision[]): DraftAggregateSummary {
  const decisionMap = new Map(decisions.map((decision) => [decision.entityId, decision]));

  let totalIncome = 0;
  let totalExpense = 0;
  let deductibleExpenseTotal = 0;
  let candidateExpenseTotal = 0;
  let lowConfidenceDecisionCount = 0;
  const incomeByCategory: Record<string, number> = {};
  const expenseByCategory: Record<string, number> = {};

  for (const transaction of transactions) {
    const decision = decisionMap.get(transaction.transactionId);
    const category = decision?.candidateCategory ?? 'unclassified';
    const treatment = decision?.candidateTaxTreatment ?? 'manual_review_required';
    const confidence = decision?.confidence ?? 0;

    if (confidence < 0.75) {
      lowConfidenceDecisionCount += 1;
    }

    if (transaction.normalizedDirection === 'income') {
      totalIncome += transaction.amount;
      incomeByCategory[category] = (incomeByCategory[category] ?? 0) + transaction.amount;
    }

    if (transaction.normalizedDirection === 'expense') {
      totalExpense += transaction.amount;
      expenseByCategory[category] = (expenseByCategory[category] ?? 0) + transaction.amount;

      if (treatment === 'business_expense') {
        deductibleExpenseTotal += transaction.amount;
      } else if (treatment.includes('candidate')) {
        candidateExpenseTotal += transaction.amount;
      }
    }
  }

  return {
    totalIncome,
    totalExpense,
    netIncome: totalIncome - deductibleExpenseTotal,
    incomeByCategory,
    expenseByCategory,
    deductibleExpenseTotal,
    candidateExpenseTotal,
    lowConfidenceDecisionCount,
  };
}

export function computeDraftFromLedger(input: ComputeDraftFromLedgerInput): FilingDraft {
  const readiness = evaluateDraftReadiness(input.reviewItems);
  const aggregate = aggregateDraftSummary(input.transactions, input.decisions);

  const warnings = [...readiness.blockerReasons];
  if (aggregate.lowConfidenceDecisionCount > 0) {
    warnings.push(`low_confidence_decisions:${aggregate.lowConfidenceDecisionCount}`);
  }
  if (aggregate.candidateExpenseTotal > 0) {
    warnings.push(`candidate_expense_total:${aggregate.candidateExpenseTotal}`);
  }

  return buildDraft({
    workspaceId: input.workspaceId,
    filingYear: input.filingYear,
    draftVersion: input.draftVersion,
    incomeSummary: {
      totalIncome: aggregate.totalIncome,
      incomeByCategory: aggregate.incomeByCategory,
    },
    expenseSummary: {
      totalExpense: aggregate.totalExpense,
      deductibleExpenseTotal: aggregate.deductibleExpenseTotal,
      candidateExpenseTotal: aggregate.candidateExpenseTotal,
      expenseByCategory: aggregate.expenseByCategory,
    },
    deductionsSummary: {
      estimatedBusinessExpenseDeduction: aggregate.deductibleExpenseTotal,
    },
    withholdingSummary: {
      totalWithheld: 0,
    },
    assumptions: input.assumptions ?? [],
    warnings: [...new Set(warnings)],
  });
}

export function buildDraft(input: DraftComputationInput): FilingDraft {
  return {
    draftId: `draft_${input.workspaceId}_v${input.draftVersion}`,
    workspaceId: input.workspaceId,
    filingYear: input.filingYear,
    draftVersion: input.draftVersion,
    status: 'ready_for_review',
    incomeSummary: input.incomeSummary ?? {},
    expenseSummary: input.expenseSummary ?? {},
    deductionsSummary: input.deductionsSummary ?? {},
    withholdingSummary: input.withholdingSummary ?? {},
    assumptions: input.assumptions ?? [],
    warnings: input.warnings ?? [],
    computedAt: new Date().toISOString(),
    computationTraceRef: `trace_${input.workspaceId}_v${input.draftVersion}`,
  };
}

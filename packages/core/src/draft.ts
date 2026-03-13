import type { ClassificationDecision, FilingDraft, FilingFieldValue, LedgerTransaction, ReviewItem, ReviewSeverity, WithholdingRecord } from './types.js';
import { detectFilingPath } from './path.js';
import { deriveCalibratedReadiness, deriveReadinessSummary } from './readiness.js';

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
  withholdingRecords?: WithholdingRecord[];
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
  excludedExpenseTotal: number;
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

export function getEffectiveDecisions(decisions: ClassificationDecision[]): ClassificationDecision[] {
  const supersededIds = new Set(decisions.flatMap((decision) => (decision.supersedesDecisionId ? [decision.supersedesDecisionId] : [])));
  const effectiveMap = new Map<string, ClassificationDecision>();

  for (const decision of decisions) {
    if (supersededIds.has(decision.decisionId)) {
      continue;
    }

    const current = effectiveMap.get(decision.entityId);
    if (!current) {
      effectiveMap.set(decision.entityId, decision);
      continue;
    }

    const currentRank = current.decisionMode === 'approved_override' ? 2 : current.decisionMode === 'manual' ? 1 : 0;
    const nextRank = decision.decisionMode === 'approved_override' ? 2 : decision.decisionMode === 'manual' ? 1 : 0;
    if (nextRank > currentRank || decision.createdAt >= current.createdAt) {
      effectiveMap.set(decision.entityId, decision);
    }
  }

  return [...effectiveMap.values()];
}

export function aggregateDraftSummary(transactions: LedgerTransaction[], decisions: ClassificationDecision[]): DraftAggregateSummary {
  const effectiveDecisions = getEffectiveDecisions(decisions);
  const decisionMap = new Map(effectiveDecisions.map((decision) => [decision.entityId, decision]));

  let totalIncome = 0;
  let totalExpense = 0;
  let deductibleExpenseTotal = 0;
  let candidateExpenseTotal = 0;
  let excludedExpenseTotal = 0;
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
      } else if (treatment === 'exclude_from_expense') {
        excludedExpenseTotal += transaction.amount;
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
    excludedExpenseTotal,
    lowConfidenceDecisionCount,
  };
}

export function computeDraftFromLedger(input: ComputeDraftFromLedgerInput): FilingDraft {
  const readiness = evaluateDraftReadiness(input.reviewItems);
  const aggregate = aggregateDraftSummary(input.transactions, input.decisions);
  const totalWithheld = (input.withholdingRecords ?? []).reduce((sum, record) => sum + record.withheldTaxAmount, 0);
  const totalLocalTax = (input.withholdingRecords ?? []).reduce((sum, record) => sum + (record.localTaxAmount ?? 0), 0);

  const warnings = [...readiness.blockerReasons];
  if (aggregate.lowConfidenceDecisionCount > 0) {
    warnings.push(`low_confidence_decisions:${aggregate.lowConfidenceDecisionCount}`);
  }
  if (aggregate.candidateExpenseTotal > 0) {
    warnings.push(`candidate_expense_total:${aggregate.candidateExpenseTotal}`);
  }
  if (aggregate.excludedExpenseTotal > 0) {
    warnings.push(`excluded_expense_total:${aggregate.excludedExpenseTotal}`);
  }

  const draft = buildDraft({
    workspaceId: input.workspaceId,
    filingYear: input.filingYear,
    draftVersion: input.draftVersion,
    incomeSummary: {
      totalIncome: aggregate.totalIncome,
      netIncome: aggregate.netIncome,
      incomeByCategory: aggregate.incomeByCategory,
    },
    expenseSummary: {
      totalExpense: aggregate.totalExpense,
      deductibleExpenseTotal: aggregate.deductibleExpenseTotal,
      candidateExpenseTotal: aggregate.candidateExpenseTotal,
      excludedExpenseTotal: aggregate.excludedExpenseTotal,
      expenseByCategory: aggregate.expenseByCategory,
    },
    deductionsSummary: {
      estimatedBusinessExpenseDeduction: aggregate.deductibleExpenseTotal,
    },
    withholdingSummary: {
      totalWithheld,
      totalLocalTax,
      recordCount: (input.withholdingRecords ?? []).length,
    },
    assumptions: input.assumptions ?? [],
    warnings: [...new Set(warnings)],
  });

  const fieldValues: FilingFieldValue[] = [
    {
      filingFieldValueId: `field_${draft.draftId}_income_total`,
      draftId: draft.draftId,
      sectionKey: 'income',
      fieldKey: 'total_income',
      value: aggregate.totalIncome,
      sourceOfTruth: 'imported',
      confidence: aggregate.lowConfidenceDecisionCount > 0 ? 0.7 : 0.9,
      isEstimated: false,
      requiresManualEntry: false,
      sourceRefs: input.transactions.map((tx) => tx.transactionId),
      evidenceRefs: input.transactions.flatMap((tx) => tx.evidenceRefs),
      comparisonState: 'not_compared',
    },
    {
      filingFieldValueId: `field_${draft.draftId}_expense_deductible_total`,
      draftId: draft.draftId,
      sectionKey: 'expenses',
      fieldKey: 'deductible_expense_total',
      value: aggregate.deductibleExpenseTotal,
      sourceOfTruth: 'imported',
      confidence: aggregate.candidateExpenseTotal > 0 ? 0.65 : 0.85,
      isEstimated: aggregate.candidateExpenseTotal > 0,
      requiresManualEntry: false,
      sourceRefs: input.transactions.map((tx) => tx.transactionId),
      evidenceRefs: input.transactions.flatMap((tx) => tx.evidenceRefs),
      comparisonState: 'not_compared',
    },
    {
      filingFieldValueId: `field_${draft.draftId}_withholding_total`,
      draftId: draft.draftId,
      sectionKey: 'withholding',
      fieldKey: 'total_withheld_tax',
      value: totalWithheld,
      sourceOfTruth: (input.withholdingRecords ?? []).length > 0 ? 'official' : 'inferred',
      confidence: (input.withholdingRecords ?? []).length > 0 ? 0.9 : 0.3,
      isEstimated: (input.withholdingRecords ?? []).length === 0,
      requiresManualEntry: (input.withholdingRecords ?? []).length === 0,
      sourceRefs: (input.withholdingRecords ?? []).map((record) => record.withholdingRecordId),
      evidenceRefs: (input.withholdingRecords ?? []).flatMap((record) => record.evidenceRefs),
      comparisonState: 'not_compared',
    },
  ];

  draft.fieldValues = fieldValues;
  draft.estimateConfidence = readiness.readyForSubmission && (input.withholdingRecords ?? []).length > 0 ? 'high' : aggregate.lowConfidenceDecisionCount > 0 ? 'low' : 'medium';

  const filingPathDetection = detectFilingPath({
    transactions: input.transactions,
    withholdingRecords: input.withholdingRecords,
    reviewItems: input.reviewItems,
  });

  const calibratedReadiness = deriveCalibratedReadiness({
    supportTier: filingPathDetection.supportTier,
    filingPathKind: filingPathDetection.filingPathKind,
    reviewItems: input.reviewItems,
    draft: {
      draftId: draft.draftId,
      fieldValues,
    },
  });
  const readinessSummary = deriveReadinessSummary({
    supportTier: filingPathDetection.supportTier,
    filingPathKind: filingPathDetection.filingPathKind,
    reviewItems: input.reviewItems,
    draft: {
      draftId: draft.draftId,
      fieldValues,
    },
  });

  draft.estimateReadiness = readinessSummary.estimateReadiness;
  draft.draftReadiness = readinessSummary.draftReadiness;
  draft.submissionReadiness = readinessSummary.submissionReadiness;
  draft.supportTierAtComputation = filingPathDetection.supportTier;
  draft.comparisonSummaryState = readinessSummary.comparisonSummaryState;
  draft.freshnessState = readinessSummary.freshnessState;
  draft.majorUnknowns = [...new Set([...filingPathDetection.missingFacts, ...readinessSummary.majorUnknowns])];
  draft.blockerCodes = readinessSummary.blockerCodes;
  draft.calibration = {
    readiness: calibratedReadiness.workspaceReadiness,
    coverageByDomain: calibratedReadiness.coverageByDomain,
    materialCoverageSummary: calibratedReadiness.materialCoverageSummary,
    majorUnknowns: [...new Set([...filingPathDetection.missingFacts, ...calibratedReadiness.majorUnknowns])],
    highSeverityReviewCount: input.reviewItems.filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed' && (item.severity === 'high' || item.severity === 'critical')).length,
    submissionComparisonState: calibratedReadiness.submissionComparisonState,
    capturedAt: draft.computedAt,
  };
  return draft;
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

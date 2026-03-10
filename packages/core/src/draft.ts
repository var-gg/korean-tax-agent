import type { FilingDraft, ReviewItem, ReviewSeverity } from './types';

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

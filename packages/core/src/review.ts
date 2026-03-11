import type { ClassificationDecision, LedgerTransaction, ReviewItem, ReviewSeverity } from './types.js';

export type ReviewPolicy = {
  lowConfidenceThreshold: number;
  highAmountThreshold: number;
  batchWindowReasonCodes: string[];
};

export type BuildReviewQueueInput = {
  workspaceId: string;
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
  now?: string;
  policy?: Partial<ReviewPolicy>;
};

export type ReviewBatch = {
  batchKey: string;
  reasonCode: string;
  itemIds: string[];
};

export type BuildReviewQueueResult = {
  items: ReviewItem[];
  batches: ReviewBatch[];
};

export type ResolveReviewItemsInput = {
  items: ReviewItem[];
  reviewItemIds: string[];
  selectedOption: string;
  rationale: string;
  approverIdentity: string;
  now?: string;
  existingDecisions?: ClassificationDecision[];
};

export type ResolveReviewItemsResult = {
  updatedItems: ReviewItem[];
  resolvedItems: ReviewItem[];
  generatedDecisions: ClassificationDecision[];
};

const DEFAULT_POLICY: ReviewPolicy = {
  lowConfidenceThreshold: 0.75,
  highAmountThreshold: 1_000_000,
  batchWindowReasonCodes: ['low_confidence', 'mixed_use_expense', 'missing_evidence'],
};

function toSeverity(reasonCode: string): ReviewSeverity {
  switch (reasonCode) {
    case 'mixed_use_expense':
    case 'missing_evidence':
      return 'high';
    case 'high_amount_outlier':
      return 'medium';
    case 'duplicate_conflict':
      return 'medium';
    case 'low_confidence':
    default:
      return 'low';
  }
}

function buildReviewItem(params: {
  workspaceId: string;
  transaction: LedgerTransaction;
  reasonCode: string;
  question: string;
  candidateOptions: string[];
  suggestedOption?: string;
  now: string;
}): ReviewItem {
  const { workspaceId, transaction, reasonCode, question, candidateOptions, suggestedOption, now } = params;

  return {
    reviewItemId: `review_${transaction.transactionId}_${reasonCode}`,
    workspaceId,
    reasonCode,
    severity: toSeverity(reasonCode),
    question,
    candidateOptions,
    suggestedOption,
    linkedEntityIds: [transaction.transactionId],
    impactEstimate: {
      amount: transaction.amount,
      currency: transaction.currency,
    },
    resolutionState: 'open',
    resolvedAt: undefined,
    resolvedBy: undefined,
    resolutionNote: `Generated at ${now}`,
  };
}

function mapResolutionToDecision(item: ReviewItem, selectedOption: string) {
  switch (item.reasonCode) {
    case 'missing_evidence':
      if (selectedOption === 'exclude_from_expense') {
        return {
          candidateCategory: 'disallowed_expense',
          candidateTaxTreatment: 'exclude_from_expense',
        };
      }
      if (selectedOption === 'keep_with_note') {
        return {
          candidateCategory: 'document_pending_expense',
          candidateTaxTreatment: 'business_expense_candidate',
        };
      }
      return {
        candidateCategory: 'document_pending_expense',
        candidateTaxTreatment: 'business_expense_candidate',
      };
    case 'high_amount_outlier':
      if (selectedOption === 'mark_mixed_use') {
        return {
          candidateCategory: 'mixed_use_expense',
          candidateTaxTreatment: 'business_expense_candidate',
        };
      }
      if (selectedOption === 'exclude_from_expense') {
        return {
          candidateCategory: 'disallowed_expense',
          candidateTaxTreatment: 'exclude_from_expense',
        };
      }
      return {
        candidateCategory: 'confirmed_business_expense',
        candidateTaxTreatment: 'business_expense',
      };
    case 'duplicate_conflict':
      if (selectedOption === 'drop_duplicate_candidate') {
        return {
          candidateCategory: 'duplicate_removed',
          candidateTaxTreatment: 'exclude_from_expense',
        };
      }
      return {
        candidateCategory: 'duplicate_reviewed',
        candidateTaxTreatment: 'business_expense',
      };
    case 'low_confidence':
      if (selectedOption === 'reclassify') {
        return {
          candidateCategory: 'reclassified_manual',
          candidateTaxTreatment: 'manual_review_required',
        };
      }
      if (selectedOption === 'mark_unknown') {
        return {
          candidateCategory: 'unknown',
          candidateTaxTreatment: 'manual_review_required',
        };
      }
      return null;
    default:
      return {
        candidateCategory: item.reasonCode,
        candidateTaxTreatment: selectedOption,
      };
  }
}

export function buildReviewQueue(input: BuildReviewQueueInput): BuildReviewQueueResult {
  const now = input.now ?? new Date().toISOString();
  const policy: ReviewPolicy = { ...DEFAULT_POLICY, ...(input.policy ?? {}) };
  const decisionMap = new Map(input.decisions.map((d) => [d.entityId, d]));
  const items: ReviewItem[] = [];

  for (const transaction of input.transactions) {
    const decision = decisionMap.get(transaction.transactionId);
    const hasEvidence = transaction.evidenceRefs.length > 0;
    const looksExpense = transaction.normalizedDirection === 'expense';

    if (decision && typeof decision.confidence === 'number' && decision.confidence < policy.lowConfidenceThreshold) {
      items.push(
        buildReviewItem({
          workspaceId: input.workspaceId,
          transaction,
          reasonCode: 'low_confidence',
          question: '이 거래의 분류를 그대로 수용할까요?',
          candidateOptions: ['accept_suggested', 'reclassify', 'mark_unknown'],
          suggestedOption: 'accept_suggested',
          now,
        }),
      );
    }

    if (looksExpense && !hasEvidence) {
      items.push(
        buildReviewItem({
          workspaceId: input.workspaceId,
          transaction,
          reasonCode: 'missing_evidence',
          question: '이 비용을 증빙 없이 비용 처리 후보로 유지할까요?',
          candidateOptions: ['keep_with_note', 'exclude_from_expense', 'attach_evidence_later'],
          suggestedOption: 'attach_evidence_later',
          now,
        }),
      );
    }

    if (looksExpense && transaction.amount >= policy.highAmountThreshold) {
      items.push(
        buildReviewItem({
          workspaceId: input.workspaceId,
          transaction,
          reasonCode: 'high_amount_outlier',
          question: '고액 비용 항목으로 보입니다. 추가 검토가 필요합니다.',
          candidateOptions: ['confirm_business_expense', 'mark_mixed_use', 'exclude_from_expense'],
          suggestedOption: 'confirm_business_expense',
          now,
        }),
      );
    }

    if (transaction.duplicateGroupId) {
      items.push(
        buildReviewItem({
          workspaceId: input.workspaceId,
          transaction,
          reasonCode: 'duplicate_conflict',
          question: '중복 가능 거래로 보입니다. 어떻게 처리할까요?',
          candidateOptions: ['keep_both', 'merge_duplicate', 'drop_duplicate_candidate'],
          suggestedOption: 'merge_duplicate',
          now,
        }),
      );
    }
  }

  const batchesByKey = new Map<string, ReviewBatch>();
  for (const item of items) {
    if (!policy.batchWindowReasonCodes.includes(item.reasonCode)) continue;
    const batchKey = `${item.reasonCode}:${item.severity}`;
    const existing = batchesByKey.get(batchKey);
    if (existing) {
      existing.itemIds.push(item.reviewItemId);
    } else {
      batchesByKey.set(batchKey, {
        batchKey,
        reasonCode: item.reasonCode,
        itemIds: [item.reviewItemId],
      });
    }
  }

  return {
    items,
    batches: [...batchesByKey.values()],
  };
}

export function resolveReviewItems(input: ResolveReviewItemsInput): ResolveReviewItemsResult {
  const now = input.now ?? new Date().toISOString();
  const targetIds = new Set(input.reviewItemIds);
  const existingDecisionMap = new Map((input.existingDecisions ?? []).map((decision) => [decision.entityId, decision]));
  const resolvedItems: ReviewItem[] = [];
  const generatedDecisions: ClassificationDecision[] = [];

  const updatedItems = input.items.map((item) => {
    if (!targetIds.has(item.reviewItemId)) {
      return item;
    }

    const updatedItem: ReviewItem = {
      ...item,
      resolutionState: 'resolved',
      resolvedAt: now,
      resolvedBy: input.approverIdentity,
      resolutionNote: `${input.selectedOption}: ${input.rationale}`,
    };

    resolvedItems.push(updatedItem);

    for (const entityId of item.linkedEntityIds) {
      const mapped = mapResolutionToDecision(item, input.selectedOption);
      if (!mapped) {
        continue;
      }

      const supersededDecision = existingDecisionMap.get(entityId);
      generatedDecisions.push({
        decisionId: `decision_override_${item.reviewItemId}`,
        entityType: 'transaction',
        entityId,
        candidateCategory: mapped.candidateCategory,
        candidateTaxTreatment: mapped.candidateTaxTreatment,
        confidence: 1,
        explanation: `${item.reasonCode}:${input.rationale}`,
        decidedBy: 'user',
        decisionMode: 'approved_override',
        supersedesDecisionId: supersededDecision?.decisionId,
        createdAt: now,
      });
    }

    return updatedItem;
  });

  return {
    updatedItems,
    resolvedItems,
    generatedDecisions,
  };
}

export function summarizeReviewQueue(items: ReviewItem[]) {
  return items.reduce(
    (acc, item) => {
      acc.total += 1;
      acc.byReason[item.reasonCode] = (acc.byReason[item.reasonCode] ?? 0) + 1;
      acc.bySeverity[item.severity] = (acc.bySeverity[item.severity] ?? 0) + 1;
      acc.byResolutionState[item.resolutionState] = (acc.byResolutionState[item.resolutionState] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      byReason: {} as Record<string, number>,
      bySeverity: {} as Record<ReviewSeverity, number>,
      byResolutionState: {} as Record<string, number>,
    },
  );
}

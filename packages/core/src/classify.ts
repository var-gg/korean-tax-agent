import type { ClassificationDecision, LedgerTransaction } from './types.js';

export type ClassificationRule = {
  id: string;
  match: (transaction: LedgerTransaction) => boolean;
  category: string;
  taxTreatment: string;
  confidence: number;
  explanation: string;
};

export type ClassifyTransactionsInput = {
  workspaceId: string;
  transactions: LedgerTransaction[];
  now?: string;
};

export type ClassifyTransactionsResult = {
  decisions: ClassificationDecision[];
  summaryByCategory: Record<string, number>;
  lowConfidenceCount: number;
};

function textOf(transaction: LedgerTransaction): string {
  return `${transaction.counterparty ?? ''} ${transaction.description ?? ''} ${transaction.rawCategory ?? ''}`.toLowerCase();
}

const RULES: ClassificationRule[] = [
  {
    id: 'expense.office_supplies',
    match: (tx) => tx.normalizedDirection === 'expense' && /stationery|office supplies|printer|paper|pen/.test(textOf(tx)),
    category: 'office_supplies',
    taxTreatment: 'business_expense',
    confidence: 0.72,
    explanation: 'Matched office supplies keyword pattern for expense transaction.',
  },
  {
    id: 'expense.equipment',
    match: (tx) => tx.normalizedDirection === 'expense' && /laptop|computer|electronics|monitor|keyboard/.test(textOf(tx)),
    category: 'equipment',
    taxTreatment: 'business_expense',
    confidence: 0.9,
    explanation: 'Matched equipment/electronics keyword pattern.',
  },
  {
    id: 'income.service',
    match: (tx) => tx.normalizedDirection === 'income' && /client|consulting|service|payment|invoice/.test(textOf(tx)),
    category: 'service_income',
    taxTreatment: 'taxable_income',
    confidence: 0.95,
    explanation: 'Matched service income keyword pattern for incoming payment.',
  },
  {
    id: 'expense.default',
    match: (tx) => tx.normalizedDirection === 'expense',
    category: 'general_expense',
    taxTreatment: 'business_expense_candidate',
    confidence: 0.55,
    explanation: 'Fallback expense heuristic.',
  },
  {
    id: 'income.default',
    match: (tx) => tx.normalizedDirection === 'income',
    category: 'general_income',
    taxTreatment: 'taxable_income_candidate',
    confidence: 0.6,
    explanation: 'Fallback income heuristic.',
  },
  {
    id: 'unknown.default',
    match: () => true,
    category: 'unknown',
    taxTreatment: 'manual_review_required',
    confidence: 0.3,
    explanation: 'No specific rule matched.',
  },
];

export function classifyTransactions(input: ClassifyTransactionsInput): ClassifyTransactionsResult {
  const now = input.now ?? new Date().toISOString();
  const decisions: ClassificationDecision[] = [];
  const summaryByCategory: Record<string, number> = {};
  let lowConfidenceCount = 0;

  for (const transaction of input.transactions) {
    const rule = RULES.find((candidate) => candidate.match(transaction)) ?? RULES[RULES.length - 1];

    const decision: ClassificationDecision = {
      decisionId: `decision_${transaction.transactionId}`,
      entityType: 'transaction',
      entityId: transaction.transactionId,
      candidateCategory: rule.category,
      candidateTaxTreatment: rule.taxTreatment,
      confidence: rule.confidence,
      ruleRefs: [rule.id],
      explanation: rule.explanation,
      decidedBy: 'system',
      decisionMode: rule.confidence >= 0.85 ? 'auto' : 'suggested',
      createdAt: now,
    };

    decisions.push(decision);
    summaryByCategory[rule.category] = (summaryByCategory[rule.category] ?? 0) + 1;
    if (rule.confidence < 0.75) {
      lowConfidenceCount += 1;
    }
  }

  return {
    decisions,
    summaryByCategory,
    lowConfidenceCount,
  };
}

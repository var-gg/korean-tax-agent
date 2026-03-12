import type {
  CoverageGap,
  FilingPathKind,
  FilingSupportTier,
  LedgerTransaction,
  ReviewItem,
  TaxpayerFact,
  TaxpayerProfile,
  WithholdingRecord,
} from './types.js';

export type DetectFilingPathInput = {
  taxpayerProfile?: Partial<TaxpayerProfile>;
  taxpayerFacts?: TaxpayerFact[];
  transactions?: LedgerTransaction[];
  withholdingRecords?: WithholdingRecord[];
  reviewItems?: ReviewItem[];
  coverageGaps?: CoverageGap[];
};

export type FilingPathDetection = {
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  confidence: number;
  reasons: string[];
  missingFacts: string[];
  escalationFlags: string[];
};

export function detectFilingPath(input: DetectFilingPathInput): FilingPathDetection {
  const facts = input.taxpayerFacts ?? [];
  const transactions = input.transactions ?? [];
  const withholdingRecords = input.withholdingRecords ?? [];
  const reviewItems = input.reviewItems ?? [];
  const coverageGaps = input.coverageGaps ?? [];

  const reasons: string[] = [];
  const missingFacts = new Set<string>();
  const escalationFlags = new Set<string>();

  const incomeCount = transactions.filter((tx) => tx.normalizedDirection === 'income').length;
  const expenseCount = transactions.filter((tx) => tx.normalizedDirection === 'expense').length;
  const highSeverityReviews = reviewItems.filter((item) => item.severity === 'high' || item.severity === 'critical');
  const openCoverageGaps = coverageGaps.filter((gap) => gap.state === 'open');

  const profileType = input.taxpayerProfile?.taxpayerType;
  const hasWithholding = withholdingRecords.length > 0;
  const hasMissingWithholdingGap = openCoverageGaps.some((gap) => gap.gapType === 'missing_withholding_record');
  const hasMissingPathGap = openCoverageGaps.some((gap) => gap.gapType === 'missing_filing_path_determination');
  const hasLargeExpenseVolume = expenseCount >= 30;
  const hasHighExpenseAmbiguity = highSeverityReviews.some((item) => item.reasonCode === 'missing_evidence' || item.reasonCode === 'high_amount_outlier');
  const hasAllocationSignal = hasFact(facts, 'shared_income_allocation') || hasFact(facts, 'joint_allocation_case');
  const hasBookkeepingSignal = hasFact(facts, 'bookkeeping_required') || hasFact(facts, 'inventory_or_asset_tracking');
  const hasOptimizationSignal = hasFact(facts, 'special_tax_treatment_choice') || hasFact(facts, 'legal_interpretation_required');
  const hasPlatformIncomeSignal = hasFact(facts, 'platform_income') || hasKeywordTransaction(transactions, ['youtube', 'google', 'meta', 'apple', 'twitch', 'patreon']);
  const hasForeignSignal = hasFact(facts, 'foreign_withholding') || hasFact(facts, 'foreign_income');
  const hasSalarySignal = hasFact(facts, 'salary_income') || hasKeywordTransaction(transactions, ['salary', 'payroll']);
  const hasSideIncomeSignal = profileType === 'mixed_income_individual' || incomeCount >= 2;

  if (hasMissingPathGap) {
    missingFacts.add('filing_path_determination');
    escalationFlags.add('missing_filing_path_determination');
  }

  if (!profileType) {
    missingFacts.add('taxpayer_type');
  }

  if (incomeCount === 0) {
    missingFacts.add('income_inventory');
  }

  if (!hasWithholding && !hasMissingWithholdingGap) {
    missingFacts.add('withholding_or_prepaid_tax_records');
  }

  if (hasAllocationSignal) {
    reasons.push('Allocation-heavy signal detected from taxpayer facts.');
    escalationFlags.add('allocation_heavy_case');
    return buildDetection('tier_c', 'allocation_heavy', 0.92, reasons, missingFacts, escalationFlags);
  }

  if (hasBookkeepingSignal || hasLargeExpenseVolume) {
    reasons.push(hasBookkeepingSignal ? 'Bookkeeping-heavy signal detected from taxpayer facts.' : 'Expense volume suggests bookkeeping-heavy handling.');
    escalationFlags.add('bookkeeping_heavy_case');
    return buildDetection('tier_c', 'bookkeeping_heavy', hasBookkeepingSignal ? 0.9 : 0.72, reasons, missingFacts, escalationFlags);
  }

  if (hasOptimizationSignal) {
    reasons.push('Specialist optimization or legal-interpretation signal detected.');
    escalationFlags.add('specialist_review_required');
    return buildDetection('tier_c', 'specialist_optimization', 0.9, reasons, missingFacts, escalationFlags);
  }

  if (hasPlatformIncomeSignal || hasForeignSignal) {
    reasons.push('Platform or foreign-income signal detected; additional treatment review is likely needed.');
    escalationFlags.add('extra_tax_treatment_handling');
    return buildDetection('tier_b', 'platform_income_extra_review', 0.78, reasons, missingFacts, escalationFlags);
  }

  if (openCoverageGaps.some((gap) => gap.gapType === 'stale_official_data')) {
    reasons.push('Official data appears unstable or stale for current filing state.');
    escalationFlags.add('official_data_unstable');
    return buildDetection('tier_b', 'official_data_unstable', 0.8, reasons, missingFacts, escalationFlags);
  }

  if (hasHighExpenseAmbiguity) {
    reasons.push('Expense handling requires explicit review gates for ambiguous items.');
    return buildDetection('tier_a', 'expense_claim_simple', 0.68, reasons, missingFacts, escalationFlags);
  }

  if (profileType === 'mixed_income_individual' || (hasSalarySignal && hasSideIncomeSignal)) {
    reasons.push('Mixed-income pattern detected with limited complexity indicators.');
    return buildDetection('tier_a', 'mixed_income_limited', 0.8, reasons, missingFacts, escalationFlags);
  }

  if ((profileType === 'freelancer' || incomeCount > 0) && hasWithholding && !hasMissingWithholdingGap) {
    reasons.push('Freelancer-like case with explicit withholding coverage detected.');
    return buildDetection('tier_a', 'freelancer_withholding_clear', 0.84, reasons, missingFacts, escalationFlags);
  }

  if (profileType === 'other' && hasWithholding && expenseCount < 10) {
    reasons.push('Simple prefilled-like path inferred from low-complexity activity and withholding presence.');
    return buildDetection('tier_a', 'prefilled_simple', 0.66, reasons, missingFacts, escalationFlags);
  }

  if (missingFacts.size > 0 || openCoverageGaps.length > 0) {
    reasons.push('Current facts are incomplete, so the case is treated as manual-heavy for now.');
    escalationFlags.add('path_not_confident_yet');
    return buildDetection('tier_b', 'manual_heavy_general', 0.55, reasons, missingFacts, escalationFlags);
  }

  reasons.push('Not enough stable evidence exists to classify the filing path confidently.');
  escalationFlags.add('path_undetermined');
  return buildDetection('undetermined', 'unknown', 0.35, reasons, missingFacts, escalationFlags);
}

function buildDetection(
  supportTier: FilingSupportTier,
  filingPathKind: FilingPathKind,
  confidence: number,
  reasons: string[],
  missingFacts: Set<string>,
  escalationFlags: Set<string>,
): FilingPathDetection {
  return {
    supportTier,
    filingPathKind,
    confidence,
    reasons,
    missingFacts: [...missingFacts],
    escalationFlags: [...escalationFlags],
  };
}

function hasFact(facts: TaxpayerFact[], factKey: string): boolean {
  return facts.some((fact) => fact.factKey === factKey && (fact.status === 'provided' || fact.status === 'inferred'));
}

function hasKeywordTransaction(transactions: LedgerTransaction[], keywords: string[]): boolean {
  return transactions.some((tx) => {
    const text = `${tx.counterparty ?? ''} ${tx.description ?? ''} ${tx.rawCategory ?? ''}`.toLowerCase();
    return keywords.some((keyword) => text.includes(keyword));
  });
}

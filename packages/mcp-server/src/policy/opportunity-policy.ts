import type { LedgerTransaction, TaxpayerFact, WithholdingRecord } from '../../../core/src/types.js';

function getFactValue(facts: TaxpayerFact[], key: string) {
  return facts.find((fact) => fact.factKey === key && fact.status !== 'missing')?.value;
}

export function buildAllocationCandidates(workspaceId: string, facts: TaxpayerFact[], transactions: LedgerTransaction[]) {
  const explanations = JSON.stringify(getFactValue(facts, 'business_use_explanations') ?? '').toLowerCase();
  return transactions
    .filter((tx) => tx.workspaceId === workspaceId)
    .filter((tx) => /vehicle|car|phone|internet|telecom|home|card/i.test(`${tx.description ?? ''} ${tx.counterparty ?? ''}`))
    .map((tx) => ({
      code: /vehicle|car/i.test(`${tx.description ?? ''} ${tx.counterparty ?? ''}`) ? 'vehicle_rule_applicable' : 'mixed_use_allocation_required',
      allocationBasis: explanations.includes('ratio') || explanations.includes('업무') ? 'operator_provided_basis' : 'missing_allocation_basis',
      businessUseRatio: explanations.includes('ratio') || explanations.includes('업무') ? 0.5 : undefined,
      evidenceRefs: tx.evidenceRefs ?? [],
      reviewLevel: explanations.includes('ratio') && (tx.evidenceRefs?.length ?? 0) > 0 ? 'medium' as const : 'high' as const,
    }));
}

export function buildSpecialCreditEligibility(posture: 'pure_business' | 'mixed_wage_business' | 'manual_heavy', facts: TaxpayerFact[]) {
  const deductionFacts = JSON.stringify(getFactValue(facts, 'deduction_eligibility_facts') ?? '').toLowerCase();
  return [{
    code: 'wage_income_credit_bundle',
    state: posture === 'pure_business' ? 'not_applicable' as const : deductionFacts.length > 2 ? 'possible' as const : 'review_required' as const,
    rationale: posture === 'pure_business' ? 'Wage-income-assumption credits like insurance/card/cash-receipt should not auto-apply to pure business cases.' : 'Potential wage-linked credits need explicit eligibility review before application.',
  }];
}

export function buildOpportunityCandidates(posture: 'pure_business' | 'mixed_wage_business' | 'manual_heavy', facts: TaxpayerFact[], bookkeepingMode?: 'simple_rate' | 'standard_rate' | 'simple_book' | 'double_entry', withholdings: WithholdingRecord[] = [], transactions: LedgerTransaction[] = []) {
  const deductionFacts = JSON.stringify(getFactValue(facts, 'deduction_eligibility_facts') ?? '').toLowerCase();
  const bundleText = JSON.stringify(getFactValue(facts, 'year_end_tax_bundle') ?? getFactValue(facts, 'deduction_eligibility_facts') ?? '').toLowerCase();
  const dependentPlan = String(getFactValue(facts, 'dependentClaimPlan') ?? '').toLowerCase();
  const residentRegisterSkip = !dependentPlan.includes('claim') && dependentPlan !== '';
  const hasBusinessAccount = JSON.stringify(getFactValue(facts, 'business_account_registered') ?? '').toLowerCase().includes('true');
  const hasBusinessCard = JSON.stringify(getFactValue(facts, 'business_credit_card_registered') ?? '').toLowerCase().includes('true');
  const mixedUseDetected = transactions.some((tx) => /phone|internet|telecom|card|home|vehicle|car/i.test(`${tx.description ?? ''} ${tx.counterparty ?? ''}`));
  const hasOfficialWithholding = withholdings.some((item) => (item.evidenceRefs?.length ?? 0) > 0 || item.sourceOfTruth === 'official');
  const candidates = [
    { code: posture === 'mixed_wage_business' ? 'mixed_posture_credit_review' : 'business_expense_review', status: 'review_required' as const, rationale: 'Opportunity depends on taxpayer posture, official rules, and evidence-backed allocation rather than automatic benefit confirmation.', evidenceNeeded: ['taxpayer posture facts', 'supporting evidence for the relevant deduction/expense path'], horizon: 'current_year' as const },
    { code: 'official_withholding_receipt_required', status: hasOfficialWithholding ? 'possible' as const : 'review_required' as const, rationale: 'Official withholding receipts are the most reliable basis for prepaid-tax credit and filing-path confidence.', evidenceNeeded: ['official withholding receipt PDF/print or equivalent HomeTax official receipt'], horizon: 'current_year' as const },
    { code: 'itemized_card_detail_required_for_expense_review', status: bundleText.includes('summary') || deductionFacts.includes('card') ? 'review_required' as const : 'possible' as const, rationale: 'Summary-only card bundles are useful for opportunity detection but do not settle business-expense treatment without line-item review.', evidenceNeeded: ['itemized card transaction detail with merchant/date/amount'], horizon: 'current_year' as const },
    {
      code: 'business_account_required',
      status: hasBusinessAccount ? 'possible' as const : 'review_required' as const,
      rationale: bookkeepingMode === 'double_entry' ? 'Double-entry/compliance-heavy posture should confirm registered business-account use in the current year because non-registration/non-use can create compliance and penalty exposure.' : 'A dedicated business account improves current-year traceability and next-year collection ergonomics.',
      evidenceNeeded: bookkeepingMode === 'double_entry' ? ['business account registration/use evidence for the current filing year'] : ['business account registration or account separation evidence'],
      horizon: bookkeepingMode === 'double_entry' ? 'current_year' as const : 'next_year' as const,
    },
    { code: 'business_credit_card_registration_recommended', status: hasBusinessCard ? 'possible' as const : 'review_required' as const, rationale: 'Registering a business credit card reduces next-year expense review friction and helps separate personal spend.', evidenceNeeded: ['business credit card registration or dedicated card usage evidence'], horizon: 'next_year' as const },
    { code: 'resident_register_not_required_if_no_dependents', status: residentRegisterSkip ? 'possible' as const : 'review_required' as const, rationale: residentRegisterSkip ? 'If no dependent claim is planned, resident register collection can usually be skipped.' : 'Dependent-claim posture may require resident-register proof.', evidenceNeeded: ['dependent claim plan confirmation'], horizon: 'current_year' as const },
  ];
  if (posture === 'pure_business') candidates.push({ code: 'wage_credit_not_auto_applicable', status: 'review_required', rationale: 'Wage-income-based card/insurance/cash-receipt benefits must not be auto-confirmed for pure business posture.', evidenceNeeded: ['explicit wage-income eligibility facts if such benefits are considered'], horizon: 'current_year' });
  if (bookkeepingMode === 'simple_book') candidates.push({ code: 'bookkeeping_tax_credit_possible', status: 'possible', rationale: 'A simple-book target who keeps compliant books may have a bookkeeping-related tax-credit opportunity, subject to official rule confirmation.', evidenceNeeded: ['bookkeeping records showing compliant bookkeeping method and eligible filing status'], horizon: 'current_year' });
  if (mixedUseDetected) candidates.push({ code: 'mixed_use_allocation_required', status: 'review_required', rationale: 'Phone/internet/card/home/vehicle costs require allocation basis, business-use ratio, and evidence before benefit treatment is settled.', evidenceNeeded: ['allocation basis', 'business use ratio', 'supporting receipts/evidence refs'], horizon: 'current_year' });
  return candidates;
}

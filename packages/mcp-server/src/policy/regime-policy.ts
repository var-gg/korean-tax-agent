import type { EvidenceDocument, LedgerTransaction, SourceArtifact, TaxpayerFact, WithholdingRecord } from '../../../core/src/types.js';

type BookkeepingMode = 'simple_rate' | 'standard_rate' | 'simple_book' | 'double_entry';

type ThresholdBasis = {
  industryCode: string;
  principalIndustryCode: string;
  actualRevenue: number;
  weightedContributionByMode: { double_entry: number; simple_book: number; standard_rate: number; simple_rate: number };
  thresholds: { double_entry: number; simple_book: number; standard_rate: number; simple_rate: number };
  thresholdSource: string;
  role: 'principal' | 'secondary';
};

const INDUSTRY_THRESHOLD_TABLE: Record<string, { double_entry: number; simple_book: number; standard_rate: number; simple_rate: number; label: string }> = {
  '940926': { double_entry: 150_000_000, simple_book: 75_000_000, standard_rate: 36_000_000, simple_rate: 36_000_000, label: 'IT freelancer / software services' },
  '940909': { double_entry: 75_000_000, simple_book: 36_000_000, standard_rate: 24_000_000, simple_rate: 24_000_000, label: 'specialized freelance / technical services' },
  default: { double_entry: 75_000_000, simple_book: 36_000_000, standard_rate: 24_000_000, simple_rate: 24_000_000, label: 'fallback service business' },
};

function getFactValue(facts: TaxpayerFact[], key: string) {
  return facts.find((fact) => fact.factKey === key && fact.status !== 'missing')?.value;
}

export function deriveBookkeepingRegime(input: { workspaceId: string; facts: TaxpayerFact[]; withholdings?: WithholdingRecord[]; sourceArtifacts?: SourceArtifact[]; evidenceDocuments?: EvidenceDocument[] }) {
  const materialSignals = (input.sourceArtifacts ?? [])
    .filter((artifact) => artifact.workspaceId === input.workspaceId)
    .map((artifact) => {
      const metadata = (artifact.provenance as { metadata?: { industryCode?: string; grossAmount?: number } } | undefined)?.metadata;
      return { industryCode: String(metadata?.industryCode ?? 'default'), actualRevenue: Number(metadata?.grossAmount ?? 0) };
    })
    .filter((item) => item.actualRevenue > 0);
  const withholdingSignals = input.withholdings
    ?.filter((item) => item.workspaceId === input.workspaceId)
    .map((item) => ({ industryCode: (item as WithholdingRecord & { industryCode?: string }).industryCode ?? 'default', actualRevenue: item.grossAmount ?? 0 }))
    .filter((item) => item.actualRevenue > 0) ?? [];
  const industrySignals = (materialSignals.length > 0 ? materialSignals : withholdingSignals).sort((a, b) => b.actualRevenue - a.actualRevenue);
  const priorYearText = JSON.stringify(getFactValue(input.facts, 'prior_year_regime') ?? '').toLowerCase();
  const explicitBookkeeping = String(getFactValue(input.facts, 'bookkeeping_mode') ?? '').toLowerCase();
  const operatorWarnings: Array<{ code: string; message: string }> = [];

  if (industrySignals.length === 0) {
    if (explicitBookkeeping) {
      const bookkeepingMode: BookkeepingMode = explicitBookkeeping.includes('double') || explicitBookkeeping.includes('복식') ? 'double_entry' : explicitBookkeeping.includes('simple_book') || explicitBookkeeping.includes('간편장부') ? 'simple_book' : explicitBookkeeping.includes('standard') ? 'standard_rate' : 'simple_rate';
      if ((priorYearText.includes('3.3') || priorYearText.includes('simple_rate')) && bookkeepingMode === 'double_entry') {
        operatorWarnings.push({ code: 'regime_shift_detected', message: 'Prior-year 3.3%/simple posture differs from current-year bookkeeping posture, but prior year alone is not the deciding basis.' });
      }
      return { bookkeepingMode, regimeDerivation: 'user_provided_bookkeeping_mode', regimeConfidenceBand: 'medium' as const, principalIndustryCode: undefined, industryThresholdBasis: [] as ThresholdBasis[], operatorWarnings };
    }
    operatorWarnings.push({ code: 'industry_threshold_evidence_missing', message: 'Official material metadata is not yet sufficient to infer industry-threshold bookkeeping automatically.' });
    return { bookkeepingMode: 'simple_rate' as const, regimeDerivation: 'insufficient_official_material_metadata', regimeConfidenceBand: 'low' as const, principalIndustryCode: undefined, industryThresholdBasis: [] as ThresholdBasis[], operatorWarnings };
  }

  const principal = industrySignals[0];
  const principalThresholds = INDUSTRY_THRESHOLD_TABLE[principal.industryCode] ?? INDUSTRY_THRESHOLD_TABLE.default;
  const weightedContributionByIndustry: ThresholdBasis[] = industrySignals.map((item, index) => {
    const thresholds = INDUSTRY_THRESHOLD_TABLE[item.industryCode] ?? INDUSTRY_THRESHOLD_TABLE.default;
    const contribution = index === 0
      ? { double_entry: item.actualRevenue, simple_book: item.actualRevenue, standard_rate: item.actualRevenue, simple_rate: item.actualRevenue }
      : {
          double_entry: item.actualRevenue * (principalThresholds.double_entry / thresholds.double_entry),
          simple_book: item.actualRevenue * (principalThresholds.simple_book / thresholds.simple_book),
          standard_rate: item.actualRevenue * (principalThresholds.standard_rate / thresholds.standard_rate),
          simple_rate: item.actualRevenue * (principalThresholds.simple_rate / thresholds.simple_rate),
        };
    return {
      industryCode: item.industryCode,
      principalIndustryCode: principal.industryCode,
      actualRevenue: item.actualRevenue,
      weightedContributionByMode: contribution,
      thresholds,
      thresholdSource: index === 0 ? `principal:${principal.industryCode}` : `principal:${principal.industryCode}->secondary:${item.industryCode}`,
      role: index === 0 ? 'principal' : 'secondary',
    };
  });
  const weightedRevenueByMode = weightedContributionByIndustry.reduce((acc, item) => ({
    double_entry: acc.double_entry + item.weightedContributionByMode.double_entry,
    simple_book: acc.simple_book + item.weightedContributionByMode.simple_book,
    standard_rate: acc.standard_rate + item.weightedContributionByMode.standard_rate,
    simple_rate: acc.simple_rate + item.weightedContributionByMode.simple_rate,
  }), { double_entry: 0, simple_book: 0, standard_rate: 0, simple_rate: 0 });
  const bookkeepingMode: BookkeepingMode = weightedRevenueByMode.double_entry >= principalThresholds.double_entry
    ? 'double_entry'
    : weightedRevenueByMode.simple_book >= principalThresholds.simple_book
      ? 'simple_book'
      : weightedRevenueByMode.standard_rate >= principalThresholds.standard_rate
        ? 'standard_rate'
        : 'simple_rate';

  if ((priorYearText.includes('3.3') || priorYearText.includes('simple_rate')) && bookkeepingMode === 'double_entry') {
    operatorWarnings.push({ code: 'regime_shift_detected', message: 'Prior-year 3.3%/simple posture differs from current-year imported-official-material regime, but prior year alone is not the deciding basis.' });
  }
  if (industrySignals.length > 1) {
    operatorWarnings.push({ code: 'multi_industry_threshold_formula_applied', message: 'Multiple industries detected; principal-industry plus secondary-industry weighting was applied instead of plain summation.' });
  }

  return {
    bookkeepingMode,
    regimeDerivation: `official_materials_threshold_engine:${principal.industryCode}:double_entry=${weightedRevenueByMode.double_entry}:simple_book=${weightedRevenueByMode.simple_book}:standard_rate=${weightedRevenueByMode.standard_rate}:simple_rate=${weightedRevenueByMode.simple_rate}`,
    regimeConfidenceBand: industrySignals.every((item) => item.actualRevenue > 0) ? 'high' as const : 'medium' as const,
    principalIndustryCode: principal.industryCode,
    industryThresholdBasis: weightedContributionByIndustry,
    operatorWarnings,
  };
}

export function deriveTaxProfileSignals(facts: TaxpayerFact[], transactions: LedgerTransaction[], withholdings: WithholdingRecord[] = [], sourceArtifacts: SourceArtifact[] = [], evidenceDocuments: EvidenceDocument[] = []) {
  const streamsText = JSON.stringify(getFactValue(facts, 'income_streams') ?? '').toLowerCase();
  const postureText = String(getFactValue(facts, 'taxpayer_posture') ?? '').toLowerCase();
  const hasWage = streamsText.includes('salary') || streamsText.includes('wage') || postureText.includes('wage') || postureText.includes('근로');
  const hasBusiness = streamsText.includes('business') || streamsText.includes('freelance') || streamsText.includes('platform') || postureText.includes('business') || postureText.includes('프리랜서') || postureText.includes('사업') || withholdings.length > 0;
  const taxpayerPosture: 'pure_business' | 'mixed_wage_business' | 'manual_heavy' = hasWage && hasBusiness ? 'mixed_wage_business' : hasBusiness ? 'pure_business' : 'manual_heavy';
  const regime = deriveBookkeepingRegime({ workspaceId: facts[0]?.workspaceId ?? transactions[0]?.workspaceId ?? withholdings[0]?.workspaceId ?? 'workspace', facts, withholdings, sourceArtifacts, evidenceDocuments });
  const operatorWarnings: Array<{ code: string; message: string }> = [...regime.operatorWarnings];
  if (transactions.some((tx) => /vehicle|car|phone|internet|telecom|home/i.test(`${tx.description ?? ''} ${tx.counterparty ?? ''}`))) {
    operatorWarnings.push({ code: 'mixed_use_review_scope', message: 'Mixed-use expense candidates detected; allocation basis and evidence must be reviewed before applying benefits.' });
  }
  return {
    taxpayerPosture,
    bookkeepingMode: regime.bookkeepingMode,
    regimeDerivation: regime.regimeDerivation,
    regimeConfidenceBand: regime.regimeConfidenceBand,
    principalIndustryCode: regime.principalIndustryCode,
    industryThresholdBasis: regime.industryThresholdBasis,
    operatorWarnings,
  };
}

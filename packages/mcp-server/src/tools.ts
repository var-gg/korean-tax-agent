import { compareWithHomeTax } from '../../core/src/compare.js';
import { buildConsentPrompt, evaluateConsent, type ConsentRequirement } from '../../core/src/consent.js';
import { computeDraftFromLedger } from '../../core/src/draft.js';
import { detectFilingPath } from '../../core/src/path.js';
import { deriveCalibratedReadiness, deriveReadinessSummary } from '../../core/src/readiness.js';
import { classifyTransactions } from '../../core/src/classify.js';
import { buildReviewQueue, resolveReviewItems, summarizeReviewQueue } from '../../core/src/review.js';
import {
  blockSyncAttempt,
  completeSyncAttempt,
  createAuditEvent,
  createSourceConnection,
  deriveCheckpointTypeFromSourceState,
  derivePendingUserAction,
  transitionSourceState,
} from '../../core/src/state.js';
import { getRegistryFreshness, getSourceMethodRegistryEntry, validateRegistryEntryDates } from './source-method-registry.js';
import type {
  ClassificationDecision,
  ConsentRecord,
  CoverageByDomain,
  CoverageGap,
  EvidenceDocument,
  FilingAdjustmentCandidate,
  FilingCoverageDomain,
  FilingSectionValue,
  FilingFactCompleteness,
  FilingFactCategory,
  LedgerTransaction,
  MappedReadinessState,
  ReviewItem,
  SourceArtifact,
  SourceConnection,
  TaxpayerFact,
  WithholdingRecord,
} from '../../core/src/types.js';
import type {
  CollectionStatusData,
  CollectionTask,
  CompareWithHomeTaxData,
  CompareWithHomeTaxInput,
  ComputeDraftData,
  ComputeDraftInput,
  ConnectSourceData,
  ConnectSourceInput,
  DetectFilingPathData,
  DisconnectSourceData,
  DisconnectSourceInput,
  ImportHomeTaxMaterialsData,
  ImportHomeTaxMaterialsInput,
  ListSourcesData,
  ListSourcesInput,
  DetectFilingPathInput,
  GetCollectionStatusInput,
  SubmitExtractedReceiptFieldsData,
  SubmitExtractedReceiptFieldsInput,
  UploadDocumentsData,
  UploadDocumentsInput,
  UploadTransactionsData,
  UploadTransactionsInput,
  InitConfigData,
  InitConfigInput,
  InspectEnvironmentData,
  InspectEnvironmentInput,
  MCPResponseEnvelope,
  ListAdjustmentCandidatesData,
  ListAdjustmentCandidatesInput,
  ListCoverageGapsData,
  ListCoverageGapsInput,
  ListMissingFactsData,
  ListMissingFactsInput,
  NormalizeLedgerData,
  NormalizeLedgerInput,
  PlanCollectionData,
  PlanCollectionInput,
  PrepareHomeTaxData,
  PrepareHomeTaxInput,
  UpsertTaxpayerFactsData,
  UpsertTaxpayerFactsInput,
  RefreshOfficialDataData,
  RefreshOfficialDataInput,
  ResolveReviewItemInput,
  ResumeSyncData,
  ResumeSyncInput,
  RunClassificationData,
  RunClassificationInput,
  StartHomeTaxAssistData,
  StartHomeTaxAssistInput,
  SyncSourceData,
  SyncSourceInput,
} from './contracts.js';

function deriveCoverageByDomainFromLegacyReadiness(readiness: {
  blockerCodes: string[];
  comparisonSummaryState: string;
}): CoverageByDomain {
  const coverage: CoverageByDomain = {
    filingPath: readiness.blockerCodes.includes('unsupported_filing_path') ? 'weak' : 'partial',
    incomeInventory: 'partial',
    withholdingPrepaidTax: readiness.blockerCodes.includes('missing_material_coverage') ? 'weak' : 'partial',
    expenseEvidence: 'partial',
    deductionFacts: readiness.blockerCodes.includes('awaiting_review_decision') ? 'weak' : 'partial',
    submissionComparison:
      readiness.comparisonSummaryState === 'matched_enough'
        ? 'strong'
        : readiness.comparisonSummaryState === 'partial'
          ? 'partial'
          : 'weak',
  };

  return coverage;
}

function summarizeCoverage(coverage: CoverageByDomain) {
  const entries = Object.entries(coverage) as Array<[FilingCoverageDomain, CoverageByDomain[FilingCoverageDomain]]>;
  return {
    strongDomains: entries.filter(([, value]) => value === 'strong').map(([key]) => key),
    partialDomains: entries.filter(([, value]) => value === 'partial').map(([key]) => key),
    weakDomains: entries.filter(([, value]) => value === 'weak' || value === 'none').map(([key]) => key),
  };
}

function mapCalibratedReadinessState(result: ReturnType<typeof deriveCalibratedReadiness>): MappedReadinessState {
  return {
    readiness: result.workspaceReadiness,
    coverageByDomain: result.coverageByDomain,
    materialCoverageSummary: result.materialCoverageSummary,
    majorUnknowns: result.majorUnknowns,
    activeBlockers: result.activeBlockers,
    supportTier: result.supportTier,
  };
}

function mapLegacyReadinessState(readiness: {
  supportTier: import('../../core/src/types.js').FilingSupportTier;
  estimateReadiness: import('../../core/src/types.js').ReadinessLevel;
  draftReadiness: import('../../core/src/types.js').ReadinessLevel;
  submissionReadiness: import('../../core/src/types.js').ReadinessLevel;
  comparisonSummaryState: import('../../core/src/types.js').FilingComparisonSummaryState;
  majorUnknowns: string[];
  blockerCodes: import('../../core/src/types.js').BlockingReason[];
}): MappedReadinessState {
  const coverageByDomain = deriveCoverageByDomainFromLegacyReadiness(readiness);
  return {
    readiness: {
      estimateReadiness: readiness.estimateReadiness === 'not_ready' ? 'not_ready' : readiness.estimateReadiness === 'estimate_ready' ? 'ready' : 'ready',
      draftReadiness: readiness.draftReadiness === 'draft_ready' ? 'ready' : readiness.draftReadiness === 'estimate_ready' ? 'limited' : 'not_ready',
      submissionReadiness:
        readiness.submissionReadiness === 'submission_assist_ready'
          ? 'ready'
          : readiness.blockerCodes.includes('unsupported_filing_path')
            ? 'unsupported'
            : readiness.submissionReadiness === 'draft_ready'
              ? 'blocked'
              : 'not_ready',
      confidenceBand: 'medium',
      supportTier: readiness.supportTier,
      majorUnknowns: readiness.majorUnknowns,
    },
    coverageByDomain,
    materialCoverageSummary: summarizeCoverage(coverageByDomain),
    majorUnknowns: readiness.majorUnknowns,
    supportTier: readiness.supportTier,
  };
}

function buildCollectionReadinessState(params: {
  supportTier?: import('../../core/src/types.js').FilingSupportTier;
  pendingCheckpoints?: number;
  blockedAttempts?: string[];
  coverageGaps?: CoverageGap[];
  sourceState?: import('../../core/src/types.js').SourceState;
  blockingReason?: import('../../core/src/types.js').BlockingReason;
  resumed?: boolean;
}): MappedReadinessState {
  const blocked = (params.blockedAttempts?.length ?? 0) > 0 || params.blockingReason !== undefined;
  const openCoverageGaps = (params.coverageGaps ?? []).filter((gap) => gap.state === 'open');
  const hasCoverageGaps = openCoverageGaps.length > 0;
  const submissionComparison = params.resumed ? 'partial' : 'weak';
  const coverageByDomain: CoverageByDomain = {
    filingPath: hasCoverageGaps ? 'weak' : 'partial',
    incomeInventory: params.resumed ? 'partial' : 'weak',
    withholdingPrepaidTax: blocked || hasCoverageGaps ? 'weak' : 'partial',
    expenseEvidence: params.resumed ? 'partial' : 'weak',
    deductionFacts: 'weak',
    submissionComparison,
  };

  const majorUnknowns = [
    ...(blocked ? ['Source collection is still blocked or incomplete.'] : []),
    ...openCoverageGaps.map((gap) => gap.description),
    ...((params.pendingCheckpoints ?? 0) > 0 ? ['A user checkpoint is still pending before stronger readiness claims.'] : []),
  ];

  return {
    readiness: {
      estimateReadiness: params.resumed ? 'limited' : 'not_ready',
      draftReadiness: params.resumed && !hasCoverageGaps ? 'limited' : 'not_ready',
      submissionReadiness: blocked || hasCoverageGaps ? 'blocked' : 'not_ready',
      confidenceBand: params.resumed ? 'medium' : 'low',
      supportTier: params.supportTier ?? 'undetermined',
      majorUnknowns,
    },
    coverageByDomain,
    materialCoverageSummary: summarizeCoverage(coverageByDomain),
    majorUnknowns,
    supportTier: params.supportTier ?? 'undetermined',
    readinessImpact: params.blockingReason
      ? {
          estimateReadiness: 'unchanged',
          draftReadiness: 'downgraded_to_not_ready',
          submissionReadiness: 'blocked',
        }
      : undefined,
  };
}

export function taxSetupInspectEnvironment(input: InspectEnvironmentInput = {}): MCPResponseEnvelope<InspectEnvironmentData> {
  const configPath = input.configPath?.trim();
  const storageReady = true;
  const availableConnectors = ['hometax', 'local_documents', 'bank_csv'];
  const supportedImportModes = ['browser_assist', 'export_ingestion', 'fact_capture'];

  return {
    ok: true,
    status: 'completed',
    data: {
      storageReady,
      supportedImportModes,
      availableConnectors,
      browserAssistAvailable: true,
      missingDependencies: configPath ? [] : ['config_path_not_provided'],
    },
    nextRecommendedAction: 'tax.setup.init_config',
  };
}

export function taxSetupInitConfig(input: InitConfigInput): MCPResponseEnvelope<InitConfigData> {
  const workspacePath = input.workspacePath?.trim() || `./workspaces/${input.filingYear}/${input.taxpayerTypeHint?.trim() || 'default'}`;
  const workspaceId = `workspace_${input.filingYear}_${slugifyWorkspaceSegment(input.taxpayerTypeHint)}`;

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId,
      filingYear: input.filingYear,
      storageMode: 'local',
      workspacePath,
    },
    nextRecommendedAction: 'tax.sources.plan_collection',
  };
}

const ADJUSTMENT_CANDIDATE_RULES: Array<{
  adjustmentType: string;
  requiredFactKeys: string[];
  supportTier: FilingAdjustmentCandidate['supportTier'];
  derive: (params: { facts: TaxpayerFact[]; transactions: LedgerTransaction[]; withholdingRecords: WithholdingRecord[] }) => { eligibilityState: FilingAdjustmentCandidate['eligibilityState']; amountCandidate?: number; confidenceScore: number; rationale: string; reviewRequired: boolean };
}> = [
  {
    adjustmentType: 'basic_expense_freelance',
    requiredFactKeys: ['taxpayer_posture', 'income_streams'],
    supportTier: 'tier_a',
    derive: ({ facts, transactions }) => {
      const hasFreelance = facts.some((fact) => fact.factKey === 'income_streams' && String(JSON.stringify(fact.value)).includes('freelance'));
      const incomeTotal = transactions.filter((tx) => tx.normalizedDirection === 'income').reduce((sum, tx) => sum + Math.max(0, tx.amount), 0);
      return {
        eligibilityState: hasFreelance ? 'supported' : 'manual_only',
        amountCandidate: hasFreelance ? Math.round(incomeTotal * 0.6) : undefined,
        confidenceScore: hasFreelance ? 0.72 : 0.4,
        rationale: hasFreelance ? 'Freelance/platform income suggests a standard expense review candidate.' : 'Need clearer freelance/business posture before applying this candidate.',
        reviewRequired: !hasFreelance,
      };
    },
  },
  {
    adjustmentType: 'withholding_tax_credit',
    requiredFactKeys: ['income_streams'],
    supportTier: 'tier_a',
    derive: ({ withholdingRecords }) => {
      const total = withholdingRecords.reduce((sum, record) => sum + record.withheldTaxAmount + (record.localTaxAmount ?? 0), 0);
      const unresolved = withholdingRecords.some((record) => record.reviewStatus !== 'reviewed');
      return {
        eligibilityState: total > 0 ? 'supported' : 'manual_only',
        amountCandidate: total > 0 ? total : undefined,
        confidenceScore: unresolved ? 0.55 : 0.9,
        rationale: total > 0 ? 'Explicit withholding/prepaid-tax records can be credited before relying on generic inference.' : 'No explicit withholding/prepaid-tax record is confirmed yet.',
        reviewRequired: total <= 0 || unresolved,
      };
    },
  },
  {
    adjustmentType: 'special_tax_treatment_review',
    requiredFactKeys: ['special_tax_treatment_choice'],
    supportTier: 'tier_c',
    derive: ({ facts }) => {
      const hasChoice = facts.some((fact) => fact.factKey === 'special_tax_treatment_choice' && fact.status !== 'missing');
      return {
        eligibilityState: hasChoice ? 'manual_only' : 'out_of_scope',
        confidenceScore: hasChoice ? 0.45 : 0.2,
        rationale: hasChoice ? 'Special treatment choice exists but still needs manual/legal confirmation.' : 'No supported automated path for special tax treatment choice.',
        reviewRequired: true,
      };
    },
  },
];

const FACT_CAPTURE_RULES: Array<{
  factKey: string;
  category: FilingFactCategory;
  priority: FilingFactCompleteness['priority'];
  materiality: FilingFactCompleteness['materiality'];
  whyItMatters: string;
  bestQuestion: string;
  blockingStage: FilingFactCompleteness['blockingStage'];
}> = [
  { factKey: 'income_streams', category: 'income_stream', priority: 'high', materiality: 'high', whyItMatters: 'Determines what income categories and schedules must be included.', bestQuestion: '올해 신고 대상 소득 흐름을 모두 말해 주세요. 급여/프리랜서/사업/플랫폼/해외소득이 있었나요?', blockingStage: 'collection' },
  { factKey: 'taxpayer_posture', category: 'taxpayer_profile', priority: 'high', materiality: 'high', whyItMatters: 'Controls path selection and whether the case fits a supported filing path.', bestQuestion: '이번 신고에서 본인 상황을 가장 잘 설명하는 형태는 무엇인가요? 근로+사업, 순수사업, 수동검토가 많은 편 중 어디에 가까운가요?', blockingStage: 'filing_path' },
  { factKey: 'residency_context', category: 'taxpayer_profile', priority: 'high', materiality: 'high', whyItMatters: 'Residency can materially change filing treatment and supported-path eligibility.', bestQuestion: '신고 연도 기준 거주자/비거주자 판단에 영향 줄 해외 체류나 거주 이슈가 있었나요?', blockingStage: 'filing_path' },
  { factKey: 'business_use_explanations', category: 'business_use', priority: 'medium', materiality: 'high', whyItMatters: 'Business-use explanations determine whether mixed-use expense evidence can be used in the draft.', bestQuestion: '사업 관련 비용 중 개인 사용과 섞일 수 있는 지출이 있다면 업무 사용 비율과 근거를 남겨 주세요.', blockingStage: 'draft' },
  { factKey: 'deduction_eligibility_facts', category: 'deduction_eligibility', priority: 'medium', materiality: 'medium', whyItMatters: 'Deduction eligibility facts affect whether deductions can be claimed safely.', bestQuestion: '공제 적용 판단에 필요한 가족/보험/교육/의료/기부 사실 중 빠진 것이 있나요?', blockingStage: 'draft' },
];

function getFactValue(facts: TaxpayerFact[], key: string) {
  return facts.find((fact) => fact.factKey === key && fact.status !== 'missing')?.value;
}

function deriveTaxProfileSignals(facts: TaxpayerFact[], transactions: LedgerTransaction[]) {
  const streamsText = JSON.stringify(getFactValue(facts, 'income_streams') ?? '').toLowerCase();
  const postureText = String(getFactValue(facts, 'taxpayer_posture') ?? '').toLowerCase();
  const bookkeepingText = String(getFactValue(facts, 'bookkeeping_mode') ?? '').toLowerCase();
  const priorYearText = JSON.stringify(getFactValue(facts, 'prior_year_regime') ?? '').toLowerCase();
  const hasWage = streamsText.includes('salary') || streamsText.includes('wage') || postureText.includes('wage') || postureText.includes('근로');
  const hasBusiness = streamsText.includes('business') || streamsText.includes('freelance') || streamsText.includes('platform') || postureText.includes('business') || postureText.includes('프리랜서') || postureText.includes('사업');
  const taxpayerPosture: 'pure_business' | 'mixed_wage_business' | 'manual_heavy' = hasWage && hasBusiness ? 'mixed_wage_business' : hasBusiness ? 'pure_business' : 'manual_heavy';
  const bookkeepingMode: 'simple_rate' | 'standard_rate' | 'simple_book' | 'double_entry' = bookkeepingText.includes('double') || bookkeepingText.includes('복식') ? 'double_entry' : bookkeepingText.includes('simple_book') || bookkeepingText.includes('간편장부') ? 'simple_book' : bookkeepingText.includes('standard') ? 'standard_rate' : 'simple_rate';
  const operatorWarnings: Array<{ code: string; message: string }> = [];
  if ((priorYearText.includes('3.3') || priorYearText.includes('simple_rate')) && bookkeepingMode === 'double_entry') {
    operatorWarnings.push({ code: 'regime_shift_detected', message: 'Year-over-year regime shift detected: prior year 3.3%/simple treatment versus current double-entry posture.' });
  }
  if (transactions.some((tx) => /vehicle|car|phone|internet|telecom|home/i.test(`${tx.description ?? ''} ${tx.counterparty ?? ''}`))) {
    operatorWarnings.push({ code: 'mixed_use_review_scope', message: 'Mixed-use expense candidates detected; allocation basis and evidence must be reviewed before applying benefits.' });
  }
  return { taxpayerPosture, bookkeepingMode, operatorWarnings };
}

function buildAllocationCandidates(workspaceId: string, facts: TaxpayerFact[], transactions: LedgerTransaction[]) {
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

function buildSpecialCreditEligibility(posture: 'pure_business' | 'mixed_wage_business' | 'manual_heavy', facts: TaxpayerFact[]) {
  const deductionFacts = JSON.stringify(getFactValue(facts, 'deduction_eligibility_facts') ?? '').toLowerCase();
  return [{
    code: 'wage_income_credit_bundle',
    state: posture === 'pure_business' ? 'not_applicable' as const : deductionFacts.length > 2 ? 'possible' as const : 'review_required' as const,
    rationale: posture === 'pure_business' ? 'Wage-income-assumption credits like insurance/card/cash-receipt should not auto-apply to pure business cases.' : 'Potential wage-linked credits need explicit eligibility review before application.',
  }];
}

function buildOpportunityCandidates(posture: 'pure_business' | 'mixed_wage_business' | 'manual_heavy', facts: TaxpayerFact[]) {
  const deductionFacts = JSON.stringify(getFactValue(facts, 'deduction_eligibility_facts') ?? '').toLowerCase();
  return [
    { code: 'card_summary_opportunity', status: deductionFacts.includes('card') ? 'review_required' as const : 'possible' as const, rationale: 'Card/insurance/cash-receipt summaries create opportunity signals only; they do not confirm a tax benefit.' },
    { code: posture === 'mixed_wage_business' ? 'mixed_posture_credit_review' : 'business_expense_review', status: 'review_required' as const, rationale: 'Opportunity depends on taxpayer posture, regime, and evidence-backed allocation.' },
  ];
}

function enrichCoverageGap(gap: CoverageGap): CoverageGap {
  if (gap.whyItBlocks && gap.recommendedNextAction && gap.collectionMode) return gap;
  const mapping: Record<string, { whyItBlocks: string; recommendedNextAction: string; collectionMode: CoverageGap['collectionMode'] }> = {
    missing_income_source: {
      whyItBlocks: 'Income inventory is incomplete, so the agent cannot safely know what must be reported.',
      recommendedNextAction: 'tax.sources.plan_collection',
      collectionMode: 'browser_assist',
    },
    missing_withholding_record: {
      whyItBlocks: 'Explicit withholding/prepaid tax is missing, so credits and submission readiness remain unreliable.',
      recommendedNextAction: 'tax.withholding.list_records',
      collectionMode: 'browser_assist',
    },
    missing_expense_evidence: {
      whyItBlocks: 'Expense claims cannot be defended or applied confidently without linked evidence.',
      recommendedNextAction: 'tax.import.upload_documents',
      collectionMode: 'export_ingestion',
    },
    missing_deduction_fact: {
      whyItBlocks: 'Required taxpayer facts for deductions/credits are still missing, so adjustment decisions are incomplete.',
      recommendedNextAction: 'tax.profile.list_missing_facts',
      collectionMode: 'fact_capture',
    },
    missing_hometax_comparison: {
      whyItBlocks: 'Submission assist cannot proceed until draft values are compared against HomeTax-observed values.',
      recommendedNextAction: 'tax.filing.compare_with_hometax',
      collectionMode: 'browser_assist',
    },
  };
  const matched = mapping[gap.gapType] ?? {
    whyItBlocks: 'A material coverage gap still blocks progress.',
    recommendedNextAction: gap.recommendedNextAction ?? 'tax.sources.plan_collection',
    collectionMode: 'export_ingestion' as const,
  };
  return {
    ...gap,
    whyItBlocks: gap.whyItBlocks ?? matched.whyItBlocks,
    recommendedNextAction: gap.recommendedNextAction ?? matched.recommendedNextAction,
    collectionMode: gap.collectionMode ?? matched.collectionMode,
  };
}

function buildGapNextActionPlan(gaps: CoverageGap[]) {
  const enriched = gaps.filter((gap) => gap.state === 'open').map(enrichCoverageGap);
  const rank = (gap: CoverageGap) => {
    const byMode = gap.collectionMode === 'browser_assist' ? 0 : gap.collectionMode === 'export_ingestion' ? 1 : 2;
    const bySeverity = gap.severity === 'high' ? 0 : gap.severity === 'medium' ? 1 : 2;
    return byMode * 10 + bySeverity;
  };
  const prioritizedGap = [...enriched].sort((a, b) => rank(a) - rank(b))[0];
  const nextActionPlan = prioritizedGap
    ? {
        gapId: prioritizedGap.gapId,
        gapType: prioritizedGap.gapType,
        recommendedNextAction: prioritizedGap.recommendedNextAction ?? 'tax.sources.plan_collection',
        collectionMode: (prioritizedGap.collectionMode === 'direct_connector' ? 'browser_assist' : (prioritizedGap.collectionMode ?? 'export_ingestion')) as 'browser_assist' | 'export_ingestion' | 'fact_capture',
        whyThisIsNext: prioritizedGap.whyItBlocks ?? prioritizedGap.description,
      }
    : undefined;
  return { enriched, prioritizedGap, nextActionPlan };
}

function buildTierAFreelancerCollectionTasks(workspaceId: string, filingYear: number, verifiedAt?: string): CollectionTask[] {
  const task = (base: CollectionTask): CollectionTask => {
    const entry = getSourceMethodRegistryEntry(base.sourceCategory, base.targetArtifactType);
    const freshness = entry ? getRegistryFreshness(entry) : undefined;
    const dateWarnings = entry ? validateRegistryEntryDates(entry) : [];
    return {
      ...base,
      whyThisSourceNow: `${base.whyThisSourceNow}${entry ? ` Preferred method: ${entry.preferredMethod}.` : ''}${freshness?.reverifyRecommended ? ' Re-verify recommended before relying on this method guidance.' : ''}${dateWarnings.length ? ` Registry date warning: ${dateWarnings.join(', ')}.` : ''}`,
      portalPathHints: [
        ...base.portalPathHints,
        ...(entry?.knownInvalidMethods.length ? [`Known invalid methods: ${entry.knownInvalidMethods.map((item) => `${item.method} (invalid as of ${item.invalidAsOf})`).join(', ')}`] : []),
        ...(freshness ? [`Registry verifiedAt=${entry?.verifiedAt}; reviewAfter=${entry?.reviewAfter}; expiresAt=${freshness.expiresAt}`] : []),
      ],
      verifiedAt: verifiedAt ?? entry?.verifiedAt,
    };
  };

  return [
    task({
      taskId: `task_${workspaceId}_hometax_withholding_${filingYear}`,
      sourceCategory: 'hometax',
      collectionMode: 'browser_assist',
      targetArtifactType: 'withholding_receipt',
      acceptedArtifactShapes: ['HomeTax official withholding tax receipt print/PDF', 'HomeTax printable official certificate/export rendered as PDF'],
      rejectedArtifactShapes: ['withholding list XLS only without the official print/PDF', 'payer-side informal screenshot without official receipt details', 'summary-only withholding table without official printable form'],
      portalPathHints: ['HomeTax > MyHomeTax > 지급명세서/원천징수영수증', 'Use print/PDF output, not only table list view'],
      whyThisSourceNow: 'Official withholding receipts are the highest-authority prepaid tax source and block Tier A filing if missing.',
      userCheckpointBrief: 'Log into HomeTax and let the external browser agent collect the official withholding receipt PDF/print.',
      sufficiencyRule: 'HomeTax withholding is sufficient only with the official PDF/print or equivalent official printable certificate. XLS/list/summary-only is insufficient_artifact.',
      blockingIfMissing: true,
      fallbackTaskIds: [`task_${workspaceId}_hometax_packet_${filingYear}`, `task_${workspaceId}_manual_income_facts_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.sources.connect',
    }),
    task({
      taskId: `task_${workspaceId}_hometax_notice_${filingYear}`,
      sourceCategory: 'hometax',
      collectionMode: 'browser_assist',
      targetArtifactType: 'filing_guidance_notice',
      acceptedArtifactShapes: ['HomeTax 신고안내정보 official page print/PDF', 'official notice export captured with year and taxpayer context'],
      rejectedArtifactShapes: ['free-text summary from memory', 'cropped screenshot without year/taxpayer context'],
      portalPathHints: ['HomeTax > 종합소득세 > 신고도움서비스 / 신고안내정보'],
      whyThisSourceNow: 'The filing guidance notice helps confirm prefilled scope, notices, and supported-path assumptions early.',
      userCheckpointBrief: 'Collect the official HomeTax filing guidance notice print/PDF for the filing year.',
      sufficiencyRule: 'The notice must preserve year and taxpayer context; memory-based summaries are not enough.',
      blockingIfMissing: true,
      fallbackTaskIds: [`task_${workspaceId}_hometax_withholding_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.sources.connect',
    }),
    task({
      taskId: `task_${workspaceId}_hometax_packet_${filingYear}`,
      sourceCategory: 'hometax',
      collectionMode: 'export_ingestion',
      targetArtifactType: 'year_end_tax_bundle',
      acceptedArtifactShapes: ['연말정산 간소화 PDF bundle', 'official HomeTax export bundle with named deduction documents', '2023 season packet with official PDFs attached'],
      rejectedArtifactShapes: ['summary-only bundle cover page', 'manually retyped deduction totals only'],
      portalPathHints: ['HomeTax > 연말정산간소화 > PDF 내려받기 / 일괄 다운로드', 'For older season packets, keep attachment filenames and packet date context'],
      whyThisSourceNow: 'The HomeTax packet is a high-leverage first-wave export when official browser prints are blocked or an older season packet already exists.',
      userCheckpointBrief: 'Upload the official HomeTax packet or simplification bundle with filenames and season context intact.',
      sufficiencyRule: 'Bundle summaries help deduction overview but do not replace itemized business expense evidence.',
      blockingIfMissing: false,
      fallbackTaskIds: [`task_${workspaceId}_card_itemized_${filingYear}`, `task_${workspaceId}_conditional_supporting_docs_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.import.import_hometax_materials',
    }),
    task({
      taskId: `task_${workspaceId}_card_itemized_${filingYear}`,
      sourceCategory: 'card_statement',
      collectionMode: 'export_ingestion',
      targetArtifactType: 'card_itemized_detail',
      acceptedArtifactShapes: ['itemized card statement PDF/CSV with line items, merchant, date, and amount', 'official card transaction detail export'],
      rejectedArtifactShapes: ['summary-only card monthly totals', 'bundle cover sheet without line items'],
      portalPathHints: ['Request itemized detail only when expense review needs line-item support'],
      whyThisSourceNow: 'Itemized card detail is the right follow-up when expense evidence is still weak after first-wave HomeTax collection.',
      userCheckpointBrief: 'Provide itemized card detail, not just monthly totals or summary bundles.',
      sufficiencyRule: 'Summary-only card bundles are insufficient; line-item detail is required for business-expense review.',
      blockingIfMissing: false,
      fallbackTaskIds: [`task_${workspaceId}_petty_receipts_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.import.upload_documents',
    }),
    task({
      taskId: `task_${workspaceId}_secure_mail_${filingYear}`,
      sourceCategory: 'secure_mail',
      collectionMode: 'export_ingestion',
      targetArtifactType: 'secure_mail_attachment',
      acceptedArtifactShapes: ['actual downloadable attachment from secure mail', 'attachment after password checkpoint is completed'],
      rejectedArtifactShapes: ['password-gated secure mail HTML only', 'secure mail screenshot without downloaded attachment'],
      portalPathHints: ['Secure mail HTML itself is usually not evidence; retrieve the attachment or clear the password gate first'],
      whyThisSourceNow: 'Use this only when the source delivers evidence through secure mail rather than a normal export portal.',
      userCheckpointBrief: 'Complete the attachment/password checkpoint first, then upload the actual attachment.',
      sufficiencyRule: 'Password-gated secure mail HTML is not importable evidence. The attachment itself is required.',
      blockingIfMissing: false,
      fallbackTaskIds: [`task_${workspaceId}_payroll_detail_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.import.upload_documents',
    }),
    task({
      taskId: `task_${workspaceId}_resident_register_${filingYear}`,
      sourceCategory: 'government_record',
      collectionMode: 'export_ingestion',
      targetArtifactType: 'resident_register',
      acceptedArtifactShapes: ['official resident register PDF/print'],
      rejectedArtifactShapes: ['typed household summary without official document'],
      portalPathHints: ['Request only if household/address-linked deduction review actually needs it'],
      whyThisSourceNow: 'Resident register should be requested only as conditional proof, not as default first-wave evidence.',
      userCheckpointBrief: 'Upload the official resident register only if the deduction review explicitly asks for household/address proof.',
      sufficiencyRule: 'Only the official document is sufficient for address/household proof.',
      blockingIfMissing: false,
      fallbackTaskIds: [`task_${workspaceId}_conditional_supporting_docs_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.import.upload_documents',
    }),
    task({
      taskId: `task_${workspaceId}_health_insurance_${filingYear}`,
      sourceCategory: 'health_insurance',
      collectionMode: 'export_ingestion',
      targetArtifactType: 'health_insurance_payment_history',
      acceptedArtifactShapes: ['official health insurance payment history PDF/export'],
      rejectedArtifactShapes: ['payment screenshot without payer/period context'],
      portalPathHints: ['Collect only if deduction or reconciliation logic specifically needs health-insurance payment proof'],
      whyThisSourceNow: 'Health-insurance history is a targeted conditional source, not a first-wave default.',
      userCheckpointBrief: 'Export the official payment history only if MCP specifically asks for health-insurance proof.',
      sufficiencyRule: 'History should preserve payer, period, and amount context.',
      blockingIfMissing: false,
      fallbackTaskIds: [`task_${workspaceId}_conditional_supporting_docs_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.import.upload_documents',
    }),
    task({
      taskId: `task_${workspaceId}_telecom_${filingYear}`,
      sourceCategory: 'telecom',
      collectionMode: 'export_ingestion',
      targetArtifactType: 'telecom_payment_history',
      acceptedArtifactShapes: ['itemized telecom bill/payment history PDF'],
      rejectedArtifactShapes: ['simple payment confirmation without service/use detail'],
      portalPathHints: ['Collect only when business-use telecom review needs itemized history'],
      whyThisSourceNow: 'Telecom history is useful only for narrow business-use review, so keep it targeted.',
      userCheckpointBrief: 'Upload an itemized telecom statement only if business-use review explicitly needs it.',
      sufficiencyRule: 'Simple paid/unpaid summaries are insufficient; itemized statement context is needed.',
      blockingIfMissing: false,
      fallbackTaskIds: [`task_${workspaceId}_manual_income_facts_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.import.upload_documents',
    }),
    task({
      taskId: `task_${workspaceId}_rent_contract_${filingYear}`,
      sourceCategory: 'housing',
      collectionMode: 'export_ingestion',
      targetArtifactType: 'rent_contract',
      acceptedArtifactShapes: ['signed rent contract PDF/scan with parties and address visible'],
      rejectedArtifactShapes: ['chat summary of rent terms only'],
      portalPathHints: ['Collect only when rent-related deduction or business-use location review actually needs it'],
      whyThisSourceNow: 'Rent contract is conditional support, not a default first-wave request.',
      userCheckpointBrief: 'Provide the signed contract only if the rent deduction or business-use review requires it.',
      sufficiencyRule: 'The document must show parties, term, and address details.',
      blockingIfMissing: false,
      fallbackTaskIds: [`task_${workspaceId}_conditional_supporting_docs_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.import.upload_documents',
    }),
    task({
      taskId: `task_${workspaceId}_petty_receipts_${filingYear}`,
      sourceCategory: 'local_documents',
      collectionMode: 'export_ingestion',
      targetArtifactType: 'petty_receipts_bundle',
      acceptedArtifactShapes: ['curated petty receipts bundle with date/merchant/amount visible'],
      rejectedArtifactShapes: ['unsorted phone photo dump with no scope note'],
      portalPathHints: ['Use only after higher-authority sources and itemized statements are exhausted'],
      whyThisSourceNow: 'Petty receipts are a last-mile evidence bundle, not the first source to request.',
      userCheckpointBrief: 'Upload a curated, scoped receipt bundle rather than a raw dump of every image.',
      sufficiencyRule: 'Bundle should be curated and scoped to the claimed expense set.',
      blockingIfMissing: false,
      fallbackTaskIds: [`task_${workspaceId}_manual_income_facts_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.import.upload_documents',
    }),
    task({
      taskId: `task_${workspaceId}_payroll_detail_${filingYear}`,
      sourceCategory: 'payroll',
      collectionMode: 'export_ingestion',
      targetArtifactType: 'payroll_payment_detail',
      acceptedArtifactShapes: ['official payroll payment detail PDF/export'],
      rejectedArtifactShapes: ['salary transfer screenshot without payroll breakdown'],
      portalPathHints: ['Collect only when salary-side reconciliation needs more detail than the withholding record gives'],
      whyThisSourceNow: 'Payroll detail is a targeted reconciliation source, not a general first-wave request.',
      userCheckpointBrief: 'Provide payroll detail only if salary reconciliation is still under-specified.',
      sufficiencyRule: 'The detail should preserve pay period and pay item breakdowns.',
      blockingIfMissing: false,
      fallbackTaskIds: [`task_${workspaceId}_secure_mail_${filingYear}`],
      verifiedAt,
      nextRecommendedAction: 'tax.import.upload_documents',
    }),
    task({
      taskId: `task_${workspaceId}_conditional_supporting_docs_${filingYear}`,
      sourceCategory: 'conditional_supporting_documents',
      collectionMode: 'fact_capture',
      targetArtifactType: 'conditional_deduction_support',
      acceptedArtifactShapes: ['resident registration certificate when address/family deduction needs proof', 'official donation receipt PDF', 'official disability-related proof document'],
      rejectedArtifactShapes: ['generic photo of a paper without identifying fields', 'chat message claiming eligibility without supporting document'],
      portalPathHints: ['Collect only if a deduction fact or review item specifically asks for it'],
      whyThisSourceNow: 'Conditional supporting documents should be requested only when a concrete deduction fact remains unresolved.',
      userCheckpointBrief: 'Answer the targeted deduction question first; upload the exact official proof only if MCP asks for it.',
      sufficiencyRule: 'Only the exact official proof tied to the unresolved deduction fact should be requested.',
      blockingIfMissing: false,
      fallbackTaskIds: [],
      verifiedAt,
      nextRecommendedAction: 'tax.profile.upsert_facts',
    }),
    task({
      taskId: `task_${workspaceId}_manual_income_facts_${filingYear}`,
      sourceCategory: 'fact_capture',
      collectionMode: 'fact_capture',
      targetArtifactType: 'income_scope_confirmation',
      acceptedArtifactShapes: ['structured taxpayer fact response naming income streams and missing official exports'],
      rejectedArtifactShapes: ['vague statement like more files later', 'unstructured request to upload everything'],
      portalPathHints: ['Use only as fallback when official HomeTax materials are temporarily unavailable'],
      whyThisSourceNow: 'Fact capture is fallback only; it cannot replace authoritative withholding material for Tier A submission readiness.',
      userCheckpointBrief: 'Confirm which income streams exist and which official exports are still missing.',
      sufficiencyRule: 'This confirms scope only; it does not replace authoritative evidence.',
      blockingIfMissing: false,
      fallbackTaskIds: [],
      verifiedAt,
      nextRecommendedAction: 'tax.profile.upsert_facts',
    }),
  ];
}

export function taxSourcesPlanCollection(input: PlanCollectionInput): MCPResponseEnvelope<PlanCollectionData> {
  const prioritizedGap = enrichCoverageGap({
    gapId: `gap_plan_${input.workspaceId}_hometax`,
    workspaceId: input.workspaceId,
    gapType: 'missing_income_source',
    severity: 'high',
    description: 'HomeTax authoritative materials have not been collected yet.',
    affectedArea: 'income_inventory',
    affectedDomains: ['incomeInventory'],
    materiality: 'high',
    blocksEstimate: true,
    blocksDraft: true,
    blocksSubmission: true,
    recommendedNextSource: 'hometax',
    relatedSourceIds: [],
    state: 'open',
  });
  const collectionTasks = buildTierAFreelancerCollectionTasks(input.workspaceId, input.filingYear);
  const nextActionPlan: PlanCollectionData['nextActionPlan'] = {
    gapId: prioritizedGap.gapId,
    gapType: prioritizedGap.gapType,
    recommendedNextAction: collectionTasks[0]?.nextRecommendedAction ?? prioritizedGap.recommendedNextAction!,
    collectionMode: (prioritizedGap.collectionMode === 'direct_connector' ? 'browser_assist' : prioritizedGap.collectionMode!) as 'browser_assist' | 'export_ingestion' | 'fact_capture',
    whyThisIsNext: prioritizedGap.whyItBlocks!,
  };

  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'source_planned',
    actorType: 'agent',
    summary: 'Planned recommended collection sources for the workspace.',
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      recommendedSources: [
        {
          sourceType: 'hometax',
          priority: 'high',
          rationale: 'Highest-value authoritative filing source and best first checkpoint.',
          collectionMode: 'browser_assist',
          likelyCheckpoints: ['source_consent', 'authentication', 'collection_blocker'],
          fallbackOptions: ['Import HomeTax-exported files manually', 'Proceed with local evidence and draft a partial workspace'],
        },
        {
          sourceType: 'local_documents',
          priority: 'medium',
          rationale: 'Useful for receipts, statements, and evidence gaps after HomeTax collection.',
          collectionMode: 'export_ingestion',
          likelyCheckpoints: ['source_consent'],
          fallbackOptions: ['Upload a targeted set of files', 'Answer focused evidence questions'],
        },
      ],
      collectionTasks,
      expectedValueBySource: {
        hometax: 'High authority for filing materials and cross-checks',
        local_documents: 'High practical value for supporting evidence and missing exports',
      },
      likelyUserCheckpoints: ['source_consent', 'authentication', 'collection_blocker'],
      fallbackPathSuggestions: ['Use exported statements when live collection is blocked', 'Continue with partial collection and targeted follow-up'],
      prioritizedGap,
      nextActionPlan,
    },
    progress: {
      phase: 'source_planning',
      step: 'rank_next_sources',
      percent: 100,
    },
    nextRecommendedAction: 'tax.sources.connect',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_source_planned',
    },
  };
}

export function taxSourcesGetCollectionStatus(
  input: GetCollectionStatusInput,
  sources: SourceConnection[] = [],
  coverageGaps: CoverageGap[] = [],
): MCPResponseEnvelope<CollectionStatusData> {
  const { enriched, prioritizedGap, nextActionPlan } = buildGapNextActionPlan(coverageGaps);
  const filingYear = Number(input.workspaceId.match(/(20\d{2})/)?.[1] ?? new Date().getFullYear());
  const collectionTasks = buildTierAFreelancerCollectionTasks(input.workspaceId, filingYear);
  const connectedSources = sources.map((source) => ({
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    state: source.state ?? source.connectionStatus ?? 'planned',
  }));

  const pendingCheckpoints = sources
    .flatMap((source) => {
      const checkpointType = deriveCheckpointTypeFromSourceState(source.state ?? source.connectionStatus);
      return checkpointType === 'source_consent' || checkpointType === 'authentication' ? [checkpointType] : [];
    });

  const blockedAttempts = sources
    .filter((source) => (source.state ?? source.connectionStatus) === 'blocked')
    .map((source) => `${source.sourceType}:${source.lastBlockingReason ?? 'blocked'}`);

  return {
    ok: true,
    status: 'completed',
    data: {
      connectedSources,
      pendingCheckpoints,
      coverageGaps: enriched,
      collectionTasks,
      blockedAttempts,
      prioritizedGap,
      nextActionPlan,
    },
    readinessState: buildCollectionReadinessState({
      pendingCheckpoints: pendingCheckpoints.length,
      blockedAttempts,
      coverageGaps,
    }),
    nextRecommendedAction: pendingCheckpoints.length > 0 ? 'tax.sources.resume_sync' : (nextActionPlan?.recommendedNextAction ?? 'tax.sources.plan_collection'),
  };
}

export function taxWorkspaceListCoverageGaps(
  input: ListCoverageGapsInput,
  coverageGaps: CoverageGap[] = [],
): MCPResponseEnvelope<ListCoverageGapsData> {
  const filtered = coverageGaps
    .map(enrichCoverageGap)
    .filter((gap) => !input.state || gap.state === input.state)
    .filter((gap) => !input.gapType || gap.gapType === input.gapType);
  const { prioritizedGap, nextActionPlan } = buildGapNextActionPlan(filtered);
  const filingYear = Number(input.workspaceId.match(/(20\d{2})/)?.[1] ?? new Date().getFullYear());
  const collectionTasks = buildTierAFreelancerCollectionTasks(input.workspaceId, filingYear);
  return {
    ok: true,
    status: 'completed',
    data: { workspaceId: input.workspaceId, items: filtered, collectionTasks, prioritizedGap, nextActionPlan },
    nextRecommendedAction: nextActionPlan?.recommendedNextAction,
  };
}

export function taxSourcesList(
  input: ListSourcesInput,
  sources: SourceConnection[] = [],
  syncAttempts: Array<{
    syncAttemptId: string;
    sourceId: string;
    state: string;
    endedAt?: string;
    blockingReason?: string;
  }> = [],
): MCPResponseEnvelope<ListSourcesData> {
  const visibleSources = sources.filter((source) => input.includeDisabled || source.metadata?.futureSyncBlocked !== true);
  const dataSources = visibleSources.map((source) => {
    const latestAttempt = syncAttempts
      .filter((attempt) => attempt.sourceId === source.sourceId)
      .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))[0];

    return {
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      sourceState: source.state ?? source.connectionStatus ?? 'planned',
      availability: source.metadata?.futureSyncBlocked === true ? 'disconnected' as const : 'available' as const,
      syncSummary: input.includeSyncSummary
        ? {
            lastSyncAttemptId: latestAttempt?.syncAttemptId,
            lastSyncAttemptState: latestAttempt?.state as NonNullable<ListSourcesData['sources'][number]['syncSummary']>['lastSyncAttemptState'],
            lastSyncAt: source.lastSyncAt,
            lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
            blockingReason: (latestAttempt?.blockingReason ?? source.lastBlockingReason) as NonNullable<ListSourcesData['sources'][number]['syncSummary']>['blockingReason'],
          }
        : undefined,
      nextRecommendedAction: source.metadata?.futureSyncBlocked === true
        ? 'tax.sources.connect'
        : ((source.state === 'awaiting_auth' || source.state === 'blocked') ? 'tax.sources.resume_sync' : 'tax.sources.sync'),
    };
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      sources: dataSources,
    },
    nextRecommendedAction: dataSources.some((source) => source.availability === 'disconnected') ? 'tax.sources.connect' : 'tax.sources.sync',
  };
}

export function taxSourcesDisconnect(
  input: DisconnectSourceInput,
  source: SourceConnection,
): MCPResponseEnvelope<DisconnectSourceData> {
  const disconnectedAt = new Date().toISOString();
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'source_connected',
    actorType: 'agent',
    entityRefs: [source.sourceId],
    summary: `Disconnected source ${source.sourceId} from future syncs.`,
    metadata: {
      reason: input.reason,
      recordsRetained: true,
    },
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      sourceId: source.sourceId,
      disconnected: true,
      sourceState: source.state ?? source.connectionStatus ?? 'completed',
      recordsRetained: true,
      warning: '기존 imported records는 유지됨. future sync/resume만 차단됩니다.',
      disconnectedAt,
    },
    warnings: [
      {
        code: 'records_retained',
        message: 'Existing artifacts, documents, transactions, withholding records, and audit history are retained.',
        severity: 'low',
      },
    ],
    progress: {
      phase: 'source_connection',
      step: 'disconnect_source',
      percent: 100,
    },
    nextRecommendedAction: 'tax.sources.list',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_source_disconnected',
    },
  };
}

export function taxImportUploadTransactions(input: UploadTransactionsInput): MCPResponseEnvelope<UploadTransactionsData> {
  const acceptedRefs = dedupeRefs(input.refs);
  const artifactIds = acceptedRefs.map((ref) => ref.artifactId ?? buildImportedArtifactId(input.workspaceId, ref.ref, 'transactions'));
  const ready = artifactIds.length > 0;
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'import_completed',
    actorType: 'agent',
    entityRefs: artifactIds,
    summary: `Registered ${artifactIds.length} transaction import artifact ref(s).`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      artifactIds,
      ingestionSummary: {
        acceptedRefCount: acceptedRefs.length,
        deduplicatedRefCount: input.refs.length - acceptedRefs.length,
        formatHints: input.formatHints ?? [],
        storedArtifactCount: artifactIds.length,
      },
      normalizeReadiness: ready ? 'ready' : 'needs_more_input',
    },
    blockingReason: ready ? undefined : 'insufficient_metadata',
    warnings: ready ? undefined : [{ code: 'no_refs', message: 'No import refs were provided for transaction ingestion.', severity: 'medium' }],
    progress: { phase: 'import_ingestion', step: 'register_transaction_refs', percent: 100 },
    nextRecommendedAction: ready ? 'tax.ledger.normalize' : 'tax.sources.plan_collection',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_import_transactions_registered',
    },
  };
}

export function taxImportUploadDocuments(input: UploadDocumentsInput): MCPResponseEnvelope<UploadDocumentsData> {
  const acceptedRefs = dedupeRefs(input.refs);
  const hinted = new Map((input.documentHints ?? []).map((hint) => [hint.ref, hint]));
  const documentIds = acceptedRefs.map((ref) => buildImportedDocumentId(input.workspaceId, ref.ref));
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'artifact_parsed',
    actorType: 'agent',
    entityRefs: documentIds,
    summary: `Registered ${documentIds.length} document ref(s) for later normalization.`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      documentIds,
      ingestionSummary: {
        acceptedRefCount: acceptedRefs.length,
        hintedDocumentCount: acceptedRefs.filter((ref) => hinted.has(ref.ref)).length,
        storedDocumentCount: documentIds.length,
      },
    },
    warnings: acceptedRefs.length === 0 ? [{ code: 'no_refs', message: 'No document refs were provided.', severity: 'medium' }] : undefined,
    blockingReason: acceptedRefs.length === 0 ? 'insufficient_metadata' : undefined,
    progress: { phase: 'import_ingestion', step: 'register_document_refs', percent: 100 },
    nextRecommendedAction: acceptedRefs.length > 0 ? 'tax.ledger.normalize' : 'tax.sources.plan_collection',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_import_documents_registered',
    },
  };
}

export function taxImportSubmitExtractedReceiptFields(input: SubmitExtractedReceiptFieldsInput): MCPResponseEnvelope<SubmitExtractedReceiptFieldsData> {
  const accepted = input.submissions.filter((submission) => Object.keys(submission.fields ?? {}).length > 0);
  const updatedDocumentIds = accepted.filter((submission) => submission.documentId).map((submission) => submission.documentId as string);
  const createdDocumentIds = accepted.filter((submission) => !submission.documentId).map((submission) => submission.documentId ?? buildImportedDocumentId(input.workspaceId, submission.documentRef ?? submission.artifactRef ?? 'receipt_fields'));
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'artifact_parsed',
    actorType: 'agent',
    entityRefs: [...updatedDocumentIds, ...createdDocumentIds],
    summary: `Registered extracted receipt fields for ${accepted.length} submission(s).`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      acceptedSubmissionCount: accepted.length,
      updatedDocumentIds,
      createdDocumentIds,
    },
    warnings: accepted.length === 0 ? [{ code: 'no_structured_fields', message: 'No structured receipt fields were provided.', severity: 'medium' }] : undefined,
    blockingReason: accepted.length === 0 ? 'insufficient_metadata' : undefined,
    progress: { phase: 'import_ingestion', step: 'store_extracted_receipt_fields', percent: 100 },
    nextRecommendedAction: accepted.length > 0 ? 'tax.ledger.normalize' : 'tax.sources.plan_collection',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_receipt_fields_registered',
    },
  };
}

export function taxImportHomeTaxMaterials(input: ImportHomeTaxMaterialsInput): MCPResponseEnvelope<ImportHomeTaxMaterialsData> {
  const acceptedRefs = dedupeRefs(input.refs);
  const metadataByRef = new Map((input.materialMetadata ?? []).map((entry) => [entry.ref, entry]));
  const recognizedMaterials = acceptedRefs.map((ref) => {
    const artifactId = ref.artifactId ?? buildImportedArtifactId(input.workspaceId, ref.ref, 'hometax');
    const recognizedType = recognizeHomeTaxMaterialType(ref.ref, metadataByRef.get(ref.ref)?.materialTypeHint);
    const supported = recognizedType !== 'unknown';
    return { ref: ref.ref, artifactId, recognizedType, supported };
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'import_completed',
    actorType: 'agent',
    entityRefs: recognizedMaterials.map((item) => item.artifactId),
    summary: `Registered ${recognizedMaterials.length} HomeTax material ref(s).`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      artifactIds: recognizedMaterials.map((item) => item.artifactId),
      recognizedMaterials,
    },
    warnings: recognizedMaterials.filter((item) => !item.supported).map((item) => ({
      code: 'unsupported_hometax_material',
      message: `Unsupported HomeTax material for ref ${item.ref}.`,
      severity: 'medium' as const,
    })),
    blockingReason: recognizedMaterials.length === 0 ? 'insufficient_metadata' : undefined,
    progress: { phase: 'import_ingestion', step: 'register_hometax_material_refs', percent: 100 },
    nextRecommendedAction: recognizedMaterials.some((item) => item.supported) ? 'tax.ledger.normalize' : 'tax.sources.plan_collection',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_hometax_materials_registered',
    },
  };
}

export function taxSourcesConnect(
  input: ConnectSourceInput,
  consentRecords: ConsentRecord[],
): MCPResponseEnvelope<ConnectSourceData> {
  const requirement: ConsentRequirement = {
    consentType: 'source_access',
    sourceType: input.sourceType,
    requiredActions: input.requestedScope,
  };

  const evaluation = evaluateConsent(consentRecords, requirement);
  if (!evaluation.allowed) {
    return {
      ok: false,
      status: 'awaiting_consent',
      data: {
        sourceId: `pending_${input.sourceType}`,
        sourceState: 'awaiting_consent',
        consentRequired: true,
        authRequired: false,
        checkpointType: 'source_consent',
        nextStep: buildConsentPrompt(requirement),
        checkpointId: `checkpoint_consent_${input.sourceType}_${input.workspaceId}`,
        fallbackOptions: ['Narrow the requested scope', 'Use manual upload/export ingestion instead'],
      },
      readinessState: buildCollectionReadinessState({
        pendingCheckpoints: 1,
        sourceState: 'awaiting_consent',
        blockingReason: 'missing_consent',
      }),
      requiresConsent: true,
      checkpointType: 'source_consent',
      blockingReason: 'missing_consent',
      checkpointId: `checkpoint_consent_${input.sourceType}_${input.workspaceId}`,
      pendingUserAction: buildConsentPrompt(requirement),
      fallbackOptions: ['Narrow the requested scope', 'Use manual upload/export ingestion instead'],
      warnings: [
        {
          code: evaluation.reason ?? 'missing_consent',
          message: buildConsentPrompt(requirement),
          severity: 'high',
        },
      ],
    };
  }

  const baseSource = createSourceConnection({
    workspaceId: input.workspaceId,
    sourceType: input.sourceType as SourceConnection['sourceType'],
    collectionMode: input.sourceType === 'hometax' ? 'browser_assist' : 'export_ingestion',
    requestedScope: input.requestedScope,
  });

  const authRequired = input.sourceType === 'hometax';
  const nextSource = transitionSourceState(baseSource, authRequired ? 'awaiting_auth' : 'ready');
  const sourceCheckpointType = deriveCheckpointTypeFromSourceState(nextSource.state);
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'source_connected',
    actorType: 'agent',
    entityRefs: [nextSource.sourceId],
    summary: `Source ${input.sourceType} moved to ${nextSource.state}.`,
  });

  return {
    ok: true,
    status: authRequired ? 'awaiting_auth' : 'completed',
    data: {
      sourceId: nextSource.sourceId,
      sourceState: authRequired ? 'awaiting_auth' : 'ready',
      consentRequired: false,
      authRequired,
      checkpointType: sourceCheckpointType,
      nextStep: authRequired ? 'Proceed to authentication checkpoint' : 'Ready to sync',
      checkpointId: authRequired ? `checkpoint_auth_${input.sourceType}_${input.workspaceId}` : undefined,
      fallbackOptions: authRequired ? ['Import exported files instead', 'Collect local evidence first and return later'] : [],
    },
    readinessState: buildCollectionReadinessState({
      pendingCheckpoints: authRequired ? 1 : 0,
      sourceState: authRequired ? 'awaiting_auth' : 'ready',
      blockingReason: authRequired ? 'missing_auth' : undefined,
    }),
    requiresAuth: authRequired,
    checkpointType: sourceCheckpointType,
    checkpointId: authRequired ? `checkpoint_auth_${input.sourceType}_${input.workspaceId}` : undefined,
    pendingUserAction: authRequired
      ? derivePendingUserAction({ checkpointType: sourceCheckpointType, sourceType: input.sourceType })
      : undefined,
    fallbackOptions: authRequired ? ['Import exported files instead', 'Collect local evidence first and return later'] : [],
    progress: {
      phase: 'source_connection',
      step: authRequired ? 'await_authentication' : 'source_connected',
      percent: authRequired ? 50 : 100,
    },
    nextRecommendedAction: authRequired ? 'tax.sources.resume_sync' : 'tax.sources.sync',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_source_connected',
    },
  };
}

export function taxSourcesSync(input: SyncSourceInput): MCPResponseEnvelope<SyncSourceData> {
  const authCheckpointId = `checkpoint_auth_${input.sourceId}`;
  const initialAttempt = {
    syncAttemptId: `sync_${input.sourceId}_${input.syncMode}`,
    workspaceId: extractWorkspaceIdFromSourceId(input.sourceId),
    sourceId: input.sourceId,
    mode: input.syncMode,
    state: 'awaiting_user_action' as const,
    startedAt: new Date().toISOString(),
    checkpointId: authCheckpointId,
  };
  const blockedAttempt = blockSyncAttempt({
    attempt: initialAttempt,
    blockingReason: 'export_required',
    checkpointType: 'collection_blocker',
    checkpointId: authCheckpointId,
    pendingUserAction: derivePendingUserAction({ blockingReason: 'export_required', checkpointType: 'collection_blocker' }),
    fallbackOptions: ['Resume after login/export confirmation', 'Switch to export-ingestion flow'],
  });
  const audit = createAuditEvent({
    workspaceId: blockedAttempt.workspaceId,
    eventType: 'sync_blocked',
    actorType: 'agent',
    entityRefs: [blockedAttempt.syncAttemptId, blockedAttempt.sourceId],
    summary: 'Sync is waiting for user action before continuing.',
    metadata: {
      blockingReason: blockedAttempt.blockingReason,
      fallbackOptions: blockedAttempt.fallbackOptions,
    },
  });

  return {
    ok: false,
    status: 'awaiting_user_action',
    data: {
      sourceState: 'syncing',
      syncAttemptState: 'blocked',
      importedArtifactCount: 0,
      changedItemCount: 0,
      progressState: {
        phase: 'source_sync',
        step: 'await_export_or_auth_completion',
        percent: 25,
      },
      checkpointId: blockedAttempt.checkpointId,
      fallbackOptions: blockedAttempt.fallbackOptions,
    },
    readinessState: buildCollectionReadinessState({
      pendingCheckpoints: 1,
      blockedAttempts: [blockedAttempt.syncAttemptId],
      sourceState: 'blocked',
      blockingReason: blockedAttempt.blockingReason,
    }),
    checkpointType: blockedAttempt.checkpointType,
    blockingReason: blockedAttempt.blockingReason,
    checkpointId: blockedAttempt.checkpointId,
    pendingUserAction: blockedAttempt.pendingUserAction,
    resumeToken: `resume_${input.sourceId}_${input.syncMode}`,
    fallbackOptions: blockedAttempt.fallbackOptions,
    progress: {
      phase: 'source_sync',
      step: 'await_export_or_auth_completion',
      percent: 25,
    },
    nextRecommendedAction: 'tax.sources.resume_sync',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_sync_blocked',
    },
  };
}

export function taxSourcesResumeSync(input: ResumeSyncInput): MCPResponseEnvelope<ResumeSyncData> {
  const sourceId = input.sourceId;
  const workspaceId = extractWorkspaceIdFromSourceId(sourceId);
  const syncSessionId = input.syncSessionId ?? `sync_${sourceId ?? 'unknown'}`;
  const completedAttempt = completeSyncAttempt({
    attempt: {
      syncAttemptId: syncSessionId,
      workspaceId,
      sourceId: sourceId ?? 'unknown_source',
      mode: 'full',
      state: 'running',
      startedAt: new Date().toISOString(),
      checkpointId: input.checkpointId,
    },
    attemptSummary: 'Imported 3 artifacts after resuming the sync flow.',
  });
  const audit = createAuditEvent({
    workspaceId,
    eventType: 'import_completed',
    actorType: 'agent',
    entityRefs: [completedAttempt.syncAttemptId, completedAttempt.sourceId],
    summary: completedAttempt.attemptSummary,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      resumed: true,
      sourceId,
      syncSessionId: completedAttempt.syncAttemptId,
      syncAttemptState: 'completed',
      importedArtifactCount: 3,
      nextCheckpointId: undefined,
    },
    readinessState: buildCollectionReadinessState({
      pendingCheckpoints: 0,
      sourceState: 'completed',
      resumed: true,
    }),
    progress: {
      phase: 'source_sync',
      step: 'resume_and_finalize',
      percent: 100,
    },
    nextRecommendedAction: 'tax.ledger.normalize',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_import_completed',
    },
  };
}

export function taxLedgerNormalize(
  input: NormalizeLedgerInput,
  state: {
    transactions?: LedgerTransaction[];
    evidenceDocuments?: EvidenceDocument[];
    withholdingRecords?: WithholdingRecord[];
    coverageGaps?: CoverageGap[];
  } = {},
): MCPResponseEnvelope<NormalizeLedgerData> {
  const now = new Date().toISOString();
  const scopedTransactions = (state.transactions ?? []).filter((tx) => tx.workspaceId === input.workspaceId);
  const scopedDocuments = (state.evidenceDocuments ?? []).filter((doc) => doc.workspaceId === input.workspaceId);
  const scopedWithholdingRecords = (state.withholdingRecords ?? []).filter((record) => record.workspaceId === input.workspaceId);
  const artifactIds = input.artifactIds ?? [];
  const payloads = (input.extractedPayloads ?? []).filter((payload) => artifactIds.length === 0 || (payload.artifactId && artifactIds.includes(payload.artifactId)));

  const normalizedArtifacts: SourceArtifact[] = [];
  const normalizedDocuments = [...scopedDocuments];
  const normalizedTransactions = [...scopedTransactions];
  const withholdingRecordsCreated: WithholdingRecord[] = [];
  const withholdingRecordsUpdated: WithholdingRecord[] = [];
  const coverageGapsCreated: CoverageGap[] = [];

  const documentRefMap = new Map<string, string>();
  const transactionRefMap = new Map<string, string>();

  for (const transaction of scopedTransactions) {
    if (transaction.artifactId && transaction.sourceReference) {
      transactionRefMap.set(`${transaction.artifactId}:${transaction.sourceReference}`, transaction.transactionId);
    }
  }
  for (const document of scopedDocuments) {
    documentRefMap.set(document.documentId, document.documentId);
    if (document.artifactId) {
      documentRefMap.set(`${document.artifactId}:${document.fileRef}`, document.documentId);
    }
  }

  for (const payload of payloads) {
    const artifactId = payload.artifactId ?? `artifact_${slugify(payload.sourceId ?? 'import')}_${normalizedArtifacts.length + 1}`;
    normalizedArtifacts.push({
      artifactId,
      workspaceId: input.workspaceId,
      sourceId: payload.sourceId ?? `source_import_${slugify(payload.sourceType ?? 'manual')}`,
      artifactType: payload.sourceArtifact?.artifactType ?? 'json',
      acquiredAt: now,
      ingestedAt: now,
      parseStatus: 'parsed',
      parseState: 'parsed',
      parseSummary: {
        transactionCount: payload.transactions?.length ?? 0,
        documentCount: payload.documents?.length ?? 0,
        withholdingRecordCount: payload.withholdingRecords?.length ?? 0,
      },
      contentRef: payload.sourceArtifact?.contentRef,
      storageRef: payload.sourceArtifact?.storageRef,
      checksum: payload.sourceArtifact?.checksum,
      contentHash: payload.sourceArtifact?.contentHash,
      provenance: {
        normalizationMode: input.normalizationMode ?? 'default',
        ...payload.provenance,
        sourceArtifact: payload.sourceArtifact?.provenance,
      },
    });

    for (const [transactionIndex, transaction] of (payload.transactions ?? []).entries()) {
      const reservedTransactionId = transaction.externalId
        ? `tx_${slugify(transaction.externalId)}`
        : `tx_${slugify(artifactId)}_${normalizedTransactions.length + transactionIndex + 1}`;
      if (transaction.externalId) transactionRefMap.set(`${artifactId}:${transaction.externalId}`, reservedTransactionId);
      if (transaction.sourceReference) transactionRefMap.set(`${artifactId}:${transaction.sourceReference}`, reservedTransactionId);
    }

    for (const document of payload.documents ?? []) {
      const documentId = document.externalId
        ? `doc_${slugify(document.externalId)}`
        : `doc_${slugify(artifactId)}_${normalizedDocuments.length + 1}`;
      const linkedTransactionIds = (document.linkedTransactionRefs ?? []).map((ref) => transactionRefMap.get(`${artifactId}:${ref}`) ?? transactionRefMap.get(ref) ?? ref);
      const normalizedDocument: EvidenceDocument = {
        documentId,
        workspaceId: input.workspaceId,
        sourceId: payload.sourceId ?? `source_import_${slugify(payload.sourceType ?? 'manual')}`,
        artifactId,
        documentType: document.documentType ?? inferDocumentTypeFromFields(document.extractedFields),
        issuedAt: document.issuedAt,
        issuer: document.issuer,
        amount: document.amount,
        currency: document.currency ?? 'KRW',
        fileRef: document.fileRef,
        extractionStatus: document.extractionStatus ?? 'extracted',
        extractedFields: {
          ...document.extractedFields,
          normalizationProvenance: {
            artifactId,
            sourceId: payload.sourceId,
            providedBy: 'external_agent',
            payloadProvenance: payload.provenance,
            documentProvenance: document.provenance,
          },
        },
        linkedTransactionIds,
      };
      normalizedDocuments.push(normalizedDocument);
      documentRefMap.set(documentId, documentId);
      documentRefMap.set(`${artifactId}:${document.fileRef}`, documentId);
      if (document.externalId) documentRefMap.set(`${artifactId}:${document.externalId}`, documentId);
    }

    for (const transaction of payload.transactions ?? []) {
      const transactionId = transaction.externalId
        ? `tx_${slugify(transaction.externalId)}`
        : `tx_${slugify(artifactId)}_${normalizedTransactions.length + 1}`;
      const evidenceRefs = (transaction.evidenceDocumentRefs ?? []).map((ref) => documentRefMap.get(`${artifactId}:${ref}`) ?? documentRefMap.get(ref) ?? ref);
      const normalizedTransaction: LedgerTransaction = {
        transactionId,
        workspaceId: input.workspaceId,
        sourceId: payload.sourceId ?? `source_import_${slugify(payload.sourceType ?? 'manual')}`,
        artifactId,
        occurredAt: transaction.occurredAt,
        postedAt: transaction.postedAt,
        amount: transaction.amount,
        currency: transaction.currency ?? 'KRW',
        normalizedDirection: transaction.normalizedDirection ?? inferDirection(transaction.description, transaction.amount),
        counterparty: transaction.counterparty,
        description: transaction.description,
        rawCategory: transaction.rawCategory,
        sourceReference: transaction.sourceReference ?? transaction.externalId,
        evidenceRefs,
        duplicateGroupId: transaction.duplicateHint,
        reviewStatus: 'unreviewed',
        createdAt: now,
      };
      normalizedTransactions.push(normalizedTransaction);
      if (transaction.externalId) transactionRefMap.set(`${artifactId}:${transaction.externalId}`, transactionId);
      if (normalizedTransaction.sourceReference) transactionRefMap.set(`${artifactId}:${normalizedTransaction.sourceReference}`, transactionId);
    }

    for (const withholding of payload.withholdingRecords ?? []) {
      const withholdingRecord = buildNormalizedWithholdingRecord({
        workspaceId: input.workspaceId,
        artifactId,
        payload,
        withholding,
        transactions: normalizedTransactions,
        evidenceDocuments: normalizedDocuments,
        existingRecords: scopedWithholdingRecords,
        now,
      });
      const existingIndex = scopedWithholdingRecords.findIndex((record) => record.withholdingRecordId === withholdingRecord.withholdingRecordId);
      if (existingIndex >= 0) {
        scopedWithholdingRecords[existingIndex] = withholdingRecord;
        withholdingRecordsUpdated.push(withholdingRecord);
      } else {
        scopedWithholdingRecords.push(withholdingRecord);
        withholdingRecordsCreated.push(withholdingRecord);
      }
    }
  }

  const duplicateKeyToTransactions = new Map<string, LedgerTransaction[]>();
  for (const tx of normalizedTransactions) {
    const duplicateKey = tx.duplicateGroupId ?? deriveDuplicateGroupId(tx);
    if (!duplicateKey) continue;
    const list = duplicateKeyToTransactions.get(duplicateKey) ?? [];
    list.push(tx);
    duplicateKeyToTransactions.set(duplicateKey, list);
  }
  for (const group of duplicateKeyToTransactions.values()) {
    if (group.length < 2) continue;
    for (const tx of group) {
      tx.duplicateGroupId = deriveDuplicateGroupId(tx);
      tx.reviewStatus = tx.reviewStatus === 'reviewed' ? 'review_required' : tx.reviewStatus;
    }
  }

  const filteredTransactions = artifactIds.length > 0
    ? normalizedTransactions.filter((tx) => tx.artifactId !== undefined && artifactIds.includes(tx.artifactId))
    : normalizedTransactions;
  const filteredDocuments = artifactIds.length > 0
    ? normalizedDocuments.filter((doc) => doc.artifactId !== undefined && artifactIds.includes(doc.artifactId))
    : normalizedDocuments;
  const duplicateCandidateCount = filteredTransactions.filter((tx) => Boolean(tx.duplicateGroupId)).length;

  coverageGapsCreated.push(...buildNormalizationCoverageGaps({
    workspaceId: input.workspaceId,
    transactions: filteredTransactions,
    documents: filteredDocuments,
    withholdingRecords: scopedWithholdingRecords,
    existingGaps: state.coverageGaps ?? [],
    now,
  }));

  const normalizationWarnings = filteredTransactions.length === 0 && filteredDocuments.length === 0
    ? [{ code: 'no_artifacts_normalized', message: 'No imported artifacts or extracted payloads matched the normalization request.', severity: 'medium' as const }]
    : undefined;
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'import_completed',
    actorType: 'system',
    entityRefs: [...filteredTransactions.map((tx) => tx.transactionId), ...filteredDocuments.map((doc) => doc.documentId)],
    summary: `Normalized ${filteredTransactions.length} transaction(s), ${filteredDocuments.length} document(s), and ${withholdingRecordsCreated.length + withholdingRecordsUpdated.length} withholding record(s) into workflow state.`,
    metadata: {
      normalizationMode: input.normalizationMode ?? 'default',
      artifactIds: input.artifactIds,
      extractedPayloadCount: payloads.length,
      coverageGapCount: coverageGapsCreated.length,
    },
  });
  const nextRecommendedAction = filteredTransactions.length > 0 || withholdingRecordsCreated.length > 0 || withholdingRecordsUpdated.length > 0
    ? 'tax.classify.run'
    : 'tax.sources.plan_collection';

  return {
    ok: true,
    status: 'completed',
    data: {
      transactionCount: filteredTransactions.length,
      documentCount: filteredDocuments.length,
      duplicateCandidateCount,
      withholdingRecordsCreated,
      withholdingRecordsUpdated,
      coverageGapsCreated,
      normalizedArtifacts,
      normalizedDocuments: filteredDocuments,
      normalizedTransactions: filteredTransactions,
    },
    warnings: normalizationWarnings,
    progress: {
      phase: 'ledger_normalization',
      step: payloads.length > 0 ? 'materialize_extracted_payloads' : 'canonicalize_imported_artifacts',
      percent: 100,
    },
    nextRecommendedAction,
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_ledger_normalized',
    },
  };
}

function dedupeRefs<T extends { ref: string }>(refs: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const ref of refs) {
    if (seen.has(ref.ref)) continue;
    seen.add(ref.ref);
    result.push(ref);
  }
  return result;
}

function buildImportedArtifactId(workspaceId: string, ref: string, prefix: string): string {
  return `artifact_${slugify(prefix)}_${slugify(workspaceId)}_${slugify(ref)}`;
}

function buildImportedDocumentId(workspaceId: string, ref: string): string {
  return `doc_${slugify(workspaceId)}_${slugify(ref)}`;
}

function recognizeHomeTaxMaterialType(ref: string, hinted?: string): 'hometax_export' | 'tax_statement' | 'income_statement' | 'taxpayer_overview' | 'unknown' {
  const text = `${hinted ?? ''} ${ref}`.toLowerCase();
  if (text.includes('overview') || text.includes('summary')) return 'taxpayer_overview';
  if (text.includes('income')) return 'income_statement';
  if (text.includes('statement')) return 'tax_statement';
  if (text.includes('hometax') || text.includes('export') || text.includes('지급명세') || text.includes('원천징수')) return 'hometax_export';
  return 'unknown';
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
}

function inferDocumentTypeFromFields(fields: Record<string, unknown> | undefined): EvidenceDocument['documentType'] {
  const text = JSON.stringify(fields ?? {}).toLowerCase();
  if (text.includes('withholding')) return 'withholding_doc';
  if (text.includes('invoice')) return 'invoice';
  if (text.includes('receipt')) return 'receipt';
  return 'other';
}

function inferDirection(description: string | undefined, amount: number): LedgerTransaction['normalizedDirection'] {
  const text = (description ?? '').toLowerCase();
  if (/income|payment|consulting|invoice|service/.test(text)) return 'income';
  if (/expense|purchase|receipt|supplies|laptop|equipment/.test(text)) return 'expense';
  return amount >= 0 ? 'expense' : 'income';
}

function deriveDuplicateGroupId(transaction: { occurredAt: string; amount: number; counterparty?: string; currency?: string; description?: string }): string | undefined {
  return `dup_${slugify(transaction.occurredAt.slice(0, 10))}_${Math.abs(transaction.amount)}_${slugify(transaction.currency ?? 'KRW')}_${slugify(transaction.counterparty ?? 'unknown')}_${slugify((transaction.description ?? '').slice(0, 24) || 'no_desc')}`;
}

function buildNormalizedWithholdingRecord(input: {
  workspaceId: string;
  artifactId: string;
  payload: NonNullable<NormalizeLedgerInput['extractedPayloads']>[number];
  withholding: NonNullable<NonNullable<NormalizeLedgerInput['extractedPayloads']>[number]['withholdingRecords']>[number];
  transactions: LedgerTransaction[];
  evidenceDocuments: EvidenceDocument[];
  existingRecords: WithholdingRecord[];
  now: string;
}): WithholdingRecord {
  const payerName = input.withholding.payerName ?? input.payload.sourceId ?? 'unknown_payer';
  const evidenceRefs = (input.withholding.evidenceDocumentRefs ?? []).map((ref) => input.evidenceDocuments.find((doc) => doc.documentId === ref || `${input.artifactId}:${doc.fileRef}` === `${input.artifactId}:${ref}`)?.documentId ?? ref);
  const matchingIncome = input.transactions.find((tx) => tx.transactionId === input.withholding.incomeSourceRef || (tx.counterparty && tx.counterparty === payerName && tx.normalizedDirection === 'income'));
  const recordId = input.withholding.externalId
    ? `withholding_${slugify(input.withholding.externalId)}`
    : matchingIncome
      ? `withholding_${matchingIncome.transactionId}`
      : `withholding_${slugify(input.artifactId)}_${slugify(payerName)}`;
  const existing = input.existingRecords.find((record) => record.withholdingRecordId === recordId);
  const conflictingExisting = input.existingRecords.find((record) => record.withholdingRecordId !== recordId
    && ((record.incomeSourceRef && record.incomeSourceRef === (input.withholding.incomeSourceRef ?? matchingIncome?.transactionId))
      || (record.payerName === payerName && record.filingYear === (input.withholding.filingYear ?? Number((matchingIncome?.occurredAt ?? input.now).slice(0, 4)))))
    && (record.grossAmount !== (input.withholding.grossAmount ?? matchingIncome?.amount)
      || record.withheldTaxAmount !== input.withholding.withheldTaxAmount
      || record.localTaxAmount !== input.withholding.localTaxAmount));
  return {
    withholdingRecordId: recordId,
    workspaceId: input.workspaceId,
    filingYear: input.withholding.filingYear ?? Number((matchingIncome?.occurredAt ?? input.now).slice(0, 4)),
    payerOrIssuer: payerName,
    incomeSourceRef: input.withholding.incomeSourceRef ?? matchingIncome?.transactionId,
    payerName,
    grossAmount: input.withholding.grossAmount ?? matchingIncome?.amount,
    withheldTaxAmount: input.withholding.withheldTaxAmount,
    localTaxAmount: input.withholding.localTaxAmount,
    currency: input.withholding.currency ?? matchingIncome?.currency ?? 'KRW',
    evidenceRefs,
    sourceType: input.withholding.sourceType ?? input.payload.sourceType ?? 'manual',
    provenance: {
      capturedVia: input.payload.sourceType === 'hometax' ? 'hometax_material' : 'extracted_field',
      sourceRef: input.artifactId,
      observedAt: input.now,
    },
    sourceOfTruth: 'imported',
    confidenceScore: input.withholding.extractionConfidence ?? 0.85,
    extractionConfidence: input.withholding.extractionConfidence ?? 0.85,
    reviewStatus: existing?.reviewStatus ?? (conflictingExisting ? 'conflict_detected' : (!matchingIncome || evidenceRefs.length === 0 ? 'review_required' : 'reviewed')),
    capturedAt: input.now,
  };
}

function buildNormalizationCoverageGaps(input: {
  workspaceId: string;
  transactions: LedgerTransaction[];
  documents: EvidenceDocument[];
  withholdingRecords: WithholdingRecord[];
  existingGaps: CoverageGap[];
  now: string;
}): CoverageGap[] {
  const existingKeys = new Set(input.existingGaps.map((gap) => `${gap.gapType}:${gap.affectedArea}:${gap.description}`));
  const gaps: CoverageGap[] = [];
  for (const tx of input.transactions.filter((item) => item.normalizedDirection === 'expense' && item.evidenceRefs.length === 0)) {
    const description = `Expense transaction ${tx.transactionId} is missing supporting evidence.`;
    const key = `missing_expense_evidence:expense_evidence:${description}`;
    if (!existingKeys.has(key)) {
      gaps.push({
        gapId: `gap_${tx.transactionId}_missing_evidence`, workspaceId: input.workspaceId, gapType: 'missing_expense_evidence', severity: 'medium', description,
        affectedArea: 'expense_evidence', affectedDomains: ['expenseEvidence'], materiality: 'medium', blocksEstimate: false, blocksDraft: true, blocksSubmission: true,
        recommendedNextSource: 'receipt_upload', recommendedNextAction: 'tax.sources.plan_collection', relatedSourceIds: [tx.sourceId], sourceRefs: [tx.transactionId], state: 'open', createdAt: input.now, updatedAt: input.now,
      });
    }
  }
  for (const record of input.withholdingRecords.filter((item) => !item.incomeSourceRef || item.reviewStatus === 'conflict_detected' || item.evidenceRefs.length === 0)) {
    const description = !record.incomeSourceRef
      ? `Withholding record ${record.withholdingRecordId} is missing a matched income transaction.`
      : record.evidenceRefs.length === 0
        ? `Withholding record ${record.withholdingRecordId} is missing linked evidence.`
        : `Withholding record ${record.withholdingRecordId} has conflicting imported details.`;
    const key = `withholding_gap:income_inventory:${description}`;
    if (!existingKeys.has(key)) {
      gaps.push({
        gapId: `gap_${record.withholdingRecordId}_withholding`, workspaceId: input.workspaceId, gapType: !record.incomeSourceRef ? 'missing_income_source' : 'missing_withholding_record', severity: 'high', description,
        affectedArea: 'income_inventory', affectedDomains: ['incomeInventory', 'withholdingPrepaidTax'], materiality: 'high', blocksEstimate: true, blocksDraft: true, blocksSubmission: true,
        recommendedNextSource: 'hometax', recommendedNextAction: 'tax.withholding.list_records', relatedSourceIds: [], sourceRefs: record.evidenceRefs, state: 'open', createdAt: input.now, updatedAt: input.now,
      });
    }
  }
  if ((input.transactions.some((tx) => tx.normalizedDirection === 'income') || input.withholdingRecords.length > 0) && !input.existingGaps.some((gap) => gap.gapType === 'missing_hometax_comparison')) {
    gaps.push({
      gapId: `gap_${input.workspaceId}_missing_hometax_comparison_normalize`, workspaceId: input.workspaceId, gapType: 'missing_hometax_comparison', severity: 'medium',
      description: 'Normalized income and withholding state exists but HomeTax comparison has not been recorded yet.', affectedArea: 'submission_comparison', affectedDomains: ['submissionComparison'], materiality: 'medium',
      blocksEstimate: false, blocksDraft: false, blocksSubmission: true, recommendedNextSource: 'hometax', recommendedNextAction: 'tax.filing.compare_with_hometax', relatedSourceIds: [], sourceRefs: input.documents.map((doc) => doc.documentId), state: 'open', createdAt: input.now, updatedAt: input.now,
    });
  }
  return gaps;
}

export function taxFilingListAdjustmentCandidates(
  input: ListAdjustmentCandidatesInput,
  taxpayerFacts: TaxpayerFact[] = [],
  transactions: LedgerTransaction[] = [],
  withholdingRecords: WithholdingRecord[] = [],
): MCPResponseEnvelope<ListAdjustmentCandidatesData> {
  const facts = taxpayerFacts.filter((fact) => fact.workspaceId === input.workspaceId);
  const scopedTransactions = transactions.filter((tx) => tx.workspaceId === input.workspaceId);
  const scopedWithholding = withholdingRecords.filter((record) => record.workspaceId === input.workspaceId);
  const providedFactKeys = new Set(facts.filter((fact) => fact.status !== 'missing').map((fact) => fact.factKey));
  const items = ADJUSTMENT_CANDIDATE_RULES
    .map((rule, index) => {
      const derived = rule.derive({ facts, transactions: scopedTransactions, withholdingRecords: scopedWithholding });
      return {
        adjustmentId: `adj_${input.workspaceId}_${index + 1}_${rule.adjustmentType}`,
        workspaceId: input.workspaceId,
        adjustmentType: rule.adjustmentType,
        eligibilityState: derived.eligibilityState,
        requiredFactKeys: rule.requiredFactKeys,
        providedFactKeys: rule.requiredFactKeys.filter((key) => providedFactKeys.has(key)),
        requiredEvidenceRefs: derived.eligibilityState === 'supported' && rule.adjustmentType === 'withholding_tax_credit'
          ? scopedWithholding.flatMap((record) => record.evidenceRefs)
          : [],
        amountCandidate: derived.amountCandidate,
        confidenceScore: derived.confidenceScore,
        reviewRequired: derived.reviewRequired,
        supportTier: rule.supportTier,
        rationale: derived.rationale,
      } satisfies FilingAdjustmentCandidate;
    })
    .filter((item) => input.eligibilityState === undefined || item.eligibilityState === input.eligibilityState)
    .filter((item) => input.reviewRequired === undefined || item.reviewRequired === input.reviewRequired);

  const { taxpayerPosture, operatorWarnings: postureWarnings } = deriveTaxProfileSignals(facts, scopedTransactions);
  const businessExpenseAllocationCandidates = buildAllocationCandidates(input.workspaceId, facts, scopedTransactions);
  const opportunityCandidates = buildOpportunityCandidates(taxpayerPosture, facts);
  if (taxpayerPosture === 'pure_business') {
    for (const item of items) {
      if (item.adjustmentType !== 'withholding_tax_credit' && /credit|insurance|card|cash/i.test(item.adjustmentType)) {
        item.eligibilityState = 'manual_only';
        item.reviewRequired = true;
        item.rationale = `${item.rationale} Auto-application is blocked for pure business posture.`;
      }
    }
  }
  const warnings = items.some((item) => item.eligibilityState === 'out_of_scope')
    ? ['unsupported_adjustment_candidates_present']
    : items.some((item) => item.reviewRequired)
      ? ['adjustment_review_required']
      : [];

  return {
    ok: true,
    status: 'completed',
    data: { workspaceId: input.workspaceId, items, warnings, businessExpenseAllocationCandidates, opportunityCandidates, operatorWarnings: postureWarnings },
    nextRecommendedAction: warnings.length > 0 ? 'tax.classify.list_review_items' : 'tax.filing.compute_draft',
  };
}

export function taxProfileUpsertFacts(input: UpsertTaxpayerFactsInput, existingFacts: TaxpayerFact[] = []): MCPResponseEnvelope<UpsertTaxpayerFactsData> {
  const existingMap = new Map(existingFacts.filter((fact) => fact.workspaceId === input.workspaceId).map((fact) => [fact.factKey, fact] as const));
  const updatedFacts = input.facts.map((fact) => ({
    ...existingMap.get(fact.factKey),
    factId: existingMap.get(fact.factKey)?.factId ?? `fact_${input.workspaceId}_${fact.factKey}`,
    workspaceId: input.workspaceId,
    category: fact.category,
    factKey: fact.factKey,
    value: fact.value,
    status: fact.status,
    sourceOfTruth: fact.sourceOfTruth,
    confidence: fact.confidence,
    evidenceRefs: fact.evidenceRefs,
    note: fact.note,
    provenance: fact.provenance,
    updatedAt: new Date().toISOString(),
  }));
  const merged = new Map(existingMap);
  for (const fact of updatedFacts) merged.set(fact.factKey, fact);
  return {
    ok: true,
    status: 'completed',
    data: {
      updatedFacts,
      missingFactSummary: computeMissingFactCompleteness(Array.from(merged.values())),
    },
    nextRecommendedAction: 'tax.profile.detect_filing_path',
  };
}

export function taxListMissingFacts(workspaceId: string, facts: TaxpayerFact[] = []): MCPResponseEnvelope<ListMissingFactsData> {
  const scopedFacts = facts.filter((fact) => fact.workspaceId === workspaceId);
  const bookkeepingMode = String(getFactValue(scopedFacts, 'bookkeeping_mode') ?? '').toLowerCase();
  const operatorWarnings = (bookkeepingMode.includes('double') || bookkeepingMode.includes('복식')) && !getFactValue(scopedFacts, 'business_use_explanations')
    ? [{ code: 'mixed_use_allocation_basis_missing', message: 'Double-entry/business-heavy posture needs allocation basis for mixed-use expense claims.' }]
    : [];
  return {
    ok: true,
    status: 'completed',
    data: {
      items: computeMissingFactCompleteness(scopedFacts),
      operatorWarnings,
    },
  };
}

export function taxProfileDetectFilingPath(
  input: DetectFilingPathInput,
  transactions: LedgerTransaction[] = [],
  reviewItems: ReviewItem[] = [],
  coverageGaps: import('../../core/src/types.js').CoverageGap[] = [],
  taxpayerFacts: TaxpayerFact[] = [],
): MCPResponseEnvelope<DetectFilingPathData> {
  const scopedTransactions = transactions.filter((tx) => tx.workspaceId === input.workspaceId);
  const scopedReviewItems = reviewItems.filter((item) => item.workspaceId === input.workspaceId);
  const scopedFacts = taxpayerFacts.filter((fact) => fact.workspaceId === input.workspaceId);
  const detection = detectFilingPath({
    taxpayerFacts: scopedFacts,
    transactions: scopedTransactions,
    reviewItems: scopedReviewItems,
    coverageGaps,
  });
  const calibratedReadiness = deriveCalibratedReadiness({
    supportTier: detection.supportTier,
    filingPathKind: detection.filingPathKind,
    reviewItems: scopedReviewItems,
    coverageGaps,
  });
  const readiness = deriveReadinessSummary({
    supportTier: detection.supportTier,
    filingPathKind: detection.filingPathKind,
    reviewItems: scopedReviewItems,
    coverageGaps,
  });
  const { taxpayerPosture, bookkeepingMode, operatorWarnings } = deriveTaxProfileSignals(scopedFacts, scopedTransactions);
  const specialCreditEligibility = buildSpecialCreditEligibility(taxpayerPosture, scopedFacts);

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      supportTier: detection.supportTier,
      filingPathKind: detection.filingPathKind,
      confidence: detection.confidence,
      reasons: detection.reasons,
      missingFacts: detection.missingFacts,
      missingFactDetails: computeMissingFactCompleteness(scopedFacts, detection.missingFacts),
      escalationFlags: detection.escalationFlags,
      bookkeepingMode,
      taxpayerPosture,
      specialCreditEligibility,
      operatorWarnings,
    },
    readiness: readiness,
    readinessState: mapCalibratedReadinessState(calibratedReadiness),
    nextRecommendedAction: 'tax.filing.compute_draft',
  };
}

export function taxClassifyRun(
  input: RunClassificationInput,
  transactions: LedgerTransaction[],
): MCPResponseEnvelope<RunClassificationData> {
  const scopedTransactions = transactions.filter((tx) => tx.workspaceId === input.workspaceId);
  const classification = classifyTransactions({
    workspaceId: input.workspaceId,
    transactions: scopedTransactions,
  });
  const reviewQueue = buildReviewQueue({
    workspaceId: input.workspaceId,
    transactions: scopedTransactions,
    decisions: classification.decisions,
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'classification_run',
    actorType: 'system',
    entityRefs: scopedTransactions.map((tx) => tx.transactionId),
    summary: `Classified ${classification.decisions.length} transactions.`,
  });

  const trust = deriveTrustPolicySummary({
    supportTier: 'tier_a',
    lowConfidenceCount: classification.lowConfidenceCount,
    duplicateCandidateCount: scopedTransactions.filter((tx) => Boolean(tx.duplicateGroupId)).length,
    reviewItems: reviewQueue.items,
  });
  return {
    ok: true,
    status: 'completed',
    data: {
      classifiedCount: classification.decisions.length,
      lowConfidenceCount: classification.lowConfidenceCount,
      generatedReviewItemCount: reviewQueue.items.length,
      summaryByCategory: classification.summaryByCategory,
      confidenceScore: trust.confidenceScore,
      confidenceBand: trust.confidenceBand,
      duplicateRisk: trust.duplicateRisk,
      materiality: trust.materiality,
      stopReasonCodes: trust.stopReasonCodes,
      warningCodes: trust.warningCodes,
      escalationReason: trust.escalationReason,
      reviewBatchId: trust.reviewBatchId,
      decisions: classification.decisions,
      reviewItems: reviewQueue.items,
    },
    progress: {
      phase: 'classification',
      step: 'apply_rules',
      percent: 100,
    },
    nextRecommendedAction: reviewQueue.items.length > 0 ? 'tax.classify.list_review_items' : 'tax.filing.compute_draft',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_classification_run',
    },
  };
}

export function taxClassifyListReviewItems(workspaceId: string, items: ReviewItem[]): MCPResponseEnvelope<{ items: ReviewItem[]; summary: ReturnType<typeof summarizeReviewQueue> }> {
  const filteredItems = items.filter((item) => item.workspaceId === workspaceId);
  return {
    ok: true,
    status: 'completed',
    data: {
      items: filteredItems,
      summary: summarizeReviewQueue(filteredItems),
    },
  };
}

export function taxClassifyResolveReviewItem(
  input: ResolveReviewItemInput,
  items: ReviewItem[],
  existingDecisions: ClassificationDecision[] = [],
): MCPResponseEnvelope<{ resolvedCount: number; affectedDraftIds?: string[]; updatedItems: ReviewItem[]; generatedDecisionIds: string[]; generatedDecisions: ClassificationDecision[] }> {
  const resolution = resolveReviewItems({
    items,
    reviewItemIds: input.reviewItemIds,
    selectedOption: input.selectedOption,
    rationale: input.rationale,
    approverIdentity: input.approverIdentity,
    existingDecisions,
  });
  const workspaceId = resolution.updatedItems[0]?.workspaceId ?? 'unknown_workspace';
  const audit = createAuditEvent({
    workspaceId,
    eventType: 'review_resolved',
    actorType: 'user',
    actorRef: input.approverIdentity,
    entityRefs: input.reviewItemIds,
    summary: `Resolved ${resolution.resolvedItems.length} review items.`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      resolvedCount: resolution.resolvedItems.length,
      affectedDraftIds: [],
      updatedItems: resolution.updatedItems,
      generatedDecisionIds: resolution.generatedDecisions.map((decision) => decision.decisionId),
      generatedDecisions: resolution.generatedDecisions,
    },
    nextRecommendedAction: 'tax.filing.compute_draft',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_review_resolved',
    },
  };
}

export function taxFilingComputeDraft(
  input: ComputeDraftInput,
  transactions: LedgerTransaction[],
  decisions: ClassificationDecision[],
  reviewItems: ReviewItem[],
  taxpayerFacts: TaxpayerFact[] = [],
  withholdingRecords: WithholdingRecord[] = [],
  coverageGaps: CoverageGap[] = [],
  existingFieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
): MCPResponseEnvelope<ComputeDraftData> {
  const filingYear = input.workspaceId.match(/(20\d{2})/)?.[1];
  const scopedTransactions = transactions.filter((tx) => tx.workspaceId === input.workspaceId);
  const transactionIds = new Set(scopedTransactions.map((tx) => tx.transactionId));
  const scopedDecisions = decisions.filter((decision) => transactionIds.has(decision.entityId));
  const scopedReviewItems = reviewItems.filter((item) => item.workspaceId === input.workspaceId);
  const scopedTaxpayerFacts = taxpayerFacts.filter((fact) => fact.workspaceId === input.workspaceId);
  const scopedWithholdingRecords = withholdingRecords.filter((record) => record.workspaceId === input.workspaceId);
  const openCoverageGaps = coverageGaps.filter((gap) => gap.workspaceId === input.workspaceId && gap.state === 'open');

  const draft = computeDraftFromLedger({
    workspaceId: input.workspaceId,
    filingYear: filingYear ? Number(filingYear) : new Date().getFullYear(),
    draftVersion: input.draftMode === 'new_version' ? 2 : 1,
    transactions: scopedTransactions,
    decisions: scopedDecisions,
    reviewItems: scopedReviewItems,
    withholdingRecords: scopedWithholdingRecords,
    assumptions: input.includeAssumptions ? ['Computed from persisted runtime state.'] : [],
  });
  const filingPathDetection = detectFilingPath({
    taxpayerFacts: scopedTaxpayerFacts,
    transactions: scopedTransactions,
    withholdingRecords: scopedWithholdingRecords,
    reviewItems: scopedReviewItems,
    coverageGaps: openCoverageGaps,
  });
  const calibratedReadiness = deriveCalibratedReadiness({
    supportTier: filingPathDetection.supportTier,
    filingPathKind: filingPathDetection.filingPathKind,
    reviewItems: scopedReviewItems,
    coverageGaps: openCoverageGaps,
    draft: {
      draftId: draft.draftId,
      fieldValues: mergeComputedFieldValuesWithRuntimeState(draft.fieldValues, existingFieldValues),
    },
  });
  const readinessSummary = deriveReadinessSummary({
    supportTier: filingPathDetection.supportTier,
    filingPathKind: filingPathDetection.filingPathKind,
    reviewItems: scopedReviewItems,
    coverageGaps: openCoverageGaps,
    draft: {
      draftId: draft.draftId,
      fieldValues: mergeComputedFieldValuesWithRuntimeState(draft.fieldValues, existingFieldValues),
    },
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'draft_computed',
    actorType: 'system',
    entityRefs: [draft.draftId],
    summary: `Computed draft ${draft.draftId}.`,
  });

  draft.fieldValues = mergeComputedFieldValuesWithRuntimeState(draft.fieldValues, existingFieldValues);
  draft.blockerCodes = readinessSummary.blockerCodes;
  draft.estimateReadiness = readinessSummary.estimateReadiness;
  draft.draftReadiness = readinessSummary.draftReadiness;
  draft.submissionReadiness = readinessSummary.submissionReadiness;
  draft.comparisonSummaryState = readinessSummary.comparisonSummaryState;
  draft.freshnessState = readinessSummary.freshnessState;
  draft.majorUnknowns = readinessSummary.majorUnknowns;

  const factCompleteness = scopedTransactions.length === 0
    ? computeMissingFactCompleteness(scopedTaxpayerFacts)
    : scopedTaxpayerFacts.length === 0
      ? computeMissingFactCompleteness(scopedTaxpayerFacts)
      : computeMissingFactCompleteness(scopedTaxpayerFacts, filingPathDetection.missingFacts);
  const profileSignals = deriveTaxProfileSignals(scopedTaxpayerFacts, scopedTransactions);
  const adjustmentView = taxFilingListAdjustmentCandidates({ workspaceId: input.workspaceId }, scopedTaxpayerFacts, scopedTransactions, scopedWithholdingRecords).data;
  const adjustmentCandidates = adjustmentView.items;
  const adjustmentSummary = {
    considered: adjustmentCandidates.length,
    applied: adjustmentCandidates.filter((item) => item.eligibilityState === 'supported' && !item.reviewRequired).length,
    deferred: adjustmentCandidates.filter((item) => item.eligibilityState !== 'out_of_scope' && item.reviewRequired).length,
    unsupported: adjustmentCandidates.filter((item) => item.eligibilityState === 'out_of_scope').length,
  };
  const trust = deriveTrustPolicySummary({
    supportTier: filingPathDetection.supportTier,
    lowConfidenceCount: scopedDecisions.filter((decision) => (decision.confidence ?? 1) < 0.75).length,
    duplicateCandidateCount: scopedTransactions.filter((tx) => Boolean(tx.duplicateGroupId)).length,
    reviewItems: scopedReviewItems,
    coverageGaps: openCoverageGaps,
    adjustmentCandidates,
    withholdingRecords: scopedWithholdingRecords,
    fieldValues: draft.fieldValues,
  });
  const readinessBlockingReason = deriveComputeDraftBlockingReason(readinessSummary);
  const missingFactsBlockDraft = factCompleteness.some((item) => item.priority === 'high')
    && scopedTransactions.length === 0;
  const highAllocationMissing = (adjustmentView.businessExpenseAllocationCandidates ?? []).some((item) => item.reviewLevel === 'high' && item.allocationBasis === 'missing_allocation_basis');
  const computeBlockingReason = readinessBlockingReason === 'awaiting_review_decision'
    ? (trust.stopReasonCodes.length > 0 ? readinessBlockingReason : undefined)
    : missingFactsBlockDraft || highAllocationMissing
      ? 'insufficient_metadata'
      : readinessBlockingReason;

  return {
    ok: computeBlockingReason === undefined,
    status: computeBlockingReason === undefined ? 'completed' : 'blocked',
    data: {
      draftId: draft.draftId,
      draftVersion: draft.draftVersion,
      confidenceScore: trust.confidenceScore,
      confidenceBand: trust.confidenceBand,
      duplicateRisk: trust.duplicateRisk,
      materiality: trust.materiality,
      mismatchSeverity: trust.mismatchSeverity,
      stopReasonCodes: trust.stopReasonCodes,
      warningCodes: trust.warningCodes,
      escalationReason: trust.escalationReason,
      reviewBatchId: trust.reviewBatchId,
      unresolvedBlockerCount: readinessSummary.blockerCodes.length,
      warnings: draft.warnings,
      incomeSummary: draft.incomeSummary,
      expenseSummary: draft.expenseSummary,
      deductionsSummary: draft.deductionsSummary,
      withholdingSummary: draft.withholdingSummary,
      estimateConfidence: draft.estimateConfidence,
      blockerCodes: draft.blockerCodes,
      taxpayerFacts: scopedTaxpayerFacts,
      factCompleteness,
      withholdingRecords: scopedWithholdingRecords,
      adjustmentCandidates,
      adjustmentSummary,
      bookkeepingMode: profileSignals.bookkeepingMode,
      taxpayerPosture: profileSignals.taxpayerPosture,
      specialCreditEligibility: buildSpecialCreditEligibility(profileSignals.taxpayerPosture, scopedTaxpayerFacts),
      businessExpenseAllocationCandidates: adjustmentView.businessExpenseAllocationCandidates,
      opportunityCandidates: adjustmentView.opportunityCandidates,
      operatorWarnings: [...profileSignals.operatorWarnings, ...(adjustmentView.operatorWarnings ?? [])],
      fieldValues: draft.fieldValues,
      draftFieldValues: draft.fieldValues,
      filingSections: buildFilingSections(draft.draftId, draft.fieldValues),
      supportTier: readinessSummary.supportTier,
      filingPathKind: readinessSummary.filingPathKind,
      estimateReadiness: readinessSummary.estimateReadiness,
      draftReadiness: readinessSummary.draftReadiness,
      submissionReadiness: readinessSummary.submissionReadiness,
      comparisonSummaryState: readinessSummary.comparisonSummaryState,
      freshnessState: readinessSummary.freshnessState,
      majorUnknowns: readinessSummary.majorUnknowns,
    },
    readiness: readinessSummary,
    readinessState: mapCalibratedReadinessState(calibratedReadiness),
    checkpointType: computeBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined,
    blockingReason: computeBlockingReason,
    pendingUserAction: computeBlockingReason
      ? derivePendingUserAction({ blockingReason: computeBlockingReason, checkpointType: computeBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined })
      : undefined,
    nextRecommendedAction: computeBlockingReason === undefined
      ? 'tax.filing.compare_with_hometax'
      : computeBlockingReason === 'insufficient_metadata'
        ? 'tax.profile.list_missing_facts'
        : computeBlockingReason === 'comparison_incomplete'
          ? 'tax.filing.compare_with_hometax'
          : 'tax.classify.list_review_items',
    progress: {
      phase: 'drafting',
      step: 'compute_from_ledger',
      percent: 100,
    },
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_draft_computed',
    },
  };
}

export function taxFilingCompareWithHomeTax(
  input: CompareWithHomeTaxInput,
  fieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
): MCPResponseEnvelope<CompareWithHomeTaxData> {
  const comparison = compareWithHomeTax(
    {
      draftId: input.draftId,
      fieldValues,
      sectionKeys: input.sectionKeys,
      comparisonMode: input.comparisonMode,
    },
    input.portalObservedFields ?? buildObservedFields(fieldValues, input.sectionKeys),
  );

  const calibratedReadiness = deriveCalibratedReadiness({
    supportTier: 'tier_a',
    filingPathKind: 'mixed_income_limited',
    draft: {
      draftId: input.draftId,
      fieldValues: comparison.fieldValues,
    },
    comparisonSummaryState: comparison.comparisonSummaryState,
  });
  const readinessSummary = deriveReadinessSummary({
    supportTier: 'tier_a',
    filingPathKind: 'mixed_income_limited',
    draft: {
      draftId: input.draftId,
      fieldValues: comparison.fieldValues,
    },
    comparisonSummaryState: comparison.comparisonSummaryState,
  });
  const blockingReason = derivePrepareHomeTaxBlockingReason(readinessSummary);
  const trust = deriveTrustPolicySummary({
    supportTier: 'tier_a',
    comparisonMismatches: comparison.materialMismatches,
    fieldValues: comparison.fieldValues,
  });

  return {
    ok: blockingReason === undefined,
    status: blockingReason === undefined ? 'completed' : 'blocked',
    data: {
      draftId: input.draftId,
      confidenceScore: trust.confidenceScore,
      duplicateRisk: trust.duplicateRisk,
      materiality: trust.materiality,
      mismatchSeverity: trust.mismatchSeverity,
      stopReasonCodes: trust.stopReasonCodes,
      warningCodes: trust.warningCodes,
      escalationReason: trust.escalationReason,
      reviewBatchId: trust.reviewBatchId,
      sectionResults: comparison.sectionResults,
      materialMismatches: comparison.materialMismatches,
      fieldValues: comparison.fieldValues,
      draftFieldValues: comparison.fieldValues,
      filingSections: buildFilingSections(input.draftId, comparison.fieldValues),
    },
    readiness: readinessSummary,
    readinessState: mapCalibratedReadinessState(calibratedReadiness),
    blockingReason,
    checkpointType: blockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined,
    pendingUserAction: blockingReason
      ? derivePendingUserAction({ blockingReason, checkpointType: blockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined })
      : undefined,
    nextRecommendedAction: blockingReason === undefined ? 'tax.filing.prepare_hometax' : 'tax.classify.list_review_items',
  };
}

export function taxFilingRefreshOfficialData(
  input: RefreshOfficialDataInput,
  draft?: { draftId: string; fieldValues?: import('../../core/src/types.js').FilingFieldValue[] },
): MCPResponseEnvelope<RefreshOfficialDataData> {
  const refreshedFieldValues = (draft?.fieldValues ?? []).map((field) => ({
    ...field,
    freshnessState: 'current_enough' as const,
  }));
  const calibratedReadiness = deriveCalibratedReadiness({
    supportTier: 'tier_a',
    filingPathKind: 'mixed_income_limited',
    draft: draft
      ? {
          draftId: draft.draftId,
          fieldValues: refreshedFieldValues,
        }
      : undefined,
  });
  const readinessSummary = deriveReadinessSummary({
    supportTier: 'tier_a',
    filingPathKind: 'mixed_income_limited',
    draft: draft
      ? {
          draftId: draft.draftId,
          fieldValues: refreshedFieldValues,
        }
      : undefined,
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'import_completed',
    actorType: 'system',
    entityRefs: input.sourceIds ?? [],
    summary: `Refreshed official data for workspace ${input.workspaceId}.`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      refreshedSources: (input.sourceIds ?? ['src_hometax_main']).map((sourceId, index) => ({
        sourceId,
        syncAttemptId: `sync_refresh_${index + 1}_${input.workspaceId}`,
        changeSummary: {
          newArtifacts: 1,
          changedWithholdingRecords: 1,
          changedDraftFields: refreshedFieldValues.length,
        },
      })),
      recomputedDraftId: input.recomputeDraft ? draft?.draftId : undefined,
      supersededDraftId: input.recomputeDraft ? draft?.draftId : undefined,
      readinessDowngraded: false,
      downgradeReasons: [],
    },
    readiness: readinessSummary,
    readinessState: mapCalibratedReadinessState(calibratedReadiness),
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_source_refreshed',
    },
    nextRecommendedAction: 'tax.filing.compare_with_hometax',
  };
}

export function taxFilingPrepareHomeTax(
  input: PrepareHomeTaxInput,
  reviewItems: ReviewItem[],
  existingFieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
  readinessHints?: { supportTier?: import('../../core/src/types.js').FilingSupportTier; filingPathKind?: import('../../core/src/types.js').FilingPathKind },
): MCPResponseEnvelope<PrepareHomeTaxData> {
  const fieldValues = existingFieldValues;
  const readinessSummary = deriveReadinessSummary({
    supportTier: readinessHints?.supportTier ?? 'undetermined',
    filingPathKind: readinessHints?.filingPathKind ?? 'unknown',
    reviewItems,
    draft: {
      draftId: input.draftId,
      fieldValues,
    },
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'draft_computed',
    actorType: 'agent',
    entityRefs: [input.draftId],
    summary: `Prepared HomeTax mapping state for draft ${input.draftId}.`,
  });

  const preliminaryPrepareBlockingReason = derivePrepareHomeTaxBlockingReason(readinessSummary);

  const trust = deriveTrustPolicySummary({
    supportTier: readinessHints?.supportTier ?? 'undetermined',
    reviewItems,
    fieldValues,
    comparisonMismatches: fieldValues
      .filter((field) => (field.portalComparisonState ?? field.comparisonState) === 'mismatch')
      .map((field) => ({ severity: (field.mismatchSeverity ?? 'medium') as 'low' | 'medium' | 'high' | 'critical' })),
  });
  const prepareBlockingReason = preliminaryPrepareBlockingReason === 'awaiting_review_decision' && trust.stopReasonCodes.length === 0
    ? undefined
    : preliminaryPrepareBlockingReason;
  const derivedPreparation = deriveHomeTaxPreparationState(fieldValues, reviewItems, prepareBlockingReason);

  return {
    ok: prepareBlockingReason === undefined,
    status: prepareBlockingReason === undefined ? 'completed' : 'blocked',
    data: {
      confidenceScore: trust.confidenceScore,
      duplicateRisk: trust.duplicateRisk,
      materiality: trust.materiality,
      mismatchSeverity: trust.mismatchSeverity,
      stopReasonCodes: trust.stopReasonCodes,
      warningCodes: trust.warningCodes,
      escalationReason: trust.escalationReason,
      reviewBatchId: trust.reviewBatchId,
      sectionMapping: derivedPreparation.sectionMapping,
      orderedSections: derivedPreparation.orderedSections,
      filingSections: buildFilingSections(input.draftId, fieldValues),
      manualOnlyFields: derivedPreparation.manualOnlyFields,
      blockedFields: derivedPreparation.blockedFields,
      comparisonNeededFields: derivedPreparation.comparisonNeededFields,
      browserAssistReady: prepareBlockingReason === undefined,
      handoff: derivedPreparation.handoff,
      fieldValues,
      draftFieldValues: fieldValues,
    },
    readiness: readinessSummary,
    checkpointType: prepareBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined,
    blockingReason: prepareBlockingReason,
    pendingUserAction: prepareBlockingReason
      ? derivePendingUserAction({ blockingReason: prepareBlockingReason, checkpointType: prepareBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined })
      : undefined,
    nextRecommendedAction: prepareBlockingReason === undefined
      ? 'tax.browser.start_hometax_assist'
      : prepareBlockingReason === 'comparison_incomplete'
        ? 'tax.filing.compare_with_hometax'
        : prepareBlockingReason === 'official_data_refresh_required'
          ? 'tax.filing.refresh_official_data'
          : 'tax.classify.list_review_items',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_prepare_hometax',
    },
  };
}

export function taxBrowserStartHomeTaxAssist(input: StartHomeTaxAssistInput): MCPResponseEnvelope<StartHomeTaxAssistData> {
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'browser_assist_started',
    actorType: 'agent',
    entityRefs: [input.draftId],
    summary: `Started HomeTax assist for draft ${input.draftId}.`,
  });

  return {
    ok: true,
    status: 'awaiting_auth',
    data: {
      assistSessionId: `assist_${input.workspaceId}_${input.draftId}`,
      checkpointType: 'authentication',
      authRequired: true,
      handoff: undefined,
    },
    requiresAuth: true,
    checkpointType: 'authentication',
    checkpointId: `checkpoint_hometax_auth_${input.workspaceId}_${input.draftId}`,
    pendingUserAction: derivePendingUserAction({ checkpointType: 'authentication', sourceType: 'hometax' }),
    nextRecommendedAction: 'tax.browser.resume_hometax_assist',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_browser_assist_started',
    },
  };
}

export function demoBuildReviewQueue() {
  return buildReviewQueue({
    workspaceId: 'demo_workspace',
    transactions: [],
    decisions: [],
  });
}

function computeMissingFactCompleteness(facts: TaxpayerFact[], requiredFactKeys?: string[]): FilingFactCompleteness[] {
  const provided = new Map(facts.map((fact) => [fact.factKey, fact] as const));
  return FACT_CAPTURE_RULES
    .filter((rule) => (requiredFactKeys ? requiredFactKeys.includes(rule.factKey) || requiredFactKeys.includes(rule.factKey.replace(/s$/, '')) : true))
    .filter((rule) => {
      const existing = provided.get(rule.factKey);
      return !existing || existing.status === 'missing' || existing.status === 'review_required';
    })
    .map((rule) => {
      const existing = provided.get(rule.factKey);
      return {
        factKey: rule.factKey,
        priority: rule.priority,
        materiality: rule.materiality,
        whyItMatters: rule.whyItMatters,
        bestQuestion: existing?.provenance?.lastAskedQuestion ? 'already_asked_waiting_for_answer' : rule.bestQuestion,
        blockingStage: rule.blockingStage,
        repeatedQuestionRisk: existing?.provenance?.lastAskedQuestion ? 'avoid_repeat' : 'safe_to_ask',
        existingFactId: existing?.factId,
      } satisfies FilingFactCompleteness;
    });
}

function deriveComputeDraftBlockingReason(readiness: { blockerCodes: string[]; draftReadiness: string }): import('../../core/src/types.js').BlockingReason | undefined {
  if (readiness.draftReadiness === 'draft_ready') return undefined;
  if (readiness.blockerCodes.includes('awaiting_review_decision')) return 'awaiting_review_decision';
  if (readiness.blockerCodes.includes('missing_material_coverage')) return 'missing_material_coverage';
  if (readiness.blockerCodes.includes('unsupported_filing_path')) return 'unsupported_filing_path';
  return 'draft_not_ready';
}

export function taxBrowserResumeHomeTaxAssist(
  input: import('./contracts.js').ResumeHomeTaxAssistInput,
  session: import('../../core/src/types.js').BrowserAssistSession,
): MCPResponseEnvelope<import('./contracts.js').ResumeHomeTaxAssistData> {
  return {
    ok: true,
    status: session.authState === 'completed' ? 'in_progress' : 'awaiting_auth',
    data: {
      assistSessionId: session.assistSessionId,
      draftId: session.draftId,
      checkpointType: session.checkpointType,
      authRequired: session.authState !== 'completed',
      pendingUserAction: session.pendingUserAction,
      handoff: {
        provider: session.provider ?? 'hometax',
        targetSection: session.lastKnownSection ?? 'hometax_entry_start',
        recommendedTool: 'tax.browser.resume_hometax_assist',
        entryPlan: undefined,
      },
    },
    requiresAuth: session.authState !== 'completed',
    checkpointType: session.checkpointType,
    pendingUserAction: session.pendingUserAction ?? derivePendingUserAction({ checkpointType: session.checkpointType, sourceType: 'hometax' }),
    nextRecommendedAction: 'tax.browser.resume_hometax_assist',
  };
}

function buildObservedFields(
  fieldValues: import('../../core/src/types.js').FilingFieldValue[],
  sectionKeys?: string[],
): Array<{ sectionKey: string; fieldKey: string; portalObservedValue: string | number | boolean | null }> {
  const allowedSections = new Set(sectionKeys ?? []);
  return fieldValues
    .filter((field) => allowedSections.size === 0 || allowedSections.has(field.sectionKey))
    .filter((field) => !field.requiresManualEntry)
    .map((field) => ({
      sectionKey: field.sectionKey,
      fieldKey: field.fieldKey,
      portalObservedValue: toPortalObservedScalar(field.portalObservedValue ?? field.value),
    }));
}

function toPortalObservedScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

function buildFilingSections(
  draftId: string,
  fieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
): FilingSectionValue[] {
  const grouped = new Map<string, FilingSectionValue>();
  for (const field of fieldValues) {
    const current = grouped.get(field.sectionKey) ?? {
      draftId,
      sectionKey: field.sectionKey,
      fieldValues: [],
      manualFieldRefs: [],
      blockedFieldRefs: [],
      comparisonNeededFieldRefs: [],
      mismatchFieldRefs: [],
    };
    const fieldRef = `${field.sectionKey}.${field.fieldKey}`;
    const comparisonState = field.portalComparisonState ?? field.comparisonState ?? 'not_compared';
    current.fieldValues.push({
      ...field,
      confidenceScore: field.confidenceScore ?? field.confidence,
      portalComparisonState: comparisonState,
    });
    if (field.requiresManualEntry) current.manualFieldRefs.push(fieldRef);
    if (comparisonState === 'not_compared') current.comparisonNeededFieldRefs.push(fieldRef);
    if (comparisonState === 'mismatch') current.mismatchFieldRefs.push(fieldRef);
    if (field.requiresManualEntry || comparisonState === 'mismatch' || comparisonState === 'not_compared') current.blockedFieldRefs.push(fieldRef);
    grouped.set(field.sectionKey, current);
  }
  return Array.from(grouped.values()).sort((a, b) => a.sectionKey.localeCompare(b.sectionKey));
}

function deriveTrustPolicySummary(params: {
  supportTier?: string;
  lowConfidenceCount?: number;
  duplicateCandidateCount?: number;
  reviewItems?: ReviewItem[];
  coverageGaps?: CoverageGap[];
  adjustmentCandidates?: FilingAdjustmentCandidate[];
  withholdingRecords?: WithholdingRecord[];
  fieldValues?: import('../../core/src/types.js').FilingFieldValue[];
  comparisonMismatches?: Array<{ severity: 'low' | 'medium' | 'high' | 'critical' }>;
}) {
  const stopReasonCodes = new Set<string>();
  const warningCodes = new Set<string>();
  const reviewItems = params.reviewItems ?? [];
  const coverageGaps = params.coverageGaps ?? [];
  const adjustmentCandidates = params.adjustmentCandidates ?? [];
  const withholdingRecords = params.withholdingRecords ?? [];
  const comparisonMismatches = params.comparisonMismatches ?? [];
  const hasLowConfidenceReview = reviewItems.some((item) => item.reasonCode === 'low_confidence_classification' && item.resolutionState !== 'resolved');
  const hasUnresolvedDuplicate = reviewItems.some((item) => item.reasonCode === 'duplicate_conflict' && item.resolutionState !== 'resolved');
  const hasBlockingUnsupportedAdjustment = adjustmentCandidates.some((item) => item.eligibilityState === 'out_of_scope' && item.providedFactKeys.length > 0);

  if ((params.lowConfidenceCount ?? 0) > 0) warningCodes.add('low_confidence_classification');
  if ((params.duplicateCandidateCount ?? 0) > 0) warningCodes.add('duplicate_candidate_detected');
  if (hasLowConfidenceReview) warningCodes.add('classification_review_required');
  if (hasUnresolvedDuplicate) stopReasonCodes.add('unresolved_duplicate');
  if (coverageGaps.some((gap) => gap.gapType === 'missing_withholding_record' && gap.state === 'open')) stopReasonCodes.add('missing_withholding_record');
  if (coverageGaps.some((gap) => gap.gapType === 'missing_deduction_fact' && gap.state === 'open')) stopReasonCodes.add('missing_deduction_fact');
  if (withholdingRecords.some((record) => record.reviewStatus === 'conflict_detected')) stopReasonCodes.add('conflicting_withholding_record');
  if (comparisonMismatches.some((item) => item.severity === 'high' || item.severity === 'critical')) stopReasonCodes.add('severe_mismatch');
  if (hasBlockingUnsupportedAdjustment) stopReasonCodes.add('unsupported_adjustment');
  else if (adjustmentCandidates.some((item) => item.eligibilityState === 'out_of_scope')) warningCodes.add('unsupported_adjustment_candidate_present');
  if (params.supportTier === 'tier_c') stopReasonCodes.add('tier_c_stop');

  const duplicateRisk: 'low' | 'medium' | 'high' = (params.duplicateCandidateCount ?? 0) > 1 ? 'high' : (params.duplicateCandidateCount ?? 0) === 1 ? 'medium' : 'low';
  const mismatchSeverity: 'low' | 'medium' | 'high' | 'critical' = comparisonMismatches.some((item) => item.severity === 'critical') ? 'critical'
    : comparisonMismatches.some((item) => item.severity === 'high') ? 'high'
    : comparisonMismatches.some((item) => item.severity === 'medium') ? 'medium'
    : 'low';
  const materiality: 'low' | 'medium' | 'high' = stopReasonCodes.has('severe_mismatch') || stopReasonCodes.has('missing_withholding_record') ? 'high'
    : stopReasonCodes.size > 0 ? 'medium'
    : warningCodes.size > 0 ? 'low' : 'low';
  const confidenceScore = Math.max(0, Math.min(1,
    1
    - ((params.lowConfidenceCount ?? 0) * 0.18)
    - ((params.duplicateCandidateCount ?? 0) * 0.08)
    - (stopReasonCodes.has('severe_mismatch') ? 0.25 : 0)
    - (stopReasonCodes.has('unsupported_adjustment') ? 0.2 : 0)
    - (stopReasonCodes.has('conflicting_withholding_record') ? 0.2 : 0)
    - (stopReasonCodes.has('unresolved_duplicate') ? 0.15 : 0)
    - (params.supportTier === 'tier_b' ? 0.1 : params.supportTier === 'tier_c' ? 0.3 : 0)
  ));
  const confidenceBand: 'low' | 'medium' | 'high' = confidenceScore >= 0.85 ? 'high' : confidenceScore >= 0.6 ? 'medium' : 'low';
  const reviewBatchId = reviewItems.length > 0 ? `review_batch_${reviewItems[0]?.workspaceId ?? 'workspace'}_${reviewItems.length}` : undefined;
  const escalationReason = params.supportTier === 'tier_c'
    ? 'Tier C path requires stop and human-led handling.'
    : stopReasonCodes.has('severe_mismatch')
      ? 'Material HomeTax mismatch remains unresolved.'
      : stopReasonCodes.has('conflicting_withholding_record')
        ? 'Conflicting withholding records require explicit operator resolution.'
        : stopReasonCodes.has('unresolved_duplicate')
          ? 'Duplicate candidates remain unresolved and block filing progression.'
          : stopReasonCodes.has('unsupported_adjustment')
            ? 'Unsupported adjustment candidate requires manual handling.'
            : hasLowConfidenceReview
              ? 'Low-confidence classification requires review before proceeding.'
              : undefined;
  const explanationCodes = stopReasonCodes.size > 0 ? Array.from(stopReasonCodes) : Array.from(warningCodes);
  const operatorExplanation = explanationCodes.length > 0
    ? `${stopReasonCodes.size > 0 ? 'Blocked because' : 'Downgraded/warning because'}: ${explanationCodes.join(', ')}. Assumptions, if any, must be disclosed before filing.`
    : params.supportTier === 'tier_b'
      ? 'Tier B path can proceed only with downgraded assist and closer review. Assumptions must be disclosed.'
      : 'No active blockers detected. Any assumptions should still be disclosed to the operator.';
  return { confidenceScore, confidenceBand, duplicateRisk, materiality, mismatchSeverity, stopReasonCodes: Array.from(stopReasonCodes), warningCodes: Array.from(warningCodes), escalationReason, reviewBatchId, operatorExplanation };
}

function derivePrepareHomeTaxBlockingReason(readiness: { blockerCodes: string[]; submissionReadiness: string }): import('../../core/src/types.js').BlockingReason | undefined {
  if (readiness.submissionReadiness === 'submission_assist_ready') return undefined;
  if (readiness.blockerCodes.includes('awaiting_review_decision')) return 'awaiting_review_decision';
  if (readiness.blockerCodes.includes('unresolved_duplicate')) return 'awaiting_review_decision';
  if (readiness.blockerCodes.includes('conflicting_withholding_record')) return 'awaiting_review_decision';
  if (readiness.blockerCodes.includes('comparison_incomplete') || readiness.blockerCodes.includes('severe_mismatch')) return 'comparison_incomplete';
  if (readiness.blockerCodes.includes('official_data_refresh_required')) return 'official_data_refresh_required';
  if (readiness.blockerCodes.includes('missing_material_coverage') || readiness.blockerCodes.includes('missing_withholding_record') || readiness.blockerCodes.includes('missing_deduction_fact')) return 'missing_material_coverage';
  if (readiness.blockerCodes.includes('unsupported_filing_path') || readiness.blockerCodes.includes('unsupported_adjustment')) return 'unsupported_filing_path';
  if (readiness.blockerCodes.includes('submission_not_ready')) return 'submission_not_ready';
  return 'submission_not_ready';
}

function mergeComputedFieldValuesWithRuntimeState(
  computedFieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
  runtimeFieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
): import('../../core/src/types.js').FilingFieldValue[] {
  const runtimeMap = new Map(runtimeFieldValues.map((field) => [`${field.sectionKey}:${field.fieldKey}`, field]));
  return computedFieldValues.map((field) => {
    const persisted = runtimeMap.get(`${field.sectionKey}:${field.fieldKey}`);
    return persisted
      ? {
          ...field,
          portalObservedValue: persisted.portalObservedValue,
          comparisonState: persisted.portalComparisonState ?? persisted.comparisonState ?? field.comparisonState,
          portalComparisonState: persisted.portalComparisonState ?? persisted.comparisonState ?? field.comparisonState,
          freshnessState: persisted.freshnessState ?? field.freshnessState,
          requiresManualEntry: persisted.requiresManualEntry ?? field.requiresManualEntry,
          confidenceScore: persisted.confidenceScore ?? persisted.confidence ?? field.confidenceScore ?? field.confidence,
          mismatchSeverity: persisted.mismatchSeverity,
        }
      : field;
  });
}

function deriveHomeTaxPreparationState(
  fieldValues: import('../../core/src/types.js').FilingFieldValue[],
  reviewItems: ReviewItem[],
  prepareBlockingReason?: import('../../core/src/types.js').BlockingReason,
): Pick<PrepareHomeTaxData, 'sectionMapping' | 'orderedSections' | 'manualOnlyFields' | 'blockedFields' | 'comparisonNeededFields' | 'handoff' | 'browserAssistReady' | 'fieldValues'> {
  const grouped = new Map<string, PrepareHomeTaxData['sectionMapping'][string]>();
  const manualOnlyFields: string[] = [];
  const blockedFields: string[] = [];
  const comparisonNeededFields: string[] = [];
  const mismatchFields: string[] = [];
  const openReviewItems = reviewItems.filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed');
  const highSeverityReviewItems = openReviewItems.filter((item) => item.severity === 'high' || item.severity === 'critical');
  const mismatchReviewItems = openReviewItems.filter((item) => item.reasonCode === 'hometax_material_mismatch');
  const immediateUserConfirmations = ['consent/login/final judgment must remain user-confirmed'];

  for (const field of fieldValues) {
    const fieldRef = `${field.sectionKey}.${field.fieldKey}`;
    const comparisonState = field.comparisonState ?? 'not_compared';
    const requiresManualEntry = field.requiresManualEntry === true;
    const comparisonNeeded = !requiresManualEntry && (comparisonState === 'not_compared' || comparisonState === undefined);
    const hasMismatch = comparisonState === 'mismatch';
    const fieldReviewOpen = mismatchReviewItems.some((item) => item.linkedEntityIds?.includes(`${field.sectionKey}:${field.fieldKey}`));
    const blocked = hasMismatch || comparisonNeeded || fieldReviewOpen || Boolean(prepareBlockingReason);
    const current = grouped.get(field.sectionKey) ?? {
      sectionKey: field.sectionKey,
      fieldRefs: [],
      mappedFields: [],
      manualOnlyFields: [],
      blockedFields: [],
      comparisonNeededFields: [],
      mismatchFields: [],
      blockingItems: [],
    };

    const sourceProvenanceRefs = Array.isArray(field.evidenceRefs) ? field.evidenceRefs : [];
    current.fieldRefs.push(fieldRef);
    current.mappedFields.push({
      fieldKey: field.fieldKey,
      fieldRef,
      sectionKey: field.sectionKey,
      screenKey: `screen_${field.sectionKey}`,
      checkpointKey: `checkpoint_${field.sectionKey}_${field.fieldKey}`,
      value: field.value,
      comparisonState,
      sourceOfTruth: field.sourceOfTruth,
      requiresManualEntry,
      blocked,
      comparisonNeeded,
      sourceProvenanceRefs,
      requiredEvidenceRefs: field.evidenceRefs ?? [],
      mismatchBatchId: hasMismatch || fieldReviewOpen ? `mismatch_${field.sectionKey}` : undefined,
      mismatchState: fieldReviewOpen ? 'review_required' : hasMismatch ? 'mismatch' : comparisonNeeded ? 'not_compared' : 'matched',
      reviewStatus: fieldReviewOpen ? 'open' : 'none',
      entryMode: blocked
        ? (hasMismatch || fieldReviewOpen ? 'mismatch_detected' : requiresManualEntry ? 'manual_entry_required' : 'blocked')
        : requiresManualEntry
          ? 'manual_confirmation_required'
          : 'auto_fill_ready',
      allowedNextActions: blocked
        ? ['pause_and_return_to_mcp', 'request_user_judgment']
        : requiresManualEntry
          ? ['request_user_confirmation', 'enter_value_manually']
          : ['fill_field', 'confirm_visible_value', 'continue_to_next_field'],
      staleAfterRefresh: comparisonNeeded,
      retryPolicy: comparisonNeeded ? 'refresh_prepare_then_restart' : requiresManualEntry ? 'manual_confirmation_then_resume' : 'reauth_then_resume',
      resumePreconditions: [
        ...(comparisonNeeded ? ['portal comparison must be refreshed or manually confirmed'] : []),
        ...(fieldReviewOpen ? ['open high-severity or mismatch review must be resolved first'] : []),
      ],
      entryInstruction: requiresManualEntry
        ? '사용자가 HomeTax 화면에서 직접 확인 후 수기 입력'
        : hasMismatch
          ? '초안값과 HomeTax 관측값 불일치. 검토 후 입력 여부 결정'
          : comparisonNeeded
            ? 'HomeTax 표시값과 대조 후 입력'
            : '초안 기준으로 입력 후 화면값 재확인',
    });

    if (requiresManualEntry) {
      current.manualOnlyFields.push(fieldRef);
      manualOnlyFields.push(fieldRef);
    }
    if (blocked) {
      current.blockedFields.push(fieldRef);
      blockedFields.push(fieldRef);
    }
    if (comparisonNeeded) {
      current.comparisonNeededFields.push(fieldRef);
      comparisonNeededFields.push(fieldRef);
    }
    if (hasMismatch || fieldReviewOpen) {
      current.mismatchFields.push(fieldRef);
      mismatchFields.push(fieldRef);
    }

    grouped.set(field.sectionKey, current);
  }

  const orderedSections = Array.from(grouped.values())
    .sort((a, b) => a.sectionKey.localeCompare(b.sectionKey))
    .map((section, index) => ({
      order: index + 1,
      sectionKey: section.sectionKey,
      screenKey: `screen_${section.sectionKey}`,
      checkpointKey: `checkpoint_${section.sectionKey}`,
      checkpointType: section.blockedFields.length > 0 ? 'review_judgment' as const : 'data_entry' as const,
      fieldRefs: section.fieldRefs,
      mappedFields: section.mappedFields,
      manualOnlyFields: section.manualOnlyFields,
      blockedFields: section.blockedFields,
      comparisonNeededFields: section.comparisonNeededFields,
      mismatchFields: section.mismatchFields,
      allowedNextActions: section.blockedFields.length > 0 ? ['pause_and_return_to_mcp', 'request_user_judgment'] : ['continue_to_next_section', 'resume_hometax_assist'],
      resumePreconditions: section.blockedFields.length > 0 ? ['blocked fields must be resolved before browser progression'] : ['current draft and official data must still be current'],
      retryPolicy: (section.blockedFields.length > 0 ? 'stop_and_recompute' : 'reauth_then_resume') as 'reauth_then_resume' | 'refresh_prepare_then_restart' | 'manual_confirmation_then_resume' | 'stop_and_recompute',
      blockingItems: [
        ...(section.blockedFields.length > 0 ? [`${section.sectionKey} section has blocked fields`] : []),
      ],
    }));

  const blockingItems = [
    ...(prepareBlockingReason ? [prepareBlockingReason] : []),
    ...(highSeverityReviewItems.length > 0 ? ['high_severity_review_items_open'] : []),
    ...(mismatchReviewItems.length > 0 ? ['unresolved_hometax_mismatches'] : []),
  ];

  if (highSeverityReviewItems.length > 0) immediateUserConfirmations.push('high severity review items require human judgment');
  if (mismatchReviewItems.length > 0) immediateUserConfirmations.push('unresolved mismatch fields require user decision before final filing');
  if (prepareBlockingReason === 'official_data_refresh_required') immediateUserConfirmations.push('official data refresh needed before compare/recompute');
  immediateUserConfirmations.push('final submission judgment must be made by the user');

  return {
    sectionMapping: Object.fromEntries(grouped.entries()),
    orderedSections,
    manualOnlyFields,
    blockedFields,
    comparisonNeededFields,
    browserAssistReady: blockingItems.length === 0,
    handoff: {
      orderedSections,
      lastConfirmedDraftId: fieldValues[0]?.draftId,
      lastConfirmedDraftVersion: undefined,
      staleAfterRefresh: Boolean(prepareBlockingReason === 'official_data_refresh_required' || comparisonNeededFields.length > 0),
      mismatchBatchId: mismatchFields.length > 0 ? `mismatch_batch_${fieldValues[0]?.draftId ?? 'unknown_draft'}` : undefined,
      allowedNextActions: blockingItems.length > 0 ? ['pause_and_return_to_mcp', 'resolve_blockers'] : ['resume_hometax_assist', 'continue_to_next_section'],
      resumePreconditions: blockingItems.length > 0 ? ['resolve official-data/review/mismatch blockers before browser progression'] : ['same draft version must still be active'],
      retryPolicy: blockingItems.length > 0 ? 'refresh_prepare_then_restart' : 'reauth_then_resume',
      filingSections: buildFilingSections(fieldValues[0]?.draftId ?? 'unknown_draft', fieldValues),
      draftFieldValues: fieldValues,
      mismatchSummary: {
        hasUnresolvedMismatch: mismatchReviewItems.length > 0 || mismatchFields.length > 0,
        hasHighSeverityReview: highSeverityReviewItems.length > 0,
        openReviewItemIds: openReviewItems.map((item) => item.reviewItemId),
        unresolvedMismatchFieldRefs: mismatchFields,
      },
      manualVerificationChecklist: [
        '입력 전 각 섹션의 초안값과 HomeTax 표시값을 대조',
        '수기 입력 필드는 원천 증빙과 합계가 일치하는지 확인',
        '최종 제출 전 review/mismatch/blocker 상태 재확인',
      ],
      blockingItems,
      immediateUserConfirmations,
    },
    fieldValues,
  };
}

function extractWorkspaceIdFromSourceId(sourceId?: string): string {
  if (!sourceId) return 'unknown_workspace';
  const match = sourceId.match(/^source_[^_]+_(.+)$/);
  return match?.[1] ?? 'unknown_workspace';
}

function slugifyWorkspaceSegment(value?: string): string {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'default';
}


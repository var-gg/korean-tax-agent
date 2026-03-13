import type {
  ActiveBlocker,
  BlockingReason,
  CalibratedReadinessLevel,
  ConfidenceBand,
  CoverageByDomain,
  CoverageGap,
  DataFreshnessState,
  FilingComparisonSummaryState,
  FilingCoverageDomain,
  FilingDraft,
  FilingPathKind,
  FilingSupportTier,
  MaterialCoverageSummary,
  ReadinessLevel,
  ReviewItem,
  SubmissionComparisonState,
  SubmissionReadinessLevel,
  WorkspaceReadiness,
} from './types.js';

export type ReadinessSummary = {
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  estimateReadiness: ReadinessLevel;
  draftReadiness: ReadinessLevel;
  submissionReadiness: ReadinessLevel;
  comparisonSummaryState: FilingComparisonSummaryState;
  freshnessState: DataFreshnessState;
  majorUnknowns: string[];
  blockerCodes: BlockingReason[];
};

export type DeriveReadinessSummaryInput = {
  supportTier?: FilingSupportTier;
  filingPathKind?: FilingPathKind;
  coverageGaps?: CoverageGap[];
  reviewItems?: ReviewItem[];
  draft?: Pick<FilingDraft, 'draftId' | 'fieldValues'>;
  comparisonSummaryState?: FilingComparisonSummaryState;
  freshnessState?: DataFreshnessState;
};

export type CalibratedReadinessResult = {
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  workspaceReadiness: WorkspaceReadiness;
  coverageByDomain: CoverageByDomain;
  materialCoverageSummary: MaterialCoverageSummary;
  activeBlockers: ActiveBlocker[];
  comparisonSummaryState: FilingComparisonSummaryState;
  submissionComparisonState: SubmissionComparisonState;
  freshnessState: DataFreshnessState;
  blockerCodes: BlockingReason[];
  majorUnknowns: string[];
};

export function deriveCalibratedReadiness(input: DeriveReadinessSummaryInput): CalibratedReadinessResult {
  const supportTier = input.supportTier ?? 'undetermined';
  const filingPathKind = input.filingPathKind ?? 'unknown';
  const openCoverageGaps = (input.coverageGaps ?? []).filter((gap) => gap.state === 'open');
  const unresolvedReviewItems = (input.reviewItems ?? []).filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed');
  const highSeverityReviewItems = unresolvedReviewItems.filter((item) => item.severity === 'high' || item.severity === 'critical');

  const comparisonSummaryState =
    input.comparisonSummaryState ?? deriveComparisonSummaryStateFromDraft(input.draft?.fieldValues);
  const submissionComparisonState = mapSubmissionComparisonState(comparisonSummaryState);
  const freshnessState = input.freshnessState ?? deriveFreshnessStateFromDraft(input.draft?.fieldValues);

  const blockerCodes = new Set<BlockingReason>();
  const majorUnknowns = new Set<string>();
  const activeBlockers: ActiveBlocker[] = [];

  if (supportTier === 'tier_c') {
    blockerCodes.add('unsupported_filing_path');
    const message = 'This filing path is outside the supported V1 assist boundary.';
    majorUnknowns.add(message);
    activeBlockers.push({
      blockerType: 'support_boundary',
      blockingReason: 'unsupported_filing_path',
      severity: 'critical',
      affectedDomains: ['filingPath'],
      affectsReadiness: ['estimate', 'draft', 'submission'],
      message,
    });
  }

  if (supportTier === 'undetermined' || filingPathKind === 'unknown') {
    majorUnknowns.add('Filing path determination is still incomplete.');
  }

  for (const gap of openCoverageGaps) {
    if (isMaterialCoverageGap(gap.gapType)) {
      blockerCodes.add('missing_material_coverage');
    }

    if (gap.gapType === 'missing_filing_path_determination') {
      blockerCodes.add('unsupported_filing_path');
    }

    if (gap.gapType === 'missing_hometax_comparison') {
      blockerCodes.add('comparison_incomplete');
    }

    if (gap.gapType === 'stale_official_data') {
      blockerCodes.add('official_data_refresh_required');
    }

    majorUnknowns.add(gap.description);
    activeBlockers.push({
      blockerType: 'coverage_gap',
      blockingReason: gap.gapType === 'missing_hometax_comparison'
        ? 'comparison_incomplete'
        : gap.gapType === 'stale_official_data'
          ? 'official_data_refresh_required'
          : gap.gapType === 'missing_filing_path_determination'
            ? 'unsupported_filing_path'
            : 'missing_material_coverage',
      severity: gap.severity,
      affectedDomains: inferDomainsFromGap(gap),
      affectsReadiness: [
        ...(gap.blocksEstimate ? ['estimate' as const] : []),
        ...(gap.blocksDraft || gap.blocksDraft === undefined ? ['draft' as const] : []),
        ...(gap.blocksSubmission || gap.blocksSubmission === undefined ? ['submission' as const] : []),
      ],
      message: gap.description,
      gapId: gap.gapId,
    });
  }

  if (comparisonSummaryState === 'not_started' || comparisonSummaryState === 'partial') {
    blockerCodes.add('comparison_incomplete');
    activeBlockers.push({
      blockerType: 'comparison_block',
      blockingReason: 'comparison_incomplete',
      severity: 'high',
      affectedDomains: ['submissionComparison'],
      affectsReadiness: ['submission'],
      message: 'HomeTax submission comparison is still incomplete.',
    });
  }

  if (comparisonSummaryState === 'material_mismatch') {
    blockerCodes.add('comparison_incomplete');
    blockerCodes.add('awaiting_review_decision');
    majorUnknowns.add('HomeTax comparison found a material mismatch that still needs review.');
    activeBlockers.push({
      blockerType: 'comparison_block',
      blockingReason: 'comparison_incomplete',
      severity: 'high',
      affectedDomains: ['submissionComparison'],
      affectsReadiness: ['submission'],
      message: 'HomeTax comparison found a material mismatch that still needs review.',
    });
  }

  if (freshnessState === 'refresh_required' || freshnessState === 'stale_unknown') {
    blockerCodes.add('official_data_refresh_required');
  }

  if (highSeverityReviewItems.length > 0) {
    blockerCodes.add('awaiting_review_decision');
    const message = `${highSeverityReviewItems.length} high-severity review item(s) remain unresolved.`;
    majorUnknowns.add(message);
    activeBlockers.push({
      blockerType: 'review_block',
      blockingReason: 'awaiting_review_decision',
      severity: 'high',
      affectedDomains: inferDomainsFromReviewItems(highSeverityReviewItems),
      affectsReadiness: ['draft', 'submission'],
      message,
    });
  }

  const coverageByDomain = deriveCoverageByDomain({
    supportTier,
    filingPathKind,
    openCoverageGaps,
    highSeverityReviewItems,
    comparisonSummaryState,
  });

  const workspaceReadiness: WorkspaceReadiness = {
    estimateReadiness: deriveEstimateReadiness({
      supportTier,
      filingPathKind,
      coverageByDomain,
    }),
    draftReadiness: deriveDraftReadiness({
      hasDraft: Boolean(input.draft?.draftId),
      highSeverityReviewCount: highSeverityReviewItems.length,
      coverageByDomain,
    }),
    submissionReadiness: deriveSubmissionReadiness({
      supportTier,
      blockerCodes,
      comparisonSummaryState,
      freshnessState,
      hasDraft: Boolean(input.draft?.draftId),
    }),
    confidenceBand: deriveConfidenceBand({ coverageByDomain, blockerCodes }),
    supportTier,
    majorUnknowns: [...majorUnknowns],
  };

  return {
    supportTier,
    filingPathKind,
    workspaceReadiness,
    coverageByDomain,
    materialCoverageSummary: summarizeCoverageByDomain(coverageByDomain),
    activeBlockers,
    comparisonSummaryState,
    submissionComparisonState,
    freshnessState,
    blockerCodes: [...blockerCodes],
    majorUnknowns: [...majorUnknowns],
  };
}

export function deriveReadinessSummary(input: DeriveReadinessSummaryInput): ReadinessSummary {
  const calibrated = deriveCalibratedReadiness(input);

  return {
    supportTier: calibrated.supportTier,
    filingPathKind: calibrated.filingPathKind,
    estimateReadiness: mapLegacyEstimateReadiness(calibrated.workspaceReadiness.estimateReadiness),
    draftReadiness: mapLegacyDraftReadiness(calibrated.workspaceReadiness.draftReadiness, Boolean(input.draft?.draftId)),
    submissionReadiness: mapLegacySubmissionReadiness(calibrated.workspaceReadiness.submissionReadiness, calibrated.workspaceReadiness.draftReadiness, calibrated.workspaceReadiness.estimateReadiness),
    comparisonSummaryState: calibrated.comparisonSummaryState,
    freshnessState: calibrated.freshnessState,
    majorUnknowns: calibrated.majorUnknowns,
    blockerCodes: calibrated.blockerCodes,
  };
}

export function deriveComparisonSummaryStateFromDraft(
  fieldValues?: FilingDraft['fieldValues'],
): FilingComparisonSummaryState {
  if (!fieldValues || fieldValues.length === 0) return 'not_started';

  let matched = 0;
  let mismatched = 0;
  let manualOnly = 0;
  let notCompared = 0;

  for (const field of fieldValues) {
    switch (field.comparisonState) {
      case 'matched':
        matched += 1;
        break;
      case 'mismatch':
        mismatched += 1;
        break;
      case 'manual_only':
        manualOnly += 1;
        break;
      default:
        notCompared += 1;
        break;
    }
  }

  if (mismatched > 0) return 'material_mismatch';
  if (matched === 0 && manualOnly > 0 && notCompared === 0) return 'manual_only';
  if (notCompared > 0 && matched === 0) return 'not_started';
  if (notCompared > 0) return 'partial';
  return 'matched_enough';
}

export function deriveFreshnessStateFromDraft(fieldValues?: FilingDraft['fieldValues']): DataFreshnessState {
  if (!fieldValues || fieldValues.length === 0) return 'stale_unknown';
  if (fieldValues.some((field) => field.freshnessState === 'refresh_required')) return 'refresh_required';
  if (fieldValues.some((field) => field.freshnessState === 'stale_unknown')) return 'stale_unknown';
  if (fieldValues.some((field) => field.freshnessState === 'refresh_recommended')) return 'refresh_recommended';
  return 'current_enough';
}

function deriveCoverageByDomain(params: {
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  openCoverageGaps: CoverageGap[];
  highSeverityReviewItems: ReviewItem[];
  comparisonSummaryState: FilingComparisonSummaryState;
}): CoverageByDomain {
  const filingPath: CoverageByDomain['filingPath'] =
    params.supportTier === 'undetermined' || params.filingPathKind === 'unknown' || params.openCoverageGaps.some((gap) => gap.gapType === 'missing_filing_path_determination')
      ? 'weak'
      : 'strong';

  const incomeInventory: CoverageByDomain['incomeInventory'] =
    params.openCoverageGaps.some((gap) => gap.gapType === 'missing_income_source') ? 'weak' : 'partial';

  const withholdingPrepaidTax: CoverageByDomain['withholdingPrepaidTax'] =
    params.openCoverageGaps.some((gap) => gap.gapType === 'missing_withholding_record') ? 'weak' : 'partial';

  const expenseEvidence: CoverageByDomain['expenseEvidence'] =
    params.openCoverageGaps.some((gap) => gap.gapType === 'missing_expense_evidence') ? 'weak' : 'partial';

  const deductionFacts: CoverageByDomain['deductionFacts'] =
    params.openCoverageGaps.some((gap) => gap.gapType === 'missing_deduction_fact') || params.highSeverityReviewItems.length > 0 ? 'weak' : 'partial';

  const submissionComparison: CoverageByDomain['submissionComparison'] =
    params.comparisonSummaryState === 'matched_enough' || params.comparisonSummaryState === 'manual_only'
      ? 'strong'
      : params.comparisonSummaryState === 'partial'
        ? 'partial'
        : 'weak';

  return {
    filingPath,
    incomeInventory,
    withholdingPrepaidTax,
    expenseEvidence,
    deductionFacts,
    submissionComparison,
  };
}

function summarizeCoverageByDomain(coverageByDomain: CoverageByDomain): MaterialCoverageSummary {
  const entries = Object.entries(coverageByDomain) as Array<[FilingCoverageDomain, CoverageByDomain[FilingCoverageDomain]]>;
  return {
    strongDomains: entries.filter(([, value]) => value === 'strong').map(([key]) => key),
    partialDomains: entries.filter(([, value]) => value === 'partial').map(([key]) => key),
    weakDomains: entries.filter(([, value]) => value === 'weak' || value === 'none').map(([key]) => key),
  };
}

function deriveEstimateReadiness(params: {
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  coverageByDomain: CoverageByDomain;
}): CalibratedReadinessLevel {
  if (params.supportTier === 'tier_c') return 'not_ready';
  if (params.supportTier === 'undetermined' && params.filingPathKind === 'unknown') return 'not_ready';
  if (params.coverageByDomain.filingPath === 'weak') return 'not_ready';
  if (params.coverageByDomain.incomeInventory === 'weak') return 'limited';
  return 'ready';
}

function deriveDraftReadiness(params: {
  hasDraft: boolean;
  highSeverityReviewCount: number;
  coverageByDomain: CoverageByDomain;
}): CalibratedReadinessLevel {
  if (!params.hasDraft) return 'not_ready';
  if (params.highSeverityReviewCount > 0) return 'limited';
  if (params.coverageByDomain.filingPath === 'weak' || params.coverageByDomain.withholdingPrepaidTax === 'weak') return 'limited';
  return 'ready';
}

function deriveSubmissionReadiness(params: {
  supportTier: FilingSupportTier;
  blockerCodes: Set<BlockingReason>;
  comparisonSummaryState: FilingComparisonSummaryState;
  freshnessState: DataFreshnessState;
  hasDraft: boolean;
}): SubmissionReadinessLevel {
  if (!params.hasDraft) return 'not_ready';
  if (params.supportTier === 'tier_c' || params.supportTier === 'undetermined') return 'unsupported';
  if (params.comparisonSummaryState !== 'matched_enough' && params.comparisonSummaryState !== 'manual_only') return 'blocked';
  if (params.freshnessState !== 'current_enough' && params.freshnessState !== 'refresh_recommended') return 'blocked';

  const hardBlockers: BlockingReason[] = [
    'unsupported_filing_path',
    'missing_material_coverage',
    'comparison_incomplete',
    'official_data_refresh_required',
    'awaiting_review_decision',
    'submission_not_ready',
  ];

  return hardBlockers.some((reason) => params.blockerCodes.has(reason)) ? 'blocked' : 'ready';
}

function deriveConfidenceBand(params: {
  coverageByDomain: CoverageByDomain;
  blockerCodes: Set<BlockingReason>;
}): ConfidenceBand {
  if (params.blockerCodes.has('unsupported_filing_path') || params.coverageByDomain.filingPath === 'weak') return 'low';
  if (Object.values(params.coverageByDomain).every((value) => value === 'strong' || value === 'partial')) return 'medium';
  return 'low';
}

function mapSubmissionComparisonState(state: FilingComparisonSummaryState): SubmissionComparisonState {
  switch (state) {
    case 'matched_enough':
    case 'manual_only':
      return 'strong';
    case 'partial':
      return 'partial';
    case 'material_mismatch':
      return 'blocked';
    default:
      return 'not_started';
  }
}

function inferDomainsFromGap(gap: CoverageGap): FilingCoverageDomain[] {
  if (gap.affectedDomains && gap.affectedDomains.length > 0) return gap.affectedDomains;

  switch (gap.gapType) {
    case 'missing_filing_path_determination':
      return ['filingPath'];
    case 'missing_income_source':
      return ['incomeInventory'];
    case 'missing_withholding_record':
      return ['withholdingPrepaidTax'];
    case 'missing_expense_evidence':
      return ['expenseEvidence'];
    case 'missing_deduction_fact':
      return ['deductionFacts'];
    case 'missing_hometax_comparison':
      return ['submissionComparison'];
    case 'stale_official_data':
      return ['submissionComparison'];
    default:
      return ['incomeInventory'];
  }
}

function inferDomainsFromReviewItems(items: ReviewItem[]): FilingCoverageDomain[] {
  const domains = new Set<FilingCoverageDomain>();
  for (const item of items) {
    if (item.readinessEffect?.affectedDomains && item.readinessEffect.affectedDomains.length > 0) {
      for (const domain of item.readinessEffect.affectedDomains) domains.add(domain);
    }
  }
  return domains.size > 0 ? [...domains] : ['deductionFacts', 'expenseEvidence'];
}

function mapLegacyEstimateReadiness(level: CalibratedReadinessLevel): ReadinessLevel {
  if (level === 'ready') return 'estimate_ready';
  return 'not_ready';
}

function mapLegacyDraftReadiness(level: CalibratedReadinessLevel, hasDraft: boolean): ReadinessLevel {
  if (!hasDraft) return 'not_ready';
  if (level === 'ready') return 'draft_ready';
  if (level === 'limited') return 'estimate_ready';
  return 'not_ready';
}

function mapLegacySubmissionReadiness(
  level: SubmissionReadinessLevel,
  draftReadiness: CalibratedReadinessLevel,
  estimateReadiness: CalibratedReadinessLevel,
): ReadinessLevel {
  if (level === 'ready') return 'submission_assist_ready';
  if (draftReadiness !== 'not_ready') return 'draft_ready';
  if (estimateReadiness === 'ready') return 'estimate_ready';
  return 'not_ready';
}

function isMaterialCoverageGap(gapType: CoverageGap['gapType']): boolean {
  return gapType !== 'missing_filing_path_determination' && gapType !== 'missing_hometax_comparison' && gapType !== 'stale_official_data';
}

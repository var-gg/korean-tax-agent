import type {
  BlockingReason,
  CoverageGap,
  DataFreshnessState,
  FilingComparisonSummaryState,
  FilingDraft,
  FilingPathKind,
  FilingSupportTier,
  ReadinessLevel,
  ReviewItem,
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

export function deriveReadinessSummary(input: DeriveReadinessSummaryInput): ReadinessSummary {
  const supportTier = input.supportTier ?? 'undetermined';
  const filingPathKind = input.filingPathKind ?? 'unknown';
  const openCoverageGaps = (input.coverageGaps ?? []).filter((gap) => gap.state === 'open');
  const unresolvedReviewItems = (input.reviewItems ?? []).filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed');
  const highSeverityReviewItems = unresolvedReviewItems.filter((item) => item.severity === 'high' || item.severity === 'critical');

  const comparisonSummaryState =
    input.comparisonSummaryState ?? deriveComparisonSummaryStateFromDraft(input.draft?.fieldValues);
  const freshnessState = input.freshnessState ?? deriveFreshnessStateFromDraft(input.draft?.fieldValues);

  const blockerCodes = new Set<BlockingReason>();
  const majorUnknowns = new Set<string>();

  if (supportTier === 'tier_c') {
    blockerCodes.add('unsupported_filing_path');
    majorUnknowns.add('This filing path is outside the supported V1 assist boundary.');
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
  }

  if (comparisonSummaryState === 'not_started' || comparisonSummaryState === 'partial') {
    blockerCodes.add('comparison_incomplete');
  }

  if (comparisonSummaryState === 'material_mismatch') {
    blockerCodes.add('comparison_incomplete');
    blockerCodes.add('awaiting_review_decision');
    majorUnknowns.add('HomeTax comparison found a material mismatch that still needs review.');
  }

  if (freshnessState === 'refresh_required' || freshnessState === 'stale_unknown') {
    blockerCodes.add('official_data_refresh_required');
  }

  if (highSeverityReviewItems.length > 0) {
    blockerCodes.add('awaiting_review_decision');
    majorUnknowns.add(`${highSeverityReviewItems.length} high-severity review item(s) remain unresolved.`);
  }

  const estimateReadiness: ReadinessLevel = hasEnoughForEstimate({
    supportTier,
    filingPathKind,
    openCoverageGaps,
  })
    ? 'estimate_ready'
    : 'not_ready';

  const draftReadiness: ReadinessLevel = input.draft?.draftId
    ? 'draft_ready'
    : estimateReadiness === 'estimate_ready'
      ? 'estimate_ready'
      : 'not_ready';

  const submissionReadiness: ReadinessLevel = canAssistSubmission({
    supportTier,
    comparisonSummaryState,
    freshnessState,
    blockerCodes,
    hasDraft: Boolean(input.draft?.draftId),
  })
    ? 'submission_assist_ready'
    : draftReadiness === 'draft_ready'
      ? 'draft_ready'
      : estimateReadiness;

  return {
    supportTier,
    filingPathKind,
    estimateReadiness,
    draftReadiness,
    submissionReadiness,
    comparisonSummaryState,
    freshnessState,
    majorUnknowns: [...majorUnknowns],
    blockerCodes: [...blockerCodes],
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

function hasEnoughForEstimate(params: {
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  openCoverageGaps: CoverageGap[];
}): boolean {
  if (params.supportTier === 'tier_c') return false;
  if (params.supportTier === 'undetermined' && params.filingPathKind === 'unknown') return false;

  const blockingEstimateGap = params.openCoverageGaps.some((gap) => gap.gapType === 'missing_filing_path_determination');
  return !blockingEstimateGap;
}

function canAssistSubmission(params: {
  supportTier: FilingSupportTier;
  comparisonSummaryState: FilingComparisonSummaryState;
  freshnessState: DataFreshnessState;
  blockerCodes: Set<BlockingReason>;
  hasDraft: boolean;
}): boolean {
  if (!params.hasDraft) return false;
  if (params.supportTier === 'tier_c' || params.supportTier === 'undetermined') return false;
  if (params.comparisonSummaryState !== 'matched_enough' && params.comparisonSummaryState !== 'manual_only') return false;
  if (params.freshnessState !== 'current_enough' && params.freshnessState !== 'refresh_recommended') return false;

  const hardBlockers: BlockingReason[] = [
    'unsupported_filing_path',
    'missing_material_coverage',
    'comparison_incomplete',
    'official_data_refresh_required',
    'awaiting_review_decision',
    'submission_not_ready',
  ];

  return !hardBlockers.some((reason) => params.blockerCodes.has(reason));
}

function isMaterialCoverageGap(gapType: CoverageGap['gapType']): boolean {
  return gapType !== 'missing_filing_path_determination' && gapType !== 'missing_hometax_comparison' && gapType !== 'stale_official_data';
}

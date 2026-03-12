import { describe, expect, it } from 'vitest';
import { detectFilingPath, deriveReadinessSummary } from '../packages/core/src/index.js';
import type { CoverageGap, FilingFieldValue, ReviewItem, WithholdingRecord } from '../packages/core/src/types.js';

function makeWithholdingRecord(id: string): WithholdingRecord {
  return {
    withholdingRecordId: id,
    workspaceId: 'ws_1',
    filingYear: 2025,
    withheldTaxAmount: 100000,
    currency: 'KRW',
    sourceOfTruth: 'official',
    evidenceRefs: [],
    capturedAt: '2026-03-12T00:00:00.000Z',
  };
}

function makeReviewItem(overrides: Partial<ReviewItem> = {}): ReviewItem {
  return {
    reviewItemId: overrides.reviewItemId ?? 'review_1',
    workspaceId: 'ws_1',
    reasonCode: overrides.reasonCode ?? 'missing_evidence',
    severity: overrides.severity ?? 'high',
    question: overrides.question ?? 'Need review?',
    candidateOptions: overrides.candidateOptions ?? ['yes', 'no'],
    linkedEntityIds: overrides.linkedEntityIds ?? ['tx_1'],
    resolutionState: overrides.resolutionState ?? 'open',
    ...overrides,
  };
}

function makeCoverageGap(overrides: Partial<CoverageGap> = {}): CoverageGap {
  return {
    gapId: overrides.gapId ?? 'gap_1',
    workspaceId: 'ws_1',
    gapType: overrides.gapType ?? 'missing_hometax_comparison',
    severity: overrides.severity ?? 'high',
    description: overrides.description ?? 'Comparison has not been completed.',
    affectedArea: overrides.affectedArea ?? 'submission',
    relatedSourceIds: overrides.relatedSourceIds ?? [],
    state: overrides.state ?? 'open',
    ...overrides,
  };
}

function makeFieldValue(overrides: Partial<FilingFieldValue> = {}): FilingFieldValue {
  return {
    filingFieldValueId: overrides.filingFieldValueId ?? 'field_1',
    draftId: overrides.draftId ?? 'draft_1',
    sectionKey: overrides.sectionKey ?? 'income',
    fieldKey: overrides.fieldKey ?? 'total_income',
    value: overrides.value ?? 1000,
    sourceOfTruth: overrides.sourceOfTruth ?? 'official',
    ...overrides,
  };
}

describe('detectFilingPath', () => {
  it('classifies freelancer-like cases with withholding as Tier A', () => {
    const result = detectFilingPath({
      taxpayerProfile: {
        taxpayerType: 'freelancer',
      },
      transactions: [
        {
          transactionId: 'tx_income_1',
          workspaceId: 'ws_1',
          sourceId: 'src_1',
          occurredAt: '2026-03-12T00:00:00.000Z',
          amount: 500000,
          currency: 'KRW',
          normalizedDirection: 'income',
          evidenceRefs: [],
          createdAt: '2026-03-12T00:00:00.000Z',
        },
      ],
      withholdingRecords: [makeWithholdingRecord('wh_1')],
    });

    expect(result.supportTier).toBe('tier_a');
    expect(result.filingPathKind).toBe('freelancer_withholding_clear');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('classifies bookkeeping-heavy signals as Tier C', () => {
    const result = detectFilingPath({
      taxpayerProfile: {
        taxpayerType: 'sole_proprietor',
      },
      taxpayerFacts: [
        {
          factId: 'fact_1',
          workspaceId: 'ws_1',
          category: 'filing_path',
          factKey: 'bookkeeping_required',
          value: true,
          status: 'provided',
          sourceOfTruth: 'user_asserted',
          updatedAt: '2026-03-12T00:00:00.000Z',
        },
      ],
    });

    expect(result.supportTier).toBe('tier_c');
    expect(result.filingPathKind).toBe('bookkeeping_heavy');
    expect(result.escalationFlags).toContain('bookkeeping_heavy_case');
  });

  it('falls back to Tier B manual-heavy when facts are incomplete', () => {
    const result = detectFilingPath({
      taxpayerProfile: {
        taxpayerType: 'other',
      },
      coverageGaps: [
        makeCoverageGap({
          gapType: 'missing_filing_path_determination',
          description: 'Filing path facts are incomplete.',
        }),
      ],
    });

    expect(result.supportTier).toBe('tier_b');
    expect(result.filingPathKind).toBe('manual_heavy_general');
    expect(result.missingFacts).toContain('filing_path_determination');
  });
});

describe('deriveReadinessSummary', () => {
  it('downgrades submission readiness when comparison is incomplete', () => {
    const summary = deriveReadinessSummary({
      supportTier: 'tier_a',
      filingPathKind: 'freelancer_withholding_clear',
      draft: {
        draftId: 'draft_1',
        fieldValues: [
          makeFieldValue({ comparisonState: 'matched', freshnessState: 'current_enough' }),
          makeFieldValue({ filingFieldValueId: 'field_2', comparisonState: 'not_compared', freshnessState: 'current_enough' }),
        ],
      },
    });

    expect(summary.estimateReadiness).toBe('estimate_ready');
    expect(summary.draftReadiness).toBe('draft_ready');
    expect(summary.submissionReadiness).toBe('draft_ready');
    expect(summary.blockerCodes).toContain('comparison_incomplete');
    expect(summary.comparisonSummaryState).toBe('partial');
  });

  it('reaches submission-assist-ready only when comparison and freshness are acceptable', () => {
    const summary = deriveReadinessSummary({
      supportTier: 'tier_a',
      filingPathKind: 'mixed_income_limited',
      draft: {
        draftId: 'draft_1',
        fieldValues: [
          makeFieldValue({ comparisonState: 'matched', freshnessState: 'current_enough' }),
          makeFieldValue({ filingFieldValueId: 'field_2', comparisonState: 'manual_only', freshnessState: 'refresh_recommended' }),
        ],
      },
    });

    expect(summary.submissionReadiness).toBe('submission_assist_ready');
    expect(summary.blockerCodes).not.toContain('comparison_incomplete');
    expect(summary.blockerCodes).not.toContain('official_data_refresh_required');
  });

  it('adds hard blockers for stale official data and high-severity review', () => {
    const summary = deriveReadinessSummary({
      supportTier: 'tier_a',
      filingPathKind: 'expense_claim_simple',
      draft: {
        draftId: 'draft_1',
        fieldValues: [
          makeFieldValue({ comparisonState: 'matched', freshnessState: 'refresh_required' }),
        ],
      },
      reviewItems: [makeReviewItem()],
      coverageGaps: [
        makeCoverageGap({
          gapType: 'stale_official_data',
          description: 'Official records need refresh.',
        }),
      ],
    });

    expect(summary.submissionReadiness).toBe('draft_ready');
    expect(summary.blockerCodes).toContain('official_data_refresh_required');
    expect(summary.blockerCodes).toContain('awaiting_review_decision');
  });
});

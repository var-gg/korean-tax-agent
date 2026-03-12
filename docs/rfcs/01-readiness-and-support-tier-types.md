# RFC 01 — Readiness and Support-Tier Types

- Status: draft
- Intended audience: core package / runtime implementers
- Related:
  - [../20-workspace-state-model.md](../20-workspace-state-model.md)
  - [../22-core-type-gap-analysis.md](../22-core-type-gap-analysis.md)
  - [../27-v1-supported-paths-and-stop-conditions.md](../27-v1-supported-paths-and-stop-conditions.md)
  - [../../packages/core/src/types.ts](../../packages/core/src/types.ts)

## Objective
Turn the recently documented V1 support-boundary and readiness language into implementable core types.

This RFC is intentionally practical.
It does not redefine product strategy.
It defines the minimum type additions and tightening needed so runtime code can make truthful readiness claims.

## Current state
`packages/core/src/types.ts` already contains several useful early fields:
- `FilingSupportTier`
- `EstimateConfidenceBand`
- `FilingFieldComparisonState`
- `FilingDraft.submissionReadiness`
- `FilingWorkspace.lastBlockingReason`
- `CoverageGap`
- `WithholdingRecord`
- `FilingFieldValue`

That is a strong base.
The problem is not absence anymore.
The problem is that the types still mix:
- old workflow naming,
- partial readiness naming,
- and under-specified support-boundary semantics.

## Goals
1. Make readiness a first-class typed concept.
2. Make support-tier meaning explicit and durable.
3. Make comparison/freshness blockers visible in workspace and draft state.
4. Avoid forcing runtime code to derive submission truth from vague strings.

## Non-goals
- full tax-calculation modeling
- replacing review queue logic
- solving all deduction-domain modeling in this RFC

## Proposed enums

### 1. Filing support tier
Current:
- `freelancer_basic`
- `sole_proprietor_basic`
- `mixed_income_basic`
- `manual_only`

Problem:
These values mix user archetype and support posture.
They do not map cleanly to the new Tier A / B / C language.

Proposed:
```ts
export type FilingSupportTier = 'tier_a' | 'tier_b' | 'tier_c' | 'undetermined';
```

Optional companion field where needed:
```ts
export type FilingPathKind =
  | 'prefilled_simple'
  | 'freelancer_withholding_clear'
  | 'mixed_income_limited'
  | 'expense_claim_simple'
  | 'manual_heavy_general'
  | 'official_data_unstable'
  | 'platform_income_extra_review'
  | 'bookkeeping_heavy'
  | 'allocation_heavy'
  | 'specialist_optimization'
  | 'unknown';
```

Rule:
- `supportTier` answers support posture.
- `filingPathKind` answers case shape.
- do not overload one field to mean both.

### 2. Readiness level
Current:
- `FilingDraft.submissionReadiness` has a narrow one-off string union.
- `FilingWorkspace` has no typed readiness fields yet.

Proposed:
```ts
export type ReadinessLevel = 'not_ready' | 'estimate_ready' | 'draft_ready' | 'submission_assist_ready';
```

Interpretation:
- `not_ready`: not enough structured input for a reliable estimate
- `estimate_ready`: rough output possible, but material unknowns remain
- `draft_ready`: structured filing draft exists, but submission assist is still blocked
- `submission_assist_ready`: supported-path blockers are cleared and assist can proceed

### 3. Comparison state
Current:
- field-level `FilingFieldComparisonState = 'not_compared' | 'matched' | 'mismatch' | 'manual_only'`

Keep field-level state, but add section/workspace-level summarization:
```ts
export type FilingComparisonSummaryState =
  | 'not_started'
  | 'partial'
  | 'matched_enough'
  | 'material_mismatch'
  | 'manual_only';
```

### 4. Freshness state
New:
```ts
export type DataFreshnessState =
  | 'current_enough'
  | 'refresh_recommended'
  | 'refresh_required'
  | 'stale_unknown';
```

Why:
`official_data_refresh_required` should not live only as a blocking reason.
It should also be inspectable as state.

## Proposed interface changes

### FilingWorkspace
Add:
```ts
interface FilingWorkspace {
  supportTier?: FilingSupportTier;
  filingPathKind?: FilingPathKind;
  estimateReadiness?: ReadinessLevel;
  draftReadiness?: ReadinessLevel;
  submissionReadiness?: ReadinessLevel;
  comparisonSummaryState?: FilingComparisonSummaryState;
  freshnessState?: DataFreshnessState;
  majorUnknowns?: string[];
}
```

Rules:
- `estimateReadiness`, `draftReadiness`, `submissionReadiness` may differ.
- `submissionReadiness` must never be stronger than `draftReadiness`.
- `supportTier='tier_c'` should normally cap `submissionReadiness` below `submission_assist_ready`.

### FilingDraft
Replace current narrow field:
```ts
submissionReadiness?: 'not_ready' | 'review_required' | 'ready_for_hometax_assist';
```

With:
```ts
estimateReadiness?: ReadinessLevel;
 draftReadiness?: ReadinessLevel;
 submissionReadiness?: ReadinessLevel;
 supportTierAtComputation?: FilingSupportTier;
 comparisonSummaryState?: FilingComparisonSummaryState;
 freshnessState?: DataFreshnessState;
 majorUnknowns?: string[];
 blockerCodes?: BlockingReason[];
```

### CoverageGap
Tighten `gapType`.

Proposed:
```ts
export type CoverageGapType =
  | 'missing_income_source'
  | 'missing_withholding_record'
  | 'missing_expense_evidence'
  | 'missing_deduction_fact'
  | 'missing_filing_path_determination'
  | 'missing_hometax_comparison'
  | 'stale_official_data';
```

Then:
```ts
interface CoverageGap {
  gapType: CoverageGapType;
}
```

### FilingFieldValue
Keep existing field-level comparison state, but add optional freshness and support hints:
```ts
interface FilingFieldValue {
  comparisonState?: FilingFieldComparisonState;
  freshnessState?: DataFreshnessState;
  supportTierHint?: FilingSupportTier;
}
```

## Blocking reason alignment
Extend `BlockingReason` to match recent docs:
```ts
export type BlockingReason =
  | 'missing_consent'
  | 'missing_auth'
  | 'ui_changed'
  | 'blocked_by_provider'
  | 'export_required'
  | 'insufficient_metadata'
  | 'unsupported_source'
  | 'unsupported_filing_path'
  | 'missing_material_coverage'
  | 'awaiting_review_decision'
  | 'awaiting_final_approval'
  | 'draft_not_ready'
  | 'submission_not_ready'
  | 'comparison_incomplete'
  | 'official_data_refresh_required'
  | 'unsupported_hometax_state';
```

## Recommended normalization rule
At runtime, compute a coarse summary object from raw review gaps + comparison data + freshness data.
Do not make agents derive readiness directly from many scattered lists.

Suggested derived object:
```ts
interface ReadinessSummary {
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  estimateReadiness: ReadinessLevel;
  draftReadiness: ReadinessLevel;
  submissionReadiness: ReadinessLevel;
  comparisonSummaryState: FilingComparisonSummaryState;
  freshnessState: DataFreshnessState;
  majorUnknowns: string[];
  blockerCodes: BlockingReason[];
}
```

## Minimum acceptance criteria
Before saying this RFC is implemented:
- `FilingWorkspace` can expose readiness without prose-only interpretation
- `FilingDraft` can preserve readiness at computation time
- Tier A / B / C can be represented directly
- stale or un-compared official data can lower submission claims
- coverage gaps can distinguish filing-path / withholding / comparison problems

## Suggested implementation order
1. add enums
2. update `FilingWorkspace`
3. update `FilingDraft`
4. tighten `CoverageGap.gapType`
5. add runtime `ReadinessSummary` derivation helper
6. migrate old `submission_ready`-style assumptions gradually

# RFC 03 — Readiness Transition Rules

- Status: draft
- Intended audience: workflow runtime / state machine implementers
- Related:
  - [../24-workflow-state-machine.md](../24-workflow-state-machine.md)
  - [../20-workspace-state-model.md](../20-workspace-state-model.md)
  - [../27-v1-supported-paths-and-stop-conditions.md](../27-v1-supported-paths-and-stop-conditions.md)
  - [01-readiness-and-support-tier-types.md](./01-readiness-and-support-tier-types.md)
  - [02-mcp-contracts-for-filing-path-comparison-and-refresh.md](./02-mcp-contracts-for-filing-path-comparison-and-refresh.md)

## Objective
Define the minimum state-transition rules for moving a workspace between readiness levels.

This RFC is not a full workflow engine specification.
It gives deterministic guardrails so the product does not overstate confidence.

## Core principle
Readiness is monotonic only until new facts arrive.
After refresh, comparison, or new review findings, readiness may go down.
That is correct behavior.

## Readiness ladder
```text
not_ready
  -> estimate_ready
  -> draft_ready
  -> submission_assist_ready
```

Important:
- upward movement should require evidence
- downward movement should be allowed when blockers appear
- `submission_assist_ready` is not sticky

## Minimum conditions by level

### 1. `estimate_ready`
Minimum expectations:
- likely filing path is at least partially identified
- some income inventory exists
- the system can explain major unknowns

Should still be blocked by:
- large coverage gaps
- missing withholding data
- unresolved filing-path ambiguity

### 2. `draft_ready`
Minimum expectations:
- structured draft exists
- assumptions and blockers are explicit
- material review items are visible
- key input classes are represented, even if incomplete

May still be blocked by:
- comparison not done
- official data freshness concerns
- unresolved high-severity review
- manual-only sections not yet reconciled

### 3. `submission_assist_ready`
Minimum expectations:
- support tier is compatible with supported V1 assist
- material coverage gaps are resolved or explicitly non-blocking for that path
- required comparison steps are complete enough
- freshness state is acceptable
- no unresolved blocker that should stop assist

## Hard caps
The runtime should never produce `submission_assist_ready` when any of the following holds:
- `supportTier = tier_c`
- blocking reason includes `unsupported_filing_path`
- blocking reason includes `missing_material_coverage`
- blocking reason includes `comparison_incomplete`
- blocking reason includes `official_data_refresh_required`
- blocking reason includes `awaiting_review_decision` for a high-severity unresolved item

## Suggested downgrade rules

### Downgrade A. Official refresh changes imported truth
When new official data changes withholding, income, or filing-field values:
- lower `submissionReadiness` to at most `draft_ready`
- set `comparisonSummaryState` to `partial` or `not_started`
- mark old draft as superseded when recomputed

### Downgrade B. New coverage gap appears
When a material source or evidence gap is discovered:
- lower `submissionReadiness` to `draft_ready` or `estimate_ready`
- add `missing_material_coverage`
- append a concrete major unknown

### Downgrade C. Filing path becomes unsupported
When runtime learns the case is Tier C or undetermined in a blocking way:
- cap all readiness below `submission_assist_ready`
- set blocker to `unsupported_filing_path`
- preserve collected work, but stop assist progression

### Downgrade D. Comparison reveals material mismatch
When HomeTax comparison shows material mismatch:
- keep or lower `draftReadiness` depending on severity
- lower `submissionReadiness` below `submission_assist_ready`
- create review or blocker state rather than silently continuing

## Suggested upgrade rules

### Upgrade A. `not_ready -> estimate_ready`
Allowed when:
- filing path clues exist
- minimal source coverage exists
- the system can produce an approximate summary with explicit unknowns

### Upgrade B. `estimate_ready -> draft_ready`
Allowed when:
- draft computation succeeds
- assumptions/warnings are explicit
- major blockers are surfaced structurally

### Upgrade C. `draft_ready -> submission_assist_ready`
Allowed only when:
- support tier is `tier_a` or intentionally assistable `tier_b`
- comparison state is `matched_enough` or equivalent accepted state
- freshness state is `current_enough`
- no stop condition remains active
- explicit pre-assist checkpoints are satisfied

## Recommended derivation order
At recompute time, evaluate in this order:
1. support tier / filing path
2. coverage gaps
3. review severity
4. draft availability
5. comparison summary
6. freshness state
7. final blocking reasons
8. final readiness summary

Why this order:
It prevents shallow UI state from overpowering deeper truth constraints.

## State machine relationship
Broad workflow status and readiness should not be collapsed.
Examples:
- workspace may be `draft_ready_for_review` while submission readiness is only `draft_ready`
- workspace may remain `review_pending` while estimate readiness is already `estimate_ready`
- workspace may be `ready_for_hometax_assist` only when submission readiness is actually `submission_assist_ready`

## Suggested runtime helper
Implement a pure derivation function:
```ts
function deriveReadinessSummary(input: {
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  coverageGaps: CoverageGap[];
  reviewItems: ReviewItem[];
  draft?: FilingDraft;
  comparisonSummaryState?: FilingComparisonSummaryState;
  freshnessState?: DataFreshnessState;
}): ReadinessSummary
```

This function should be testable without browser or connector dependencies.

## Minimum acceptance criteria
Before this RFC is considered implemented:
- readiness can both upgrade and downgrade intentionally
- unsupported or stale cases cannot accidentally remain submission-assist-ready
- comparison and refresh outcomes can change assist eligibility
- workspace status and readiness stay conceptually separate

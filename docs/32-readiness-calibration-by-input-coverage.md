# Readiness Calibration by Input Coverage

- Status: active
- Doc role: canonical
- Locale: en
- Parent: [README.md](./README.md)
- Related:
  - [25-korean-comprehensive-income-tax-data-research.md](./25-korean-comprehensive-income-tax-data-research.md)
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
  - [29-source-strategy-for-real-tax-work.md](./29-source-strategy-for-real-tax-work.md)
  - [31-source-collection-blocked-path.md](./31-source-collection-blocked-path.md)
- Next recommended reading:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)

## Objective
Define how the system should calibrate:
- `estimateReadiness`
- `draftReadiness`
- `submissionReadiness`

based on the actual coverage of filing-relevant inputs.

This document exists to prevent readiness from becoming a vague confidence word.
A readiness claim should be anchored in specific input domains,
not in a general feeling that “we have some data.”

## Core rule
Readiness is not determined by:
- how many sources were connected,
- how many files were imported,
- or whether a draft object exists.

Readiness is determined by:
- whether the **right input domains** are covered enough,
- whether the **major unknowns** are explicit,
- whether **high-severity review items** remain,
- and whether the current filing path is still inside the supported v1 boundary.

## Why this document matters
Without calibration rules, the workflow can drift into dangerous ambiguity.
For example:
- imported transactions may look impressive while withholding truth is still missing,
- a draft may exist even though expense evidence is materially incomplete,
- HomeTax materials may be present while comparison readiness is still too weak for assisted filing.

This document is meant to stop those false-positive readiness claims.

## The six input domains that control readiness
A readiness claim should always be evaluated against these six domains.

### 1. Filing path determination inputs
Examples:
- filing year
- taxpayer posture
- likely support tier
- mixed-income / freelancer / sole-proprietor clues
- major filing-path facts

Question:
> Do we know what kind of case this is well enough to choose rules and sources responsibly?

### 2. Income inventory coverage
Examples:
- major income streams identified
- payer/source clues linked
- evidence or official support for material income
- uncovered-income suspicion state

Question:
> Is a material income omission still likely?

### 3. Withholding / prepaid tax coverage
Examples:
- withholding records present
- payer-linked withheld-tax support
- prepaid tax clues imported
- provenance and confidence available

Question:
> Would the refund/tax-due outcome be materially misleading if we proceeded now?

### 4. Expense and evidence coverage
Examples:
- meaningful expense candidates identified
- evidence linked for material items
- mixed-use ambiguity surfaced where needed
- unresolved material expense gaps tracked

Question:
> Are we still missing evidence or explanations for major expense claims?

### 5. Deduction / credit fact coverage
Examples:
- taxpayer facts needed for deductions are captured
- missing fact checklists are explicit
- unsupported adjustment categories are labeled honestly

Question:
> Are deduction-sensitive facts still missing in a way that materially changes the filing?

### 6. Submission comparison readiness
Examples:
- draft field mapping exists
- visible HomeTax sections can be compared
- mismatch tracking exists
- manual-entry requirements are explicit

Question:
> Can the workflow responsibly move into HomeTax assistance, or would that overstate mapping confidence?

## Readiness levels in plain language

### Estimate-ready
Meaning:
- enough is known to produce a rough outcome,
- but material unknowns may still remain,
- and assumptions are still doing visible work.

### Draft-ready
Meaning:
- enough is known to produce a structured filing draft,
- major blockers and assumptions are explicit,
- but submission assistance may still be blocked.

### Submission-assist-ready
Meaning:
- the supported-path blockers are cleared,
- material unknowns are reduced enough,
- and the workflow can move into HomeTax assistance without bluffing about comparison or source completeness.

## Minimum calibration posture by domain
The system should not require perfection.
But it should require the right minimum posture for each readiness level.

### Filing path determination inputs
- **Estimate-ready:** rough posture known
- **Draft-ready:** posture materially credible
- **Submission-assist-ready:** supported-path posture confirmed or strongly evidenced

### Income inventory coverage
- **Estimate-ready:** major income streams probably identified
- **Draft-ready:** major income streams materially covered
- **Submission-assist-ready:** material income omission risk is low

### Withholding / prepaid tax coverage
- **Estimate-ready:** at least partial visibility or assumptions made explicit
- **Draft-ready:** materially covered for the supported path
- **Submission-assist-ready:** material withholding omission risk is low

### Expense and evidence coverage
- **Estimate-ready:** rough expense basis or explicit exclusion assumptions
- **Draft-ready:** major expense items supported, reviewed, or deliberately excluded
- **Submission-assist-ready:** no unresolved high-severity expense ambiguity remains for the supported path

### Deduction / credit fact coverage
- **Estimate-ready:** may still be partial if assumptions are visible
- **Draft-ready:** major deduction-sensitive facts captured or explicitly deferred
- **Submission-assist-ready:** no material deduction fact gap remains hidden

### Submission comparison readiness
- **Estimate-ready:** not required
- **Draft-ready:** optional or early-stage only
- **Submission-assist-ready:** required

## Strong calibration rule: some domains gate more than others
Not all missing domains should be treated equally.

### Harder gates
These should strongly constrain stronger readiness claims:
- filing path determination
- income inventory coverage
- withholding / prepaid tax coverage
- submission comparison readiness for assist claims

### Softer-but-still-important gates
These may allow lower readiness with explicit assumptions, but should still constrain stronger claims:
- expense and evidence coverage
- deduction / credit fact coverage

Interpretation:
- weak expense evidence may still allow an estimate,
- but weak withholding truth should often prevent stronger claims much earlier.

## Calibration matrix
The following matrix is intentionally qualitative but operational.
It is meant to shape runtime logic and user-facing explanation.

### Matrix legend
- `strong` = materially covered for current supported path
- `partial` = useful but incomplete; assumptions or review still matter
- `weak` = materially insufficient
- `n/a` = not required yet for this readiness level

| Domain | Estimate-ready | Draft-ready | Submission-assist-ready |
|---|---|---|---|
| Filing path determination | partial | strong | strong |
| Income inventory coverage | partial | strong | strong |
| Withholding / prepaid tax coverage | partial | strong | strong |
| Expense and evidence coverage | partial | partial-to-strong | strong-enough for supported path |
| Deduction / credit fact coverage | partial | partial-to-strong | strong-enough for supported path |
| Submission comparison readiness | n/a | partial or n/a | strong |

## Negative calibration rules
These are the rules that should prevent false optimism.

### Rule 1. Do not call something submission-assist-ready if withholding coverage is weak
Even if:
- many transactions are imported,
- a draft exists,
- and HomeTax artifacts were partially collected.

Reason:
A materially incomplete withholding picture can distort final outcome trust too much.

### Rule 2. Do not call something submission-assist-ready if comparison readiness is weak
Even if:
- the draft looks internally coherent,
- and the supported path seems simple.

Reason:
Submission assistance requires trustworthy comparison and section mapping,
not just internal computation.

### Rule 3. Do not call something draft-ready if filing path determination is weak
Reason:
A draft built on an unclear filing posture is often pseudo-precision.

### Rule 4. A draft object does not automatically imply draft-readiness
A system may compute a draft for internal iteration while still telling the user:
- estimate-ready only,
- or limited draft with major blockers.

### Rule 5. Large source volume does not imply coverage quality
Reason:
Many imported files can still leave the wrong domain weak,
especially withholding, deduction facts, or comparison readiness.

## Example calibration cases

### Case A. HomeTax materials + partial withholding + rough expenses
Coverage posture:
- filing path: strong
- income: partial-to-strong
- withholding: partial
- expenses: partial
- deductions: weak-to-partial
- comparison: weak

Recommended readiness:
- `estimateReadiness = ready`
- `draftReadiness = limited_or_partial`
- `submissionReadiness = not_ready`

Why:
This is enough for a rough result,
but not enough for strong draft trust or assisted filing.

### Case B. HomeTax + withholding records + targeted expense evidence + one pending review item
Coverage posture:
- filing path: strong
- income: strong
- withholding: strong
- expenses: partial-to-strong
- deductions: partial
- comparison: partial
- review: one material item pending

Recommended readiness:
- `estimateReadiness = ready`
- `draftReadiness = ready`
- `submissionReadiness = blocked_pending_review_and_comparison`

Why:
The workflow can support a real draft,
but a high-impact unresolved review item and incomplete comparison should still block assist claims.

### Case C. Strong draft + comparison-ready + no material blockers
Coverage posture:
- filing path: strong
- income: strong
- withholding: strong
- expenses: strong-enough
- deductions: strong-enough
- comparison: strong
- review: no unresolved high-severity items

Recommended readiness:
- `estimateReadiness = ready`
- `draftReadiness = ready`
- `submissionReadiness = ready`

Why:
This is the supported-path target posture.

### Case D. Many bank/card records + weak official/withholding coverage
Coverage posture:
- filing path: partial
- income: partial
- withholding: weak
- expenses: strong-ish
- deductions: weak
- comparison: none

Recommended readiness:
- `estimateReadiness = maybe_ready_with_explicit_assumptions`
- `draftReadiness = not_ready_or_limited`
- `submissionReadiness = not_ready`

Why:
This case demonstrates why transaction-heavy ingestion is not enough by itself.

### Case E. Source collection blocked, but enough remains for estimate-only continuation
Coverage posture:
- filing path: strong
- income: partial
- withholding: weak-to-partial
- expenses: partial
- deductions: partial
- comparison: none
- source status: one key enrichment source blocked

Recommended readiness:
- `estimateReadiness = ready_or_nearly_ready`
- `draftReadiness = limited`
- `submissionReadiness = blocked`

Why:
A blocked source does not always collapse the entire workflow,
but it should still reduce stronger claims where material domains stay weak.

## Calibration rules for blocked-path interaction
Blocked paths should feed directly into readiness.

### If `blockingReason = missing_material_coverage`
Typical effect:
- estimate may remain possible
- draft may remain partial
- submission should usually be blocked

### If `blockingReason = comparison_incomplete`
Typical effect:
- estimate and draft may still remain valid
- submission-assist should be blocked

### If `blockingReason = unsupported_filing_path`
Typical effect:
- estimate may still be possible
- draft may be manual-only or limited
- submission-assist should be unsupported

### If `blockingReason = ui_changed` or `export_required`
Typical effect:
- readiness may remain unchanged temporarily
- but stronger claims should wait until the affected domain is restored or replaced

### If `blockingReason = blocked_by_provider`
Typical effect:
- source plan should be revised
- readiness impact depends on whether fallback sources can cover the same domain

## Suggested runtime fields for calibration
The runtime should likely carry more than simple readiness booleans.

Suggested fields:
- `estimateReadiness`
- `draftReadiness`
- `submissionReadiness`
- `confidenceBand`
- `majorUnknowns[]`
- `materialCoverageSummary`
- `coverageByDomain`
- `highSeverityReviewCount`
- `supportTier`

### Example `coverageByDomain`
```json
{
  "filingPath": "strong",
  "incomeInventory": "strong",
  "withholdingPrepaidTax": "partial",
  "expenseEvidence": "partial",
  "deductionFacts": "weak",
  "submissionComparison": "weak"
}
```

### Example `materialCoverageSummary`
```json
{
  "strongDomains": [
    "filingPath",
    "incomeInventory"
  ],
  "partialDomains": [
    "withholdingPrepaidTax",
    "expenseEvidence"
  ],
  "weakDomains": [
    "deductionFacts",
    "submissionComparison"
  ],
  "majorUnknowns": [
    "freelance_withholding_record_missing",
    "deduction_eligibility_facts_incomplete"
  ]
}
```

## User-facing explanation standard
The agent should be able to explain readiness in a way that maps to calibration.

### Good examples
- I can give you a rough estimate now, but I should not call this draft-ready until withholding coverage is stronger.
- The draft is meaningful, but I still have one material review item and weak HomeTax comparison coverage, so assisted filing is not ready yet.
- This is ready for HomeTax assistance because the major income and withholding domains are covered, the meaningful review items are resolved, and the comparison layer is strong enough.

### Bad examples
- Looks ready.
- Almost done.
- We have enough data.

These do not explain what domain truth the claim depends on.

## What this document reveals about implementation gaps

### 1. Coverage must be domain-aware, not file-aware
The system needs to know which filing domain is weak,
not just how many artifacts exist.

### 2. Withholding coverage deserves explicit weighting
The runtime should treat weak withholding truth as a stronger constraint than many other partial domains.

### 3. Draft generation and readiness reporting must be separable
A draft may be generated before the workflow earns a `draft-ready` claim.

### 4. Comparison readiness needs stronger first-class representation
Submission assistance should be gated by comparison truth,
not just by source completion.

### 5. Confidence language must come from calibration state
The agent should not improvise readiness language.
It should narrate from structured domain coverage and blocker state.

## One-line conclusion
A credible readiness model does not ask:
- do we have a draft?

It asks:
- are the right filing domains covered strongly enough,
- are the major unknowns explicit,
- and does the current state justify estimate, draft, or assisted-filing claims without bluffing?

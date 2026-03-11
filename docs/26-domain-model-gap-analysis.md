# Domain Model Gap Analysis for Real Filing Inputs

## Objective
Translate the domain research in `25-korean-comprehensive-income-tax-data-research.md` into concrete product and implementation gaps.

This document answers a narrower question than the broader architecture docs:
**what is still missing in the current code and contracts if the system is to support real Korean comprehensive income tax preparation inputs rather than only workflow skeleton behavior?**

## Current state
The repository already has meaningful support for:
- workflow checkpoints
- source connection and resumable sync flow
- transaction classification
- review queue generation
- draft generation
- HomeTax-assist preparation state

This is good progress.

However, the current implementation still leans heavily toward a generic pipeline of:
- transactions
- decisions
- review items
- draft summaries

That is not yet enough for a trustworthy real-world tax-preparation product.

## Main gap summary
The biggest missing layer is not routing or transport anymore.
It is **domain-specific filing inputs**.

In practice, the current model under-represents:
- taxpayer filing posture facts
- withholding/prepaid tax as a first-class domain
- deduction/credit eligibility facts
- estimate confidence and provenance
- section-level filing outputs that can be compared against HomeTax

## Gap 1. Taxpayer facts are too thin
Current state:
- `TaxpayerProfile` exists
- it contains useful top-level identity and hint fields

Why this is not enough:
Real filing readiness depends on facts such as:
- whether the user has salary + side income
- whether business-use expense claims are expected
- whether certain deduction/credit categories even apply
- whether the filing path should be treated as freelancer-like, sole-proprietor-like, or mixed-income-like

Recommendation:
Introduce a clearer taxpayer-facts layer, either as:
- a stronger `TaxpayerProfile`, or
- a related `TaxpayerFact` / `FilingFact` model

Minimum additions to model somewhere:
- filing posture / support tier
- income stream checklist
- deduction eligibility fact checklist
- business-use explanations for ambiguous items
- fact completeness status

Priority:
- **very high**

## Gap 2. Withholding / prepaid tax is not first-class enough
Current state:
- the system can carry transactions and documents
- draft computation can summarize outputs

Why this is not enough:
Refund or tax-due estimation is highly sensitive to already withheld or prepaid amounts.
These values should not depend on generic ledger interpretation alone.

Recommendation:
Add explicit modeling for withholding/prepaid tax records.
Possible shapes:
- a dedicated entity such as `WithholdingRecord`
- or a typed extension of document/extracted-value structures with first-class semantics

Minimum needed fields:
- workspaceId
- incomeSourceRef or payer/issuer clue
- filingYear
- grossAmount if available
- withheldTaxAmount
- localTaxAmount if applicable
- evidenceRefs
- sourceType / provenance
- extractionConfidence
- reviewStatus

Priority:
- **critical**

## Gap 3. Deduction and credit support is under-modeled
Current state:
- deductions are represented only indirectly in draft summaries and generic metadata hints

Why this matters:
Many filing-relevant items do not arise naturally from transactions alone.
The system needs a place to track:
- whether a deduction/credit category was considered
- whether required taxpayer facts are present
- whether supporting evidence exists
- whether the category is supported, unsupported, or deferred in v1

Recommendation:
Add a domain model such as `DeductionFact`, `CreditFact`, or a unified `FilingAdjustmentCandidate`.

Minimum fields:
- workspaceId
- adjustmentType
- eligibilityState
- requiredFactKeys[]
- providedFactKeys[]
- requiredEvidenceRefs[]
- amountCandidate
- confidence
- reviewRequired
- supportTier (`supported`, `manual_only`, `out_of_scope`)

Priority:
- **high**

## Gap 4. Draft outputs are summaries, but not yet comparison-ready filing outputs
Current state:
- `ComputeDraftData` contains summary objects
- `PrepareHomeTaxData` contains placeholder section mapping

Why this is not enough:
Before HomeTax assistance becomes trustworthy, the system should be able to show:
- which computed values belong to which filing section
- which fields were auto-derived versus manual-only
- which values depend on assumptions
- what mismatches appear when compared to visible HomeTax values

Recommendation:
Add a more explicit filing-output model.
Possible entity:
- `DraftFieldValue`
- `FilingSectionValue`

Minimum fields:
- draftId
- fieldKey / sectionKey
- value
- sourceRefs[]
- evidenceRefs[]
- confidence
- isEstimated
- requiresManualEntry
- portalComparisonState
- portalObservedValue
- mismatchSeverity

Priority:
- **very high**

## Gap 5. Provenance is present in fragments but not consistently exposed
Current state:
- some entities already carry provenance-like references and evidence links

Why this matters:
A tax workflow product must answer "why do you think this number is right?"
without forcing users to reverse-engineer the pipeline.

Recommendation:
Normalize provenance and confidence across draft-significant entities.

The implementation should converge on a reusable pattern such as:
- `sourceOfTruthType = official | imported | inferred | user_asserted`
- `confidenceScore`
- `materiality`
- `evidenceRefs[]`
- `reviewStatus`

Priority:
- **high**

## Gap 6. Coverage gaps need domain-aware categories
Current state:
- `CoverageGap` exists in core types
- runtime currently stores only lightweight gap descriptions

Why this is not enough:
A filing workflow must distinguish between:
- missing income evidence
- missing withholding records
- missing expense evidence
- missing deduction facts
- missing HomeTax comparison state

Recommendation:
Refine coverage gaps into domain-aware categories.

Examples:
- `missing_income_source`
- `missing_withholding_record`
- `missing_expense_evidence`
- `missing_deduction_fact`
- `missing_submission_comparison`

Priority:
- **high**

## Gap 7. Runtime does not yet model estimate confidence separately from submission readiness
Current state:
- runtime can block on review and move toward HomeTax assist readiness

Why this matters:
The product needs to tell the truth at three distinct moments:
- rough estimate
- filing draft
- HomeTax-assist-ready draft

Recommendation:
Represent readiness by level rather than a single broad draft notion.

Suggested states or fields:
- `estimateReadiness`
- `draftReadiness`
- `submissionReadiness`
- `confidenceBand`
- `majorUnknowns[]`

Priority:
- **medium-high**

## Contract-level implications
The MCP contract surface will likely need additional or richer tools over time.
Not all need implementation now, but the domain direction should be explicit.

Likely future tool needs:
- `tax.profile.capture_facts`
- `tax.withholding.import_records`
- `tax.withholding.list_records`
- `tax.filing.list_blockers`
- `tax.filing.get_field_mapping`
- `tax.filing.compare_with_hometax`
- `tax.deductions.capture_facts`

## Short-term implementation recommendation
Before expanding browser assist or persistence too far, the codebase should add support for at least:
1. taxpayer filing facts
2. withholding/prepaid tax records
3. comparison-ready draft field mapping
4. domain-specific coverage gap categories

These four additions will do more to make the system trustworthy than adding more runtime plumbing alone.

## Recommended sequencing
### Step 1
Strengthen the docs and examples around filing inputs.

### Step 2
Extend core types for:
- taxpayer facts
- withholding records
- filing field values

### Step 3
Update contracts/runtime to expose those values in draft and review flows.

### Step 4
Only then deepen HomeTax assist and persistence around those richer entities.

## Bottom line
The architecture is no longer the main unknown.
The next major risk is domain under-modeling.

If the repo adds first-class support for withholding, taxpayer facts, and comparison-ready filing outputs, it will be much closer to a system that can produce an honest estimate, a meaningful draft, and a safer HomeTax-assisted workflow.

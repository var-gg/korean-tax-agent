# Runtime and MCP Fields for Readiness and Coverage

- Status: active
- Doc role: canonical
- Locale: en
- Parent: [README.md](./README.md)
- Related:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)
  - [32-readiness-calibration-by-input-coverage.md](./32-readiness-calibration-by-input-coverage.md)
- Next recommended reading:
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)
  - [31-source-collection-blocked-path.md](./31-source-collection-blocked-path.md)

## Objective
Translate the readiness and coverage ideas from the recent docs into concrete runtime and MCP response fields.

This document answers the next implementation question:
**if readiness depends on domain coverage, what exact fields should the workspace runtime carry, and what exact fields should MCP tools return so the agent does not have to improvise?**

## Why this document matters
The docs now say clearly that:
- readiness is domain-aware,
- withholding matters more than raw file volume,
- blocked paths must explain readiness impact,
- and HomeTax assistance should be gated by comparison truth.

But unless those ideas become fields,
the implementation will drift back into vague prose and implicit heuristics.

This document is meant to prevent that drift.

## Core design rule
The runtime should separate:
1. workflow phase
2. readiness level
3. coverage-by-domain
4. active blockers
5. support-tier truth
6. major unknowns

The MCP layer should return these explicitly when they are relevant.
The agent should not be forced to infer them from scattered artifacts or summaries.

## Main runtime additions
The workspace runtime should grow in three major directions:
- richer readiness fields
- first-class coverage fields
- explicit linkage between blockers and readiness impact

## 1. Workspace-level readiness fields
The workspace should already expose broad workflow status,
but readiness needs a richer structured shape.

### Suggested fields
- `estimateReadiness`
- `draftReadiness`
- `submissionReadiness`
- `confidenceBand`
- `supportTier`
- `majorUnknowns[]`
- `readinessUpdatedAt`

### Why these fields matter
- `estimateReadiness` lets the system tell the truth before full draft maturity
- `draftReadiness` lets the system distinguish internal draft existence from user-safe draft claims
- `submissionReadiness` prevents premature HomeTax-assist language
- `confidenceBand` allows user-facing nuance without inventing prose on the fly
- `supportTier` ensures readiness stays inside actual product boundaries
- `majorUnknowns[]` forces hidden uncertainty into visible state

### Suggested value patterns
For early implementation, values can stay qualitative.

#### `estimateReadiness`
Suggested values:
- `not_ready`
- `limited`
- `ready`

#### `draftReadiness`
Suggested values:
- `not_ready`
- `limited`
- `ready`

#### `submissionReadiness`
Suggested values:
- `not_ready`
- `blocked`
- `ready`
- `unsupported`

#### `confidenceBand`
Suggested values:
- `low`
- `medium`
- `high`

## 2. Coverage-by-domain fields
This is the key new layer.
The runtime should carry direct coverage state for the filing-relevant domains.

### Suggested object
```json
{
  "coverageByDomain": {
    "filingPath": "strong",
    "incomeInventory": "partial",
    "withholdingPrepaidTax": "weak",
    "expenseEvidence": "partial",
    "deductionFacts": "weak",
    "submissionComparison": "none"
  }
}
```

### Suggested domains
- `filingPath`
- `incomeInventory`
- `withholdingPrepaidTax`
- `expenseEvidence`
- `deductionFacts`
- `submissionComparison`

### Suggested coverage values
- `none`
- `weak`
- `partial`
- `strong`

### Why this matters
This object is the bridge between:
- source collection truth,
- filing-domain truth,
- and user-facing readiness claims.

Without it, the runtime only knows that “some files arrived.”
With it, the runtime knows which filing domain is still weak.

## 3. Material coverage summary
A flatter summary is also useful for UI and MCP responses.

### Suggested object
```json
{
  "materialCoverageSummary": {
    "strongDomains": [
      "filingPath"
    ],
    "partialDomains": [
      "incomeInventory",
      "expenseEvidence"
    ],
    "weakDomains": [
      "withholdingPrepaidTax",
      "deductionFacts",
      "submissionComparison"
    ]
  }
}
```

### Why it helps
- easier for the agent to narrate quickly
- easier for UI to summarize
- easier to drive next-best-action logic

## 4. Major unknowns
The runtime should carry unknowns explicitly,
not bury them in review prose.

### Suggested field
- `majorUnknowns[]`

### Example values
- `freelance_withholding_record_missing`
- `possible_uncovered_income_source`
- `business_use_ratio_unconfirmed`
- `deduction_eligibility_facts_incomplete`
- `hometax_comparison_not_verified`

### Why this matters
A readiness label without explicit unknowns is too opaque.
The agent should be able to say *why* readiness is limited.

## 5. Active blocker summary
The runtime should have a compact place for blocker-to-readiness linkage.

### Suggested field
```json
{
  "activeBlockers": [
    {
      "blockerType": "coverage_gap",
      "blockingReason": "missing_material_coverage",
      "severity": "high",
      "affectedDomains": [
        "withholdingPrepaidTax"
      ],
      "affectsReadiness": [
        "draft",
        "submission"
      ],
      "message": "Freelance withholding records are still materially incomplete."
    }
  ]
}
```

### Suggested blocker types
- `source_block`
- `coverage_gap`
- `review_block`
- `comparison_block`
- `support_boundary`

### Why this matters
A blocked source and a blocked submission are not the same thing.
The runtime should expose how a blocker propagates into readiness.

## 6. Coverage gaps should link back to domains
`CoverageGap` should not remain only descriptive.
It should map into readiness logic.

### Suggested additions to coverage-gap entities
- `affectedDomains[]`
- `materiality`
- `blocksEstimate`
- `blocksDraft`
- `blocksSubmission`
- `recommendedNextSource`
- `recommendedNextAction`

### Example
```json
{
  "gapType": "missing_withholding_record",
  "severity": "high",
  "affectedDomains": [
    "withholdingPrepaidTax"
  ],
  "blocksEstimate": false,
  "blocksDraft": true,
  "blocksSubmission": true,
  "recommendedNextSource": "hometax_or_withholding_statement",
  "recommendedNextAction": "tax.sources.plan_collection"
}
```

## 7. Review items should expose readiness effect
Not every review item matters equally.
The runtime should be able to distinguish a cosmetic ambiguity from a submission blocker.

### Suggested additions to review items
- `severity`
- `affectedDomains[]`
- `blocksDraft`
- `blocksSubmission`
- `assumptionAllowed`
- `assumptionDisclosure`

### Why this matters
The calibration logic needs to know whether a review item:
- merely narrows confidence,
- blocks the draft,
- or blocks submission assist.

## 8. Draft objects should expose calibration context
A draft should be more than numbers.
It should say what kind of claim it supports.

### Suggested additions to draft objects
- `draftReadinessAtCreation`
- `coverageSnapshot`
- `majorUnknowns[]`
- `highSeverityReviewCount`
- `comparisonReadinessAtCreation`

### Why this matters
A draft must remain explainable later.
Otherwise users and engineers will assume any saved draft was safe to submit.

## 9. Submission comparison fields
Submission assistance depends on comparison truth.
That means comparison needs first-class fields.

### Suggested fields
- `submissionComparisonState`
- `comparisonCoverage`
- `mismatchSummary`
- `manualEntryRequired`
- `lastComparedAt`

### Suggested values
#### `submissionComparisonState`
- `not_started`
- `partial`
- `strong`
- `blocked`

#### `comparisonCoverage`
Example:
```json
{
  "sectionCoverage": {
    "incomeSummary": "strong",
    "withholdingSection": "partial",
    "deductionSection": "weak"
  }
}
```

### Why this matters
This is the practical gate for `submissionReadiness`.
Without explicit comparison fields,
submission-assist claims will drift into wishful thinking.

## 10. MCP response envelope additions
The common MCP response envelope should grow beyond generic workflow status.

### Suggested top-level additions
- `readiness`
- `coverageByDomain`
- `materialCoverageSummary`
- `majorUnknowns`
- `activeBlockers`
- `supportTier`

### Example response shape
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001"
  },
  "readiness": {
    "estimateReadiness": "ready",
    "draftReadiness": "limited",
    "submissionReadiness": "blocked",
    "confidenceBand": "medium"
  },
  "coverageByDomain": {
    "filingPath": "strong",
    "incomeInventory": "strong",
    "withholdingPrepaidTax": "partial",
    "expenseEvidence": "partial",
    "deductionFacts": "weak",
    "submissionComparison": "weak"
  },
  "materialCoverageSummary": {
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
    ]
  },
  "majorUnknowns": [
    "freelance_withholding_record_missing",
    "deduction_eligibility_facts_incomplete"
  ],
  "activeBlockers": [
    {
      "blockerType": "coverage_gap",
      "blockingReason": "missing_material_coverage",
      "severity": "high",
      "affectedDomains": [
        "withholdingPrepaidTax"
      ],
      "affectsReadiness": [
        "draft",
        "submission"
      ]
    }
  ],
  "supportTier": "A_candidate",
  "nextRecommendedAction": "tax.sources.plan_collection"
}
```

## 11. Tool-specific expectations
Not every MCP tool needs every field all the time.
But the important tools should converge on a consistent pattern.

### `tax.sources.plan_collection`
Should usually return:
- `coverageByDomain`
- `materialCoverageSummary`
- `majorUnknowns`
- `readiness`
- `recommendedSources[]`

Reason:
Source planning should be driven by missing filing domains.

### `tax.sources.get_collection_status`
Should usually return:
- `coverageByDomain`
- `activeBlockers`
- `coverageGaps[]`
- `readiness`
- `nextRecommendedAction`

Reason:
This is the main operational status snapshot.

### `tax.sources.sync` / `tax.sources.resume_sync`
Should usually return:
- `progress`
- `blockingReason`
- `pendingUserAction`
- `fallbackOptions`
- `readiness`
- `readinessImpact`

Reason:
A source interruption can change stronger readiness claims even if collection is only partly blocked.

### `tax.classify.run`
Should usually return:
- updated `coverageByDomain`
- new `majorUnknowns`
- review-item summary
- updated `readiness`

Reason:
Classification changes filing truth, not just labels.

### `tax.review.resolve`
Should usually return:
- updated review counts
- updated blockers
- updated readiness
- updated affected domains

Reason:
Review resolution may upgrade draft or submission readiness.

### `tax.draft.compute`
Should usually return:
- draft id
- draft summary
- `readiness`
- `coverageSnapshot`
- `majorUnknowns`
- `highSeverityReviewCount`

Reason:
Draft computation must not hide whether the draft is still limited.

### `tax.hometax.prepare_submission`
Should usually return:
- `submissionReadiness`
- `submissionComparisonState`
- mismatch summary
- manual-entry requirements
- blocking reasons when assist is not yet safe

Reason:
This is the strongest place where readiness honesty matters.

## 12. Readiness impact field for mutations
Mutating or blocked tools should often return a direct delta-oriented field.

### Suggested field
```json
{
  "readinessImpact": {
    "estimateReadiness": "unchanged",
    "draftReadiness": "downgraded_to_limited",
    "submissionReadiness": "blocked"
  }
}
```

### Why this helps
- easier for the agent to narrate
- easier for UI change logs
- easier for audit trails

## 13. Suggested compatibility path
The implementation does not need a giant breaking rewrite all at once.
A practical rollout could be:

### Phase 1
Add workspace-level fields:
- `estimateReadiness`
- `draftReadiness`
- `submissionReadiness`
- `majorUnknowns[]`
- `supportTier`

### Phase 2
Add domain coverage structures:
- `coverageByDomain`
- `materialCoverageSummary`
- `activeBlockers`

### Phase 3
Back-propagate readiness effects into:
- coverage gaps
- review items
- draft snapshots
- HomeTax prepare/assist responses

### Phase 4
Normalize MCP envelopes so major tools return readiness/coverage consistently

## 14. What this document reveals about remaining gaps

### 1. Coverage and readiness need first-class types, not ad hoc maps forever
Maps are a good start,
but typed schemas will be needed quickly.

### 2. Withholding and comparison deserve special weighting in code
The schema should make it easy to weight these as stronger gates.

### 3. Review items and coverage gaps must become more calibration-aware
Right now they are too easy to treat as detached lists.

### 4. Agent narration quality depends on field quality
If runtime fields stay vague,
agent explanations will stay vague too.

## One-line conclusion
If readiness depends on domain coverage,
then runtime state and MCP responses must carry:
- readiness explicitly,
- coverage by domain explicitly,
- blockers explicitly,
- and unknowns explicitly,
so the agent can explain the truth without inventing it.

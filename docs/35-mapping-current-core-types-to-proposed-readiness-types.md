# Mapping Current Core Types to Proposed Readiness Types

- Status: active
- Doc role: canonical
- Locale: en
- Parent: [README.md](./README.md)
- Related:
  - [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
  - [33-runtime-and-mcp-fields-for-readiness-and-coverage.md](./33-runtime-and-mcp-fields-for-readiness-and-coverage.md)
  - [34-proposed-type-shapes-for-runtime-coverage-and-readiness.md](./34-proposed-type-shapes-for-runtime-coverage-and-readiness.md)
- Next recommended reading:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [20-workspace-state-model.md](./20-workspace-state-model.md)

## Objective
Map the current `packages/core/src/types.ts` model to the proposed readiness/coverage type system,
with an emphasis on:
- additive migration,
- minimal breakage,
- and a clear order of implementation.

This document is the bridge between:
- design docs,
- proposed type shapes,
- and the actual codebase as it exists now.

## Why this document matters
The project now has:
- readiness calibration rules,
- runtime field proposals,
- and proposed TypeScript shapes.

What is still needed before code changes become straightforward is a 1:1 mapping answer:
**which current types already support the model, which ones need extension, and which ones should be introduced as new entities rather than stuffed into existing ones?**

## Current code snapshot: what already exists
The current `packages/core/src/types.ts` already contains important groundwork.

### Already present and helpful
- `WorkspaceStatus`
- `CollectionMode`
- `SourceState`
- `CheckpointType`
- `BlockingReason`
- `AuthCheckpointState`
- `SyncAttemptState`
- `CoverageGapType`
- `FilingSupportTier`
- `FilingPathKind`
- `SourceOfTruthType`
- `FilingFieldComparisonState`
- `FilingComparisonSummaryState`
- `DataFreshnessState`

### Already present but semantically misaligned
- `ReadinessLevel`
- `EstimateConfidenceBand`
- `FilingWorkspace.estimateReadiness`
- `FilingWorkspace.draftReadiness`
- `FilingWorkspace.submissionReadiness`

### Missing or not yet first-class enough
- bundled workspace readiness shape
- `CoverageByDomain`
- `MaterialCoverageSummary`
- `ActiveBlocker`
- calibration-aware `CoverageGap`
- review readiness effects
- draft calibration snapshot
- MCP `readinessState` response extension

## Important current mismatch: readiness field semantics
The current code already has:

```ts
export type ReadinessLevel = 'not_ready' | 'estimate_ready' | 'draft_ready' | 'submission_assist_ready';
```

and:
- `estimateReadiness?: ReadinessLevel`
- `draftReadiness?: ReadinessLevel`
- `submissionReadiness?: ReadinessLevel`

This is awkward because each field is carrying the *same ladder enum* rather than a field-specific state.

### Why this is a problem
Examples:
- `estimateReadiness = 'draft_ready'` is semantically odd
- `submissionReadiness = 'estimate_ready'` is semantically odd
- it mixes “which readiness dimension is this?” with “how ready is it?”

### Proposed target
Replace or deprecate this pattern in favor of:
- `estimateReadiness: ReadinessLevel` where `ReadinessLevel = 'not_ready' | 'limited' | 'ready'`
- `draftReadiness: ReadinessLevel`
- `submissionReadiness: SubmissionReadinessLevel` where submission has extra states like `blocked` and `unsupported`

### Migration recommendation
Do not hard-break existing consumers immediately.
Use a staged migration:
1. add new nested runtime readiness fields
2. keep old fields temporarily as compatibility aliases
3. migrate consumers
4. later deprecate the old top-level semantic shape

## Type-by-type mapping

## 1. `FilingWorkspace`
Current type already carries several useful readiness-adjacent fields.

### Current fields relevant to migration
- `workspaceId`
- `taxpayerId`
- `taxpayerProfileRef?`
- `filingYear`
- `status`
- `supportTier?`
- `filingPathKind?`
- `estimateReadiness?`
- `draftReadiness?`
- `submissionReadiness?`
- `comparisonSummaryState?`
- `freshnessState?`
- `majorUnknowns?`
- `openCoverageGapCount?`
- `lastBlockingReason?`
- `lastCollectionStatus?`

### Recommendation
Keep `FilingWorkspace` as the canonical aggregate root,
but add a nested runtime sub-object rather than continuing to flatten more fields.

### Proposed additive mapping
```ts
export interface FilingWorkspace {
  // existing fields...
  runtime?: FilingWorkspaceRuntimeExtensions;
}
```

Where `FilingWorkspaceRuntimeExtensions` contains:
- `readiness`
- `coverageByDomain`
- `materialCoverageSummary`
- `activeBlockers`
- `submissionComparison`

### Field mapping
| Current field | Proposed handling |
|---|---|
| `supportTier` | keep for now, also mirror into `runtime.readiness.supportTier` |
| `estimateReadiness` | keep temporarily; map to `runtime.readiness.estimateReadiness` via compatibility layer |
| `draftReadiness` | keep temporarily; map to `runtime.readiness.draftReadiness` |
| `submissionReadiness` | keep temporarily; map to `runtime.readiness.submissionReadiness` |
| `majorUnknowns` | keep temporarily; canonicalize later under `runtime.readiness.majorUnknowns` |
| `comparisonSummaryState` | migrate into `runtime.submissionComparison.submissionComparisonState` |
| `openCoverageGapCount` | keep; can be derived from gap registry |
| `lastBlockingReason` | keep; can mirror top active blocker or sync state |
| `lastCollectionStatus` | keep; remains operationally useful |

### Recommendation level
- **highest priority**

## 2. `SourceConnection`
The current type is already close to the proposed operational model.

### Current strengths
- already has `sourceLabel?`
- already has `collectionMode?`
- already has `state?`
- already has `lastSuccessfulSyncAt?`
- already has `lastBlockingReason?`
- already has `createdAt?` / `updatedAt?`

### Remaining issues
- `consentState` and `connectionStatus` still allow loose strings
- there is some duplication between `state` and `connectionStatus`

### Recommendation
Do not redesign this type heavily right now.
Instead:
- make `state` the canonical field
- treat `connectionStatus` as compatibility/deprecated
- tighten `consentState`
- keep `collectionMode`, `sourceLabel`, timestamps as-is

### Mapping decision
| Current field | Proposed handling |
|---|---|
| `state?` | canonical durable source state |
| `connectionStatus?` | deprecate in favor of `state` |
| `consentState?` | tighten to `ConsentStatus` only |
| `lastBlockingReason?` | keep, continues to support source-level summary |

### Recommendation level
- **high**

## 3. `SourceArtifact`
This type is already partially upgraded.

### Current strengths
- already has `workspaceId?`
- already has both `checksum?` / `contentHash?`
- already has both `storageRef?` / `contentRef?`
- already has `ingestedAt?`
- already has `parseSummary?`
- already has `duplicateCandidateOf?`

### Remaining issue
It still carries alias-like fields from older and newer naming conventions.

### Recommendation
Do not break storage consumers immediately.
Instead:
- document preferred canonical names
- keep aliases temporarily
- eventually standardize on `contentHash`, `contentRef`, `parseState`

### Mapping decision
No special readiness-specific extension is required here yet.
This type supports provenance but does not need readiness fields of its own.

### Recommendation level
- **medium**

## 4. `TaxpayerProfile`
This type exists,
but still needs to support stronger filing-fact posture over time.

### Current strengths
- has `taxpayerType`
- has filing-year context
- has basic metadata bags

### Gaps relative to readiness model
- no explicit fact completeness status
- no explicit filing posture confidence
- deduction/business-use facts still live too loosely

### Recommendation
Do not overload `TaxpayerProfile` immediately with every readiness concern.
Instead, consider adding either:
- a dedicated `FilingFact` entity later,
- or a small set of structured posture fields first.

### Mapping decision
This type is an upstream input to `coverageByDomain.filingPath`,
but it is not itself the readiness container.

### Recommendation level
- **high, but second phase**

## 5. `CoverageGapType` and future `CoverageGap`
The code already has:

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

This is strong groundwork.

### What is still missing
A first-class `CoverageGap` interface with:
- `affectedDomains`
- `materiality`
- `blocksEstimate`
- `blocksDraft`
- `blocksSubmission`
- `recommendedNextSource`
- `recommendedNextAction`

### Recommendation
Add a new `CoverageGap` interface rather than trying to encode all of this elsewhere.

### Mapping decision
| Current type | Proposed addition |
|---|---|
| `CoverageGapType` | keep |
| no `CoverageGap` interface yet | add `CoverageGap` interface |

### Recommendation level
- **very high**

## 6. `ReviewItem`
The current codebase already has a review concept,
but the excerpt and prior docs indicate it is not yet calibration-aware enough.

### Recommendation
Do not replace existing `ReviewItem` immediately.
Instead introduce an additive readiness attachment.

### Proposed mapping
```ts
export interface ReviewReadinessEffect {
  affectedDomains: FilingCoverageDomain[];
  blocksDraft: boolean;
  blocksSubmission: boolean;
  assumptionAllowed: boolean;
  assumptionDisclosure?: string;
}
```

Then either:
- extend `ReviewItem`, or
- wrap it in a richer runtime projection type.

### Recommendation level
- **high**

## 7. `FilingDraft`
The current draft model is useful,
but it does not yet preserve enough calibration context.

### Recommendation
Add a draft-level snapshot rather than pushing all logic back into live workspace reads.

### Proposed mapping
```ts
export interface FilingDraft {
  // existing fields...
  calibration?: DraftCalibrationSnapshot;
}
```

### Why this is better than nothing
It preserves:
- readiness at creation time
- domain coverage posture at creation time
- comparison state at creation time
- high-severity review count at creation time

### Recommendation level
- **high**

## 8. `BlockingReason`
This enum is already in good shape.

### Current strengths
Already includes:
- `missing_material_coverage`
- `comparison_incomplete`
- `unsupported_filing_path`
- `ui_changed`
- `blocked_by_provider`
- `export_required`

### Recommendation
Keep this enum.
Do not replace it.
Instead build:
- `ActiveBlocker`
- `CoverageGap`
- tool-level `readinessImpact`

on top of it.

### Recommendation level
- **keep as foundation**

## 9. `AuthCheckpointState`, `SyncAttemptState`, `CheckpointType`
These enums are also already aligned enough.

### Recommendation
Use them as-is.
The main missing work is not enum replacement,
but introducing the runtime structures that connect them to readiness and coverage.

### Recommendation level
- **keep as foundation**

## 10. `ReadinessLevel` and `EstimateConfidenceBand`
These need the most careful migration.

### Current code
```ts
export type EstimateConfidenceBand = 'low' | 'medium' | 'high';
export type ReadinessLevel = 'not_ready' | 'estimate_ready' | 'draft_ready' | 'submission_assist_ready';
```

### Problems
- `EstimateConfidenceBand` is estimate-specific by name, but likely useful more broadly
- `ReadinessLevel` uses ladder states that do not fit the three-field model cleanly

### Proposed target
```ts
export type ConfidenceBand = 'low' | 'medium' | 'high';
export type ReadinessLevel = 'not_ready' | 'limited' | 'ready';
export type SubmissionReadinessLevel = 'not_ready' | 'blocked' | 'ready' | 'unsupported';
```

### Migration recommendation
Use staged naming to avoid immediate conflicts.
For example:
- keep existing `ReadinessLevel` temporarily
- introduce `CalibratedReadinessLevel`
- introduce `SubmissionReadinessLevel`
- introduce `ConfidenceBand`
- migrate workspace runtime fields first
- later retire the older ladder enum if safe

### Recommendation level
- **critical semantic migration**

## 11. New types to add outright
The following should be introduced as net-new types rather than forced into older shapes.

### Add now or very soon
- `WorkspaceReadiness`
- `CoverageByDomain`
- `MaterialCoverageSummary`
- `ActiveBlocker`
- `ReadinessImpact`
- `CoverageGap`
- `ReviewReadinessEffect`
- `DraftCalibrationSnapshot`
- `SubmissionComparisonSummary`
- `FilingWorkspaceRuntimeExtensions`
- `MappedReadinessState` or equivalent MCP response helper

## Recommended migration order

### Phase 1. Additive runtime readiness layer
Add:
- `WorkspaceReadiness`
- `CoverageByDomain`
- `MaterialCoverageSummary`
- `ActiveBlocker`
- `FilingWorkspaceRuntimeExtensions`

and attach them as:
```ts
runtime?: FilingWorkspaceRuntimeExtensions;
```

to `FilingWorkspace`.

### Phase 2. Add calibration-aware supporting entities
Add:
- `CoverageGap`
- `ReviewReadinessEffect`
- `DraftCalibrationSnapshot`
- `SubmissionComparisonSummary`

### Phase 3. Migrate tool response contracts
Introduce:
- `MappedReadinessState`
- `readinessImpact`
- shared MCP workflow response helper types

### Phase 4. Deprecate awkward legacy semantics
Gradually deprecate:
- ladder-style `ReadinessLevel`
- `connectionStatus` in favor of `state`
- alias artifact field names once consumers are updated

## Concrete compatibility strategy

### Safe compatibility rules
- additive fields first
- deprecate, do not abruptly delete
- preserve existing top-level workspace readiness fields temporarily
- document canonical new fields
- migrate MCP responses before deleting legacy workspace fields

### Recommended canonical truth after migration
- workspace canonical readiness lives in `workspace.runtime.readiness`
- workspace domain coverage lives in `workspace.runtime.coverageByDomain`
- current blockers live in `workspace.runtime.activeBlockers`
- draft calibration truth lives in `draft.calibration`
- tool responses expose `readinessState`

## What should *not* be done

### Do not
- force all readiness logic into `FilingWorkspace` top-level flat fields
- overload `ReviewItem` to represent every coverage problem
- treat source-level blockage as equivalent to submission blockage
- keep ladder-style readiness semantics forever if the three-axis model is the intended direction

## One-line conclusion
The current core types are already closer than they first appear.
The best path is not a rewrite.
It is an additive migration where:
- existing workflow enums stay,
- workspace gains a nested runtime readiness layer,
- calibration-aware gap/review/draft types are added,
- and legacy readiness semantics are gradually retired.

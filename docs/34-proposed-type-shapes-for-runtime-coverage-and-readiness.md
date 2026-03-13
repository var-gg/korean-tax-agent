# Proposed Type Shapes for Runtime Coverage and Readiness

- Status: active
- Doc role: canonical
- Locale: en
- Parent: [README.md](./README.md)
- Related:
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)
  - [33-runtime-and-mcp-fields-for-readiness-and-coverage.md](./33-runtime-and-mcp-fields-for-readiness-and-coverage.md)
- Next recommended reading:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)

## Objective
Propose concrete TypeScript-friendly type shapes for:
- runtime readiness
- coverage by domain
- blocker summaries
- coverage gaps
- review readiness effects
- draft calibration snapshots
- MCP response extensions

This document is not a final code patch.
It is a schema-shaping bridge between the architecture docs and an eventual `packages/core/src/types.ts` update.

## Why this document matters
The previous docs now establish that:
- readiness is not a single boolean,
- coverage must be domain-aware,
- blockers should explain readiness impact,
- and the agent should narrate from structured truth rather than inference.

The next implementation step is to express those ideas as stable types.

## Design principles

### 1. Additive first
Prefer additive type expansion over large destructive rewrites.
This lowers migration cost and keeps compatibility paths open.

### 2. Runtime truth over UI convenience
Types should first capture workflow truth.
UI shaping can derive from those fields later.

### 3. Domain-aware, not file-aware
Coverage types should describe filing domains,
not counts of imported artifacts.

### 4. Readiness and blockers must be composable
A blocked source, a blocked draft, and an unsupported filing path are different states.
Types should make those differences explicit.

## Suggested base enums and aliases

```ts
export type ReadinessLevel = 'not_ready' | 'limited' | 'ready';

export type SubmissionReadinessLevel =
  | 'not_ready'
  | 'blocked'
  | 'ready'
  | 'unsupported';

export type ConfidenceBand = 'low' | 'medium' | 'high';

export type SupportTier = 'A' | 'A_candidate' | 'B' | 'C' | 'unknown';

export type CoverageStrength = 'none' | 'weak' | 'partial' | 'strong';

export type FilingCoverageDomain =
  | 'filingPath'
  | 'incomeInventory'
  | 'withholdingPrepaidTax'
  | 'expenseEvidence'
  | 'deductionFacts'
  | 'submissionComparison';

export type ReadinessKind = 'estimate' | 'draft' | 'submission';

export type BlockerType =
  | 'source_block'
  | 'coverage_gap'
  | 'review_block'
  | 'comparison_block'
  | 'support_boundary';
```

## 1. Workspace readiness bundle
Instead of scattering fields loosely,
a workspace can expose a small grouped shape.

```ts
export interface WorkspaceReadiness {
  estimateReadiness: ReadinessLevel;
  draftReadiness: ReadinessLevel;
  submissionReadiness: SubmissionReadinessLevel;
  confidenceBand: ConfidenceBand;
  supportTier: SupportTier;
  majorUnknowns: string[];
  readinessUpdatedAt?: string;
}
```

### Why bundle this
- easier to snapshot
- easier to reuse in MCP responses
- easier to attach to draft versions or audits

## 2. Coverage by domain
This should be a typed map, not an unstructured record.

```ts
export type CoverageByDomain = Record<FilingCoverageDomain, CoverageStrength>;
```

### Example
```ts
const coverage: CoverageByDomain = {
  filingPath: 'strong',
  incomeInventory: 'partial',
  withholdingPrepaidTax: 'weak',
  expenseEvidence: 'partial',
  deductionFacts: 'weak',
  submissionComparison: 'none',
};
```

## 3. Material coverage summary
This is a derived but useful stable shape.

```ts
export interface MaterialCoverageSummary {
  strongDomains: FilingCoverageDomain[];
  partialDomains: FilingCoverageDomain[];
  weakDomains: FilingCoverageDomain[];
}
```

### Note
This can be computed from `CoverageByDomain`,
but preserving it in runtime or tool responses may still be useful for simplicity and narration.

## 4. Active blocker summary
This is the main bridge between runtime blocking and readiness impact.

```ts
export interface ActiveBlocker {
  blockerType: BlockerType;
  blockingReason: string;
  severity: 'low' | 'medium' | 'high';
  affectedDomains: FilingCoverageDomain[];
  affectsReadiness: ReadinessKind[];
  message: string;
  sourceId?: string;
  syncAttemptId?: string;
  reviewItemId?: string;
  gapId?: string;
}
```

### Why this shape works
- one blocker can point to source/runtime entities when needed
- the agent can narrate it without recomputing impact
- UI can group blockers by readiness or domain

## 5. Readiness impact delta
Useful for tool outputs and audit-style updates.

```ts
export type ReadinessDelta =
  | 'unchanged'
  | 'upgraded_to_limited'
  | 'upgraded_to_ready'
  | 'downgraded_to_limited'
  | 'downgraded_to_not_ready'
  | 'blocked'
  | 'unsupported';

export interface ReadinessImpact {
  estimateReadiness?: ReadinessDelta;
  draftReadiness?: ReadinessDelta;
  submissionReadiness?: ReadinessDelta;
}
```

## 6. Coverage gap extensions
The existing or planned `CoverageGap` should become calibration-aware.

```ts
export interface CoverageGap {
  gapId: string;
  workspaceId: string;
  gapType: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedDomains: FilingCoverageDomain[];
  materiality: 'low' | 'medium' | 'high';
  blocksEstimate: boolean;
  blocksDraft: boolean;
  blocksSubmission: boolean;
  recommendedNextSource?: string;
  recommendedNextAction?: string;
  sourceRefs?: string[];
  createdAt: string;
  updatedAt: string;
}
```

### Why this matters
This allows a gap to be more than a note.
It becomes an actual input to readiness calculation.

## 7. Review item readiness extensions
Review items need explicit readiness effects.

```ts
export interface ReviewReadinessEffect {
  affectedDomains: FilingCoverageDomain[];
  blocksDraft: boolean;
  blocksSubmission: boolean;
  assumptionAllowed: boolean;
  assumptionDisclosure?: string;
}
```

If extending an existing review item:

```ts
export interface ReviewItemWithReadiness /* extends ReviewItem */ {
  reviewItemId: string;
  severity: 'low' | 'medium' | 'high';
  readinessEffect?: ReviewReadinessEffect;
}
```

### Why this matters
Not every review item should be treated like a submission blocker.
The type should carry that distinction.

## 8. Draft calibration snapshot
Every draft should capture the readiness truth it was born with.

```ts
export interface DraftCalibrationSnapshot {
  readiness: WorkspaceReadiness;
  coverageByDomain: CoverageByDomain;
  materialCoverageSummary: MaterialCoverageSummary;
  majorUnknowns: string[];
  highSeverityReviewCount: number;
  submissionComparisonState: 'not_started' | 'partial' | 'strong' | 'blocked';
  capturedAt: string;
}
```

### Suggested draft extension
```ts
export interface FilingDraftWithCalibration /* extends FilingDraft */ {
  draftId: string;
  calibration?: DraftCalibrationSnapshot;
}
```

## 9. Submission comparison types
These should be explicit because they gate assisted filing.

```ts
export type SubmissionComparisonState =
  | 'not_started'
  | 'partial'
  | 'strong'
  | 'blocked';

export interface SubmissionComparisonCoverage {
  sectionCoverage: Record<string, CoverageStrength>;
}

export interface SubmissionComparisonSummary {
  submissionComparisonState: SubmissionComparisonState;
  comparisonCoverage?: SubmissionComparisonCoverage;
  mismatchSummary?: {
    sectionKey: string;
    mismatchSeverity: 'low' | 'medium' | 'high';
    count?: number;
  }[];
  manualEntryRequired?: boolean;
  lastComparedAt?: string;
}
```

## 10. Workspace-level extension sketch
This shows how the main workspace entity might evolve additively.

```ts
export interface FilingWorkspaceRuntimeExtensions {
  readiness: WorkspaceReadiness;
  coverageByDomain: CoverageByDomain;
  materialCoverageSummary: MaterialCoverageSummary;
  activeBlockers: ActiveBlocker[];
  openCoverageGapCount?: number;
  lastBlockingReason?: string;
  submissionComparison?: SubmissionComparisonSummary;
}
```

### Integration options
There are two reasonable paths:

#### Path A. Flatten into `FilingWorkspace`
Pros:
- simple reads
- fewer nested lookups

Cons:
- workspace type gets large quickly

#### Path B. Add `runtime` or `workflowState` sub-object
Pros:
- better containment
- easier versioning of workflow-specific fields

Cons:
- slightly more nesting everywhere

### Recommendation
Prefer a nested additive shape such as:

```ts
export interface FilingWorkspace {
  // existing fields...
  runtime?: FilingWorkspaceRuntimeExtensions;
}
```

This is the safest migration path.

## 11. MCP response extension types
The MCP response envelope should become reusable and typed.

```ts
export interface MappedReadinessState {
  readiness: WorkspaceReadiness;
  coverageByDomain?: CoverageByDomain;
  materialCoverageSummary?: MaterialCoverageSummary;
  majorUnknowns?: string[];
  activeBlockers?: ActiveBlocker[];
  supportTier?: SupportTier;
  readinessImpact?: ReadinessImpact;
}
```

### Example generic tool response pattern
```ts
export interface McpWorkflowResponse<TData = unknown> {
  ok: boolean;
  status:
    | 'completed'
    | 'in_progress'
    | 'paused'
    | 'awaiting_consent'
    | 'awaiting_auth'
    | 'awaiting_user_action'
    | 'blocked'
    | 'failed';
  data?: TData;
  warnings?: string[];
  checkpointType?:
    | 'source_consent'
    | 'authentication'
    | 'collection_blocker'
    | 'review_judgment'
    | 'final_submission'
    | null;
  checkpointId?: string | null;
  blockingReason?: string | null;
  pendingUserAction?: string | null;
  resumeToken?: string | null;
  nextRecommendedAction?: string | null;
  fallbackOptions?: string[];
  progress?: {
    phase?: string;
    step?: string;
    percent?: number;
  };
  audit?: {
    eventType?: string;
    eventId?: string;
  };
  readinessState?: MappedReadinessState;
}
```

### Why `readinessState` as a sub-object
This avoids polluting the envelope too much,
while still making readiness fields portable across tools.

## 12. Tool-specific payload suggestions

### `tax.sources.get_collection_status`
```ts
export interface CollectionStatusData {
  workspaceId: string;
  connectedSources: string[];
  blockedSources: string[];
  coverageGaps: CoverageGap[];
}
```

### `tax.draft.compute`
```ts
export interface ComputeDraftResult {
  workspaceId: string;
  draftId: string;
  draftSummary: Record<string, unknown>;
  calibration: DraftCalibrationSnapshot;
}
```

### `tax.sources.sync` / `tax.sources.resume_sync`
```ts
export interface SourceSyncResult {
  workspaceId: string;
  sourceId: string;
  syncAttemptId: string;
  importedArtifactCount?: number;
  changedItemSummary?: Record<string, unknown>;
  readinessImpact?: ReadinessImpact;
}
```

## 13. Compatibility and migration strategy
A good migration path would be:

### Step 1
Introduce reusable enums and type aliases:
- `CoverageStrength`
- `FilingCoverageDomain`
- `SupportTier`
- `ReadinessLevel`
- `SubmissionReadinessLevel`

### Step 2
Add nested `runtime` to `FilingWorkspace`
with:
- `readiness`
- `coverageByDomain`
- `materialCoverageSummary`
- `activeBlockers`

### Step 3
Extend or wrap:
- `CoverageGap`
- `ReviewItem`
- `FilingDraft`

### Step 4
Adopt `readinessState` in major MCP tool responses

### Step 5
Later, tighten string fields into typed enums across source and sync models

## 14. Open design choices
A few choices can remain flexible for now.

### Choice A. String codes vs stricter enums for unknowns
`majorUnknowns` can begin as string codes,
then later graduate to typed enums if the list stabilizes.

### Choice B. Whether `CoverageGap` remains standalone or merges with blocker summaries
Recommendation:
keep both.
- `CoverageGap` is more persistent and domain-oriented
- `ActiveBlocker` is more operational and current-state-oriented

### Choice C. Whether readiness lives only on workspace or also on source/sync attempts
Recommendation:
- canonical readiness should live at workspace level
- tool responses can include `readinessImpact` and `readinessState`
- individual sources should not become the canonical source of workspace readiness truth

## 15. What this document reveals

### 1. The runtime layer is now becoming a real domain model
This is no longer just ingestion + draft.
It is a calibrated filing workflow state model.

### 2. The agent becomes simpler as types improve
Better types mean the agent narrates less by guesswork and more by contract.

### 3. The next natural step is code-level alignment
After this doc,
the obvious follow-up is either:
- patching `packages/core/src/types.ts`, or
- writing a concrete diff plan mapping existing fields to the proposed shapes.

## One-line conclusion
If the product wants truthful estimate, draft, and submission claims,
then the core types should explicitly model:
- readiness,
- domain coverage,
- blockers,
- unknowns,
- and draft calibration snapshots,
so those concepts stop living only in prose.

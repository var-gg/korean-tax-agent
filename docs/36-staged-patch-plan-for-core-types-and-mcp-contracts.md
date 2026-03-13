# Staged Patch Plan for Core Types and MCP Contracts

- Status: active
- Doc role: canonical
- Locale: en
- Parent: [README.md](./README.md)
- Related:
  - [33-runtime-and-mcp-fields-for-readiness-and-coverage.md](./33-runtime-and-mcp-fields-for-readiness-and-coverage.md)
  - [34-proposed-type-shapes-for-runtime-coverage-and-readiness.md](./34-proposed-type-shapes-for-runtime-coverage-and-readiness.md)
  - [35-mapping-current-core-types-to-proposed-readiness-types.md](./35-mapping-current-core-types-to-proposed-readiness-types.md)
- Next recommended reading:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)

## Objective
Provide a short execution-oriented patch plan for moving from the current codebase to the proposed readiness/coverage model.

This document is intentionally brief.
It exists to answer:
- what to patch first,
- what to defer,
- and how to reduce breakage while improving the type system quickly.

## Patch strategy
Use a two-track approach:
1. additive core-type improvements first
2. MCP contract adoption second

Do not wait for a perfect full-schema redesign before shipping useful structure.

## Stage 1. Patch `packages/core/src/types.ts`
Goal:
- add the new readiness/coverage primitives without breaking current consumers

Patch now:
- `CalibratedReadinessLevel`
- `SubmissionReadinessLevel`
- `ConfidenceBand`
- `FilingCoverageDomain`
- `CoverageStrength`
- `ReadinessKind`
- `BlockerType`
- `WorkspaceReadiness`
- `CoverageByDomain`
- `MaterialCoverageSummary`
- `ActiveBlocker`
- `ReadinessImpact`
- `ReviewReadinessEffect`
- `DraftCalibrationSnapshot`
- `SubmissionComparisonSummary`
- `FilingWorkspaceRuntimeExtensions`
- `MappedReadinessState`

Also patch:
- `FilingWorkspace.runtime?`
- `CoverageGap` readiness fields
- `ReviewItem.readinessEffect?`
- `FilingDraft.calibration?`

Keep for compatibility:
- existing `ReadinessLevel`
- existing top-level workspace readiness fields
- existing draft readiness fields

## Stage 2. Normalize MCP response helpers
Goal:
- let tools return readiness and coverage without ad hoc shapes

Add shared helper types for responses such as:
- `McpWorkflowResponse<TData>`
- `MappedReadinessState`

Adopt first in:
- collection status tools
- source sync/resume tools
- draft compute
- HomeTax prepare/assist tools

## Stage 3. Migrate consumers
Update consumers to prefer:
- `workspace.runtime.readiness`
- `workspace.runtime.coverageByDomain`
- `workspace.runtime.activeBlockers`
- `draft.calibration`
- response `readinessState`

Legacy top-level fields remain readable during this stage.

## Stage 4. Deprecation cleanup
After consumer migration stabilizes:
- deprecate ladder-style readiness semantics
- deprecate `connectionStatus` in favor of `state`
- consider consolidating legacy artifact alias names

## Recommended immediate code patch scope
For the first code patch, keep it intentionally narrow:
- patch type declarations only
- avoid broad runtime behavior changes in the same commit
- do not rewrite business logic yet

This keeps the diff reviewable and sets up later implementation work cleanly.

## One-line conclusion
Patch the types first, adopt readiness-aware MCP helpers next, then migrate consumers gradually instead of trying to land the full workflow redesign in one jump.

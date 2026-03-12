# RFC 02 — MCP Contracts for Filing-Path Detection, HomeTax Comparison, and Official Refresh

- Status: draft
- Intended audience: MCP server / workflow runtime implementers
- Related:
  - [../09-mcp-tool-spec.md](../09-mcp-tool-spec.md)
  - [../24-workflow-state-machine.md](../24-workflow-state-machine.md)
  - [../27-v1-supported-paths-and-stop-conditions.md](../27-v1-supported-paths-and-stop-conditions.md)
  - [01-readiness-and-support-tier-types.md](./01-readiness-and-support-tier-types.md)

## Objective
Define the first three MCP contracts needed to operationalize the new support-boundary model.

The goal is simple:
The agent should not have to bluff about whether a case is supportable.
These tools should give it structured answers.

## Scope
This RFC defines draft contracts for:
- `tax.profile.detect_filing_path`
- `tax.filing.compare_with_hometax`
- `tax.filing.refresh_official_data`

## Shared response expectations
These tools should all use the standard workflow envelope from `09-mcp-tool-spec.md`, including:
- `status`
- `checkpointType`
- `blockingReason`
- `pendingUserAction`
- `fallbackOptions[]`
- `audit`

Additionally, all three should return a structured readiness block:
```json
{
  "readiness": {
    "supportTier": "tier_a",
    "filingPathKind": "mixed_income_limited",
    "estimateReadiness": "estimate_ready",
    "draftReadiness": "draft_ready",
    "submissionReadiness": "draft_ready",
    "comparisonSummaryState": "partial",
    "freshnessState": "refresh_recommended",
    "majorUnknowns": [],
    "blockerCodes": ["comparison_incomplete"]
  }
}
```

## 1. `tax.profile.detect_filing_path`

### Purpose
Determine the likely filing-path shape and V1 support tier for the current workspace.

### Why this tool matters
Without an explicit filing-path detection step, Tier A / B / C remains documentation only.
The runtime needs a typed decision point.

### Suggested input
```json
{
  "workspaceId": "ws_123",
  "taxpayerProfileRef": "tp_123",
  "includeEvidenceSummary": true,
  "includeCoverageGaps": true,
  "includeWithholdingSummary": true
}
```

### Suggested output
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_123",
    "supportTier": "tier_a",
    "filingPathKind": "freelancer_withholding_clear",
    "confidence": 0.83,
    "reasons": [
      "withholding records are present for major income sources",
      "no bookkeeping-heavy indicators detected"
    ],
    "missingFacts": [],
    "escalationFlags": []
  },
  "readiness": {
    "supportTier": "tier_a",
    "filingPathKind": "freelancer_withholding_clear",
    "estimateReadiness": "estimate_ready",
    "draftReadiness": "draft_ready",
    "submissionReadiness": "draft_ready",
    "comparisonSummaryState": "not_started",
    "freshnessState": "current_enough",
    "majorUnknowns": [],
    "blockerCodes": ["comparison_incomplete"]
  }
}
```

### Blocking behavior
Use blocked or awaiting-user-action responses when:
- key filing-path facts are missing
- the case cannot be safely classified into a supported path

Preferred blocker codes:
- `unsupported_filing_path`
- `missing_material_coverage`
- `insufficient_metadata`

### State effects
This tool should be allowed to update:
- `workspace.supportTier`
- `workspace.filingPathKind`
- `workspace.majorUnknowns`
- audit trail for path detection

## 2. `tax.filing.compare_with_hometax`

### Purpose
Compare computed draft field values against visible or imported HomeTax values and summarize whether assist can safely continue.

### Why this tool matters
Submission-assist-ready should not be asserted only because a draft exists.
Comparison is one of the key truth checks.

### Suggested input
```json
{
  "workspaceId": "ws_123",
  "draftId": "draft_9",
  "comparisonMode": "visible_portal",
  "sectionKeys": ["income", "withholding", "deductions"]
}
```

### Suggested output
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "draftId": "draft_9",
    "sectionResults": [
      {
        "sectionKey": "income",
        "comparisonState": "matched_enough",
        "matchedFields": 12,
        "mismatchFields": 0,
        "manualOnlyFields": 1
      },
      {
        "sectionKey": "withholding",
        "comparisonState": "material_mismatch",
        "matchedFields": 3,
        "mismatchFields": 1,
        "manualOnlyFields": 0
      }
    ],
    "materialMismatches": [
      {
        "sectionKey": "withholding",
        "fieldKey": "national_tax_amount",
        "draftValue": 120000,
        "portalObservedValue": 90000,
        "severity": "high"
      }
    ]
  },
  "readiness": {
    "supportTier": "tier_a",
    "filingPathKind": "mixed_income_limited",
    "estimateReadiness": "estimate_ready",
    "draftReadiness": "draft_ready",
    "submissionReadiness": "draft_ready",
    "comparisonSummaryState": "material_mismatch",
    "freshnessState": "current_enough",
    "majorUnknowns": [],
    "blockerCodes": ["comparison_incomplete"]
  }
}
```

### Blocking behavior
Use:
- `comparison_incomplete` when required sections were not compared
- `official_data_refresh_required` when portal values are plausibly newer than local draft inputs
- `awaiting_review_decision` when mismatches require user judgment

### State effects
This tool should be allowed to update:
- field-level comparison states
- section-level comparison summary
- workspace/draft submission readiness
- review items or coverage gaps when comparison reveals new issues

## 3. `tax.filing.refresh_official_data`

### Purpose
Refresh official-source inputs, produce a diff summary, and trigger readiness recomputation.

### Why this tool matters
A draft that was previously strong may become stale during filing season.
Refresh must be a first-class workflow, not a hidden side effect.

### Suggested input
```json
{
  "workspaceId": "ws_123",
  "sourceIds": ["src_hometax_main"],
  "refreshPolicy": "if_stale_or_user_requested",
  "recomputeDraft": true
}
```

### Suggested output
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "refreshedSources": [
      {
        "sourceId": "src_hometax_main",
        "syncAttemptId": "sync_22",
        "changeSummary": {
          "newArtifacts": 2,
          "changedWithholdingRecords": 1,
          "changedDraftFields": 3
        }
      }
    ],
    "recomputedDraftId": "draft_10",
    "supersededDraftId": "draft_9",
    "readinessDowngraded": true,
    "downgradeReasons": ["official_data_refresh_required", "comparison_incomplete"]
  },
  "readiness": {
    "supportTier": "tier_a",
    "filingPathKind": "freelancer_withholding_clear",
    "estimateReadiness": "estimate_ready",
    "draftReadiness": "draft_ready",
    "submissionReadiness": "draft_ready",
    "comparisonSummaryState": "partial",
    "freshnessState": "current_enough",
    "majorUnknowns": [],
    "blockerCodes": ["comparison_incomplete"]
  }
}
```

### Blocking behavior
This tool may legitimately return:
- `awaiting_auth`
- `awaiting_user_action`
- `blocked`

Preferred blocker codes:
- `missing_auth`
- `ui_changed`
- `blocked_by_provider`
- `official_data_refresh_required` only before refresh is completed

### State effects
This tool should be allowed to update:
- source sync state
- source freshness state
- withholding records / imported official artifacts
- draft supersession chain
- readiness downgrade or re-upgrade

## Contract design rules
1. These tools should return structured readiness, not just status text.
2. They should be allowed to downgrade readiness after new information arrives.
3. `submission_assist_ready` should be rare and earned.
4. Comparison and refresh should not be hidden inside generic sync calls if the user needs trust-visible explanations.

## Minimum acceptance criteria
Before these contracts are considered implemented:
- the agent can determine whether a case is Tier A / B / C in structured form
- the agent can explain why a draft is not yet submission-assist-ready
- the runtime can refresh official data without pretending old drafts remain current
- comparison can block assist with machine-readable reasons

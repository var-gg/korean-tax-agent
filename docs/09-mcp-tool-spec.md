# MCP Tool Spec

- Status: active
- Canonical: English
- Korean companion: [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)
- Parent: [README.md](./README.md)
- Related:
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)
  - [08-hometax-submission-flow.md](./08-hometax-submission-flow.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
- Next recommended reading:
  - [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)


## Purpose
The MCP surface should expose a compact, agent-friendly tool layer for:
- environment setup,
- data import,
- normalization,
- classification,
- review handling,
- draft generation,
- HomeTax-assisted submission.

The goal is not to expose every internal function, but to give the agent a reliable workflow API with clear consent and audit behavior.

## Tool design rules
- every sensitive action must surface consent state
- every mutating action should produce audit metadata
- review-item resolution must be explicit and attributable
- tool responses should be structured for agent follow-up, not prose-only
- long-running steps should support progress/pause/resume semantics

## Common response envelope
Suggested response shape:

```json
{
  "ok": true,
  "data": {},
  "warnings": [],
  "requiresConsent": false,
  "requiresAuth": false,
  "status": "completed",
  "checkpointType": null,
  "checkpointId": null,
  "blockingReason": null,
  "pendingUserAction": null,
  "resumeToken": null,
  "nextRecommendedAction": "tax.classify.run",
  "fallbackOptions": [],
  "progress": {
    "phase": "classification",
    "step": "apply_rules",
    "percent": 100
  },
  "audit": {
    "eventType": "import_completed",
    "eventId": "evt_123"
  }
}
```

Interpretation rules:
- `status` describes tool/runtime progress state
- `checkpointType` describes what kind of user checkpoint is active
- `blockingReason` explains why progress stopped
- `pendingUserAction` tells the agent what to ask the user to do next
- `resumeToken` or a session id should be returned when the action is resumable

## Recommended status values
- `completed`
- `in_progress`
- `paused`
- `awaiting_consent`
- `awaiting_auth`
- `awaiting_user_action`
- `blocked`
- `failed`

## Standard checkpoint types
- `source_consent`
- `authentication`
- `collection_blocker`
- `review_judgment`
- `final_submission`

## Recommended blocking reasons
- `missing_consent`
- `missing_auth`
- `ui_changed`
- `blocked_by_provider`
- `export_required`
- `insufficient_metadata`
- `unsupported_source`
- `unsupported_filing_path`
- `missing_material_coverage`
- `awaiting_review_decision`
- `awaiting_final_approval`
- `draft_not_ready`
- `submission_not_ready`
- `comparison_incomplete`
- `official_data_refresh_required`
- `unsupported_hometax_state`

## Progress and resume semantics
Long-running or checkpoint-driven tools should expose enough state for the agent to pause, narrate, and resume without guessing.

Suggested fields:
- `status`
- `checkpointType`
- `checkpointId`
- `blockingReason`
- `pendingUserAction`
- `resumeToken` or resumable session id
- `progress.phase`
- `progress.step`
- `progress.percent`
- `fallbackOptions[]`

Mapping rule:
- if the tool is waiting on the user, it should prefer a resumable response over a generic error
- `awaiting_consent`, `awaiting_auth`, and `awaiting_user_action` should usually come with `checkpointType`
- `blocked` should explain whether the best next move is fallback, retry, or human review

## Proposed tool groups

### setup

#### `tax.setup.inspect_environment`
Purpose:
- detect storage readiness, supported connectors, browser-assist capability, and missing prerequisites

Input:
- optional working config path

Output:
- environment summary
- missing dependencies
- supported import modes
- browser-assist availability

#### `tax.setup.init_config`
Purpose:
- initialize a local filing workspace/config

Input:
- filing year
- storage mode
- optional workspace path
- optional taxpayer type hint

Output:
- created workspace info
- initial config summary

#### `tax.setup.list_connectors`
Purpose:
- show available source connectors/import modes and their consent/auth requirements

Output:
- connector list
- capability matrix
- consent/auth notes

### source planning

#### `tax.sources.plan_collection`
Purpose:
- recommend the next best source connections or collection actions for a workspace

Input:
- workspace id
- filing year
- current coverage summary
- optional user profile hints

Output:
- recommended next sources
- expected value by source
- likely user checkpoints
- fallback path suggestions

#### `tax.sources.get_collection_status`
Purpose:
- summarize current collection coverage, gaps, blocked sources, and recommended next actions

Input:
- workspace id

Output:
- connected sources
- pending checkpoints
- coverage gaps
- blocked attempts
- next recommended action

### sources

#### `tax.sources.connect`
Purpose:
- register and start connecting a source

Input:
- source type
- requested scope
- workspace id

Output:
- connection state
- consent requirement
- auth requirement
- checkpoint id when blocked on the user
- next step
- fallback options if the preferred path is unavailable

Notes:
- should not silently complete sensitive auth on behalf of the user
- should return `awaiting_consent`, `awaiting_auth`, or `awaiting_user_action` rather than vague failure when the workflow is resumable

#### `tax.sources.list`
Purpose:
- list connected and available sources for a workspace

#### `tax.sources.sync`
Purpose:
- pull or refresh data from an already approved source

Input:
- source id
- sync mode (`incremental`, `full`)

Output:
- imported artifact counts
- changed item summary
- warnings
- progress state
- blocked checkpoint details when user interaction is needed
- fallback suggestions when sync cannot continue as planned

#### `tax.sources.resume_sync`
Purpose:
- continue a paused or checkpoint-blocked collection/sync attempt after the user completes the required action

Input:
- source id or sync session id
- checkpoint id or resume token

Output:
- resumed state
- progress update
- imported artifact summary
- next checkpoint if another user action is required

#### `tax.sources.disconnect`
Purpose:
- disable a source connection for future syncs

Notes:
- should not automatically delete prior imported records unless separately requested and approved

### imports

#### `tax.import.upload_transactions`
Purpose:
- ingest user-provided transaction files

Input:
- file refs
- source format hint
- workspace id

Output:
- artifact ids
- parse summary
- normalization readiness

#### `tax.import.upload_documents`
Purpose:
- ingest receipts, invoices, tax statements, and related evidence files

#### `tax.import.scan_receipts`
Purpose:
- OCR/extract fields from receipt-like inputs

Output:
- extracted field candidates
- confidence
- review candidates

#### `tax.import.import_hometax_materials`
Purpose:
- ingest HomeTax-exported files or acquired materials

Output:
- recognized document types
- parse results
- unsupported material warnings

### ledger

#### `tax.ledger.normalize`
Purpose:
- normalize imported source artifacts into canonical transactions/documents

Input:
- workspace id
- optional artifact ids
- normalization mode

Output:
- transaction/document counts
- duplicate candidates
- normalization warnings

#### `tax.ledger.list_transactions`
Purpose:
- query normalized transactions with filters

Input:
- workspace id
- date range
- direction
- review status
- limit/offset

#### `tax.ledger.link_evidence`
Purpose:
- attach evidence documents to transactions manually or semi-automatically

Input:
- transaction ids
- document ids
- link mode

### classification

#### `tax.classify.run`
Purpose:
- classify normalized records into tax-relevant categories/treatments

Input:
- workspace id
- optional subset filters
- ruleset version

Output:
- classified count
- low-confidence count
- generated review items
- summary by category

#### `tax.classify.list_review_items`
Purpose:
- list unresolved or filtered review items

Input:
- workspace id
- severity filter
- reason filter
- batched only flag

#### `tax.classify.resolve_review_item`
Purpose:
- apply a human-approved resolution to one or more review items
- for HomeTax comparison mismatch reviews, propagate the approved outcome back into the draft state

Input:
- review item ids
- selected option
- rationale
- approver identity

Output:
- resolved items
- affected draft/decision deltas
- updated review state that may unblock draft or submission readiness

Notes:
- should emit strong audit metadata
- when resolving `hometax_material_mismatch` items, runtime implementations may:
  - accept portal value into the draft,
  - keep the draft value with explicit override,
  - or mark the field for manual follow-up

### filing

#### `tax.filing.compute_draft`
Purpose:
- compute or refresh the filing draft from current normalized and resolved data
- persist a filing-state snapshot that downstream tools can reuse

Input:
- workspace id
- draft mode
- include assumptions flag

Output:
- draft id
- income/expense/deduction/withholding summaries
- warnings
- unresolved blockers
- material unknowns
- persisted readiness metadata, including:
  - `supportTier`
  - `filingPathKind`
  - `estimateReadiness`
  - `draftReadiness`
  - `submissionReadiness`
  - `comparisonSummaryState`
  - `freshnessState`
  - `majorUnknowns`
  - `blockerCodes`
  - `fieldValues`

#### `tax.filing.get_summary`
Purpose:
- retrieve a concise filing summary for user review or agent narration

Input:
- workspace id or draft id
- detail level

#### `tax.filing.export_package`
Purpose:
- produce human-reviewable export artifacts

Possible outputs:
- JSON package
- CSV review reports
- evidence index
- submission prep checklist

Notes:
- exporting to an external destination may require distinct consent depending on target

#### `tax.filing.get_summary`
Purpose:
- retrieve a human-readable filing summary for narration, chat responses, or quick operator review

Input:
- workspace id
- optional draft id
- optional detail level (`short`, `standard`)

Output:
- headline
- short summary text
- compact operator update text
- key points
- blockers
- next recommended action
- lightweight draft metrics

Formatting note:
- `operatorUpdate` should be compact and channel-friendly for operator surfaces like Discord
- prefer status-specific templates such as review-pending, collection-blocked, ready-for-assist, and submission-in-progress

Notes:
- this is the preferred narrative read model when an agent needs to explain status in plain language
- `short` should emphasize blocker + next step, while `standard` should also include draft/readiness context
- for Discord-style operator replies, agents should prefer `operatorUpdate` over rebuilding formatting from raw fields

Example integration:
- invoke `tax.filing.get_summary`
- on Discord/operator surfaces, send `operatorUpdate`
- on generic chat surfaces, use `headline + summaryText`
- facade helpers: `invokeAndFormatFilingSummaryForDiscord(...)` and `invokeAndFormatFilingSummary(..., 'generic')`
- sample usage: `examples/filing-summary-reply-example.ts`

Alerting pattern:
- keep the previous filing-summary snapshot (`status`, `blockers`, `nextRecommendedAction`, `operatorUpdate`)
- recompute a new snapshot after workflow progress
- notify only when status, blockers, or next action changed
- classify alert severity for operator routing (`high`, `medium`, `info`, `none`)
- map severity into abstract routes such as `operator-immediate`, `operator-watch`, `operator-updates`, or `drop`
- convert routes into provider-specific targets with a dispatch-plan adapter
- apply duplicate suppression / cooldown before sending (example defaults: high=10m, medium=30m, info=2h)
- persist the last delivery record in a store so dedupe can work across turns
- use a file-backed store when dedupe must survive process restarts
- for demos/tests, it is acceptable to simulate a transitioned snapshot directly from the previous snapshot
- sample usage: `examples/filing-status-alert-example.ts`, `examples/filing-alert-dispatch-example.ts`, `examples/filing-alert-dedupe-example.ts`, `examples/filing-alert-store-example.ts`, `examples/filing-alert-file-store-example.ts`

#### `tax.filing.compare_with_hometax`
Purpose:
- compare current filing draft values against visible/imported HomeTax-observed values
- update filing-field comparison state and derive submission readiness gates

Input:
- workspace id
- draft id
- comparison mode
- optional section keys

Output:
- section-level comparison results
- material mismatches
- updated field values with comparison state
- readiness summary after comparison

Notes:
- if material mismatches remain, the workflow should route to review resolution rather than straight to preparation
- runtime implementations may create `hometax_material_mismatch` review items from material mismatches

#### `tax.filing.refresh_official_data`
Purpose:
- refresh HomeTax-adjacent official data before comparison or preparation

Input:
- workspace id
- optional source ids
- refresh policy
- recompute draft flag

Output:
- refreshed sources with change summary
- recomputed / superseded draft ids when relevant
- readiness downgrade indicator
- readiness summary after refresh

Notes:
- runtime implementations may persist updated freshness state back into the draft metadata

#### `tax.filing.prepare_hometax`
Purpose:
- convert draft outputs into a HomeTax-assist-ready structure
- use persisted filing-path/readiness state to decide whether preparation is allowed

Output:
- section mapping
- required manual fields
- blocked/unsupported fields
- comparison readiness
- browser assist readiness
- refresh requirement / freshness note

Notes:
- should remain blocked when comparison is incomplete, review remains unresolved, or official-data freshness is insufficient

### browser assist

#### `tax.browser.start_hometax_assist`
Purpose:
- begin a visible, pause/resume HomeTax assistance session

Input:
- workspace id
- draft id
- mode (`guide_only`, `fill_assist`)

Output:
- assist session id
- current checkpoint
- auth required flag

#### `tax.browser.resume_hometax_assist`
Purpose:
- continue a paused assist session after auth, user action, or interruption

#### `tax.browser.stop_hometax_assist`
Purpose:
- stop the active assist session cleanly

#### `tax.browser.get_checkpoint`
Purpose:
- inspect current HomeTax progress, blockers, and pending user actions

#### `tax.workspace.get_status`
Purpose:
- retrieve the current filing workspace snapshot as a stateful progress view

Input:
- workspace id

Output:
- workspace status
- current draft id
- unresolved review count
- readiness summary
- representative blocking reason
- collection status
- next recommended action

Notes:
- this is the preferred read model for agents that need to explain current progress or decide what to do next

## Collection-specific response expectations

For source-planning and source-sync tools, the response should help the agent explain both progress and failure recovery.

Recommended fields in `data` for collection tools:
- `sourceType`
- `collectionMode` (`direct_connector`, `browser_assist`, `export_ingestion`, `fact_capture`)
- `sourceState`
- `syncAttemptState`
- `coverageImpact`
- `artifactsImported`
- `coverageGaps`
- `checkpointType`
- `checkpointId`
- `blockingReason`
- `pendingUserAction`
- `fallbackOptions[]`
- `attemptSummary`

## Consent and auth semantics

### `requiresConsent`
Set true when the requested action cannot proceed under currently recorded scope.
When true, prefer:
- `status = awaiting_consent`
- `checkpointType = source_consent`
- `blockingReason = missing_consent`

### `requiresAuth`
Set true when the user must directly complete a login/authentication step.
When true, prefer:
- `status = awaiting_auth`
- `checkpointType = authentication`
- `blockingReason = missing_auth`

### `blockingReason`
Use when the workflow must stop or pause with explanation.
Pair it with `checkpointType` and `pendingUserAction` when the action is resumable.

### Review and submission gates
When the workflow is waiting for judgment rather than login:
- use `checkpointType = review_judgment` with `blockingReason = awaiting_review_decision`
- use `checkpointType = final_submission` with `blockingReason = awaiting_final_approval`

## Recommended workflow sequence
1. `tax.setup.inspect_environment`
2. `tax.setup.init_config`
3. `tax.setup.list_connectors`
4. `tax.sources.connect` / upload imports
5. `tax.ledger.normalize`
6. `tax.profile.detect_filing_path`
7. `tax.classify.run`
8. `tax.classify.list_review_items`
9. `tax.filing.compute_draft`
10. `tax.classify.resolve_review_item` (for classification/review blockers)
11. `tax.filing.compute_draft` (recompute)
12. `tax.filing.refresh_official_data`
13. `tax.filing.compare_with_hometax`
14. if material mismatches exist: `tax.classify.list_review_items` → `tax.classify.resolve_review_item`
15. `tax.filing.prepare_hometax`
16. `tax.browser.start_hometax_assist`

Practical prototype loop:
- detect path
- classify
- compute draft
- resolve open review items
- recompute draft
- refresh official data
- compare with HomeTax
- resolve mismatch reviews if needed
- prepare HomeTax
- hand off to browser assist

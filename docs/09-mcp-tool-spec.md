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
The MCP surface should expose a compact, agent-friendly workflow layer for:
- workspace setup,
- artifact ingestion by reference,
- normalization,
- classification,
- review handling,
- draft generation,
- comparison/readiness/preparation state for HomeTax-assisted submission.

Boundary rule:
- MCP tools accept **refs and structured observations**
- MCP tools do **not** directly open local files, control browser pages, run OCR, or perform user-facing persuasion/conversation
- browser/file/OCR/user-interaction work belongs to the external AI agent and its host/runtime

The goal is not to expose every internal function, but to give the agent a reliable workflow API with clear consent and audit behavior.

## Tool design rules
- every sensitive action must surface consent state
- every mutating action should produce audit metadata
- review-item resolution must be explicit and attributable
- tool responses should be structured for agent follow-up, not prose-only
- long-running steps should support progress/pause/resume semantics
- inputs should prefer artifact refs, uploaded file refs, structured extracted payloads, and portal-observed values over host-specific paths or live-page handles

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
- optional config reference from the calling agent/runtime

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
- optional workspace label/reference
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
- ingest user-provided transaction artifacts that were already selected/uploaded by the external agent/runtime

Input:
- uploaded file refs or artifact refs
- source format hint
- workspace id

Output:
- artifact ids
- parse summary
- normalization readiness

#### `tax.import.upload_documents`
Purpose:
- ingest receipts, invoices, tax statements, and related evidence artifacts that were already uploaded or referenced by the external agent/runtime

Input:
- uploaded file refs or artifact refs
- optional document type hints
- workspace id

#### `tax.import.submit_extracted_receipt_fields`
Purpose:
- accept structured receipt/document field payloads that were extracted outside MCP

Input:
- source artifact refs
- structured extracted fields
- extraction metadata such as extractor type/version and confidence summary
- workspace id

Output:
- accepted field candidates
- normalization/review hints
- warnings when evidence or extraction metadata is insufficient

#### `tax.import.import_hometax_materials`
Purpose:
- ingest HomeTax-exported artifacts or external-agent-acquired materials

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
- optional structured extracted payloads from an external agent/runtime, including:
  - artifact/upload refs
  - extracted transactions
  - extracted evidence documents
  - extracted withholding/prepaid-tax records

Output:
- transaction/document counts
- duplicate candidates
- created/updated withholding records
- created coverage gaps for missing evidence / missing income / missing comparison
- normalization warnings
- next action should naturally route to `tax.classify.run` when usable normalized state exists, otherwise additional collection

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
- blockers (compatibility summary)
- runtime snapshot (canonical current runtime view)
- next recommended action
- lightweight draft metrics
- readiness state (canonical calculated readiness view, when available)

Formatting note:
- `operatorUpdate` should be compact and channel-friendly for operator surfaces like Discord
- prefer status-specific templates such as review-pending, collection-blocked, ready-for-assist, and submission-in-progress

Notes:
- this is the preferred narrative read model when an agent needs to explain status in plain language
- `short` should emphasize blocker + next step, while `standard` should also include draft/readiness context
- for Discord-style operator replies, agents should prefer `operatorUpdate` over rebuilding formatting from raw fields
- consumers should prefer `readinessState` for readiness/policy branching
- consumers should prefer `runtimeSnapshot` for current blocker rendering, ordered blocker context, and submission-comparison state
- `blockers` remains useful as a lightweight compatibility summary, but it should not be treated as the richest source of blocker truth
- legacy single-value fields such as `lastBlockingReason` should be treated as compatibility data, not canonical state

Example integration:
- invoke `tax.filing.get_summary`
- on Discord/operator surfaces, send `operatorUpdate`
- on generic chat surfaces, use `headline + summaryText` and optionally append `runtimeSnapshot`-derived details such as active blockers / submission comparison
- use `readinessState` for decisions such as whether to escalate review, block submission prep, or request user intervention
- migration note: existing consumers that read `blockers` / `lastBlockingReason` can keep doing so short-term, but new work should branch on `readinessState` and render blocker state from `runtimeSnapshot`
- facade helpers: `invokeAndFormatFilingSummaryForDiscord(...)` and `invokeAndFormatFilingSummary(..., 'generic')`
- sample usage: `examples/filing-summary-reply-example.ts`

Alerting pattern:
- Core MCP behavior:
  - keep the previous filing-summary snapshot (`status`, `nextRecommendedAction`, `operatorUpdate`, and preferably `runtimeSnapshot.blockerCodes` / `runtimeSnapshot.activeBlockers`)
  - recompute a new snapshot after workflow progress
  - notify only when status, blocker state, or next action changed
  - classify alert severity for operator routing (`high`, `medium`, `info`, `none`)
  - map severity into abstract routes such as `operator-immediate`, `operator-watch`, `operator-updates`, or `drop`
  - convert routes into host/runtime-selected targets with a dispatch-plan adapter
  - apply duplicate suppression / cooldown before sending (example defaults: high=10m, medium=30m, info=2h)
- Integration reference patterns (host/runtime specific, not required MCP core):
  - persist the last delivery record in a store so dedupe can work across turns
  - use a file-backed store when dedupe must survive process restarts
  - optionally aggregate `medium` / `info` dispatch plans into digest messages by target/route before sending
  - a delivery-policy helper can split `high` alerts into immediate sends while routing `medium` / `info` alerts into digest generation
  - a sender adapter can convert immediate sends and digests into provider-facing payloads (`channel`, `target`, `message`) before handing them to the runtime messenger
- for demos/tests, it is acceptable to simulate a transitioned snapshot directly from the previous snapshot
- sample usage:
  - Core: `examples/filing-status-alert-example.ts`, `examples/filing-alert-dispatch-example.ts`, `examples/filing-alert-dedupe-example.ts`
  - Integration reference: `examples/filing-alert-store-example.ts`, `examples/filing-alert-file-store-example.ts`, `examples/filing-alert-digest-example.ts`, `examples/filing-alert-delivery-policy-example.ts`, `examples/filing-alert-sender-adapter-example.ts`

#### `tax.filing.compare_with_hometax`
Purpose:
- compare current filing draft values against HomeTax-observed values supplied by the external AI agent
- update filing-field comparison state and derive submission readiness gates

Input:
- workspace id
- draft id
- comparison mode
- optional section keys
- optional `portalObservedFields[]` captured/imported outside MCP

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
- refresh official source state before comparison or preparation using already-approved source connections, artifact ingestion, or agent-supplied refresh context

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
- create a HomeTax assistance checkpoint/handoff session for an external browser-capable agent/runtime

Input:
- workspace id
- draft id
- mode (`guide_only`, `fill_assist`)

Output:
- assist session id
- current checkpoint
- auth required flag
- handoff context for the external browser-capable agent/runtime

#### `tax.browser.resume_hometax_assist`
Purpose:
- continue a paused assist session after auth, user action, or interruption
- return durable handoff context (assistSessionId, draftId, checkpoint, pending action) for an external browser-capable agent

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

## Browser host runtime bridge

The browser-assist package now exposes a host-agnostic browser runtime seam:

- `BrowserHostRuntimeClient`
- `BrowserHostRuntimeAdapter`
- `ExecutorBackedBrowserHostClient`
- `BrowserHostExecutor`
- `InMemoryBrowserHostExecutor`
- `StubBrowserHostExecutor` in `packages/mcp-server`

The contract is described in more detail in [37-browser-host-capability-contract.md](./37-browser-host-capability-contract.md).

At the MCP/tool layer, the important rule is simple:

- browser-assist session semantics stay in MCP/core,
- host/browser transport semantics stay behind the browser-host seam,
- OpenClaw is a planned first adapter implementation of that seam, not the core abstraction.

Minimum expected host methods:

- `openTarget()` maps a browser-assist session into a real host/browser open or attach call
- `getRuntimeState()` maps status reads to runtime-side tab or session inspection
- `handoffCheckpoint()` carries checkpoint context forward after authentication and page-ready transitions

## Declared vs implemented note

This spec intentionally includes some forward-looking tools.
When a tool is documented here but not yet implemented in the runtime/facade, treat it as a contract gap or backlog item rather than as an already-supported capability.
See [38-mcp-agent-boundary-and-contract-gaps.md](./38-mcp-agent-boundary-and-contract-gaps.md).

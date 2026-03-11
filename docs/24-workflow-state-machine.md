# Workflow State Machine

- Status: active
- Canonical: English
- Korean companion: [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md)
- Parent: [README.md](./README.md)
- Related:
  - [18-source-feasibility-matrix.md](./18-source-feasibility-matrix.md)
  - [19-agentic-auth-and-consent-flow.md](./19-agentic-auth-and-consent-flow.md)
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [21-first-agentic-scenario.md](./21-first-agentic-scenario.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
- Next recommended reading:
  - [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)


## Purpose
Provide a compact reference model for how the workflow moves through collection, checkpoints, review, draft generation, and HomeTax assistance.

This document does not replace the detailed state model.
Instead, it standardizes the operational vocabulary shared across:
- `17-data-collection-strategy.md`
- `19-agentic-auth-and-consent-flow.md`
- `20-workspace-state-model.md`
- `21-first-agentic-scenario.md`
- `08-hometax-submission-flow.md`

The goal is to make product docs, type design, and implementation use the same state language.

## Scope
This state machine is for the **workflow control layer**.
It describes:
- what broad phase the workspace is in,
- what source-level state exists,
- what sync run is happening now,
- what checkpoint is blocking progress,
- and what user action is required to resume.

It is not a tax calculation state machine.
It is an operational workflow state machine.

## Core modeling rule
Always separate these layers:
1. **workspace status** — broad workflow phase
2. **source state** — durable status of a source relationship
3. **sync attempt state** — runtime state of a specific collection run
4. **checkpoint type** — why the workflow is currently waiting on the user
5. **blocking reason** — structured explanation of why progress stopped
6. **pending user action** — the exact next action needed to resume

A common implementation failure is to overload one field to mean all of these.
Do not do that.

## 1. Workspace status
Workspace status answers:
> What broad phase is this filing workflow in?

Suggested statuses:
- `initialized`
- `collecting_sources`
- `normalizing`
- `review_pending`
- `draft_ready_for_review`
- `ready_for_hometax_assist`
- `submission_in_progress`
- `submitted`
- `archived`

Interpretation notes:
- workspace status should stay relatively stable and readable
- it should not flip for every short-lived interruption
- temporary blockers should usually live in sync attempts or assist sessions, not only in workspace status

## 2. Source state
Source state answers:
> What is the durable status of this source relationship?

Suggested states:
- `planned`
- `awaiting_consent`
- `awaiting_auth`
- `ready`
- `syncing`
- `paused`
- `blocked`
- `completed`
- `disabled`

Interpretation notes:
- source state is long-lived relative to a single run
- `blocked` means the source is currently not progressing without intervention or fallback
- `completed` does not mean the source can never be revisited; it means the current planned objective was satisfied

## 3. Sync attempt state
Sync attempt state answers:
> What is happening in this collection run right now?

Suggested states:
- `queued`
- `running`
- `paused`
- `awaiting_user_action`
- `blocked`
- `completed`
- `failed`

Interpretation notes:
- sync attempt state is the main place for runtime interruption semantics
- multiple sync attempts may exist over time for one source
- a source may remain `ready` even if the last sync attempt `failed`

## 4. Checkpoint types
Checkpoint type answers:
> What kind of user checkpoint is currently active?

Standard checkpoint types:
- `source_consent`
- `authentication`
- `collection_blocker`
- `review_judgment`
- `final_submission`

Definitions:
- `source_consent` — waiting for approval to access or expand a source scope
- `authentication` — waiting for login, verification, or session renewal
- `collection_blocker` — waiting for a narrow user action during collection or browser flow
- `review_judgment` — waiting for a tax-significant answer or user decision
- `final_submission` — waiting for explicit approval before external submission

Rule:
A checkpoint type should be present only when the workflow is actually waiting on the user.

## 5. Blocking reasons
Blocking reason answers:
> Why did progress stop?

Preferred reason codes:
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
- `submission_not_ready`
- `comparison_incomplete`
- `official_data_refresh_required`

Interpretation notes:
- blocking reason is diagnostic
- checkpoint type is interactional
- pending user action is instructional

Example:
- `checkpointType = authentication`
- `blockingReason = missing_auth`
- `pendingUserAction = "Log in to HomeTax and return to the materials page."`

## 6. Pending user action
Pending user action answers:
> What exactly should the user do next?

Good pending user actions are:
- concrete,
- narrow,
- resumable,
- and phrased in operational language.

Good examples:
- "Approve HomeTax access for the 2025 filing workspace."
- "Log in to HomeTax and complete identity verification."
- "Click the export button for the card statement, then return control to the agent."
- "Choose whether this expense was personal, business, or mixed-use."
- "Review the final summary and explicitly approve submission."

Bad examples:
- "Do the required steps."
- "Fix the source."
- "Upload anything helpful."

## 7. Canonical transition shape
A typical happy-path flow should look like this:

1. workspace `initialized`
2. workspace `collecting_sources`
3. source `planned`
4. source `awaiting_consent`
5. checkpoint `source_consent`
6. source `awaiting_auth`
7. checkpoint `authentication`
8. source `ready`
9. sync attempt `running`
10. artifacts imported
11. workspace `normalizing`
12. coverage gaps and review items generated
13. workspace `review_pending` or `draft_ready_for_review`
14. workspace `ready_for_hometax_assist`
15. assist session starts
16. checkpoint `final_submission`
17. workspace `submission_in_progress`
18. workspace `submitted`

This flow is illustrative, not mandatory.
The system must also support partial success and repeated loops.

## 8. Readiness layer
Broad workflow state is not enough by itself.
The system should also track at least:
- `estimate-ready`
- `draft-ready`
- `submission-assist-ready`

Two workspaces may both be in `draft_ready_for_review`, while one is almost ready for HomeTax assistance and the other still has material coverage gaps or comparison blockers.

## 9. Partial-progress rules
The system must handle these cases cleanly:

### Case A. One source blocked, others continue
Example:
- HomeTax completed
- card export blocked
- local folder ingestion still available

Implication:
- do not collapse the entire workspace into a generic failed state
- keep source-level and sync-level blockage local where possible

### Case B. Draft exists before all sources are complete
Example:
- first draft computed from HomeTax + local evidence
- bank export arrives later

Implication:
- allow draft recomputation without resetting the workflow from scratch
- preserve prior draft versions and explain deltas

### Case C. HomeTax assist starts after review, then gets interrupted
Example:
- user authenticated
- section navigation started
- browser session closed

Implication:
- preserve assist session state separately from collection state
- resume from checkpoint and last known section when possible

## 10. Collection and assist are related but distinct
The product has two adjacent operational loops:

### Loop A. Collection loop
- plan source
- get consent
- complete auth
- run sync
- ingest artifacts
- normalize
- identify gaps

### Loop B. Assist loop
- confirm draft readiness
- start HomeTax assist session
- complete auth if needed
- navigate sections
- fill or guide fields
- pause on mismatches or manual confirmations
- request final submission approval

Design rule:
Do not force HomeTax assist semantics into generic collection state if a dedicated assist session model is clearer.

## 10. Mapping guide for implementation
If the workflow is waiting on the user, the implementation should usually be able to answer all of these at once:
- `workspace.status`
- current `source.state` or `assistSession.checkpointType`
- current `syncAttempt.state` if a collection run is active
- `checkpointType`
- `blockingReason`
- `pendingUserAction`

If one of these is missing, pause/resume UX will usually become ambiguous.

## 11. Canonical examples

### Example 1. Waiting for HomeTax login
- `workspace.status = collecting_sources`
- `source.state = awaiting_auth`
- `syncAttempt.state = awaiting_user_action`
- `checkpointType = authentication`
- `blockingReason = missing_auth`
- `pendingUserAction = Log in to HomeTax and complete identity verification.`

### Example 2. Waiting for a card-statement export click
- `workspace.status = collecting_sources`
- `source.state = syncing`
- `syncAttempt.state = awaiting_user_action`
- `checkpointType = collection_blocker`
- `blockingReason = export_required`
- `pendingUserAction = Export the statement for the target period, then return control to the agent.`

### Example 3. Waiting for a tax judgment call
- `workspace.status = review_pending`
- `checkpointType = review_judgment`
- `blockingReason = awaiting_review_decision`
- `pendingUserAction = Choose whether the expense should be treated as business, personal, or mixed-use.`

### Example 4. Waiting for final submission approval
- `workspace.status = ready_for_hometax_assist` or `submission_in_progress`
- `assistSession.checkpointType = final_submission`
- `blockingReason = awaiting_final_approval`
- `pendingUserAction = Review the final filing summary and explicitly approve submission.`

## 12. Product test
The state machine is doing its job if the system can always explain:
- what phase the workflow is in,
- what source or assist step is active,
- why it is blocked,
- what the user needs to do next,
- and what will happen after the user does it.

If the system cannot explain those five things, the workflow is not agentic enough yet.

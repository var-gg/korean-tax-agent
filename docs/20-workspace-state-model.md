# Workspace State Model

- Status: active
- Canonical: English
- Korean companion: ./20-workspace-state-model.ko.md
- Parent: ./README.md
- Related:
  - ./19-agentic-auth-and-consent-flow.md
  - ./21-first-agentic-scenario.md
  - ./24-workflow-state-machine.md
- Next recommended reading:
  - ./22-core-type-gap-analysis.md
  - ./09-mcp-tool-spec.md


## Objective
Define the minimum persistent state needed for an agentic, checkpoint-driven tax filing workflow.

The workspace should represent more than imported files.
It should preserve the evolving operational state of collection, review, draft generation, and submission assistance so the agent can pause and resume without losing context.

## Design goals
- make collection progress durable
- preserve consent and auth boundaries explicitly
- support partial success across multiple sources
- track what is missing, blocked, or unresolved
- produce auditable state transitions
- remain simple enough for an early open-source implementation

## Workspace identity
A workspace represents one taxpayer filing context for one filing year.

Minimum fields:
- `workspaceId`
- `filingYear`
- `taxpayerProfileRef`
- `status`
- `createdAt`
- `updatedAt`

Suggested status values:
- `initialized`
- `collecting_sources`
- `normalizing`
- `review_pending`
- `draft_ready_for_review`
- `ready_for_hometax_assist`
- `submission_in_progress`
- `submitted`
- `archived`

## Core state areas

### 1. Taxpayer profile state
Purpose:
- hold structured facts that shape filing logic and source planning

Examples:
- taxpayer type hint
- residency or filing context
- business categories
- known deduction-relevant profile facts
- unsupported edge-case notes

Why it matters:
- the agent should not repeatedly ask for the same core facts
- source planning depends on user profile context

### 2. Source registry
Purpose:
- represent all known source connections or attempted source connections

Minimum fields per source:
- `sourceId`
- `workspaceId`
- `sourceType`
- `sourceLabel`
- `collectionMode`
- `state`
- `scopeGranted`
- `lastSyncAt`
- `lastSuccessfulSyncAt`
- `lastBlockingReason`
- `createdAt`
- `updatedAt`

Suggested source states:
- `planned`
- `awaiting_consent`
- `awaiting_auth`
- `ready`
- `syncing`
- `paused`
- `blocked`
- `completed`
- `disabled`

Interpretation note:
- source state answers: what is the durable status of this source relationship?
- sync attempt state answers: what is happening in the current or latest collection run?
- do not overload source state to represent every short-lived runtime event.

Why it matters:
- the agent needs a durable picture of what sources exist, what was attempted, and what remains useful

### 3. Consent records
Purpose:
- record meaningful approval events separately from auth state

Minimum fields:
- `consentId`
- `workspaceId`
- `consentType`
- `scope`
- `status`
- `grantedBy`
- `grantedAt`
- `revokedAt`
- `note`

Why it matters:
- source re-use and repeated syncs depend on remembered scope
- final submission must not be conflated with earlier source approval

### 4. Auth checkpoints
Purpose:
- model user identity steps that gate progress but are not durable blanket permission

Minimum fields:
- `authCheckpointId`
- `workspaceId`
- `sourceId`
- `provider`
- `authMethod`
- `state`
- `startedAt`
- `completedAt`
- `expiresAt`
- `sessionBinding`

Suggested auth states:
- `pending`
- `in_progress`
- `completed`
- `expired`
- `failed`

Why it matters:
- an agentic product must know whether it is waiting for a login, has a usable session, or needs re-auth

### 5. Sync attempts
Purpose:
- record each collection run or refresh attempt against a source

Minimum fields:
- `syncAttemptId`
- `workspaceId`
- `sourceId`
- `mode`
- `state`
- `startedAt`
- `endedAt`
- `checkpointType`
- `checkpointId`
- `blockingReason`
- `pendingUserAction`
- `attemptSummary`
- `fallbackOptions[]`

Suggested sync states:
- `queued`
- `running`
- `paused`
- `awaiting_user_action`
- `blocked`
- `completed`
- `failed`

Suggested checkpoint types for active interruptions:
- `source_consent`
- `authentication`
- `collection_blocker`
- `review_judgment`
- `final_submission`

Why it matters:
- this is the operational backbone for pause/resume behavior and honest recovery handling

### 6. Imported artifacts
Purpose:
- track raw materials collected from sources before or alongside normalization

Artifact examples:
- CSV files
- downloaded statements
- PDF tax documents
- receipt images
- extracted HTML snapshots
- browser-collected document bundles

Minimum fields:
- `artifactId`
- `workspaceId`
- `sourceId`
- `artifactType`
- `contentRef`
- `contentHash`
- `capturedAt`
- `ingestedAt`
- `parseState`
- `parseSummary`
- `duplicateCandidateOf`

Why it matters:
- imported data should remain traceable back to the exact collected material

### 7. Normalized ledger state
Purpose:
- represent canonical transactions and documents used by downstream classification and draft computation

Core areas:
- transactions
- normalized documents
- evidence links
- duplicate groups
- reconciliation markers

Why it matters:
- downstream logic should rely on normalized, stable entities rather than source-specific raw formats

### 8. Coverage gaps
Purpose:
- explicitly represent what is still missing from the workspace

Examples:
- expected bank history not yet collected
- expense evidence missing for important deductions
- withholding evidence absent
- taxpayer fact missing for a tax treatment decision

Minimum fields:
- `gapId`
- `workspaceId`
- `gapType`
- `severity`
- `description`
- `affectedArea`
- `recommendedNextAction`
- `relatedSourceIds[]`
- `state`

Suggested gap states:
- `open`
- `deferred`
- `resolved`
- `accepted_with_risk`

Why it matters:
- missing data is itself part of the filing state, not an invisible absence

### 9. Review queue state
Purpose:
- hold unresolved judgment calls and high-impact ambiguities

Minimum fields per item:
- `reviewItemId`
- `workspaceId`
- `reasonCode`
- `severity`
- `linkedEntityIds[]`
- `candidateOptions[]`
- `suggestedOption`
- `resolutionState`
- `resolvedAt`
- `resolvedBy`

Why it matters:
- review is how the product stays agentic without becoming reckless

### 10. Draft versions
Purpose:
- preserve filing draft outputs across repeated collection and review cycles

Minimum fields:
- `draftId`
- `workspaceId`
- `draftVersion`
- `status`
- `incomeSummary`
- `expenseSummary`
- `deductionsSummary`
- `withholdingSummary`
- `assumptions[]`
- `warnings[]`
- `computedAt`
- `computationTraceRef`

Why it matters:
- the agent needs to compare current and prior drafts, explain changes, and avoid confusing users after new data arrives

### 11. Browser assist sessions
Purpose:
- represent HomeTax or similar assisted web sessions independently of draft state

Minimum fields:
- `assistSessionId`
- `workspaceId`
- `draftId`
- `provider`
- `checkpointType`
- `authState`
- `pendingUserAction`
- `lastKnownSection`
- `startedAt`
- `updatedAt`
- `endedAt`

Why it matters:
- submission assistance must survive interruption and resume clearly

### 12. Audit events
Purpose:
- record meaningful workflow transitions and decisions

Examples:
- source connected
- sync blocked
- artifact imported
- classification run
- review resolved
- draft computed
- final submission approved

Minimum fields:
- `eventId`
- `workspaceId`
- `eventType`
- `actorType`
- `actorRef`
- `entityRefs[]`
- `summary`
- `createdAt`
- `metadata`

Why it matters:
- open-source trust requires the system to explain what happened, not merely output a result

## State relationship model
A simplified mental model:
- one workspace has many sources
- one source has many auth checkpoints and sync attempts
- one sync attempt may produce many artifacts
- many artifacts normalize into ledger entities
- ledger entities may produce review items and draft deltas
- review resolutions may supersede prior classification decisions
- one workspace may have many draft versions and many audit events

## State transition expectations
The system should be able to move through this shape repeatedly:
1. workspace initialized
2. source planned
3. consent granted
4. auth completed
5. sync attempt runs
6. artifacts imported
7. normalization updates ledger
8. coverage gaps and review items generated
9. draft recomputed
10. HomeTax assist session started
11. final approval recorded

The model must also support partial cycles such as:
- a source remains blocked while others continue
- a new source is added after an initial draft already exists
- draft version 3 supersedes draft version 2 after extra evidence arrives

## Recommended implementation posture
For v1, keep the state model explicit even if storage starts simple.
A file-backed or lightweight local database implementation is acceptable as long as these entities can be represented cleanly.

## Product test
If the agent cannot answer these questions from state alone, the model is incomplete:
- what sources were attempted and what happened
- what user step is blocking progress right now
- what material is still missing
- what changed between the last draft and this one
- what approvals and overrides were made by whom

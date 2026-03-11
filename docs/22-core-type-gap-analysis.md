# Core Type Gap Analysis

- Status: active
- Canonical: English
- Korean companion: [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md)
- Parent: [README.md](./README.md)
- Related:
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)
- Next recommended reading:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [25-korean-comprehensive-income-tax-data-research.md](./25-korean-comprehensive-income-tax-data-research.md)


## Objective
Compare the current `packages/core/src/types.ts` model against the intended product and workflow state described in the docs.

This document is not a criticism of the current code.
It is a map of what already exists, what is under-specified, and what must be added before the implementation can fully support the agentic collection model.

## Current strengths
The current core types already cover important downstream workflow entities:
- taxpayer profile
- filing workspace
- source connection
- source artifact
- ledger transaction
- evidence document
- classification decision
- review item
- filing draft
- audit event
- consent record
- browser assist session

This is a strong start.
The model is already sufficient for:
- normalization outputs
- classification outputs
- review queue generation
- draft computation
- basic consent recording
- basic HomeTax assist session tracking

## Main gap summary
The current types are still optimized for:
- imported data
- classification
- review
- draft generation

They are not yet fully optimized for:
- source planning
- resumable collection workflows
- explicit auth lifecycle tracking
- sync attempt history
- coverage-gap modeling
- richer audit traceability

In short:
**the downstream tax workflow is modeled better than the upstream collection workflow.**

## Entity-by-entity gap analysis

### 1. FilingWorkspace
Current type:
- present
- useful for basic draft lifecycle

Current limitations:
- status values reflect older flow stages (`setup`, `collecting`, `reviewing`, `draft_ready`, `submission_ready`)
- does not reflect the newer agentic state language from `20-workspace-state-model.md`
- no explicit reference to taxpayer profile via `taxpayerProfileRef`
- no explicit coverage-gap count or blocked-state summary

Recommended changes:
- align status enum with the state-model doc or define a compatibility mapping
- consider adding:
  - `taxpayerProfileRef` or keep `taxpayerId` and document the relationship clearly
  - `openCoverageGapCount`
  - `lastBlockingReason`
  - `lastCollectionStatus`

Priority:
- **high**

### 2. SourceConnection
Current type:
- present
- enough for primitive connection tracking

Current limitations:
- `consentState` and `connectionStatus` are loose strings
- no `collectionMode`
- no `sourceLabel`
- no `lastSuccessfulSyncAt`
- no `lastBlockingReason`
- no created/updated timestamps

Why this matters:
- source connection state is central to the agentic workflow
- stringly typed status fields will become brittle quickly

Recommended changes:
- add typed enums for:
  - source state
  - collection mode
- add fields:
  - `sourceLabel`
  - `collectionMode`
  - `state`
  - `lastSuccessfulSyncAt`
  - `lastBlockingReason`
  - `createdAt`
  - `updatedAt`

Priority:
- **very high**

### 3. ConsentRecord
Current type:
- present
- already fairly solid

Current limitations:
- no explicit `workspaceId`
- scope is flexible but could use stronger conventions in implementation

Why this matters:
- the workflow is workspace-centered
- consent reuse and audit review become easier when consent is directly attached to a workspace

Recommended changes:
- add `workspaceId`
- optionally add `sourceId` for source-specific scope traceability

Priority:
- **high**

### 4. Auth checkpoint modeling
Current type:
- missing as a first-class type

Current limitations:
- auth state appears only indirectly in `BrowserAssistSession`
- no general-purpose model for source login checkpoints
- cannot cleanly represent auth expiry or step-up re-auth outside browser assist

Recommended new entity:
- `AuthCheckpoint`

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

Priority:
- **very high**

### 5. Sync attempt modeling
Current type:
- missing as a first-class type

Current limitations:
- cannot represent a resumable collection attempt separately from the source itself
- no durable place for `blockingReason`, `checkpointId`, `fallbackOptions`, or `attemptSummary`

Recommended new entity:
- `SyncAttempt`

Minimum fields:
- `syncAttemptId`
- `workspaceId`
- `sourceId`
- `mode`
- `state`
- `startedAt`
- `endedAt`
- `checkpointId`
- `blockingReason`
- `attemptSummary`
- `fallbackOptions[]`

Priority:
- **very high**

### 6. SourceArtifact
Current type:
- present
- good baseline for raw artifacts

Current limitations:
- no `workspaceId`
- naming differs from state-model doc (`storageRef` vs `contentRef`, `checksum` vs `contentHash`)
- parse states are loose strings
- no explicit `ingestedAt`
- no `parseSummary`
- no `duplicateCandidateOf`

Recommended changes:
- add `workspaceId`
- either rename fields or document aliases
- add typed parse state enum
- add `ingestedAt`, `parseSummary`, `duplicateCandidateOf`

Priority:
- **high**

### 7. Coverage gaps
Current type:
- missing as a first-class type

Current limitations:
- missing evidence is currently represented only as review items
- broader collection incompleteness has no durable entity

Why this matters:
- review items are not the same as collection gaps
- the system needs to say not just "this looks ambiguous" but also "this expected source or fact is still missing"

Recommended new entity:
- `CoverageGap`

Priority:
- **very high**

### 8. LedgerTransaction
Current type:
- present
- good enough for current draft/review logic

Current limitations:
- no reconciliation markers beyond `duplicateGroupId`
- `reviewStatus` is a loose string
- no direct lineage helper fields for repeated normalization versions

Recommended changes:
- type `reviewStatus`
- optionally add reconciliation metadata later

Priority:
- **medium**

### 9. EvidenceDocument
Current type:
- present
- good enough for v1 baseline

Current limitations:
- `extractionStatus` is a loose string
- no structured parser trace or evidence confidence summary

Recommended changes:
- type `extractionStatus`
- optionally add extraction trace metadata later

Priority:
- **medium**

### 10. ClassificationDecision
Current type:
- present
- strong baseline for override layering

Current limitations:
- no explicit link to ruleset version or computation run id beyond free-form refs
- likely acceptable for now

Priority:
- **low to medium**

### 11. ReviewItem
Current type:
- present
- maps well to current review queue logic

Current limitations:
- currently mixes some collection failures and tax judgment issues only indirectly
- may eventually need a clearer distinction between:
  - tax-judgment review items
  - collection-recovery review items

Priority:
- **medium**

### 12. FilingDraft
Current type:
- present
- already works well with the current core logic

Current limitations:
- no explicit diff/change summary versus prior draft
- likely acceptable for v1

Priority:
- **low**

### 13. BrowserAssistSession
Current type:
- present
- useful baseline

Current limitations:
- no `provider`
- no `endedAt`
- `authState` and `checkpoint` are loose strings

Recommended changes:
- add `provider`
- add `endedAt`
- type `checkpoint` and `authState`

Priority:
- **high**

### 14. AuditEvent
Current type:
- present

Current limitations:
- current event list is too narrow for collection-heavy workflows
- naming differs from docs (`auditEventId` vs `eventId`, `targetRefs` vs `entityRefs`)
- missing explicit summary/message field

Recommended changes:
- expand `AuditEventType`
  - add events like `source_planned`, `sync_started`, `sync_blocked`, `artifact_parsed`, `coverage_gap_created`
- add `summary`
- either rename fields or document aliases

Priority:
- **high**

## MCP contract alignment gaps
The docs now describe richer MCP semantics than `packages/mcp-server/src/contracts.ts` currently encodes.

### Missing or under-modeled in contracts
- `status`
- `checkpointType`
- broader `blockingReason` enum
- `pendingUserAction`
- `fallbackOptions`
- `progress`
- `checkpointId`
- resume token / resumable session handle
- source-level vs sync-level collection state fields
- source-planning tools
- collection-status tools
- resume-sync tool contract

This means the docs and contracts are currently ahead of the code, which is acceptable for this stage, but the gap should be closed deliberately.

## Recommended implementation order

### Phase A. High-priority type additions
1. add `AuthCheckpoint`
2. add `SyncAttempt`
3. add `CoverageGap`
4. strengthen `SourceConnection`
5. add `workspaceId` to `ConsentRecord` and `SourceArtifact`

### Phase B. Enum tightening
1. replace loose source/status/auth strings with typed enums
2. align workspace status naming with the newer workflow docs
3. tighten browser assist and artifact parse states

### Phase C. MCP contract alignment
1. update response envelope
2. add `checkpointType`, `pendingUserAction`, and resumable response semantics
3. add source-planning and resume-sync contracts
4. add progress/blocking/fallback fields
5. distinguish source-level state from sync-attempt state in collection responses

## Bottom line
The current core model is a solid base for tax classification and draft generation.
The next step is not to rewrite it.
The next step is to extend it so the **collection lifecycle becomes as first-class as the tax computation lifecycle**.

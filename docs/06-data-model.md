# Data Model

## Goals
The canonical data model should:
- normalize mixed input sources into a shared representation,
- separate raw source facts from inferred tax treatment,
- preserve traceability from draft outputs back to source evidence,
- support review and override workflows without mutating raw history,
- preserve source-planning, sync, and checkpoint state for agentic collection,
- allow the workflow to pause and resume without reconstructing state from chat.

## Modeling rules

1. **Raw source data is immutable**
   - Original imported facts should remain recoverable.

2. **Classification is layered on top of source facts**
   - Tax interpretation should be versionable and reviewable.

3. **Evidence linkage is first-class**
   - Transactions, documents, and draft outputs should be traceable.

4. **Draft outputs are derived artifacts**
   - Filing summaries should be reproducible from source + rules + overrides.

5. **Collection state is first-class**
   - Source connection progress, auth checkpoints, sync attempts, and coverage gaps are durable workflow state, not temporary UI details.

6. **Missing data must be modelable**
   - The system should be able to represent not just what it knows, but what it expected and could not yet collect.

## Canonical entities

### TaxpayerProfile
Represents the filing subject and filing posture.

Fields:
- taxpayerId
- filingYear
- taxpayerType
  - examples: `sole_proprietor`, `freelancer`, `mixed_income_individual`, `other`
- residencyStatus
- businessRegistrationStatus
- industryHint
- deductionMetadata
- withholdingMetadata
- identifiers
  - protected storage only

### FilingWorkspace
Represents one working filing context.

Fields:
- workspaceId
- taxpayerId
- filingYear
- status
  - preferred examples: `initialized`, `collecting_sources`, `normalizing`, `review_pending`, `draft_ready_for_review`, `ready_for_hometax_assist`, `submission_in_progress`, `submitted`, `archived`
- createdAt
- updatedAt
- currentDraftId
- unresolvedReviewCount
- openCoverageGapCount
- lastBlockingReason
- notes

### SourceConnection
Represents a connector or import origin.

Fields:
- sourceId
- workspaceId
- sourceType
  - examples: `hometax`, `bank_csv`, `card_csv`, `receipt_upload`, `email`, `drive`, `manual`
- sourceLabel
- collectionMode
  - `direct_connector`, `browser_assist`, `export_ingestion`, `fact_capture`
- state
  - `planned`, `awaiting_consent`, `awaiting_auth`, `ready`, `syncing`, `paused`, `blocked`, `completed`, `disabled`
- authMethod
- scopeGranted
- lastSyncAt
- lastSuccessfulSyncAt
- lastBlockingReason
- createdAt
- updatedAt
- metadata

### ConsentRecord
Represents a durable approval record.

Fields:
- consentId
- workspaceId
- sourceId (optional)
- consentType
  - `source_access`, `auth_step`, `review_override`, `final_submission`
- scope
- status
  - `granted`, `revoked`, `expired`, `superseded`
- grantedBy
- grantedAt
- revokedAt
- expiresAt
- note

### AuthCheckpoint
Represents a user authentication step that gates collection or browser assistance.

Fields:
- authCheckpointId
- workspaceId
- sourceId
- provider
- authMethod
- state
  - `pending`, `in_progress`, `completed`, `expired`, `failed`
- startedAt
- completedAt
- expiresAt
- sessionBinding

### SyncAttempt
Represents one source collection or refresh attempt.

Fields:
- syncAttemptId
- workspaceId
- sourceId
- mode
  - `incremental`, `full`
- state
  - `queued`, `running`, `paused`, `awaiting_user_action`, `blocked`, `completed`, `failed`
- startedAt
- endedAt
- checkpointId
- blockingReason
  - examples: `missing_auth`, `user_action_required`, `ui_changed`, `blocked_by_provider`, `export_required`, `insufficient_metadata`
- attemptSummary
- fallbackOptions[]

### SourceArtifact
Represents an imported raw file, export, page snapshot, or parsed source payload.

Fields:
- artifactId
- workspaceId
- sourceId
- artifactType
  - `csv`, `pdf`, `image`, `json`, `html_snapshot`, `manual_entry`
- capturedAt
- ingestedAt
- contentHash
- contentRef
- parseState
- parseSummary
- parseError
- duplicateCandidateOf
- provenance

### LedgerTransaction
Represents a normalized transaction-like financial event.

Fields:
- transactionId
- workspaceId
- sourceId
- artifactId
- occurredAt
- postedAt
- amount
- currency
- normalizedDirection
  - `income`, `expense`, `transfer`, `unknown`
- counterparty
- description
- rawCategory
- sourceReference
- evidenceRefs[]
- duplicateGroupId
- reviewStatus
- createdAt

### EvidenceDocument
Represents a tax-relevant file or extracted document.

Fields:
- documentId
- workspaceId
- sourceId
- artifactId
- documentType
  - `receipt`, `invoice`, `tax_statement`, `withholding_doc`, `hometax_export`, `other`
- issuedAt
- issuer
- amount
- currency
- fileRef
- extractionStatus
- extractedFields
- linkedTransactionIds[]

### CoverageGap
Represents missing or incomplete filing-relevant coverage.

Fields:
- gapId
- workspaceId
- gapType
- severity
- description
- affectedArea
- recommendedNextAction
- relatedSourceIds[]
- state
  - `open`, `deferred`, `resolved`, `accepted_with_risk`

Examples:
- expected bank history not collected
- important expense lacks evidence
- withholding material missing
- taxpayer fact still missing

### ClassificationDecision
Represents an automated or human-reviewed classification layer.

Fields:
- decisionId
- entityType
  - `transaction`, `document`, `draft_line`
- entityId
- candidateCategory
- candidateTaxTreatment
- confidence
- ruleRefs[]
- modelRefs[]
- explanation
- decidedBy
  - `system`, `user`, `advisor`
- decisionMode
  - `auto`, `suggested`, `approved_override`, `manual`
- supersedesDecisionId
- createdAt

### ReviewItem
Represents a question or ambiguity requiring explicit resolution.

Fields:
- reviewItemId
- workspaceId
- reasonCode
  - examples: `low_confidence`, `mixed_use_expense`, `duplicate_conflict`, `missing_evidence`, `high_amount_outlier`
- severity
  - `low`, `medium`, `high`, `critical`
- question
- candidateOptions[]
- suggestedOption
- linkedEntityIds[]
- impactEstimate
- resolutionState
  - `open`, `batched`, `resolved`, `dismissed`
- resolvedBy
- resolvedAt
- resolutionNote

### FilingDraft
Represents a draft tax output state.

Fields:
- draftId
- workspaceId
- filingYear
- draftVersion
- status
  - `drafting`, `ready_for_review`, `ready_for_submission`, `submitted`, `superseded`
- incomeSummary
- expenseSummary
- deductionsSummary
- withholdingSummary
- assumptions[]
- warnings[]
- computedAt
- computationTraceRef

### BrowserAssistSession
Represents a resumable assisted web session.

Fields:
- assistSessionId
- workspaceId
- draftId
- provider
- checkpoint
- authState
- pendingUserAction
- lastKnownSection
- startedAt
- updatedAt
- endedAt

### AuditEvent
Represents a durable activity log for traceability.

Fields:
- eventId
- workspaceId
- eventType
  - examples: `source_planned`, `source_connected`, `sync_started`, `sync_blocked`, `import_completed`, `artifact_parsed`, `coverage_gap_created`, `classification_run`, `review_resolved`, `draft_computed`, `browser_assist_started`, `submission_approved`, `submission_attempted`
- actorType
  - `system`, `user`, `agent`
- actorRef
- entityRefs[]
- summary
- metadata
- createdAt

## Relationship summary
- `TaxpayerProfile` 1 -> many `FilingWorkspace`
- `FilingWorkspace` 1 -> many `SourceConnection`
- `SourceConnection` 1 -> many `AuthCheckpoint`
- `SourceConnection` 1 -> many `SyncAttempt`
- `SourceConnection` 1 -> many `SourceArtifact`
- `SyncAttempt` 1 -> many `SourceArtifact`
- `SourceArtifact` 1 -> many `LedgerTransaction` / `EvidenceDocument`
- `FilingWorkspace` 1 -> many `CoverageGap`
- `LedgerTransaction` / `EvidenceDocument` -> many `ClassificationDecision`
- `FilingWorkspace` 1 -> many `ReviewItem`
- `FilingWorkspace` 1 -> many `FilingDraft`
- `FilingWorkspace` 1 -> many `BrowserAssistSession`
- all major mutations -> many `AuditEvent`

## Practical modeling note
The v1 implementation does not need a perfect relational system on day one.
However, the shape above should be preserved even in file-backed or lightweight storage so the workflow can answer:
- what sources were attempted
- what user checkpoint is pending
- what data is still missing
- what changed after a new sync or review resolution
- what the agent should do next

## Alignment note
See also:
- `docs/20-workspace-state-model.md`
- `docs/21-first-agentic-scenario.md`
- `docs/22-core-type-gap-analysis.md`

## v1 boundary note
This schema is deliberately generic enough to support multiple taxpayer subtypes later, while keeping v1 oriented around practical filing workflows for agent-capable Korean comprehensive income tax filers.

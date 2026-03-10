# Data Model

## Goals
The canonical data model should:
- normalize mixed input sources into a shared representation,
- separate raw source facts from inferred tax treatment,
- preserve traceability from draft outputs back to source evidence,
- support review and override workflows without mutating raw history.

## Modeling rules

1. **Raw source data is immutable**
   - Original imported facts should remain recoverable.

2. **Classification is layered on top of source facts**
   - Tax interpretation should be versionable and reviewable.

3. **Evidence linkage is first-class**
   - Transactions, documents, and draft outputs should be traceable.

4. **Draft outputs are derived artifacts**
   - Filing summaries should be reproducible from source + rules + overrides.

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
  - `setup`, `collecting`, `reviewing`, `draft_ready`, `submission_ready`, `submitted`, `archived`
- createdAt
- updatedAt
- currentDraftId
- unresolvedReviewCount
- notes

### SourceConnection
Represents a connector or import origin.

Fields:
- sourceId
- workspaceId
- sourceType
  - examples: `hometax`, `bank_csv`, `card_csv`, `receipt_upload`, `email`, `drive`, `manual`
- authMethod
- consentState
- scopeGranted
- lastSyncAt
- connectionStatus
- metadata

### SourceArtifact
Represents an imported raw file, export, page snapshot, or parsed source payload.

Fields:
- artifactId
- sourceId
- artifactType
  - `csv`, `pdf`, `image`, `json`, `html_snapshot`, `manual_entry`
- acquiredAt
- checksum
- storageRef
- parseStatus
- parseError
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

### AuditEvent
Represents a durable activity log for traceability.

Fields:
- auditEventId
- workspaceId
- eventType
  - `source_connected`, `import_completed`, `classification_run`, `review_resolved`, `draft_computed`, `browser_assist_started`, `submission_approved`, `submission_attempted`
- actorType
  - `system`, `user`, `agent`
- actorId
- targetRefs[]
- metadata
- occurredAt

## Relationship summary
- `TaxpayerProfile` 1 -> many `FilingWorkspace`
- `FilingWorkspace` 1 -> many `SourceConnection`
- `SourceConnection` 1 -> many `SourceArtifact`
- `SourceArtifact` 1 -> many `LedgerTransaction` / `EvidenceDocument`
- `LedgerTransaction` / `EvidenceDocument` -> many `ClassificationDecision`
- `FilingWorkspace` 1 -> many `ReviewItem`
- `FilingWorkspace` 1 -> many `FilingDraft`
- all major mutations -> many `AuditEvent`

## v1 boundary note
This schema is deliberately generic enough to support multiple taxpayer subtypes later, while keeping v1 oriented around practical filing workflows for agent-capable Korean comprehensive income tax filers.

# Data Model

## Canonical entities

### TaxpayerProfile
- filingYear
- taxpayerType
- residencyStatus
- businessRegistrationStatus
- identifiers (stored with strict protection rules)
- deductionMetadata

### SourceConnection
- sourceId
- sourceType
- authMethod
- consentState
- lastSyncAt
- scopeGranted

### LedgerTransaction
- transactionId
- sourceId
- occurredAt
- amount
- currency
- counterparty
- description
- rawCategory
- normalizedDirection
- evidenceRefs[]
- classificationCandidate
- confidence
- reviewStatus

### EvidenceDocument
- documentId
- sourceId
- documentType
- issuedAt
- amount
- fileRef
- extractionStatus
- linkedTransactionIds[]

### ReviewItem
- reviewItemId
- reasonCode
- severity
- question
- candidateOptions[]
- linkedEntityIds[]
- resolutionState
- resolvedBy
- resolvedAt

### FilingDraft
- filingYear
- incomeSummary
- expenseSummary
- deductionsSummary
- withholdingSummary
- assumptions[]
- warnings[]
- status

## Notes
This schema is deliberately generic enough to support multiple taxpayer subtypes later, while keeping v1 oriented around practical filing workflows.

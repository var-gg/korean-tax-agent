# 데이터 모델

- 상태: companion
- Doc role: companion
- Locale: ko
- 기준 원문: [06-data-model.md](./06-data-model.md) (EN)
- 상위 문서: [README.ko.md](./README.ko.md)
- 관련 문서:
  - [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
  - [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
  - [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md)
- 다음 읽기:
  - [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
  - [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md)

## 목적
canonical data model은 서로 다른 입력 source를 하나의 공통 표현으로 정리하고,
raw fact와 세무 해석, review 결과, draft 산출물을 분리해서 다루기 위한 기반입니다.

또한 이 모델은 단순 데이터 저장용이 아니라,
agentic workflow가 pause / resume될 때도 현재 상태를 잃지 않도록 만드는 역할을 합니다.

## 목표
이 데이터 모델은 다음을 만족해야 합니다.

- 여러 입력 source를 shared representation으로 정규화한다.
- raw source fact와 inferred tax treatment를 분리한다.
- draft output이 어떤 evidence에서 나왔는지 traceability를 유지한다.
- raw history를 훼손하지 않고 review / override workflow를 지원한다.
- source planning, sync, checkpoint 상태를 durable하게 보존한다.
- chat 맥락이 끊겨도 workflow를 다시 이어갈 수 있게 한다.

## 모델링 규칙

### 1. Raw source data는 immutable해야 한다
- 원본 imported fact는 나중에 다시 복원 가능해야 합니다.
- 사람이 분류를 바꾸더라도 raw history 자체는 덮어쓰지 않습니다.

### 2. Classification은 source fact 위에 layering된다
- 세무 해석은 versioning과 review가 가능해야 합니다.
- “원본”과 “판단”을 같은 레코드에 섞어두면 auditability가 약해집니다.

### 3. Evidence linkage는 first-class다
- 거래, 문서, draft 결과는 source evidence까지 추적 가능해야 합니다.
- 나중에 왜 그런 계산이 나왔는지 설명할 수 있어야 합니다.

### 4. Draft output은 derived artifact다
- 신고용 summary는 source + rules + override에서 재현 가능해야 합니다.
- 최종 숫자만 저장하고 계산 근거를 잃어버리면 안 됩니다.

### 5. Collection state는 first-class다
- source connection progress, auth checkpoint, sync attempt, coverage gap은
  임시 UI 상태가 아니라 durable workflow state입니다.

### 6. Missing data도 모델링 가능해야 한다
- 시스템은 “무엇을 알고 있는가”뿐 아니라
  “무엇을 기대했지만 아직 수집하지 못했는가”도 표현할 수 있어야 합니다.

## Canonical entities

### TaxpayerProfile
신고 주체와 신고 posture를 표현합니다.

필드:
- `taxpayerId`
- `filingYear`
- `taxpayerType`
  - 예: `sole_proprietor`, `freelancer`, `mixed_income_individual`, `other`
- `residencyStatus`
- `businessRegistrationStatus`
- `industryHint`
- `deductionMetadata`
- `withholdingMetadata`
- `identifiers`
  - 보호 저장소에서만 관리

의미:
- 어떤 source를 우선 수집해야 하는지,
- 어떤 deduction / withholding 흐름이 중요해지는지,
- 어떤 edge case를 일찍 감지해야 하는지에 영향을 줍니다.

### FilingWorkspace
하나의 신고 작업 맥락을 표현합니다.

필드:
- `workspaceId`
- `taxpayerId`
- `filingYear`
- `status`
  - 권장 예시:
    - `initialized`
    - `collecting_sources`
    - `normalizing`
    - `review_pending`
    - `draft_ready_for_review`
    - `ready_for_hometax_assist`
    - `submission_in_progress`
    - `submitted`
    - `archived`
- `createdAt`
- `updatedAt`
- `currentDraftId`
- `unresolvedReviewCount`
- `openCoverageGapCount`
- `lastBlockingReason`
- `notes`

의미:
- agent가 지금 어디 단계에 있는지 판단하는 기준점입니다.

### SourceConnection
connector 또는 import origin 하나를 표현합니다.

필드:
- `sourceId`
- `workspaceId`
- `sourceType`
  - 예: `hometax`, `bank_csv`, `card_csv`, `receipt_upload`, `email`, `drive`, `manual`
- `sourceLabel`
- `collectionMode`
  - `direct_connector`, `browser_assist`, `export_ingestion`, `fact_capture`
- `state`
  - `planned`, `awaiting_consent`, `awaiting_auth`, `ready`, `syncing`, `paused`, `blocked`, `completed`, `disabled`
- `authMethod`
- `scopeGranted`
- `lastSyncAt`
- `lastSuccessfulSyncAt`
- `lastBlockingReason`
- `createdAt`
- `updatedAt`
- `metadata`

의미:
- source 자체의 durable relationship 상태를 나타냅니다.
- 개별 sync run의 실행 상태와는 구분해서 봐야 합니다.

### ConsentRecord
지속적으로 보존되는 승인 기록입니다.

필드:
- `consentId`
- `workspaceId`
- `sourceId` (optional)
- `consentType`
  - `source_access`, `auth_step`, `review_override`, `final_submission`
- `scope`
- `status`
  - `granted`, `revoked`, `expired`, `superseded`
- `grantedBy`
- `grantedAt`
- `revokedAt`
- `expiresAt`
- `note`

의미:
- 단순히 “대화에서 허락받았다”가 아니라,
  어떤 범위의 어떤 승인인지 재확인할 수 있어야 합니다.

### AuthCheckpoint
수집 또는 browser assist를 막는 사용자 인증 단계를 표현합니다.

필드:
- `authCheckpointId`
- `workspaceId`
- `sourceId`
- `provider`
- `authMethod`
- `state`
  - `pending`, `in_progress`, `completed`, `expired`, `failed`
- `startedAt`
- `completedAt`
- `expiresAt`
- `sessionBinding`

의미:
- 인증은 blanket permission이 아니라,
  특정 단계의 blocking checkpoint로 다뤄야 합니다.

### SyncAttempt
source collection 또는 refresh 시도 1회를 표현합니다.

필드:
- `syncAttemptId`
- `workspaceId`
- `sourceId`
- `mode`
  - `incremental`, `full`
- `state`
  - `queued`, `running`, `paused`, `awaiting_user_action`, `blocked`, `completed`, `failed`
- `startedAt`
- `endedAt`
- `checkpointId`
- `blockingReason`
  - 예: `missing_auth`, `user_action_required`, `ui_changed`, `blocked_by_provider`, `export_required`, `insufficient_metadata`
- `attemptSummary`
- `fallbackOptions[]`

의미:
- “이번 시도에서 무슨 일이 있었는가”를 남깁니다.
- source의 장기 상태와 실행 단위 상태를 분리하면 pause / retry가 쉬워집니다.

### SourceArtifact
import된 raw 파일, export, page snapshot, parsed payload를 표현합니다.

필드:
- `artifactId`
- `workspaceId`
- `sourceId`
- `artifactType`
  - `csv`, `pdf`, `image`, `json`, `html_snapshot`, `manual_entry`
- `capturedAt`
- `ingestedAt`
- `contentHash`
- `contentRef`
- `parseState`
- `parseSummary`
- `parseError`
- `duplicateCandidateOf`
- `provenance`

의미:
- raw input layer를 보존하고,
  이후 normalized entity와 연결하는 고리 역할을 합니다.

### LedgerTransaction
정규화된 거래성 financial event를 표현합니다.

필드:
- `transactionId`
- `workspaceId`
- `sourceId`
- `artifactId`
- `occurredAt`
- `postedAt`
- `amount`
- `currency`
- `normalizedDirection`
  - `income`, `expense`, `transfer`, `unknown`
- `counterparty`
- `description`
- `rawCategory`
- `sourceReference`
- `evidenceRefs[]`
- `duplicateGroupId`
- `reviewStatus`
- `createdAt`

의미:
- 여러 source에서 온 데이터를 공통 ledger 관점으로 다룰 수 있게 해줍니다.

### EvidenceDocument
세무상 의미가 있는 파일 또는 추출 문서를 표현합니다.

필드:
- `documentId`
- `workspaceId`
- `sourceId`
- `artifactId`
- `documentType`
  - `receipt`, `invoice`, `tax_statement`, `withholding_doc`, `hometax_export`, `other`
- `issuedAt`
- `issuer`
- `amount`
- `currency`
- `fileRef`
- `extractionStatus`
- `extractedFields`
- `linkedTransactionIds[]`

의미:
- 영수증, 원천징수 관련 문서, 세무 확인자료 같은 evidence를
  거래 데이터와 별도 계층으로 보존합니다.

### CoverageGap
누락되었거나 불완전한 filing-relevant coverage를 표현합니다.

필드:
- `gapId`
- `workspaceId`
- `gapType`
- `severity`
- `description`
- `affectedArea`
- `recommendedNextAction`
- `relatedSourceIds[]`
- `state`
  - `open`, `deferred`, `resolved`, `accepted_with_risk`

예시:
- 예상된 은행 내역이 아직 수집되지 않음
- 중요한 비용에 증빙이 없음
- 원천징수 자료가 누락됨
- 납세자 사실관계가 아직 비어 있음

의미:
- 시스템이 모르는 것을 명시적으로 추적하게 해주는 핵심 엔터티입니다.

### ClassificationDecision
자동 또는 사람 검토가 반영된 분류 계층입니다.

필드:
- `decisionId`
- `entityType`
  - `transaction`, `document`, `draft_line`
- `entityId`
- `candidateCategory`
- `candidateTaxTreatment`
- `confidence`
- `ruleRefs[]`
- `modelRefs[]`
- `explanation`
- `decidedBy`
  - `system`, `user`, `advisor`
- `decisionMode`
  - `auto`, `suggested`, `approved_override`, `manual`
- `supersedesDecisionId`
- `createdAt`

의미:
- raw data는 그대로 둔 채,
  세무적 해석과 수정 이력을 별도 레이어로 관리할 수 있습니다.

### ReviewItem
명시적 해결이 필요한 질문 또는 모호성입니다.

필드:
- `reviewItemId`
- `workspaceId`
- `reasonCode`
  - 예: `low_confidence`, `mixed_use_expense`, `duplicate_conflict`, `missing_evidence`, `high_amount_outlier`
- `severity`
  - `low`, `medium`, `high`, `critical`
- `question`
- `candidateOptions[]`
- `suggestedOption`
- `linkedEntityIds[]`
- `impactEstimate`
- `resolutionState`
  - `open`, `batched`, `resolved`, `dismissed`
- `resolvedBy`
- `resolvedAt`
- `resolutionNote`

의미:
- workflow가 자동으로 넘기면 안 되는 판단 지점을 queue로 드러냅니다.

### FilingDraft
신고용 draft output 상태를 표현합니다.

필드:
- `draftId`
- `workspaceId`
- `filingYear`
- `draftVersion`
- `status`
  - `drafting`, `ready_for_review`, `ready_for_submission`, `submitted`, `superseded`
- `incomeSummary`
- `expenseSummary`
- `deductionsSummary`
- `withholdingSummary`
- `assumptions[]`
- `warnings[]`
- `computedAt`
- `computationTraceRef`

의미:
- draft는 최종 truth가 아니라 계산 결과물입니다.
- 무엇을 가정했고 어떤 warning이 남았는지도 함께 보여줘야 합니다.

### BrowserAssistSession
resume 가능한 assisted web session을 표현합니다.

필드:
- `assistSessionId`
- `workspaceId`
- `draftId`
- `provider`
- `checkpoint`
- `authState`
- `pendingUserAction`
- `lastKnownSection`
- `startedAt`
- `updatedAt`
- `endedAt`

의미:
- HomeTax 입력 보조가 중간에 끊겨도,
  어디까지 진행했는지 복원할 수 있어야 합니다.

### AuditEvent
추적 가능성을 위한 durable activity log입니다.

필드:
- `eventId`
- `workspaceId`
- `eventType`
  - 예: `source_planned`, `source_connected`, `sync_started`, `sync_blocked`, `import_completed`, `artifact_parsed`, `coverage_gap_created`, `classification_run`, `review_resolved`, `draft_computed`, `browser_assist_started`, `submission_approved`, `submission_attempted`
- `actorType`
  - `system`, `user`, `agent`
- `actorRef`
- `entityRefs[]`
- `summary`
- `metadata`
- `createdAt`

의미:
- 나중에 “누가 무엇을 언제 바꿨는가”를 재구성할 수 있게 해줍니다.

## 관계 요약
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
- 모든 주요 mutation -> many `AuditEvent`

## 실무적 모델링 메모
v1에서 처음부터 완벽한 관계형 시스템이 필요하다는 뜻은 아닙니다.
파일 기반 저장이나 lightweight storage로 시작해도 괜찮습니다.
다만 아래 질문에 답할 수 있는 shape는 유지되어야 합니다.

- 어떤 source를 시도했는가
- 지금 어떤 user checkpoint가 pending인가
- 아직 어떤 데이터가 missing인가
- 새로운 sync 또는 review resolution 이후 무엇이 바뀌었는가
- agent가 다음에 무엇을 해야 하는가

## 정렬 포인트
참고:
- [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
- [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
- [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md)

## v1 boundary note
이 스키마는 향후 다양한 납세자 유형을 지원할 수 있을 정도로 generic하게 잡되,
v1에서는 실제 신고 workflow를 우선하는 방향을 유지합니다.

즉 핵심은 “모든 세무 케이스를 완벽히 표현하는 것”이 아니라,
실제 agent가 한국 종합소득세 신고를 **멈추지 않고 이어갈 수 있게 하는 최소 충분 구조**를 확보하는 것입니다.

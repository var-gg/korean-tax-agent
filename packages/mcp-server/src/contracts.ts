import type {
  ActiveBlocker,
  BlockingReason,
  CheckpointType,
  ClassificationDecision,
  CoverageByDomain,
  CoverageGap,
  DataFreshnessState,
  DraftCalibrationSnapshot,
  FilingComparisonSummaryState,
  FilingFieldValue,
  FilingPathKind,
  FilingSupportTier,
  MappedReadinessState,
  MaterialCoverageSummary,
  ReadinessLevel,
  ReviewItem,
  SourceState,
  SubmissionComparisonSummary,
  SyncAttemptState,
  TaxpayerFact,
  WithholdingRecord,
  EvidenceDocument,
  SourceArtifact,
  NormalizedDirection,
  DocumentType,
  SourceType,
  ExtractionStatus,
} from '../../core/src/types.js';

export type MCPWarning = {
  code: string;
  message: string;
  severity?: 'low' | 'medium' | 'high';
};

export type MCPAudit = {
  eventType: string;
  eventId: string;
};

export type MCPStatus =
  | 'completed'
  | 'in_progress'
  | 'paused'
  | 'awaiting_consent'
  | 'awaiting_auth'
  | 'awaiting_user_action'
  | 'blocked'
  | 'failed';

export type MCPProgress = {
  phase: string;
  step: string;
  percent: number;
};

/**
 * Backward-compatible readiness summary.
 *
 * Use this when a consumer only needs compact headline state.
 * For canonical decisioning, prefer `readinessState`.
 */
export type MCPReadiness = {
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  estimateReadiness: ReadinessLevel;
  draftReadiness: ReadinessLevel;
  submissionReadiness: ReadinessLevel;
  comparisonSummaryState: FilingComparisonSummaryState;
  freshnessState: DataFreshnessState;
  majorUnknowns: string[];
  blockerCodes: BlockingReason[];
};

export type MCPCoverageByDomain = Partial<CoverageByDomain>;

export type MCPMaterialCoverageSummary = Partial<MaterialCoverageSummary>;

export type MCPResponseEnvelope<TData = Record<string, unknown>> = {
  /** Primary tool payload. */
  ok: boolean;
  data: TData;
  /**
   * Compact compatibility summary for legacy or lightweight consumers.
   * Prefer `readinessState` when branching on readiness logic.
   */
  readiness?: MCPReadiness;
  /**
   * Canonical calculated readiness payload.
   * Consumers should prefer this for policy/decision logic, domain coverage,
   * and detailed readiness reasoning.
   */
  readinessState?: MappedReadinessState;
  warnings?: MCPWarning[];
  requiresConsent?: boolean;
  requiresAuth?: boolean;
  status?: MCPStatus;
  checkpointType?: CheckpointType;
  blockingReason?: BlockingReason;
  checkpointId?: string;
  pendingUserAction?: string;
  resumeToken?: string;
  fallbackOptions?: string[];
  progress?: MCPProgress;
  nextRecommendedAction?: string;
  audit?: MCPAudit;
  errorCode?: string;
  errorMessage?: string;
};

export type InspectEnvironmentInput = {
  configPath?: string;
};

export type InspectEnvironmentData = {
  storageReady: boolean;
  supportedImportModes: string[];
  availableConnectors: string[];
  browserAssistAvailable: boolean;
  missingDependencies: string[];
};

export type InitConfigInput = {
  filingYear: number;
  storageMode: 'local';
  workspacePath?: string;
  taxpayerTypeHint?: string;
};

export type InitConfigData = {
  workspaceId: string;
  filingYear: number;
  storageMode: 'local';
  workspacePath: string;
};

export type PlanCollectionInput = {
  workspaceId: string;
  filingYear: number;
  currentCoverageSummary?: Record<string, unknown>;
  userProfileHints?: Record<string, unknown>;
};

export type CollectionRecommendation = {
  sourceType: string;
  priority: 'high' | 'medium' | 'low';
  rationale: string;
  collectionMode: 'direct_connector' | 'browser_assist' | 'export_ingestion' | 'fact_capture';
  likelyCheckpoints: CheckpointType[];
  fallbackOptions: string[];
};

export type PlanCollectionData = {
  recommendedSources: CollectionRecommendation[];
  expectedValueBySource: Record<string, string>;
  likelyUserCheckpoints: CheckpointType[];
  fallbackPathSuggestions: string[];
};

export type GetCollectionStatusInput = {
  workspaceId: string;
};

export type GetWorkspaceStatusInput = {
  workspaceId: string;
};

export type GetFilingSummaryInput = {
  workspaceId: string;
  draftId?: string;
  detailLevel?: 'short' | 'standard';
};

export type CollectionStatusData = {
  connectedSources: Array<{
    sourceId: string;
    sourceType: string;
    state: SourceState | string;
  }>;
  pendingCheckpoints: CheckpointType[];
  coverageGaps: CoverageGap[];
  blockedAttempts: string[];
};

export type ConnectSourceInput = {
  workspaceId: string;
  sourceType: string;
  requestedScope: string[];
};

export type ConnectSourceData = {
  sourceId: string;
  sourceState: SourceState;
  consentRequired: boolean;
  authRequired: boolean;
  checkpointType?: CheckpointType;
  nextStep?: string;
  checkpointId?: string;
  fallbackOptions?: string[];
};

export type ListSourcesInput = {
  workspaceId: string;
  includeDisabled?: boolean;
  includeSyncSummary?: boolean;
};

export type ListSourcesData = {
  workspaceId: string;
  sources: Array<{
    sourceId: string;
    sourceType: string;
    sourceState: SourceState | string;
    availability: 'available' | 'disconnected';
    syncSummary?: {
      lastSyncAttemptId?: string;
      lastSyncAttemptState?: SyncAttemptState;
      lastSyncAt?: string;
      lastSuccessfulSyncAt?: string;
      blockingReason?: BlockingReason;
    };
    nextRecommendedAction?: string;
  }>;
};

export type DisconnectSourceInput = {
  workspaceId: string;
  sourceId: string;
  reason?: string;
};

export type DisconnectSourceData = {
  workspaceId: string;
  sourceId: string;
  disconnected: boolean;
  sourceState: SourceState | string;
  recordsRetained: boolean;
  warning: string;
  disconnectedAt?: string;
};

export type SyncSourceInput = {
  sourceId: string;
  syncMode: 'incremental' | 'full';
};

export type SyncSourceData = {
  sourceState?: SourceState;
  syncAttemptState?: SyncAttemptState;
  importedArtifactCount: number;
  changedItemCount: number;
  progressState?: MCPProgress;
  checkpointType?: CheckpointType;
  checkpointId?: string;
  fallbackOptions?: string[];
};

export type ResumeSyncInput = {
  sourceId?: string;
  syncSessionId?: string;
  checkpointId?: string;
  resumeToken?: string;
};

export type ResumeSyncData = {
  resumed: boolean;
  sourceId?: string;
  syncSessionId: string;
  syncAttemptState?: SyncAttemptState;
  importedArtifactCount: number;
  nextCheckpointType?: CheckpointType;
  nextCheckpointId?: string;
};

export type ImportRef = {
  ref: string;
  artifactId?: string;
  filename?: string;
  contentType?: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
};

export type UploadTransactionsInput = {
  workspaceId: string;
  refs: ImportRef[];
  formatHints?: string[];
  sourceId?: string;
  sourceType?: SourceType | string;
  importMetadata?: Record<string, unknown>;
};

export type UploadTransactionsData = {
  workspaceId: string;
  artifactIds: string[];
  ingestionSummary: {
    acceptedRefCount: number;
    deduplicatedRefCount: number;
    formatHints: string[];
    storedArtifactCount: number;
  };
  normalizeReadiness: 'ready' | 'needs_more_input';
};

export type UploadDocumentsInput = {
  workspaceId: string;
  refs: ImportRef[];
  documentHints?: Array<{
    ref: string;
    documentType?: DocumentType;
    issuer?: string;
    issuedAt?: string;
    amount?: number;
    currency?: string;
    linkedTransactionRefs?: string[];
    metadata?: Record<string, unknown>;
  }>;
  sourceId?: string;
  sourceType?: SourceType | string;
  importMetadata?: Record<string, unknown>;
};

export type UploadDocumentsData = {
  workspaceId: string;
  documentIds: string[];
  ingestionSummary: {
    acceptedRefCount: number;
    hintedDocumentCount: number;
    storedDocumentCount: number;
  };
};

export type SubmitExtractedReceiptFieldsInput = {
  workspaceId: string;
  submissions: Array<{
    artifactRef?: string;
    artifactId?: string;
    documentRef?: string;
    documentId?: string;
    fields: Record<string, unknown>;
    documentTypeHint?: DocumentType;
  }>;
  extractorMetadata: {
    extractorType: string;
    extractorVersion?: string;
    confidenceSummary?: Record<string, unknown>;
    runId?: string;
    metadata?: Record<string, unknown>;
  };
};

export type SubmitExtractedReceiptFieldsData = {
  workspaceId: string;
  acceptedSubmissionCount: number;
  updatedDocumentIds: string[];
  createdDocumentIds: string[];
};

export type ImportHomeTaxMaterialsInput = {
  workspaceId: string;
  refs: ImportRef[];
  materialMetadata?: Array<{
    ref: string;
    materialTypeHint?: DocumentType | 'income_statement' | 'taxpayer_overview' | 'unknown';
    observedSection?: string;
    issuedAt?: string;
    metadata?: Record<string, unknown>;
  }>;
  sourceId?: string;
  importMetadata?: Record<string, unknown>;
};

export type ImportHomeTaxMaterialsData = {
  workspaceId: string;
  artifactIds: string[];
  recognizedMaterials: Array<{
    ref: string;
    artifactId: string;
    recognizedType: DocumentType | 'income_statement' | 'taxpayer_overview' | 'unknown';
    supported: boolean;
  }>;
};

export type NormalizeLedgerExtractedPayload = {
  artifactId?: string;
  sourceId?: string;
  sourceType?: SourceType | string;
  sourceArtifact?: Partial<SourceArtifact>;
  provenance?: Record<string, unknown>;
  transactions?: Array<{
    externalId?: string;
    occurredAt: string;
    postedAt?: string;
    amount: number;
    currency?: string;
    normalizedDirection?: NormalizedDirection;
    counterparty?: string;
    description?: string;
    rawCategory?: string;
    sourceReference?: string;
    evidenceDocumentRefs?: string[];
    duplicateHint?: string;
    provenance?: Record<string, unknown>;
  }>;
  documents?: Array<{
    externalId?: string;
    documentType?: DocumentType;
    issuedAt?: string;
    issuer?: string;
    amount?: number;
    currency?: string;
    fileRef: string;
    extractionStatus?: ExtractionStatus | string;
    extractedFields?: Record<string, unknown>;
    linkedTransactionRefs?: string[];
    provenance?: Record<string, unknown>;
  }>;
  withholdingRecords?: Array<{
    externalId?: string;
    filingYear?: number;
    incomeSourceRef?: string;
    payerName?: string;
    grossAmount?: number;
    withheldTaxAmount: number;
    localTaxAmount?: number;
    currency?: string;
    sourceType?: SourceType | string;
    extractionConfidence?: number;
    evidenceDocumentRefs?: string[];
    provenance?: Record<string, unknown>;
  }>;
};

export type NormalizeLedgerInput = {
  workspaceId: string;
  artifactIds?: string[];
  normalizationMode?: 'default' | 'strict' | 'append';
  extractedPayloads?: NormalizeLedgerExtractedPayload[];
};

export type NormalizeLedgerData = {
  transactionCount: number;
  documentCount: number;
  duplicateCandidateCount: number;
  withholdingRecordsCreated: WithholdingRecord[];
  withholdingRecordsUpdated: WithholdingRecord[];
  coverageGapsCreated: CoverageGap[];
  normalizedArtifacts?: SourceArtifact[];
  normalizedDocuments?: EvidenceDocument[];
  normalizedTransactions?: import('../../core/src/types.js').LedgerTransaction[];
};

export type ListTransactionsInput = {
  workspaceId: string;
  dateFrom?: string;
  dateTo?: string;
  direction?: NormalizedDirection;
  reviewStatus?: string;
  evidenceStatus?: 'linked' | 'unlinked' | 'partial';
  limit?: number;
  offset?: number;
};

export type ListTransactionsData = {
  workspaceId: string;
  rows: Array<{
    transactionId: string;
    occurredAt: string;
    postedAt?: string;
    amount: number;
    currency: string;
    normalizedDirection: NormalizedDirection;
    counterparty?: string;
    description?: string;
    reviewStatus?: string;
    evidenceLink: {
      status: 'linked' | 'unlinked' | 'partial';
      evidenceRefs: string[];
      documentCount: number;
    };
  }>;
  page: {
    total: number;
    limit: number;
    offset: number;
    returned: number;
  };
};

export type LinkEvidenceInput = {
  workspaceId: string;
  transactionIds: string[];
  documentIds: string[];
  linkMode: 'append' | 'replace';
};

export type LinkEvidenceData = {
  workspaceId: string;
  linkMode: 'append' | 'replace';
  affectedTransactionIds: string[];
  affectedDocumentIds: string[];
  reviewItemIds: string[];
  evidenceLinks: Array<{
    transactionId: string;
    evidenceRefs: string[];
  }>;
};

export type DetectFilingPathInput = {
  workspaceId: string;
  taxpayerProfileRef?: string;
  includeEvidenceSummary?: boolean;
  includeCoverageGaps?: boolean;
  includeWithholdingSummary?: boolean;
};

export type DetectFilingPathData = {
  workspaceId: string;
  supportTier: FilingSupportTier;
  filingPathKind: FilingPathKind;
  confidence: number;
  reasons: string[];
  missingFacts: string[];
  escalationFlags: string[];
};

export type RunClassificationInput = {
  workspaceId: string;
  rulesetVersion?: string;
  subsetFilters?: Record<string, unknown>;
};

export type RunClassificationData = {
  classifiedCount: number;
  lowConfidenceCount: number;
  generatedReviewItemCount: number;
  summaryByCategory: Record<string, number>;
  decisions?: ClassificationDecision[];
  reviewItems?: ReviewItem[];
};

export type ListReviewItemsInput = {
  workspaceId: string;
  severity?: string;
  reasonCode?: string;
  batchedOnly?: boolean;
};

export type ResolveReviewItemInput = {
  reviewItemIds: string[];
  selectedOption: string;
  rationale: string;
  approverIdentity: string;
};

export type ResolveReviewItemData = {
  resolvedCount: number;
  affectedDraftIds?: string[];
};

export type ComputeDraftInput = {
  workspaceId: string;
  draftMode?: 'refresh' | 'new_version';
  includeAssumptions?: boolean;
};

export type ComputeDraftData = {
  draftId: string;
  computedAt?: string;
  unresolvedBlockerCount: number;
  warnings: string[];
  incomeSummary: Record<string, unknown>;
  expenseSummary: Record<string, unknown>;
  deductionsSummary: Record<string, unknown>;
  withholdingSummary: Record<string, unknown>;
  estimateConfidence?: 'low' | 'medium' | 'high';
  blockerCodes?: string[];
  taxpayerFacts?: TaxpayerFact[];
  withholdingRecords?: WithholdingRecord[];
  fieldValues?: FilingFieldValue[];
  supportTier?: FilingSupportTier;
  filingPathKind?: FilingPathKind;
  estimateReadiness?: ReadinessLevel;
  draftReadiness?: ReadinessLevel;
  submissionReadiness?: ReadinessLevel;
  comparisonSummaryState?: FilingComparisonSummaryState;
  freshnessState?: DataFreshnessState;
  majorUnknowns?: string[];
  calibration?: DraftCalibrationSnapshot;
};

export type CompareWithHomeTaxInput = {
  workspaceId: string;
  draftId: string;
  comparisonMode?: 'visible_portal' | 'imported_portal' | 'manual_entry';
  sectionKeys?: string[];
  /**
   * Structured HomeTax-observed values supplied by the external agent/runtime.
   * Prefer this over implying MCP directly observed the browser page.
   */
  portalObservedFields?: Array<{
    sectionKey: string;
    fieldKey: string;
    portalObservedValue: string | number | boolean | null;
  }>;
};

export type CompareWithHomeTaxData = {
  draftId: string;
  sectionResults: Array<{
    sectionKey: string;
    comparisonState: FilingComparisonSummaryState;
    matchedFields: number;
    mismatchFields: number;
    manualOnlyFields: number;
  }>;
  materialMismatches: Array<{
    sectionKey: string;
    fieldKey: string;
    draftValue: FilingFieldValue['value'];
    portalObservedValue: FilingFieldValue['portalObservedValue'];
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  fieldValues?: FilingFieldValue[];
};

export type RefreshOfficialDataInput = {
  workspaceId: string;
  sourceIds?: string[];
  refreshPolicy?: 'always' | 'if_stale_or_user_requested' | 'force';
  recomputeDraft?: boolean;
};

export type RefreshOfficialDataData = {
  refreshedSources: Array<{
    sourceId: string;
    syncAttemptId: string;
    changeSummary: {
      newArtifacts: number;
      changedWithholdingRecords: number;
      changedDraftFields: number;
    };
  }>;
  recomputedDraftId?: string;
  supersededDraftId?: string;
  readinessDowngraded: boolean;
  downgradeReasons: string[];
};

export type PrepareHomeTaxInput = {
  workspaceId: string;
  draftId: string;
};

export type HomeTaxEntryFieldTask = {
  fieldKey: string;
  fieldRef: string;
  value: FilingFieldValue['value'];
  comparisonState: FilingFieldValue['comparisonState'] | 'not_compared';
  sourceOfTruth: FilingFieldValue['sourceOfTruth'];
  requiresManualEntry: boolean;
  blocked: boolean;
  comparisonNeeded: boolean;
  sourceProvenanceRefs: string[];
  mismatchState: 'matched' | 'mismatch' | 'review_required' | 'not_compared';
  reviewStatus: 'none' | 'open' | 'resolved';
  entryInstruction: string;
};

export type HomeTaxEntrySectionPlan = {
  order: number;
  sectionKey: string;
  checkpointType: CheckpointType | 'data_entry';
  fieldRefs: string[];
  mappedFields: HomeTaxEntryFieldTask[];
  manualOnlyFields: string[];
  blockedFields: string[];
  comparisonNeededFields: string[];
  mismatchFields: string[];
  blockingItems: string[];
};

export type HomeTaxHandoffPayload = {
  orderedSections: HomeTaxEntrySectionPlan[];
  mismatchSummary: {
    hasUnresolvedMismatch: boolean;
    hasHighSeverityReview: boolean;
    openReviewItemIds: string[];
    unresolvedMismatchFieldRefs: string[];
  };
  manualVerificationChecklist: string[];
  blockingItems: string[];
  immediateUserConfirmations: string[];
};

export type PrepareHomeTaxData = {
  sectionMapping: Record<string, {
    sectionKey: string;
    fieldRefs: string[];
    mappedFields: HomeTaxEntryFieldTask[];
    manualOnlyFields: string[];
    blockedFields: string[];
    comparisonNeededFields: string[];
    mismatchFields: string[];
    blockingItems: string[];
  }>;
  orderedSections: HomeTaxEntrySectionPlan[];
  manualOnlyFields: string[];
  blockedFields: string[];
  comparisonNeededFields: string[];
  browserAssistReady: boolean;
  handoff: HomeTaxHandoffPayload;
  fieldValues?: FilingFieldValue[];
};

export type StartHomeTaxAssistInput = {
  workspaceId: string;
  draftId: string;
  mode: 'guide_only' | 'fill_assist';
};

export type StartHomeTaxAssistData = {
  assistSessionId: string;
  checkpointType: CheckpointType;
  authRequired: boolean;
  handoff?: HomeTaxHandoffPayload;
};

export type ResumeHomeTaxAssistInput = {
  workspaceId: string;
  assistSessionId?: string;
};

export type ResumeHomeTaxAssistData = {
  assistSessionId: string;
  draftId: string;
  checkpointType: CheckpointType;
  authRequired: boolean;
  pendingUserAction?: string;
  handoff: {
    provider: string;
    targetSection?: string;
    recommendedTool: 'tax.browser.resume_hometax_assist';
    entryPlan?: HomeTaxHandoffPayload;
  };
};

export type GetHomeTaxCheckpointInput = {
  assistSessionId: string;
  workspaceId?: string;
};

export type BrowserAssistCheckpointSnapshot = {
  assistSessionId: string;
  workspaceId: string;
  draftId: string;
  checkpointType: CheckpointType;
  stopped: boolean;
  authRequired: boolean;
  blocker?: BlockingReason;
  pendingUserAction?: string;
  sessionRef: string;
  workspaceRef: string;
  draftRef: string;
  handoff: {
    provider: string;
    targetSection?: string;
    recommendedTool: 'tax.browser.resume_hometax_assist' | 'tax.browser.get_checkpoint';
    entryPlan?: HomeTaxHandoffPayload;
    safeContext: {
      sessionStatus: 'active' | 'stopped';
      lastKnownSection?: string;
      authState?: string;
      startedAt: string;
      updatedAt: string;
      endedAt?: string;
    };
  };
};

export type GetHomeTaxCheckpointData = BrowserAssistCheckpointSnapshot;

export type StopHomeTaxAssistInput = {
  assistSessionId: string;
  workspaceId?: string;
};

export type StopHomeTaxAssistData = BrowserAssistCheckpointSnapshot & {
  preservedContext: {
    auditable: true;
    canRestartFromSession: boolean;
    preservedFields: string[];
  };
};

/**
 * Canonical workspace runtime snapshot for operator/UI rendering.
 *
 * This is the best source for "what is true right now in the workspace runtime",
 * including ordered active blockers and submission-comparison status.
 * For calculated readiness decisions, prefer `readinessState`.
 */
export type RuntimeSnapshot = {
  blockerCodes: BlockingReason[];
  activeBlockers: ActiveBlocker[];
  coverageByDomain?: CoverageByDomain;
  materialCoverageSummary?: MaterialCoverageSummary;
  submissionComparison?: SubmissionComparisonSummary;
};

export type GetWorkspaceStatusData = {
  workspace: {
    workspaceId: string;
    status: string;
    currentDraftId?: string;
    unresolvedReviewCount: number;
    openCoverageGapCount?: number;
    supportTier?: FilingSupportTier;
    filingPathKind?: FilingPathKind;
    estimateReadiness?: ReadinessLevel;
    draftReadiness?: ReadinessLevel;
    submissionReadiness?: ReadinessLevel;
    comparisonSummaryState?: FilingComparisonSummaryState;
    freshnessState?: DataFreshnessState;
    /**
     * Legacy single-value blocker summary kept for compatibility.
     * Prefer `runtimeSnapshot.activeBlockers` / `runtimeSnapshot.blockerCodes` for new consumers.
     */
    lastBlockingReason?: BlockingReason;
    lastCollectionStatus?: SyncAttemptState;
    majorUnknowns?: string[];
    updatedAt: string;
  };
  draft?: {
    draftId: string;
    blockerCodes?: string[];
    warningCount: number;
    fieldValueCount: number;
  };
  /**
   * Current workspace runtime view for rendering/status surfaces.
   * Prefer this over legacy single-value fields like `lastBlockingReason`
   * when detailed blocker context is needed.
   */
  runtimeSnapshot?: RuntimeSnapshot;
  nextRecommendedAction?: string;
};

export type GetFilingSummaryData = {
  workspaceId: string;
  draftId?: string;
  headline: string;
  summaryText: string;
  operatorUpdate: string;
  status: string;
  keyPoints: string[];
  /**
   * Legacy lightweight blocker summary kept for compatibility.
   * New consumers should prefer `runtimeSnapshot.activeBlockers` and
   * `runtimeSnapshot.blockerCodes`.
   */
  blockers: string[];
  /**
   * Current workspace runtime view for operator summaries and UI rendering.
   * Prefer this over `blockers` when detailed blocker metadata is needed.
   */
  runtimeSnapshot?: RuntimeSnapshot;
  nextRecommendedAction?: string;
  metrics: {
    unresolvedReviewCount: number;
    warningCount: number;
    fieldValueCount: number;
  };
};

export interface KoreanTaxMCPContracts {
  'tax.setup.inspect_environment': {
    input: InspectEnvironmentInput;
    output: MCPResponseEnvelope<InspectEnvironmentData>;
  };
  'tax.setup.init_config': {
    input: InitConfigInput;
    output: MCPResponseEnvelope<InitConfigData>;
  };
  'tax.sources.plan_collection': {
    input: PlanCollectionInput;
    output: MCPResponseEnvelope<PlanCollectionData>;
  };
  'tax.sources.get_collection_status': {
    input: GetCollectionStatusInput;
    output: MCPResponseEnvelope<CollectionStatusData>;
  };
  'tax.workspace.get_status': {
    input: GetWorkspaceStatusInput;
    output: MCPResponseEnvelope<GetWorkspaceStatusData>;
  };
  'tax.filing.get_summary': {
    input: GetFilingSummaryInput;
    output: MCPResponseEnvelope<GetFilingSummaryData>;
  };
  'tax.sources.connect': {
    input: ConnectSourceInput;
    output: MCPResponseEnvelope<ConnectSourceData>;
  };
  'tax.sources.list': {
    input: ListSourcesInput;
    output: MCPResponseEnvelope<ListSourcesData>;
  };
  'tax.sources.disconnect': {
    input: DisconnectSourceInput;
    output: MCPResponseEnvelope<DisconnectSourceData>;
  };
  'tax.import.upload_transactions': {
    input: UploadTransactionsInput;
    output: MCPResponseEnvelope<UploadTransactionsData>;
  };
  'tax.import.upload_documents': {
    input: UploadDocumentsInput;
    output: MCPResponseEnvelope<UploadDocumentsData>;
  };
  'tax.import.submit_extracted_receipt_fields': {
    input: SubmitExtractedReceiptFieldsInput;
    output: MCPResponseEnvelope<SubmitExtractedReceiptFieldsData>;
  };
  'tax.import.import_hometax_materials': {
    input: ImportHomeTaxMaterialsInput;
    output: MCPResponseEnvelope<ImportHomeTaxMaterialsData>;
  };
  'tax.sources.sync': {
    input: SyncSourceInput;
    output: MCPResponseEnvelope<SyncSourceData>;
  };
  'tax.sources.resume_sync': {
    input: ResumeSyncInput;
    output: MCPResponseEnvelope<ResumeSyncData>;
  };
  'tax.ledger.normalize': {
    input: NormalizeLedgerInput;
    output: MCPResponseEnvelope<NormalizeLedgerData>;
  };
  'tax.ledger.list_transactions': {
    input: ListTransactionsInput;
    output: MCPResponseEnvelope<ListTransactionsData>;
  };
  'tax.ledger.link_evidence': {
    input: LinkEvidenceInput;
    output: MCPResponseEnvelope<LinkEvidenceData>;
  };
  'tax.profile.detect_filing_path': {
    input: DetectFilingPathInput;
    output: MCPResponseEnvelope<DetectFilingPathData>;
  };
  'tax.classify.run': {
    input: RunClassificationInput;
    output: MCPResponseEnvelope<RunClassificationData>;
  };
  'tax.classify.list_review_items': {
    input: ListReviewItemsInput;
    output: MCPResponseEnvelope<{ items: ReviewItem[] }>;
  };
  'tax.classify.resolve_review_item': {
    input: ResolveReviewItemInput;
    output: MCPResponseEnvelope<ResolveReviewItemData>;
  };
  'tax.filing.compute_draft': {
    input: ComputeDraftInput;
    output: MCPResponseEnvelope<ComputeDraftData>;
  };
  'tax.filing.compare_with_hometax': {
    input: CompareWithHomeTaxInput;
    output: MCPResponseEnvelope<CompareWithHomeTaxData>;
  };
  'tax.filing.refresh_official_data': {
    input: RefreshOfficialDataInput;
    output: MCPResponseEnvelope<RefreshOfficialDataData>;
  };
  'tax.filing.prepare_hometax': {
    input: PrepareHomeTaxInput;
    output: MCPResponseEnvelope<PrepareHomeTaxData>;
  };
  'tax.browser.start_hometax_assist': {
    input: StartHomeTaxAssistInput;
    output: MCPResponseEnvelope<StartHomeTaxAssistData>;
  };
  'tax.browser.resume_hometax_assist': {
    input: ResumeHomeTaxAssistInput;
    output: MCPResponseEnvelope<ResumeHomeTaxAssistData>;
  };
  'tax.browser.get_checkpoint': {
    input: GetHomeTaxCheckpointInput;
    output: MCPResponseEnvelope<GetHomeTaxCheckpointData>;
  };
  'tax.browser.stop_hometax_assist': {
    input: StopHomeTaxAssistInput;
    output: MCPResponseEnvelope<StopHomeTaxAssistData>;
  };
}

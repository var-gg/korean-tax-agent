export type ISODateString = string;
export type ISODateTimeString = string;

export type TaxpayerType =
  | 'sole_proprietor'
  | 'freelancer'
  | 'mixed_income_individual'
  | 'other';

export type WorkspaceStatus =
  | 'setup'
  | 'collecting'
  | 'reviewing'
  | 'draft_ready'
  | 'submission_ready'
  | 'initialized'
  | 'collecting_sources'
  | 'normalizing'
  | 'review_pending'
  | 'draft_ready_for_review'
  | 'ready_for_hometax_assist'
  | 'submission_in_progress'
  | 'submitted'
  | 'archived';

export type SourceType =
  | 'hometax'
  | 'bank_csv'
  | 'card_csv'
  | 'receipt_upload'
  | 'email'
  | 'drive'
  | 'manual';

export type CollectionMode = 'direct_connector' | 'browser_assist' | 'export_ingestion' | 'fact_capture';

export type SourceState =
  | 'planned'
  | 'awaiting_consent'
  | 'awaiting_auth'
  | 'ready'
  | 'syncing'
  | 'paused'
  | 'blocked'
  | 'completed'
  | 'disabled';

export type ArtifactType =
  | 'csv'
  | 'pdf'
  | 'image'
  | 'json'
  | 'html_snapshot'
  | 'manual_entry';

export type ArtifactParseState = 'pending' | 'parsed' | 'partially_parsed' | 'failed' | 'duplicate_candidate';

export type NormalizedDirection = 'income' | 'expense' | 'transfer' | 'unknown';
export type ReviewStatus = 'unreviewed' | 'review_required' | 'in_review' | 'resolved';

export type DocumentType =
  | 'receipt'
  | 'invoice'
  | 'tax_statement'
  | 'withholding_doc'
  | 'hometax_export'
  | 'other';

export type ExtractionStatus = 'pending' | 'extracted' | 'partially_extracted' | 'failed';

export type EntityType = 'transaction' | 'document' | 'draft_line';

export type DecisionMode = 'auto' | 'suggested' | 'approved_override' | 'manual';

export type ReviewSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ResolutionState = 'open' | 'batched' | 'resolved' | 'dismissed';

export type DraftStatus =
  | 'drafting'
  | 'ready_for_review'
  | 'ready_for_submission'
  | 'submitted'
  | 'superseded';

export type CheckpointType =
  | 'source_consent'
  | 'authentication'
  | 'collection_blocker'
  | 'review_judgment'
  | 'final_submission';

export type BlockingReason =
  | 'missing_consent'
  | 'missing_auth'
  | 'ui_changed'
  | 'blocked_by_provider'
  | 'export_required'
  | 'insufficient_metadata'
  | 'unsupported_source'
  | 'awaiting_review_decision'
  | 'awaiting_final_approval'
  | 'draft_not_ready'
  | 'unsupported_hometax_state';

export type AuditEventType =
  | 'source_planned'
  | 'source_connected'
  | 'sync_started'
  | 'sync_blocked'
  | 'import_completed'
  | 'artifact_parsed'
  | 'coverage_gap_created'
  | 'classification_run'
  | 'review_resolved'
  | 'draft_computed'
  | 'browser_assist_started'
  | 'submission_approved'
  | 'submission_attempted';

export type ActorType = 'system' | 'user' | 'agent';

export type ConsentType = 'source_access' | 'auth_step' | 'review_override' | 'final_submission';
export type ConsentStatus = 'granted' | 'revoked' | 'expired' | 'superseded';

export type AuthCheckpointState = 'pending' | 'in_progress' | 'completed' | 'expired' | 'failed';
export type SyncMode = 'incremental' | 'full';
export type SyncAttemptState = 'queued' | 'running' | 'paused' | 'awaiting_user_action' | 'blocked' | 'completed' | 'failed';
export type CoverageGapState = 'open' | 'deferred' | 'resolved' | 'accepted_with_risk';

export interface TaxpayerProfile {
  taxpayerId: string;
  filingYear: number;
  taxpayerType: TaxpayerType;
  residencyStatus: string;
  businessRegistrationStatus: string;
  industryHint?: string;
  deductionMetadata?: Record<string, unknown>;
  withholdingMetadata?: Record<string, unknown>;
  identifiers?: Record<string, unknown>;
}

export interface FilingWorkspace {
  workspaceId: string;
  taxpayerId: string;
  taxpayerProfileRef?: string;
  filingYear: number;
  status: WorkspaceStatus;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  currentDraftId?: string;
  unresolvedReviewCount: number;
  openCoverageGapCount?: number;
  lastBlockingReason?: BlockingReason;
  lastCollectionStatus?: SyncAttemptState;
  notes?: string[];
}

export interface SourceConnection {
  sourceId: string;
  workspaceId: string;
  sourceType: SourceType;
  sourceLabel?: string;
  collectionMode?: CollectionMode;
  state?: SourceState;
  authMethod?: string;
  consentState?: ConsentStatus | string;
  scopeGranted?: string[];
  lastSyncAt?: ISODateTimeString;
  lastSuccessfulSyncAt?: ISODateTimeString;
  lastBlockingReason?: BlockingReason;
  connectionStatus?: SourceState | string;
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
  metadata?: Record<string, unknown>;
}

export interface SourceArtifact {
  artifactId: string;
  workspaceId?: string;
  sourceId: string;
  syncAttemptId?: string;
  artifactType: ArtifactType;
  acquiredAt?: ISODateTimeString;
  capturedAt?: ISODateTimeString;
  ingestedAt?: ISODateTimeString;
  checksum?: string;
  contentHash?: string;
  storageRef?: string;
  contentRef?: string;
  parseStatus?: ArtifactParseState | string;
  parseState?: ArtifactParseState | string;
  parseSummary?: Record<string, unknown>;
  parseError?: string;
  duplicateCandidateOf?: string;
  provenance?: Record<string, unknown>;
}

export interface LedgerTransaction {
  transactionId: string;
  workspaceId: string;
  sourceId: string;
  artifactId?: string;
  occurredAt: ISODateTimeString;
  postedAt?: ISODateTimeString;
  amount: number;
  currency: string;
  normalizedDirection: NormalizedDirection;
  counterparty?: string;
  description?: string;
  rawCategory?: string;
  sourceReference?: string;
  evidenceRefs: string[];
  duplicateGroupId?: string;
  reviewStatus?: ReviewStatus | string;
  createdAt: ISODateTimeString;
}

export interface EvidenceDocument {
  documentId: string;
  workspaceId: string;
  sourceId: string;
  artifactId?: string;
  documentType: DocumentType;
  issuedAt?: ISODateString;
  issuer?: string;
  amount?: number;
  currency?: string;
  fileRef: string;
  extractionStatus?: ExtractionStatus | string;
  extractedFields?: Record<string, unknown>;
  linkedTransactionIds: string[];
}

export interface CoverageGap {
  gapId: string;
  workspaceId: string;
  gapType: string;
  severity: ReviewSeverity;
  description: string;
  affectedArea: string;
  recommendedNextAction?: string;
  relatedSourceIds: string[];
  state: CoverageGapState;
}

export interface ClassificationDecision {
  decisionId: string;
  entityType: EntityType;
  entityId: string;
  candidateCategory?: string;
  candidateTaxTreatment?: string;
  confidence?: number;
  ruleRefs?: string[];
  modelRefs?: string[];
  explanation?: string;
  decidedBy: ActorType | 'advisor';
  decisionMode: DecisionMode;
  supersedesDecisionId?: string;
  createdAt: ISODateTimeString;
}

export interface ReviewItem {
  reviewItemId: string;
  workspaceId: string;
  reasonCode: string;
  severity: ReviewSeverity;
  question: string;
  candidateOptions: string[];
  suggestedOption?: string;
  linkedEntityIds: string[];
  impactEstimate?: Record<string, unknown>;
  resolutionState: ResolutionState;
  resolvedBy?: string;
  resolvedAt?: ISODateTimeString;
  resolutionNote?: string;
}

export interface FilingDraft {
  draftId: string;
  workspaceId: string;
  filingYear: number;
  draftVersion: number;
  status: DraftStatus;
  incomeSummary: Record<string, unknown>;
  expenseSummary: Record<string, unknown>;
  deductionsSummary: Record<string, unknown>;
  withholdingSummary: Record<string, unknown>;
  assumptions: string[];
  warnings: string[];
  computedAt: ISODateTimeString;
  computationTraceRef?: string;
}

export interface AuditEvent {
  auditEventId?: string;
  eventId?: string;
  workspaceId: string;
  eventType: AuditEventType;
  actorType: ActorType;
  actorId?: string;
  actorRef?: string;
  targetRefs?: string[];
  entityRefs?: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: ISODateTimeString;
  createdAt?: ISODateTimeString;
}

export interface ConsentRecord {
  consentId: string;
  workspaceId?: string;
  sourceId?: string;
  consentType: ConsentType;
  scope: {
    sourceType?: SourceType | string;
    actions?: string[];
    filingYear?: number;
    [key: string]: unknown;
  };
  status: ConsentStatus;
  grantedBy: string;
  grantedAt: ISODateTimeString;
  note?: string;
  revokedAt?: ISODateTimeString;
  expiresAt?: ISODateTimeString;
}

export interface AuthCheckpoint {
  authCheckpointId: string;
  workspaceId: string;
  sourceId: string;
  provider: string;
  authMethod?: string;
  checkpointType?: CheckpointType;
  state: AuthCheckpointState;
  startedAt?: ISODateTimeString;
  completedAt?: ISODateTimeString;
  expiresAt?: ISODateTimeString;
  sessionBinding?: string;
}

export interface SyncAttempt {
  syncAttemptId: string;
  workspaceId: string;
  sourceId: string;
  mode: SyncMode;
  state: SyncAttemptState;
  startedAt: ISODateTimeString;
  endedAt?: ISODateTimeString;
  checkpointType?: CheckpointType;
  checkpointId?: string;
  blockingReason?: BlockingReason;
  pendingUserAction?: string;
  attemptSummary?: string;
  fallbackOptions?: string[];
}

export interface BrowserAssistSession {
  assistSessionId: string;
  workspaceId: string;
  draftId: string;
  provider?: string;
  checkpointType: CheckpointType;
  lastKnownSection?: string;
  authState?: AuthCheckpointState;
  pendingUserAction?: string;
  startedAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  endedAt?: ISODateTimeString;
}

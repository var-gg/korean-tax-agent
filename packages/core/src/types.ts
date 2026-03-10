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

export type ArtifactType =
  | 'csv'
  | 'pdf'
  | 'image'
  | 'json'
  | 'html_snapshot'
  | 'manual_entry';

export type NormalizedDirection = 'income' | 'expense' | 'transfer' | 'unknown';

export type DocumentType =
  | 'receipt'
  | 'invoice'
  | 'tax_statement'
  | 'withholding_doc'
  | 'hometax_export'
  | 'other';

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

export type AuditEventType =
  | 'source_connected'
  | 'import_completed'
  | 'classification_run'
  | 'review_resolved'
  | 'draft_computed'
  | 'browser_assist_started'
  | 'submission_approved'
  | 'submission_attempted';

export type ActorType = 'system' | 'user' | 'agent';

export type ConsentType = 'source_access' | 'auth_step' | 'review_override' | 'final_submission';
export type ConsentStatus = 'granted' | 'revoked' | 'expired' | 'superseded';

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
  filingYear: number;
  status: WorkspaceStatus;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  currentDraftId?: string;
  unresolvedReviewCount: number;
  notes?: string[];
}

export interface SourceConnection {
  sourceId: string;
  workspaceId: string;
  sourceType: SourceType;
  authMethod?: string;
  consentState?: string;
  scopeGranted?: string[];
  lastSyncAt?: ISODateTimeString;
  connectionStatus?: string;
  metadata?: Record<string, unknown>;
}

export interface SourceArtifact {
  artifactId: string;
  sourceId: string;
  artifactType: ArtifactType;
  acquiredAt: ISODateTimeString;
  checksum?: string;
  storageRef: string;
  parseStatus?: string;
  parseError?: string;
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
  reviewStatus?: string;
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
  extractionStatus?: string;
  extractedFields?: Record<string, unknown>;
  linkedTransactionIds: string[];
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
  auditEventId: string;
  workspaceId: string;
  eventType: AuditEventType;
  actorType: ActorType;
  actorId?: string;
  targetRefs: string[];
  metadata?: Record<string, unknown>;
  occurredAt: ISODateTimeString;
}

export interface ConsentRecord {
  consentId: string;
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

export interface BrowserAssistSession {
  assistSessionId: string;
  workspaceId: string;
  draftId: string;
  checkpoint: string;
  lastKnownSection?: string;
  authState?: string;
  pendingUserAction?: string;
  startedAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

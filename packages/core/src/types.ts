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
  | 'unsupported_filing_path'
  | 'missing_material_coverage'
  | 'awaiting_review_decision'
  | 'awaiting_final_approval'
  | 'draft_not_ready'
  | 'submission_not_ready'
  | 'comparison_incomplete'
  | 'official_data_refresh_required'
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
export type FilingSupportTier = 'tier_a' | 'tier_b' | 'tier_c' | 'undetermined';
export type FilingPathKind =
  | 'prefilled_simple'
  | 'freelancer_withholding_clear'
  | 'mixed_income_limited'
  | 'expense_claim_simple'
  | 'manual_heavy_general'
  | 'official_data_unstable'
  | 'platform_income_extra_review'
  | 'bookkeeping_heavy'
  | 'allocation_heavy'
  | 'specialist_optimization'
  | 'unknown';
export type FilingFactCategory = 'taxpayer_profile' | 'income_stream' | 'deduction_eligibility' | 'business_use' | 'filing_path';
export type FilingFactStatus = 'missing' | 'provided' | 'inferred' | 'review_required';
export type SourceOfTruthType = 'official' | 'imported' | 'inferred' | 'user_asserted';
export type EstimateConfidenceBand = 'low' | 'medium' | 'high';
export type ReadinessLevel = 'not_ready' | 'estimate_ready' | 'draft_ready' | 'submission_assist_ready';
export type CalibratedReadinessLevel = 'not_ready' | 'limited' | 'ready';
export type SubmissionReadinessLevel = 'not_ready' | 'blocked' | 'ready' | 'unsupported';
export type ConfidenceBand = 'low' | 'medium' | 'high';
export type FilingCoverageDomain =
  | 'filingPath'
  | 'incomeInventory'
  | 'withholdingPrepaidTax'
  | 'expenseEvidence'
  | 'deductionFacts'
  | 'submissionComparison';
export type CoverageStrength = 'none' | 'weak' | 'partial' | 'strong';
export type ReadinessKind = 'estimate' | 'draft' | 'submission';
export type BlockerType =
  | 'source_block'
  | 'coverage_gap'
  | 'review_block'
  | 'comparison_block'
  | 'support_boundary';
export type FilingFieldComparisonState = 'not_compared' | 'matched' | 'mismatch' | 'manual_only';
export type FilingComparisonSummaryState = 'not_started' | 'partial' | 'matched_enough' | 'material_mismatch' | 'manual_only';
export type DataFreshnessState = 'current_enough' | 'refresh_recommended' | 'refresh_required' | 'stale_unknown';
export type CoverageGapType =
  | 'missing_income_source'
  | 'missing_withholding_record'
  | 'missing_expense_evidence'
  | 'missing_deduction_fact'
  | 'missing_filing_path_determination'
  | 'missing_hometax_comparison'
  | 'stale_official_data';

export interface WorkspaceReadiness {
  estimateReadiness: CalibratedReadinessLevel;
  draftReadiness: CalibratedReadinessLevel;
  submissionReadiness: SubmissionReadinessLevel;
  confidenceBand: ConfidenceBand;
  supportTier: FilingSupportTier;
  majorUnknowns: string[];
  readinessUpdatedAt?: ISODateTimeString;
}

export type CoverageByDomain = Record<FilingCoverageDomain, CoverageStrength>;

export interface MaterialCoverageSummary {
  strongDomains: FilingCoverageDomain[];
  partialDomains: FilingCoverageDomain[];
  weakDomains: FilingCoverageDomain[];
}

export interface ActiveBlocker {
  blockerType: BlockerType;
  blockingReason: BlockingReason;
  severity: ReviewSeverity;
  affectedDomains: FilingCoverageDomain[];
  affectsReadiness: ReadinessKind[];
  message: string;
  sourceId?: string;
  syncAttemptId?: string;
  reviewItemId?: string;
  gapId?: string;
}

export type ReadinessDelta =
  | 'unchanged'
  | 'upgraded_to_limited'
  | 'upgraded_to_ready'
  | 'downgraded_to_limited'
  | 'downgraded_to_not_ready'
  | 'blocked'
  | 'unsupported';

export interface ReadinessImpact {
  estimateReadiness?: ReadinessDelta;
  draftReadiness?: ReadinessDelta;
  submissionReadiness?: ReadinessDelta;
}

export interface ReviewReadinessEffect {
  affectedDomains: FilingCoverageDomain[];
  blocksDraft: boolean;
  blocksSubmission: boolean;
  assumptionAllowed: boolean;
  assumptionDisclosure?: string;
}

export type SubmissionComparisonState = 'not_started' | 'partial' | 'strong' | 'blocked';

export interface SubmissionComparisonCoverage {
  sectionCoverage: Record<string, CoverageStrength>;
}

export interface SubmissionComparisonSummary {
  submissionComparisonState: SubmissionComparisonState;
  comparisonCoverage?: SubmissionComparisonCoverage;
  mismatchSummary?: Array<{
    sectionKey: string;
    mismatchSeverity: ReviewSeverity;
    count?: number;
  }>;
  manualEntryRequired?: boolean;
  lastComparedAt?: ISODateTimeString;
}

export interface DraftCalibrationSnapshot {
  readiness: WorkspaceReadiness;
  coverageByDomain: CoverageByDomain;
  materialCoverageSummary: MaterialCoverageSummary;
  majorUnknowns: string[];
  highSeverityReviewCount: number;
  submissionComparisonState: SubmissionComparisonState;
  capturedAt: ISODateTimeString;
}

export interface FilingWorkspaceRuntimeExtensions {
  readiness: WorkspaceReadiness;
  coverageByDomain: CoverageByDomain;
  materialCoverageSummary: MaterialCoverageSummary;
  activeBlockers: ActiveBlocker[];
  submissionComparison?: SubmissionComparisonSummary;
}

export interface MappedReadinessState {
  readiness: WorkspaceReadiness;
  coverageByDomain?: CoverageByDomain;
  materialCoverageSummary?: MaterialCoverageSummary;
  majorUnknowns?: string[];
  activeBlockers?: ActiveBlocker[];
  supportTier?: FilingSupportTier;
  readinessImpact?: ReadinessImpact;
}

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
  supportTier?: FilingSupportTier;
  filingPathKind?: FilingPathKind;
  estimateReadiness?: ReadinessLevel;
  draftReadiness?: ReadinessLevel;
  submissionReadiness?: ReadinessLevel;
  comparisonSummaryState?: FilingComparisonSummaryState;
  freshnessState?: DataFreshnessState;
  majorUnknowns?: string[];
  runtime?: FilingWorkspaceRuntimeExtensions;
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
  gapType: CoverageGapType;
  severity: ReviewSeverity;
  description: string;
  affectedArea: string;
  affectedDomains?: FilingCoverageDomain[];
  materiality?: ReviewSeverity;
  blocksEstimate?: boolean;
  blocksDraft?: boolean;
  blocksSubmission?: boolean;
  recommendedNextSource?: string;
  recommendedNextAction?: string;
  relatedSourceIds: string[];
  sourceRefs?: string[];
  state: CoverageGapState;
  createdAt?: ISODateTimeString;
  updatedAt?: ISODateTimeString;
}

export interface TaxpayerFact {
  factId: string;
  workspaceId: string;
  category: FilingFactCategory;
  factKey: string;
  value: string | number | boolean | string[] | Record<string, unknown>;
  status: FilingFactStatus;
  sourceOfTruth: SourceOfTruthType;
  confidence?: number;
  evidenceRefs?: string[];
  note?: string;
  updatedAt: ISODateTimeString;
}

export interface WithholdingRecord {
  withholdingRecordId: string;
  workspaceId: string;
  filingYear: number;
  incomeSourceRef?: string;
  payerName?: string;
  grossAmount?: number;
  withheldTaxAmount: number;
  localTaxAmount?: number;
  currency: string;
  sourceType?: SourceType | string;
  sourceOfTruth: SourceOfTruthType;
  extractionConfidence?: number;
  reviewStatus?: ReviewStatus | string;
  evidenceRefs: string[];
  capturedAt: ISODateTimeString;
}

export interface FilingFieldValue {
  filingFieldValueId: string;
  draftId: string;
  sectionKey: string;
  fieldKey: string;
  value: string | number | boolean | null | Record<string, unknown>;
  sourceOfTruth: SourceOfTruthType;
  confidence?: number;
  isEstimated?: boolean;
  requiresManualEntry?: boolean;
  sourceRefs?: string[];
  evidenceRefs?: string[];
  comparisonState?: FilingFieldComparisonState;
  freshnessState?: DataFreshnessState;
  supportTierHint?: FilingSupportTier;
  portalObservedValue?: string | number | boolean | null;
  mismatchSeverity?: ReviewSeverity;
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
  readinessEffect?: ReviewReadinessEffect;
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
  estimateConfidence?: EstimateConfidenceBand;
  estimateReadiness?: ReadinessLevel;
  draftReadiness?: ReadinessLevel;
  submissionReadiness?: ReadinessLevel;
  supportTierAtComputation?: FilingSupportTier;
  comparisonSummaryState?: FilingComparisonSummaryState;
  freshnessState?: DataFreshnessState;
  majorUnknowns?: string[];
  blockerCodes?: BlockingReason[];
  calibration?: DraftCalibrationSnapshot;
  assumptions: string[];
  warnings: string[];
  fieldValues?: FilingFieldValue[];
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

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

export type NormalizeLedgerInput = {
  workspaceId: string;
  artifactIds?: string[];
  normalizationMode?: 'default' | 'strict';
};

export type NormalizeLedgerData = {
  transactionCount: number;
  documentCount: number;
  duplicateCandidateCount: number;
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

export type PrepareHomeTaxData = {
  sectionMapping: Record<string, unknown>;
  requiredManualFields: string[];
  blockedFields: string[];
  browserAssistReady: boolean;
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
}

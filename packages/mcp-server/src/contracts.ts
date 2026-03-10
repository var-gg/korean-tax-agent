import type { BlockingReason, ClassificationDecision, ReviewItem, SourceState } from '../../core/src/types.js';

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

export type MCPResponseEnvelope<TData = Record<string, unknown>> = {
  ok: boolean;
  data: TData;
  warnings?: MCPWarning[];
  requiresConsent?: boolean;
  requiresAuth?: boolean;
  status?: MCPStatus;
  blockingReason?: BlockingReason;
  checkpointId?: string;
  pendingUserAction?: string;
  resumeToken?: string;
  fallbackOptions?: string[];
  progress?: MCPProgress;
  nextRecommendedAction?: string;
  audit?: MCPAudit;
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
  likelyCheckpoints: string[];
  fallbackOptions: string[];
};

export type PlanCollectionData = {
  recommendedSources: CollectionRecommendation[];
  expectedValueBySource: Record<string, string>;
  likelyUserCheckpoints: string[];
  fallbackPathSuggestions: string[];
};

export type GetCollectionStatusInput = {
  workspaceId: string;
};

export type CollectionStatusData = {
  connectedSources: Array<{
    sourceId: string;
    sourceType: string;
    state: SourceState | string;
  }>;
  pendingCheckpoints: string[];
  coverageGaps: string[];
  blockedAttempts: string[];
};

export type ConnectSourceInput = {
  workspaceId: string;
  sourceType: string;
  requestedScope: string[];
};

export type ConnectSourceData = {
  sourceId: string;
  connectionState: string;
  consentRequired: boolean;
  authRequired: boolean;
  nextStep?: string;
  checkpointId?: string;
  fallbackOptions?: string[];
};

export type SyncSourceInput = {
  sourceId: string;
  syncMode: 'incremental' | 'full';
};

export type SyncSourceData = {
  importedArtifactCount: number;
  changedItemCount: number;
  progressState?: MCPProgress;
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
  importedArtifactCount: number;
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
  unresolvedBlockerCount: number;
  warnings: string[];
  incomeSummary: Record<string, unknown>;
  expenseSummary: Record<string, unknown>;
  deductionsSummary: Record<string, unknown>;
  withholdingSummary: Record<string, unknown>;
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
};

export type StartHomeTaxAssistInput = {
  workspaceId: string;
  draftId: string;
  mode: 'guide_only' | 'fill_assist';
};

export type StartHomeTaxAssistData = {
  assistSessionId: string;
  checkpoint: string;
  authRequired: boolean;
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
  'tax.filing.prepare_hometax': {
    input: PrepareHomeTaxInput;
    output: MCPResponseEnvelope<PrepareHomeTaxData>;
  };
  'tax.browser.start_hometax_assist': {
    input: StartHomeTaxAssistInput;
    output: MCPResponseEnvelope<StartHomeTaxAssistData>;
  };
}

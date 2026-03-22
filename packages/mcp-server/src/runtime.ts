import { deriveCalibratedReadiness, deriveReadinessSummary, sortActiveBlockers } from '../../core/src/readiness.js';
import type {
  AuthCheckpoint,
  BlockingReason,
  BrowserAssistSession,
  ClassificationDecision,
  CheckpointType,
  ConsentRecord,
  CoverageGap,
  EvidenceDocument,
  FilingFactCompleteness,
  FilingFieldValue,
  FilingWorkspace,
  LedgerTransaction,
  ReviewItem,
  SourceArtifact,
  SourceConnection,
  SubmissionApprovalRecord,
  SubmissionResultRecord,
  SyncAttempt,
  TaxpayerFact,
  WithholdingRecord,
  AuditEvent,
} from '../../core/src/types.js';
import type { SnapshotPersistenceAdapter } from '../../core/src/persistence.js';
import type {
  CollectionStatusData,
  CollectionTask,
  CompareWithHomeTaxData,
  DisconnectSourceData,
  DisconnectSourceInput,
  ImportHomeTaxMaterialsData,
  ImportHomeTaxMaterialsInput,
  GetFilingSummaryData,
  GetFilingSummaryInput,
  GetWorkspaceStatusData,
  GetWorkspaceStatusInput,
  CompareWithHomeTaxInput,
  ComputeDraftData,
  ComputeDraftInput,
  ExportPackageData,
  ExportPackageInput,
  ConnectSourceData,
  ConnectSourceInput,
  ListSourcesData,
  ListSourcesInput,
  ListAdjustmentCandidatesData,
  ListAdjustmentCandidatesInput,
  ListCoverageGapsData,
  ListCoverageGapsInput,
  ListMissingFactsData,
  ListWithholdingRecordsData,
  ListWithholdingRecordsInput,
  ListMissingFactsInput,
  DetectFilingPathData,
  DetectFilingPathInput,
  GetCollectionStatusInput,
  InitConfigData,
  InitConfigInput,
  InspectEnvironmentData,
  InspectEnvironmentInput,
  GetHomeTaxCheckpointData,
  GetHomeTaxCheckpointInput,
  KoreanTaxMCPContracts,
  LinkEvidenceData,
  LinkEvidenceInput,
  ListTransactionsData,
  ListTransactionsInput,
  StopHomeTaxAssistData,
  StopHomeTaxAssistInput,
  SubmitExtractedReceiptFieldsData,
  SubmitExtractedReceiptFieldsInput,
  MCPResponseEnvelope,
  NormalizeLedgerData,
  NormalizeLedgerInput,
  PrepareHomeTaxData,
  PrepareHomeTaxInput,
  RecordSubmissionApprovalData,
  RecordSubmissionApprovalInput,
  RecordSubmissionResultData,
  RecordSubmissionResultInput,
  RecordCollectionObservationData,
  RecordCollectionObservationInput,
  RefreshOfficialDataData,
  RefreshOfficialDataInput,
  ResolveReviewItemData,
  ResolveReviewItemInput,
  ResumeHomeTaxAssistData,
  ResumeHomeTaxAssistInput,
  ResumeSyncData,
  ResumeSyncInput,
  RunClassificationData,
  UpsertTaxpayerFactsData,
  UpsertTaxpayerFactsInput,
  UploadDocumentsData,
  UploadDocumentsInput,
  UploadTransactionsData,
  UploadTransactionsInput,
  RunClassificationInput,
  StartHomeTaxAssistData,
  StartHomeTaxAssistInput,
  SyncSourceData,
  SyncSourceInput,
  RuntimeSnapshot,
} from './contracts.js';
import {
  taxBrowserResumeHomeTaxAssist,
  taxBrowserStartHomeTaxAssist,
  taxClassifyListReviewItems,
  taxClassifyResolveReviewItem,
  taxClassifyRun,
  taxFilingCompareWithHomeTax,
  taxFilingComputeDraft,
  taxFilingListAdjustmentCandidates,
  taxFilingPrepareHomeTax,
  taxFilingRefreshOfficialData,
  taxImportHomeTaxMaterials,
  taxImportSubmitExtractedReceiptFields,
  taxImportUploadDocuments,
  taxImportUploadTransactions,
  taxLedgerNormalize,
  taxListMissingFacts,
  taxWorkspaceListCoverageGaps,
  taxProfileDetectFilingPath,
  taxProfileUpsertFacts,
  taxSetupInitConfig,
  taxSetupInspectEnvironment,
  taxSourcesConnect,
  taxSourcesDisconnect,
  taxSourcesGetCollectionStatus,
  taxSourcesList,
  taxSourcesPlanCollection,
  taxSourcesResumeSync,
  taxSourcesSync,
} from './tools.js';

export type SupportedRuntimeToolName =
  | 'tax.setup.inspect_environment'
  | 'tax.setup.init_config'
  | 'tax.sources.plan_collection'
  | 'tax.sources.get_collection_status'
  | 'tax.sources.record_collection_observation'
  | 'tax.workspace.get_status'
  | 'tax.workspace.list_coverage_gaps'
  | 'tax.filing.get_summary'
  | 'tax.sources.connect'
  | 'tax.sources.list'
  | 'tax.sources.disconnect'
  | 'tax.import.upload_transactions'
  | 'tax.import.upload_documents'
  | 'tax.import.submit_extracted_receipt_fields'
  | 'tax.import.import_hometax_materials'
  | 'tax.sources.sync'
  | 'tax.sources.resume_sync'
  | 'tax.ledger.normalize'
  | 'tax.ledger.list_transactions'
  | 'tax.ledger.link_evidence'
  | 'tax.withholding.list_records'
  | 'tax.filing.list_adjustment_candidates'
  | 'tax.profile.detect_filing_path'
  | 'tax.profile.upsert_facts'
  | 'tax.profile.list_missing_facts'
  | 'tax.classify.run'
  | 'tax.classify.list_review_items'
  | 'tax.classify.resolve_review_item'
  | 'tax.filing.compute_draft'
  | 'tax.filing.compare_with_hometax'
  | 'tax.filing.refresh_official_data'
  | 'tax.filing.prepare_hometax'
  | 'tax.filing.record_submission_approval'
  | 'tax.filing.export_package'
  | 'tax.browser.start_hometax_assist'
  | 'tax.browser.record_submission_result'
  | 'tax.browser.resume_hometax_assist'
  | 'tax.browser.get_checkpoint'
  | 'tax.browser.stop_hometax_assist';

export type RuntimeStore = {
  consentRecords: ConsentRecord[];
  workspaces: Map<string, FilingWorkspace>;
  sources: Map<string, SourceConnection>;
  syncAttempts: Map<string, SyncAttempt>;
  coverageGapsByWorkspace: Map<string, CoverageGap[]>;
  taxpayerFactsByWorkspace: Map<string, TaxpayerFact[]>;
  withholdingRecordsByWorkspace: Map<string, WithholdingRecord[]>;
  sourceArtifacts: Map<string, SourceArtifact>;
  evidenceDocuments: Map<string, EvidenceDocument>;
  auditEventsByWorkspace: Map<string, AuditEvent[]>;
  authCheckpoints: Map<string, AuthCheckpoint>;
  fieldValuesByDraft: Map<string, FilingFieldValue[]>;
  fieldValueDraftIdsByWorkspace: Map<string, string>;
  normalizationLinksByWorkspace: Map<string, { artifactId: string; documentIds: string[]; transactionIds: string[]; withholdingRecordIds: string[] }[]>;
  transactions: Map<string, LedgerTransaction>;
  decisions: Map<string, ClassificationDecision>;
  reviewItems: Map<string, ReviewItem>;
  draftsByWorkspace: Map<string, ComputeDraftData>;
  assistSessionsByWorkspace: Map<string, BrowserAssistSession>;
  collectionObservationsByWorkspace: Map<string, Array<{
    workspaceId: string;
    sourceId: string;
    targetArtifactType: string;
    methodTried: string;
    artifactShapeSeen?: string;
    outcome: 'found' | 'blocked' | 'auth_expired' | 'ui_changed' | 'export_only' | 'insufficient_artifact' | 'provider_unavailable' | 'attachment_required' | 'password_required' | 'summary_only';
    portalObservedFields?: Record<string, unknown>;
    note?: string;
    verifiedAt: string;
  }>>;
};

export type DurableRuntimeSnapshot = {
  schemaVersion: 1;
  consentRecords: ConsentRecord[];
  workspaces: FilingWorkspace[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGapsByWorkspace: Record<string, CoverageGap[]>;
  taxpayerFactsByWorkspace: Record<string, TaxpayerFact[]>;
  withholdingRecordsByWorkspace: Record<string, WithholdingRecord[]>;
  sourceArtifacts: SourceArtifact[];
  evidenceDocuments: EvidenceDocument[];
  auditEvents: AuditEvent[];
  authCheckpoints: AuthCheckpoint[];
  filingFieldValues: FilingFieldValue[];
  fieldValuesByDraft: Record<string, FilingFieldValue[]>;
  normalizationLinksByWorkspace: Record<string, { artifactId: string; documentIds: string[]; transactionIds: string[]; withholdingRecordIds: string[] }[]>;
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
  reviewItems: ReviewItem[];
  draftsByWorkspace: Record<string, ComputeDraftData>;
  assistSessions: BrowserAssistSession[];
};

export type CreateRuntimeOptions = {
  consentRecords?: ConsentRecord[];
  workspaces?: FilingWorkspace[];
  sources?: SourceConnection[];
  syncAttempts?: SyncAttempt[];
  coverageGapsByWorkspace?: Record<string, Array<CoverageGap | string>>;
  taxpayerFacts?: TaxpayerFact[];
  taxpayerFactsByWorkspace?: Record<string, TaxpayerFact[]>;
  withholdingRecords?: WithholdingRecord[];
  withholdingRecordsByWorkspace?: Record<string, WithholdingRecord[]>;
  sourceArtifacts?: SourceArtifact[];
  evidenceDocuments?: EvidenceDocument[];
  auditEvents?: AuditEvent[];
  authCheckpoints?: AuthCheckpoint[];
  filingFieldValues?: FilingFieldValue[];
  fieldValuesByDraft?: Record<string, FilingFieldValue[]>;
  normalizationLinksByWorkspace?: Record<string, { artifactId: string; documentIds: string[]; transactionIds: string[]; withholdingRecordIds: string[] }[]>;
  transactions?: LedgerTransaction[];
  decisions?: ClassificationDecision[];
  reviewItems?: ReviewItem[];
  draftsByWorkspace?: Record<string, ComputeDraftData>;
  assistSessions?: BrowserAssistSession[];
  persistence?: SnapshotPersistenceAdapter<DurableRuntimeSnapshot>;
};

export function createRuntimeStore(options: CreateRuntimeOptions = {}): RuntimeStore {
  const seededFieldValuesByDraft = new Map(Object.entries(options.fieldValuesByDraft ?? {}));
  for (const field of options.filingFieldValues ?? []) {
    const current = seededFieldValuesByDraft.get(field.draftId) ?? [];
    current.push(field);
    seededFieldValuesByDraft.set(field.draftId, current);
  }

  const fieldValueDraftIdsByWorkspace = new Map<string, string>();
  for (const [draftId] of seededFieldValuesByDraft) {
    fieldValueDraftIdsByWorkspace.set(extractWorkspaceIdFromDraftId(draftId), draftId);
  }

  return {
    consentRecords: [...(options.consentRecords ?? [])],
    workspaces: new Map((options.workspaces ?? []).map((workspace) => [workspace.workspaceId, workspace])),
    sources: new Map((options.sources ?? []).map((source) => [source.sourceId, source])),
    syncAttempts: new Map((options.syncAttempts ?? []).map((attempt) => [attempt.syncAttemptId, attempt])),
    coverageGapsByWorkspace: new Map(Object.entries(options.coverageGapsByWorkspace ?? {}).map(([workspaceId, gaps]) => [workspaceId, normalizeCoverageGaps(workspaceId, gaps)])),
    taxpayerFactsByWorkspace: mergeGroupedWorkspaceMaps(
      new Map(Object.entries(options.taxpayerFactsByWorkspace ?? {})),
      groupByWorkspace(options.taxpayerFacts ?? [], (fact) => fact.workspaceId),
    ),
    withholdingRecordsByWorkspace: mergeGroupedWorkspaceMaps(
      new Map(Object.entries(options.withholdingRecordsByWorkspace ?? {})),
      groupByWorkspace(options.withholdingRecords ?? [], (record) => record.workspaceId),
    ),
    sourceArtifacts: new Map((options.sourceArtifacts ?? []).map((artifact) => [artifact.artifactId, artifact])),
    evidenceDocuments: new Map((options.evidenceDocuments ?? []).map((document) => [document.documentId, document])),
    auditEventsByWorkspace: groupByWorkspace(options.auditEvents ?? [], (event) => event.workspaceId),
    authCheckpoints: new Map((options.authCheckpoints ?? []).map((checkpoint) => [checkpoint.authCheckpointId, checkpoint])),
    fieldValuesByDraft: seededFieldValuesByDraft,
    fieldValueDraftIdsByWorkspace,
    normalizationLinksByWorkspace: new Map(Object.entries(options.normalizationLinksByWorkspace ?? {})),
    transactions: new Map((options.transactions ?? []).map((tx) => [tx.transactionId, tx])),
    decisions: new Map((options.decisions ?? []).map((decision) => [decision.decisionId, decision])),
    reviewItems: new Map((options.reviewItems ?? []).map((item) => [item.reviewItemId, item])),
    draftsByWorkspace: new Map(Object.entries(options.draftsByWorkspace ?? {})),
    assistSessionsByWorkspace: new Map((options.assistSessions ?? []).map((session) => [session.workspaceId, session])),
    collectionObservationsByWorkspace: new Map(),
  };
}

export class InMemoryKoreanTaxMCPRuntime {
  readonly store: RuntimeStore;
  private readonly persistence?: SnapshotPersistenceAdapter<DurableRuntimeSnapshot>;

  constructor(options: CreateRuntimeOptions = {}) {
    const snapshot = options.persistence?.load();
    const seededOptions = snapshot ? runtimeOptionsFromSnapshot(snapshot, options) : options;
    this.store = createRuntimeStore(seededOptions);
    this.persistence = options.persistence;
    if (this.persistence && snapshot) {
      this.persistState();
    }
  }

  invoke(name: 'tax.setup.inspect_environment', input: InspectEnvironmentInput): MCPResponseEnvelope<InspectEnvironmentData>;
  invoke(name: 'tax.setup.init_config', input: InitConfigInput): MCPResponseEnvelope<InitConfigData>;
  invoke(name: 'tax.sources.plan_collection', input: { workspaceId: string; filingYear: number; currentCoverageSummary?: Record<string, unknown>; userProfileHints?: Record<string, unknown> }): MCPResponseEnvelope<{ recommendedSources: ReturnType<typeof taxSourcesPlanCollection>['data']['recommendedSources']; expectedValueBySource: Record<string, string>; likelyUserCheckpoints: ReturnType<typeof taxSourcesPlanCollection>['data']['likelyUserCheckpoints']; fallbackPathSuggestions: string[] }>;
  invoke(name: 'tax.sources.get_collection_status', input: GetCollectionStatusInput): MCPResponseEnvelope<CollectionStatusData>;
  invoke(name: 'tax.sources.record_collection_observation', input: RecordCollectionObservationInput): MCPResponseEnvelope<RecordCollectionObservationData>;
  invoke(name: 'tax.workspace.get_status', input: GetWorkspaceStatusInput): MCPResponseEnvelope<GetWorkspaceStatusData>;
  invoke(name: 'tax.workspace.list_coverage_gaps', input: ListCoverageGapsInput): MCPResponseEnvelope<ListCoverageGapsData>;
  invoke(name: 'tax.filing.get_summary', input: GetFilingSummaryInput): MCPResponseEnvelope<GetFilingSummaryData>;
  invoke(name: 'tax.sources.connect', input: ConnectSourceInput): MCPResponseEnvelope<ConnectSourceData>;
  invoke(name: 'tax.sources.list', input: ListSourcesInput): MCPResponseEnvelope<ListSourcesData>;
  invoke(name: 'tax.sources.disconnect', input: DisconnectSourceInput): MCPResponseEnvelope<DisconnectSourceData>;
  invoke(name: 'tax.import.upload_transactions', input: UploadTransactionsInput): MCPResponseEnvelope<UploadTransactionsData>;
  invoke(name: 'tax.import.upload_documents', input: UploadDocumentsInput): MCPResponseEnvelope<UploadDocumentsData>;
  invoke(name: 'tax.import.submit_extracted_receipt_fields', input: SubmitExtractedReceiptFieldsInput): MCPResponseEnvelope<SubmitExtractedReceiptFieldsData>;
  invoke(name: 'tax.import.import_hometax_materials', input: ImportHomeTaxMaterialsInput): MCPResponseEnvelope<ImportHomeTaxMaterialsData>;
  invoke(name: 'tax.sources.sync', input: SyncSourceInput): MCPResponseEnvelope<SyncSourceData>;
  invoke(name: 'tax.sources.resume_sync', input: ResumeSyncInput): MCPResponseEnvelope<ResumeSyncData>;
  invoke(name: 'tax.ledger.normalize', input: NormalizeLedgerInput): MCPResponseEnvelope<NormalizeLedgerData>;
  invoke(name: 'tax.ledger.list_transactions', input: ListTransactionsInput): MCPResponseEnvelope<ListTransactionsData>;
  invoke(name: 'tax.ledger.link_evidence', input: LinkEvidenceInput): MCPResponseEnvelope<LinkEvidenceData>;
  invoke(name: 'tax.withholding.list_records', input: ListWithholdingRecordsInput): MCPResponseEnvelope<ListWithholdingRecordsData>;
  invoke(name: 'tax.filing.list_adjustment_candidates', input: ListAdjustmentCandidatesInput): MCPResponseEnvelope<ListAdjustmentCandidatesData>;
  invoke(name: 'tax.profile.detect_filing_path', input: DetectFilingPathInput): MCPResponseEnvelope<DetectFilingPathData>;
  invoke(name: 'tax.profile.upsert_facts', input: UpsertTaxpayerFactsInput): MCPResponseEnvelope<UpsertTaxpayerFactsData>;
  invoke(name: 'tax.profile.list_missing_facts', input: ListMissingFactsInput): MCPResponseEnvelope<ListMissingFactsData>;
  invoke(name: 'tax.classify.run', input: RunClassificationInput): MCPResponseEnvelope<RunClassificationData>;
  invoke(name: 'tax.classify.list_review_items', input: { workspaceId: string }): MCPResponseEnvelope<{ items: ReviewItem[]; summary: ReturnType<typeof taxClassifyListReviewItems>['data']['summary'] }>;
  invoke(name: 'tax.classify.resolve_review_item', input: ResolveReviewItemInput): MCPResponseEnvelope<ResolveReviewItemData>;
  invoke(name: 'tax.filing.compute_draft', input: ComputeDraftInput): MCPResponseEnvelope<ComputeDraftData>;
  invoke(name: 'tax.filing.compare_with_hometax', input: CompareWithHomeTaxInput): MCPResponseEnvelope<CompareWithHomeTaxData>;
  invoke(name: 'tax.filing.refresh_official_data', input: RefreshOfficialDataInput): MCPResponseEnvelope<RefreshOfficialDataData>;
  invoke(name: 'tax.filing.prepare_hometax', input: PrepareHomeTaxInput): MCPResponseEnvelope<PrepareHomeTaxData>;
  invoke(name: 'tax.filing.record_submission_approval', input: RecordSubmissionApprovalInput): MCPResponseEnvelope<RecordSubmissionApprovalData>;
  invoke(name: 'tax.filing.export_package', input: ExportPackageInput): MCPResponseEnvelope<ExportPackageData>;
  invoke(name: 'tax.browser.start_hometax_assist', input: StartHomeTaxAssistInput): MCPResponseEnvelope<StartHomeTaxAssistData>;
  invoke(name: 'tax.browser.record_submission_result', input: RecordSubmissionResultInput): MCPResponseEnvelope<RecordSubmissionResultData>;
  invoke(name: 'tax.browser.resume_hometax_assist', input: ResumeHomeTaxAssistInput): MCPResponseEnvelope<ResumeHomeTaxAssistData>;
  invoke(name: 'tax.browser.get_checkpoint', input: GetHomeTaxCheckpointInput): MCPResponseEnvelope<GetHomeTaxCheckpointData>;
  invoke(name: 'tax.browser.stop_hometax_assist', input: StopHomeTaxAssistInput): MCPResponseEnvelope<StopHomeTaxAssistData>;
  invoke<TName extends SupportedRuntimeToolName>(
    name: TName,
    input: KoreanTaxMCPContracts[TName]['input'],
  ): KoreanTaxMCPContracts[TName]['output'] {
    let result: KoreanTaxMCPContracts[TName]['output'];
    switch (name) {
      case 'tax.setup.inspect_environment':
        result = this.inspectEnvironment(input as InspectEnvironmentInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.setup.init_config':
        result = this.initConfig(input as InitConfigInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.sources.plan_collection':
        result = this.planCollection(input as KoreanTaxMCPContracts['tax.sources.plan_collection']['input']) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.sources.get_collection_status':
        result = this.getCollectionStatus(input as GetCollectionStatusInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.sources.record_collection_observation':
        result = this.recordCollectionObservation(input as RecordCollectionObservationInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.workspace.get_status':
        result = this.getWorkspaceStatus(input as GetWorkspaceStatusInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.workspace.list_coverage_gaps':
        result = this.listCoverageGaps(input as ListCoverageGapsInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.filing.get_summary':
        result = this.getFilingSummary(input as GetFilingSummaryInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.sources.connect':
        result = this.connectSource(input as ConnectSourceInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.sources.list':
        result = this.listWorkspaceSources(input as ListSourcesInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.sources.disconnect':
        result = this.disconnectSource(input as DisconnectSourceInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.import.upload_transactions':
        result = this.uploadTransactions(input as UploadTransactionsInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.import.upload_documents':
        result = this.uploadDocuments(input as UploadDocumentsInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.import.submit_extracted_receipt_fields':
        result = this.submitExtractedReceiptFields(input as SubmitExtractedReceiptFieldsInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.import.import_hometax_materials':
        result = this.importHomeTaxMaterials(input as ImportHomeTaxMaterialsInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.sources.sync':
        result = this.syncSource(input as SyncSourceInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.sources.resume_sync':
        result = this.resumeSync(input as ResumeSyncInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.ledger.normalize':
        result = this.normalizeLedger(input as NormalizeLedgerInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.ledger.list_transactions':
        result = this.listTransactions(input as ListTransactionsInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.ledger.link_evidence':
        result = this.linkEvidence(input as LinkEvidenceInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.withholding.list_records':
        result = this.listWithholdingRecords(input as ListWithholdingRecordsInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.filing.list_adjustment_candidates':
        result = this.listAdjustmentCandidates(input as ListAdjustmentCandidatesInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.profile.detect_filing_path':
        result = this.detectFilingPath(input as DetectFilingPathInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.profile.upsert_facts':
        result = this.upsertFacts(input as UpsertTaxpayerFactsInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.profile.list_missing_facts':
        result = this.listMissingFacts(input as ListMissingFactsInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.classify.run':
        result = this.runClassification(input as RunClassificationInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.classify.list_review_items':
        result = this.getReviewQueue(input as { workspaceId: string }) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.classify.resolve_review_item':
        result = this.resolveReviewItems(input as ResolveReviewItemInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.filing.compute_draft':
        result = this.computeDraft(input as ComputeDraftInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.filing.compare_with_hometax':
        result = this.compareWithHomeTax(input as CompareWithHomeTaxInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.filing.refresh_official_data':
        result = this.refreshOfficialData(input as RefreshOfficialDataInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.filing.prepare_hometax':
        result = this.prepareHomeTax(input as PrepareHomeTaxInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.filing.record_submission_approval':
        result = this.recordSubmissionApproval(input as RecordSubmissionApprovalInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.filing.export_package':
        result = this.exportPackage(input as ExportPackageInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.browser.start_hometax_assist':
        result = this.startHomeTaxAssist(input as StartHomeTaxAssistInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.browser.record_submission_result':
        result = this.recordSubmissionResult(input as RecordSubmissionResultInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.browser.resume_hometax_assist':
        result = this.resumeHomeTaxAssist(input as ResumeHomeTaxAssistInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.browser.get_checkpoint':
        result = this.getHomeTaxCheckpoint(input as GetHomeTaxCheckpointInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      case 'tax.browser.stop_hometax_assist':
        result = this.stopHomeTaxAssist(input as StopHomeTaxAssistInput) as KoreanTaxMCPContracts[TName]['output'];
        break;
      default:
        throw new Error(`Unsupported runtime tool: ${String(name)}`);
    }
    this.persistState();
    return result;
  }

  listSources(workspaceId?: string): SourceConnection[] {
    const sources = Array.from(this.store.sources.values());
    return workspaceId ? sources.filter((source) => source.workspaceId === workspaceId) : sources;
  }

  listSyncAttempts(sourceId?: string): SyncAttempt[] {
    const attempts = Array.from(this.store.syncAttempts.values());
    return sourceId ? attempts.filter((attempt) => attempt.sourceId === sourceId) : attempts;
  }

  listReviewItems(workspaceId?: string): ReviewItem[] {
    const items = Array.from(this.store.reviewItems.values());
    return workspaceId ? items.filter((item) => item.workspaceId === workspaceId) : items;
  }

  listDecisions(workspaceId?: string): ClassificationDecision[] {
    const decisions = Array.from(this.store.decisions.values());
    if (!workspaceId) return decisions;
    const txIds = new Set(Array.from(this.store.transactions.values()).filter((tx) => tx.workspaceId === workspaceId).map((tx) => tx.transactionId));
    return decisions.filter((decision) => txIds.has(decision.entityId));
  }

  getDraft(workspaceId: string): ComputeDraftData | undefined {
    return this.store.draftsByWorkspace.get(workspaceId);
  }

  getWorkspace(workspaceId: string): FilingWorkspace | undefined {
    return this.store.workspaces.get(workspaceId);
  }

  getTaxpayerFacts(workspaceId: string): TaxpayerFact[] {
    return this.store.taxpayerFactsByWorkspace.get(workspaceId) ?? [];
  }

  getWithholdingRecords(workspaceId: string): WithholdingRecord[] {
    return this.store.withholdingRecordsByWorkspace.get(workspaceId) ?? [];
  }

  getFilingFieldValues(workspaceId: string): FilingFieldValue[] {
    const draftId = this.store.fieldValueDraftIdsByWorkspace.get(workspaceId);
    return draftId ? (this.store.fieldValuesByDraft.get(draftId) ?? []) : [];
  }

  private setFieldValuesForWorkspace(workspaceId: string, fieldValues: FilingFieldValue[]): void {
    const draftId = fieldValues[0]?.draftId ?? this.store.fieldValueDraftIdsByWorkspace.get(workspaceId) ?? this.getDraft(workspaceId)?.draftId;
    if (!draftId) return;
    this.store.fieldValueDraftIdsByWorkspace.set(workspaceId, draftId);
    this.store.fieldValuesByDraft.set(draftId, fieldValues);
  }

  getAuthCheckpoints(workspaceId: string): AuthCheckpoint[] {
    return Array.from(this.store.authCheckpoints.values()).filter((checkpoint) => checkpoint.workspaceId === workspaceId);
  }

  getBrowserAssistSession(workspaceId: string): BrowserAssistSession | undefined {
    return this.store.assistSessionsByWorkspace.get(workspaceId);
  }

  exportSnapshot(): DurableRuntimeSnapshot {
    return createRuntimeSnapshot(this.store);
  }

  private persistState(): void {
    this.persistence?.save(this.exportSnapshot());
  }

  private findAssistSession(assistSessionId: string, workspaceId?: string): BrowserAssistSession | undefined {
    if (workspaceId) {
      const session = this.store.assistSessionsByWorkspace.get(workspaceId);
      if (session?.assistSessionId === assistSessionId) return session;
    }
    return Array.from(this.store.assistSessionsByWorkspace.values()).find((candidate) => candidate.assistSessionId === assistSessionId);
  }

  getWorkspaceDerivedStatus(workspaceId: string): {
    status: FilingWorkspace['status'];
    lastBlockingReason?: FilingWorkspace['lastBlockingReason'];
    lastCollectionStatus?: FilingWorkspace['lastCollectionStatus'];
    openCoverageGapCount: number;
    currentDraftId?: string;
    nextRecommendedAction?: string;
  } {
    this.syncWorkspaceSnapshot(workspaceId);
    const workspace = this.ensureWorkspace(workspaceId);
    return {
      status: workspace.status,
      lastBlockingReason: workspace.lastBlockingReason,
      lastCollectionStatus: workspace.lastCollectionStatus,
      openCoverageGapCount: workspace.openCoverageGapCount ?? 0,
      currentDraftId: workspace.currentDraftId,
      nextRecommendedAction: deriveWorkspaceNextRecommendedAction(workspace),
    };
  }

  private ensureWorkspace(workspaceId: string): FilingWorkspace {
    const existing = this.store.workspaces.get(workspaceId);
    if (existing) return existing;

    const fallbackYear = Number(workspaceId.match(/(20\d{2})/)?.[1] ?? new Date().getFullYear());
    const created: FilingWorkspace = {
      workspaceId,
      taxpayerId: `taxpayer_${workspaceId}`,
      filingYear: fallbackYear,
      status: 'initialized',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      unresolvedReviewCount: 0,
      openCoverageGapCount: (this.store.coverageGapsByWorkspace.get(workspaceId) ?? []).filter((gap) => gap.state === 'open').length,
    };

    this.store.workspaces.set(workspaceId, created);
    return created;
  }

  private syncWorkspaceSnapshot(workspaceId: string, hints: { lastBlockingReason?: FilingWorkspace['lastBlockingReason']; lastCollectionStatus?: FilingWorkspace['lastCollectionStatus']; status?: FilingWorkspace['status'] } = {}): void {
    const workspace = this.ensureWorkspace(workspaceId);
    const draft = this.getDraft(workspaceId);
    const unresolvedReviewItems = this.listReviewItems(workspaceId).filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed');
    const unresolvedReviewCount = unresolvedReviewItems.length;
    const coverageGaps = this.store.coverageGapsByWorkspace.get(workspaceId) ?? [];
    const openCoverageGapCount = coverageGaps.filter((gap) => gap.state === 'open').length;
    const latestSyncAttempt = this.listSyncAttempts().filter((attempt) => attempt.workspaceId === workspaceId).sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0];
    const latestAuthCheckpoint = this.getAuthCheckpoints(workspaceId).sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0];
    const fieldValues = this.getFilingFieldValues(workspaceId);
    const browserAssistSession = this.getBrowserAssistSession(workspaceId);

    const calibratedRuntime = deriveCalibratedReadiness({
      supportTier: draft?.supportTier ?? workspace.supportTier,
      filingPathKind: draft?.filingPathKind ?? workspace.filingPathKind,
      reviewItems: unresolvedReviewItems,
      coverageGaps,
      draft: draft
        ? {
            draftId: draft.draftId,
            fieldValues: fieldValues.length > 0 ? fieldValues : draft.fieldValues,
          }
        : undefined,
      comparisonSummaryState: draft?.comparisonSummaryState ?? workspace.comparisonSummaryState,
      freshnessState: draft?.freshnessState ?? workspace.freshnessState,
    });

    const sortedActiveBlockers = sortActiveBlockers(calibratedRuntime.activeBlockers);

    this.store.workspaces.set(workspaceId, {
      ...workspace,
      status: hints.status
        ?? (workspace.submissionResult?.result === 'success'
          ? 'submitted'
          : workspace.submissionResult?.result === 'fail'
            ? 'submission_failed'
            : workspace.submissionResult?.result === 'unknown'
              ? 'submission_uncertain'
              : browserAssistSession && !browserAssistSession.endedAt
                ? 'submission_in_progress'
                : draft?.submissionReadiness === 'submission_assist_ready'
                  ? 'ready_for_hometax_assist'
                  : draft?.draftReadiness === 'draft_ready'
                    ? 'draft_ready_for_review'
                    : unresolvedReviewCount > 0
                      ? 'review_pending'
                      : latestSyncAttempt || (latestAuthCheckpoint && latestAuthCheckpoint.state !== 'completed')
                        ? 'collecting_sources'
                        : workspace.status),
      supportTier: calibratedRuntime.supportTier,
      filingPathKind: calibratedRuntime.filingPathKind,
      estimateReadiness: draft?.estimateReadiness ?? workspace.estimateReadiness,
      draftReadiness: draft?.draftReadiness ?? workspace.draftReadiness,
      submissionReadiness: draft?.submissionReadiness ?? workspace.submissionReadiness,
      comparisonSummaryState: calibratedRuntime.comparisonSummaryState,
      freshnessState: calibratedRuntime.freshnessState,
      majorUnknowns: calibratedRuntime.majorUnknowns,
      runtime: {
        readiness: calibratedRuntime.workspaceReadiness,
        coverageByDomain: calibratedRuntime.coverageByDomain,
        materialCoverageSummary: calibratedRuntime.materialCoverageSummary,
        activeBlockers: sortedActiveBlockers,
        submissionComparison: {
          submissionComparisonState: calibratedRuntime.submissionComparisonState,
          mismatchSummary: sortedActiveBlockers
            .filter((blocker) => blocker.blockerType === 'comparison_block')
            .map((blocker) => ({
              sectionKey: blocker.affectedDomains.join('+'),
              mismatchSeverity: blocker.severity,
              count: 1,
            })),
          manualEntryRequired: draft?.fieldValues?.some((field) => field.requiresManualEntry) ?? false,
          lastComparedAt: draft?.computedAt,
        },
      },
      currentDraftId: draft?.draftId ?? workspace.currentDraftId,
      unresolvedReviewCount,
      openCoverageGapCount,
      lastBlockingReason: hints.lastBlockingReason
        ?? prioritizeBlockingReason(calibratedRuntime.blockerCodes)
        ?? latestSyncAttempt?.blockingReason
        ?? (latestAuthCheckpoint && latestAuthCheckpoint.state !== 'completed' ? 'missing_auth' : undefined)
        ?? workspace.lastBlockingReason,
      lastCollectionStatus: hints.lastCollectionStatus
        ?? latestSyncAttempt?.state
        ?? (latestAuthCheckpoint && latestAuthCheckpoint.state !== 'completed' ? 'awaiting_user_action' : undefined)
        ?? workspace.lastCollectionStatus,
      updatedAt: new Date().toISOString(),
    });
  }

  private inspectEnvironment(input: InspectEnvironmentInput): MCPResponseEnvelope<InspectEnvironmentData> {
    return taxSetupInspectEnvironment(input);
  }

  private initConfig(input: InitConfigInput): MCPResponseEnvelope<InitConfigData> {
    const result = taxSetupInitConfig(input);
    const now = new Date().toISOString();
    const workspace = this.store.workspaces.get(result.data.workspaceId);
    this.store.workspaces.set(result.data.workspaceId, {
      workspaceId: result.data.workspaceId,
      taxpayerId: workspace?.taxpayerId ?? `taxpayer_${result.data.workspaceId}`,
      filingYear: result.data.filingYear,
      status: 'initialized',
      createdAt: workspace?.createdAt ?? now,
      updatedAt: now,
      unresolvedReviewCount: workspace?.unresolvedReviewCount ?? 0,
      openCoverageGapCount: workspace?.openCoverageGapCount ?? 0,
      notes: workspace?.notes,
    });
    return result;
  }

  private applyCollectionObservationFreshness(collectionTasks: CollectionTask[] | undefined, workspaceId: string): CollectionTask[] {
    const tasks: CollectionTask[] = [...(collectionTasks ?? [])];
    const observations = this.store.collectionObservationsByWorkspace.get(workspaceId) ?? [];
    const knownInvalidReplay = new Set(observations.filter((item) => tasks.some((task) => task.targetArtifactType === item.targetArtifactType && (task.knownInvalidMethods ?? []).some((method: { method: string }) => method.method === item.methodTried))).map((item) => `${item.targetArtifactType}:${item.methodTried}`));
    return tasks
      .map((task) => {
        const replayedInvalid = (task.knownInvalidMethods ?? []).find((method: { method: string; invalidAsOf: string; reason: string }) => knownInvalidReplay.has(`${task.targetArtifactType}:${method.method}`));
        return replayedInvalid
          ? {
              ...task,
              methodFreshnessWarning: [task.methodFreshnessWarning, `Known-invalid method replayed: ${replayedInvalid.method}. Prefer fallback now.`].filter(Boolean).join(' '),
              fallbackTaskIds: task.fallbackTaskIds,
            }
          : task;
      })
      .sort((a, b) => {
        const aReplay = /Known-invalid method replayed/.test(a.methodFreshnessWarning ?? '') ? 1 : 0;
        const bReplay = /Known-invalid method replayed/.test(b.methodFreshnessWarning ?? '') ? 1 : 0;
        return aReplay - bReplay;
      });
  }

  private planCollection(input: KoreanTaxMCPContracts['tax.sources.plan_collection']['input']): KoreanTaxMCPContracts['tax.sources.plan_collection']['output'] {
    const result = taxSourcesPlanCollection(input);
    const observations = this.store.collectionObservationsByWorkspace.get(input.workspaceId) ?? [];
    const observationSummary = observations.slice(-5).map((item) => `${item.targetArtifactType}:${item.outcome}:${item.methodTried}`);
    const collectionTasks = this.applyCollectionObservationFreshness(result.data.collectionTasks, input.workspaceId);
    const insufficientOfficialPdf = observations.some((item) => item.targetArtifactType === 'withholding_receipt' && item.outcome === 'insufficient_artifact');
    const summaryOnlyCard = observations.some((item) => item.targetArtifactType === 'card_itemized_detail' && item.outcome === 'summary_only');
    const secureMailBlocked = observations.some((item) => item.targetArtifactType === 'secure_mail_attachment' && (item.outcome === 'attachment_required' || item.outcome === 'password_required'));
    const uiChanged = observations.some((item) => item.outcome === 'ui_changed');
    if (insufficientOfficialPdf || summaryOnlyCard) {
      collectionTasks.sort((a, b) => (a.collectionMode === 'export_ingestion' ? -1 : 0) - (b.collectionMode === 'export_ingestion' ? -1 : 0));
    }
    if (secureMailBlocked) {
      collectionTasks.sort((a, b) => (a.targetArtifactType === 'secure_mail_attachment' ? -1 : 0) - (b.targetArtifactType === 'secure_mail_attachment' ? -1 : 0));
    }
    return {
      ...result,
      nextRecommendedAction: uiChanged ? 'tax.sources.get_collection_status' : secureMailBlocked ? 'tax.import.upload_documents' : (collectionTasks[0]?.nextRecommendedAction ?? result.nextRecommendedAction),
      data: {
        ...result.data,
        collectionTasks,
        observationSummary,
        targetedFactCapture: taxListMissingFacts(input.workspaceId, this.getTaxpayerFacts(input.workspaceId)).data.items.slice(0, 3),
      },
    };
  }

  private getCollectionStatus(input: GetCollectionStatusInput): MCPResponseEnvelope<CollectionStatusData> {
    const result = taxSourcesGetCollectionStatus(
      input,
      this.listSources(input.workspaceId),
      this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? [],
    );
    const derived = this.getWorkspaceDerivedStatus(input.workspaceId);
    const observations = this.store.collectionObservationsByWorkspace.get(input.workspaceId) ?? [];
    const latest = observations[observations.length - 1];
    const observationSummary = observations.slice(-5).map((item) => `${item.targetArtifactType}:${item.outcome}:${item.methodTried}`);
    const collectionTasks = this.applyCollectionObservationFreshness(result.data.collectionTasks, input.workspaceId);
    const pendingCheckpoints = [...result.data.pendingCheckpoints];
    if (latest?.outcome === 'auth_expired' && !pendingCheckpoints.includes('authentication')) pendingCheckpoints.push('authentication');
    return {
      ...result,
      blockingReason: latest?.outcome === 'ui_changed' ? 'ui_changed' : latest?.outcome === 'auth_expired' ? 'missing_auth' : derived.lastBlockingReason,
      nextRecommendedAction: latest?.outcome === 'ui_changed'
        ? 'tax.sources.plan_collection'
        : latest?.outcome === 'auth_expired'
          ? 'tax.sources.resume_sync'
          : result.data.nextActionPlan?.recommendedNextAction ?? derived.nextRecommendedAction ?? result.nextRecommendedAction,
      data: {
        ...result.data,
        pendingCheckpoints,
        collectionTasks,
        observationSummary,
      },
    };
  }

  private listCoverageGaps(input: ListCoverageGapsInput): MCPResponseEnvelope<ListCoverageGapsData> {
    const result = taxWorkspaceListCoverageGaps(input, this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? []);
    const observations = this.store.collectionObservationsByWorkspace.get(input.workspaceId) ?? [];
    return {
      ...result,
      data: {
        ...result.data,
        collectionTasks: this.applyCollectionObservationFreshness(result.data.collectionTasks, input.workspaceId),
        observationSummary: observations.slice(-5).map((item) => `${item.targetArtifactType}:${item.outcome}:${item.methodTried}`),
      },
    };
  }

  private recordCollectionObservation(input: RecordCollectionObservationInput): MCPResponseEnvelope<RecordCollectionObservationData> {
    const verifiedAt = input.verifiedAt ?? new Date().toISOString();
    if (new Date(verifiedAt) > new Date()) {
      return {
        ok: false,
        status: 'failed',
        data: { updatedSourceState: 'planned' },
        errorCode: 'invalid_future_verified_at',
        errorMessage: 'verifiedAt cannot be in the future relative to runtime now.',
        nextRecommendedAction: 'tax.sources.get_collection_status',
      };
    }
    const current = this.store.collectionObservationsByWorkspace.get(input.workspaceId) ?? [];
    current.push({ ...input, verifiedAt });
    this.store.collectionObservationsByWorkspace.set(input.workspaceId, current);

    const source = this.store.sources.get(input.sourceId);
    let updatedSourceState = source?.state ?? source?.connectionStatus ?? 'planned';
    let recommendedFallback: string | undefined;
    let nextRecommendedAction = 'tax.sources.get_collection_status';
    let knownBadMethodUntil: string | undefined;

    if (input.outcome === 'auth_expired') {
      updatedSourceState = 'awaiting_auth';
      recommendedFallback = 'Re-authenticate and retry the same source flow.';
      nextRecommendedAction = 'tax.sources.resume_sync';
    } else if (input.outcome === 'ui_changed') {
      updatedSourceState = 'blocked';
      recommendedFallback = 'Prefer export ingestion or alternate documented HomeTax path until selectors/playbook are updated.';
      nextRecommendedAction = 'tax.sources.plan_collection';
      knownBadMethodUntil = verifiedAt;
    } else if (input.outcome === 'insufficient_artifact') {
      updatedSourceState = 'blocked';
      recommendedFallback = 'Use an accepted official print/PDF or switch to export ingestion fallback.';
      nextRecommendedAction = 'tax.sources.plan_collection';
      knownBadMethodUntil = verifiedAt;
    } else if (input.outcome === 'attachment_required' || input.outcome === 'password_required') {
      updatedSourceState = 'blocked';
      recommendedFallback = 'Complete the attachment/password checkpoint and collect the real attachment rather than the shell HTML.';
      nextRecommendedAction = 'tax.sources.get_collection_status';
      knownBadMethodUntil = verifiedAt;
    } else if (input.outcome === 'summary_only') {
      updatedSourceState = 'blocked';
      recommendedFallback = 'Request the itemized detail artifact; summary-only bundles are insufficient for detailed evidence review.';
      nextRecommendedAction = 'tax.sources.plan_collection';
      knownBadMethodUntil = verifiedAt;
    } else if (input.outcome === 'provider_unavailable' || input.outcome === 'blocked') {
      updatedSourceState = 'blocked';
      recommendedFallback = 'Use the fallback collection task instead of repeating the blocked path.';
      nextRecommendedAction = 'tax.sources.plan_collection';
      knownBadMethodUntil = verifiedAt;
    } else if (input.outcome === 'found') {
      updatedSourceState = 'completed';
      recommendedFallback = undefined;
      nextRecommendedAction = 'tax.sources.get_collection_status';
    }

    if (source) {
      const nextSource = {
        ...source,
        state: updatedSourceState as SourceConnection['state'],
        connectionStatus: updatedSourceState,
        lastBlockingReason: input.outcome === 'auth_expired' ? 'missing_auth' : input.outcome === 'ui_changed' ? 'ui_changed' : input.outcome === 'provider_unavailable' ? 'blocked_by_provider' : source.lastBlockingReason,
        lastSyncAt: verifiedAt,
      };
      this.store.sources.set(input.sourceId, nextSource);
    }

    return {
      ok: true,
      status: 'completed',
      data: {
        updatedSourceState,
        knownBadMethodUntil,
        recommendedFallback,
        nextRecommendedAction,
      },
      nextRecommendedAction,
      audit: { eventType: 'collection_observation_recorded', eventId: `evt_collection_observation_${input.workspaceId}_${current.length}` },
    };
  }

  private getWorkspaceStatus(input: GetWorkspaceStatusInput): MCPResponseEnvelope<GetWorkspaceStatusData> {
    this.syncWorkspaceSnapshot(input.workspaceId);
    const workspace = this.getWorkspace(input.workspaceId) ?? this.ensureWorkspace(input.workspaceId);
    const draft = this.getDraft(input.workspaceId);
    const runtimeSnapshot = buildRuntimeSnapshot(workspace);
    const readiness = buildRuntimeReadiness(workspace, runtimeSnapshot.blockerCodes);
    const readinessState = buildRuntimeReadinessState(workspace);
    const coverageGapView = taxWorkspaceListCoverageGaps({ workspaceId: input.workspaceId }, this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? []).data;
    const derived = this.getWorkspaceDerivedStatus(input.workspaceId);
    const missingFactsView = taxListMissingFacts(input.workspaceId, this.getTaxpayerFacts(input.workspaceId), this.getWithholdingRecords(input.workspaceId), Array.from(this.store.sourceArtifacts.values()), Array.from(this.store.evidenceDocuments.values())).data;
    const missingFacts = missingFactsView.items;
    const adjustmentView = taxFilingListAdjustmentCandidates({ workspaceId: input.workspaceId }, this.getTaxpayerFacts(input.workspaceId), Array.from(this.store.transactions.values()), this.getWithholdingRecords(input.workspaceId)).data;
    const businessAccountComplianceWarnings = (adjustmentView.operatorWarnings ?? []).filter((item) => item.code === 'business_account_compliance_required').map((item) => item.code);

    const assistSession = this.getBrowserAssistSession(input.workspaceId);
    const trustState = deriveOperatorTrustState({
      draft,
      workspace,
      reviewItems: this.listReviewItems(input.workspaceId),
      runtimeSnapshot,
      authCheckpoints: this.getAuthCheckpoints(input.workspaceId),
      assistSession,
    });
    const submitState = deriveExternalSubmitState(workspace, assistSession);
    return {
      ok: true,
      status: 'completed',
      data: {
        stopReasonCodes: trustState.stopReasonCodes,
        warningCodes: [...new Set([...trustState.warningCodes, ...businessAccountComplianceWarnings, ...((adjustmentView.operatorWarnings ?? []).map((item) => item.code))])],
        escalationReason: trustState.escalationReason,
        operatorExplanation: trustState.operatorExplanation,
        reviewBatchId: trustState.reviewBatchId,
        workflowState: submitState.workflowState,
        externalSubmitRequired: submitState.externalSubmitRequired,
        workspace: {
          workspaceId: workspace.workspaceId,
          status: workspace.status,
          submissionApproval: workspace.submissionApproval,
          submissionResult: workspace.submissionResult,
          missingFacts,
          submitterProfile: missingFactsView.submitterProfile,
          coverageGaps: coverageGapView.items,
          prioritizedGap: coverageGapView.prioritizedGap,
          nextActionPlan: coverageGapView.nextActionPlan,
          currentDraftId: workspace.currentDraftId,
          unresolvedReviewCount: workspace.unresolvedReviewCount,
          openCoverageGapCount: workspace.openCoverageGapCount,
          supportTier: getRuntimeSupportTier(workspace),
          filingPathKind: workspace.filingPathKind,
          estimateReadiness: workspace.estimateReadiness,
          draftReadiness: workspace.draftReadiness,
          submissionReadiness: workspace.submissionReadiness,
          comparisonSummaryState: workspace.comparisonSummaryState,
          freshnessState: workspace.freshnessState,
          lastBlockingReason: getPrimaryBlockingReason(workspace) as FilingWorkspace['lastBlockingReason'] | undefined,
          lastCollectionStatus: workspace.lastCollectionStatus,
          majorUnknowns: getRuntimeMajorUnknowns(workspace),
          updatedAt: workspace.updatedAt,
        },
        draft: draft
          ? {
              draftId: draft.draftId,
              blockerCodes: draft.blockerCodes,
              warningCount: draft.warnings.length,
              fieldValueCount: draft.fieldValues?.length ?? 0,
            }
          : undefined,
        runtimeSnapshot,
        nextRecommendedAction: coverageGapView.nextActionPlan?.recommendedNextAction ?? derived.nextRecommendedAction,
      },
      readiness,
      readinessState,
      nextRecommendedAction: coverageGapView.nextActionPlan?.recommendedNextAction ?? derived.nextRecommendedAction,
    };
  }

  private getFilingSummary(input: GetFilingSummaryInput): MCPResponseEnvelope<GetFilingSummaryData> {
    this.syncWorkspaceSnapshot(input.workspaceId);
    const workspace = this.getWorkspace(input.workspaceId) ?? this.ensureWorkspace(input.workspaceId);
    const draft = this.getDraft(input.workspaceId);
    const nextAction = deriveWorkspaceNextRecommendedAction(workspace);
    const runtimeSnapshot = buildRuntimeSnapshot(workspace);

    const missingFactsView = taxListMissingFacts(input.workspaceId, this.getTaxpayerFacts(input.workspaceId), this.getWithholdingRecords(input.workspaceId), Array.from(this.store.sourceArtifacts.values()), Array.from(this.store.evidenceDocuments.values())).data;
    const missingFacts = missingFactsView.items;
    const coverageGapView = taxWorkspaceListCoverageGaps({ workspaceId: input.workspaceId }, this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? []).data;
    const adjustmentCandidates = taxFilingListAdjustmentCandidates({ workspaceId: input.workspaceId }, this.getTaxpayerFacts(input.workspaceId), Array.from(this.store.transactions.values()), this.getWithholdingRecords(input.workspaceId)).data.items;
    const keyPoints = [
      `workspace_status=${workspace.status}`,
      workspace.currentDraftId ? `current_draft=${workspace.currentDraftId}` : 'current_draft=none',
      `unresolved_reviews=${workspace.unresolvedReviewCount}`,
      `submission_readiness=${getRuntimeSubmissionReadiness(workspace)}`,
      `comparison=${getRuntimeComparisonState(workspace)}`,
      `freshness=${workspace.freshnessState ?? 'stale_unknown'}`,
      `missing_facts=${missingFacts.length}`,
      `submitter_profile_missing=${missingFactsView.submitterProfile?.missingRequiredFields.length ?? 0}`,
      `open_coverage_gaps=${coverageGapView.items.length}`,
      `adjustment_candidates=${adjustmentCandidates.length}`,
      `submission_approval=${workspace.submissionApproval ? 'recorded' : 'missing'}`,
      `submission_result=${workspace.submissionResult?.result ?? 'none'}`,
    ];

    const detailLevel = input.detailLevel ?? 'standard';
    const headline = buildFilingSummaryHeadline(workspace);
    const adjustmentSummary = {
      considered: adjustmentCandidates.length,
      applied: adjustmentCandidates.filter((item) => item.eligibilityState === 'supported' && !item.reviewRequired).length,
      deferred: adjustmentCandidates.filter((item) => item.eligibilityState !== 'out_of_scope' && item.reviewRequired).length,
      unsupported: adjustmentCandidates.filter((item) => item.eligibilityState === 'out_of_scope').length,
    };
    const assistSession = this.getBrowserAssistSession(input.workspaceId);
    const trustState = deriveOperatorTrustState({
      draft,
      workspace,
      reviewItems: this.listReviewItems(input.workspaceId),
      runtimeSnapshot,
      authCheckpoints: this.getAuthCheckpoints(input.workspaceId),
      assistSession,
    });
    const submitState = deriveExternalSubmitState(workspace, assistSession);
    const blockers = trustState.stopReasonCodes;
    const summaryText = buildFilingSummaryText({
      workspace,
      draft,
      blockers,
      nextAction,
      detailLevel,
    });
    const operatorUpdate = buildOperatorUpdate({
      workspace,
      draft,
      blockers,
      nextAction,
      detailLevel,
      headline,
    });
    const readiness = buildRuntimeReadiness(workspace, blockers.filter(isBlockingReason));
    const readinessState = buildRuntimeReadinessState(workspace);
    return {
      ok: true,
      status: 'completed',
      data: {
        workspaceId: input.workspaceId,
        stopReasonCodes: trustState.stopReasonCodes,
        warningCodes: [...trustState.warningCodes, ...((taxFilingListAdjustmentCandidates({ workspaceId: input.workspaceId }, this.getTaxpayerFacts(input.workspaceId), Array.from(this.store.transactions.values()), this.getWithholdingRecords(input.workspaceId)).data.operatorWarnings ?? []).map((item) => item.code))],
        escalationReason: trustState.escalationReason,
        operatorExplanation: trustState.operatorExplanation,
        reviewBatchId: trustState.reviewBatchId,
        workflowState: submitState.workflowState,
        externalSubmitRequired: submitState.externalSubmitRequired,
        draftId: input.draftId ?? draft?.draftId,
        submissionApproval: workspace.submissionApproval,
        submissionResult: workspace.submissionResult,
        adjustmentCandidates,
        adjustmentSummary,
        missingFacts,
        submitterProfile: missingFactsView.submitterProfile,
        headline,
        summaryText,
        operatorUpdate,
        status: workspace.status,
        keyPoints,
        blockers,
        runtimeSnapshot,
        nextRecommendedAction: blockers.includes('awaiting_review_decision') || blockers.includes('comparison_incomplete')
          ? nextAction
          : coverageGapView.nextActionPlan?.recommendedNextAction ?? nextAction,
        metrics: {
          unresolvedReviewCount: workspace.unresolvedReviewCount,
          warningCount: draft?.warnings.length ?? 0,
          fieldValueCount: draft?.fieldValues?.length ?? 0,
        },
      },
      readiness,
      readinessState,
      nextRecommendedAction: nextAction,
    };
  }

  private listWorkspaceSources(input: ListSourcesInput): MCPResponseEnvelope<ListSourcesData> {
    return taxSourcesList(
      input,
      this.listSources(input.workspaceId),
      this.listSyncAttempts().filter((attempt) => attempt.workspaceId === input.workspaceId),
    );
  }

  private disconnectSource(input: DisconnectSourceInput): MCPResponseEnvelope<DisconnectSourceData> {
    const source = this.store.sources.get(input.sourceId);
    if (!source || source.workspaceId !== input.workspaceId) {
      return {
        ok: false,
        status: 'failed',
        data: {
          workspaceId: input.workspaceId,
          sourceId: input.sourceId,
          disconnected: false,
          sourceState: 'planned' as const,
          recordsRetained: true,
          warning: '기존 imported records는 유지되며, 요청한 source를 workspace에서 찾지 못했습니다.',
        },
        errorCode: 'source_not_found',
        errorMessage: `Source ${input.sourceId} was not found in workspace ${input.workspaceId}.`,
        blockingReason: 'insufficient_metadata',
        nextRecommendedAction: 'tax.sources.list',
      };
    }

    const result = taxSourcesDisconnect(input, source);
    this.store.sources.set(input.sourceId, {
      ...source,
      metadata: {
        ...(source.metadata ?? {}),
        futureSyncBlocked: true,
        availability: 'disconnected',
        disconnectedAt: result.data.disconnectedAt,
        disconnectReason: input.reason,
      },
      updatedAt: result.data.disconnectedAt ?? new Date().toISOString(),
    });
    this.syncWorkspaceSnapshot(input.workspaceId);
    return result;
  }

  private uploadTransactions(input: UploadTransactionsInput): MCPResponseEnvelope<UploadTransactionsData> {
    const result = taxImportUploadTransactions(input);
    for (const [index, ref] of input.refs.entries()) {
      const artifactId = result.data.artifactIds[index] ?? `artifact_missing_${index + 1}`;
      if (this.store.sourceArtifacts.has(artifactId)) continue;
      this.store.sourceArtifacts.set(artifactId, {
        artifactId,
        workspaceId: input.workspaceId,
        sourceId: input.sourceId ?? `source_import_${input.workspaceId}`,
        artifactType: inferArtifactTypeFromRef(ref.ref, ref.contentType, input.formatHints),
        ingestedAt: new Date().toISOString(),
        parseStatus: 'pending',
        parseState: 'pending',
        contentRef: ref.ref,
        provenance: {
          importTool: 'tax.import.upload_transactions',
          importMetadata: input.importMetadata,
          formatHints: input.formatHints ?? [],
          sourceType: input.sourceType,
          refMetadata: ref.metadata,
        },
      });
    }
    return result;
  }

  private uploadDocuments(input: UploadDocumentsInput): MCPResponseEnvelope<UploadDocumentsData> {
    const result = taxImportUploadDocuments(input);
    const hints = new Map((input.documentHints ?? []).map((hint) => [hint.ref, hint]));
    for (const [index, ref] of input.refs.entries()) {
      const documentId = result.data.documentIds[index];
      if (!documentId || this.store.evidenceDocuments.has(documentId)) continue;
      const hint = hints.get(ref.ref);
      this.store.evidenceDocuments.set(documentId, {
        documentId,
        workspaceId: input.workspaceId,
        sourceId: input.sourceId ?? `source_import_${input.workspaceId}`,
        documentType: hint?.documentType ?? inferDocumentTypeFromImportRef(ref.ref),
        issuedAt: hint?.issuedAt,
        issuer: hint?.issuer,
        amount: hint?.amount,
        currency: hint?.currency,
        fileRef: ref.ref,
        extractionStatus: 'pending',
        extractedFields: {
          importTool: 'tax.import.upload_documents',
          importMetadata: input.importMetadata,
          hintMetadata: hint?.metadata,
          refMetadata: ref.metadata,
        },
        linkedTransactionIds: hint?.linkedTransactionRefs ?? [],
      });
    }
    return result;
  }

  private submitExtractedReceiptFields(input: SubmitExtractedReceiptFieldsInput): MCPResponseEnvelope<SubmitExtractedReceiptFieldsData> {
    const result = taxImportSubmitExtractedReceiptFields(input);
    const createdIds = new Set(result.data.createdDocumentIds);
    for (const submission of input.submissions) {
      const documentId = submission.documentId
        ?? (submission.documentRef ? buildImportedDocumentIdForRuntime(input.workspaceId, submission.documentRef) : undefined)
        ?? (submission.artifactRef ? buildImportedDocumentIdForRuntime(input.workspaceId, submission.artifactRef) : undefined);
      if (!documentId) continue;
      const current = this.store.evidenceDocuments.get(documentId);
      this.store.evidenceDocuments.set(documentId, {
        documentId,
        workspaceId: input.workspaceId,
        sourceId: current?.sourceId ?? `source_import_${input.workspaceId}`,
        artifactId: current?.artifactId ?? submission.artifactId,
        documentType: current?.documentType ?? submission.documentTypeHint ?? 'receipt',
        fileRef: current?.fileRef ?? submission.documentRef ?? submission.artifactRef ?? documentId,
        extractionStatus: 'extracted',
        linkedTransactionIds: current?.linkedTransactionIds ?? [],
        extractedFields: {
          ...(current?.extractedFields ?? {}),
          ...submission.fields,
          extractorMetadata: input.extractorMetadata,
          ingestionMode: 'ref_only_structured_fields',
        },
        issuedAt: current?.issuedAt,
        issuer: current?.issuer,
        amount: current?.amount,
        currency: current?.currency,
      });
      if (createdIds.has(documentId) && !current) {
        // noop; explicit branch kept for deterministic behavior/readability
      }
    }
    return result;
  }

  private importHomeTaxMaterials(input: ImportHomeTaxMaterialsInput): MCPResponseEnvelope<ImportHomeTaxMaterialsData> {
    const result = taxImportHomeTaxMaterials(input);
    const metadataByRef = new Map((input.materialMetadata ?? []).map((entry) => [entry.ref, entry]));
    for (const item of result.data.recognizedMaterials) {
      if (this.store.sourceArtifacts.has(item.artifactId)) continue;
      const metadata = metadataByRef.get(item.ref);
      this.store.sourceArtifacts.set(item.artifactId, {
        artifactId: item.artifactId,
        workspaceId: input.workspaceId,
        sourceId: input.sourceId ?? `source_hometax_${input.workspaceId}`,
        artifactType: inferArtifactTypeFromRef(item.ref, undefined, ['hometax']),
        ingestedAt: new Date().toISOString(),
        parseStatus: item.supported ? 'pending' : 'failed',
        parseState: item.supported ? 'pending' : 'failed',
        contentRef: item.ref,
        provenance: {
          importTool: 'tax.import.import_hometax_materials',
          importMetadata: input.importMetadata,
          recognizedType: item.recognizedType,
          supported: item.supported,
          observedSection: metadata?.observedSection,
          metadata: metadata?.metadata,
        },
      });
    }
    return result;
  }

  private connectSource(input: ConnectSourceInput): MCPResponseEnvelope<ConnectSourceData> {
    const result = taxSourcesConnect(input, this.store.consentRecords);

    const nextSource: SourceConnection = {
      sourceId: result.data.sourceId,
      workspaceId: input.workspaceId,
      sourceType: input.sourceType as SourceConnection['sourceType'],
      collectionMode: input.sourceType === 'hometax' ? 'browser_assist' : 'export_ingestion',
      scopeGranted: input.requestedScope,
      state: result.data.sourceState,
      connectionStatus: result.data.sourceState,
      lastBlockingReason: result.blockingReason,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.store.sources.set(nextSource.sourceId, nextSource);

    if (result.data.checkpointId) {
      const authCheckpoint: AuthCheckpoint = {
        authCheckpointId: result.data.checkpointId,
        workspaceId: input.workspaceId,
        sourceId: nextSource.sourceId,
        provider: input.sourceType,
        authMethod: input.sourceType === 'hometax' ? 'browser_assist' : 'manual',
        checkpointType: result.data.checkpointType,
        state: result.status === 'awaiting_auth' ? 'pending' : 'completed',
        startedAt: new Date().toISOString(),
      };
      this.store.authCheckpoints.set(authCheckpoint.authCheckpointId, authCheckpoint);
    }

    this.syncWorkspaceSnapshot(input.workspaceId, {
      lastBlockingReason: result.blockingReason,
      status: 'collecting_sources',
    });
    return result;
  }

  private syncSource(input: SyncSourceInput): MCPResponseEnvelope<SyncSourceData> {
    const source = this.store.sources.get(input.sourceId);
    if (source && source.metadata?.futureSyncBlocked === true) {
      return buildDisconnectedSourceSyncEnvelope(source, input.syncMode);
    }

    const result = taxSourcesSync(input);

    if (source && result.data.sourceState) {
      this.store.sources.set(input.sourceId, {
        ...source,
        state: result.data.sourceState,
        connectionStatus: result.data.sourceState,
        lastBlockingReason: result.blockingReason,
        updatedAt: new Date().toISOString(),
      });
    }

    const attemptId = result.resumeToken ? `sync_${input.sourceId}_${input.syncMode}` : `sync_${input.sourceId}_${Date.now()}`;
    const syncAttempt: SyncAttempt = {
      syncAttemptId: attemptId,
      workspaceId: source?.workspaceId ?? extractWorkspaceIdFromSourceId(input.sourceId),
      sourceId: input.sourceId,
      mode: input.syncMode,
      state: result.data.syncAttemptState ?? (result.ok ? 'completed' : 'blocked'),
      checkpointType: result.checkpointType,
      checkpointId: result.checkpointId,
      blockingReason: result.blockingReason,
      pendingUserAction: result.pendingUserAction,
      fallbackOptions: result.fallbackOptions,
      startedAt: new Date().toISOString(),
      endedAt: result.ok ? new Date().toISOString() : undefined,
      attemptSummary: result.ok ? 'Sync completed.' : undefined,
    };

    this.store.syncAttempts.set(syncAttempt.syncAttemptId, syncAttempt);

    if (result.checkpointId) {
      const existingCheckpoint = this.store.authCheckpoints.get(result.checkpointId);
      const authCheckpoint: AuthCheckpoint = {
        authCheckpointId: result.checkpointId,
        workspaceId: syncAttempt.workspaceId,
        sourceId: input.sourceId,
        provider: source?.sourceType ?? 'unknown',
        authMethod: source?.collectionMode === 'browser_assist' ? 'browser_assist' : 'manual',
        checkpointType: result.checkpointType,
        state: result.status === 'awaiting_user_action' ? 'in_progress' : 'completed',
        startedAt: existingCheckpoint?.startedAt ?? new Date().toISOString(),
        sessionBinding: syncAttempt.syncAttemptId,
      };
      this.store.authCheckpoints.set(authCheckpoint.authCheckpointId, authCheckpoint);
    }

    this.syncWorkspaceSnapshot(syncAttempt.workspaceId, {
      lastBlockingReason: result.blockingReason,
      lastCollectionStatus: syncAttempt.state,
      status: result.ok ? 'collecting' : 'collecting_sources',
    });
    return result;
  }

  private resumeSync(input: ResumeSyncInput): MCPResponseEnvelope<ResumeSyncData> {
    const disconnectedSourceId = input.sourceId ?? Array.from(this.store.syncAttempts.values()).find((attempt) => attempt.syncAttemptId === input.syncSessionId)?.sourceId;
    const disconnectedSource = disconnectedSourceId ? this.store.sources.get(disconnectedSourceId) : undefined;
    if (disconnectedSource && disconnectedSource.metadata?.futureSyncBlocked === true) {
      return buildDisconnectedSourceResumeEnvelope(disconnectedSource, input);
    }

    const result = taxSourcesResumeSync(input);
    const attemptId = result.data.syncSessionId;
    const existingAttempt = Array.from(this.store.syncAttempts.values()).find(
      (attempt) => attempt.sourceId === result.data.sourceId || attempt.syncAttemptId === attemptId,
    );

    const completedAttempt: SyncAttempt = {
      syncAttemptId: attemptId,
      workspaceId: existingAttempt?.workspaceId ?? extractWorkspaceIdFromSourceId(result.data.sourceId),
      sourceId: result.data.sourceId ?? existingAttempt?.sourceId ?? 'unknown_source',
      mode: existingAttempt?.mode ?? 'full',
      state: result.data.syncAttemptState ?? 'completed',
      checkpointType: undefined,
      checkpointId: input.checkpointId,
      startedAt: existingAttempt?.startedAt ?? new Date().toISOString(),
      endedAt: new Date().toISOString(),
      attemptSummary: `Imported ${result.data.importedArtifactCount} artifacts after resume.`,
    };

    this.store.syncAttempts.set(completedAttempt.syncAttemptId, completedAttempt);

    if (input.checkpointId) {
      const existingCheckpoint = this.store.authCheckpoints.get(input.checkpointId);
      if (existingCheckpoint) {
        this.store.authCheckpoints.set(input.checkpointId, {
          ...existingCheckpoint,
          state: 'completed',
          completedAt: new Date().toISOString(),
          sessionBinding: completedAttempt.syncAttemptId,
        });
      }
    }

    const sourceId = result.data.sourceId;
    if (sourceId) {
      const source = this.store.sources.get(sourceId);
      if (source) {
        this.store.sources.set(sourceId, {
          ...source,
          state: 'completed',
          connectionStatus: 'completed',
          lastSyncAt: new Date().toISOString(),
          lastSuccessfulSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    this.reconcileCoverageGapsForWorkspace(completedAttempt.workspaceId);
    this.syncWorkspaceSnapshot(completedAttempt.workspaceId, {
      lastCollectionStatus: completedAttempt.state,
      status: 'collecting',
    });

    return result;
  }

  private normalizeLedger(input: NormalizeLedgerInput): MCPResponseEnvelope<NormalizeLedgerData> {
    const result = taxLedgerNormalize(input, {
      transactions: Array.from(this.store.transactions.values()),
      evidenceDocuments: Array.from(this.store.evidenceDocuments.values()),
      withholdingRecords: this.getWithholdingRecords(input.workspaceId),
      coverageGaps: this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? [],
    });

    for (const artifact of result.data.normalizedArtifacts ?? []) {
      this.store.sourceArtifacts.set(artifact.artifactId, artifact);
    }
    for (const document of result.data.normalizedDocuments ?? []) {
      this.store.evidenceDocuments.set(document.documentId, document);
    }
    for (const transaction of result.data.normalizedTransactions ?? []) {
      this.store.transactions.set(transaction.transactionId, transaction);
    }

    const normalizedLinkage = (result.data.normalizedArtifacts ?? []).map((artifact) => ({
      artifactId: artifact.artifactId,
      documentIds: (result.data.normalizedDocuments ?? []).filter((document) => document.artifactId === artifact.artifactId).map((document) => document.documentId),
      transactionIds: (result.data.normalizedTransactions ?? []).filter((transaction) => transaction.artifactId === artifact.artifactId).map((transaction) => transaction.transactionId),
      withholdingRecordIds: [...result.data.withholdingRecordsCreated, ...result.data.withholdingRecordsUpdated]
        .filter((record) => record.evidenceRefs.some((ref) => (result.data.normalizedDocuments ?? []).some((document) => document.artifactId === artifact.artifactId && document.documentId === ref)))
        .map((record) => record.withholdingRecordId),
    }));
    this.store.normalizationLinksByWorkspace.set(input.workspaceId, mergeNormalizationLinks(this.store.normalizationLinksByWorkspace.get(input.workspaceId) ?? [], normalizedLinkage));

    const scopedTransactions = Array.from(this.store.transactions.values()).filter((tx) => tx.workspaceId === input.workspaceId);
    const taxpayerFacts = buildRuntimeTaxpayerFacts(input.workspaceId, scopedTransactions, mergeWithholdingRecords(this.getWithholdingRecords(input.workspaceId), result.data.withholdingRecordsCreated, result.data.withholdingRecordsUpdated));
    const withholdingRecords = mergeWithholdingRecords(this.getWithholdingRecords(input.workspaceId), result.data.withholdingRecordsCreated, result.data.withholdingRecordsUpdated);
    const coverageGaps = mergeCoverageGaps(this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? [], result.data.coverageGapsCreated);

    this.store.taxpayerFactsByWorkspace.set(input.workspaceId, taxpayerFacts);
    this.store.withholdingRecordsByWorkspace.set(input.workspaceId, withholdingRecords);
    this.store.coverageGapsByWorkspace.set(input.workspaceId, coverageGaps);
    this.appendAuditEvent(input.workspaceId, result.audit, {
      normalizationMode: input.normalizationMode ?? 'default',
      artifactIds: input.artifactIds ?? [],
      transactionCount: result.data.transactionCount,
      documentCount: result.data.documentCount,
      duplicateCandidateCount: result.data.duplicateCandidateCount,
      withholdingCreated: result.data.withholdingRecordsCreated.length,
      withholdingUpdated: result.data.withholdingRecordsUpdated.length,
      coverageGapsCreated: result.data.coverageGapsCreated.length,
    });
    this.reconcileCoverageGapsForWorkspace(input.workspaceId);
    this.syncWorkspaceSnapshot(input.workspaceId, {
      status: result.data.transactionCount > 0 || result.data.documentCount > 0 ? 'normalizing' : 'collecting',
    });
    return result;
  }

  private listTransactions(input: ListTransactionsInput): MCPResponseEnvelope<ListTransactionsData> {
    const limit = Math.max(1, Math.min(input.limit ?? 50, 200));
    const offset = Math.max(0, input.offset ?? 0);
    const allRows = Array.from(this.store.transactions.values())
      .filter((tx) => tx.workspaceId === input.workspaceId)
      .filter((tx) => !input.dateFrom || tx.occurredAt >= input.dateFrom)
      .filter((tx) => !input.dateTo || tx.occurredAt <= input.dateTo)
      .filter((tx) => !input.direction || tx.normalizedDirection === input.direction)
      .filter((tx) => !input.reviewStatus || (tx.reviewStatus ?? 'unreviewed') === input.reviewStatus)
      .map((tx) => {
        const evidenceRefs = [...tx.evidenceRefs];
        const evidenceLinkStatus = evidenceRefs.length === 0 ? 'unlinked' : 'linked';
        return {
          transactionId: tx.transactionId,
          occurredAt: tx.occurredAt,
          postedAt: tx.postedAt,
          amount: tx.amount,
          currency: tx.currency,
          normalizedDirection: tx.normalizedDirection,
          counterparty: tx.counterparty,
          description: tx.description,
          reviewStatus: tx.reviewStatus,
          evidenceLink: {
            status: evidenceLinkStatus as 'linked' | 'unlinked' | 'partial',
            evidenceRefs,
            documentCount: evidenceRefs.length,
          },
        };
      })
      .filter((row) => !input.evidenceStatus || row.evidenceLink.status === input.evidenceStatus);

    const normalizationMissing = allRows.length === 0 && Array.from(this.store.sourceArtifacts.values()).some((artifact) => artifact.workspaceId === input.workspaceId);
    const rows = allRows.slice(offset, offset + limit);
    return {
      ok: true,
      status: 'completed',
      data: {
        workspaceId: input.workspaceId,
        rows,
        page: {
          total: allRows.length,
          limit,
          offset,
          returned: rows.length,
        },
      },
      warnings: normalizationMissing ? [{ code: 'normalization_incomplete', message: 'Imported artifacts exist but no normalized transactions are available yet.', severity: 'medium' }] : undefined,
      nextRecommendedAction: normalizationMissing ? 'tax.ledger.normalize' : (allRows.some((row) => row.evidenceLink.status === 'unlinked') ? 'tax.ledger.link_evidence' : 'tax.classify.run'),
    };
  }

  private linkEvidence(input: LinkEvidenceInput): MCPResponseEnvelope<LinkEvidenceData> {
    const warnings: NonNullable<MCPResponseEnvelope<LinkEvidenceData>['warnings']> = [];
    const validTransactions = input.transactionIds
      .map((id) => this.store.transactions.get(id))
      .filter((tx): tx is LedgerTransaction => Boolean(tx));
    const validDocuments = input.documentIds
      .map((id) => this.store.evidenceDocuments.get(id))
      .filter((doc): doc is EvidenceDocument => Boolean(doc));

    for (const txId of input.transactionIds) {
      const tx = this.store.transactions.get(txId);
      if (!tx) {
        warnings.push({ code: 'invalid_transaction_id', message: `Transaction ${txId} was not found.`, severity: 'medium' });
      } else if (tx.workspaceId !== input.workspaceId) {
        warnings.push({ code: 'cross_workspace_transaction', message: `Transaction ${txId} belongs to a different workspace.`, severity: 'high' });
      }
    }
    for (const docId of input.documentIds) {
      const doc = this.store.evidenceDocuments.get(docId);
      if (!doc) {
        warnings.push({ code: 'invalid_document_id', message: `Document ${docId} was not found.`, severity: 'medium' });
      } else if (doc.workspaceId !== input.workspaceId) {
        warnings.push({ code: 'cross_workspace_document', message: `Document ${docId} belongs to a different workspace.`, severity: 'high' });
      }
    }

    const scopedTransactions = validTransactions.filter((tx) => tx.workspaceId === input.workspaceId);
    const scopedDocuments = validDocuments.filter((doc) => doc.workspaceId === input.workspaceId);
    const affectedTransactionIds: string[] = [];
    const affectedDocumentIds = scopedDocuments.map((doc) => doc.documentId);
    const createdReviewItems: ReviewItem[] = [];

    for (const tx of scopedTransactions) {
      const nextEvidenceRefs = input.linkMode === 'replace'
        ? affectedDocumentIds
        : Array.from(new Set([...tx.evidenceRefs, ...affectedDocumentIds]));
      this.store.transactions.set(tx.transactionId, {
        ...tx,
        evidenceRefs: nextEvidenceRefs,
      });
      affectedTransactionIds.push(tx.transactionId);

      if (
        nextEvidenceRefs.length === 0
        || nextEvidenceRefs.length !== affectedDocumentIds.length
        || (scopedTransactions.length > 1 && affectedDocumentIds.length === 1)
      ) {
        const reviewItem: ReviewItem = {
          reviewItemId: `review_${input.workspaceId}_${tx.transactionId}_evidence_link`,
          workspaceId: input.workspaceId,
          reasonCode: 'evidence_link_review',
          severity: 'medium',
          question: `거래 ${tx.transactionId} 의 증빙 링크를 검토하세요.`,
          candidateOptions: ['accept_links', 'replace_links', 'request_more_evidence'],
          suggestedOption: nextEvidenceRefs.length === 0 ? 'request_more_evidence' : 'accept_links',
          linkedEntityIds: [tx.transactionId, ...affectedDocumentIds],
          impactEstimate: { linkMode: input.linkMode, evidenceRefs: nextEvidenceRefs },
          resolutionState: 'open',
        };
        this.store.reviewItems.set(reviewItem.reviewItemId, reviewItem);
        createdReviewItems.push(reviewItem);
      }
    }

    for (const doc of scopedDocuments) {
      const nextLinkedIds = input.linkMode === 'replace'
        ? [...affectedTransactionIds]
        : Array.from(new Set([...(doc.linkedTransactionIds ?? []), ...affectedTransactionIds]));
      this.store.evidenceDocuments.set(doc.documentId, {
        ...doc,
        linkedTransactionIds: nextLinkedIds,
      });
    }

    const normalizationLinks = this.store.normalizationLinksByWorkspace.get(input.workspaceId) ?? [];
    this.store.normalizationLinksByWorkspace.set(input.workspaceId, [
      ...normalizationLinks,
      ...affectedTransactionIds.map((transactionId) => ({
        artifactId: `manual_link_${transactionId}`,
        documentIds: affectedDocumentIds,
        transactionIds: [transactionId],
        withholdingRecordIds: [],
      })),
    ]);
    this.syncWorkspaceSnapshot(input.workspaceId);

    return {
      ok: warnings.some((warning) => warning.code.startsWith('cross_workspace')) ? false : true,
      status: warnings.some((warning) => warning.code.startsWith('cross_workspace')) ? 'failed' : 'completed',
      data: {
        workspaceId: input.workspaceId,
        linkMode: input.linkMode,
        affectedTransactionIds,
        affectedDocumentIds,
        reviewItemIds: createdReviewItems.map((item) => item.reviewItemId),
        evidenceLinks: affectedTransactionIds.map((transactionId) => ({
          transactionId,
          evidenceRefs: this.store.transactions.get(transactionId)?.evidenceRefs ?? [],
        })),
      },
      warnings: warnings.length > 0 ? warnings : undefined,
      errorCode: warnings.some((warning) => warning.code.startsWith('cross_workspace')) ? 'cross_workspace_link_rejected' : undefined,
      errorMessage: warnings.some((warning) => warning.code.startsWith('cross_workspace')) ? 'Cross-workspace evidence linking is not allowed.' : undefined,
      nextRecommendedAction: createdReviewItems.length > 0 ? 'tax.classify.list_review_items' : 'tax.classify.run',
    };
  }

  private listWithholdingRecords(input: ListWithholdingRecordsInput): MCPResponseEnvelope<ListWithholdingRecordsData> {
    const rows = this.getWithholdingRecords(input.workspaceId)
      .filter((record) => input.filingYear === undefined || record.filingYear === input.filingYear)
      .filter((record) => !input.payerOrIssuer || (record.payerOrIssuer ?? record.payerName ?? '').includes(input.payerOrIssuer))
      .filter((record) => !input.reviewStatus || (record.reviewStatus ?? '') === input.reviewStatus)
      .filter((record) => !input.evidenceStatus || (input.evidenceStatus === 'linked' ? record.evidenceRefs.length > 0 : record.evidenceRefs.length === 0))
      .map((record) => ({
        withholdingRecordId: record.withholdingRecordId,
        filingYear: record.filingYear,
        payerOrIssuer: record.payerOrIssuer ?? record.payerName,
        incomeSourceRef: record.incomeSourceRef,
        grossAmount: record.grossAmount,
        withheldTaxAmount: record.withheldTaxAmount,
        localTaxAmount: record.localTaxAmount,
        evidenceRefs: record.evidenceRefs,
        sourceType: record.sourceType,
        confidenceScore: record.confidenceScore ?? record.extractionConfidence,
        reviewStatus: record.reviewStatus,
        hasEvidence: record.evidenceRefs.length > 0,
      }));
    const warnings = rows.some((row) => row.reviewStatus === 'conflict_detected')
      ? ['withholding_conflicts_present']
      : rows.some((row) => row.reviewStatus === 'review_required')
        ? ['withholding_review_required']
        : [];
    return {
      ok: true,
      status: 'completed',
      data: { workspaceId: input.workspaceId, rows, warnings },
      nextRecommendedAction: warnings.length > 0 ? 'tax.classify.list_review_items' : 'tax.filing.compute_draft',
    };
  }

  private listAdjustmentCandidates(input: ListAdjustmentCandidatesInput): MCPResponseEnvelope<ListAdjustmentCandidatesData> {
    return taxFilingListAdjustmentCandidates(
      input,
      this.getTaxpayerFacts(input.workspaceId),
      Array.from(this.store.transactions.values()),
      this.getWithholdingRecords(input.workspaceId),
    );
  }

  private detectFilingPath(input: DetectFilingPathInput): MCPResponseEnvelope<DetectFilingPathData> {
    const missingFacts = taxListMissingFacts(input.workspaceId, this.getTaxpayerFacts(input.workspaceId), this.getWithholdingRecords(input.workspaceId), Array.from(this.store.sourceArtifacts.values()), Array.from(this.store.evidenceDocuments.values())).data.items;
    const result = taxProfileDetectFilingPath(
      input,
      Array.from(this.store.transactions.values()),
      this.listReviewItems(input.workspaceId),
      this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? [],
      this.getTaxpayerFacts(input.workspaceId),
      this.getWithholdingRecords(input.workspaceId),
      Array.from(this.store.sourceArtifacts.values()),
      Array.from(this.store.evidenceDocuments.values()),
    );
    this.syncWorkspaceSnapshot(input.workspaceId);
    return {
      ...result,
      data: {
        ...result.data,
        missingFactDetails: missingFacts,
      },
    };
  }

  private upsertFacts(input: UpsertTaxpayerFactsInput): MCPResponseEnvelope<UpsertTaxpayerFactsData> {
    const existing = new Map(this.getTaxpayerFacts(input.workspaceId).map((fact) => [fact.factKey, fact] as const));
    const now = new Date().toISOString();
    const updatedFacts = input.facts.map((fact) => ({
      ...existing.get(fact.factKey),
      factId: existing.get(fact.factKey)?.factId ?? `fact_${input.workspaceId}_${fact.factKey}`,
      workspaceId: input.workspaceId,
      category: fact.category,
      factKey: fact.factKey,
      value: fact.value,
      status: fact.status,
      sourceOfTruth: fact.sourceOfTruth,
      confidence: fact.confidence,
      evidenceRefs: fact.evidenceRefs,
      note: fact.note,
      provenance: fact.provenance,
      updatedAt: now,
    }));
    const merged = new Map(existing);
    for (const fact of updatedFacts) merged.set(fact.factKey, fact);
    this.store.taxpayerFactsByWorkspace.set(input.workspaceId, Array.from(merged.values()));

    const missingFactSummary = taxListMissingFacts(input.workspaceId, Array.from(merged.values()), this.getWithholdingRecords(input.workspaceId), Array.from(this.store.sourceArtifacts.values()), Array.from(this.store.evidenceDocuments.values())).data.items;
    this.store.coverageGapsByWorkspace.set(
      input.workspaceId,
      reconcileFactCoverageGaps(input.workspaceId, this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? [], missingFactSummary),
    );
    syncFactReviewItems(this.store.reviewItems, input.workspaceId, missingFactSummary);
    this.syncWorkspaceSnapshot(input.workspaceId);

    return {
      ok: true,
      status: 'completed',
      data: { updatedFacts, missingFactSummary },
      nextRecommendedAction: missingFactSummary.length > 0 ? 'tax.profile.list_missing_facts' : 'tax.profile.detect_filing_path',
      audit: { eventType: 'taxpayer_facts_upserted', eventId: `evt_taxpayer_facts_upserted_${input.workspaceId}` },
    };
  }

  private listMissingFacts(input: ListMissingFactsInput): MCPResponseEnvelope<ListMissingFactsData> {
    const result = taxListMissingFacts(input.workspaceId, this.getTaxpayerFacts(input.workspaceId), this.getWithholdingRecords(input.workspaceId), Array.from(this.store.sourceArtifacts.values()), Array.from(this.store.evidenceDocuments.values()));
    return {
      ...result,
      blockingReason: result.data.items.some((item) => item.priority === 'high') ? 'insufficient_metadata' : result.blockingReason,
      nextRecommendedAction: result.data.items.length > 0 ? 'tax.profile.upsert_facts' : 'tax.profile.detect_filing_path',
    };
  }

  private runClassification(input: RunClassificationInput): MCPResponseEnvelope<RunClassificationData> {
    const result = taxClassifyRun(input, Array.from(this.store.transactions.values()));
    for (const decision of result.data.decisions ?? []) {
      this.store.decisions.set(decision.decisionId, decision);
    }
    for (const item of result.data.reviewItems ?? []) {
      this.store.reviewItems.set(item.reviewItemId, item);
    }
    this.syncWorkspaceSnapshot(input.workspaceId, {
      lastBlockingReason: result.blockingReason,
      status: (result.data.reviewItems?.length ?? 0) > 0 ? 'review_pending' : 'normalizing',
    });
    return result;
  }

  private getReviewQueue(input: { workspaceId: string }): MCPResponseEnvelope<{ items: ReviewItem[]; summary: ReturnType<typeof taxClassifyListReviewItems>['data']['summary'] }> {
    return taxClassifyListReviewItems(input.workspaceId, this.listReviewItems(input.workspaceId));
  }

  private resolveReviewItems(input: ResolveReviewItemInput): MCPResponseEnvelope<ResolveReviewItemData> {
    const result = taxClassifyResolveReviewItem(input, this.listReviewItems(), this.listDecisions());
    for (const item of result.data.updatedItems ?? []) {
      this.store.reviewItems.set(item.reviewItemId, item);
    }
    for (const decision of result.data.generatedDecisions ?? []) {
      this.store.decisions.set(decision.decisionId, decision);
    }

    const touchedWorkspaceIds = new Set((result.data.updatedItems ?? []).map((item) => item.workspaceId));
    for (const workspaceId of touchedWorkspaceIds) {
      this.applyComparisonReviewResolution(workspaceId, result.data.updatedItems ?? [], input.selectedOption);
      this.syncWorkspaceSnapshot(workspaceId);
    }

    return result;
  }

  private applyComparisonReviewResolution(workspaceId: string, updatedItems: ReviewItem[], selectedOption: string): void {
    const draft = this.getDraft(workspaceId);
    if (!draft?.fieldValues?.length) return;

    const mismatchItems = updatedItems.filter((item) => item.workspaceId === workspaceId && item.reasonCode === 'hometax_material_mismatch');
    if (mismatchItems.length === 0) return;

    const itemMap = new Map(mismatchItems.map((item) => {
      const fieldRef = item.linkedEntityIds.find((id) => id.includes(':'));
      return [fieldRef, item] as const;
    }));

    const nextFieldValues = draft.fieldValues.map((field) => {
      const key = `${field.sectionKey}:${field.fieldKey}`;
      const item = itemMap.get(key);
      if (!item) return field;

      if (selectedOption === 'accept_portal_value') {
        return {
          ...field,
          value: field.portalObservedValue ?? field.value,
          comparisonState: 'matched' as const,
          mismatchSeverity: undefined,
        };
      }

      if (selectedOption === 'keep_draft_value') {
        return {
          ...field,
          comparisonState: 'matched' as const,
          mismatchSeverity: undefined,
        };
      }

      if (selectedOption === 'mark_manual_followup') {
        return {
          ...field,
          requiresManualEntry: true,
          comparisonState: 'manual_only' as const,
          mismatchSeverity: undefined,
        };
      }

      return field;
    });

    const unresolvedItems = this.listReviewItems(workspaceId);
    const calibrated = deriveCalibratedReadiness({
      supportTier: draft.supportTier,
      filingPathKind: draft.filingPathKind,
      reviewItems: unresolvedItems,
      draft: {
        draftId: draft.draftId,
        fieldValues: nextFieldValues,
      },
    });
    const readiness = deriveReadinessSummary({
      supportTier: draft.supportTier,
      filingPathKind: draft.filingPathKind,
      reviewItems: unresolvedItems,
      draft: {
        draftId: draft.draftId,
        fieldValues: nextFieldValues,
      },
    });

    this.store.draftsByWorkspace.set(workspaceId, {
      ...draft,
      fieldValues: nextFieldValues,
      blockerCodes: readiness.blockerCodes,
      supportTier: readiness.supportTier,
      filingPathKind: readiness.filingPathKind,
      estimateReadiness: readiness.estimateReadiness,
      draftReadiness: readiness.draftReadiness,
      submissionReadiness: readiness.submissionReadiness,
      comparisonSummaryState: readiness.comparisonSummaryState,
      freshnessState: readiness.freshnessState,
      majorUnknowns: readiness.majorUnknowns,
      calibration: {
        readiness: calibrated.workspaceReadiness,
        coverageByDomain: calibrated.coverageByDomain,
        materialCoverageSummary: calibrated.materialCoverageSummary,
        majorUnknowns: calibrated.majorUnknowns,
        highSeverityReviewCount: unresolvedItems.filter((item) => item.severity === 'high' || item.severity === 'critical').length,
        submissionComparisonState: calibrated.submissionComparisonState,
        capturedAt: new Date().toISOString(),
      },
    });
    this.setFieldValuesForWorkspace(workspaceId, nextFieldValues);
  }

  private computeDraft(input: ComputeDraftInput): MCPResponseEnvelope<ComputeDraftData> {
    const result = taxFilingComputeDraft(
      input,
      Array.from(this.store.transactions.values()),
      this.listDecisions(input.workspaceId),
      this.listReviewItems(input.workspaceId),
      this.getTaxpayerFacts(input.workspaceId),
      this.getWithholdingRecords(input.workspaceId),
      this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? [],
      this.getFilingFieldValues(input.workspaceId),
      Array.from(this.store.sourceArtifacts.values()),
      Array.from(this.store.evidenceDocuments.values()),
    );
    this.store.draftsByWorkspace.set(input.workspaceId, {
      ...result.data,
      factCompleteness: taxListMissingFacts(input.workspaceId, this.getTaxpayerFacts(input.workspaceId), this.getWithholdingRecords(input.workspaceId), Array.from(this.store.sourceArtifacts.values()), Array.from(this.store.evidenceDocuments.values())).data.items,
    });
    this.store.taxpayerFactsByWorkspace.set(input.workspaceId, result.data.taxpayerFacts ?? this.getTaxpayerFacts(input.workspaceId));
    this.store.withholdingRecordsByWorkspace.set(input.workspaceId, result.data.withholdingRecords ?? this.getWithholdingRecords(input.workspaceId));
    this.setFieldValuesForWorkspace(input.workspaceId, result.data.fieldValues ?? []);
    this.reconcileCoverageGapsForWorkspace(input.workspaceId);
    this.syncWorkspaceSnapshot(input.workspaceId);
    return result;
  }

  private compareWithHomeTax(input: CompareWithHomeTaxInput): MCPResponseEnvelope<CompareWithHomeTaxData> {
    const draft = this.getDraft(input.workspaceId);
    const fieldValues = this.getFilingFieldValues(input.workspaceId);
    const result = taxFilingCompareWithHomeTax(input, fieldValues.length > 0 ? fieldValues : draft?.fieldValues ?? []);

    if (draft && result.data.fieldValues && result.readinessState && result.readiness) {
      this.setFieldValuesForWorkspace(input.workspaceId, result.data.fieldValues);
      this.store.draftsByWorkspace.set(input.workspaceId, {
        ...draft,
        fieldValues: result.data.fieldValues,
        blockerCodes: result.readiness.blockerCodes,
        supportTier: result.readiness.supportTier,
        filingPathKind: result.readiness.filingPathKind,
        estimateReadiness: result.readiness.estimateReadiness,
        draftReadiness: result.readiness.draftReadiness,
        submissionReadiness: result.readiness.submissionReadiness,
        comparisonSummaryState: result.readiness.comparisonSummaryState,
        freshnessState: result.readiness.freshnessState,
        majorUnknowns: result.readiness.majorUnknowns,
        calibration: {
          readiness: result.readinessState.readiness,
          coverageByDomain: result.readinessState.coverageByDomain ?? draft.calibration?.coverageByDomain ?? {
            filingPath: 'weak', incomeInventory: 'weak', withholdingPrepaidTax: 'weak', expenseEvidence: 'weak', deductionFacts: 'weak', submissionComparison: 'weak',
          },
          materialCoverageSummary: result.readinessState.materialCoverageSummary ?? draft.calibration?.materialCoverageSummary ?? { strongDomains: [], partialDomains: [], weakDomains: ['filingPath', 'incomeInventory', 'withholdingPrepaidTax', 'expenseEvidence', 'deductionFacts', 'submissionComparison'] },
          majorUnknowns: result.readinessState.majorUnknowns ?? result.readiness.majorUnknowns,
          highSeverityReviewCount: this.listReviewItems(input.workspaceId).filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed' && (item.severity === 'high' || item.severity === 'critical')).length,
          submissionComparisonState: getRuntimeComparisonSubmissionStateFromReadinessState(result.readinessState),
          capturedAt: new Date().toISOString(),
        },
      });
    }

    for (const item of buildComparisonReviewItems(input.workspaceId, input.draftId, result.data.materialMismatches)) {
      if (!this.store.reviewItems.has(item.reviewItemId)) {
        this.store.reviewItems.set(item.reviewItemId, item);
      }
    }

    this.syncWorkspaceSnapshot(input.workspaceId);

    return {
      ...result,
      nextRecommendedAction: result.data.materialMismatches.length > 0 ? 'tax.classify.list_review_items' : result.nextRecommendedAction,
    };
  }

  private refreshOfficialData(input: RefreshOfficialDataInput): MCPResponseEnvelope<RefreshOfficialDataData> {
    const draft = this.getDraft(input.workspaceId);
    const result = taxFilingRefreshOfficialData(input, draft ? { draftId: draft.draftId, fieldValues: draft.fieldValues } : undefined);

    if (draft?.fieldValues && result.readinessState && result.readiness) {
      const refreshedFieldValues = draft.fieldValues.map((field) => ({ ...field, freshnessState: 'current_enough' as const }));
      this.setFieldValuesForWorkspace(input.workspaceId, refreshedFieldValues);
      this.store.draftsByWorkspace.set(input.workspaceId, {
        ...draft,
        draftId: result.data.recomputedDraftId ?? draft.draftId,
        fieldValues: refreshedFieldValues,
        blockerCodes: result.readiness.blockerCodes,
        supportTier: result.readiness.supportTier,
        filingPathKind: result.readiness.filingPathKind,
        estimateReadiness: result.readiness.estimateReadiness,
        draftReadiness: result.readiness.draftReadiness,
        submissionReadiness: result.readiness.submissionReadiness,
        comparisonSummaryState: result.readiness.comparisonSummaryState,
        freshnessState: result.readiness.freshnessState,
        majorUnknowns: result.readiness.majorUnknowns,
        calibration: {
          readiness: result.readinessState.readiness,
          coverageByDomain: result.readinessState.coverageByDomain ?? draft.calibration?.coverageByDomain ?? {
            filingPath: 'weak', incomeInventory: 'weak', withholdingPrepaidTax: 'weak', expenseEvidence: 'weak', deductionFacts: 'weak', submissionComparison: 'weak',
          },
          materialCoverageSummary: result.readinessState.materialCoverageSummary ?? draft.calibration?.materialCoverageSummary ?? { strongDomains: [], partialDomains: [], weakDomains: ['filingPath', 'incomeInventory', 'withholdingPrepaidTax', 'expenseEvidence', 'deductionFacts', 'submissionComparison'] },
          majorUnknowns: result.readinessState.majorUnknowns ?? result.readiness.majorUnknowns,
          highSeverityReviewCount: this.listReviewItems(input.workspaceId).filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed' && (item.severity === 'high' || item.severity === 'critical')).length,
          submissionComparisonState: getRuntimeComparisonSubmissionStateFromReadinessState(result.readinessState),
          capturedAt: new Date().toISOString(),
        },
      });
    }

    this.syncWorkspaceSnapshot(input.workspaceId);
    return result;
  }

  private prepareHomeTax(input: PrepareHomeTaxInput): MCPResponseEnvelope<PrepareHomeTaxData> {
    const draft = this.getDraft(input.workspaceId);
    const result = taxFilingPrepareHomeTax(
      input,
      this.listReviewItems(input.workspaceId),
      this.getFilingFieldValues(input.workspaceId).length > 0 ? this.getFilingFieldValues(input.workspaceId) : draft?.fieldValues ?? [],
      {
        supportTier: draft?.supportTier ?? (draft?.fieldValues && draft.fieldValues.length > 0 ? 'tier_a' : 'undetermined'),
        filingPathKind: draft?.filingPathKind ?? (draft?.fieldValues && draft.fieldValues.length > 0 ? 'mixed_income_limited' : 'unknown'),
      },
      this.getTaxpayerFacts(input.workspaceId),
    );
    const adjustmentCandidates = taxFilingListAdjustmentCandidates(
      { workspaceId: input.workspaceId },
      this.getTaxpayerFacts(input.workspaceId),
      Array.from(this.store.transactions.values()),
      this.getWithholdingRecords(input.workspaceId),
    ).data.items;
    result.data.adjustmentCandidates = adjustmentCandidates;
    if (adjustmentCandidates.some((item) => item.eligibilityState !== 'supported' || item.reviewRequired)) {
      result.data.handoff.manualVerificationChecklist.push('공제/세액공제/조정 candidate 중 수기 확인 또는 판단이 필요한 항목을 확인');
      result.data.handoff.blockingItems = Array.from(new Set([
        ...result.data.handoff.blockingItems,
        'adjustment_manual_confirmation_required',
      ]));
      result.data.orderedSections.push({
        order: result.data.orderedSections.length + 1,
        sectionKey: 'filing_adjustments',
        checkpointType: 'review_judgment',
        fieldRefs: adjustmentCandidates.map((item) => `adjustment.${item.adjustmentType}`),
        mappedFields: adjustmentCandidates.map((item) => ({
          fieldKey: item.adjustmentType,
          fieldRef: `adjustment.${item.adjustmentType}`,
          value: item.amountCandidate ?? item.eligibilityState,
          comparisonState: 'not_compared',
          sourceOfTruth: 'inferred',
          requiresManualEntry: item.eligibilityState !== 'supported',
          blocked: item.reviewRequired || item.eligibilityState !== 'supported',
          comparisonNeeded: false,
          sourceProvenanceRefs: item.requiredEvidenceRefs,
          mismatchState: item.reviewRequired ? 'review_required' : 'matched',
          reviewStatus: item.reviewRequired ? 'open' : 'none',
          entryInstruction: item.eligibilityState === 'supported' ? '공제/세액공제 적용 여부 및 금액을 수기 확인' : '수기 판단 또는 수기 입력 필요',
        })),
        manualOnlyFields: adjustmentCandidates.filter((item) => item.eligibilityState !== 'supported').map((item) => `adjustment.${item.adjustmentType}`),
        blockedFields: adjustmentCandidates.filter((item) => item.reviewRequired || item.eligibilityState !== 'supported').map((item) => `adjustment.${item.adjustmentType}`),
        comparisonNeededFields: [],
        mismatchFields: [],
        blockingItems: ['adjustment_manual_confirmation_required'],
      });
    }
    if (draft) {
      this.store.draftsByWorkspace.set(input.workspaceId, {
        ...draft,
        hometaxPreparation: result.data,
      } as ComputeDraftData);
    }
    this.syncWorkspaceSnapshot(input.workspaceId, {
      lastBlockingReason: result.blockingReason,
      status: result.ok ? 'ready_for_hometax_assist' : 'draft_ready_for_review',
    });
    return result;
  }

  private exportPackage(input: ExportPackageInput): MCPResponseEnvelope<ExportPackageData> {
    const workspace = this.getWorkspace(input.workspaceId);
    const draft = this.getDraft(input.workspaceId);
    const draftId = input.draftId ?? draft?.draftId ?? workspace?.currentDraftId;
    const now = new Date().toISOString();
    const exportBatchId = `export_${input.workspaceId}_${Date.now()}`;
    const summary = this.invoke('tax.filing.get_summary', { workspaceId: input.workspaceId, draftId, detailLevel: 'standard' }).data;
    const reviewItems = this.listReviewItems(input.workspaceId);
    const evidenceDocuments = Array.from(this.store.evidenceDocuments.values()).filter((doc) => doc.workspaceId === input.workspaceId);
    const sourceArtifacts = Array.from(this.store.sourceArtifacts.values()).filter((artifact) => artifact.workspaceId === input.workspaceId);
    const submitterProfileView = taxListMissingFacts(input.workspaceId, this.getTaxpayerFacts(input.workspaceId), this.getWithholdingRecords(input.workspaceId), Array.from(this.store.sourceArtifacts.values()), Array.from(this.store.evidenceDocuments.values())).data.submitterProfile;
    const businessAccountComplianceWarning = taxFilingListAdjustmentCandidates({ workspaceId: input.workspaceId }, this.getTaxpayerFacts(input.workspaceId), Array.from(this.store.transactions.values()), this.getWithholdingRecords(input.workspaceId)).data.operatorWarnings?.some((item) => item.code === 'business_account_compliance_required');
    const checklistPreview = [
      `final_state=${workspace?.status ?? 'unknown'}`,
      `final_approval=${workspace?.submissionApproval ? 'recorded' : 'missing'}`,
      `material_mismatch=${draft?.stopReasonCodes?.includes('severe_mismatch') ? 'present' : 'none'}`,
      `missing_coverage=${(workspace?.openCoverageGapCount ?? 0) > 0 ? 'present' : 'none'}`,
      `business_account_compliance=${businessAccountComplianceWarning ? 'review_required' : 'none'}`,
      `submitter_profile=${(submitterProfileView?.missingRequiredFields.length ?? 0) === 0 ? 'complete' : `missing:${submitterProfileView?.missingRequiredFields.join('|')}`}`,
      `receipt_confirmation=${workspace?.submissionResult?.receiptNumber || (workspace?.submissionResult?.receiptArtifactRefs?.length ?? 0) > 0 ? 'recorded' : 'pending'}`,
    ];
    const unresolvedBlockers = summary.stopReasonCodes ?? draft?.stopReasonCodes ?? [];
    const artifacts: SourceArtifact[] = [];
    const pushArtifact = (suffix: string, artifactType: SourceArtifact['artifactType'], payload: Record<string, unknown>) => {
      const artifact: SourceArtifact = {
        artifactId: `${exportBatchId}_${suffix}`,
        workspaceId: input.workspaceId,
        sourceId: `source_export_${input.workspaceId}`,
        artifactType,
        ingestedAt: now,
        parseStatus: 'parsed',
        parseState: 'parsed',
        contentRef: `snapshot://exports/${exportBatchId}/${suffix}`,
        provenance: {
          exportTool: 'tax.filing.export_package',
          exportBatchId,
          readOnly: true,
          payload,
        },
      };
      this.store.sourceArtifacts.set(artifact.artifactId, artifact);
      artifacts.push(artifact);
    };

    if (input.formats.includes('json_package')) {
      pushArtifact('json_package', 'json', {
        workspace,
        draft,
        summary,
        reviewItems,
        unresolvedBlockers,
      });
    }
    if (input.formats.includes('csv_review_report')) {
      pushArtifact('csv_review_report', 'csv', {
        rows: reviewItems.map((item) => ({ reviewItemId: item.reviewItemId, severity: item.severity, reasonCode: item.reasonCode, status: item.resolutionState })),
        unresolvedBlockers,
      });
    }
    if (input.formats.includes('evidence_index')) {
      pushArtifact('evidence_index', 'json', {
        sources: this.listSources(input.workspaceId).map((source) => ({ sourceId: source.sourceId, sourceType: source.sourceType, state: source.state })),
        evidenceDocuments: evidenceDocuments.map((doc) => ({ documentId: doc.documentId, sourceId: doc.sourceId, documentType: doc.documentType, fileRef: doc.fileRef, linkedTransactionIds: doc.linkedTransactionIds, extractionStatus: doc.extractionStatus })),
        sourceArtifacts: sourceArtifacts.map((artifact) => ({ artifactId: artifact.artifactId, sourceId: artifact.sourceId, artifactType: artifact.artifactType, contentRef: artifact.contentRef, provenance: artifact.provenance })),
        reviewItems: reviewItems.map((item) => ({ reviewItemId: item.reviewItemId, status: item.resolutionState, severity: item.severity })),
      });
    }
    if (input.formats.includes('submission_prep_checklist')) {
      pushArtifact('submission_prep_checklist', 'json', {
        checklist: checklistPreview,
        unresolvedBlockers,
        submissionApproval: workspace?.submissionApproval,
        submissionResult: workspace?.submissionResult,
      });
    }
    if (input.formats.includes('submission_receipt_bundle') && workspace?.submissionResult) {
      pushArtifact('submission_receipt_bundle', 'json', {
        submissionResult: workspace.submissionResult,
        receiptArtifactRefs: workspace.submissionResult.receiptArtifactRefs,
      });
    }

    this.appendAuditEvent(input.workspaceId, { eventType: 'draft_computed', eventId: `evt_export_package_${exportBatchId}` }, { exportBatchId, formats: input.formats, artifactIds: artifacts.map((a) => a.artifactId) });
    return {
      ok: true,
      status: 'completed',
      data: {
        workspaceId: input.workspaceId,
        draftId,
        exportBatchId,
        artifacts,
        includedFormats: input.formats.filter((format) => format !== 'submission_receipt_bundle' || Boolean(workspace?.submissionResult)),
        unresolvedBlockers,
        checklistPreview,
      },
      nextRecommendedAction: unresolvedBlockers.length > 0 ? 'tax.workspace.get_status' : 'tax.filing.get_summary',
    };
  }

  private recordSubmissionApproval(input: RecordSubmissionApprovalInput): MCPResponseEnvelope<RecordSubmissionApprovalData> {
    const approval: SubmissionApprovalRecord = {
      approvalId: `submission_approval_${input.workspaceId}_${input.draftId}`,
      workspaceId: input.workspaceId,
      draftId: input.draftId,
      approvedBy: input.approvedBy,
      approvedAt: input.approvedAt ?? new Date().toISOString(),
      note: input.note,
    };
    const workspace = this.store.workspaces.get(input.workspaceId);
    if (workspace) {
      workspace.submissionApproval = approval;
      workspace.status = 'awaiting_final_approval';
      this.store.workspaces.set(input.workspaceId, workspace);
    }
    const session = this.getBrowserAssistSession(input.workspaceId);
    if (session) {
      session.submissionState = 'awaiting_final_approval';
      session.pendingUserAction = 'Final approval is recorded. External browser agent must perform the final submit click.';
      session.updatedAt = new Date().toISOString();
      this.store.assistSessionsByWorkspace.set(input.workspaceId, session);
    }
    this.appendAuditEvent(input.workspaceId, { eventType: 'submission_approval_recorded', eventId: `evt_submission_approval_${input.workspaceId}` }, { draftId: input.draftId, approvedBy: input.approvedBy });
    return { ok: true, status: 'completed', data: { approval }, nextRecommendedAction: 'tax.browser.record_submission_result' };
  }

  private startHomeTaxAssist(input: StartHomeTaxAssistInput): MCPResponseEnvelope<StartHomeTaxAssistData> {
    const prepared = this.prepareHomeTax({ workspaceId: input.workspaceId, draftId: input.draftId });
    const draft = this.getDraft(input.workspaceId);
    const submissionReadiness = prepared.readiness?.submissionReadiness ?? draft?.submissionReadiness;

    if (!prepared.ok || submissionReadiness !== 'submission_assist_ready') {
      return {
        ok: false,
        status: 'blocked',
        blockingReason: prepared.blockingReason ?? 'submission_not_ready',
        pendingUserAction: prepared.pendingUserAction ?? 'HomeTax assist can start only after submission-assist-ready state is reached.',
        nextRecommendedAction: prepared.nextRecommendedAction ?? 'tax.filing.prepare_hometax',
        data: {
          assistSessionId: `assist_${input.workspaceId}_${input.draftId}`,
          checkpointType: prepared.checkpointType ?? 'review_judgment',
          checkpointKey: prepared.data.handoff?.orderedSections[0]?.checkpointKey,
          screenKey: prepared.data.handoff?.orderedSections[0]?.screenKey,
          authRequired: false,
          handoff: prepared.data.handoff,
          entryPlan: prepared.data.handoff,
          submissionState: this.store.workspaces.get(input.workspaceId)?.submissionResult
            ? this.store.workspaces.get(input.workspaceId)?.status as StartHomeTaxAssistData['submissionState']
            : this.store.workspaces.get(input.workspaceId)?.submissionApproval
              ? 'awaiting_final_approval'
              : undefined,
          allowedNextActions: prepared.data.handoff?.allowedNextActions,
          resumePreconditions: prepared.data.handoff?.resumePreconditions,
          retryPolicy: prepared.data.handoff?.retryPolicy,
        },
      };
    }

    const result = taxBrowserStartHomeTaxAssist(input);
    result.data.handoff = prepared.data.handoff;
    result.data.entryPlan = prepared.data.handoff;
    const assistContract = deriveAssistCheckpointContract({
      draft,
      prepared: prepared.data,
      reviewItems: this.listReviewItems(input.workspaceId),
    });
    result.data.checkpointKey = assistContract.checkpointKey;
    result.data.screenKey = assistContract.screenKey;
    result.data.allowedNextActions = assistContract.allowedNextActions;
    result.data.resumePreconditions = assistContract.resumePreconditions;
    result.data.retryPolicy = assistContract.retryPolicy;
    result.data.submissionState = this.store.workspaces.get(input.workspaceId)?.submissionResult
      ? this.store.workspaces.get(input.workspaceId)?.status as StartHomeTaxAssistData['submissionState']
      : this.store.workspaces.get(input.workspaceId)?.submissionApproval
        ? 'awaiting_final_approval'
        : undefined;
    const browserAssistSession: BrowserAssistSession = {
      assistSessionId: result.data.assistSessionId,
      workspaceId: input.workspaceId,
      draftId: input.draftId,
      provider: 'hometax',
      checkpointType: result.data.checkpointType,
      checkpointKey: result.data.checkpointKey,
      screenKey: result.data.screenKey,
      draftVersion: draft?.draftVersion,
      authState: result.requiresAuth ? 'pending' : 'completed',
      pendingUserAction: result.pendingUserAction,
      handoff: prepared.data.handoff,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as BrowserAssistSession;
    this.store.assistSessionsByWorkspace.set(input.workspaceId, browserAssistSession);

    if (result.checkpointId) {
      this.store.authCheckpoints.set(result.checkpointId, {
        authCheckpointId: result.checkpointId,
        workspaceId: input.workspaceId,
        sourceId: `assist:${result.data.assistSessionId}`,
        provider: 'hometax',
        authMethod: 'browser_assist',
        checkpointType: result.data.checkpointType,
        state: result.requiresAuth ? 'pending' : 'completed',
        startedAt: browserAssistSession.startedAt,
        sessionBinding: result.data.assistSessionId,
      });
    }

    this.syncWorkspaceSnapshot(input.workspaceId, {
      lastBlockingReason: result.blockingReason,
      status: 'submission_in_progress',
    });
    return result;
  }

  private recordSubmissionResult(input: RecordSubmissionResultInput): MCPResponseEnvelope<RecordSubmissionResultData> {
    const workspace = this.store.workspaces.get(input.workspaceId);
    if (!workspace?.submissionApproval || workspace.submissionApproval.draftId !== input.draftId) {
      return {
        ok: false,
        status: 'blocked',
        blockingReason: 'awaiting_final_approval',
        data: { submissionResult: {
          submissionResultId: `submission_result_${input.workspaceId}_${input.draftId}`,
          workspaceId: input.workspaceId,
          draftId: input.draftId,
          result: 'unknown',
          portalObservedAt: input.portalObservedAt ?? new Date().toISOString(),
          portalSummary: 'Final approval record is missing.',
          receiptArtifactRefs: input.receiptArtifactRefs ?? [],
          receiptNumber: input.receiptNumber,
          submittedAt: input.submittedAt,
          nextSteps: ['Record final approval before submission result.'],
          verificationRequired: true,
        } },
        nextRecommendedAction: 'tax.filing.record_submission_approval',
      };
    }
    const submissionResult: SubmissionResultRecord = {
      submissionResultId: `submission_result_${input.workspaceId}_${input.draftId}`,
      workspaceId: input.workspaceId,
      draftId: input.draftId,
      result: input.result,
      portalObservedAt: input.portalObservedAt ?? new Date().toISOString(),
      portalSummary: input.portalSummary,
      receiptArtifactRefs: input.receiptArtifactRefs ?? [],
      receiptNumber: input.receiptNumber,
      submittedAt: input.submittedAt,
      nextSteps: input.nextSteps ?? (input.result === 'success' ? ['Verify receipt and archive filing artifacts.'] : input.result === 'fail' ? ['Inspect portal error and retry with review.'] : ['Verify portal state manually before claiming success.']),
      verificationRequired: input.verificationRequired ?? input.result !== 'success',
    };
    workspace.submissionResult = submissionResult;
    workspace.status = input.result === 'success' ? 'submitted' : input.result === 'fail' ? 'submission_failed' : 'submission_uncertain';
    this.store.workspaces.set(input.workspaceId, workspace);
    const session = this.getBrowserAssistSession(input.workspaceId);
    if (session) {
      const endedAt = new Date().toISOString();
      session.submissionState = workspace.status as BrowserAssistSession['submissionState'];
      session.pendingUserAction = input.result === 'success'
        ? 'Submission recorded successfully. Verify receipt and archive artifacts.'
        : input.result === 'fail'
          ? 'Submission failed. Review portal error and decide whether to retry.'
          : 'Submission result is uncertain. Verify portal state before claiming success.';
      session.updatedAt = endedAt;
      session.endedAt = endedAt;
      this.store.assistSessionsByWorkspace.set(input.workspaceId, session);
    }
    this.syncWorkspaceSnapshot(input.workspaceId, {
      status: workspace.status,
      lastBlockingReason: undefined,
    });
    this.appendAuditEvent(input.workspaceId, { eventType: 'submission_result_recorded', eventId: `evt_submission_result_${input.workspaceId}` }, { draftId: input.draftId, result: input.result, receiptNumber: input.receiptNumber, receiptArtifactRefs: submissionResult.receiptArtifactRefs, assistSessionClosed: Boolean(session) });
    return {
      ok: true,
      status: 'completed',
      data: { submissionResult },
      nextRecommendedAction: 'tax.filing.export_package',
    };
  }

  private resumeHomeTaxAssist(input: ResumeHomeTaxAssistInput): MCPResponseEnvelope<ResumeHomeTaxAssistData> {
    const session = input.assistSessionId
      ? Array.from(this.store.assistSessionsByWorkspace.values()).find((candidate) => candidate.assistSessionId === input.assistSessionId && candidate.workspaceId === input.workspaceId)
      : this.getBrowserAssistSession(input.workspaceId);

    if (!session) {
      return {
        ok: false,
        status: 'failed',
        data: {
          assistSessionId: input.assistSessionId ?? `assist_missing_${input.workspaceId}`,
          draftId: this.getDraft(input.workspaceId)?.draftId ?? 'unknown_draft',
          checkpointType: 'authentication',
          authRequired: true,
          handoff: {
            provider: 'hometax',
            recommendedTool: 'tax.browser.resume_hometax_assist',
            entryPlan: getDraftHomeTaxPreparation(this.getDraft(input.workspaceId))?.handoff,
          },
        },
        errorCode: 'assist_session_not_found',
        errorMessage: `No active HomeTax assist session found for workspace ${input.workspaceId}.`,
      };
    }

    const result = taxBrowserResumeHomeTaxAssist(input, session);
    const currentDraft = this.getDraft(input.workspaceId);
    const prepared = getDraftHomeTaxPreparation(currentDraft);
    const preparedHandoff = prepared?.handoff;
    result.data.handoff.entryPlan = preparedHandoff;
    const assistContract = deriveAssistCheckpointContract({
      draft: currentDraft,
      session,
      prepared,
      reviewItems: this.listReviewItems(input.workspaceId),
    });
    result.data.checkpointKey = assistContract.checkpointKey;
    result.data.screenKey = assistContract.screenKey;
    result.data.allowedNextActions = assistContract.allowedNextActions;
    result.data.resumePreconditions = assistContract.resumePreconditions;
    result.data.retryPolicy = assistContract.retryPolicy;
    this.store.assistSessionsByWorkspace.set(input.workspaceId, {
      ...session,
      checkpointType: result.data.checkpointType,
      checkpointKey: result.data.checkpointKey,
      screenKey: result.data.screenKey,
      authState: result.requiresAuth ? 'pending' : session.authState ?? 'completed',
      pendingUserAction: assistContract.blockedReason ? 'Resume blocked until MCP blockers are resolved.' : result.pendingUserAction,
      handoff: preparedHandoff,
      lastKnownSection: result.data.handoff.targetSection,
      updatedAt: new Date().toISOString(),
    } as BrowserAssistSession);
    if (assistContract.blockedReason) {
      return {
        ...result,
        ok: false,
        status: 'blocked',
        blockingReason: assistContract.blockedReason,
        pendingUserAction: 'Resolve MCP blockers before browser resume.',
        nextRecommendedAction: 'tax.browser.get_checkpoint',
      };
    }
    this.syncWorkspaceSnapshot(input.workspaceId, {
      lastBlockingReason: result.blockingReason,
      status: 'submission_in_progress',
    });
    return result;
  }

  private getHomeTaxCheckpoint(input: GetHomeTaxCheckpointInput): MCPResponseEnvelope<GetHomeTaxCheckpointData> {
    const session = this.findAssistSession(input.assistSessionId, input.workspaceId);
    if (!session) {
      return {
        ok: false,
        status: 'failed',
        data: buildBrowserAssistCheckpointSnapshot({
          assistSessionId: input.assistSessionId,
          workspaceId: input.workspaceId ?? 'unknown_workspace',
          draftId: this.getDraft(input.workspaceId ?? 'unknown_workspace')?.draftId ?? 'unknown_draft',
          checkpointType: 'authentication',
          stopped: false,
          authRequired: true,
          sessionRef: input.assistSessionId,
          workspaceRef: input.workspaceId ?? 'unknown_workspace',
          draftRef: this.getDraft(input.workspaceId ?? 'unknown_workspace')?.draftId ?? 'unknown_draft',
          provider: 'hometax',
          recommendedTool: 'tax.browser.get_checkpoint',
          entryPlan: getDraftHomeTaxPreparation(this.getDraft(input.workspaceId ?? 'unknown_workspace'))?.handoff,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        errorCode: 'assist_session_not_found',
        errorMessage: `Assist session ${input.assistSessionId} was not found.`,
        blockingReason: 'insufficient_metadata',
        nextRecommendedAction: 'tax.browser.start_hometax_assist',
      };
    }

    const stopped = Boolean(session.endedAt);
    const workspace = this.store.workspaces.get(session.workspaceId);
    const currentDraft = this.getDraft(session.workspaceId);
    const prepared = getDraftHomeTaxPreparation(currentDraft);
    const assistContract = deriveAssistCheckpointContract({ draft: currentDraft, session, prepared, reviewItems: this.listReviewItems(session.workspaceId) });
    const finalSubmissionState = session.submissionState ?? (workspace?.status === 'submitted' ? 'submitted' : workspace?.status === 'submission_failed' ? 'submission_failed' : workspace?.status === 'submission_uncertain' ? 'submission_uncertain' : undefined);
    const submitState = deriveExternalSubmitState(workspace, session);
    const stoppedReason = ((session as BrowserAssistSession & { stopReason?: StopHomeTaxAssistInput['stopReason'] }).stopReason) ?? 'user_pause';
    const stoppedRetryPolicy = stoppedReason === 'auth_expired' ? 'reauth_then_resume' : stoppedReason === 'operator_restart' || stoppedReason === 'browser_closed' ? 'refresh_prepare_then_restart' : 'manual_confirmation_then_resume';
    const stoppedResumePreconditions = stoppedReason === 'auth_expired'
      ? ['user must complete authentication again before resume']
      : stoppedReason === 'operator_restart' || stoppedReason === 'browser_closed'
        ? ['start a fresh assist session from current prepare_hometax output']
        : stoppedReason === 'final_approval_pause'
          ? ['external browser agent must perform the final submit click after approval']
          : ['resume from the preserved checkpoint when ready'];
    return {
      ok: true,
      status: finalSubmissionState || submitState.externalSubmitRequired ? 'completed' : (stopped ? 'blocked' : (session.authState === 'completed' ? 'in_progress' : 'awaiting_auth')),
      data: {
        ...buildBrowserAssistCheckpointSnapshot({
        assistSessionId: session.assistSessionId,
        workspaceId: session.workspaceId,
        draftId: session.draftId,
        checkpointType: session.checkpointType,
        checkpointKey: assistContract.checkpointKey ?? session.checkpointKey,
        screenKey: assistContract.screenKey ?? session.screenKey,
        stopped,
        authRequired: finalSubmissionState || submitState.externalSubmitRequired ? false : session.authState !== 'completed',
        blocker: finalSubmissionState || submitState.externalSubmitRequired ? undefined : (stopped ? (stoppedReason === 'auth_expired' ? 'missing_auth' : assistContract.blockedReason) : (assistContract.blockedReason ?? (session.authState !== 'completed' ? 'missing_auth' : undefined))),
        pendingUserAction: finalSubmissionState
          ? (session.pendingUserAction ?? 'Submission lifecycle has been closed for this assist session.')
          : submitState.externalSubmitRequired
            ? 'Final approval is recorded. External browser agent must perform the final submit click.'
            : (stopped ? (stoppedReason === 'operator_restart' || stoppedReason === 'browser_closed' ? 'This session is stopped. Start a fresh assist session from the current prepare_hometax output.' : '세션은 중단되었습니다. 필요시 같은 세션에서 재개하세요.') : (assistContract.blockedReason ? 'Resolve MCP blockers before browser progression.' : session.pendingUserAction)),
        allowedNextActions: finalSubmissionState ? ['tax.filing.export_package', 'tax.workspace.get_status'] : submitState.externalSubmitRequired ? ['external_final_submit_click', 'tax.browser.record_submission_result'] : assistContract.allowedNextActions,
        resumePreconditions: finalSubmissionState ? [] : submitState.externalSubmitRequired ? ['external browser agent must perform the final submit click before result recording'] : (stopped ? stoppedResumePreconditions : assistContract.resumePreconditions),
        retryPolicy: finalSubmissionState ? undefined : submitState.externalSubmitRequired ? undefined : (stopped ? stoppedRetryPolicy : assistContract.retryPolicy),
        sessionRef: session.assistSessionId,
        workspaceRef: session.workspaceId,
        draftRef: session.draftId,
        provider: session.provider ?? 'hometax',
        targetSection: session.lastKnownSection,
        recommendedTool: stopped ? 'tax.browser.get_checkpoint' : 'tax.browser.resume_hometax_assist',
        entryPlan: getDraftHomeTaxPreparation(this.getDraft(session.workspaceId))?.handoff,
        startedAt: session.startedAt,
        updatedAt: session.updatedAt,
        endedAt: session.endedAt,
        authState: session.authState,
      }),
        submissionApproval: workspace?.submissionApproval,
        submissionResult: workspace?.submissionResult,
        workflowState: submitState.workflowState,
        externalSubmitRequired: submitState.externalSubmitRequired,
      },
      blockingReason: finalSubmissionState || submitState.externalSubmitRequired ? undefined : (stopped ? (stoppedReason === 'auth_expired' ? 'missing_auth' : assistContract.blockedReason) : (assistContract.blockedReason ?? (session.authState !== 'completed' ? 'missing_auth' : undefined))),
      pendingUserAction: finalSubmissionState
        ? (session.pendingUserAction ?? 'Submission lifecycle has been closed for this assist session.')
        : submitState.externalSubmitRequired
          ? 'Final approval is recorded. External browser agent must perform the final submit click.'
          : (stopped ? (stoppedReason === 'operator_restart' || stoppedReason === 'browser_closed' ? 'Start a fresh assist session from the current prepare_hometax output.' : 'Resume from this preserved assist session when ready.') : (assistContract.blockedReason ? 'Resolve MCP blockers before browser progression.' : session.pendingUserAction)),
      nextRecommendedAction: submitState.externalSubmitRequired ? 'tax.browser.record_submission_result' : finalSubmissionState ? 'tax.filing.export_package' : (stopped ? ((stoppedReason === 'operator_restart' || stoppedReason === 'browser_closed') ? 'tax.browser.start_hometax_assist' : 'tax.browser.resume_hometax_assist') : (assistContract.blockedReason ? 'tax.browser.get_checkpoint' : 'tax.browser.resume_hometax_assist')),
    };
  }

  private stopHomeTaxAssist(input: StopHomeTaxAssistInput): MCPResponseEnvelope<StopHomeTaxAssistData> {
    const session = this.findAssistSession(input.assistSessionId, input.workspaceId);
    if (!session) {
      return {
        ok: false,
        status: 'failed',
        data: {
          ...buildBrowserAssistCheckpointSnapshot({
            assistSessionId: input.assistSessionId,
            workspaceId: input.workspaceId ?? 'unknown_workspace',
            draftId: this.getDraft(input.workspaceId ?? 'unknown_workspace')?.draftId ?? 'unknown_draft',
            checkpointType: 'authentication',
            stopped: true,
            authRequired: true,
            sessionRef: input.assistSessionId,
            workspaceRef: input.workspaceId ?? 'unknown_workspace',
            draftRef: this.getDraft(input.workspaceId ?? 'unknown_workspace')?.draftId ?? 'unknown_draft',
            provider: 'hometax',
            recommendedTool: 'tax.browser.get_checkpoint',
            startedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
          preservedContext: {
            auditable: true,
            canRestartFromSession: false,
            preservedFields: ['assistSessionId', 'workspaceId'],
          },
        },
        errorCode: 'assist_session_not_found',
        errorMessage: `Assist session ${input.assistSessionId} was not found.`,
        nextRecommendedAction: 'tax.browser.start_hometax_assist',
      };
    }

    const stopReason = input.stopReason ?? 'user_pause';
    const stopMode = input.stopMode ?? ((stopReason === 'browser_closed' || stopReason === 'operator_restart') ? 'restart_required' : 'pause');
    const canRestartFromSession = stopMode === 'pause' && stopReason !== 'browser_closed' && stopReason !== 'operator_restart';
    const nextAction = canRestartFromSession ? 'tax.browser.resume_hometax_assist' : 'tax.browser.start_hometax_assist';
    const blocker = stopReason === 'auth_expired' ? 'missing_auth' : undefined;
    const pendingUserAction = stopReason === 'final_approval_pause'
      ? 'Final approval is recorded. External browser agent must perform the final submit click.'
      : stopReason === 'auth_expired'
        ? 'Authentication expired. Complete authentication again before resuming.'
        : stopReason === 'browser_closed'
          ? 'Browser context was lost. Start a fresh assist session from the current prepare_hometax output.'
          : stopReason === 'operator_restart'
            ? 'Operator requested restart. Start a fresh assist session from the current prepare_hometax output.'
            : 'Session paused. Resume from the preserved checkpoint when ready.';
    const stoppedAt = session.endedAt ?? new Date().toISOString();
    const nextSession = {
      ...session,
      endedAt: stoppedAt,
      updatedAt: stoppedAt,
      pendingUserAction,
      stopReason,
      stopMode,
    } as BrowserAssistSession & { stopReason?: StopHomeTaxAssistInput['stopReason']; stopMode?: StopHomeTaxAssistInput['stopMode'] };
    this.store.assistSessionsByWorkspace.set(nextSession.workspaceId, nextSession);
    const statusHint = stopReason === 'final_approval_pause'
      ? 'awaiting_final_approval'
      : stopReason === 'auth_expired'
        ? 'submission_in_progress'
        : 'draft_ready_for_review';
    this.syncWorkspaceSnapshot(nextSession.workspaceId, { lastBlockingReason: blocker, status: statusHint as FilingWorkspace['status'] });

    return {
      ok: true,
      status: 'completed',
      data: {
        ...buildBrowserAssistCheckpointSnapshot({
          assistSessionId: nextSession.assistSessionId,
          workspaceId: nextSession.workspaceId,
          draftId: nextSession.draftId,
          checkpointType: nextSession.checkpointType,
          stopped: true,
          authRequired: stopReason === 'auth_expired',
          blocker,
          pendingUserAction,
          allowedNextActions: stopReason === 'final_approval_pause' ? ['external_final_submit_click', 'tax.browser.record_submission_result'] : [nextAction],
          resumePreconditions: stopReason === 'auth_expired'
            ? ['user must complete authentication again before resume']
            : stopReason === 'final_approval_pause'
              ? ['external browser agent must perform the final submit click']
              : canRestartFromSession
                ? ['resume from the preserved checkpoint when ready']
                : ['start a fresh assist session from current prepare_hometax output'],
          retryPolicy: stopReason === 'auth_expired' ? 'reauth_then_resume' : canRestartFromSession ? 'manual_confirmation_then_resume' : 'refresh_prepare_then_restart',
          sessionRef: nextSession.assistSessionId,
          workspaceRef: nextSession.workspaceId,
          draftRef: nextSession.draftId,
          provider: nextSession.provider ?? 'hometax',
          targetSection: nextSession.lastKnownSection,
          recommendedTool: 'tax.browser.get_checkpoint',
          startedAt: nextSession.startedAt,
          updatedAt: nextSession.updatedAt,
          endedAt: nextSession.endedAt,
          authState: nextSession.authState,
        }),
        stopMode,
        stopReason,
        preservedContext: {
          auditable: true,
          canRestartFromSession,
          mustStartNewSession: !canRestartFromSession,
          restartGuidance: canRestartFromSession ? 'resume_hometax_assist' : 'start_hometax_assist',
          preservedFields: ['assistSessionId', 'workspaceId', 'draftId', 'checkpointType', 'lastKnownSection', 'authState', 'startedAt', 'updatedAt', 'endedAt', 'stopReason', 'stopMode'],
        },
      },
      progress: { phase: 'browser_assist', step: 'stop_session', percent: 100 },
      audit: { eventType: 'browser_assist_stopped', eventId: `evt_browser_assist_stopped_${nextSession.assistSessionId}` },
      nextRecommendedAction: stopReason === 'final_approval_pause' ? 'tax.browser.record_submission_result' : nextAction,
    };
  }

  private reconcileCoverageGapsForWorkspace(workspaceId: string): void {
    const existingGaps = this.store.coverageGapsByWorkspace.get(workspaceId) ?? [];
    const preservedGaps = existingGaps.filter((gap) => gap.gapType !== 'missing_withholding_record');
    const hasIncomeTransactions = Array.from(this.store.transactions.values()).some((tx) => tx.workspaceId === workspaceId && tx.normalizedDirection === 'income');
    const withholdingRecords = this.getWithholdingRecords(workspaceId);

    if (hasIncomeTransactions && withholdingRecords.length === 0) {
      preservedGaps.push({
        gapId: `gap_${workspaceId}_missing_withholding_record_runtime`,
        workspaceId,
        gapType: 'missing_withholding_record',
        severity: 'medium',
        description: 'Income activity exists but no withholding record has been collected yet.',
        affectedArea: 'withholding',
        affectedDomains: ['withholdingPrepaidTax'],
        materiality: 'medium',
        blocksEstimate: false,
        blocksDraft: true,
        blocksSubmission: true,
        recommendedNextSource: 'hometax',
        recommendedNextAction: 'tax.sources.plan_collection',
        relatedSourceIds: this.listSources(workspaceId).filter((source) => source.sourceType === 'hometax').map((source) => source.sourceId),
        sourceRefs: withholdingRecords.flatMap((record) => record.evidenceRefs),
        state: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    this.store.coverageGapsByWorkspace.set(workspaceId, preservedGaps);
  }

  private appendAuditEvent(workspaceId: string, audit: MCPResponseEnvelope['audit'] | undefined, metadata: Record<string, unknown>): void {
    if (!audit) return;
    const current = this.store.auditEventsByWorkspace.get(workspaceId) ?? [];
    current.push({
      workspaceId,
      eventType: audit.eventType as AuditEvent['eventType'],
      actorType: 'system',
      eventId: audit.eventId,
      summary: 'Ledger normalization completed.',
      metadata,
      createdAt: new Date().toISOString(),
    });
    this.store.auditEventsByWorkspace.set(workspaceId, current);
  }
}

function mergeWithholdingRecords(existing: WithholdingRecord[], created: WithholdingRecord[], updated: WithholdingRecord[]): WithholdingRecord[] {
  const merged = new Map(existing.map((record) => [record.withholdingRecordId, record] as const));
  for (const record of [...created, ...updated]) merged.set(record.withholdingRecordId, record);
  return Array.from(merged.values());
}

function mergeCoverageGaps(existing: CoverageGap[], created: CoverageGap[]): CoverageGap[] {
  const merged = new Map(existing.map((gap) => [gap.gapId, gap] as const));
  for (const gap of created) merged.set(gap.gapId, gap);
  return Array.from(merged.values());
}

function mergeNormalizationLinks(
  existing: { artifactId: string; documentIds: string[]; transactionIds: string[]; withholdingRecordIds: string[] }[],
  created: { artifactId: string; documentIds: string[]; transactionIds: string[]; withholdingRecordIds: string[] }[],
) {
  const merged = new Map(existing.map((entry) => [entry.artifactId, entry] as const));
  for (const entry of created) merged.set(entry.artifactId, entry);
  return Array.from(merged.values());
}

function humanizeToken(value: string): string {
  return value.replace(/_/g, ' ');
}

function describeBlockingReason(reason: string): string {
  switch (reason) {
    case 'awaiting_review_decision':
      return 'review decisions are still pending';
    case 'comparison_incomplete':
      return 'HomeTax comparison has not been completed yet';
    case 'official_data_refresh_required':
      return 'official data refresh is still required';
    case 'missing_material_coverage':
      return 'material coverage is still missing';
    case 'unsupported_filing_path':
      return 'the filing path is outside the supported prototype scope';
    case 'missing_auth':
      return 'user authentication is still required';
    case 'missing_consent':
      return 'required consent is still missing';
    case 'export_required':
      return 'an export or manual artifact handoff is still required';
    default:
      return humanizeToken(reason);
  }
}

function describeRecommendedAction(action: string): string {
  switch (action) {
    case 'tax.classify.list_review_items':
      return 'open the review queue and resolve pending items';
    case 'tax.filing.compute_draft':
      return 'compute or refresh the filing draft';
    case 'tax.filing.refresh_official_data':
      return 'refresh official data before continuing';
    case 'tax.filing.compare_with_hometax':
      return 'run the HomeTax comparison step';
    case 'tax.filing.prepare_hometax':
      return 'prepare the draft for HomeTax handoff';
    case 'tax.sources.resume_sync':
      return 'resume the blocked source sync flow';
    default:
      return action;
  }
}

function buildOperatorUpdate(params: {
  workspace: FilingWorkspace;
  draft?: ComputeDraftData;
  blockers: string[];
  nextAction?: string;
  detailLevel: 'short' | 'standard';
  headline: string;
}): string {
  const lines = buildOperatorUpdateLines(params);
  return lines.join('\n');
}

function buildOperatorUpdateLines(params: {
  workspace: FilingWorkspace;
  draft?: ComputeDraftData;
  blockers: string[];
  nextAction?: string;
  detailLevel: 'short' | 'standard';
  headline: string;
}): string[] {
  const readinessLine = `READINESS: submission=${humanizeToken(getRuntimeSubmissionReadiness(params.workspace))} | comparison=${humanizeToken(getRuntimeComparisonState(params.workspace))} | freshness=${humanizeToken(params.workspace.freshnessState ?? 'stale_unknown')}`;
  const queueLine = `QUEUE: reviews=${params.workspace.unresolvedReviewCount} | warnings=${params.draft?.warnings.length ?? 0} | draft=${params.workspace.currentDraftId ?? 'none'}`;
  const blockerLine = buildPrimaryBlockerLine(params.workspace, params.blockers);
  const blockerContextLine = buildPrimaryBlockerContextLine(params.workspace);
  const nextLine = params.nextAction ? `NEXT: ${describeRecommendedAction(params.nextAction)}` : undefined;
  const draftLine = params.detailLevel === 'standard' && (params.draft?.fieldValues?.length ?? 0) > 0
    ? `DRAFT: fields=${params.draft?.fieldValues?.length ?? 0}`
    : undefined;

  if (params.workspace.status === 'submission_in_progress') {
    return compactLines([
      '🚀 SUBMISSION IN PROGRESS',
      `STATUS: ${params.headline}`,
      readinessLine,
      nextLine,
      draftLine,
    ]);
  }

  if (params.workspace.status === 'ready_for_hometax_assist' || isRuntimeSubmissionReady(params.workspace)) {
    return compactLines([
      '✅ READY FOR HOMETAX ASSIST',
      `STATUS: ${params.headline}`,
      readinessLine,
      queueLine,
      nextLine,
      draftLine,
    ]);
  }

  if (params.workspace.status === 'review_pending' || params.workspace.unresolvedReviewCount > 0) {
    return compactLines([
      '🟨 REVIEW PENDING',
      `STATUS: ${params.headline}`,
      `QUEUE: reviews=${params.workspace.unresolvedReviewCount} | draft=${params.workspace.currentDraftId ?? 'none'}`,
      blockerLine,
      blockerContextLine,
      nextLine,
      draftLine,
    ]);
  }

  if (
    params.workspace.lastCollectionStatus === 'awaiting_user_action'
    || params.workspace.lastCollectionStatus === 'blocked'
    || getPrimaryBlockingReason(params.workspace) === 'missing_auth'
    || getPrimaryBlockingReason(params.workspace) === 'missing_consent'
  ) {
    return compactLines([
      '⏸️ COLLECTION BLOCKED',
      `STATUS: ${params.headline}`,
      blockerLine,
      blockerContextLine,
      nextLine,
      `COLLECTION: state=${humanizeToken(params.workspace.lastCollectionStatus ?? 'unknown')}`,
    ]);
  }

  return compactLines([
    '🧾 FILING STATUS',
    `STATUS: ${params.headline}`,
    readinessLine,
    queueLine,
    blockerLine,
    blockerContextLine,
    nextLine,
    draftLine,
  ]);
}

function compactLines(lines: Array<string | undefined>): string[] {
  return lines.filter((line): line is string => Boolean(line));
}

function buildRuntimeSnapshot(workspace: FilingWorkspace) {
  return {
    blockerCodes: getRuntimeBlockerCodes(workspace),
    activeBlockers: workspace.runtime?.activeBlockers ?? [],
    coverageByDomain: workspace.runtime?.coverageByDomain,
    materialCoverageSummary: workspace.runtime?.materialCoverageSummary,
    submissionComparison: workspace.runtime?.submissionComparison,
  };
}

function buildRuntimeReadiness(workspace: FilingWorkspace, blockerCodes: BlockingReason[]): NonNullable<MCPResponseEnvelope['readiness']> {
  return {
    supportTier: workspace.runtime?.readiness.supportTier ?? workspace.supportTier ?? 'undetermined',
    filingPathKind: workspace.filingPathKind ?? 'unknown',
    estimateReadiness: workspace.estimateReadiness ?? 'not_ready',
    draftReadiness: workspace.draftReadiness ?? 'not_ready',
    submissionReadiness: workspace.submissionReadiness ?? 'not_ready',
    comparisonSummaryState: workspace.comparisonSummaryState ?? 'not_started',
    freshnessState: workspace.freshnessState ?? 'stale_unknown',
    majorUnknowns: workspace.runtime?.readiness.majorUnknowns ?? workspace.majorUnknowns ?? [],
    blockerCodes,
  };
}

function buildRuntimeReadinessState(workspace: FilingWorkspace): MCPResponseEnvelope['readinessState'] {
  if (!workspace.runtime) return undefined;
  return {
    readiness: workspace.runtime.readiness,
    coverageByDomain: workspace.runtime.coverageByDomain,
    materialCoverageSummary: workspace.runtime.materialCoverageSummary,
    majorUnknowns: workspace.runtime.readiness.majorUnknowns,
    supportTier: workspace.runtime.readiness.supportTier,
  };
}

function getPrimaryActiveBlocker(workspace: FilingWorkspace) {
  return (workspace.runtime?.activeBlockers ?? [])[0];
}

function dedupeBlockingReasons<T extends string>(reasons: Array<T | undefined>): T[] {
  return [...new Set(reasons.filter((reason): reason is T => Boolean(reason)))];
}

function getRuntimeBlockerCodes(workspace: FilingWorkspace): BlockingReason[] {
  return dedupeBlockingReasons([
    ...(workspace.runtime?.activeBlockers?.map((blocker) => blocker.blockingReason) ?? []),
    workspace.lastBlockingReason,
  ]).filter(isBlockingReason);
}

function getPrimaryBlockingReason(workspace: FilingWorkspace): string | undefined {
  return getRuntimeBlockerCodes(workspace)[0];
}

function describePrimaryBlocker(workspace: FilingWorkspace): string | undefined {
  const blocker = getPrimaryActiveBlocker(workspace);
  if (blocker?.message) return blocker.message;
  const reason = getPrimaryBlockingReason(workspace);
  return reason ? describeBlockingReason(reason) : undefined;
}

function buildPrimaryBlockerLine(workspace: FilingWorkspace, blockers: string[]): string | undefined {
  const blocker = getPrimaryActiveBlocker(workspace);
  if (blocker?.message) {
    return `BLOCKER: ${blocker.message}`;
  }
  if (blockers.length > 0) {
    return `BLOCKER: ${describeBlockingReason(blockers[0])}`;
  }
  return undefined;
}

function buildPrimaryBlockerContextLine(workspace: FilingWorkspace): string | undefined {
  const blocker = getPrimaryActiveBlocker(workspace);
  if (!blocker) return undefined;

  const severity = blocker.severity ? `severity=${humanizeToken(blocker.severity)}` : undefined;
  const domains = blocker.affectedDomains?.length
    ? `domains=${blocker.affectedDomains.map(humanizeToken).join(',')}`
    : undefined;

  const context = [severity, domains].filter(Boolean).join(' | ');
  return context ? `BLOCKER_CONTEXT: ${context}` : undefined;
}

function getRuntimeSubmissionReadiness(workspace: FilingWorkspace): string {
  return workspace.runtime?.readiness.submissionReadiness ?? workspace.submissionReadiness ?? 'not_ready';
}

function getRuntimeComparisonSubmissionStateFromReadinessState(readinessState: NonNullable<MCPResponseEnvelope['readinessState']>): import('../../core/src/types.js').SubmissionComparisonState {
  const comparisonCoverage = readinessState.coverageByDomain?.submissionComparison;
  if (comparisonCoverage === 'strong') return 'strong';
  if (comparisonCoverage === 'partial') return 'partial';
  if (readinessState.readiness.submissionReadiness === 'blocked') return 'blocked';
  return 'not_started';
}

function getRuntimeComparisonState(workspace: FilingWorkspace): string {
  return workspace.runtime?.submissionComparison?.submissionComparisonState ?? workspace.comparisonSummaryState ?? 'not_started';
}

function getRuntimeMajorUnknowns(workspace: FilingWorkspace): string[] {
  return workspace.runtime?.readiness.majorUnknowns ?? workspace.majorUnknowns ?? [];
}

function getRuntimeSupportTier(workspace: FilingWorkspace): import('../../core/src/types.js').FilingSupportTier {
  return workspace.runtime?.readiness.supportTier ?? workspace.supportTier ?? 'undetermined';
}

function isRuntimeSubmissionReady(workspace: FilingWorkspace): boolean {
  return getRuntimeSubmissionReadiness(workspace) === 'ready' || workspace.submissionReadiness === 'submission_assist_ready';
}

function isRuntimeSubmissionBlocked(workspace: FilingWorkspace): boolean {
  return getRuntimeSubmissionReadiness(workspace) === 'blocked';
}

function buildFilingSummaryHeadline(workspace: FilingWorkspace): string {
  if (isRuntimeSubmissionReady(workspace)) {
    return 'The filing draft is ready for HomeTax preparation.';
  }
  if (workspace.unresolvedReviewCount > 0) {
    return 'The filing workflow is waiting on review decisions.';
  }
  if (getPrimaryBlockingReason(workspace) === 'comparison_incomplete') {
    return 'The draft still needs HomeTax comparison before preparation.';
  }
  if (getPrimaryBlockingReason(workspace) === 'official_data_refresh_required') {
    return 'Official data should be refreshed before moving forward.';
  }
  if (workspace.lastCollectionStatus === 'awaiting_user_action' || workspace.lastCollectionStatus === 'blocked') {
    return 'Collection is paused until the user completes the next step.';
  }
  return 'The filing workspace is in a readable, in-progress state.';
}

function buildFilingSummaryText(params: {
  workspace: FilingWorkspace;
  draft?: ComputeDraftData;
  blockers: string[];
  nextAction?: string;
  detailLevel: 'short' | 'standard';
}): string {
  const reviewSentence = params.workspace.unresolvedReviewCount > 0
    ? `${params.workspace.unresolvedReviewCount} review item(s) still need resolution.`
    : 'No review items are currently blocking the draft.';

  const readinessSentence = `Submission readiness is ${humanizeToken(getRuntimeSubmissionReadiness(params.workspace))}, with comparison ${humanizeToken(getRuntimeComparisonState(params.workspace))} and freshness ${humanizeToken(params.workspace.freshnessState ?? 'stale_unknown')}.`;

  const blocker = getPrimaryActiveBlocker(params.workspace);
  const blockerSentence = describePrimaryBlocker(params.workspace)
    ? `Main blocker: ${describePrimaryBlocker(params.workspace)}${blocker?.severity ? ` (severity ${humanizeToken(blocker.severity)})` : ''}${blocker?.affectedDomains?.length ? ` across ${blocker.affectedDomains.map(humanizeToken).join(', ')}` : ''}.`
    : params.blockers.length > 0
      ? `Main blocker: ${params.blockers.map((blockerCode) => describeBlockingReason(blockerCode)).join(' ')}.`
      : 'No blocking reason is currently recorded.';

  const nextSentence = params.nextAction
    ? `Recommended next action: ${describeRecommendedAction(params.nextAction)}.`
    : 'No immediate next action is suggested right now.';

  if (params.detailLevel === 'short') {
    return [reviewSentence, blockerSentence, nextSentence].join(' ');
  }

  const detailSentence = params.draft
    ? `Current draft has ${params.draft.fieldValues?.length ?? 0} field value(s) and ${params.draft.warnings.length} warning(s).`
    : 'No draft snapshot is stored yet.';

  return [reviewSentence, readinessSentence, blockerSentence, detailSentence, nextSentence].join(' ');
}

function isBlockingReason(value: string): value is BlockingReason {
  return [
    'missing_consent',
    'missing_auth',
    'ui_changed',
    'blocked_by_provider',
    'export_required',
    'insufficient_metadata',
    'unsupported_source',
    'unsupported_filing_path',
    'missing_material_coverage',
    'awaiting_review_decision',
    'awaiting_final_approval',
    'draft_not_ready',
    'submission_not_ready',
    'comparison_incomplete',
    'official_data_refresh_required',
    'unsupported_hometax_state',
  ].includes(value);
}

function deriveWorkspaceNextRecommendedAction(workspace: FilingWorkspace): string | undefined {
  const comparisonState = getRuntimeComparisonState(workspace);
  const submissionReadiness = getRuntimeSubmissionReadiness(workspace);
  const primaryBlockingReason = getPrimaryBlockingReason(workspace);

  if (workspace.submissionApproval && !workspace.submissionResult) {
    return 'tax.browser.record_submission_result';
  }
  if (workspace.status === 'submission_in_progress') {
    return 'tax.browser.resume_hometax_assist';
  }
  if (workspace.lastCollectionStatus === 'awaiting_user_action' || workspace.lastCollectionStatus === 'blocked') {
    return 'tax.sources.resume_sync';
  }
  if (primaryBlockingReason === 'official_data_refresh_required') {
    return 'tax.filing.refresh_official_data';
  }
  if (primaryBlockingReason === 'missing_material_coverage' || primaryBlockingReason === 'awaiting_review_decision') {
    return 'tax.classify.list_review_items';
  }
  if (workspace.unresolvedReviewCount > 0) {
    return 'tax.classify.list_review_items';
  }
  if (primaryBlockingReason === 'comparison_incomplete') {
    return 'tax.filing.compare_with_hometax';
  }
  if (!workspace.currentDraftId) {
    return 'tax.filing.compute_draft';
  }
  if (workspace.freshnessState === 'refresh_required' || workspace.freshnessState === 'stale_unknown') {
    return 'tax.filing.refresh_official_data';
  }
  if (comparisonState !== 'matched_enough' && comparisonState !== 'manual_only' && comparisonState !== 'strong') {
    return 'tax.filing.compare_with_hometax';
  }
  if (submissionReadiness === 'ready' || workspace.submissionReadiness === 'submission_assist_ready') {
    return 'tax.filing.prepare_hometax';
  }
  if (submissionReadiness === 'blocked') {
    return 'tax.classify.list_review_items';
  }
  return undefined;
}

function prioritizeBlockingReason(blockerCodes?: string[]): FilingWorkspace['lastBlockingReason'] | undefined {
  const prioritized = dedupeBlockingReasons(blockerCodes ?? []).find(isBlockingReason);
  return prioritized as FilingWorkspace['lastBlockingReason'] | undefined;
}

function buildComparisonReviewItems(
  workspaceId: string,
  draftId: string,
  mismatches: CompareWithHomeTaxData['materialMismatches'],
): ReviewItem[] {
  return mismatches.map((mismatch) => ({
    reviewItemId: `review_${draftId}_${mismatch.sectionKey}_${mismatch.fieldKey}_comparison_mismatch`,
    workspaceId,
    reasonCode: 'hometax_material_mismatch',
    severity: mismatch.severity === 'critical' ? 'critical' : mismatch.severity === 'high' ? 'high' : 'medium',
    question: `홈택스 값과 초안 값이 다릅니다: ${mismatch.sectionKey}.${mismatch.fieldKey}`,
    candidateOptions: ['accept_portal_value', 'keep_draft_value', 'mark_manual_followup'],
    suggestedOption: 'mark_manual_followup',
    linkedEntityIds: [draftId, `${mismatch.sectionKey}:${mismatch.fieldKey}`],
    impactEstimate: {
      draftValue: mismatch.draftValue,
      portalObservedValue: mismatch.portalObservedValue,
      sectionKey: mismatch.sectionKey,
      fieldKey: mismatch.fieldKey,
    },
    resolutionState: 'open',
    resolutionNote: 'Generated from HomeTax comparison mismatch.',
  }));
}

function reconcileFactCoverageGaps(workspaceId: string, existing: CoverageGap[], missingFacts: FilingFactCompleteness[]): CoverageGap[] {
  const nonFactGaps = existing.filter((gap) => !gap.gapId.startsWith(`gap_fact_${workspaceId}_`));
  const factGaps = missingFacts
    .filter((item) => item.priority === 'high')
    .map((item) => ({
      gapId: `gap_fact_${workspaceId}_${item.factKey}`,
      workspaceId,
      gapType: item.blockingStage === 'draft' ? 'missing_deduction_fact' as const : 'missing_filing_path_determination' as const,
      severity: item.materiality === 'high' ? 'high' as const : 'medium' as const,
      description: `Missing taxpayer fact: ${item.factKey}. ${item.whyItMatters}`,
      affectedArea: item.blockingStage,
      affectedDomains: (item.blockingStage === 'draft' ? ['deductionFacts'] : ['filingPath']) as CoverageGap['affectedDomains'],
      materiality: item.materiality === 'high' ? 'high' as const : 'medium' as const,
      blocksEstimate: item.blockingStage === 'collection' || item.blockingStage === 'filing_path',
      blocksDraft: item.blockingStage === 'draft' || item.blockingStage === 'filing_path',
      blocksSubmission: true,
      recommendedNextAction: 'tax.profile.upsert_facts',
      relatedSourceIds: [],
      state: 'open' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  return [...nonFactGaps, ...factGaps];
}

function syncFactReviewItems(reviewItems: Map<string, ReviewItem>, workspaceId: string, missingFacts: FilingFactCompleteness[]): void {
  for (const item of missingFacts.filter((fact) => fact.priority === 'high')) {
    const reviewItemId = `review_fact_${workspaceId}_${item.factKey}`;
    reviewItems.set(reviewItemId, {
      reviewItemId,
      workspaceId,
      reasonCode: 'missing_information',
      severity: item.materiality === 'high' ? 'high' : 'medium',
      question: item.bestQuestion,
      candidateOptions: ['answered', 'not_applicable', 'needs_review'],
      linkedEntityIds: [item.factKey],
      resolutionState: 'open',
      resolutionNote: item.whyItMatters,
    });
  }
}

function deriveOperatorTrustState(params: {
  draft?: ComputeDraftData;
  workspace?: FilingWorkspace;
  reviewItems?: ReviewItem[];
  runtimeSnapshot?: RuntimeSnapshot;
  authCheckpoints?: AuthCheckpoint[];
  assistSession?: BrowserAssistSession;
}) {
  const runtimeBlockers = params.runtimeSnapshot?.blockerCodes ?? [];
  const draftBlockers = params.draft?.stopReasonCodes ?? [];
  const latestAuthCheckpoint = [...(params.authCheckpoints ?? [])].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0];
  const assistBlockers: BlockingReason[] = [];

  if (params.workspace?.status === 'submission_uncertain') {
    assistBlockers.push('awaiting_review_decision');
  } else if (params.workspace?.status !== 'submitted' && params.workspace?.status !== 'submission_failed') {
    if (params.assistSession && !params.assistSession.endedAt && params.assistSession.authState !== 'completed') {
      assistBlockers.push('missing_auth');
    }
    if (latestAuthCheckpoint && latestAuthCheckpoint.state !== 'completed' && latestAuthCheckpoint.workspaceId === params.workspace?.workspaceId) {
      assistBlockers.push('missing_auth');
    }
  }

  const stopReasonCodes = dedupeBlockingReasons([
    ...(params.workspace?.status === 'submitted' || params.workspace?.status === 'submission_failed' ? [] : runtimeBlockers),
    ...(params.workspace?.status === 'submitted' || params.workspace?.status === 'submission_failed' ? [] : draftBlockers),
    ...(params.workspace?.status === 'submitted' || params.workspace?.status === 'submission_failed' ? [] : assistBlockers),
    params.workspace?.status === 'submission_uncertain' ? 'awaiting_review_decision' : undefined,
    params.workspace?.status === 'submission_in_progress' && params.workspace?.lastBlockingReason === 'comparison_incomplete' ? 'comparison_incomplete' : undefined,
    params.workspace?.status !== 'submitted' && params.workspace?.status !== 'submission_failed' ? params.workspace?.lastBlockingReason : undefined,
  ]).filter(isBlockingReason);

  const warningCodes = [...(params.draft?.warningCodes ?? [])].filter((value, index, array) => array.indexOf(value) === index);
  const escalationReason = params.workspace?.status === 'submission_uncertain'
    ? 'Submission result is ambiguous and requires verification before claiming success.'
    : params.draft?.escalationReason;
  const operatorExplanation = stopReasonCodes.length > 0
    ? `현재 진행을 멈추게 하는 활성 blocker: ${stopReasonCodes.join(', ')}. 가정이 포함된 경우 반드시 명시적으로 공개해야 합니다.`
    : warningCodes.length > 0
      ? `현재 경고/다운그레이드 이유: ${warningCodes.join(', ')}. 가정이 포함된 경우 반드시 명시적으로 공개해야 합니다.`
      : params.workspace?.status === 'submitted'
        ? '제출 성공 상태로 수렴했으며 활성 blocker는 없습니다. 가정이 있었다면 함께 공개해야 합니다.'
        : params.workspace?.status === 'submission_failed'
          ? '제출 실패 상태가 기록되었고 추가 활성 blocker는 없습니다. 실패 원인과 재시도 여부를 검토해야 합니다.'
          : '현재 활성 blocker는 없습니다. 다만 가정이 있다면 공개해야 합니다.';
  const reviewBatchId = params.draft?.reviewBatchId
    ?? ((params.reviewItems?.length ?? 0) > 0 ? `review_batch_${params.workspace?.workspaceId ?? 'workspace'}_${params.reviewItems?.length ?? 0}` : undefined);
  return { stopReasonCodes, warningCodes, escalationReason, operatorExplanation, reviewBatchId };
}

function getDraftHomeTaxPreparation(draft?: ComputeDraftData): PrepareHomeTaxData | undefined {
  const candidate = draft as ComputeDraftData & { hometaxPreparation?: PrepareHomeTaxData } | undefined;
  return candidate?.hometaxPreparation;
}

function deriveExternalSubmitState(workspace?: FilingWorkspace, session?: BrowserAssistSession) {
  const awaitingExternalSubmitClick = Boolean(
    workspace?.submissionApproval
    && !workspace?.submissionResult
    && (!session || !session.endedAt),
  );
  const workflowState: 'active' | 'stopped' | 'awaiting_external_submit_click' | 'submitted' | 'submission_uncertain' | 'submission_failed' =
    workspace?.status === 'submitted'
      ? 'submitted'
      : workspace?.status === 'submission_uncertain'
        ? 'submission_uncertain'
        : workspace?.status === 'submission_failed'
          ? 'submission_failed'
          : awaitingExternalSubmitClick
            ? 'awaiting_external_submit_click'
            : session?.endedAt
              ? 'stopped'
              : 'active';
  return {
    workflowState,
    externalSubmitRequired: awaitingExternalSubmitClick,
  };
}

function deriveAssistCheckpointContract(params: {
  draft?: ComputeDraftData;
  session?: BrowserAssistSession;
  prepared?: PrepareHomeTaxData;
  reviewItems?: ReviewItem[];
}) {
  const entryPlan = (params.prepared?.handoff ?? params.session?.handoff) as PrepareHomeTaxData['handoff'] | undefined;
  const hasHighSeverityReview = (params.reviewItems ?? []).some((item) => item.resolutionState !== 'resolved' && (item.severity === 'high' || item.severity === 'critical'));
  const hasMismatch = Boolean(entryPlan?.mismatchSummary.hasUnresolvedMismatch);
  const staleAfterRefresh = Boolean(entryPlan?.staleAfterRefresh || params.draft?.stopReasonCodes?.includes('official_data_refresh_required'));
  const draftChanged = Boolean(params.session?.draftId && params.draft?.draftId && params.session.draftId !== params.draft.draftId);
  const blockedReason: BlockingReason | undefined = draftChanged
    ? 'official_data_refresh_required'
    : staleAfterRefresh
      ? 'official_data_refresh_required'
      : hasMismatch
        ? 'comparison_incomplete'
        : hasHighSeverityReview
          ? 'awaiting_review_decision'
          : undefined;
  return {
    blockedReason,
    checkpointKey: entryPlan?.orderedSections[0]?.checkpointKey,
    screenKey: entryPlan?.orderedSections[0]?.screenKey,
    allowedNextActions: blockedReason
      ? ['pause_and_return_to_mcp', 'resolve_blockers']
      : ['resume_hometax_assist', 'continue_to_next_section'],
    resumePreconditions: [
      ...(draftChanged ? ['draft version changed; restart from refreshed prepare_hometax output'] : []),
      ...(staleAfterRefresh ? ['official data must be refreshed before browser progression'] : []),
      ...(hasMismatch ? ['material mismatch batch must be resolved first'] : []),
      ...(hasHighSeverityReview ? ['high-severity review items must be resolved first'] : []),
    ],
    retryPolicy: (blockedReason
      ? 'refresh_prepare_then_restart'
      : (params.session?.authState !== 'completed' ? 'reauth_then_resume' : 'manual_confirmation_then_resume')) as 'reauth_then_resume' | 'refresh_prepare_then_restart' | 'manual_confirmation_then_resume' | 'stop_and_recompute',
  };
}

function createRuntimeSnapshot(store: RuntimeStore): DurableRuntimeSnapshot {
  return {
    schemaVersion: 1,
    consentRecords: [...store.consentRecords],
    workspaces: Array.from(store.workspaces.values()),
    sources: Array.from(store.sources.values()),
    syncAttempts: Array.from(store.syncAttempts.values()),
    coverageGapsByWorkspace: mapToRecord(store.coverageGapsByWorkspace),
    taxpayerFactsByWorkspace: mapToRecord(store.taxpayerFactsByWorkspace),
    withholdingRecordsByWorkspace: mapToRecord(store.withholdingRecordsByWorkspace),
    sourceArtifacts: Array.from(store.sourceArtifacts.values()),
    evidenceDocuments: Array.from(store.evidenceDocuments.values()),
    auditEvents: Array.from(store.auditEventsByWorkspace.values()).flat(),
    authCheckpoints: Array.from(store.authCheckpoints.values()),
    filingFieldValues: Array.from(store.fieldValuesByDraft.values()).flat(),
    fieldValuesByDraft: mapToRecord(store.fieldValuesByDraft),
    normalizationLinksByWorkspace: mapToRecord(store.normalizationLinksByWorkspace),
    transactions: Array.from(store.transactions.values()),
    decisions: Array.from(store.decisions.values()),
    reviewItems: Array.from(store.reviewItems.values()),
    draftsByWorkspace: mapToRecord(store.draftsByWorkspace),
    assistSessions: Array.from(store.assistSessionsByWorkspace.values()),
  };
}

function runtimeOptionsFromSnapshot(snapshot: DurableRuntimeSnapshot, overrides: CreateRuntimeOptions): CreateRuntimeOptions {
  return {
    ...overrides,
    consentRecords: snapshot.consentRecords,
    workspaces: snapshot.workspaces,
    sources: snapshot.sources,
    syncAttempts: snapshot.syncAttempts,
    coverageGapsByWorkspace: snapshot.coverageGapsByWorkspace,
    taxpayerFactsByWorkspace: snapshot.taxpayerFactsByWorkspace,
    withholdingRecordsByWorkspace: snapshot.withholdingRecordsByWorkspace,
    sourceArtifacts: snapshot.sourceArtifacts,
    evidenceDocuments: snapshot.evidenceDocuments,
    auditEvents: snapshot.auditEvents,
    authCheckpoints: snapshot.authCheckpoints,
    filingFieldValues: snapshot.filingFieldValues,
    fieldValuesByDraft: snapshot.fieldValuesByDraft,
    normalizationLinksByWorkspace: snapshot.normalizationLinksByWorkspace,
    transactions: snapshot.transactions,
    decisions: snapshot.decisions,
    reviewItems: snapshot.reviewItems,
    draftsByWorkspace: snapshot.draftsByWorkspace,
    assistSessions: snapshot.assistSessions,
  };
}

function mapToRecord<T>(map: Map<string, T>): Record<string, T> {
  return Object.fromEntries(map.entries());
}

function buildBrowserAssistCheckpointSnapshot(input: {
  assistSessionId: string;
  workspaceId: string;
  draftId: string;
  checkpointType: CheckpointType;
  checkpointKey?: string;
  screenKey?: string;
  stopped: boolean;
  authRequired: boolean;
  blocker?: BlockingReason;
  pendingUserAction?: string;
  allowedNextActions?: string[];
  resumePreconditions?: string[];
  retryPolicy?: 'reauth_then_resume' | 'refresh_prepare_then_restart' | 'manual_confirmation_then_resume' | 'stop_and_recompute';
  sessionRef: string;
  workspaceRef: string;
  draftRef: string;
  provider: string;
  targetSection?: string;
  recommendedTool: 'tax.browser.resume_hometax_assist' | 'tax.browser.get_checkpoint';
  entryPlan?: GetHomeTaxCheckpointData['handoff']['entryPlan'];
  startedAt: string;
  updatedAt: string;
  endedAt?: string;
  authState?: string;
}) {
  return {
    assistSessionId: input.assistSessionId,
    workspaceId: input.workspaceId,
    draftId: input.draftId,
    checkpointType: input.checkpointType,
    checkpointKey: input.checkpointKey,
    screenKey: input.screenKey,
    stopped: input.stopped,
    authRequired: input.authRequired,
    blocker: input.blocker,
    pendingUserAction: input.pendingUserAction,
    allowedNextActions: input.allowedNextActions,
    resumePreconditions: input.resumePreconditions,
    retryPolicy: input.retryPolicy,
    sessionRef: input.sessionRef,
    workspaceRef: input.workspaceRef,
    draftRef: input.draftRef,
    handoff: {
      provider: input.provider,
      targetSection: input.targetSection,
      recommendedTool: input.recommendedTool,
      entryPlan: input.entryPlan,
      safeContext: {
        sessionStatus: input.stopped ? 'stopped' as const : 'active' as const,
        lastKnownSection: input.targetSection,
        authState: input.authState,
        startedAt: input.startedAt,
        updatedAt: input.updatedAt,
        endedAt: input.endedAt,
      },
    },
  };
}

function inferArtifactTypeFromRef(ref: string, contentType?: string, formatHints: string[] = []): SourceArtifact['artifactType'] {
  const text = `${ref} ${contentType ?? ''} ${formatHints.join(' ')}`.toLowerCase();
  if (text.includes('csv')) return 'csv';
  if (text.includes('pdf')) return 'pdf';
  if (text.includes('png') || text.includes('jpg') || text.includes('jpeg') || text.includes('image')) return 'image';
  if (text.includes('html')) return 'html_snapshot';
  if (text.includes('manual')) return 'manual_entry';
  return 'json';
}

function inferDocumentTypeFromImportRef(ref: string): EvidenceDocument['documentType'] {
  const text = ref.toLowerCase();
  if (text.includes('receipt')) return 'receipt';
  if (text.includes('invoice')) return 'invoice';
  if (text.includes('withholding') || text.includes('원천징수')) return 'withholding_doc';
  if (text.includes('hometax')) return 'hometax_export';
  return 'other';
}

function buildImportedDocumentIdForRuntime(workspaceId: string, ref: string): string {
  return `doc_${slugifyRuntime(workspaceId)}_${slugifyRuntime(ref)}`;
}

function slugifyRuntime(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
}

function buildDisconnectedSourceSyncEnvelope(source: SourceConnection, syncMode: SyncSourceInput['syncMode']): MCPResponseEnvelope<SyncSourceData> {
  return {
    ok: false,
    status: 'blocked',
    data: {
      sourceState: (source.state ?? source.connectionStatus ?? 'completed') as SyncSourceData['sourceState'],
      syncAttemptState: 'blocked',
      importedArtifactCount: 0,
      changedItemCount: 0,
      fallbackOptions: ['tax.sources.list', 'tax.sources.connect'],
    },
    blockingReason: 'blocked_by_provider',
    pendingUserAction: `Reconnect source ${source.sourceId} before attempting ${syncMode} sync again.`,
    fallbackOptions: ['tax.sources.list', 'tax.sources.connect'],
    nextRecommendedAction: 'tax.sources.list',
    warnings: [
      {
        code: 'source_disconnected',
        message: 'This source was disconnected for future syncs. Existing imported records are retained.',
        severity: 'medium',
      },
    ],
  };
}

function buildDisconnectedSourceResumeEnvelope(source: SourceConnection, input: ResumeSyncInput): MCPResponseEnvelope<ResumeSyncData> {
  return {
    ok: false,
    status: 'blocked',
    data: {
      resumed: false,
      sourceId: source.sourceId,
      syncSessionId: input.syncSessionId ?? `sync_${source.sourceId}`,
      importedArtifactCount: 0,
    },
    blockingReason: 'blocked_by_provider',
    pendingUserAction: `Reconnect source ${source.sourceId} before resuming sync.`,
    fallbackOptions: ['tax.sources.list', 'tax.sources.connect'],
    nextRecommendedAction: 'tax.sources.list',
    warnings: [
      {
        code: 'source_disconnected',
        message: 'Resume is blocked because this source was disconnected for future syncs. Existing imported records are retained.',
        severity: 'medium',
      },
    ],
  };
}

function normalizeCoverageGaps(workspaceId: string, gaps: Array<CoverageGap | string>): CoverageGap[] {
  return gaps.map((gap, index) => {
    if (typeof gap !== 'string') return gap;

    const gapType = mapLegacyGapStringToType(gap);
    return {
      gapId: `gap_${workspaceId}_${gapType}_${index + 1}`,
      workspaceId,
      gapType,
      severity: inferGapSeverity(gapType),
      description: gap,
      affectedArea: gapType,
      relatedSourceIds: [],
      state: 'open',
      blocksEstimate: gapType === 'missing_filing_path_determination',
      blocksDraft: gapType !== 'stale_official_data',
      blocksSubmission: true,
    };
  });
}

function mapLegacyGapStringToType(value: string): CoverageGap['gapType'] {
  if (value.includes('withholding')) return 'missing_withholding_record';
  if (value.includes('expense')) return 'missing_expense_evidence';
  if (value.includes('deduction')) return 'missing_deduction_fact';
  if (value.includes('comparison') || value.includes('hometax')) return 'missing_hometax_comparison';
  if (value.includes('stale') || value.includes('refresh')) return 'stale_official_data';
  if (value.includes('path')) return 'missing_filing_path_determination';
  return 'missing_income_source';
}

function inferGapSeverity(gapType: CoverageGap['gapType']): CoverageGap['severity'] {
  switch (gapType) {
    case 'missing_filing_path_determination':
    case 'missing_hometax_comparison':
      return 'high';
    case 'stale_official_data':
      return 'medium';
    default:
      return 'medium';
  }
}

function extractWorkspaceIdFromSourceId(sourceId?: string): string {
  if (!sourceId) return 'unknown_workspace';
  const match = sourceId.match(/^source_[^_]+_(.+)$/);
  return match?.[1] ?? 'unknown_workspace';
}

function groupByWorkspace<T>(items: T[], getWorkspaceId: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const workspaceId = getWorkspaceId(item);
    const current = grouped.get(workspaceId) ?? [];
    current.push(item);
    grouped.set(workspaceId, current);
  }
  return grouped;
}

function mergeGroupedWorkspaceMaps<T>(primary: Map<string, T[]>, secondary: Map<string, T[]>): Map<string, T[]> {
  const merged = new Map(primary);
  for (const [workspaceId, values] of secondary) {
    merged.set(workspaceId, [...(merged.get(workspaceId) ?? []), ...values]);
  }
  return merged;
}

function extractWorkspaceIdFromDraftId(draftId: string): string {
  const match = draftId.match(/^draft_(.+)_v\d+$/);
  return match?.[1] ?? draftId;
}

function buildRuntimeTaxpayerFacts(workspaceId: string, transactions: LedgerTransaction[], withholdingRecords: WithholdingRecord[] = []): TaxpayerFact[] {
  if (transactions.length === 0 && withholdingRecords.length === 0) return [];
  const allEvidenceRefs = [...transactions.flatMap((tx) => tx.evidenceRefs), ...withholdingRecords.flatMap((record) => record.evidenceRefs)];
  return [
    {
      factId: `fact_${workspaceId}_income_presence`,
      workspaceId,
      category: 'filing_path',
      factKey: 'income_presence',
      value: transactions.some((tx) => tx.normalizedDirection === 'income'),
      status: 'inferred',
      sourceOfTruth: 'inferred',
      confidence: 0.7,
      evidenceRefs: allEvidenceRefs,
      note: `Derived from ${transactions.length} normalized transaction(s) and ${withholdingRecords.length} withholding record(s).`,
      updatedAt: new Date().toISOString(),
    },
    {
      factId: `fact_${workspaceId}_expense_presence`,
      workspaceId,
      category: 'deduction_eligibility',
      factKey: 'expense_presence',
      value: transactions.some((tx) => tx.normalizedDirection === 'expense'),
      status: 'inferred',
      sourceOfTruth: 'inferred',
      confidence: 0.7,
      evidenceRefs: allEvidenceRefs,
      note: `Derived from ${transactions.length} normalized transaction(s) and ${withholdingRecords.length} withholding record(s).`,
      updatedAt: new Date().toISOString(),
    },
    {
      factId: `fact_${workspaceId}_withholding_record_presence`,
      workspaceId,
      category: 'income_stream',
      factKey: 'withholding_record_presence',
      value: withholdingRecords.length > 0,
      status: 'inferred',
      sourceOfTruth: withholdingRecords.length > 0 ? 'official' : 'inferred',
      confidence: withholdingRecords.length > 0 ? 0.9 : 0.5,
      evidenceRefs: allEvidenceRefs,
      note: `Derived from ${withholdingRecords.length} persisted withholding record(s).`,
      updatedAt: new Date().toISOString(),
    },
  ];
}

function buildRuntimeWithholdingRecords(workspaceId: string, transactions: LedgerTransaction[]): WithholdingRecord[] {
  const sourceTransactions = transactions.filter((tx) => tx.normalizedDirection === 'income' && tx.evidenceRefs.length > 0);
  return sourceTransactions.map((transaction, index) => ({
    withholdingRecordId: `withholding_${workspaceId}_${index + 1}`,
    workspaceId,
    filingYear: Number(transaction.occurredAt.slice(0, 4)),
    incomeSourceRef: transaction.transactionId,
    payerName: transaction.counterparty,
    grossAmount: transaction.amount,
    withheldTaxAmount: 0,
    currency: transaction.currency,
    sourceType: 'hometax',
    sourceOfTruth: 'inferred',
    extractionConfidence: 0.2,
    reviewStatus: 'needs_review',
    evidenceRefs: transaction.evidenceRefs,
    capturedAt: transaction.occurredAt,
  }));
}



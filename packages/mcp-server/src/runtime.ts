import { deriveCalibratedReadiness, deriveReadinessSummary, sortActiveBlockers } from '../../core/src/readiness.js';
import type {
  AuthCheckpoint,
  BlockingReason,
  BrowserAssistSession,
  ClassificationDecision,
  ConsentRecord,
  CoverageGap,
  FilingFieldValue,
  FilingWorkspace,
  LedgerTransaction,
  ReviewItem,
  SourceConnection,
  SyncAttempt,
  TaxpayerFact,
  WithholdingRecord,
} from '../../core/src/types.js';
import type {
  CollectionStatusData,
  CompareWithHomeTaxData,
  GetFilingSummaryData,
  GetFilingSummaryInput,
  GetWorkspaceStatusData,
  GetWorkspaceStatusInput,
  CompareWithHomeTaxInput,
  ComputeDraftData,
  ComputeDraftInput,
  ConnectSourceData,
  ConnectSourceInput,
  DetectFilingPathData,
  DetectFilingPathInput,
  GetCollectionStatusInput,
  InitConfigData,
  InitConfigInput,
  InspectEnvironmentData,
  InspectEnvironmentInput,
  KoreanTaxMCPContracts,
  MCPResponseEnvelope,
  NormalizeLedgerData,
  NormalizeLedgerInput,
  PrepareHomeTaxData,
  PrepareHomeTaxInput,
  RefreshOfficialDataData,
  RefreshOfficialDataInput,
  ResolveReviewItemData,
  ResolveReviewItemInput,
  ResumeSyncData,
  ResumeSyncInput,
  RunClassificationData,
  RunClassificationInput,
  StartHomeTaxAssistData,
  StartHomeTaxAssistInput,
  SyncSourceData,
  SyncSourceInput,
} from './contracts.js';
import {
  taxBrowserStartHomeTaxAssist,
  taxClassifyListReviewItems,
  taxClassifyResolveReviewItem,
  taxClassifyRun,
  taxFilingCompareWithHomeTax,
  taxFilingComputeDraft,
  taxFilingPrepareHomeTax,
  taxFilingRefreshOfficialData,
  taxLedgerNormalize,
  taxProfileDetectFilingPath,
  taxSetupInitConfig,
  taxSetupInspectEnvironment,
  taxSourcesConnect,
  taxSourcesGetCollectionStatus,
  taxSourcesPlanCollection,
  taxSourcesResumeSync,
  taxSourcesSync,
} from './tools.js';

export type SupportedRuntimeToolName =
  | 'tax.setup.inspect_environment'
  | 'tax.setup.init_config'
  | 'tax.sources.plan_collection'
  | 'tax.sources.get_collection_status'
  | 'tax.workspace.get_status'
  | 'tax.filing.get_summary'
  | 'tax.sources.connect'
  | 'tax.sources.sync'
  | 'tax.sources.resume_sync'
  | 'tax.ledger.normalize'
  | 'tax.profile.detect_filing_path'
  | 'tax.classify.run'
  | 'tax.classify.list_review_items'
  | 'tax.classify.resolve_review_item'
  | 'tax.filing.compute_draft'
  | 'tax.filing.compare_with_hometax'
  | 'tax.filing.refresh_official_data'
  | 'tax.filing.prepare_hometax'
  | 'tax.browser.start_hometax_assist';

export type RuntimeStore = {
  consentRecords: ConsentRecord[];
  workspaces: Map<string, FilingWorkspace>;
  sources: Map<string, SourceConnection>;
  syncAttempts: Map<string, SyncAttempt>;
  coverageGapsByWorkspace: Map<string, CoverageGap[]>;
  taxpayerFacts: Map<string, TaxpayerFact[]>;
  withholdingRecords: Map<string, WithholdingRecord[]>;
  authCheckpoints: Map<string, AuthCheckpoint>;
  filingFieldValues: Map<string, FilingFieldValue[]>;
  transactions: Map<string, LedgerTransaction>;
  decisions: Map<string, ClassificationDecision>;
  reviewItems: Map<string, ReviewItem>;
  draftsByWorkspace: Map<string, ComputeDraftData>;
  assistSessionsByWorkspace: Map<string, BrowserAssistSession>;
};

export type CreateRuntimeOptions = {
  consentRecords?: ConsentRecord[];
  workspaces?: FilingWorkspace[];
  sources?: SourceConnection[];
  syncAttempts?: SyncAttempt[];
  coverageGapsByWorkspace?: Record<string, Array<CoverageGap | string>>;
  taxpayerFacts?: TaxpayerFact[];
  withholdingRecords?: WithholdingRecord[];
  authCheckpoints?: AuthCheckpoint[];
  filingFieldValues?: FilingFieldValue[];
  transactions?: LedgerTransaction[];
  decisions?: ClassificationDecision[];
  reviewItems?: ReviewItem[];
};

export function createRuntimeStore(options: CreateRuntimeOptions = {}): RuntimeStore {
  return {
    consentRecords: [...(options.consentRecords ?? [])],
    workspaces: new Map((options.workspaces ?? []).map((workspace) => [workspace.workspaceId, workspace])),
    sources: new Map((options.sources ?? []).map((source) => [source.sourceId, source])),
    syncAttempts: new Map((options.syncAttempts ?? []).map((attempt) => [attempt.syncAttemptId, attempt])),
    coverageGapsByWorkspace: new Map(Object.entries(options.coverageGapsByWorkspace ?? {}).map(([workspaceId, gaps]) => [workspaceId, normalizeCoverageGaps(workspaceId, gaps)])),
    taxpayerFacts: groupByWorkspace(options.taxpayerFacts ?? [], (fact) => fact.workspaceId),
    withholdingRecords: groupByWorkspace(options.withholdingRecords ?? [], (record) => record.workspaceId),
    authCheckpoints: new Map((options.authCheckpoints ?? []).map((checkpoint) => [checkpoint.authCheckpointId, checkpoint])),
    filingFieldValues: new Map(),
    transactions: new Map((options.transactions ?? []).map((tx) => [tx.transactionId, tx])),
    decisions: new Map((options.decisions ?? []).map((decision) => [decision.decisionId, decision])),
    reviewItems: new Map((options.reviewItems ?? []).map((item) => [item.reviewItemId, item])),
    draftsByWorkspace: new Map(),
    assistSessionsByWorkspace: new Map(),
  };
}

export class InMemoryKoreanTaxMCPRuntime {
  readonly store: RuntimeStore;

  constructor(options: CreateRuntimeOptions = {}) {
    this.store = createRuntimeStore(options);
  }

  invoke(name: 'tax.setup.inspect_environment', input: InspectEnvironmentInput): MCPResponseEnvelope<InspectEnvironmentData>;
  invoke(name: 'tax.setup.init_config', input: InitConfigInput): MCPResponseEnvelope<InitConfigData>;
  invoke(name: 'tax.sources.plan_collection', input: { workspaceId: string; filingYear: number; currentCoverageSummary?: Record<string, unknown>; userProfileHints?: Record<string, unknown> }): MCPResponseEnvelope<{ recommendedSources: ReturnType<typeof taxSourcesPlanCollection>['data']['recommendedSources']; expectedValueBySource: Record<string, string>; likelyUserCheckpoints: ReturnType<typeof taxSourcesPlanCollection>['data']['likelyUserCheckpoints']; fallbackPathSuggestions: string[] }>;
  invoke(name: 'tax.sources.get_collection_status', input: GetCollectionStatusInput): MCPResponseEnvelope<CollectionStatusData>;
  invoke(name: 'tax.workspace.get_status', input: GetWorkspaceStatusInput): MCPResponseEnvelope<GetWorkspaceStatusData>;
  invoke(name: 'tax.filing.get_summary', input: GetFilingSummaryInput): MCPResponseEnvelope<GetFilingSummaryData>;
  invoke(name: 'tax.sources.connect', input: ConnectSourceInput): MCPResponseEnvelope<ConnectSourceData>;
  invoke(name: 'tax.sources.sync', input: SyncSourceInput): MCPResponseEnvelope<SyncSourceData>;
  invoke(name: 'tax.sources.resume_sync', input: ResumeSyncInput): MCPResponseEnvelope<ResumeSyncData>;
  invoke(name: 'tax.ledger.normalize', input: NormalizeLedgerInput): MCPResponseEnvelope<NormalizeLedgerData>;
  invoke(name: 'tax.profile.detect_filing_path', input: DetectFilingPathInput): MCPResponseEnvelope<DetectFilingPathData>;
  invoke(name: 'tax.classify.run', input: RunClassificationInput): MCPResponseEnvelope<RunClassificationData>;
  invoke(name: 'tax.classify.list_review_items', input: { workspaceId: string }): MCPResponseEnvelope<{ items: ReviewItem[]; summary: ReturnType<typeof taxClassifyListReviewItems>['data']['summary'] }>;
  invoke(name: 'tax.classify.resolve_review_item', input: ResolveReviewItemInput): MCPResponseEnvelope<ResolveReviewItemData>;
  invoke(name: 'tax.filing.compute_draft', input: ComputeDraftInput): MCPResponseEnvelope<ComputeDraftData>;
  invoke(name: 'tax.filing.compare_with_hometax', input: CompareWithHomeTaxInput): MCPResponseEnvelope<CompareWithHomeTaxData>;
  invoke(name: 'tax.filing.refresh_official_data', input: RefreshOfficialDataInput): MCPResponseEnvelope<RefreshOfficialDataData>;
  invoke(name: 'tax.filing.prepare_hometax', input: PrepareHomeTaxInput): MCPResponseEnvelope<PrepareHomeTaxData>;
  invoke(name: 'tax.browser.start_hometax_assist', input: StartHomeTaxAssistInput): MCPResponseEnvelope<StartHomeTaxAssistData>;
  invoke<TName extends SupportedRuntimeToolName>(
    name: TName,
    input: KoreanTaxMCPContracts[TName]['input'],
  ): KoreanTaxMCPContracts[TName]['output'] {
    switch (name) {
      case 'tax.setup.inspect_environment':
        return this.inspectEnvironment(input as InspectEnvironmentInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.setup.init_config':
        return this.initConfig(input as InitConfigInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.sources.plan_collection':
        return this.planCollection(input as KoreanTaxMCPContracts['tax.sources.plan_collection']['input']) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.sources.get_collection_status':
        return this.getCollectionStatus(input as GetCollectionStatusInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.workspace.get_status':
        return this.getWorkspaceStatus(input as GetWorkspaceStatusInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.filing.get_summary':
        return this.getFilingSummary(input as GetFilingSummaryInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.sources.connect':
        return this.connectSource(input as ConnectSourceInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.sources.sync':
        return this.syncSource(input as SyncSourceInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.sources.resume_sync':
        return this.resumeSync(input as ResumeSyncInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.ledger.normalize':
        return this.normalizeLedger(input as NormalizeLedgerInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.profile.detect_filing_path':
        return this.detectFilingPath(input as DetectFilingPathInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.classify.run':
        return this.runClassification(input as RunClassificationInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.classify.list_review_items':
        return this.getReviewQueue(input as { workspaceId: string }) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.classify.resolve_review_item':
        return this.resolveReviewItems(input as ResolveReviewItemInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.filing.compute_draft':
        return this.computeDraft(input as ComputeDraftInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.filing.compare_with_hometax':
        return this.compareWithHomeTax(input as CompareWithHomeTaxInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.filing.refresh_official_data':
        return this.refreshOfficialData(input as RefreshOfficialDataInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.filing.prepare_hometax':
        return this.prepareHomeTax(input as PrepareHomeTaxInput) as KoreanTaxMCPContracts[TName]['output'];
      case 'tax.browser.start_hometax_assist':
        return this.startHomeTaxAssist(input as StartHomeTaxAssistInput) as KoreanTaxMCPContracts[TName]['output'];
      default:
        throw new Error(`Unsupported runtime tool: ${String(name)}`);
    }
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
    return this.store.taxpayerFacts.get(workspaceId) ?? [];
  }

  getWithholdingRecords(workspaceId: string): WithholdingRecord[] {
    return this.store.withholdingRecords.get(workspaceId) ?? [];
  }

  getFilingFieldValues(workspaceId: string): FilingFieldValue[] {
    return this.store.filingFieldValues.get(workspaceId) ?? [];
  }

  getAuthCheckpoints(workspaceId: string): AuthCheckpoint[] {
    return Array.from(this.store.authCheckpoints.values()).filter((checkpoint) => checkpoint.workspaceId === workspaceId);
  }

  getBrowserAssistSession(workspaceId: string): BrowserAssistSession | undefined {
    return this.store.assistSessionsByWorkspace.get(workspaceId);
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
        ?? (browserAssistSession && !browserAssistSession.endedAt
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

  private planCollection(input: KoreanTaxMCPContracts['tax.sources.plan_collection']['input']): KoreanTaxMCPContracts['tax.sources.plan_collection']['output'] {
    return taxSourcesPlanCollection(input);
  }

  private getCollectionStatus(input: GetCollectionStatusInput): MCPResponseEnvelope<CollectionStatusData> {
    const result = taxSourcesGetCollectionStatus(
      input,
      this.listSources(input.workspaceId),
      this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? [],
    );
    const derived = this.getWorkspaceDerivedStatus(input.workspaceId);
    return {
      ...result,
      blockingReason: derived.lastBlockingReason,
      nextRecommendedAction: derived.nextRecommendedAction ?? result.nextRecommendedAction,
    };
  }

  private getWorkspaceStatus(input: GetWorkspaceStatusInput): MCPResponseEnvelope<GetWorkspaceStatusData> {
    this.syncWorkspaceSnapshot(input.workspaceId);
    const workspace = this.getWorkspace(input.workspaceId) ?? this.ensureWorkspace(input.workspaceId);
    const draft = this.getDraft(input.workspaceId);
    const runtimeSnapshot = buildRuntimeSnapshot(workspace);
    const readiness = buildRuntimeReadiness(workspace, runtimeSnapshot.blockerCodes);
    const readinessState = buildRuntimeReadinessState(workspace);

    return {
      ok: true,
      status: 'completed',
      data: {
        workspace: {
          workspaceId: workspace.workspaceId,
          status: workspace.status,
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
        nextRecommendedAction: deriveWorkspaceNextRecommendedAction(workspace),
      },
      readiness,
      readinessState,
      nextRecommendedAction: deriveWorkspaceNextRecommendedAction(workspace),
    };
  }

  private getFilingSummary(input: GetFilingSummaryInput): MCPResponseEnvelope<GetFilingSummaryData> {
    this.syncWorkspaceSnapshot(input.workspaceId);
    const workspace = this.getWorkspace(input.workspaceId) ?? this.ensureWorkspace(input.workspaceId);
    const draft = this.getDraft(input.workspaceId);
    const nextAction = deriveWorkspaceNextRecommendedAction(workspace);
    const blockers = dedupeBlockingReasons([
      ...getRuntimeBlockerCodes(workspace),
      ...(draft?.blockerCodes ?? []),
    ]);

    const runtimeSnapshot = buildRuntimeSnapshot(workspace);
    const readiness = buildRuntimeReadiness(workspace, blockers.filter(isBlockingReason));
    const readinessState = buildRuntimeReadinessState(workspace);

    const keyPoints = [
      `workspace_status=${workspace.status}`,
      workspace.currentDraftId ? `current_draft=${workspace.currentDraftId}` : 'current_draft=none',
      `unresolved_reviews=${workspace.unresolvedReviewCount}`,
      `submission_readiness=${getRuntimeSubmissionReadiness(workspace)}`,
      `comparison=${getRuntimeComparisonState(workspace)}`,
      `freshness=${workspace.freshnessState ?? 'stale_unknown'}`,
    ];

    const detailLevel = input.detailLevel ?? 'standard';
    const headline = buildFilingSummaryHeadline(workspace);
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

    return {
      ok: true,
      status: 'completed',
      data: {
        workspaceId: input.workspaceId,
        draftId: input.draftId ?? draft?.draftId,
        headline,
        summaryText,
        operatorUpdate,
        status: workspace.status,
        keyPoints,
        blockers,
        runtimeSnapshot,
        nextRecommendedAction: nextAction,
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
    const result = taxSourcesSync(input);
    const source = this.store.sources.get(input.sourceId);

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
    const result = taxLedgerNormalize(input, Array.from(this.store.transactions.values()));
    const scopedTransactions = Array.from(this.store.transactions.values()).filter((tx) => tx.workspaceId === input.workspaceId);
    const taxpayerFacts = buildRuntimeTaxpayerFacts(input.workspaceId, scopedTransactions);
    const withholdingRecords = buildRuntimeWithholdingRecords(input.workspaceId, scopedTransactions);

    this.store.taxpayerFacts.set(input.workspaceId, taxpayerFacts);
    this.store.withholdingRecords.set(input.workspaceId, withholdingRecords);
    this.reconcileCoverageGapsForWorkspace(input.workspaceId);
    this.syncWorkspaceSnapshot(input.workspaceId, {
      status: result.data.transactionCount > 0 ? 'normalizing' : 'collecting',
    });
    return result;
  }

  private detectFilingPath(input: DetectFilingPathInput): MCPResponseEnvelope<DetectFilingPathData> {
    const result = taxProfileDetectFilingPath(
      input,
      Array.from(this.store.transactions.values()),
      this.listReviewItems(input.workspaceId),
      this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? [],
    );
    this.syncWorkspaceSnapshot(input.workspaceId);
    return result;
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
    this.store.filingFieldValues.set(workspaceId, nextFieldValues);
  }

  private computeDraft(input: ComputeDraftInput): MCPResponseEnvelope<ComputeDraftData> {
    const result = taxFilingComputeDraft(
      input,
      Array.from(this.store.transactions.values()),
      this.listDecisions(input.workspaceId),
      this.listReviewItems(input.workspaceId),
    );
    this.store.draftsByWorkspace.set(input.workspaceId, result.data);
    this.store.taxpayerFacts.set(input.workspaceId, result.data.taxpayerFacts ?? this.getTaxpayerFacts(input.workspaceId));
    this.store.withholdingRecords.set(input.workspaceId, result.data.withholdingRecords ?? this.getWithholdingRecords(input.workspaceId));
    this.store.filingFieldValues.set(input.workspaceId, result.data.fieldValues ?? []);
    this.reconcileCoverageGapsForWorkspace(input.workspaceId);
    this.syncWorkspaceSnapshot(input.workspaceId);
    return result;
  }

  private compareWithHomeTax(input: CompareWithHomeTaxInput): MCPResponseEnvelope<CompareWithHomeTaxData> {
    const draft = this.getDraft(input.workspaceId);
    const result = taxFilingCompareWithHomeTax(input, draft?.fieldValues ?? []);

    if (draft && result.data.fieldValues && result.readinessState && result.readiness) {
      this.store.filingFieldValues.set(input.workspaceId, result.data.fieldValues);
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
      this.store.filingFieldValues.set(input.workspaceId, refreshedFieldValues);
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
      draft?.fieldValues ?? [],
      {
        supportTier: draft?.supportTier ?? (draft?.fieldValues && draft.fieldValues.length > 0 ? 'tier_a' : 'undetermined'),
        filingPathKind: draft?.filingPathKind ?? (draft?.fieldValues && draft.fieldValues.length > 0 ? 'mixed_income_limited' : 'unknown'),
      },
    );
    this.syncWorkspaceSnapshot(input.workspaceId, {
      lastBlockingReason: result.blockingReason,
      status: result.ok ? 'ready_for_hometax_assist' : 'draft_ready_for_review',
    });
    return result;
  }

  private startHomeTaxAssist(input: StartHomeTaxAssistInput): MCPResponseEnvelope<StartHomeTaxAssistData> {
    const result = taxBrowserStartHomeTaxAssist(input);
    const browserAssistSession: BrowserAssistSession = {
      assistSessionId: result.data.assistSessionId,
      workspaceId: input.workspaceId,
      draftId: input.draftId,
      provider: 'hometax',
      checkpointType: result.data.checkpointType,
      authState: result.requiresAuth ? 'pending' : 'completed',
      pendingUserAction: result.pendingUserAction,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
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

  if (workspace.lastCollectionStatus === 'awaiting_user_action' || workspace.lastCollectionStatus === 'blocked') {
    return 'tax.sources.resume_sync';
  }
  if (primaryBlockingReason === 'official_data_refresh_required') {
    return 'tax.filing.refresh_official_data';
  }
  if (primaryBlockingReason === 'comparison_incomplete') {
    return 'tax.filing.compare_with_hometax';
  }
  if (primaryBlockingReason === 'missing_material_coverage' || primaryBlockingReason === 'awaiting_review_decision') {
    return 'tax.classify.list_review_items';
  }
  if (workspace.unresolvedReviewCount > 0) {
    return 'tax.classify.list_review_items';
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

function buildRuntimeTaxpayerFacts(workspaceId: string, transactions: LedgerTransaction[]): TaxpayerFact[] {
  if (transactions.length === 0) return [];
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
      evidenceRefs: transactions.flatMap((tx) => tx.evidenceRefs),
      note: `Derived from ${transactions.length} normalized transaction(s).`,
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
      evidenceRefs: transactions.flatMap((tx) => tx.evidenceRefs),
      note: `Derived from ${transactions.length} normalized transaction(s).`,
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

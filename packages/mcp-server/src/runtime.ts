import { deriveReadinessSummary } from '../../core/src/readiness.js';
import type { BlockingReason, ClassificationDecision, ConsentRecord, FilingWorkspace, LedgerTransaction, ReviewItem, SourceConnection, SyncAttempt } from '../../core/src/types.js';
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
  KoreanTaxMCPContracts,
  MCPResponseEnvelope,
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
  taxProfileDetectFilingPath,
  taxFilingCompareWithHomeTax,
  taxFilingComputeDraft,
  taxFilingPrepareHomeTax,
  taxFilingRefreshOfficialData,
  taxSourcesConnect,
  taxSourcesGetCollectionStatus,
  taxSourcesResumeSync,
  taxSourcesSync,
} from './tools.js';

export type SupportedRuntimeToolName =
  | 'tax.sources.get_collection_status'
  | 'tax.workspace.get_status'
  | 'tax.filing.get_summary'
  | 'tax.sources.connect'
  | 'tax.sources.sync'
  | 'tax.sources.resume_sync'
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
  coverageGapsByWorkspace: Map<string, string[]>;
  transactions: Map<string, LedgerTransaction>;
  decisions: Map<string, ClassificationDecision>;
  reviewItems: Map<string, ReviewItem>;
  draftsByWorkspace: Map<string, ComputeDraftData>;
  assistSessionsByWorkspace: Map<string, StartHomeTaxAssistData>;
};

export type CreateRuntimeOptions = {
  consentRecords?: ConsentRecord[];
  workspaces?: FilingWorkspace[];
  sources?: SourceConnection[];
  syncAttempts?: SyncAttempt[];
  coverageGapsByWorkspace?: Record<string, string[]>;
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
    coverageGapsByWorkspace: new Map(Object.entries(options.coverageGapsByWorkspace ?? {})),
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

  invoke(name: 'tax.sources.get_collection_status', input: GetCollectionStatusInput): MCPResponseEnvelope<CollectionStatusData>;
  invoke(name: 'tax.workspace.get_status', input: GetWorkspaceStatusInput): MCPResponseEnvelope<GetWorkspaceStatusData>;
  invoke(name: 'tax.filing.get_summary', input: GetFilingSummaryInput): MCPResponseEnvelope<GetFilingSummaryData>;
  invoke(name: 'tax.sources.connect', input: ConnectSourceInput): MCPResponseEnvelope<ConnectSourceData>;
  invoke(name: 'tax.sources.sync', input: SyncSourceInput): MCPResponseEnvelope<SyncSourceData>;
  invoke(name: 'tax.sources.resume_sync', input: ResumeSyncInput): MCPResponseEnvelope<ResumeSyncData>;
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
      openCoverageGapCount: (this.store.coverageGapsByWorkspace.get(workspaceId) ?? []).length,
    };

    this.store.workspaces.set(workspaceId, created);
    return created;
  }

  private syncWorkspaceSnapshot(workspaceId: string, hints: { lastBlockingReason?: FilingWorkspace['lastBlockingReason']; lastCollectionStatus?: FilingWorkspace['lastCollectionStatus']; status?: FilingWorkspace['status'] } = {}): void {
    const workspace = this.ensureWorkspace(workspaceId);
    const draft = this.getDraft(workspaceId);
    const unresolvedReviewCount = this.listReviewItems(workspaceId).filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed').length;
    const openCoverageGapCount = (this.store.coverageGapsByWorkspace.get(workspaceId) ?? []).length;
    const latestSyncAttempt = this.listSyncAttempts().filter((attempt) => attempt.workspaceId === workspaceId).sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))[0];

    this.store.workspaces.set(workspaceId, {
      ...workspace,
      status: hints.status
        ?? (draft?.submissionReadiness === 'submission_assist_ready'
          ? 'ready_for_hometax_assist'
          : draft?.draftReadiness === 'draft_ready'
            ? 'draft_ready_for_review'
            : unresolvedReviewCount > 0
              ? 'review_pending'
              : latestSyncAttempt
                ? 'collecting_sources'
                : workspace.status),
      supportTier: draft?.supportTier ?? workspace.supportTier,
      filingPathKind: draft?.filingPathKind ?? workspace.filingPathKind,
      estimateReadiness: draft?.estimateReadiness ?? workspace.estimateReadiness,
      draftReadiness: draft?.draftReadiness ?? workspace.draftReadiness,
      submissionReadiness: draft?.submissionReadiness ?? workspace.submissionReadiness,
      comparisonSummaryState: draft?.comparisonSummaryState ?? workspace.comparisonSummaryState,
      freshnessState: draft?.freshnessState ?? workspace.freshnessState,
      majorUnknowns: draft?.majorUnknowns ?? workspace.majorUnknowns,
      currentDraftId: draft?.draftId ?? workspace.currentDraftId,
      unresolvedReviewCount,
      openCoverageGapCount,
      lastBlockingReason: hints.lastBlockingReason
        ?? prioritizeBlockingReason(draft?.blockerCodes)
        ?? latestSyncAttempt?.blockingReason
        ?? workspace.lastBlockingReason,
      lastCollectionStatus: hints.lastCollectionStatus ?? latestSyncAttempt?.state ?? workspace.lastCollectionStatus,
      updatedAt: new Date().toISOString(),
    });
  }

  private getCollectionStatus(input: GetCollectionStatusInput): MCPResponseEnvelope<CollectionStatusData> {
    return taxSourcesGetCollectionStatus(
      input,
      this.listSources(input.workspaceId),
      this.store.coverageGapsByWorkspace.get(input.workspaceId) ?? [],
    );
  }

  private getWorkspaceStatus(input: GetWorkspaceStatusInput): MCPResponseEnvelope<GetWorkspaceStatusData> {
    this.syncWorkspaceSnapshot(input.workspaceId);
    const workspace = this.getWorkspace(input.workspaceId) ?? this.ensureWorkspace(input.workspaceId);
    const draft = this.getDraft(input.workspaceId);

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
          supportTier: workspace.supportTier,
          filingPathKind: workspace.filingPathKind,
          estimateReadiness: workspace.estimateReadiness,
          draftReadiness: workspace.draftReadiness,
          submissionReadiness: workspace.submissionReadiness,
          comparisonSummaryState: workspace.comparisonSummaryState,
          freshnessState: workspace.freshnessState,
          lastBlockingReason: workspace.lastBlockingReason,
          lastCollectionStatus: workspace.lastCollectionStatus,
          majorUnknowns: workspace.majorUnknowns,
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
        nextRecommendedAction: deriveWorkspaceNextRecommendedAction(workspace),
      },
      readiness: {
        supportTier: workspace.supportTier ?? 'undetermined',
        filingPathKind: workspace.filingPathKind ?? 'unknown',
        estimateReadiness: workspace.estimateReadiness ?? 'not_ready',
        draftReadiness: workspace.draftReadiness ?? 'not_ready',
        submissionReadiness: workspace.submissionReadiness ?? 'not_ready',
        comparisonSummaryState: workspace.comparisonSummaryState ?? 'not_started',
        freshnessState: workspace.freshnessState ?? 'stale_unknown',
        majorUnknowns: workspace.majorUnknowns ?? [],
        blockerCodes: workspace.lastBlockingReason ? [workspace.lastBlockingReason] : [],
      },
      nextRecommendedAction: deriveWorkspaceNextRecommendedAction(workspace),
    };
  }

  private getFilingSummary(input: GetFilingSummaryInput): MCPResponseEnvelope<GetFilingSummaryData> {
    this.syncWorkspaceSnapshot(input.workspaceId);
    const workspace = this.getWorkspace(input.workspaceId) ?? this.ensureWorkspace(input.workspaceId);
    const draft = this.getDraft(input.workspaceId);
    const nextAction = deriveWorkspaceNextRecommendedAction(workspace);
    const blockers = [
      workspace.lastBlockingReason,
      ...(draft?.blockerCodes ?? []).filter((code) => code !== workspace.lastBlockingReason),
    ].filter((code): code is string => Boolean(code));

    const keyPoints = [
      `workspace_status=${workspace.status}`,
      workspace.currentDraftId ? `current_draft=${workspace.currentDraftId}` : 'current_draft=none',
      `unresolved_reviews=${workspace.unresolvedReviewCount}`,
      `submission_readiness=${workspace.submissionReadiness ?? 'not_ready'}`,
      `comparison=${workspace.comparisonSummaryState ?? 'not_started'}`,
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
        nextRecommendedAction: nextAction,
        metrics: {
          unresolvedReviewCount: workspace.unresolvedReviewCount,
          warningCount: draft?.warnings.length ?? 0,
          fieldValueCount: draft?.fieldValues?.length ?? 0,
        },
      },
      readiness: {
        supportTier: workspace.supportTier ?? 'undetermined',
        filingPathKind: workspace.filingPathKind ?? 'unknown',
        estimateReadiness: workspace.estimateReadiness ?? 'not_ready',
        draftReadiness: workspace.draftReadiness ?? 'not_ready',
        submissionReadiness: workspace.submissionReadiness ?? 'not_ready',
        comparisonSummaryState: workspace.comparisonSummaryState ?? 'not_started',
        freshnessState: workspace.freshnessState ?? 'stale_unknown',
        majorUnknowns: workspace.majorUnknowns ?? [],
        blockerCodes: blockers.filter((code): code is BlockingReason => isBlockingReason(code)),
      },
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

    this.syncWorkspaceSnapshot(completedAttempt.workspaceId, {
      lastCollectionStatus: completedAttempt.state,
      status: 'collecting',
    });

    return result;
  }

  private detectFilingPath(input: DetectFilingPathInput): MCPResponseEnvelope<DetectFilingPathData> {
    const result = taxProfileDetectFilingPath(
      input,
      Array.from(this.store.transactions.values()),
      this.listReviewItems(input.workspaceId),
      [],
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
    });
  }

  private computeDraft(input: ComputeDraftInput): MCPResponseEnvelope<ComputeDraftData> {
    const result = taxFilingComputeDraft(
      input,
      Array.from(this.store.transactions.values()),
      this.listDecisions(input.workspaceId),
      this.listReviewItems(input.workspaceId),
    );
    this.store.draftsByWorkspace.set(input.workspaceId, result.data);
    this.syncWorkspaceSnapshot(input.workspaceId);
    return result;
  }

  private compareWithHomeTax(input: CompareWithHomeTaxInput): MCPResponseEnvelope<CompareWithHomeTaxData> {
    const draft = this.getDraft(input.workspaceId);
    const result = taxFilingCompareWithHomeTax(input, draft?.fieldValues ?? []);

    if (draft && result.data.fieldValues && result.readiness) {
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

    if (draft?.fieldValues && result.readiness) {
      this.store.draftsByWorkspace.set(input.workspaceId, {
        ...draft,
        draftId: result.data.recomputedDraftId ?? draft.draftId,
        fieldValues: draft.fieldValues.map((field) => ({ ...field, freshnessState: 'current_enough' })),
        blockerCodes: result.readiness.blockerCodes,
        supportTier: result.readiness.supportTier,
        filingPathKind: result.readiness.filingPathKind,
        estimateReadiness: result.readiness.estimateReadiness,
        draftReadiness: result.readiness.draftReadiness,
        submissionReadiness: result.readiness.submissionReadiness,
        comparisonSummaryState: result.readiness.comparisonSummaryState,
        freshnessState: result.readiness.freshnessState,
        majorUnknowns: result.readiness.majorUnknowns,
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
    this.store.assistSessionsByWorkspace.set(input.workspaceId, result.data);
    this.syncWorkspaceSnapshot(input.workspaceId, {
      lastBlockingReason: result.blockingReason,
      status: 'submission_in_progress',
    });
    return result;
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
  const readinessLine = `READINESS: submission=${humanizeToken(params.workspace.submissionReadiness ?? 'not_ready')} | comparison=${humanizeToken(params.workspace.comparisonSummaryState ?? 'not_started')} | freshness=${humanizeToken(params.workspace.freshnessState ?? 'stale_unknown')}`;
  const queueLine = `QUEUE: reviews=${params.workspace.unresolvedReviewCount} | warnings=${params.draft?.warnings.length ?? 0} | draft=${params.workspace.currentDraftId ?? 'none'}`;
  const blockerLine = params.blockers.length > 0 ? `BLOCKER: ${describeBlockingReason(params.blockers[0])}` : undefined;
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

  if (params.workspace.status === 'ready_for_hometax_assist' || params.workspace.submissionReadiness === 'submission_assist_ready') {
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
      nextLine,
      draftLine,
    ]);
  }

  if (
    params.workspace.lastCollectionStatus === 'awaiting_user_action'
    || params.workspace.lastCollectionStatus === 'blocked'
    || params.workspace.lastBlockingReason === 'missing_auth'
    || params.workspace.lastBlockingReason === 'missing_consent'
  ) {
    return compactLines([
      '⏸️ COLLECTION BLOCKED',
      `STATUS: ${params.headline}`,
      blockerLine,
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
    nextLine,
    draftLine,
  ]);
}

function compactLines(lines: Array<string | undefined>): string[] {
  return lines.filter((line): line is string => Boolean(line));
}

function buildFilingSummaryHeadline(workspace: FilingWorkspace): string {
  if (workspace.submissionReadiness === 'submission_assist_ready') {
    return 'The filing draft is ready for HomeTax preparation.';
  }
  if (workspace.unresolvedReviewCount > 0) {
    return 'The filing workflow is waiting on review decisions.';
  }
  if (workspace.lastBlockingReason === 'comparison_incomplete') {
    return 'The draft still needs HomeTax comparison before preparation.';
  }
  if (workspace.lastBlockingReason === 'official_data_refresh_required') {
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

  const readinessSentence = `Submission readiness is ${humanizeToken(params.workspace.submissionReadiness ?? 'not_ready')}, with comparison ${humanizeToken(params.workspace.comparisonSummaryState ?? 'not_started')} and freshness ${humanizeToken(params.workspace.freshnessState ?? 'stale_unknown')}.`;

  const blockerSentence = params.blockers.length > 0
    ? `Main blocker: ${params.blockers.map((blocker) => describeBlockingReason(blocker)).join(' ')}.`
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
  if (workspace.lastCollectionStatus === 'awaiting_user_action' || workspace.lastCollectionStatus === 'blocked') {
    return 'tax.sources.resume_sync';
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
  if (workspace.comparisonSummaryState !== 'matched_enough' && workspace.comparisonSummaryState !== 'manual_only') {
    return 'tax.filing.compare_with_hometax';
  }
  if (workspace.submissionReadiness === 'submission_assist_ready') {
    return 'tax.filing.prepare_hometax';
  }
  return undefined;
}

function prioritizeBlockingReason(blockerCodes?: string[]): FilingWorkspace['lastBlockingReason'] | undefined {
  if (!blockerCodes?.length) return undefined;
  const priority: BlockingReason[] = [
    'awaiting_review_decision',
    'comparison_incomplete',
    'official_data_refresh_required',
    'missing_material_coverage',
    'unsupported_filing_path',
    'submission_not_ready',
    'draft_not_ready',
    'awaiting_final_approval',
    'missing_auth',
    'missing_consent',
    'export_required',
    'blocked_by_provider',
    'ui_changed',
    'insufficient_metadata',
    'unsupported_source',
    'unsupported_hometax_state',
  ];

  for (const code of priority) {
    if (blockerCodes.includes(code)) return code;
  }

  return undefined;
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

function extractWorkspaceIdFromSourceId(sourceId?: string): string {
  if (!sourceId) return 'unknown_workspace';
  const match = sourceId.match(/^source_[^_]+_(.+)$/);
  return match?.[1] ?? 'unknown_workspace';
}

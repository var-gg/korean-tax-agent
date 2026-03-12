import { deriveReadinessSummary } from '../../core/src/readiness.js';
import type { BlockingReason, ClassificationDecision, ConsentRecord, FilingWorkspace, LedgerTransaction, ReviewItem, SourceConnection, SyncAttempt } from '../../core/src/types.js';
import type {
  CollectionStatusData,
  CompareWithHomeTaxData,
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

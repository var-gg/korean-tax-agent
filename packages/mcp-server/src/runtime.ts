import type { ClassificationDecision, ConsentRecord, LedgerTransaction, ReviewItem, SourceConnection, SyncAttempt } from '../../core/src/types.js';
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
  | 'tax.filing.prepare_hometax'
  | 'tax.browser.start_hometax_assist';

export type RuntimeStore = {
  consentRecords: ConsentRecord[];
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

    return result;
  }

  private detectFilingPath(input: DetectFilingPathInput): MCPResponseEnvelope<DetectFilingPathData> {
    return taxProfileDetectFilingPath(
      input,
      Array.from(this.store.transactions.values()),
      this.listReviewItems(input.workspaceId),
      [],
    );
  }

  private runClassification(input: RunClassificationInput): MCPResponseEnvelope<RunClassificationData> {
    const result = taxClassifyRun(input, Array.from(this.store.transactions.values()));
    for (const decision of result.data.decisions ?? []) {
      this.store.decisions.set(decision.decisionId, decision);
    }
    for (const item of result.data.reviewItems ?? []) {
      this.store.reviewItems.set(item.reviewItemId, item);
    }
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
    return result;
  }

  private computeDraft(input: ComputeDraftInput): MCPResponseEnvelope<ComputeDraftData> {
    const result = taxFilingComputeDraft(
      input,
      Array.from(this.store.transactions.values()),
      this.listDecisions(input.workspaceId),
      this.listReviewItems(input.workspaceId),
    );
    this.store.draftsByWorkspace.set(input.workspaceId, result.data);
    return result;
  }

  private compareWithHomeTax(input: CompareWithHomeTaxInput): MCPResponseEnvelope<CompareWithHomeTaxData> {
    const draft = this.getDraft(input.workspaceId);
    return taxFilingCompareWithHomeTax(input, draft?.fieldValues ?? []);
  }

  private prepareHomeTax(input: PrepareHomeTaxInput): MCPResponseEnvelope<PrepareHomeTaxData> {
    return taxFilingPrepareHomeTax(input, this.listReviewItems(input.workspaceId));
  }

  private startHomeTaxAssist(input: StartHomeTaxAssistInput): MCPResponseEnvelope<StartHomeTaxAssistData> {
    const result = taxBrowserStartHomeTaxAssist(input);
    this.store.assistSessionsByWorkspace.set(input.workspaceId, result.data);
    return result;
  }
}

function extractWorkspaceIdFromSourceId(sourceId?: string): string {
  if (!sourceId) return 'unknown_workspace';
  const match = sourceId.match(/^source_[^_]+_(.+)$/);
  return match?.[1] ?? 'unknown_workspace';
}

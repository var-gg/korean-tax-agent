import type { ConsentRecord, SourceConnection, SyncAttempt } from '../../core/src/types.js';
import type {
  CollectionStatusData,
  ConnectSourceData,
  ConnectSourceInput,
  GetCollectionStatusInput,
  KoreanTaxMCPContracts,
  MCPResponseEnvelope,
  ResumeSyncData,
  ResumeSyncInput,
  SyncSourceData,
  SyncSourceInput,
} from './contracts.js';
import {
  taxSourcesConnect,
  taxSourcesGetCollectionStatus,
  taxSourcesResumeSync,
  taxSourcesSync,
} from './tools.js';

export type SupportedRuntimeToolName =
  | 'tax.sources.get_collection_status'
  | 'tax.sources.connect'
  | 'tax.sources.sync'
  | 'tax.sources.resume_sync';

export type RuntimeStore = {
  consentRecords: ConsentRecord[];
  sources: Map<string, SourceConnection>;
  syncAttempts: Map<string, SyncAttempt>;
  coverageGapsByWorkspace: Map<string, string[]>;
};

export type CreateRuntimeOptions = {
  consentRecords?: ConsentRecord[];
  sources?: SourceConnection[];
  syncAttempts?: SyncAttempt[];
  coverageGapsByWorkspace?: Record<string, string[]>;
};

export function createRuntimeStore(options: CreateRuntimeOptions = {}): RuntimeStore {
  return {
    consentRecords: [...(options.consentRecords ?? [])],
    sources: new Map((options.sources ?? []).map((source) => [source.sourceId, source])),
    syncAttempts: new Map((options.syncAttempts ?? []).map((attempt) => [attempt.syncAttemptId, attempt])),
    coverageGapsByWorkspace: new Map(Object.entries(options.coverageGapsByWorkspace ?? {})),
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
}

function extractWorkspaceIdFromSourceId(sourceId?: string): string {
  if (!sourceId) return 'unknown_workspace';
  const match = sourceId.match(/^source_[^_]+_(.+)$/);
  return match?.[1] ?? 'unknown_workspace';
}

import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import type { ConsentRecord, SourceConnection, SyncAttempt } from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  filingYear: number;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: Array<{ description: string }>;
};

describe('in-memory runtime', () => {
  it('exposes setup and planning tools through runtime', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();

    const inspectResult = runtime.invoke('tax.setup.inspect_environment', {});
    expect(inspectResult.ok).toBe(true);
    expect(inspectResult.nextRecommendedAction).toBe('tax.setup.init_config');

    const initResult = runtime.invoke('tax.setup.init_config', {
      filingYear: 2025,
      storageMode: 'local',
      taxpayerTypeHint: 'sole proprietor',
    });
    expect(initResult.ok).toBe(true);
    expect(initResult.data.workspaceId).toContain('workspace_2025');
    expect(initResult.nextRecommendedAction).toBe('tax.sources.plan_collection');

    const planResult = runtime.invoke('tax.sources.plan_collection', {
      workspaceId: initResult.data.workspaceId,
      filingYear: 2025,
    });
    expect(planResult.ok).toBe(true);
    expect(planResult.data.recommendedSources.length).toBeGreaterThan(0);
    expect(planResult.nextRecommendedAction).toBe('tax.sources.connect');
  });

  it('persists source and sync state across connect/sync/resume/normalize', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      sources: demo.sources.filter((source) => source.sourceType !== 'hometax'),
      syncAttempts: [],
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps.map((gap) => gap.description),
      },
      transactions: demo.transactions,
    });

    const before = runtime.invoke('tax.sources.get_collection_status', { workspaceId: demo.workspaceId });
    expect(before.data.connectedSources.some((source) => source.sourceType === 'hometax')).toBe(false);

    const connectResult = runtime.invoke('tax.sources.connect', {
      workspaceId: demo.workspaceId,
      sourceType: 'hometax',
      requestedScope: ['read_documents', 'prepare_import'],
    });

    expect(connectResult.status).toBe('awaiting_auth');
    expect(runtime.listSources(demo.workspaceId).some((source) => source.sourceId === connectResult.data.sourceId)).toBe(true);

    const afterConnect = runtime.invoke('tax.sources.get_collection_status', { workspaceId: demo.workspaceId });
    expect(afterConnect.data.pendingCheckpoints).toContain('authentication');

    const syncResult = runtime.invoke('tax.sources.sync', {
      sourceId: connectResult.data.sourceId,
      syncMode: 'full',
    });

    expect(syncResult.status).toBe('awaiting_user_action');
    expect(runtime.listSyncAttempts(connectResult.data.sourceId)).toHaveLength(1);
    expect(runtime.listSyncAttempts(connectResult.data.sourceId)[0]?.state).toBe('blocked');

    const resumeResult = runtime.invoke('tax.sources.resume_sync', {
      sourceId: connectResult.data.sourceId,
      checkpointId: syncResult.checkpointId,
      resumeToken: syncResult.resumeToken,
    });

    expect(resumeResult.status).toBe('completed');

    const sourceAfterResume = runtime.listSources(demo.workspaceId).find((source) => source.sourceId === connectResult.data.sourceId);
    expect(sourceAfterResume?.state).toBe('completed');

    const statusAfterResume = runtime.invoke('tax.sources.get_collection_status', { workspaceId: demo.workspaceId });
    expect(statusAfterResume.data.pendingCheckpoints).not.toContain('authentication');

    const normalizeResult = runtime.invoke('tax.ledger.normalize', {
      workspaceId: demo.workspaceId,
      artifactIds: ['artifact_csv_1'],
    });

    expect(normalizeResult.status).toBe('completed');
    expect(normalizeResult.data.transactionCount).toBe(3);
    expect(normalizeResult.nextRecommendedAction).toBe('tax.classify.run');
  });
});

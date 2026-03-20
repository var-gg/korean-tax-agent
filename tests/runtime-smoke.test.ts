import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import type { ConsentRecord, CoverageGap, EvidenceDocument, SourceArtifact, SourceConnection, SyncAttempt } from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  filingYear: number;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: CoverageGap[];
  sourceArtifacts: SourceArtifact[];
  evidenceDocuments: EvidenceDocument[];
  transactions: import('../packages/core/src/types.js').LedgerTransaction[];
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
        [demo.workspaceId]: demo.coverageGaps,
      },
      sourceArtifacts: demo.sourceArtifacts,
      evidenceDocuments: demo.evidenceDocuments,
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
    expect(normalizeResult.data.documentCount).toBe(2);
    expect(normalizeResult.data.coverageGapsCreated.some((gap) => gap.gapType === 'missing_expense_evidence')).toBe(true);
    expect(normalizeResult.nextRecommendedAction).toBe('tax.classify.run');
  });

  it('accepts extracted payloads and creates withholding workflow state', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      sources: demo.sources,
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps,
      },
      sourceArtifacts: demo.sourceArtifacts,
      evidenceDocuments: demo.evidenceDocuments,
      transactions: demo.transactions,
    });

    const normalizeResult = runtime.invoke('tax.ledger.normalize', {
      workspaceId: demo.workspaceId,
      artifactIds: ['artifact_wht_1'],
      normalizationMode: 'append',
      extractedPayloads: [{
        artifactId: 'artifact_wht_1',
        sourceId: 'source_hometax_demo_workspace_2025',
        sourceType: 'hometax',
        provenance: { uploadRef: 'upload://artifact_wht_1' },
        documents: [{
          externalId: 'home-tax-wht-doc',
          documentType: 'withholding_doc',
          fileRef: 'upload://wht-doc',
          issuer: 'Client A',
          amount: 450000,
          extractedFields: { payerName: 'Client A', withheldTaxAmount: 13500 },
        }],
        withholdingRecords: [{
          externalId: 'home-tax-wht-record',
          payerName: 'Client A',
          grossAmount: 450000,
          withheldTaxAmount: 13500,
          localTaxAmount: 1350,
          evidenceDocumentRefs: ['home-tax-wht-doc'],
        }],
      }],
    });

    expect(normalizeResult.data.withholdingRecordsCreated).toHaveLength(1);
    expect(runtime.getWithholdingRecords(demo.workspaceId)).toHaveLength(1);
    expect(runtime.store.taxpayerFactsByWorkspace.get(demo.workspaceId)?.length).toBeGreaterThan(0);
    expect(runtime.store.withholdingRecordsByWorkspace.get(demo.workspaceId)?.length).toBe(1);
    expect(runtime.store.normalizationLinksByWorkspace.get(demo.workspaceId)?.[0]?.artifactId).toBe('artifact_wht_1');
    expect(runtime.store.normalizationLinksByWorkspace.get(demo.workspaceId)?.[0]?.documentIds).toContain('doc_home_tax_wht_doc');
    expect(normalizeResult.data.coverageGapsCreated.some((gap) => gap.gapType === 'missing_hometax_comparison')).toBe(true);
  });

  it('returns typed coverage gaps and single-read derived status from runtime state', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      sources: demo.sources,
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps,
      },
      sourceArtifacts: demo.sourceArtifacts,
      evidenceDocuments: demo.evidenceDocuments,
      transactions: demo.transactions,
    });

    runtime.invoke('tax.ledger.normalize', {
      workspaceId: demo.workspaceId,
      artifactIds: ['artifact_csv_1'],
    });

    const collectionStatus = runtime.invoke('tax.sources.get_collection_status', { workspaceId: demo.workspaceId });
    expect(collectionStatus.data.coverageGaps.length).toBeGreaterThan(0);
    expect(collectionStatus.data.coverageGaps.every((gap) => typeof gap === 'object' && typeof gap.gapType === 'string')).toBe(true);
    expect(collectionStatus.data.coverageGaps.every((gap) => Array.isArray(gap.relatedSourceIds))).toBe(true);

    const workspaceStatus = runtime.invoke('tax.workspace.get_status', { workspaceId: demo.workspaceId });
    expect(workspaceStatus.data.workspace.openCoverageGapCount).toBeGreaterThan(0);
    expect(workspaceStatus.data.workspace.lastBlockingReason).toBe('comparison_incomplete');
    expect(workspaceStatus.data.nextRecommendedAction).toBe('tax.filing.compare_with_hometax');

    const derived = runtime.getWorkspaceDerivedStatus(demo.workspaceId);
    expect(derived.openCoverageGapCount).toBe(workspaceStatus.data.workspace.openCoverageGapCount);
    expect(['comparison_incomplete', 'missing_material_coverage']).toContain(derived.lastBlockingReason);
    expect(typeof derived.nextRecommendedAction).toBe('string');
  });
});

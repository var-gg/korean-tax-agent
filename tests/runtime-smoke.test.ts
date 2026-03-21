import { mkdtempSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import { JsonFileSnapshotPersistenceAdapter } from '../packages/core/src/persistence.js';
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
    expect(planResult.data.nextActionPlan?.collectionMode).toBe('browser_assist');
    expect(planResult.data.nextActionPlan?.recommendedNextAction).toBeTruthy();
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

    const beforeList = runtime.invoke('tax.sources.list', {
      workspaceId: demo.workspaceId,
      includeSyncSummary: true,
    });
    expect(beforeList.ok).toBe(true);
    expect(Array.isArray(beforeList.data.sources)).toBe(true);

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

    const artifactCountBeforeDisconnect = runtime.store.sourceArtifacts.size;
    const documentCountBeforeDisconnect = runtime.store.evidenceDocuments.size;
    const transactionCountBeforeDisconnect = runtime.store.transactions.size;
    const withholdingCountBeforeDisconnect = runtime.getWithholdingRecords(demo.workspaceId).length;

    const disconnected = runtime.invoke('tax.sources.disconnect', {
      workspaceId: demo.workspaceId,
      sourceId: connectResult.data.sourceId,
      reason: 'operator requested disconnect',
    });
    expect(disconnected.ok).toBe(true);
    expect(disconnected.data.recordsRetained).toBe(true);
    expect(runtime.store.sourceArtifacts.size).toBe(artifactCountBeforeDisconnect);
    expect(runtime.store.evidenceDocuments.size).toBe(documentCountBeforeDisconnect);
    expect(runtime.store.transactions.size).toBe(transactionCountBeforeDisconnect);
    expect(runtime.getWithholdingRecords(demo.workspaceId).length).toBe(withholdingCountBeforeDisconnect);

    const afterDisconnectList = runtime.invoke('tax.sources.list', {
      workspaceId: demo.workspaceId,
      includeDisabled: true,
      includeSyncSummary: true,
    });
    const disconnectedSource = afterDisconnectList.data.sources.find((source) => source.sourceId === connectResult.data.sourceId);
    expect(disconnectedSource?.availability).toBe('disconnected');
    expect(disconnectedSource?.syncSummary?.lastSyncAttemptState).toBe('completed');

    const blockedSync = runtime.invoke('tax.sources.sync', {
      sourceId: connectResult.data.sourceId,
      syncMode: 'incremental',
    });
    expect(blockedSync.ok).toBe(false);
    expect(blockedSync.status).toBe('blocked');
    expect(blockedSync.nextRecommendedAction).toBe('tax.sources.list');

    const blockedResume = runtime.invoke('tax.sources.resume_sync', {
      sourceId: connectResult.data.sourceId,
      syncSessionId: 'sync_disconnected',
    });
    expect(blockedResume.ok).toBe(false);
    expect(blockedResume.status).toBe('blocked');
    expect(blockedResume.nextRecommendedAction).toBe('tax.sources.list');
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
    const withholdingRows = runtime.invoke('tax.withholding.list_records', { workspaceId: demo.workspaceId, evidenceStatus: 'linked' });
    expect(withholdingRows.ok).toBe(true);
    expect(withholdingRows.data.rows[0]?.payerOrIssuer).toBe('Client A');
    expect(runtime.store.normalizationLinksByWorkspace.get(demo.workspaceId)?.[0]?.artifactId).toBe('artifact_wht_1');
    expect(runtime.store.normalizationLinksByWorkspace.get(demo.workspaceId)?.[0]?.documentIds).toContain('doc_home_tax_wht_doc');
    expect(normalizeResult.data.coverageGapsCreated.some((gap) => gap.gapType === 'missing_hometax_comparison')).toBe(true);
  });

  it('keeps supported simple cases from being over-blocked by duplicate heuristics', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_simple_supported_case';

    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{
          externalId: 'salary-simple-1',
          occurredAt: '2025-03-25',
          amount: 3500000,
          normalizedDirection: 'income',
          counterparty: 'Simple Payroll',
          description: 'salary payroll march',
          sourceReference: 'salary-simple-1',
        }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['salary'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'simple_salary_light', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });

    const classify = runtime.invoke('tax.classify.run', { workspaceId });
    expect(classify.data.stopReasonCodes).not.toContain('unresolved_duplicate');
  });

  it('supports browser assist checkpoint read/stop surfaces deterministically', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'simple_salary_light' });
    const workspaceId = init.data.workspaceId;
    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{ externalId: 'salary-1', occurredAt: '2025-03-25', amount: 3500000, normalizedDirection: 'income', counterparty: 'Simple Payroll', description: 'salary payroll march', sourceReference: 'salary-1' }],
        withholdingRecords: [{ externalId: 'wh-1', incomeSourceRef: 'salary-1', payerName: 'Simple Payroll', grossAmount: 3500000, withheldTaxAmount: 105000, localTaxAmount: 10500 }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['salary'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'simple_salary_light', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'residency_context', category: 'taxpayer_profile', value: 'domestic_only', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    runtime.invoke('tax.classify.run', { workspaceId });
    const draft = runtime.invoke('tax.filing.compute_draft', {
      workspaceId,
      draftMode: 'new_version',
      includeAssumptions: true,
    });
    runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId: draft.data.draftId });
    runtime.invoke('tax.filing.compare_with_hometax', { workspaceId, draftId: draft.data.draftId, portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({ sectionKey: field.sectionKey, fieldKey: field.fieldKey, portalObservedValue: field.value })) });

    const started = runtime.invoke('tax.browser.start_hometax_assist', {
      workspaceId,
      draftId: draft.data.draftId,
      mode: 'guide_only',
    });
    expect(started.ok).toBe(true);

    const checkpoint = runtime.invoke('tax.browser.get_checkpoint', {
      assistSessionId: started.data.assistSessionId,
      workspaceId,
    });
    expect(checkpoint.ok).toBe(true);
    expect(checkpoint.data.assistSessionId).toBe(started.data.assistSessionId);
    expect(checkpoint.data.authRequired).toBe(true);
    expect(checkpoint.data.handoff.recommendedTool).toBe('tax.browser.resume_hometax_assist');
    expect(checkpoint.data.screenKey).toBeTruthy();
    expect(checkpoint.data.checkpointKey).toBeTruthy();
    expect(Array.isArray(checkpoint.data.allowedNextActions)).toBe(true);
    expect(Array.isArray(checkpoint.data.resumePreconditions)).toBe(true);
    expect(checkpoint.data.handoff.entryPlan?.orderedSections.length).toBeGreaterThan(0);
    expect(['tax.browser.resume_hometax_assist', 'tax.browser.get_checkpoint']).toContain(checkpoint.nextRecommendedAction);

    const stopped = runtime.invoke('tax.browser.stop_hometax_assist', {
      assistSessionId: started.data.assistSessionId,
      workspaceId,
    });
    expect(stopped.ok).toBe(true);
    expect(stopped.data.stopped).toBe(true);
    expect(stopped.data.preservedContext.auditable).toBe(true);
    expect(stopped.nextRecommendedAction).toBe('tax.browser.start_hometax_assist');

    const afterStop = runtime.invoke('tax.browser.get_checkpoint', {
      assistSessionId: started.data.assistSessionId,
      workspaceId,
    });
    expect(afterStop.ok).toBe(true);
    expect(afterStop.data.stopped).toBe(true);
    expect(afterStop.nextRecommendedAction).toBe('tax.browser.start_hometax_assist');
  });

  it('supports ref-based import ingestion tools without local parsing', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime();
    const workspaceId = 'workspace_2025_import_demo';

    const uploadTransactions = runtime.invoke('tax.import.upload_transactions', {
      workspaceId,
      refs: [
        { ref: 'upload://bank/2025-01.csv', contentType: 'text/csv' },
        { ref: 'upload://bank/2025-01.csv', contentType: 'text/csv' },
      ],
      formatHints: ['bank_csv'],
      importMetadata: { uploader: 'test' },
    });
    expect(uploadTransactions.ok).toBe(true);
    expect(uploadTransactions.data.artifactIds).toHaveLength(1);
    expect(uploadTransactions.data.normalizeReadiness).toBe('ready');
    expect(uploadTransactions.nextRecommendedAction).toBe('tax.ledger.normalize');

    const storedTransactionArtifact = runtime.store.sourceArtifacts.get(uploadTransactions.data.artifactIds[0]!);
    expect(storedTransactionArtifact?.contentRef).toBe('upload://bank/2025-01.csv');
    expect(storedTransactionArtifact?.provenance?.importTool).toBe('tax.import.upload_transactions');

    const uploadDocuments = runtime.invoke('tax.import.upload_documents', {
      workspaceId,
      refs: [{ ref: 'upload://docs/receipt-a.pdf', contentType: 'application/pdf' }],
      documentHints: [{ ref: 'upload://docs/receipt-a.pdf', documentType: 'receipt', issuer: 'Store A' }],
    });
    expect(uploadDocuments.ok).toBe(true);
    expect(uploadDocuments.data.documentIds).toHaveLength(1);
    expect(uploadDocuments.nextRecommendedAction).toBe('tax.ledger.normalize');

    const submitFields = runtime.invoke('tax.import.submit_extracted_receipt_fields', {
      workspaceId,
      submissions: [{ documentId: uploadDocuments.data.documentIds[0], documentRef: 'upload://docs/receipt-a.pdf', fields: { totalAmount: 12000, merchantName: 'Store A' } }],
      extractorMetadata: { extractorType: 'external-ocr', extractorVersion: '1.0.0', runId: 'run_1' },
    });
    expect(submitFields.ok).toBe(true);
    const storedDocument = runtime.store.evidenceDocuments.get(uploadDocuments.data.documentIds[0]!);
    expect(storedDocument?.extractedFields?.merchantName).toBe('Store A');
    expect((storedDocument?.extractedFields as Record<string, unknown>)?.extractorMetadata).toBeTruthy();

    const hometaxImport = runtime.invoke('tax.import.import_hometax_materials', {
      workspaceId,
      refs: [
        { ref: 'upload://hometax/2025-income-export.pdf' },
        { ref: 'upload://misc/unknown-weird.bin' },
      ],
      materialMetadata: [
        { ref: 'upload://hometax/2025-income-export.pdf', materialTypeHint: 'income_statement' },
        { ref: 'upload://misc/unknown-weird.bin', materialTypeHint: 'unknown' },
      ],
    });
    expect(hometaxImport.ok).toBe(true);
    expect(hometaxImport.data.recognizedMaterials.some((item) => item.supported)).toBe(true);
    expect(hometaxImport.warnings?.some((warning) => warning.code === 'unsupported_hometax_material')).toBe(true);
    expect(hometaxImport.nextRecommendedAction).toBe('tax.ledger.normalize');

    const repeatUpload = runtime.invoke('tax.import.upload_transactions', {
      workspaceId,
      refs: [{ ref: 'upload://bank/2025-01.csv', contentType: 'text/csv' }],
      formatHints: ['bank_csv'],
    });
    expect(repeatUpload.data.artifactIds[0]).toBe(uploadTransactions.data.artifactIds[0]);
  });

  it('lists transactions with filters and links evidence deterministically', () => {
    const runtime = new InMemoryKoreanTaxMCPRuntime({
      consentRecords: demo.consentRecords,
      sources: demo.sources,
      coverageGapsByWorkspace: {
        [demo.workspaceId]: demo.coverageGaps,
        workspace_other: [],
      },
      sourceArtifacts: demo.sourceArtifacts,
      evidenceDocuments: [
        ...demo.evidenceDocuments,
        {
          documentId: 'doc_cross_workspace',
          workspaceId: 'workspace_other',
          sourceId: 'source_other',
          documentType: 'receipt',
          fileRef: 'upload://other/receipt.pdf',
          linkedTransactionIds: [],
        },
      ],
      transactions: demo.transactions,
    });

    runtime.invoke('tax.ledger.normalize', {
      workspaceId: demo.workspaceId,
      artifactIds: ['artifact_csv_1'],
    });

    const filtered = runtime.invoke('tax.ledger.list_transactions', {
      workspaceId: demo.workspaceId,
      direction: 'expense',
      evidenceStatus: 'linked',
      limit: 10,
      offset: 0,
    });
    expect(filtered.ok).toBe(true);
    expect(filtered.data.page.total).toBeGreaterThan(0);
    expect(filtered.data.rows.every((row) => row.normalizedDirection === 'expense')).toBe(true);
    expect(filtered.data.rows.every((row) => row.evidenceLink.status === 'linked')).toBe(true);

    const appendLink = runtime.invoke('tax.ledger.link_evidence', {
      workspaceId: demo.workspaceId,
      transactionIds: ['tx_2'],
      documentIds: ['doc_receipt_2'],
      linkMode: 'append',
    });
    expect(appendLink.ok).toBe(true);
    expect(appendLink.data.affectedTransactionIds).toContain('tx_2');
    expect(runtime.store.transactions.get('tx_2')?.evidenceRefs).toContain('doc_receipt_2');

    const replaceLink = runtime.invoke('tax.ledger.link_evidence', {
      workspaceId: demo.workspaceId,
      transactionIds: ['tx_2'],
      documentIds: ['doc_invoice_3'],
      linkMode: 'replace',
    });
    expect(replaceLink.ok).toBe(true);
    expect(runtime.store.transactions.get('tx_2')?.evidenceRefs).toEqual(['doc_invoice_3']);

    const suspiciousLink = runtime.invoke('tax.ledger.link_evidence', {
      workspaceId: demo.workspaceId,
      transactionIds: ['tx_2', 'tx_3'],
      documentIds: ['doc_invoice_3'],
      linkMode: 'append',
    });
    expect(suspiciousLink.ok).toBe(true);
    expect(suspiciousLink.data.reviewItemIds.length).toBeGreaterThan(0);
    expect(suspiciousLink.nextRecommendedAction).toBe('tax.classify.list_review_items');

    const crossWorkspace = runtime.invoke('tax.ledger.link_evidence', {
      workspaceId: demo.workspaceId,
      transactionIds: ['tx_2'],
      documentIds: ['doc_cross_workspace'],
      linkMode: 'append',
    });
    expect(crossWorkspace.ok).toBe(false);
    expect(crossWorkspace.errorCode).toBe('cross_workspace_link_rejected');
  });

  it('persists runtime state to a durable JSON snapshot and reloads it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'korean-tax-runtime-'));
    const snapshotPath = join(dir, 'runtime-snapshot.json');
    const persistence = new JsonFileSnapshotPersistenceAdapter<any>({ path: snapshotPath });

    const runtime = new InMemoryKoreanTaxMCPRuntime({ persistence });
    const init = runtime.invoke('tax.setup.init_config', { filingYear: 2025, storageMode: 'local', taxpayerTypeHint: 'simple_salary_light' });
    const workspaceId = init.data.workspaceId;
    runtime.invoke('tax.ledger.normalize', {
      workspaceId,
      extractedPayloads: [{
        sourceType: 'statement_pdf',
        transactions: [{ externalId: 'salary-1', occurredAt: '2025-03-25', amount: 3500000, normalizedDirection: 'income', counterparty: 'Simple Payroll', description: 'salary payroll march', sourceReference: 'salary-1' }],
        withholdingRecords: [{ externalId: 'wh-1', incomeSourceRef: 'salary-1', payerName: 'Simple Payroll', grossAmount: 3500000, withheldTaxAmount: 105000, localTaxAmount: 10500 }],
      }],
    });
    runtime.invoke('tax.profile.upsert_facts', {
      workspaceId,
      facts: [
        { factKey: 'income_streams', category: 'income_stream', value: ['salary'], status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'taxpayer_posture', category: 'taxpayer_profile', value: 'simple_salary_light', status: 'provided', sourceOfTruth: 'user_asserted' },
        { factKey: 'residency_context', category: 'taxpayer_profile', value: 'domestic_only', status: 'provided', sourceOfTruth: 'user_asserted' },
      ],
    });
    runtime.invoke('tax.classify.run', { workspaceId });
    const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, draftMode: 'new_version', includeAssumptions: true });
    runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId: draft.data.draftId });
    runtime.invoke('tax.filing.compare_with_hometax', { workspaceId, draftId: draft.data.draftId, portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({ sectionKey: field.sectionKey, fieldKey: field.fieldKey, portalObservedValue: field.value })) });
    const started = runtime.invoke('tax.browser.start_hometax_assist', {
      workspaceId,
      draftId: draft.data.draftId,
      mode: 'guide_only',
    });
    expect(started.ok).toBe(true);

    const rawSnapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as { schemaVersion: number; draftsByWorkspace: Record<string, unknown>; assistSessions: unknown[] };
    expect(rawSnapshot.schemaVersion).toBe(1);
    expect(rawSnapshot.draftsByWorkspace[workspaceId]).toBeTruthy();
    expect(rawSnapshot.assistSessions.length).toBeGreaterThan(0);

    const reloaded = new InMemoryKoreanTaxMCPRuntime({ persistence });
    expect(reloaded.getDraft(workspaceId)?.draftId).toBe(runtime.getDraft(workspaceId)?.draftId);
    expect(reloaded.getBrowserAssistSession(workspaceId)?.assistSessionId).toBe(started.data.assistSessionId);
    expect(reloaded.listSyncAttempts().length).toBe(runtime.listSyncAttempts().length);

    const restoredCheckpoint = reloaded.invoke('tax.browser.get_checkpoint', {
      assistSessionId: started.data.assistSessionId,
      workspaceId,
    });
    expect(restoredCheckpoint.ok).toBe(true);
    expect(restoredCheckpoint.data.workspaceId).toBe(workspaceId);
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

    const coverageGapList = runtime.invoke('tax.workspace.list_coverage_gaps', { workspaceId: demo.workspaceId });
    expect(coverageGapList.ok).toBe(true);
    expect(coverageGapList.data.items.length).toBeGreaterThan(0);
    expect(coverageGapList.data.prioritizedGap?.recommendedNextAction).toBeTruthy();
    expect(['browser_assist', 'export_ingestion', 'fact_capture']).toContain(coverageGapList.data.nextActionPlan?.collectionMode);

    const workspaceStatus = runtime.invoke('tax.workspace.get_status', { workspaceId: demo.workspaceId });
    expect(workspaceStatus.data.workspace.openCoverageGapCount).toBeGreaterThan(0);
    expect(workspaceStatus.data.workspace.lastBlockingReason).toBe('comparison_incomplete');
    expect(workspaceStatus.data.workspace.coverageGaps?.length).toBeGreaterThan(0);
    expect(workspaceStatus.data.workspace.nextActionPlan?.recommendedNextAction).toBeTruthy();
    expect(Array.isArray(workspaceStatus.data.stopReasonCodes)).toBe(true);
    expect(typeof workspaceStatus.data.operatorExplanation).toBe('string');
    expect(workspaceStatus.data.nextRecommendedAction).toBeTruthy();

    const derived = runtime.getWorkspaceDerivedStatus(demo.workspaceId);
    expect(derived.openCoverageGapCount).toBe(workspaceStatus.data.workspace.openCoverageGapCount);
    expect(['comparison_incomplete', 'missing_material_coverage']).toContain(derived.lastBlockingReason);
    expect(typeof derived.nextRecommendedAction).toBe('string');
  });
});

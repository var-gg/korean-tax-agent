import rawDemo from './demo-workspace.json';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import type { ConsentRecord, CoverageGap, EvidenceDocument, FilingWorkspace, LedgerTransaction, SourceArtifact, SourceConnection, SyncAttempt } from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  workspace: FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: CoverageGap[];
  sourceArtifacts: SourceArtifact[];
  evidenceDocuments: EvidenceDocument[];
  transactions: LedgerTransaction[];
};

const runtime = new InMemoryKoreanTaxMCPRuntime({
  consentRecords: demo.consentRecords,
  workspaces: [demo.workspace],
  sources: demo.sources,
  syncAttempts: demo.syncAttempts,
  coverageGapsByWorkspace: { [demo.workspaceId]: demo.coverageGaps },
  sourceArtifacts: demo.sourceArtifacts,
  evidenceDocuments: demo.evidenceDocuments,
  transactions: demo.transactions,
});

const result = runtime.invoke('tax.ledger.normalize', {
  workspaceId: demo.workspaceId,
  artifactIds: ['artifact_wht_1'],
  normalizationMode: 'append',
  extractedPayloads: [
    {
      artifactId: 'artifact_wht_1',
      sourceId: 'source_hometax_demo_workspace_2025',
      sourceType: 'hometax',
      provenance: {
        uploadRef: 'upload://artifact_wht_1',
        browserSnapshotRef: 'browser://snapshot/hometax-income-list',
      },
      documents: [
        {
          externalId: 'wht_doc_2025_client_a',
          documentType: 'withholding_doc',
          fileRef: 'upload://withholding/client-a-2025.pdf',
          issuer: 'Client A',
          amount: 450000,
          extractedFields: {
            payerName: 'Client A',
            grossAmount: 450000,
            withheldTaxAmount: 13500,
            localTaxAmount: 1350,
          },
        },
      ],
      withholdingRecords: [
        {
          externalId: 'wht_record_2025_client_a',
          payerName: 'Client A',
          grossAmount: 450000,
          withheldTaxAmount: 13500,
          localTaxAmount: 1350,
          evidenceDocumentRefs: ['wht_doc_2025_client_a'],
        },
      ],
    },
  ],
});

console.log(JSON.stringify({
  example: 'external-agent-artifact-ingestion',
  note: 'The external AI agent did browser/file/OCR work first, then sent artifact refs + structured payloads into MCP.',
  nextRecommendedAction: result.nextRecommendedAction,
  withholdingRecordsCreated: result.data.withholdingRecordsCreated,
  coverageGapsCreated: result.data.coverageGapsCreated,
}, null, 2));

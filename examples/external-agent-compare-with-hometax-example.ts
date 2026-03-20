import rawDemo from './demo-workspace.json';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import type {
  ClassificationDecision,
  ConsentRecord,
  CoverageGap,
  FilingFieldValue,
  FilingWorkspace,
  LedgerTransaction,
  SourceArtifact,
  SourceConnection,
  SyncAttempt,
  TaxpayerFact,
  WithholdingRecord,
} from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  workspace: FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: CoverageGap[];
  sourceArtifacts: SourceArtifact[];
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

const seededTaxpayerFacts: TaxpayerFact[] = [
  {
    factId: `fact_${demo.workspaceId}_taxpayer_type`,
    workspaceId: demo.workspaceId,
    category: 'taxpayer_profile',
    factKey: 'taxpayer_type',
    value: 'mixed_income_individual',
    status: 'provided',
    sourceOfTruth: 'user_asserted',
    confidence: 0.95,
    evidenceRefs: [],
    updatedAt: '2026-03-20T08:00:00Z',
  },
];

const seededWithholdingRecords: WithholdingRecord[] = [
  {
    withholdingRecordId: `withholding_${demo.workspaceId}_1`,
    workspaceId: demo.workspaceId,
    filingYear: demo.workspace.filingYear,
    payerName: 'Demo Platform',
    grossAmount: 3000000,
    withheldTaxAmount: 99000,
    localTaxAmount: 9900,
    currency: 'KRW',
    sourceType: 'hometax',
    sourceOfTruth: 'official',
    extractionConfidence: 0.98,
    evidenceRefs: [],
    capturedAt: '2026-03-20T08:00:00Z',
  },
];

const runtime = new InMemoryKoreanTaxMCPRuntime({
  consentRecords: demo.consentRecords,
  workspaces: [demo.workspace],
  sources: demo.sources,
  syncAttempts: demo.syncAttempts,
  coverageGapsByWorkspace: { [demo.workspaceId]: demo.coverageGaps },
  sourceArtifacts: demo.sourceArtifacts,
  transactions: demo.transactions,
  decisions: demo.decisions,
  taxpayerFacts: seededTaxpayerFacts,
  withholdingRecords: seededWithholdingRecords,
});

const draftResult = runtime.invoke('tax.filing.compute_draft', {
  workspaceId: demo.workspaceId,
  draftMode: 'new_version',
  includeAssumptions: true,
});

const field = (runtime.getDraft(demo.workspaceId)?.fieldValues ?? [])[0] as FilingFieldValue;
const portalObservedValue = typeof field.value === 'number' ? Number(field.value) + 200000 : 'PORTAL_OVERRIDE_VALUE';

const compareResult = runtime.invoke('tax.filing.compare_with_hometax', {
  workspaceId: demo.workspaceId,
  draftId: draftResult.data.draftId,
  comparisonMode: 'visible_portal',
  sectionKeys: [field.sectionKey],
  portalObservedFields: [
    {
      fieldKey: field.fieldKey,
      sectionKey: field.sectionKey,
      portalObservedValue,
    },
  ],
});

console.log(JSON.stringify({
  example: 'external-agent-compare-with-hometax',
  note: 'The external AI agent observed HomeTax values in the browser and passed only the normalized portalObservedFields payload into MCP.',
  nextRecommendedAction: compareResult.nextRecommendedAction,
  materialMismatches: compareResult.data.materialMismatches,
  createdReviewItems: runtime.listReviewItems(demo.workspaceId).filter((item) => item.reasonCode === 'hometax_material_mismatch'),
}, null, 2));

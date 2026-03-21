import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';

type Fixture = {
  scenarioId: string;
  label: string;
  filingYear: number;
  taxpayerTypeHint: string;
  facts: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  documents: Array<Record<string, unknown>>;
  withholdingRecords: Array<Record<string, unknown>>;
};

const fixturePath = process.argv[2] ?? join(process.cwd(), 'examples', 'acceptance-fixtures', 'tier-a-hometax-friendly-simple-path.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as Fixture;
const runtime = new InMemoryKoreanTaxMCPRuntime();

const init = runtime.invoke('tax.setup.init_config', {
  filingYear: fixture.filingYear,
  storageMode: 'local',
  taxpayerTypeHint: fixture.taxpayerTypeHint,
});
const workspaceId = init.data.workspaceId;

runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: fixture.filingYear });
runtime.invoke('tax.import.upload_transactions', {
  workspaceId,
  sourceType: 'statement_pdf',
  refs: [{ ref: `fixture://${fixture.scenarioId}/transactions.csv` }],
});
runtime.invoke('tax.import.upload_documents', {
  workspaceId,
  sourceType: 'evidence_folder',
  refs: fixture.documents.map((document, index) => ({ ref: `fixture://${fixture.scenarioId}/document-${index + 1}.pdf` })),
});
runtime.invoke('tax.ledger.normalize', {
  workspaceId,
  extractedPayloads: [{
    sourceType: 'statement_pdf',
    transactions: fixture.transactions as never[],
    documents: fixture.documents as never[],
    withholdingRecords: fixture.withholdingRecords as never[],
    provenance: { fixture: fixture.scenarioId },
  }],
});
runtime.invoke('tax.profile.upsert_facts', {
  workspaceId,
  facts: fixture.facts as never[],
});
runtime.invoke('tax.profile.detect_filing_path', { workspaceId });
runtime.invoke('tax.classify.run', { workspaceId });
const reviewItems = runtime.invoke('tax.classify.list_review_items', { workspaceId }).data.items;
if (reviewItems.length > 0) {
  runtime.invoke('tax.classify.resolve_review_item', {
    reviewItemIds: reviewItems.map((item) => item.reviewItemId),
    selectedOption: 'keep_draft_value',
    rationale: 'fixture acceptance resolution',
    approverIdentity: 'example:operator',
  });
}
const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId });
runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId: draft.data.draftId });
runtime.invoke('tax.filing.compare_with_hometax', {
  workspaceId,
  draftId: draft.data.draftId,
  portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({
    sectionKey: field.sectionKey,
    fieldKey: field.fieldKey,
    portalObservedValue: field.value,
  })),
});
runtime.invoke('tax.filing.prepare_hometax', { workspaceId, draftId: draft.data.draftId });
runtime.invoke('tax.browser.start_hometax_assist', { workspaceId, draftId: draft.data.draftId });
runtime.invoke('tax.browser.resume_hometax_assist', { workspaceId });
runtime.invoke('tax.filing.record_submission_approval', { workspaceId, draftId: draft.data.draftId, approvedBy: 'example:operator' });
runtime.invoke('tax.browser.record_submission_result', {
  workspaceId,
  draftId: draft.data.draftId,
  result: 'success',
  receiptArtifactRefs: ['artifact_receipt_example'],
  receiptNumber: `receipt-${fixture.scenarioId}`,
});
const exportPackage = runtime.invoke('tax.filing.export_package', {
  workspaceId,
  draftId: draft.data.draftId,
  formats: ['json_package', 'evidence_index', 'submission_prep_checklist', 'submission_receipt_bundle'],
});
const status = runtime.invoke('tax.workspace.get_status', { workspaceId });

console.log(JSON.stringify({
  scenarioId: fixture.scenarioId,
  label: fixture.label,
  finalStatus: status.data.workspace.status,
  remainingBlockers: status.data.stopReasonCodes ?? [],
  exportArtifacts: exportPackage.data.artifacts.map((artifact) => artifact.artifactId),
}, null, 2));

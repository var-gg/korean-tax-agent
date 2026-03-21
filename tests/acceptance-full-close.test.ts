import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';

type FullCloseFixture = {
  scenarioId: string;
  label: string;
  filingYear: number;
  taxpayerTypeHint: string;
  facts: Array<Record<string, unknown>>;
  hometaxMaterials: Array<{ ref: string; materialTypeHint: string }>;
  documents: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  withholdingRecords: Array<Record<string, unknown>>;
  observations?: Array<{ targetArtifactType: string; methodTried: string; artifactShapeSeen?: string; outcome: 'insufficient_artifact' | 'password_required' }>;
  expected: {
    submissionResult: 'success' | 'fail' | 'unknown';
    finalStatus: 'submitted' | 'submission_failed' | 'submission_uncertain';
    maxOperatorQuestions: number;
  };
};

const fixtureDir = join(process.cwd(), 'examples', 'acceptance-fixtures');
const fixturePaths = [
  'full-close-940909-freelancer-two-withholding.json',
  'full-close-resident-register-single-household.json',
  'full-close-recovery-variant.json',
].map((name) => join(fixtureDir, name));

function loadFixture(path: string): FullCloseFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as FullCloseFixture;
}

describe('full-close acceptance suite', () => {
  for (const fixturePath of fixturePaths) {
    const fixture = loadFixture(fixturePath);
    it(`closes the full host handoff workflow for ${fixture.label}`, () => {
      const runtime = new InMemoryKoreanTaxMCPRuntime();
      let operatorQuestions = 0;

      const init = runtime.invoke('tax.setup.init_config', { filingYear: fixture.filingYear, storageMode: 'local', taxpayerTypeHint: fixture.taxpayerTypeHint });
      const workspaceId = init.data.workspaceId;
      const plan = runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: fixture.filingYear });
      expect(plan.data.collectionTasks?.[0]?.targetArtifactType).toBe('withholding_receipt');

      const connect = runtime.invoke('tax.sources.connect', { workspaceId, sourceType: 'hometax', requestedScope: ['read_documents', 'prepare_import'] });
      operatorQuestions += 1; // login/auth

      for (const observation of fixture.observations ?? []) {
        const observed = runtime.invoke('tax.sources.record_collection_observation', { workspaceId, sourceId: connect.data.sourceId, ...observation });
        expect(observed.ok).toBe(true);
      }

      runtime.invoke('tax.import.import_hometax_materials', {
        workspaceId,
        refs: fixture.hometaxMaterials.map((item) => ({ ref: item.ref })),
        materialMetadata: fixture.hometaxMaterials,
      });
      runtime.invoke('tax.import.upload_documents', {
        workspaceId,
        sourceType: 'evidence_folder',
        refs: fixture.documents.map((document, index) => ({ ref: `fixture://${fixture.scenarioId}/document-${index + 1}.pdf`, fileName: `${(document.externalId as string) ?? `doc-${index + 1}`}.pdf` })),
      });
      runtime.invoke('tax.ledger.normalize', {
        workspaceId,
        extractedPayloads: [{ sourceType: 'hometax', transactions: fixture.transactions as never[], documents: fixture.documents as never[], withholdingRecords: fixture.withholdingRecords as never[], provenance: { fixture: fixture.scenarioId } }],
      });

      const missingFacts = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
      if ((missingFacts.data.items?.length ?? 0) > 0) operatorQuestions += 1; // targeted fact
      runtime.invoke('tax.profile.upsert_facts', { workspaceId, facts: fixture.facts as never[] });
      runtime.invoke('tax.profile.detect_filing_path', { workspaceId });

      const classified = runtime.invoke('tax.classify.run', { workspaceId });
      const reviewItems = runtime.invoke('tax.classify.list_review_items', { workspaceId }).data.items;
      if (reviewItems.length > 0) {
        operatorQuestions += 1; // judgment
        runtime.invoke('tax.classify.resolve_review_item', {
          reviewItemIds: reviewItems.map((item) => item.reviewItemId),
          selectedOption: 'keep_draft_value',
          rationale: 'full-close acceptance grouped resolution',
          approverIdentity: 'acceptance:operator',
        });
      }

      const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, includeAssumptions: true });
      const refreshed = runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId: draft.data.draftId, recomputeDraft: true });
      expect(refreshed.ok).toBe(true);
      const compare = runtime.invoke('tax.filing.compare_with_hometax', {
        workspaceId,
        draftId: draft.data.draftId,
        portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({ sectionKey: field.sectionKey, fieldKey: field.fieldKey, portalObservedValue: field.value })),
      });
      expect(compare.ok).toBe(true);
      const statusAfterCompare = runtime.invoke('tax.workspace.get_status', { workspaceId });
      const summaryAfterCompare = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: draft.data.draftId });
      expect(statusAfterCompare.nextRecommendedAction).toBe(summaryAfterCompare.nextRecommendedAction);
      expect(statusAfterCompare.data.stopReasonCodes).toEqual(summaryAfterCompare.data.stopReasonCodes);

      const prepare = runtime.invoke('tax.filing.prepare_hometax', { workspaceId, draftId: draft.data.draftId });
      expect(prepare.ok).toBe(true);
      expect(prepare.readiness?.submissionReadiness).toBe('submission_assist_ready');
      const assist = runtime.invoke('tax.browser.start_hometax_assist', { workspaceId, draftId: draft.data.draftId, mode: 'fill_assist' });
      operatorQuestions += 1; // login/consent boundary for assist
      expect(assist.nextRecommendedAction).toBe('tax.browser.resume_hometax_assist');
      const resume = runtime.invoke('tax.browser.resume_hometax_assist', { workspaceId, assistSessionId: assist.data.assistSessionId });
      expect(resume.ok).toBe(true);

      const approval = runtime.invoke('tax.filing.record_submission_approval', { workspaceId, draftId: draft.data.draftId, approvedBy: 'acceptance:operator' });
      operatorQuestions += 1; // final approval
      expect(approval.nextRecommendedAction).toBe('tax.browser.record_submission_result');
      const result = runtime.invoke('tax.browser.record_submission_result', {
        workspaceId,
        draftId: draft.data.draftId,
        result: fixture.expected.submissionResult,
        portalSummary: `${fixture.scenarioId} ${fixture.expected.submissionResult}`,
        receiptArtifactRefs: [`receipt_${fixture.scenarioId}`],
        receiptNumber: `receipt-${fixture.scenarioId}`,
        submittedAt: '2026-03-22T00:00:00.000Z',
      });
      expect(result.ok).toBe(true);
      const assistSessionAfterResult = runtime.getBrowserAssistSession(workspaceId);
      expect(assistSessionAfterResult?.endedAt).toBeTruthy();
      expect(assistSessionAfterResult?.submissionState).toBe(fixture.expected.finalStatus);

      const exportPackage = runtime.invoke('tax.filing.export_package', {
        workspaceId,
        draftId: draft.data.draftId,
        formats: ['json_package', 'csv_review_report', 'evidence_index', 'submission_prep_checklist', 'submission_receipt_bundle'],
      });
      expect(exportPackage.data.checklistPreview).toEqual(expect.arrayContaining([
        expect.stringContaining('final_approval='),
        expect.stringContaining('receipt_confirmation='),
      ]));
      expect(exportPackage.data.includedFormats).toContain('submission_receipt_bundle');

      const finalStatus = runtime.invoke('tax.workspace.get_status', { workspaceId });
      const finalSummary = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: draft.data.draftId });
      expect(finalStatus.data.workspace.status).toBe(fixture.expected.finalStatus);
      expect(finalSummary.data.submissionResult?.result).toBe(fixture.expected.submissionResult);
      expect(finalStatus.nextRecommendedAction).toBeTruthy();
      expect(finalSummary.nextRecommendedAction).toBeTruthy();
      expect(exportPackage.data.includedFormats).toContain('submission_receipt_bundle');
      expect(operatorQuestions).toBeLessThanOrEqual(fixture.expected.maxOperatorQuestions + 2);
    });
  }
});

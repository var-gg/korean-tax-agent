import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';

type Fixture = {
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
    expectRecoveryFallback?: boolean;
  };
};

const fixtureDir = join(process.cwd(), 'examples', 'acceptance-fixtures');
const fixturePaths = [
  'no-prep-full-close-33-it-freelancer-two-withholding.json',
  'no-prep-full-close-wrong-artifact-recovery.json',
  'no-prep-full-close-resident-register-unknown.json',
].map((name) => join(fixtureDir, name));

function loadFixture(path: string): Fixture {
  return JSON.parse(readFileSync(path, 'utf8')) as Fixture;
}

describe('no-prep full-close acceptance suite', () => {
  for (const fixturePath of fixturePaths) {
    const fixture = loadFixture(fixturePath);
    it(`closes no-prep flow end-to-end for ${fixture.label}`, () => {
      const runtime = new InMemoryKoreanTaxMCPRuntime();
      let operatorQuestions = 0;

      const init = runtime.invoke('tax.setup.init_config', { filingYear: fixture.filingYear, storageMode: 'local', taxpayerTypeHint: fixture.taxpayerTypeHint });
      const workspaceId = init.data.workspaceId;
      const plan = runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: fixture.filingYear });
      expect(plan.data.collectionTasks?.[0]?.targetArtifactType).toBe('withholding_receipt');
      expect(plan.data.collectionTasks?.slice(0, 2).every((task) => task.sourceCategory === 'hometax')).toBe(true);

      const connect = runtime.invoke('tax.sources.connect', { workspaceId, sourceType: 'hometax', requestedScope: ['read_documents', 'prepare_import'] });
      operatorQuestions += 1; // login/auth

      for (const observation of fixture.observations ?? []) {
        const observed = runtime.invoke('tax.sources.record_collection_observation', { workspaceId, sourceId: connect.data.sourceId, ...observation });
        expect(observed.ok).toBe(true);
      }
      if (fixture.expected.expectRecoveryFallback) {
        expect(plan.data.collectionTasks?.[0]?.rejectedArtifactShapes.some((shape) => /xls|summary/i.test(shape))).toBe(true);
      }

      const imported = runtime.invoke('tax.import.import_hometax_materials', {
        workspaceId,
        refs: fixture.hometaxMaterials.map((item) => ({ ref: item.ref })),
        materialMetadata: fixture.hometaxMaterials,
      });
      expect(imported.ok).toBe(true);
      const uploadedDocs = runtime.invoke('tax.import.upload_documents', {
        workspaceId,
        sourceType: 'evidence_folder',
        refs: fixture.documents.map((document, index) => ({ ref: `fixture://${fixture.scenarioId}/document-${index + 1}.pdf`, fileName: `${(document.externalId as string) ?? `doc-${index + 1}`}.pdf` })),
      });
      expect(uploadedDocs.ok).toBe(true);

      const normalized = runtime.invoke('tax.ledger.normalize', {
        workspaceId,
        extractedPayloads: [{ sourceType: 'hometax', transactions: fixture.transactions as never[], documents: fixture.documents as never[], withholdingRecords: fixture.withholdingRecords as never[], provenance: { fixture: fixture.scenarioId } }],
      });
      expect(normalized.ok).toBe(true);

      const detect = runtime.invoke('tax.profile.detect_filing_path', { workspaceId });
      expect(detect.ok).toBe(true);
      const missingFacts = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
      if ((missingFacts.data.items?.length ?? 0) > 0) operatorQuestions += 1;
      const facts = runtime.invoke('tax.profile.upsert_facts', { workspaceId, facts: fixture.facts as never[] });
      expect(facts.ok).toBe(true);

      const classify = runtime.invoke('tax.classify.run', { workspaceId });
      expect(classify.ok).toBe(true);
      const reviewItems = runtime.invoke('tax.classify.list_review_items', { workspaceId }).data.items;
      if (reviewItems.length > 0) {
        operatorQuestions += 1; // judgment
        runtime.invoke('tax.classify.resolve_review_item', {
          reviewItemIds: reviewItems.map((item) => item.reviewItemId),
          selectedOption: 'keep_draft_value',
          rationale: 'no-prep full-close acceptance grouped resolution',
          approverIdentity: 'acceptance:operator',
        });
      }

      const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, includeAssumptions: true });
      const refresh = runtime.invoke('tax.filing.refresh_official_data', { workspaceId, draftId: draft.data.draftId, recomputeDraft: true });
      expect(refresh.ok).toBe(true);
      const compare = runtime.invoke('tax.filing.compare_with_hometax', {
        workspaceId,
        draftId: draft.data.draftId,
        portalObservedFields: (draft.data.draftFieldValues ?? []).map((field) => ({ sectionKey: field.sectionKey, fieldKey: field.fieldKey, portalObservedValue: field.value })),
      });
      expect(compare.ok).toBe(true);
      const statusAfterCompare = runtime.invoke('tax.workspace.get_status', { workspaceId });
      const summaryAfterCompare = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: draft.data.draftId });
      expect(statusAfterCompare.data.stopReasonCodes).toEqual(summaryAfterCompare.data.stopReasonCodes);
      expect(statusAfterCompare.nextRecommendedAction).toBe(summaryAfterCompare.nextRecommendedAction);

      const prepare = runtime.invoke('tax.filing.prepare_hometax', { workspaceId, draftId: draft.data.draftId });
      expect(prepare.ok).toBe(true);
      const assist = runtime.invoke('tax.browser.start_hometax_assist', { workspaceId, draftId: draft.data.draftId, mode: 'fill_assist' });
      expect(assist.nextRecommendedAction).toBe('tax.browser.resume_hometax_assist');
      operatorQuestions += 1; // assist login/auth
      const resume = runtime.invoke('tax.browser.resume_hometax_assist', { workspaceId, assistSessionId: assist.data.assistSessionId });
      expect(resume.ok).toBe(true);

      const approval = runtime.invoke('tax.filing.record_submission_approval', { workspaceId, draftId: draft.data.draftId, approvedBy: 'acceptance:operator' });
      expect(approval.nextRecommendedAction).toBe('tax.browser.record_submission_result');
      operatorQuestions += 1; // final approval

      const result = runtime.invoke('tax.browser.record_submission_result', {
        workspaceId,
        draftId: draft.data.draftId,
        result: fixture.expected.submissionResult,
        portalSummary: `${fixture.scenarioId} ${fixture.expected.submissionResult}`,
        receiptArtifactRefs: [`receipt_${fixture.scenarioId}`],
        receiptNumber: `receipt-${fixture.scenarioId}`,
      });
      expect(result.ok).toBe(true);
      const assistAfter = runtime.getBrowserAssistSession(workspaceId);
      expect(assistAfter?.endedAt).toBeTruthy();

      const exportPackage = runtime.invoke('tax.filing.export_package', {
        workspaceId,
        draftId: draft.data.draftId,
        formats: ['json_package', 'evidence_index', 'submission_prep_checklist', 'submission_receipt_bundle'],
      });
      expect(exportPackage.data.includedFormats).toContain('submission_receipt_bundle');
      expect(exportPackage.data.checklistPreview).toEqual(expect.arrayContaining([
        expect.stringContaining('final_approval='),
        expect.stringContaining('receipt_confirmation='),
      ]));

      const finalStatus = runtime.invoke('tax.workspace.get_status', { workspaceId });
      const finalSummary = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: draft.data.draftId });
      expect(finalStatus.data.workspace.status).toBe(fixture.expected.finalStatus);
      expect(finalSummary.data.submissionResult?.result).toBe(fixture.expected.submissionResult);
      expect(finalStatus.nextRecommendedAction).toBeTruthy();
      expect(finalSummary.nextRecommendedAction).toBeTruthy();
      expect(operatorQuestions).toBeLessThanOrEqual(fixture.expected.maxOperatorQuestions + 2);
    });
  }
});

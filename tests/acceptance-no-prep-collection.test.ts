import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';

type NoPrepFixture = {
  scenarioId: string;
  label: string;
  filingYear: number;
  taxpayerTypeHint: string;
  facts: Array<Record<string, unknown>>;
  hometaxMaterials: Array<{ ref: string; materialTypeHint: string }>;
  documents: Array<Record<string, unknown>>;
  transactions: Array<Record<string, unknown>>;
  withholdingRecords: Array<Record<string, unknown>>;
  wrongObservation?: {
    targetArtifactType: string;
    methodTried: string;
    artifactShapeSeen?: string;
    outcome: 'insufficient_artifact';
  };
  expected: {
    maxOperatorQuestions: number;
    expectPrepareReady: boolean;
    expectConditionalDocRequestOnly: boolean;
    expectRecoveryFallback?: boolean;
  };
};

const fixtureDir = join(process.cwd(), 'examples', 'acceptance-fixtures');
const fixturePaths = [
  'no-prep-freelancer-clear-withholding.json',
  'no-prep-conditional-deduction-docs.json',
  'no-prep-wrong-artifact-then-recovery.json',
].map((name) => join(fixtureDir, name));

function loadFixture(path: string): NoPrepFixture {
  return JSON.parse(readFileSync(path, 'utf8')) as NoPrepFixture;
}

function runScenario(fixture: NoPrepFixture) {
  const runtime = new InMemoryKoreanTaxMCPRuntime();
  let operatorQuestions = 0;

  const init = runtime.invoke('tax.setup.init_config', { filingYear: fixture.filingYear, storageMode: 'local', taxpayerTypeHint: fixture.taxpayerTypeHint });
  const workspaceId = init.data.workspaceId;

  const plan = runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: fixture.filingYear });
  expect(plan.data.collectionTasks?.[0]?.sourceCategory).toBe('hometax');
  expect(plan.data.collectionTasks?.[0]?.blockingIfMissing).toBe(true);

  const connect = runtime.invoke('tax.sources.connect', { workspaceId, sourceType: 'hometax', requestedScope: ['read_documents', 'prepare_import'] });
  operatorQuestions += 1; // login/auth checkpoint budget

  if (fixture.wrongObservation) {
    const observation = runtime.invoke('tax.sources.record_collection_observation', {
      workspaceId,
      sourceId: connect.data.sourceId,
      ...fixture.wrongObservation,
    });
    expect(observation.data.updatedSourceState).toBe('blocked');
    const replanned = runtime.invoke('tax.sources.plan_collection', { workspaceId, filingYear: fixture.filingYear });
    expect(replanned.nextRecommendedAction).toBe('tax.import.import_hometax_materials');
    expect(replanned.data.collectionTasks?.[0]?.collectionMode).toBe('export_ingestion');
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
    refs: fixture.documents.map((document, index) => ({ ref: `fixture://${fixture.scenarioId}/doc-${index + 1}.pdf`, fileName: `${(document.externalId as string) ?? `doc-${index + 1}`}.pdf` })),
  });
  expect(uploadedDocs.ok).toBe(true);

  const normalized = runtime.invoke('tax.ledger.normalize', {
    workspaceId,
    extractedPayloads: [{
      sourceType: 'hometax',
      transactions: fixture.transactions as never[],
      documents: fixture.documents as never[],
      withholdingRecords: fixture.withholdingRecords as never[],
      provenance: { fixture: fixture.scenarioId },
    }],
  });
  expect(normalized.ok).toBe(true);

  const coverageGaps = runtime.invoke('tax.workspace.list_coverage_gaps', { workspaceId });
  const missingFacts = runtime.invoke('tax.profile.list_missing_facts', { workspaceId });
  if ((missingFacts.data.items?.length ?? 0) > 0) operatorQuestions += 1;

  const conditionalTask = coverageGaps.data.collectionTasks?.find((task) => task.targetArtifactType === 'conditional_deduction_support');
  if (fixture.expected.expectConditionalDocRequestOnly) {
    expect(conditionalTask?.whyThisSourceNow).toContain('Conditional');
    expect(conditionalTask?.blockingIfMissing).toBe(false);
  }

  const facts = runtime.invoke('tax.profile.upsert_facts', { workspaceId, facts: fixture.facts as never[] });
  expect(facts.ok).toBe(true);

  const draft = runtime.invoke('tax.filing.compute_draft', { workspaceId, includeAssumptions: true });
  const status = runtime.invoke('tax.workspace.get_status', { workspaceId });
  const summary = runtime.invoke('tax.filing.get_summary', { workspaceId, draftId: draft.data.draftId });
  const prepare = runtime.invoke('tax.filing.prepare_hometax', { workspaceId, draftId: draft.data.draftId });

  return { plan, coverageGaps, missingFacts, draft, prepare, status, summary, operatorQuestions };
}

describe('no-prep collection acceptance suite', () => {
  for (const fixturePath of fixturePaths) {
    const fixture = loadFixture(fixturePath);
    it(`orchestrates no-prep collection for ${fixture.label}`, () => {
      const result = runScenario(fixture);
      expect(result.operatorQuestions).toBeLessThanOrEqual(fixture.expected.maxOperatorQuestions);
      expect(result.plan.data.collectionTasks?.slice(0, 2).every((task) => task.sourceCategory === 'hometax')).toBe(true);
      expect(result.plan.data.collectionTasks?.[0]?.targetArtifactType).toBe('withholding_receipt');
      expect(result.status.nextRecommendedAction).toBe(result.summary.nextRecommendedAction);
      expect(result.status.data.stopReasonCodes).toEqual(result.summary.data.stopReasonCodes);

      if (fixture.expected.expectPrepareReady) {
        expect(result.prepare.ok).toBe(true);
        expect(result.prepare.readiness?.submissionReadiness).toBe('submission_assist_ready');
      } else {
        expect(result.prepare.ok).toBe(false);
        expect(result.prepare.blockingReason).toBe('comparison_incomplete');
        expect(result.status.data.stopReasonCodes).toContain('comparison_incomplete');
        expect(result.summary.data.stopReasonCodes).toContain('comparison_incomplete');
      }

      if (fixture.expected.expectRecoveryFallback) {
        expect(result.plan.data.collectionTasks?.[0]?.rejectedArtifactShapes.some((shape) => shape.includes('XLS'))).toBe(true);
      }

      if (fixture.expected.expectConditionalDocRequestOnly) {
        expect(result.coverageGaps.data.collectionTasks?.find((task) => task.targetArtifactType === 'conditional_deduction_support')).toBeTruthy();
      }
    });
  }
});

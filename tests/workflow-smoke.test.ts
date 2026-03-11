import { describe, expect, it } from 'vitest';
import rawDemo from '../examples/demo-workspace.json';
import {
  taxBrowserStartHomeTaxAssist,
  taxClassifyResolveReviewItem,
  taxClassifyRun,
  taxFilingComputeDraft,
  taxFilingPrepareHomeTax,
  taxSourcesConnect,
  taxSourcesResumeSync,
  taxSourcesSync,
} from '../packages/mcp-server/src/tools.js';
import type {
  ClassificationDecision,
  ConsentRecord,
  FilingWorkspace,
  LedgerTransaction,
  ReviewItem,
  SourceConnection,
  SyncAttempt,
} from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  filingYear: number;
  workspace: FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

describe('workflow smoke', () => {
  it('runs the checkpoint-driven collection to hometax-assist path', () => {
    const connectResult = taxSourcesConnect(
      {
        workspaceId: demo.workspaceId,
        sourceType: 'hometax',
        requestedScope: ['read_documents', 'prepare_import'],
      },
      demo.consentRecords,
    );

    expect(connectResult.status).toBe('awaiting_auth');
    expect(connectResult.checkpointType).toBe('authentication');
    expect(connectResult.data.sourceState).toBe('awaiting_auth');

    const syncResult = taxSourcesSync({
      sourceId: connectResult.data.sourceId,
      syncMode: 'full',
    });

    expect(syncResult.status).toBe('awaiting_user_action');
    expect(syncResult.checkpointType).toBe('collection_blocker');
    expect(syncResult.blockingReason).toBe('export_required');
    expect(syncResult.data.syncAttemptState).toBe('blocked');
    expect(syncResult.resumeToken).toBeTruthy();

    const resumeResult = taxSourcesResumeSync({
      sourceId: connectResult.data.sourceId,
      checkpointId: syncResult.checkpointId,
      resumeToken: syncResult.resumeToken,
    });

    expect(resumeResult.status).toBe('completed');
    expect(resumeResult.data.syncAttemptState).toBe('completed');
    expect(resumeResult.data.importedArtifactCount).toBeGreaterThan(0);

    const classifyResult = taxClassifyRun(
      {
        workspaceId: demo.workspaceId,
        rulesetVersion: 'test-v1',
      },
      demo.transactions,
    );

    const reviewItems: ReviewItem[] = classifyResult.data.reviewItems ?? [];
    const decisions: ClassificationDecision[] = classifyResult.data.decisions ?? [];

    expect(reviewItems.length).toBeGreaterThan(0);

    const initialDraftResult = taxFilingComputeDraft(
      {
        workspaceId: demo.workspaceId,
        draftMode: 'refresh',
        includeAssumptions: true,
      },
      demo.transactions,
      decisions,
      reviewItems,
    );

    expect(initialDraftResult.status).toBe('blocked');
    expect(initialDraftResult.checkpointType).toBe('review_judgment');
    expect(initialDraftResult.blockingReason).toBe('awaiting_review_decision');

    const resolutionResult = taxClassifyResolveReviewItem(
      {
        reviewItemIds: reviewItems.map((item) => item.reviewItemId),
        selectedOption: 'exclude_from_expense',
        rationale: 'test resolution',
        approverIdentity: 'test_user',
      },
      reviewItems,
      decisions,
    );

    const resolvedItems = resolutionResult.data.updatedItems;
    const effectiveDecisions = [...decisions, ...resolutionResult.data.generatedDecisions];

    const resolvedDraftResult = taxFilingComputeDraft(
      {
        workspaceId: demo.workspaceId,
        draftMode: 'new_version',
        includeAssumptions: true,
      },
      demo.transactions,
      effectiveDecisions,
      resolvedItems,
    );

    expect(resolvedDraftResult.status).toBe('completed');

    const prepareResult = taxFilingPrepareHomeTax(
      {
        workspaceId: demo.workspaceId,
        draftId: resolvedDraftResult.data.draftId,
      },
      resolvedItems,
    );

    expect(prepareResult.status).toBe('completed');
    expect(prepareResult.data.browserAssistReady).toBe(true);

    const assistResult = taxBrowserStartHomeTaxAssist({
      workspaceId: demo.workspaceId,
      draftId: resolvedDraftResult.data.draftId,
      mode: 'guide_only',
    });

    expect(assistResult.status).toBe('awaiting_auth');
    expect(assistResult.checkpointType).toBe('authentication');
    expect(assistResult.data.checkpointType).toBe('authentication');
  });
});

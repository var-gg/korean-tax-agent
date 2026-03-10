import { buildConsentPrompt, evaluateConsent, type ConsentRequirement } from '../../core/src/consent.js';
import { computeDraftFromLedger, evaluateDraftReadiness } from '../../core/src/draft.js';
import { classifyTransactions } from '../../core/src/classify.js';
import { buildReviewQueue, resolveReviewItems, summarizeReviewQueue } from '../../core/src/review.js';
import type { ClassificationDecision, ConsentRecord, LedgerTransaction, ReviewItem, SourceConnection } from '../../core/src/types.js';
import type {
  CollectionStatusData,
  ComputeDraftInput,
  ConnectSourceInput,
  GetCollectionStatusInput,
  MCPResponseEnvelope,
  PlanCollectionInput,
  PrepareHomeTaxInput,
  ResolveReviewItemInput,
  ResumeSyncInput,
  RunClassificationInput,
  StartHomeTaxAssistInput,
  SyncSourceInput,
} from './contracts.js';

export function taxSourcesPlanCollection(input: PlanCollectionInput): MCPResponseEnvelope<{
  recommendedSources: Array<{
    sourceType: string;
    priority: 'high' | 'medium' | 'low';
    rationale: string;
    collectionMode: 'direct_connector' | 'browser_assist' | 'export_ingestion' | 'fact_capture';
    likelyCheckpoints: string[];
    fallbackOptions: string[];
  }>;
  expectedValueBySource: Record<string, string>;
  likelyUserCheckpoints: string[];
  fallbackPathSuggestions: string[];
}> {
  return {
    ok: true,
    status: 'completed',
    data: {
      recommendedSources: [
        {
          sourceType: 'hometax',
          priority: 'high',
          rationale: 'Highest-value authoritative filing source and best first checkpoint.',
          collectionMode: 'browser_assist',
          likelyCheckpoints: ['source_access_consent', 'login', 'possible_download_confirmation'],
          fallbackOptions: ['Import HomeTax-exported files manually', 'Proceed with local evidence and draft a partial workspace'],
        },
        {
          sourceType: 'local_documents',
          priority: 'medium',
          rationale: 'Useful for receipts, statements, and evidence gaps after HomeTax collection.',
          collectionMode: 'export_ingestion',
          likelyCheckpoints: ['folder_access_approval'],
          fallbackOptions: ['Upload a targeted set of files', 'Answer focused evidence questions'],
        },
      ],
      expectedValueBySource: {
        hometax: 'High authority for filing materials and cross-checks',
        local_documents: 'High practical value for supporting evidence and missing exports',
      },
      likelyUserCheckpoints: ['consent', 'authentication', 'download confirmation'],
      fallbackPathSuggestions: ['Use exported statements when live collection is blocked', 'Continue with partial collection and targeted follow-up'],
    },
    progress: {
      phase: 'source_planning',
      step: 'rank_next_sources',
      percent: 100,
    },
    nextRecommendedAction: 'tax.sources.connect',
    audit: {
      eventType: 'source_planned',
      eventId: `evt_plan_${input.workspaceId}_${input.filingYear}`,
    },
  };
}

export function taxSourcesGetCollectionStatus(
  _input: GetCollectionStatusInput,
  sources: SourceConnection[] = [],
  coverageGaps: string[] = [],
): MCPResponseEnvelope<CollectionStatusData> {
  const connectedSources = sources.map((source) => ({
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    state: source.state ?? source.connectionStatus ?? 'planned',
  }));

  const pendingCheckpoints = sources
    .filter((source) => (source.state ?? source.connectionStatus) === 'awaiting_auth' || (source.state ?? source.connectionStatus) === 'awaiting_consent')
    .map((source) => `${source.sourceType}:${source.state ?? source.connectionStatus}`);

  const blockedAttempts = sources
    .filter((source) => (source.state ?? source.connectionStatus) === 'blocked')
    .map((source) => `${source.sourceType}:${source.lastBlockingReason ?? 'blocked'}`);

  return {
    ok: true,
    status: 'completed',
    data: {
      connectedSources,
      pendingCheckpoints,
      coverageGaps,
      blockedAttempts,
    },
    nextRecommendedAction: pendingCheckpoints.length > 0 ? 'Resolve pending checkpoint and resume collection' : 'tax.sources.plan_collection',
  };
}

export function taxSourcesConnect(
  input: ConnectSourceInput,
  consentRecords: ConsentRecord[],
): MCPResponseEnvelope<{
  sourceId: string;
  connectionState: string;
  consentRequired: boolean;
  authRequired: boolean;
  nextStep?: string;
  checkpointId?: string;
  fallbackOptions?: string[];
}> {
  const requirement: ConsentRequirement = {
    consentType: 'source_access',
    sourceType: input.sourceType,
    requiredActions: input.requestedScope,
  };

  const evaluation = evaluateConsent(consentRecords, requirement);
  if (!evaluation.allowed) {
    return {
      ok: false,
      status: 'awaiting_consent',
      data: {
        sourceId: `pending_${input.sourceType}`,
        connectionState: 'awaiting_consent',
        consentRequired: true,
        authRequired: false,
        nextStep: buildConsentPrompt(requirement),
        checkpointId: `checkpoint_consent_${input.sourceType}_${input.workspaceId}`,
        fallbackOptions: ['Narrow the requested scope', 'Use manual upload/export ingestion instead'],
      },
      requiresConsent: true,
      blockingReason: 'missing_consent',
      checkpointId: `checkpoint_consent_${input.sourceType}_${input.workspaceId}`,
      pendingUserAction: buildConsentPrompt(requirement),
      fallbackOptions: ['Narrow the requested scope', 'Use manual upload/export ingestion instead'],
      warnings: [
        {
          code: evaluation.reason ?? 'missing_consent',
          message: buildConsentPrompt(requirement),
          severity: 'high',
        },
      ],
    };
  }

  const authRequired = input.sourceType === 'hometax';
  const sourceId = `source_${input.sourceType}_${input.workspaceId}`;

  return {
    ok: true,
    status: authRequired ? 'awaiting_auth' : 'completed',
    data: {
      sourceId,
      connectionState: authRequired ? 'awaiting_auth' : 'connected',
      consentRequired: false,
      authRequired,
      nextStep: authRequired ? 'Proceed to authentication checkpoint' : 'Ready to sync',
      checkpointId: authRequired ? `checkpoint_auth_${input.sourceType}_${input.workspaceId}` : undefined,
      fallbackOptions: authRequired ? ['Import exported files instead', 'Collect local evidence first and return later'] : [],
    },
    requiresAuth: authRequired,
    checkpointId: authRequired ? `checkpoint_auth_${input.sourceType}_${input.workspaceId}` : undefined,
    pendingUserAction: authRequired ? 'Complete provider authentication to continue collection' : undefined,
    fallbackOptions: authRequired ? ['Import exported files instead', 'Collect local evidence first and return later'] : [],
    progress: {
      phase: 'source_connection',
      step: authRequired ? 'await_authentication' : 'source_connected',
      percent: authRequired ? 50 : 100,
    },
    nextRecommendedAction: authRequired ? 'tax.sources.resume_sync' : 'tax.sources.sync',
    audit: {
      eventType: 'source_connected',
      eventId: `evt_connect_${input.workspaceId}_${input.sourceType}`,
    },
  };
}

export function taxSourcesSync(input: SyncSourceInput): MCPResponseEnvelope<{
  importedArtifactCount: number;
  changedItemCount: number;
  progressState?: { phase: string; step: string; percent: number };
  checkpointId?: string;
  fallbackOptions?: string[];
}> {
  const authCheckpointId = `checkpoint_auth_${input.sourceId}`;
  return {
    ok: false,
    status: 'awaiting_user_action',
    data: {
      importedArtifactCount: 0,
      changedItemCount: 0,
      progressState: {
        phase: 'source_sync',
        step: 'await_export_or_auth_completion',
        percent: 25,
      },
      checkpointId: authCheckpointId,
      fallbackOptions: ['Resume after login/export confirmation', 'Switch to export-ingestion flow'],
    },
    blockingReason: 'user_action_required',
    checkpointId: authCheckpointId,
    pendingUserAction: 'Complete the provider step required for sync and then resume.',
    resumeToken: `resume_${input.sourceId}_${input.syncMode}`,
    fallbackOptions: ['Resume after login/export confirmation', 'Switch to export-ingestion flow'],
    progress: {
      phase: 'source_sync',
      step: 'await_export_or_auth_completion',
      percent: 25,
    },
    nextRecommendedAction: 'tax.sources.resume_sync',
    audit: {
      eventType: 'sync_started',
      eventId: `evt_sync_${input.sourceId}_${input.syncMode}`,
    },
  };
}

export function taxSourcesResumeSync(input: ResumeSyncInput): MCPResponseEnvelope<{
  resumed: boolean;
  sourceId?: string;
  syncSessionId: string;
  importedArtifactCount: number;
  nextCheckpointId?: string;
}> {
  const syncSessionId = input.syncSessionId ?? `sync_${input.sourceId ?? 'unknown'}`;
  return {
    ok: true,
    status: 'completed',
    data: {
      resumed: true,
      sourceId: input.sourceId,
      syncSessionId,
      importedArtifactCount: 3,
      nextCheckpointId: undefined,
    },
    progress: {
      phase: 'source_sync',
      step: 'resume_and_finalize',
      percent: 100,
    },
    nextRecommendedAction: 'tax.ledger.normalize',
    audit: {
      eventType: 'import_completed',
      eventId: `evt_resume_${syncSessionId}`,
    },
  };
}

export function taxClassifyRun(
  input: RunClassificationInput,
  transactions: LedgerTransaction[],
): MCPResponseEnvelope<{
  classifiedCount: number;
  lowConfidenceCount: number;
  generatedReviewItemCount: number;
  summaryByCategory: Record<string, number>;
  decisions: ClassificationDecision[];
  reviewItems: ReviewItem[];
}> {
  const scopedTransactions = transactions.filter((tx) => tx.workspaceId === input.workspaceId);
  const classification = classifyTransactions({
    workspaceId: input.workspaceId,
    transactions: scopedTransactions,
  });
  const reviewQueue = buildReviewQueue({
    workspaceId: input.workspaceId,
    transactions: scopedTransactions,
    decisions: classification.decisions,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      classifiedCount: classification.decisions.length,
      lowConfidenceCount: classification.lowConfidenceCount,
      generatedReviewItemCount: reviewQueue.items.length,
      summaryByCategory: classification.summaryByCategory,
      decisions: classification.decisions,
      reviewItems: reviewQueue.items,
    },
    progress: {
      phase: 'classification',
      step: 'apply_rules',
      percent: 100,
    },
    nextRecommendedAction: reviewQueue.items.length > 0 ? 'tax.classify.list_review_items' : 'tax.filing.compute_draft',
    audit: {
      eventType: 'classification_run',
      eventId: `evt_classify_${Date.now()}`,
    },
  };
}

export function taxClassifyListReviewItems(workspaceId: string, items: ReviewItem[]): MCPResponseEnvelope<{ items: ReviewItem[]; summary: ReturnType<typeof summarizeReviewQueue> }> {
  const filteredItems = items.filter((item) => item.workspaceId === workspaceId);
  return {
    ok: true,
    status: 'completed',
    data: {
      items: filteredItems,
      summary: summarizeReviewQueue(filteredItems),
    },
  };
}

export function taxClassifyResolveReviewItem(
  input: ResolveReviewItemInput,
  items: ReviewItem[],
  existingDecisions: ClassificationDecision[] = [],
): MCPResponseEnvelope<{ resolvedCount: number; affectedDraftIds?: string[]; updatedItems: ReviewItem[]; generatedDecisionIds: string[]; generatedDecisions: ClassificationDecision[] }> {
  const resolution = resolveReviewItems({
    items,
    reviewItemIds: input.reviewItemIds,
    selectedOption: input.selectedOption,
    rationale: input.rationale,
    approverIdentity: input.approverIdentity,
    existingDecisions,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      resolvedCount: resolution.resolvedItems.length,
      affectedDraftIds: [],
      updatedItems: resolution.updatedItems,
      generatedDecisionIds: resolution.generatedDecisions.map((decision) => decision.decisionId),
      generatedDecisions: resolution.generatedDecisions,
    },
    audit: {
      eventType: 'review_resolved',
      eventId: `evt_review_${Date.now()}`,
    },
  };
}

export function taxFilingComputeDraft(
  input: ComputeDraftInput,
  transactions: LedgerTransaction[],
  decisions: ClassificationDecision[],
  reviewItems: ReviewItem[],
): MCPResponseEnvelope<{
  draftId: string;
  unresolvedBlockerCount: number;
  warnings: string[];
  incomeSummary: Record<string, unknown>;
  expenseSummary: Record<string, unknown>;
  deductionsSummary: Record<string, unknown>;
  withholdingSummary: Record<string, unknown>;
}> {
  const readiness = evaluateDraftReadiness(reviewItems);
  const filingYear = input.workspaceId.match(/(20\d{2})/)?.[1];
  const scopedTransactions = transactions.filter((tx) => tx.workspaceId === input.workspaceId);
  const scopedDecisions = decisions.filter((decision) => scopedTransactions.some((tx) => tx.transactionId === decision.entityId));
  const draft = computeDraftFromLedger({
    workspaceId: input.workspaceId,
    filingYear: filingYear ? Number(filingYear) : new Date().getFullYear(),
    draftVersion: input.draftMode === 'new_version' ? 2 : 1,
    transactions: scopedTransactions,
    decisions: scopedDecisions,
    reviewItems,
    assumptions: input.includeAssumptions ? ['Initial draft assumptions placeholder'] : [],
  });

  return {
    ok: true,
    status: readiness.readyForSubmission ? 'completed' : 'blocked',
    data: {
      draftId: draft.draftId,
      unresolvedBlockerCount: readiness.blockerReasons.length,
      warnings: draft.warnings,
      incomeSummary: draft.incomeSummary,
      expenseSummary: draft.expenseSummary,
      deductionsSummary: draft.deductionsSummary,
      withholdingSummary: draft.withholdingSummary,
    },
    blockingReason: readiness.readyForSubmission ? undefined : 'unresolved_high_risk_review',
    progress: {
      phase: 'drafting',
      step: 'compute_from_ledger',
      percent: 100,
    },
    audit: {
      eventType: 'draft_computed',
      eventId: `evt_draft_${Date.now()}`,
    },
  };
}

export function taxFilingPrepareHomeTax(input: PrepareHomeTaxInput, reviewItems: ReviewItem[]): MCPResponseEnvelope<{
  sectionMapping: Record<string, unknown>;
  requiredManualFields: string[];
  blockedFields: string[];
  browserAssistReady: boolean;
}> {
  const readiness = evaluateDraftReadiness(reviewItems);
  return {
    ok: readiness.readyForSubmission,
    status: readiness.readyForSubmission ? 'completed' : 'blocked',
    data: {
      sectionMapping: {
        income: 'mapped_placeholder',
        expenses: 'mapped_placeholder',
      },
      requiredManualFields: [],
      blockedFields: readiness.blockerReasons,
      browserAssistReady: readiness.readyForSubmission,
    },
    blockingReason: readiness.readyForSubmission ? undefined : 'unresolved_high_risk_review',
    nextRecommendedAction: readiness.readyForSubmission ? 'tax.browser.start_hometax_assist' : 'tax.classify.list_review_items',
    audit: {
      eventType: 'draft_computed',
      eventId: `evt_prepare_${input.draftId}`,
    },
  };
}

export function taxBrowserStartHomeTaxAssist(input: StartHomeTaxAssistInput): MCPResponseEnvelope<{
  assistSessionId: string;
  checkpoint: string;
  authRequired: boolean;
}> {
  return {
    ok: true,
    status: 'awaiting_auth',
    data: {
      assistSessionId: `assist_${input.workspaceId}_${input.draftId}`,
      checkpoint: 'auth_checkpoint',
      authRequired: true,
    },
    requiresAuth: true,
    checkpointId: `checkpoint_hometax_auth_${input.workspaceId}_${input.draftId}`,
    pendingUserAction: 'Complete HomeTax authentication and then resume browser assist.',
    nextRecommendedAction: 'tax.sources.resume_sync',
    audit: {
      eventType: 'browser_assist_started',
      eventId: `evt_browser_${Date.now()}`,
    },
  };
}

export function demoBuildReviewQueue() {
  return buildReviewQueue({
    workspaceId: 'demo_workspace',
    transactions: [],
    decisions: [],
  });
}

import { buildConsentPrompt, evaluateConsent, type ConsentRequirement } from '../../core/src/consent.js';
import { computeDraftFromLedger, evaluateDraftReadiness } from '../../core/src/draft.js';
import { classifyTransactions } from '../../core/src/classify.js';
import { buildReviewQueue, resolveReviewItems, summarizeReviewQueue } from '../../core/src/review.js';
import {
  blockSyncAttempt,
  completeSyncAttempt,
  createAuditEvent,
  createSourceConnection,
  deriveCheckpointTypeFromSourceState,
  derivePendingUserAction,
  transitionSourceState,
} from '../../core/src/state.js';
import type { ClassificationDecision, ConsentRecord, LedgerTransaction, ReviewItem, SourceConnection } from '../../core/src/types.js';
import type {
  CollectionStatusData,
  ComputeDraftInput,
  ConnectSourceData,
  ConnectSourceInput,
  GetCollectionStatusInput,
  MCPResponseEnvelope,
  PlanCollectionInput,
  PrepareHomeTaxInput,
  ResolveReviewItemInput,
  ResumeSyncData,
  ResumeSyncInput,
  RunClassificationInput,
  StartHomeTaxAssistData,
  StartHomeTaxAssistInput,
  SyncSourceData,
  SyncSourceInput,
} from './contracts.js';

export function taxSourcesPlanCollection(input: PlanCollectionInput): MCPResponseEnvelope<{
  recommendedSources: Array<{
    sourceType: string;
    priority: 'high' | 'medium' | 'low';
    rationale: string;
    collectionMode: 'direct_connector' | 'browser_assist' | 'export_ingestion' | 'fact_capture';
    likelyCheckpoints: Array<'source_consent' | 'authentication' | 'collection_blocker' | 'review_judgment' | 'final_submission'>;
    fallbackOptions: string[];
  }>;
  expectedValueBySource: Record<string, string>;
  likelyUserCheckpoints: Array<'source_consent' | 'authentication' | 'collection_blocker' | 'review_judgment' | 'final_submission'>;
  fallbackPathSuggestions: string[];
}> {
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'source_planned',
    actorType: 'agent',
    summary: 'Planned recommended collection sources for the workspace.',
  });

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
          likelyCheckpoints: ['source_consent', 'authentication', 'collection_blocker'],
          fallbackOptions: ['Import HomeTax-exported files manually', 'Proceed with local evidence and draft a partial workspace'],
        },
        {
          sourceType: 'local_documents',
          priority: 'medium',
          rationale: 'Useful for receipts, statements, and evidence gaps after HomeTax collection.',
          collectionMode: 'export_ingestion',
          likelyCheckpoints: ['source_consent'],
          fallbackOptions: ['Upload a targeted set of files', 'Answer focused evidence questions'],
        },
      ],
      expectedValueBySource: {
        hometax: 'High authority for filing materials and cross-checks',
        local_documents: 'High practical value for supporting evidence and missing exports',
      },
      likelyUserCheckpoints: ['source_consent', 'authentication', 'collection_blocker'],
      fallbackPathSuggestions: ['Use exported statements when live collection is blocked', 'Continue with partial collection and targeted follow-up'],
    },
    progress: {
      phase: 'source_planning',
      step: 'rank_next_sources',
      percent: 100,
    },
    nextRecommendedAction: 'tax.sources.connect',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_source_planned',
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
    .flatMap((source) => {
      const checkpointType = deriveCheckpointTypeFromSourceState(source.state ?? source.connectionStatus);
      return checkpointType === 'source_consent' || checkpointType === 'authentication' ? [checkpointType] : [];
    });

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
): MCPResponseEnvelope<ConnectSourceData> {
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
        sourceState: 'awaiting_consent',
        consentRequired: true,
        authRequired: false,
        checkpointType: 'source_consent',
        nextStep: buildConsentPrompt(requirement),
        checkpointId: `checkpoint_consent_${input.sourceType}_${input.workspaceId}`,
        fallbackOptions: ['Narrow the requested scope', 'Use manual upload/export ingestion instead'],
      },
      requiresConsent: true,
      checkpointType: 'source_consent',
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

  const baseSource = createSourceConnection({
    workspaceId: input.workspaceId,
    sourceType: input.sourceType as SourceConnection['sourceType'],
    collectionMode: input.sourceType === 'hometax' ? 'browser_assist' : 'export_ingestion',
    requestedScope: input.requestedScope,
  });

  const authRequired = input.sourceType === 'hometax';
  const nextSource = transitionSourceState(baseSource, authRequired ? 'awaiting_auth' : 'ready');
  const sourceCheckpointType = deriveCheckpointTypeFromSourceState(nextSource.state);
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'source_connected',
    actorType: 'agent',
    entityRefs: [nextSource.sourceId],
    summary: `Source ${input.sourceType} moved to ${nextSource.state}.`,
  });

  return {
    ok: true,
    status: authRequired ? 'awaiting_auth' : 'completed',
    data: {
      sourceId: nextSource.sourceId,
      sourceState: authRequired ? 'awaiting_auth' : 'ready',
      consentRequired: false,
      authRequired,
      checkpointType: sourceCheckpointType,
      nextStep: authRequired ? 'Proceed to authentication checkpoint' : 'Ready to sync',
      checkpointId: authRequired ? `checkpoint_auth_${input.sourceType}_${input.workspaceId}` : undefined,
      fallbackOptions: authRequired ? ['Import exported files instead', 'Collect local evidence first and return later'] : [],
    },
    requiresAuth: authRequired,
    checkpointType: sourceCheckpointType,
    checkpointId: authRequired ? `checkpoint_auth_${input.sourceType}_${input.workspaceId}` : undefined,
    pendingUserAction: authRequired
      ? derivePendingUserAction({ checkpointType: sourceCheckpointType, sourceType: input.sourceType })
      : undefined,
    fallbackOptions: authRequired ? ['Import exported files instead', 'Collect local evidence first and return later'] : [],
    progress: {
      phase: 'source_connection',
      step: authRequired ? 'await_authentication' : 'source_connected',
      percent: authRequired ? 50 : 100,
    },
    nextRecommendedAction: authRequired ? 'tax.sources.resume_sync' : 'tax.sources.sync',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_source_connected',
    },
  };
}

export function taxSourcesSync(input: SyncSourceInput): MCPResponseEnvelope<SyncSourceData> {
  const authCheckpointId = `checkpoint_auth_${input.sourceId}`;
  const initialAttempt = {
    syncAttemptId: `sync_${input.sourceId}_${input.syncMode}`,
    workspaceId: extractWorkspaceIdFromSourceId(input.sourceId),
    sourceId: input.sourceId,
    mode: input.syncMode,
    state: 'awaiting_user_action' as const,
    startedAt: new Date().toISOString(),
    checkpointId: authCheckpointId,
  };
  const blockedAttempt = blockSyncAttempt({
    attempt: initialAttempt,
    blockingReason: 'export_required',
    checkpointType: 'collection_blocker',
    checkpointId: authCheckpointId,
    pendingUserAction: derivePendingUserAction({ blockingReason: 'export_required', checkpointType: 'collection_blocker' }),
    fallbackOptions: ['Resume after login/export confirmation', 'Switch to export-ingestion flow'],
  });
  const audit = createAuditEvent({
    workspaceId: blockedAttempt.workspaceId,
    eventType: 'sync_blocked',
    actorType: 'agent',
    entityRefs: [blockedAttempt.syncAttemptId, blockedAttempt.sourceId],
    summary: 'Sync is waiting for user action before continuing.',
    metadata: {
      blockingReason: blockedAttempt.blockingReason,
      fallbackOptions: blockedAttempt.fallbackOptions,
    },
  });

  return {
    ok: false,
    status: 'awaiting_user_action',
    data: {
      sourceState: 'syncing',
      syncAttemptState: 'blocked',
      importedArtifactCount: 0,
      changedItemCount: 0,
      progressState: {
        phase: 'source_sync',
        step: 'await_export_or_auth_completion',
        percent: 25,
      },
      checkpointId: blockedAttempt.checkpointId,
      fallbackOptions: blockedAttempt.fallbackOptions,
    },
    checkpointType: blockedAttempt.checkpointType,
    blockingReason: blockedAttempt.blockingReason,
    checkpointId: blockedAttempt.checkpointId,
    pendingUserAction: blockedAttempt.pendingUserAction,
    resumeToken: `resume_${input.sourceId}_${input.syncMode}`,
    fallbackOptions: blockedAttempt.fallbackOptions,
    progress: {
      phase: 'source_sync',
      step: 'await_export_or_auth_completion',
      percent: 25,
    },
    nextRecommendedAction: 'tax.sources.resume_sync',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_sync_blocked',
    },
  };
}

export function taxSourcesResumeSync(input: ResumeSyncInput): MCPResponseEnvelope<ResumeSyncData> {
  const sourceId = input.sourceId;
  const workspaceId = extractWorkspaceIdFromSourceId(sourceId);
  const syncSessionId = input.syncSessionId ?? `sync_${sourceId ?? 'unknown'}`;
  const completedAttempt = completeSyncAttempt({
    attempt: {
      syncAttemptId: syncSessionId,
      workspaceId,
      sourceId: sourceId ?? 'unknown_source',
      mode: 'full',
      state: 'running',
      startedAt: new Date().toISOString(),
      checkpointId: input.checkpointId,
    },
    attemptSummary: 'Imported 3 artifacts after resuming the sync flow.',
  });
  const audit = createAuditEvent({
    workspaceId,
    eventType: 'import_completed',
    actorType: 'agent',
    entityRefs: [completedAttempt.syncAttemptId, completedAttempt.sourceId],
    summary: completedAttempt.attemptSummary,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      resumed: true,
      sourceId,
      syncSessionId: completedAttempt.syncAttemptId,
      syncAttemptState: 'completed',
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
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_import_completed',
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
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'classification_run',
    actorType: 'system',
    entityRefs: scopedTransactions.map((tx) => tx.transactionId),
    summary: `Classified ${classification.decisions.length} transactions.`,
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
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_classification_run',
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
  const workspaceId = resolution.updatedItems[0]?.workspaceId ?? 'unknown_workspace';
  const audit = createAuditEvent({
    workspaceId,
    eventType: 'review_resolved',
    actorType: 'user',
    actorRef: input.approverIdentity,
    entityRefs: input.reviewItemIds,
    summary: `Resolved ${resolution.resolvedItems.length} review items.`,
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
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_review_resolved',
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
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'draft_computed',
    actorType: 'system',
    entityRefs: [draft.draftId],
    summary: `Computed draft ${draft.draftId}.`,
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
    checkpointType: readiness.readyForSubmission ? undefined : 'review_judgment',
    blockingReason: readiness.readyForSubmission ? undefined : 'awaiting_review_decision',
    pendingUserAction: readiness.readyForSubmission
      ? undefined
      : derivePendingUserAction({ blockingReason: 'awaiting_review_decision', checkpointType: 'review_judgment' }),
    progress: {
      phase: 'drafting',
      step: 'compute_from_ledger',
      percent: 100,
    },
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_draft_computed',
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
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'draft_computed',
    actorType: 'agent',
    entityRefs: [input.draftId],
    summary: `Prepared HomeTax mapping state for draft ${input.draftId}.`,
  });

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
    checkpointType: readiness.readyForSubmission ? undefined : 'review_judgment',
    blockingReason: readiness.readyForSubmission ? undefined : 'awaiting_review_decision',
    pendingUserAction: readiness.readyForSubmission
      ? undefined
      : derivePendingUserAction({ blockingReason: 'awaiting_review_decision', checkpointType: 'review_judgment' }),
    nextRecommendedAction: readiness.readyForSubmission ? 'tax.browser.start_hometax_assist' : 'tax.classify.list_review_items',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_prepare_hometax',
    },
  };
}

export function taxBrowserStartHomeTaxAssist(input: StartHomeTaxAssistInput): MCPResponseEnvelope<StartHomeTaxAssistData> {
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'browser_assist_started',
    actorType: 'agent',
    entityRefs: [input.draftId],
    summary: `Started HomeTax assist for draft ${input.draftId}.`,
  });

  return {
    ok: true,
    status: 'awaiting_auth',
    data: {
      assistSessionId: `assist_${input.workspaceId}_${input.draftId}`,
      checkpointType: 'authentication',
      authRequired: true,
    },
    requiresAuth: true,
    checkpointType: 'authentication',
    checkpointId: `checkpoint_hometax_auth_${input.workspaceId}_${input.draftId}`,
    pendingUserAction: derivePendingUserAction({ checkpointType: 'authentication', sourceType: 'hometax' }),
    nextRecommendedAction: 'tax.sources.resume_sync',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_browser_assist_started',
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

function extractWorkspaceIdFromSourceId(sourceId?: string): string {
  if (!sourceId) return 'unknown_workspace';
  const match = sourceId.match(/^source_[^_]+_(.+)$/);
  return match?.[1] ?? 'unknown_workspace';
}

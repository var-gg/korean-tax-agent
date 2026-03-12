import { compareWithHomeTax } from '../../core/src/compare.js';
import { buildConsentPrompt, evaluateConsent, type ConsentRequirement } from '../../core/src/consent.js';
import { computeDraftFromLedger } from '../../core/src/draft.js';
import { detectFilingPath } from '../../core/src/path.js';
import { deriveReadinessSummary } from '../../core/src/readiness.js';
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
import type { ClassificationDecision, ConsentRecord, LedgerTransaction, ReviewItem, SourceConnection, TaxpayerFact, WithholdingRecord } from '../../core/src/types.js';
import type {
  CollectionStatusData,
  CompareWithHomeTaxData,
  CompareWithHomeTaxInput,
  ComputeDraftInput,
  ConnectSourceData,
  ConnectSourceInput,
  DetectFilingPathData,
  DetectFilingPathInput,
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

export function taxProfileDetectFilingPath(
  input: DetectFilingPathInput,
  transactions: LedgerTransaction[] = [],
  reviewItems: ReviewItem[] = [],
  coverageGaps: import('../../core/src/types.js').CoverageGap[] = [],
): MCPResponseEnvelope<DetectFilingPathData> {
  const scopedTransactions = transactions.filter((tx) => tx.workspaceId === input.workspaceId);
  const scopedReviewItems = reviewItems.filter((item) => item.workspaceId === input.workspaceId);
  const detection = detectFilingPath({
    transactions: scopedTransactions,
    reviewItems: scopedReviewItems,
    coverageGaps,
  });
  const readiness = deriveReadinessSummary({
    supportTier: detection.supportTier,
    filingPathKind: detection.filingPathKind,
    reviewItems: scopedReviewItems,
    coverageGaps,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      supportTier: detection.supportTier,
      filingPathKind: detection.filingPathKind,
      confidence: detection.confidence,
      reasons: detection.reasons,
      missingFacts: detection.missingFacts,
      escalationFlags: detection.escalationFlags,
    },
    readiness: readiness,
    nextRecommendedAction: 'tax.filing.compute_draft',
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
  estimateConfidence?: 'low' | 'medium' | 'high';
  blockerCodes?: string[];
  taxpayerFacts?: TaxpayerFact[];
  withholdingRecords?: WithholdingRecord[];
  fieldValues?: import('../../core/src/types.js').FilingFieldValue[];
}> {
  const filingYear = input.workspaceId.match(/(20\d{2})/)?.[1];
  const scopedTransactions = transactions.filter((tx) => tx.workspaceId === input.workspaceId);
  const scopedDecisions = decisions.filter((decision) => scopedTransactions.some((tx) => tx.transactionId === decision.entityId));
  const taxpayerFacts: TaxpayerFact[] = [
    {
      factId: `fact_${input.workspaceId}_filing_posture`,
      workspaceId: input.workspaceId,
      category: 'filing_path',
      factKey: 'filing_posture',
      value: scopedTransactions.some((tx) => tx.normalizedDirection === 'income') ? 'income_present' : 'unknown',
      status: scopedTransactions.length > 0 ? 'inferred' : 'missing',
      sourceOfTruth: scopedTransactions.length > 0 ? 'inferred' : 'user_asserted',
      confidence: scopedTransactions.length > 0 ? 0.6 : 0,
      evidenceRefs: scopedTransactions.flatMap((tx) => tx.evidenceRefs),
      updatedAt: new Date().toISOString(),
    },
  ];
  const withholdingRecords: WithholdingRecord[] = [];

  const draft = computeDraftFromLedger({
    workspaceId: input.workspaceId,
    filingYear: filingYear ? Number(filingYear) : new Date().getFullYear(),
    draftVersion: input.draftMode === 'new_version' ? 2 : 1,
    transactions: scopedTransactions,
    decisions: scopedDecisions,
    reviewItems,
    withholdingRecords,
    assumptions: input.includeAssumptions ? ['Initial draft assumptions placeholder'] : [],
  });
  const filingPathDetection = detectFilingPath({
    taxpayerFacts,
    transactions: scopedTransactions,
    withholdingRecords,
    reviewItems,
  });
  const readinessSummary = deriveReadinessSummary({
    supportTier: filingPathDetection.supportTier,
    filingPathKind: filingPathDetection.filingPathKind,
    reviewItems,
    draft: {
      draftId: draft.draftId,
      fieldValues: draft.fieldValues,
    },
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'draft_computed',
    actorType: 'system',
    entityRefs: [draft.draftId],
    summary: `Computed draft ${draft.draftId}.`,
  });

  const computeBlockingReason = deriveComputeDraftBlockingReason(readinessSummary);

  return {
    ok: computeBlockingReason === undefined,
    status: computeBlockingReason === undefined ? 'completed' : 'blocked',
    data: {
      draftId: draft.draftId,
      unresolvedBlockerCount: readinessSummary.blockerCodes.length,
      warnings: draft.warnings,
      incomeSummary: draft.incomeSummary,
      expenseSummary: draft.expenseSummary,
      deductionsSummary: draft.deductionsSummary,
      withholdingSummary: draft.withholdingSummary,
      estimateConfidence: draft.estimateConfidence,
      blockerCodes: draft.blockerCodes,
      taxpayerFacts,
      withholdingRecords,
      fieldValues: draft.fieldValues,
    },
    readiness: readinessSummary,
    checkpointType: computeBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined,
    blockingReason: computeBlockingReason,
    pendingUserAction: computeBlockingReason
      ? derivePendingUserAction({ blockingReason: computeBlockingReason, checkpointType: computeBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined })
      : undefined,
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

export function taxFilingCompareWithHomeTax(
  input: CompareWithHomeTaxInput,
  fieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
): MCPResponseEnvelope<CompareWithHomeTaxData> {
  const comparison = compareWithHomeTax(
    {
      draftId: input.draftId,
      fieldValues,
      sectionKeys: input.sectionKeys,
      comparisonMode: input.comparisonMode,
    },
    buildObservedFields(fieldValues, input.sectionKeys),
  );

  const readinessSummary = deriveReadinessSummary({
    supportTier: 'tier_a',
    filingPathKind: 'mixed_income_limited',
    draft: {
      draftId: input.draftId,
      fieldValues: comparison.fieldValues,
    },
    comparisonSummaryState: comparison.comparisonSummaryState,
  });
  const blockingReason = derivePrepareHomeTaxBlockingReason(readinessSummary);

  return {
    ok: blockingReason === undefined,
    status: blockingReason === undefined ? 'completed' : 'blocked',
    data: {
      draftId: input.draftId,
      sectionResults: comparison.sectionResults,
      materialMismatches: comparison.materialMismatches,
      fieldValues: comparison.fieldValues,
    },
    readiness: readinessSummary,
    blockingReason,
    checkpointType: blockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined,
    pendingUserAction: blockingReason
      ? derivePendingUserAction({ blockingReason, checkpointType: blockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined })
      : undefined,
    nextRecommendedAction: blockingReason === undefined ? 'tax.filing.prepare_hometax' : 'tax.classify.list_review_items',
  };
}

export function taxFilingPrepareHomeTax(
  input: PrepareHomeTaxInput,
  reviewItems: ReviewItem[],
  existingFieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
  readinessHints?: { supportTier?: import('../../core/src/types.js').FilingSupportTier; filingPathKind?: import('../../core/src/types.js').FilingPathKind },
): MCPResponseEnvelope<{
  sectionMapping: Record<string, unknown>;
  requiredManualFields: string[];
  blockedFields: string[];
  browserAssistReady: boolean;
  fieldValues?: import('../../core/src/types.js').FilingFieldValue[];
}> {
  const fieldValues = existingFieldValues.length > 0
    ? existingFieldValues
    : [
        {
          filingFieldValueId: `field_${input.draftId}_income_total`,
          draftId: input.draftId,
          sectionKey: 'income',
          fieldKey: 'total_income',
          value: null,
          sourceOfTruth: 'imported' as const,
          comparisonState: 'not_compared' as const,
          freshnessState: 'current_enough' as const,
        },
        {
          filingFieldValueId: `field_${input.draftId}_withholding_total`,
          draftId: input.draftId,
          sectionKey: 'withholding',
          fieldKey: 'total_withheld_tax',
          value: null,
          sourceOfTruth: 'official' as const,
          requiresManualEntry: true,
          comparisonState: 'manual_only' as const,
          freshnessState: 'refresh_recommended' as const,
        },
      ];
  const readinessSummary = deriveReadinessSummary({
    supportTier: readinessHints?.supportTier ?? 'undetermined',
    filingPathKind: readinessHints?.filingPathKind ?? 'unknown',
    reviewItems,
    draft: {
      draftId: input.draftId,
      fieldValues,
    },
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'draft_computed',
    actorType: 'agent',
    entityRefs: [input.draftId],
    summary: `Prepared HomeTax mapping state for draft ${input.draftId}.`,
  });

  const prepareBlockingReason = derivePrepareHomeTaxBlockingReason(readinessSummary);

  return {
    ok: prepareBlockingReason === undefined,
    status: prepareBlockingReason === undefined ? 'completed' : 'blocked',
    data: {
      sectionMapping: {
        income: 'mapped_placeholder',
        expenses: 'mapped_placeholder',
        withholding: 'mapped_placeholder',
      },
      requiredManualFields: ['withholding.total_withheld_tax'],
      blockedFields: readinessSummary.blockerCodes,
      browserAssistReady: prepareBlockingReason === undefined,
      fieldValues,
    },
    readiness: readinessSummary,
    checkpointType: prepareBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined,
    blockingReason: prepareBlockingReason,
    pendingUserAction: prepareBlockingReason
      ? derivePendingUserAction({ blockingReason: prepareBlockingReason, checkpointType: prepareBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined })
      : undefined,
    nextRecommendedAction: prepareBlockingReason === undefined ? 'tax.browser.start_hometax_assist' : 'tax.classify.list_review_items',
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

function deriveComputeDraftBlockingReason(readiness: { blockerCodes: string[]; draftReadiness: string }): import('../../core/src/types.js').BlockingReason | undefined {
  if (readiness.draftReadiness === 'draft_ready') return undefined;
  if (readiness.blockerCodes.includes('awaiting_review_decision')) return 'awaiting_review_decision';
  if (readiness.blockerCodes.includes('missing_material_coverage')) return 'missing_material_coverage';
  if (readiness.blockerCodes.includes('unsupported_filing_path')) return 'unsupported_filing_path';
  return 'draft_not_ready';
}

function buildObservedFields(
  fieldValues: import('../../core/src/types.js').FilingFieldValue[],
  sectionKeys?: string[],
): Array<{ sectionKey: string; fieldKey: string; portalObservedValue: string | number | boolean | null }> {
  const allowedSections = new Set(sectionKeys ?? []);
  return fieldValues
    .filter((field) => allowedSections.size === 0 || allowedSections.has(field.sectionKey))
    .filter((field) => !field.requiresManualEntry)
    .map((field) => ({
      sectionKey: field.sectionKey,
      fieldKey: field.fieldKey,
      portalObservedValue: toPortalObservedScalar(field.portalObservedValue ?? field.value),
    }));
}

function toPortalObservedScalar(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.stringify(value);
}

function derivePrepareHomeTaxBlockingReason(readiness: { blockerCodes: string[]; submissionReadiness: string }): import('../../core/src/types.js').BlockingReason | undefined {
  if (readiness.submissionReadiness === 'submission_assist_ready') return undefined;
  if (readiness.blockerCodes.includes('awaiting_review_decision')) return 'awaiting_review_decision';
  if (readiness.blockerCodes.includes('comparison_incomplete')) return 'comparison_incomplete';
  if (readiness.blockerCodes.includes('official_data_refresh_required')) return 'official_data_refresh_required';
  if (readiness.blockerCodes.includes('missing_material_coverage')) return 'missing_material_coverage';
  if (readiness.blockerCodes.includes('unsupported_filing_path')) return 'unsupported_filing_path';
  if (readiness.blockerCodes.includes('submission_not_ready')) return 'submission_not_ready';
  return 'submission_not_ready';
}

function extractWorkspaceIdFromSourceId(sourceId?: string): string {
  if (!sourceId) return 'unknown_workspace';
  const match = sourceId.match(/^source_[^_]+_(.+)$/);
  return match?.[1] ?? 'unknown_workspace';
}

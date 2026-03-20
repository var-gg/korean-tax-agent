import { compareWithHomeTax } from '../../core/src/compare.js';
import { buildConsentPrompt, evaluateConsent, type ConsentRequirement } from '../../core/src/consent.js';
import { computeDraftFromLedger } from '../../core/src/draft.js';
import { detectFilingPath } from '../../core/src/path.js';
import { deriveCalibratedReadiness, deriveReadinessSummary } from '../../core/src/readiness.js';
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
import type {
  ClassificationDecision,
  ConsentRecord,
  CoverageByDomain,
  CoverageGap,
  EvidenceDocument,
  FilingCoverageDomain,
  LedgerTransaction,
  MappedReadinessState,
  ReviewItem,
  SourceArtifact,
  SourceConnection,
  TaxpayerFact,
  WithholdingRecord,
} from '../../core/src/types.js';
import type {
  CollectionStatusData,
  CompareWithHomeTaxData,
  CompareWithHomeTaxInput,
  ComputeDraftData,
  ComputeDraftInput,
  ConnectSourceData,
  ConnectSourceInput,
  DetectFilingPathData,
  DisconnectSourceData,
  DisconnectSourceInput,
  ImportHomeTaxMaterialsData,
  ImportHomeTaxMaterialsInput,
  ListSourcesData,
  ListSourcesInput,
  DetectFilingPathInput,
  GetCollectionStatusInput,
  SubmitExtractedReceiptFieldsData,
  SubmitExtractedReceiptFieldsInput,
  UploadDocumentsData,
  UploadDocumentsInput,
  UploadTransactionsData,
  UploadTransactionsInput,
  InitConfigData,
  InitConfigInput,
  InspectEnvironmentData,
  InspectEnvironmentInput,
  MCPResponseEnvelope,
  NormalizeLedgerData,
  NormalizeLedgerInput,
  PlanCollectionData,
  PlanCollectionInput,
  PrepareHomeTaxData,
  PrepareHomeTaxInput,
  RefreshOfficialDataData,
  RefreshOfficialDataInput,
  ResolveReviewItemInput,
  ResumeSyncData,
  ResumeSyncInput,
  RunClassificationInput,
  StartHomeTaxAssistData,
  StartHomeTaxAssistInput,
  SyncSourceData,
  SyncSourceInput,
} from './contracts.js';

function deriveCoverageByDomainFromLegacyReadiness(readiness: {
  blockerCodes: string[];
  comparisonSummaryState: string;
}): CoverageByDomain {
  const coverage: CoverageByDomain = {
    filingPath: readiness.blockerCodes.includes('unsupported_filing_path') ? 'weak' : 'partial',
    incomeInventory: 'partial',
    withholdingPrepaidTax: readiness.blockerCodes.includes('missing_material_coverage') ? 'weak' : 'partial',
    expenseEvidence: 'partial',
    deductionFacts: readiness.blockerCodes.includes('awaiting_review_decision') ? 'weak' : 'partial',
    submissionComparison:
      readiness.comparisonSummaryState === 'matched_enough'
        ? 'strong'
        : readiness.comparisonSummaryState === 'partial'
          ? 'partial'
          : 'weak',
  };

  return coverage;
}

function summarizeCoverage(coverage: CoverageByDomain) {
  const entries = Object.entries(coverage) as Array<[FilingCoverageDomain, CoverageByDomain[FilingCoverageDomain]]>;
  return {
    strongDomains: entries.filter(([, value]) => value === 'strong').map(([key]) => key),
    partialDomains: entries.filter(([, value]) => value === 'partial').map(([key]) => key),
    weakDomains: entries.filter(([, value]) => value === 'weak' || value === 'none').map(([key]) => key),
  };
}

function mapCalibratedReadinessState(result: ReturnType<typeof deriveCalibratedReadiness>): MappedReadinessState {
  return {
    readiness: result.workspaceReadiness,
    coverageByDomain: result.coverageByDomain,
    materialCoverageSummary: result.materialCoverageSummary,
    majorUnknowns: result.majorUnknowns,
    activeBlockers: result.activeBlockers,
    supportTier: result.supportTier,
  };
}

function mapLegacyReadinessState(readiness: {
  supportTier: import('../../core/src/types.js').FilingSupportTier;
  estimateReadiness: import('../../core/src/types.js').ReadinessLevel;
  draftReadiness: import('../../core/src/types.js').ReadinessLevel;
  submissionReadiness: import('../../core/src/types.js').ReadinessLevel;
  comparisonSummaryState: import('../../core/src/types.js').FilingComparisonSummaryState;
  majorUnknowns: string[];
  blockerCodes: import('../../core/src/types.js').BlockingReason[];
}): MappedReadinessState {
  const coverageByDomain = deriveCoverageByDomainFromLegacyReadiness(readiness);
  return {
    readiness: {
      estimateReadiness: readiness.estimateReadiness === 'not_ready' ? 'not_ready' : readiness.estimateReadiness === 'estimate_ready' ? 'ready' : 'ready',
      draftReadiness: readiness.draftReadiness === 'draft_ready' ? 'ready' : readiness.draftReadiness === 'estimate_ready' ? 'limited' : 'not_ready',
      submissionReadiness:
        readiness.submissionReadiness === 'submission_assist_ready'
          ? 'ready'
          : readiness.blockerCodes.includes('unsupported_filing_path')
            ? 'unsupported'
            : readiness.submissionReadiness === 'draft_ready'
              ? 'blocked'
              : 'not_ready',
      confidenceBand: 'medium',
      supportTier: readiness.supportTier,
      majorUnknowns: readiness.majorUnknowns,
    },
    coverageByDomain,
    materialCoverageSummary: summarizeCoverage(coverageByDomain),
    majorUnknowns: readiness.majorUnknowns,
    supportTier: readiness.supportTier,
  };
}

function buildCollectionReadinessState(params: {
  supportTier?: import('../../core/src/types.js').FilingSupportTier;
  pendingCheckpoints?: number;
  blockedAttempts?: string[];
  coverageGaps?: CoverageGap[];
  sourceState?: import('../../core/src/types.js').SourceState;
  blockingReason?: import('../../core/src/types.js').BlockingReason;
  resumed?: boolean;
}): MappedReadinessState {
  const blocked = (params.blockedAttempts?.length ?? 0) > 0 || params.blockingReason !== undefined;
  const openCoverageGaps = (params.coverageGaps ?? []).filter((gap) => gap.state === 'open');
  const hasCoverageGaps = openCoverageGaps.length > 0;
  const submissionComparison = params.resumed ? 'partial' : 'weak';
  const coverageByDomain: CoverageByDomain = {
    filingPath: hasCoverageGaps ? 'weak' : 'partial',
    incomeInventory: params.resumed ? 'partial' : 'weak',
    withholdingPrepaidTax: blocked || hasCoverageGaps ? 'weak' : 'partial',
    expenseEvidence: params.resumed ? 'partial' : 'weak',
    deductionFacts: 'weak',
    submissionComparison,
  };

  const majorUnknowns = [
    ...(blocked ? ['Source collection is still blocked or incomplete.'] : []),
    ...openCoverageGaps.map((gap) => gap.description),
    ...((params.pendingCheckpoints ?? 0) > 0 ? ['A user checkpoint is still pending before stronger readiness claims.'] : []),
  ];

  return {
    readiness: {
      estimateReadiness: params.resumed ? 'limited' : 'not_ready',
      draftReadiness: params.resumed && !hasCoverageGaps ? 'limited' : 'not_ready',
      submissionReadiness: blocked || hasCoverageGaps ? 'blocked' : 'not_ready',
      confidenceBand: params.resumed ? 'medium' : 'low',
      supportTier: params.supportTier ?? 'undetermined',
      majorUnknowns,
    },
    coverageByDomain,
    materialCoverageSummary: summarizeCoverage(coverageByDomain),
    majorUnknowns,
    supportTier: params.supportTier ?? 'undetermined',
    readinessImpact: params.blockingReason
      ? {
          estimateReadiness: 'unchanged',
          draftReadiness: 'downgraded_to_not_ready',
          submissionReadiness: 'blocked',
        }
      : undefined,
  };
}

export function taxSetupInspectEnvironment(input: InspectEnvironmentInput = {}): MCPResponseEnvelope<InspectEnvironmentData> {
  const configPath = input.configPath?.trim();
  const storageReady = true;
  const availableConnectors = ['hometax', 'local_documents', 'bank_csv'];
  const supportedImportModes = ['browser_assist', 'export_ingestion', 'fact_capture'];

  return {
    ok: true,
    status: 'completed',
    data: {
      storageReady,
      supportedImportModes,
      availableConnectors,
      browserAssistAvailable: true,
      missingDependencies: configPath ? [] : ['config_path_not_provided'],
    },
    nextRecommendedAction: 'tax.setup.init_config',
  };
}

export function taxSetupInitConfig(input: InitConfigInput): MCPResponseEnvelope<InitConfigData> {
  const workspacePath = input.workspacePath?.trim() || `./workspaces/${input.filingYear}/${input.taxpayerTypeHint?.trim() || 'default'}`;
  const workspaceId = `workspace_${input.filingYear}_${slugifyWorkspaceSegment(input.taxpayerTypeHint)}`;

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId,
      filingYear: input.filingYear,
      storageMode: 'local',
      workspacePath,
    },
    nextRecommendedAction: 'tax.sources.plan_collection',
  };
}

export function taxSourcesPlanCollection(input: PlanCollectionInput): MCPResponseEnvelope<PlanCollectionData> {
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
  coverageGaps: CoverageGap[] = [],
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
    readinessState: buildCollectionReadinessState({
      pendingCheckpoints: pendingCheckpoints.length,
      blockedAttempts,
      coverageGaps,
    }),
    nextRecommendedAction: pendingCheckpoints.length > 0 ? 'tax.sources.resume_sync' : 'tax.sources.plan_collection',
  };
}

export function taxSourcesList(
  input: ListSourcesInput,
  sources: SourceConnection[] = [],
  syncAttempts: Array<{
    syncAttemptId: string;
    sourceId: string;
    state: string;
    endedAt?: string;
    blockingReason?: string;
  }> = [],
): MCPResponseEnvelope<ListSourcesData> {
  const visibleSources = sources.filter((source) => input.includeDisabled || source.metadata?.futureSyncBlocked !== true);
  const dataSources = visibleSources.map((source) => {
    const latestAttempt = syncAttempts
      .filter((attempt) => attempt.sourceId === source.sourceId)
      .sort((a, b) => (b.endedAt ?? '').localeCompare(a.endedAt ?? ''))[0];

    return {
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      sourceState: source.state ?? source.connectionStatus ?? 'planned',
      availability: source.metadata?.futureSyncBlocked === true ? 'disconnected' as const : 'available' as const,
      syncSummary: input.includeSyncSummary
        ? {
            lastSyncAttemptId: latestAttempt?.syncAttemptId,
            lastSyncAttemptState: latestAttempt?.state as NonNullable<ListSourcesData['sources'][number]['syncSummary']>['lastSyncAttemptState'],
            lastSyncAt: source.lastSyncAt,
            lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
            blockingReason: (latestAttempt?.blockingReason ?? source.lastBlockingReason) as NonNullable<ListSourcesData['sources'][number]['syncSummary']>['blockingReason'],
          }
        : undefined,
      nextRecommendedAction: source.metadata?.futureSyncBlocked === true
        ? 'tax.sources.connect'
        : ((source.state === 'awaiting_auth' || source.state === 'blocked') ? 'tax.sources.resume_sync' : 'tax.sources.sync'),
    };
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      sources: dataSources,
    },
    nextRecommendedAction: dataSources.some((source) => source.availability === 'disconnected') ? 'tax.sources.connect' : 'tax.sources.sync',
  };
}

export function taxSourcesDisconnect(
  input: DisconnectSourceInput,
  source: SourceConnection,
): MCPResponseEnvelope<DisconnectSourceData> {
  const disconnectedAt = new Date().toISOString();
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'source_connected',
    actorType: 'agent',
    entityRefs: [source.sourceId],
    summary: `Disconnected source ${source.sourceId} from future syncs.`,
    metadata: {
      reason: input.reason,
      recordsRetained: true,
    },
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      sourceId: source.sourceId,
      disconnected: true,
      sourceState: source.state ?? source.connectionStatus ?? 'completed',
      recordsRetained: true,
      warning: '기존 imported records는 유지됨. future sync/resume만 차단됩니다.',
      disconnectedAt,
    },
    warnings: [
      {
        code: 'records_retained',
        message: 'Existing artifacts, documents, transactions, withholding records, and audit history are retained.',
        severity: 'low',
      },
    ],
    progress: {
      phase: 'source_connection',
      step: 'disconnect_source',
      percent: 100,
    },
    nextRecommendedAction: 'tax.sources.list',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_source_disconnected',
    },
  };
}

export function taxImportUploadTransactions(input: UploadTransactionsInput): MCPResponseEnvelope<UploadTransactionsData> {
  const acceptedRefs = dedupeRefs(input.refs);
  const artifactIds = acceptedRefs.map((ref) => ref.artifactId ?? buildImportedArtifactId(input.workspaceId, ref.ref, 'transactions'));
  const ready = artifactIds.length > 0;
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'import_completed',
    actorType: 'agent',
    entityRefs: artifactIds,
    summary: `Registered ${artifactIds.length} transaction import artifact ref(s).`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      artifactIds,
      ingestionSummary: {
        acceptedRefCount: acceptedRefs.length,
        deduplicatedRefCount: input.refs.length - acceptedRefs.length,
        formatHints: input.formatHints ?? [],
        storedArtifactCount: artifactIds.length,
      },
      normalizeReadiness: ready ? 'ready' : 'needs_more_input',
    },
    blockingReason: ready ? undefined : 'insufficient_metadata',
    warnings: ready ? undefined : [{ code: 'no_refs', message: 'No import refs were provided for transaction ingestion.', severity: 'medium' }],
    progress: { phase: 'import_ingestion', step: 'register_transaction_refs', percent: 100 },
    nextRecommendedAction: ready ? 'tax.ledger.normalize' : 'tax.sources.plan_collection',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_import_transactions_registered',
    },
  };
}

export function taxImportUploadDocuments(input: UploadDocumentsInput): MCPResponseEnvelope<UploadDocumentsData> {
  const acceptedRefs = dedupeRefs(input.refs);
  const hinted = new Map((input.documentHints ?? []).map((hint) => [hint.ref, hint]));
  const documentIds = acceptedRefs.map((ref) => buildImportedDocumentId(input.workspaceId, ref.ref));
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'artifact_parsed',
    actorType: 'agent',
    entityRefs: documentIds,
    summary: `Registered ${documentIds.length} document ref(s) for later normalization.`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      documentIds,
      ingestionSummary: {
        acceptedRefCount: acceptedRefs.length,
        hintedDocumentCount: acceptedRefs.filter((ref) => hinted.has(ref.ref)).length,
        storedDocumentCount: documentIds.length,
      },
    },
    warnings: acceptedRefs.length === 0 ? [{ code: 'no_refs', message: 'No document refs were provided.', severity: 'medium' }] : undefined,
    blockingReason: acceptedRefs.length === 0 ? 'insufficient_metadata' : undefined,
    progress: { phase: 'import_ingestion', step: 'register_document_refs', percent: 100 },
    nextRecommendedAction: acceptedRefs.length > 0 ? 'tax.ledger.normalize' : 'tax.sources.plan_collection',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_import_documents_registered',
    },
  };
}

export function taxImportSubmitExtractedReceiptFields(input: SubmitExtractedReceiptFieldsInput): MCPResponseEnvelope<SubmitExtractedReceiptFieldsData> {
  const accepted = input.submissions.filter((submission) => Object.keys(submission.fields ?? {}).length > 0);
  const updatedDocumentIds = accepted.filter((submission) => submission.documentId).map((submission) => submission.documentId as string);
  const createdDocumentIds = accepted.filter((submission) => !submission.documentId).map((submission) => submission.documentId ?? buildImportedDocumentId(input.workspaceId, submission.documentRef ?? submission.artifactRef ?? 'receipt_fields'));
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'artifact_parsed',
    actorType: 'agent',
    entityRefs: [...updatedDocumentIds, ...createdDocumentIds],
    summary: `Registered extracted receipt fields for ${accepted.length} submission(s).`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      acceptedSubmissionCount: accepted.length,
      updatedDocumentIds,
      createdDocumentIds,
    },
    warnings: accepted.length === 0 ? [{ code: 'no_structured_fields', message: 'No structured receipt fields were provided.', severity: 'medium' }] : undefined,
    blockingReason: accepted.length === 0 ? 'insufficient_metadata' : undefined,
    progress: { phase: 'import_ingestion', step: 'store_extracted_receipt_fields', percent: 100 },
    nextRecommendedAction: accepted.length > 0 ? 'tax.ledger.normalize' : 'tax.sources.plan_collection',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_receipt_fields_registered',
    },
  };
}

export function taxImportHomeTaxMaterials(input: ImportHomeTaxMaterialsInput): MCPResponseEnvelope<ImportHomeTaxMaterialsData> {
  const acceptedRefs = dedupeRefs(input.refs);
  const metadataByRef = new Map((input.materialMetadata ?? []).map((entry) => [entry.ref, entry]));
  const recognizedMaterials = acceptedRefs.map((ref) => {
    const artifactId = ref.artifactId ?? buildImportedArtifactId(input.workspaceId, ref.ref, 'hometax');
    const recognizedType = recognizeHomeTaxMaterialType(ref.ref, metadataByRef.get(ref.ref)?.materialTypeHint);
    const supported = recognizedType !== 'unknown';
    return { ref: ref.ref, artifactId, recognizedType, supported };
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'import_completed',
    actorType: 'agent',
    entityRefs: recognizedMaterials.map((item) => item.artifactId),
    summary: `Registered ${recognizedMaterials.length} HomeTax material ref(s).`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      workspaceId: input.workspaceId,
      artifactIds: recognizedMaterials.map((item) => item.artifactId),
      recognizedMaterials,
    },
    warnings: recognizedMaterials.filter((item) => !item.supported).map((item) => ({
      code: 'unsupported_hometax_material',
      message: `Unsupported HomeTax material for ref ${item.ref}.`,
      severity: 'medium' as const,
    })),
    blockingReason: recognizedMaterials.length === 0 ? 'insufficient_metadata' : undefined,
    progress: { phase: 'import_ingestion', step: 'register_hometax_material_refs', percent: 100 },
    nextRecommendedAction: recognizedMaterials.some((item) => item.supported) ? 'tax.ledger.normalize' : 'tax.sources.plan_collection',
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_hometax_materials_registered',
    },
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
      readinessState: buildCollectionReadinessState({
        pendingCheckpoints: 1,
        sourceState: 'awaiting_consent',
        blockingReason: 'missing_consent',
      }),
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
    readinessState: buildCollectionReadinessState({
      pendingCheckpoints: authRequired ? 1 : 0,
      sourceState: authRequired ? 'awaiting_auth' : 'ready',
      blockingReason: authRequired ? 'missing_auth' : undefined,
    }),
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
    readinessState: buildCollectionReadinessState({
      pendingCheckpoints: 1,
      blockedAttempts: [blockedAttempt.syncAttemptId],
      sourceState: 'blocked',
      blockingReason: blockedAttempt.blockingReason,
    }),
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
    readinessState: buildCollectionReadinessState({
      pendingCheckpoints: 0,
      sourceState: 'completed',
      resumed: true,
    }),
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

export function taxLedgerNormalize(
  input: NormalizeLedgerInput,
  state: {
    transactions?: LedgerTransaction[];
    evidenceDocuments?: EvidenceDocument[];
    withholdingRecords?: WithholdingRecord[];
    coverageGaps?: CoverageGap[];
  } = {},
): MCPResponseEnvelope<NormalizeLedgerData> {
  const now = new Date().toISOString();
  const scopedTransactions = (state.transactions ?? []).filter((tx) => tx.workspaceId === input.workspaceId);
  const scopedDocuments = (state.evidenceDocuments ?? []).filter((doc) => doc.workspaceId === input.workspaceId);
  const scopedWithholdingRecords = (state.withholdingRecords ?? []).filter((record) => record.workspaceId === input.workspaceId);
  const artifactIds = input.artifactIds ?? [];
  const payloads = (input.extractedPayloads ?? []).filter((payload) => artifactIds.length === 0 || (payload.artifactId && artifactIds.includes(payload.artifactId)));

  const normalizedArtifacts: SourceArtifact[] = [];
  const normalizedDocuments = [...scopedDocuments];
  const normalizedTransactions = [...scopedTransactions];
  const withholdingRecordsCreated: WithholdingRecord[] = [];
  const withholdingRecordsUpdated: WithholdingRecord[] = [];
  const coverageGapsCreated: CoverageGap[] = [];

  const documentRefMap = new Map<string, string>();
  const transactionRefMap = new Map<string, string>();

  for (const transaction of scopedTransactions) {
    if (transaction.artifactId && transaction.sourceReference) {
      transactionRefMap.set(`${transaction.artifactId}:${transaction.sourceReference}`, transaction.transactionId);
    }
  }
  for (const document of scopedDocuments) {
    documentRefMap.set(document.documentId, document.documentId);
    if (document.artifactId) {
      documentRefMap.set(`${document.artifactId}:${document.fileRef}`, document.documentId);
    }
  }

  for (const payload of payloads) {
    const artifactId = payload.artifactId ?? `artifact_${slugify(payload.sourceId ?? 'import')}_${normalizedArtifacts.length + 1}`;
    normalizedArtifacts.push({
      artifactId,
      workspaceId: input.workspaceId,
      sourceId: payload.sourceId ?? `source_import_${slugify(payload.sourceType ?? 'manual')}`,
      artifactType: payload.sourceArtifact?.artifactType ?? 'json',
      acquiredAt: now,
      ingestedAt: now,
      parseStatus: 'parsed',
      parseState: 'parsed',
      parseSummary: {
        transactionCount: payload.transactions?.length ?? 0,
        documentCount: payload.documents?.length ?? 0,
        withholdingRecordCount: payload.withholdingRecords?.length ?? 0,
      },
      contentRef: payload.sourceArtifact?.contentRef,
      storageRef: payload.sourceArtifact?.storageRef,
      checksum: payload.sourceArtifact?.checksum,
      contentHash: payload.sourceArtifact?.contentHash,
      provenance: {
        normalizationMode: input.normalizationMode ?? 'default',
        ...payload.provenance,
        sourceArtifact: payload.sourceArtifact?.provenance,
      },
    });

    for (const [transactionIndex, transaction] of (payload.transactions ?? []).entries()) {
      const reservedTransactionId = transaction.externalId
        ? `tx_${slugify(transaction.externalId)}`
        : `tx_${slugify(artifactId)}_${normalizedTransactions.length + transactionIndex + 1}`;
      if (transaction.externalId) transactionRefMap.set(`${artifactId}:${transaction.externalId}`, reservedTransactionId);
      if (transaction.sourceReference) transactionRefMap.set(`${artifactId}:${transaction.sourceReference}`, reservedTransactionId);
    }

    for (const document of payload.documents ?? []) {
      const documentId = document.externalId
        ? `doc_${slugify(document.externalId)}`
        : `doc_${slugify(artifactId)}_${normalizedDocuments.length + 1}`;
      const linkedTransactionIds = (document.linkedTransactionRefs ?? []).map((ref) => transactionRefMap.get(`${artifactId}:${ref}`) ?? transactionRefMap.get(ref) ?? ref);
      const normalizedDocument: EvidenceDocument = {
        documentId,
        workspaceId: input.workspaceId,
        sourceId: payload.sourceId ?? `source_import_${slugify(payload.sourceType ?? 'manual')}`,
        artifactId,
        documentType: document.documentType ?? inferDocumentTypeFromFields(document.extractedFields),
        issuedAt: document.issuedAt,
        issuer: document.issuer,
        amount: document.amount,
        currency: document.currency ?? 'KRW',
        fileRef: document.fileRef,
        extractionStatus: document.extractionStatus ?? 'extracted',
        extractedFields: {
          ...document.extractedFields,
          normalizationProvenance: {
            artifactId,
            sourceId: payload.sourceId,
            providedBy: 'external_agent',
            payloadProvenance: payload.provenance,
            documentProvenance: document.provenance,
          },
        },
        linkedTransactionIds,
      };
      normalizedDocuments.push(normalizedDocument);
      documentRefMap.set(documentId, documentId);
      documentRefMap.set(`${artifactId}:${document.fileRef}`, documentId);
      if (document.externalId) documentRefMap.set(`${artifactId}:${document.externalId}`, documentId);
    }

    for (const transaction of payload.transactions ?? []) {
      const transactionId = transaction.externalId
        ? `tx_${slugify(transaction.externalId)}`
        : `tx_${slugify(artifactId)}_${normalizedTransactions.length + 1}`;
      const evidenceRefs = (transaction.evidenceDocumentRefs ?? []).map((ref) => documentRefMap.get(`${artifactId}:${ref}`) ?? documentRefMap.get(ref) ?? ref);
      const normalizedTransaction: LedgerTransaction = {
        transactionId,
        workspaceId: input.workspaceId,
        sourceId: payload.sourceId ?? `source_import_${slugify(payload.sourceType ?? 'manual')}`,
        artifactId,
        occurredAt: transaction.occurredAt,
        postedAt: transaction.postedAt,
        amount: transaction.amount,
        currency: transaction.currency ?? 'KRW',
        normalizedDirection: transaction.normalizedDirection ?? inferDirection(transaction.description, transaction.amount),
        counterparty: transaction.counterparty,
        description: transaction.description,
        rawCategory: transaction.rawCategory,
        sourceReference: transaction.sourceReference ?? transaction.externalId,
        evidenceRefs,
        duplicateGroupId: transaction.duplicateHint ?? deriveDuplicateGroupId(transaction, artifactId),
        reviewStatus: 'unreviewed',
        createdAt: now,
      };
      normalizedTransactions.push(normalizedTransaction);
      if (transaction.externalId) transactionRefMap.set(`${artifactId}:${transaction.externalId}`, transactionId);
      if (normalizedTransaction.sourceReference) transactionRefMap.set(`${artifactId}:${normalizedTransaction.sourceReference}`, transactionId);
    }

    for (const withholding of payload.withholdingRecords ?? []) {
      const withholdingRecord = buildNormalizedWithholdingRecord({
        workspaceId: input.workspaceId,
        artifactId,
        payload,
        withholding,
        transactions: normalizedTransactions,
        evidenceDocuments: normalizedDocuments,
        existingRecords: scopedWithholdingRecords,
        now,
      });
      const existingIndex = scopedWithholdingRecords.findIndex((record) => record.withholdingRecordId === withholdingRecord.withholdingRecordId);
      if (existingIndex >= 0) {
        scopedWithholdingRecords[existingIndex] = withholdingRecord;
        withholdingRecordsUpdated.push(withholdingRecord);
      } else {
        scopedWithholdingRecords.push(withholdingRecord);
        withholdingRecordsCreated.push(withholdingRecord);
      }
    }
  }

  const filteredTransactions = artifactIds.length > 0
    ? normalizedTransactions.filter((tx) => tx.artifactId !== undefined && artifactIds.includes(tx.artifactId))
    : normalizedTransactions;
  const filteredDocuments = artifactIds.length > 0
    ? normalizedDocuments.filter((doc) => doc.artifactId !== undefined && artifactIds.includes(doc.artifactId))
    : normalizedDocuments;
  const duplicateCandidateCount = filteredTransactions.filter((tx) => Boolean(tx.duplicateGroupId)).length;

  coverageGapsCreated.push(...buildNormalizationCoverageGaps({
    workspaceId: input.workspaceId,
    transactions: filteredTransactions,
    documents: filteredDocuments,
    withholdingRecords: scopedWithholdingRecords,
    existingGaps: state.coverageGaps ?? [],
    now,
  }));

  const normalizationWarnings = filteredTransactions.length === 0 && filteredDocuments.length === 0
    ? [{ code: 'no_artifacts_normalized', message: 'No imported artifacts or extracted payloads matched the normalization request.', severity: 'medium' as const }]
    : undefined;
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'import_completed',
    actorType: 'system',
    entityRefs: [...filteredTransactions.map((tx) => tx.transactionId), ...filteredDocuments.map((doc) => doc.documentId)],
    summary: `Normalized ${filteredTransactions.length} transaction(s), ${filteredDocuments.length} document(s), and ${withholdingRecordsCreated.length + withholdingRecordsUpdated.length} withholding record(s) into workflow state.`,
    metadata: {
      normalizationMode: input.normalizationMode ?? 'default',
      artifactIds: input.artifactIds,
      extractedPayloadCount: payloads.length,
      coverageGapCount: coverageGapsCreated.length,
    },
  });
  const nextRecommendedAction = filteredTransactions.length > 0 || withholdingRecordsCreated.length > 0 || withholdingRecordsUpdated.length > 0
    ? 'tax.classify.run'
    : 'tax.sources.plan_collection';

  return {
    ok: true,
    status: 'completed',
    data: {
      transactionCount: filteredTransactions.length,
      documentCount: filteredDocuments.length,
      duplicateCandidateCount,
      withholdingRecordsCreated,
      withholdingRecordsUpdated,
      coverageGapsCreated,
      normalizedArtifacts,
      normalizedDocuments: filteredDocuments,
      normalizedTransactions: filteredTransactions,
    },
    warnings: normalizationWarnings,
    progress: {
      phase: 'ledger_normalization',
      step: payloads.length > 0 ? 'materialize_extracted_payloads' : 'canonicalize_imported_artifacts',
      percent: 100,
    },
    nextRecommendedAction,
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_ledger_normalized',
    },
  };
}

function dedupeRefs<T extends { ref: string }>(refs: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const ref of refs) {
    if (seen.has(ref.ref)) continue;
    seen.add(ref.ref);
    result.push(ref);
  }
  return result;
}

function buildImportedArtifactId(workspaceId: string, ref: string, prefix: string): string {
  return `artifact_${slugify(prefix)}_${slugify(workspaceId)}_${slugify(ref)}`;
}

function buildImportedDocumentId(workspaceId: string, ref: string): string {
  return `doc_${slugify(workspaceId)}_${slugify(ref)}`;
}

function recognizeHomeTaxMaterialType(ref: string, hinted?: string): 'hometax_export' | 'tax_statement' | 'income_statement' | 'taxpayer_overview' | 'unknown' {
  const text = `${hinted ?? ''} ${ref}`.toLowerCase();
  if (text.includes('overview') || text.includes('summary')) return 'taxpayer_overview';
  if (text.includes('income')) return 'income_statement';
  if (text.includes('statement')) return 'tax_statement';
  if (text.includes('hometax') || text.includes('export') || text.includes('지급명세') || text.includes('원천징수')) return 'hometax_export';
  return 'unknown';
}

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'item';
}

function inferDocumentTypeFromFields(fields: Record<string, unknown> | undefined): EvidenceDocument['documentType'] {
  const text = JSON.stringify(fields ?? {}).toLowerCase();
  if (text.includes('withholding')) return 'withholding_doc';
  if (text.includes('invoice')) return 'invoice';
  if (text.includes('receipt')) return 'receipt';
  return 'other';
}

function inferDirection(description: string | undefined, amount: number): LedgerTransaction['normalizedDirection'] {
  const text = (description ?? '').toLowerCase();
  if (/income|payment|consulting|invoice|service/.test(text)) return 'income';
  if (/expense|purchase|receipt|supplies|laptop|equipment/.test(text)) return 'expense';
  return amount >= 0 ? 'expense' : 'income';
}

function deriveDuplicateGroupId(transaction: { occurredAt: string; amount: number; counterparty?: string }, artifactId: string): string | undefined {
  return `dup_${slugify(artifactId)}_${slugify(transaction.occurredAt.slice(0, 10))}_${Math.abs(transaction.amount)}_${slugify(transaction.counterparty ?? 'unknown')}`;
}

function buildNormalizedWithholdingRecord(input: {
  workspaceId: string;
  artifactId: string;
  payload: NonNullable<NormalizeLedgerInput['extractedPayloads']>[number];
  withholding: NonNullable<NonNullable<NormalizeLedgerInput['extractedPayloads']>[number]['withholdingRecords']>[number];
  transactions: LedgerTransaction[];
  evidenceDocuments: EvidenceDocument[];
  existingRecords: WithholdingRecord[];
  now: string;
}): WithholdingRecord {
  const payerName = input.withholding.payerName ?? input.payload.sourceId ?? 'unknown_payer';
  const evidenceRefs = (input.withholding.evidenceDocumentRefs ?? []).map((ref) => input.evidenceDocuments.find((doc) => doc.documentId === ref || `${input.artifactId}:${doc.fileRef}` === `${input.artifactId}:${ref}`)?.documentId ?? ref);
  const matchingIncome = input.transactions.find((tx) => tx.transactionId === input.withholding.incomeSourceRef || (tx.counterparty && tx.counterparty === payerName && tx.normalizedDirection === 'income'));
  const recordId = input.withholding.externalId
    ? `withholding_${slugify(input.withholding.externalId)}`
    : matchingIncome
      ? `withholding_${matchingIncome.transactionId}`
      : `withholding_${slugify(input.artifactId)}_${slugify(payerName)}`;
  const existing = input.existingRecords.find((record) => record.withholdingRecordId === recordId);
  return {
    withholdingRecordId: recordId,
    workspaceId: input.workspaceId,
    filingYear: input.withholding.filingYear ?? Number((matchingIncome?.occurredAt ?? input.now).slice(0, 4)),
    incomeSourceRef: input.withholding.incomeSourceRef ?? matchingIncome?.transactionId,
    payerName,
    grossAmount: input.withholding.grossAmount ?? matchingIncome?.amount,
    withheldTaxAmount: input.withholding.withheldTaxAmount,
    localTaxAmount: input.withholding.localTaxAmount,
    currency: input.withholding.currency ?? matchingIncome?.currency ?? 'KRW',
    sourceType: input.withholding.sourceType ?? input.payload.sourceType ?? 'manual',
    sourceOfTruth: 'imported',
    extractionConfidence: input.withholding.extractionConfidence ?? 0.85,
    reviewStatus: existing?.reviewStatus ?? 'review_required',
    evidenceRefs,
    capturedAt: input.now,
  };
}

function buildNormalizationCoverageGaps(input: {
  workspaceId: string;
  transactions: LedgerTransaction[];
  documents: EvidenceDocument[];
  withholdingRecords: WithholdingRecord[];
  existingGaps: CoverageGap[];
  now: string;
}): CoverageGap[] {
  const existingKeys = new Set(input.existingGaps.map((gap) => `${gap.gapType}:${gap.affectedArea}:${gap.description}`));
  const gaps: CoverageGap[] = [];
  for (const tx of input.transactions.filter((item) => item.normalizedDirection === 'expense' && item.evidenceRefs.length === 0)) {
    const description = `Expense transaction ${tx.transactionId} is missing supporting evidence.`;
    const key = `missing_expense_evidence:expense_evidence:${description}`;
    if (!existingKeys.has(key)) {
      gaps.push({
        gapId: `gap_${tx.transactionId}_missing_evidence`, workspaceId: input.workspaceId, gapType: 'missing_expense_evidence', severity: 'medium', description,
        affectedArea: 'expense_evidence', affectedDomains: ['expenseEvidence'], materiality: 'medium', blocksEstimate: false, blocksDraft: true, blocksSubmission: true,
        recommendedNextSource: 'receipt_upload', recommendedNextAction: 'tax.sources.plan_collection', relatedSourceIds: [tx.sourceId], sourceRefs: [tx.transactionId], state: 'open', createdAt: input.now, updatedAt: input.now,
      });
    }
  }
  for (const record of input.withholdingRecords.filter((item) => !item.incomeSourceRef)) {
    const description = `Withholding record ${record.withholdingRecordId} is missing a matched income transaction.`;
    const key = `missing_income_source:income_inventory:${description}`;
    if (!existingKeys.has(key)) {
      gaps.push({
        gapId: `gap_${record.withholdingRecordId}_missing_income`, workspaceId: input.workspaceId, gapType: 'missing_income_source', severity: 'high', description,
        affectedArea: 'income_inventory', affectedDomains: ['incomeInventory', 'withholdingPrepaidTax'], materiality: 'high', blocksEstimate: true, blocksDraft: true, blocksSubmission: true,
        recommendedNextSource: 'bank_csv', recommendedNextAction: 'tax.sources.plan_collection', relatedSourceIds: [], sourceRefs: record.evidenceRefs, state: 'open', createdAt: input.now, updatedAt: input.now,
      });
    }
  }
  if ((input.transactions.some((tx) => tx.normalizedDirection === 'income') || input.withholdingRecords.length > 0) && !input.existingGaps.some((gap) => gap.gapType === 'missing_hometax_comparison')) {
    gaps.push({
      gapId: `gap_${input.workspaceId}_missing_hometax_comparison_normalize`, workspaceId: input.workspaceId, gapType: 'missing_hometax_comparison', severity: 'medium',
      description: 'Normalized income and withholding state exists but HomeTax comparison has not been recorded yet.', affectedArea: 'submission_comparison', affectedDomains: ['submissionComparison'], materiality: 'medium',
      blocksEstimate: false, blocksDraft: false, blocksSubmission: true, recommendedNextSource: 'hometax', recommendedNextAction: 'tax.filing.compare_with_hometax', relatedSourceIds: [], sourceRefs: input.documents.map((doc) => doc.documentId), state: 'open', createdAt: input.now, updatedAt: input.now,
    });
  }
  return gaps;
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
  const calibratedReadiness = deriveCalibratedReadiness({
    supportTier: detection.supportTier,
    filingPathKind: detection.filingPathKind,
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
    readinessState: mapCalibratedReadinessState(calibratedReadiness),
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
    nextRecommendedAction: 'tax.filing.compute_draft',
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
  taxpayerFacts: TaxpayerFact[] = [],
  withholdingRecords: WithholdingRecord[] = [],
  coverageGaps: CoverageGap[] = [],
  existingFieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
): MCPResponseEnvelope<ComputeDraftData> {
  const filingYear = input.workspaceId.match(/(20\d{2})/)?.[1];
  const scopedTransactions = transactions.filter((tx) => tx.workspaceId === input.workspaceId);
  const transactionIds = new Set(scopedTransactions.map((tx) => tx.transactionId));
  const scopedDecisions = decisions.filter((decision) => transactionIds.has(decision.entityId));
  const scopedReviewItems = reviewItems.filter((item) => item.workspaceId === input.workspaceId);
  const scopedTaxpayerFacts = taxpayerFacts.filter((fact) => fact.workspaceId === input.workspaceId);
  const scopedWithholdingRecords = withholdingRecords.filter((record) => record.workspaceId === input.workspaceId);
  const openCoverageGaps = coverageGaps.filter((gap) => gap.workspaceId === input.workspaceId && gap.state === 'open');

  const draft = computeDraftFromLedger({
    workspaceId: input.workspaceId,
    filingYear: filingYear ? Number(filingYear) : new Date().getFullYear(),
    draftVersion: input.draftMode === 'new_version' ? 2 : 1,
    transactions: scopedTransactions,
    decisions: scopedDecisions,
    reviewItems: scopedReviewItems,
    withholdingRecords: scopedWithholdingRecords,
    assumptions: input.includeAssumptions ? ['Computed from persisted runtime state.'] : [],
  });
  const filingPathDetection = detectFilingPath({
    taxpayerFacts: scopedTaxpayerFacts,
    transactions: scopedTransactions,
    withholdingRecords: scopedWithholdingRecords,
    reviewItems: scopedReviewItems,
    coverageGaps: openCoverageGaps,
  });
  const calibratedReadiness = deriveCalibratedReadiness({
    supportTier: filingPathDetection.supportTier,
    filingPathKind: filingPathDetection.filingPathKind,
    reviewItems: scopedReviewItems,
    coverageGaps: openCoverageGaps,
    draft: {
      draftId: draft.draftId,
      fieldValues: mergeComputedFieldValuesWithRuntimeState(draft.fieldValues, existingFieldValues),
    },
  });
  const readinessSummary = deriveReadinessSummary({
    supportTier: filingPathDetection.supportTier,
    filingPathKind: filingPathDetection.filingPathKind,
    reviewItems: scopedReviewItems,
    coverageGaps: openCoverageGaps,
    draft: {
      draftId: draft.draftId,
      fieldValues: mergeComputedFieldValuesWithRuntimeState(draft.fieldValues, existingFieldValues),
    },
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'draft_computed',
    actorType: 'system',
    entityRefs: [draft.draftId],
    summary: `Computed draft ${draft.draftId}.`,
  });

  draft.fieldValues = mergeComputedFieldValuesWithRuntimeState(draft.fieldValues, existingFieldValues);
  draft.blockerCodes = readinessSummary.blockerCodes;
  draft.estimateReadiness = readinessSummary.estimateReadiness;
  draft.draftReadiness = readinessSummary.draftReadiness;
  draft.submissionReadiness = readinessSummary.submissionReadiness;
  draft.comparisonSummaryState = readinessSummary.comparisonSummaryState;
  draft.freshnessState = readinessSummary.freshnessState;
  draft.majorUnknowns = readinessSummary.majorUnknowns;

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
      taxpayerFacts: scopedTaxpayerFacts,
      withholdingRecords: scopedWithholdingRecords,
      fieldValues: draft.fieldValues,
      supportTier: readinessSummary.supportTier,
      filingPathKind: readinessSummary.filingPathKind,
      estimateReadiness: readinessSummary.estimateReadiness,
      draftReadiness: readinessSummary.draftReadiness,
      submissionReadiness: readinessSummary.submissionReadiness,
      comparisonSummaryState: readinessSummary.comparisonSummaryState,
      freshnessState: readinessSummary.freshnessState,
      majorUnknowns: readinessSummary.majorUnknowns,
    },
    readiness: readinessSummary,
    readinessState: mapCalibratedReadinessState(calibratedReadiness),
    checkpointType: computeBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined,
    blockingReason: computeBlockingReason,
    pendingUserAction: computeBlockingReason
      ? derivePendingUserAction({ blockingReason: computeBlockingReason, checkpointType: computeBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined })
      : undefined,
    nextRecommendedAction: computeBlockingReason === undefined
      ? 'tax.filing.compare_with_hometax'
      : computeBlockingReason === 'comparison_incomplete'
        ? 'tax.filing.compare_with_hometax'
        : 'tax.classify.list_review_items',
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
    input.portalObservedFields ?? buildObservedFields(fieldValues, input.sectionKeys),
  );

  const calibratedReadiness = deriveCalibratedReadiness({
    supportTier: 'tier_a',
    filingPathKind: 'mixed_income_limited',
    draft: {
      draftId: input.draftId,
      fieldValues: comparison.fieldValues,
    },
    comparisonSummaryState: comparison.comparisonSummaryState,
  });
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
    readinessState: mapCalibratedReadinessState(calibratedReadiness),
    blockingReason,
    checkpointType: blockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined,
    pendingUserAction: blockingReason
      ? derivePendingUserAction({ blockingReason, checkpointType: blockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined })
      : undefined,
    nextRecommendedAction: blockingReason === undefined ? 'tax.filing.prepare_hometax' : 'tax.classify.list_review_items',
  };
}

export function taxFilingRefreshOfficialData(
  input: RefreshOfficialDataInput,
  draft?: { draftId: string; fieldValues?: import('../../core/src/types.js').FilingFieldValue[] },
): MCPResponseEnvelope<RefreshOfficialDataData> {
  const refreshedFieldValues = (draft?.fieldValues ?? []).map((field) => ({
    ...field,
    freshnessState: 'current_enough' as const,
  }));
  const calibratedReadiness = deriveCalibratedReadiness({
    supportTier: 'tier_a',
    filingPathKind: 'mixed_income_limited',
    draft: draft
      ? {
          draftId: draft.draftId,
          fieldValues: refreshedFieldValues,
        }
      : undefined,
  });
  const readinessSummary = deriveReadinessSummary({
    supportTier: 'tier_a',
    filingPathKind: 'mixed_income_limited',
    draft: draft
      ? {
          draftId: draft.draftId,
          fieldValues: refreshedFieldValues,
        }
      : undefined,
  });
  const audit = createAuditEvent({
    workspaceId: input.workspaceId,
    eventType: 'import_completed',
    actorType: 'system',
    entityRefs: input.sourceIds ?? [],
    summary: `Refreshed official data for workspace ${input.workspaceId}.`,
  });

  return {
    ok: true,
    status: 'completed',
    data: {
      refreshedSources: (input.sourceIds ?? ['src_hometax_main']).map((sourceId, index) => ({
        sourceId,
        syncAttemptId: `sync_refresh_${index + 1}_${input.workspaceId}`,
        changeSummary: {
          newArtifacts: 1,
          changedWithholdingRecords: 1,
          changedDraftFields: refreshedFieldValues.length,
        },
      })),
      recomputedDraftId: input.recomputeDraft ? draft?.draftId : undefined,
      supersededDraftId: input.recomputeDraft ? draft?.draftId : undefined,
      readinessDowngraded: false,
      downgradeReasons: [],
    },
    readiness: readinessSummary,
    readinessState: mapCalibratedReadinessState(calibratedReadiness),
    audit: {
      eventType: audit.eventType,
      eventId: audit.eventId ?? audit.auditEventId ?? 'evt_source_refreshed',
    },
    nextRecommendedAction: 'tax.filing.compare_with_hometax',
  };
}

export function taxFilingPrepareHomeTax(
  input: PrepareHomeTaxInput,
  reviewItems: ReviewItem[],
  existingFieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
  readinessHints?: { supportTier?: import('../../core/src/types.js').FilingSupportTier; filingPathKind?: import('../../core/src/types.js').FilingPathKind },
): MCPResponseEnvelope<PrepareHomeTaxData> {
  const fieldValues = existingFieldValues;
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

  const derivedPreparation = deriveHomeTaxPreparationState(fieldValues, reviewItems, prepareBlockingReason);

  return {
    ok: prepareBlockingReason === undefined,
    status: prepareBlockingReason === undefined ? 'completed' : 'blocked',
    data: {
      sectionMapping: derivedPreparation.sectionMapping,
      orderedSections: derivedPreparation.orderedSections,
      manualOnlyFields: derivedPreparation.manualOnlyFields,
      blockedFields: derivedPreparation.blockedFields,
      comparisonNeededFields: derivedPreparation.comparisonNeededFields,
      browserAssistReady: prepareBlockingReason === undefined,
      handoff: derivedPreparation.handoff,
      fieldValues,
    },
    readiness: readinessSummary,
    checkpointType: prepareBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined,
    blockingReason: prepareBlockingReason,
    pendingUserAction: prepareBlockingReason
      ? derivePendingUserAction({ blockingReason: prepareBlockingReason, checkpointType: prepareBlockingReason === 'awaiting_review_decision' ? 'review_judgment' : undefined })
      : undefined,
    nextRecommendedAction: prepareBlockingReason === undefined
      ? 'tax.browser.start_hometax_assist'
      : prepareBlockingReason === 'comparison_incomplete'
        ? 'tax.filing.compare_with_hometax'
        : prepareBlockingReason === 'official_data_refresh_required'
          ? 'tax.filing.refresh_official_data'
          : 'tax.classify.list_review_items',
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
      handoff: undefined,
    },
    requiresAuth: true,
    checkpointType: 'authentication',
    checkpointId: `checkpoint_hometax_auth_${input.workspaceId}_${input.draftId}`,
    pendingUserAction: derivePendingUserAction({ checkpointType: 'authentication', sourceType: 'hometax' }),
    nextRecommendedAction: 'tax.browser.resume_hometax_assist',
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

export function taxBrowserResumeHomeTaxAssist(
  input: import('./contracts.js').ResumeHomeTaxAssistInput,
  session: import('../../core/src/types.js').BrowserAssistSession,
): MCPResponseEnvelope<import('./contracts.js').ResumeHomeTaxAssistData> {
  return {
    ok: true,
    status: session.authState === 'completed' ? 'in_progress' : 'awaiting_auth',
    data: {
      assistSessionId: session.assistSessionId,
      draftId: session.draftId,
      checkpointType: session.checkpointType,
      authRequired: session.authState !== 'completed',
      pendingUserAction: session.pendingUserAction,
      handoff: {
        provider: session.provider ?? 'hometax',
        targetSection: session.lastKnownSection ?? 'hometax_entry_start',
        recommendedTool: 'tax.browser.resume_hometax_assist',
        entryPlan: undefined,
      },
    },
    requiresAuth: session.authState !== 'completed',
    checkpointType: session.checkpointType,
    pendingUserAction: session.pendingUserAction ?? derivePendingUserAction({ checkpointType: session.checkpointType, sourceType: 'hometax' }),
    nextRecommendedAction: 'tax.browser.resume_hometax_assist',
  };
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

function mergeComputedFieldValuesWithRuntimeState(
  computedFieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
  runtimeFieldValues: import('../../core/src/types.js').FilingFieldValue[] = [],
): import('../../core/src/types.js').FilingFieldValue[] {
  const runtimeMap = new Map(runtimeFieldValues.map((field) => [`${field.sectionKey}:${field.fieldKey}`, field]));
  return computedFieldValues.map((field) => {
    const persisted = runtimeMap.get(`${field.sectionKey}:${field.fieldKey}`);
    return persisted
      ? {
          ...field,
          portalObservedValue: persisted.portalObservedValue,
          comparisonState: persisted.comparisonState ?? field.comparisonState,
          freshnessState: persisted.freshnessState ?? field.freshnessState,
          requiresManualEntry: persisted.requiresManualEntry ?? field.requiresManualEntry,
          mismatchSeverity: persisted.mismatchSeverity,
        }
      : field;
  });
}

function deriveHomeTaxPreparationState(
  fieldValues: import('../../core/src/types.js').FilingFieldValue[],
  reviewItems: ReviewItem[],
  prepareBlockingReason?: import('../../core/src/types.js').BlockingReason,
): Pick<PrepareHomeTaxData, 'sectionMapping' | 'orderedSections' | 'manualOnlyFields' | 'blockedFields' | 'comparisonNeededFields' | 'handoff' | 'browserAssistReady' | 'fieldValues'> {
  const grouped = new Map<string, PrepareHomeTaxData['sectionMapping'][string]>();
  const manualOnlyFields: string[] = [];
  const blockedFields: string[] = [];
  const comparisonNeededFields: string[] = [];
  const mismatchFields: string[] = [];
  const openReviewItems = reviewItems.filter((item) => item.resolutionState !== 'resolved' && item.resolutionState !== 'dismissed');
  const highSeverityReviewItems = openReviewItems.filter((item) => item.severity === 'high' || item.severity === 'critical');
  const mismatchReviewItems = openReviewItems.filter((item) => item.reasonCode === 'hometax_material_mismatch');
  const immediateUserConfirmations = ['consent/login/final judgment must remain user-confirmed'];

  for (const field of fieldValues) {
    const fieldRef = `${field.sectionKey}.${field.fieldKey}`;
    const comparisonState = field.comparisonState ?? 'not_compared';
    const requiresManualEntry = field.requiresManualEntry === true;
    const comparisonNeeded = !requiresManualEntry && (comparisonState === 'not_compared' || comparisonState === undefined);
    const hasMismatch = comparisonState === 'mismatch';
    const fieldReviewOpen = mismatchReviewItems.some((item) => item.linkedEntityIds?.includes(`${field.sectionKey}:${field.fieldKey}`));
    const blocked = hasMismatch || comparisonNeeded || fieldReviewOpen || Boolean(prepareBlockingReason);
    const current = grouped.get(field.sectionKey) ?? {
      sectionKey: field.sectionKey,
      fieldRefs: [],
      mappedFields: [],
      manualOnlyFields: [],
      blockedFields: [],
      comparisonNeededFields: [],
      mismatchFields: [],
      blockingItems: [],
    };

    const sourceProvenanceRefs = Array.isArray(field.evidenceRefs) ? field.evidenceRefs : [];
    current.fieldRefs.push(fieldRef);
    current.mappedFields.push({
      fieldKey: field.fieldKey,
      fieldRef,
      value: field.value,
      comparisonState,
      sourceOfTruth: field.sourceOfTruth,
      requiresManualEntry,
      blocked,
      comparisonNeeded,
      sourceProvenanceRefs,
      mismatchState: fieldReviewOpen ? 'review_required' : hasMismatch ? 'mismatch' : comparisonNeeded ? 'not_compared' : 'matched',
      reviewStatus: fieldReviewOpen ? 'open' : 'none',
      entryInstruction: requiresManualEntry
        ? '사용자가 HomeTax 화면에서 직접 확인 후 수기 입력'
        : hasMismatch
          ? '초안값과 HomeTax 관측값 불일치. 검토 후 입력 여부 결정'
          : comparisonNeeded
            ? 'HomeTax 표시값과 대조 후 입력'
            : '초안 기준으로 입력 후 화면값 재확인',
    });

    if (requiresManualEntry) {
      current.manualOnlyFields.push(fieldRef);
      manualOnlyFields.push(fieldRef);
    }
    if (blocked) {
      current.blockedFields.push(fieldRef);
      blockedFields.push(fieldRef);
    }
    if (comparisonNeeded) {
      current.comparisonNeededFields.push(fieldRef);
      comparisonNeededFields.push(fieldRef);
    }
    if (hasMismatch || fieldReviewOpen) {
      current.mismatchFields.push(fieldRef);
      mismatchFields.push(fieldRef);
    }

    grouped.set(field.sectionKey, current);
  }

  const orderedSections = Array.from(grouped.values())
    .sort((a, b) => a.sectionKey.localeCompare(b.sectionKey))
    .map((section, index) => ({
      order: index + 1,
      sectionKey: section.sectionKey,
      checkpointType: section.blockedFields.length > 0 ? 'review_judgment' as const : 'data_entry' as const,
      fieldRefs: section.fieldRefs,
      mappedFields: section.mappedFields,
      manualOnlyFields: section.manualOnlyFields,
      blockedFields: section.blockedFields,
      comparisonNeededFields: section.comparisonNeededFields,
      mismatchFields: section.mismatchFields,
      blockingItems: [
        ...(section.blockedFields.length > 0 ? [`${section.sectionKey} section has blocked fields`] : []),
      ],
    }));

  const blockingItems = [
    ...(prepareBlockingReason ? [prepareBlockingReason] : []),
    ...(highSeverityReviewItems.length > 0 ? ['high_severity_review_items_open'] : []),
    ...(mismatchReviewItems.length > 0 ? ['unresolved_hometax_mismatches'] : []),
  ];

  if (highSeverityReviewItems.length > 0) immediateUserConfirmations.push('high severity review items require human judgment');
  if (mismatchReviewItems.length > 0) immediateUserConfirmations.push('unresolved mismatch fields require user decision before final filing');
  if (prepareBlockingReason === 'official_data_refresh_required') immediateUserConfirmations.push('official data refresh needed before compare/recompute');
  immediateUserConfirmations.push('final submission judgment must be made by the user');

  return {
    sectionMapping: Object.fromEntries(grouped.entries()),
    orderedSections,
    manualOnlyFields,
    blockedFields,
    comparisonNeededFields,
    browserAssistReady: blockingItems.length === 0,
    handoff: {
      orderedSections,
      mismatchSummary: {
        hasUnresolvedMismatch: mismatchReviewItems.length > 0 || mismatchFields.length > 0,
        hasHighSeverityReview: highSeverityReviewItems.length > 0,
        openReviewItemIds: openReviewItems.map((item) => item.reviewItemId),
        unresolvedMismatchFieldRefs: mismatchFields,
      },
      manualVerificationChecklist: [
        '입력 전 각 섹션의 초안값과 HomeTax 표시값을 대조',
        '수기 입력 필드는 원천 증빙과 합계가 일치하는지 확인',
        '최종 제출 전 review/mismatch/blocker 상태 재확인',
      ],
      blockingItems,
      immediateUserConfirmations,
    },
    fieldValues,
  };
}

function extractWorkspaceIdFromSourceId(sourceId?: string): string {
  if (!sourceId) return 'unknown_workspace';
  const match = sourceId.match(/^source_[^_]+_(.+)$/);
  return match?.[1] ?? 'unknown_workspace';
}

function slugifyWorkspaceSegment(value?: string): string {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return normalized || 'default';
}

import type {
  AuditEvent,
  BlockingReason,
  CoverageGap,
  CoverageGapState,
  FilingWorkspace,
  SourceConnection,
  SourceState,
  SyncAttempt,
  SyncAttemptState,
  WorkspaceStatus,
} from './types.js';

export type CreateSourceConnectionInput = {
  workspaceId: string;
  sourceType: SourceConnection['sourceType'];
  sourceLabel?: string;
  collectionMode?: SourceConnection['collectionMode'];
  authMethod?: string;
  requestedScope?: string[];
  now?: string;
};

export type StartSyncAttemptInput = {
  workspaceId: string;
  sourceId: string;
  mode: SyncAttempt['mode'];
  checkpointId?: string;
  now?: string;
};

export type BlockSyncAttemptInput = {
  attempt: SyncAttempt;
  blockingReason: BlockingReason;
  checkpointId?: string;
  fallbackOptions?: string[];
  now?: string;
};

export type CompleteSyncAttemptInput = {
  attempt: SyncAttempt;
  attemptSummary?: string;
  now?: string;
};

export type CreateCoverageGapInput = {
  workspaceId: string;
  gapType: string;
  severity: CoverageGap['severity'];
  description: string;
  affectedArea: string;
  recommendedNextAction?: string;
  relatedSourceIds?: string[];
};

export function createSourceConnection(input: CreateSourceConnectionInput): SourceConnection {
  const now = input.now ?? new Date().toISOString();
  return {
    sourceId: `source_${input.sourceType}_${input.workspaceId}`,
    workspaceId: input.workspaceId,
    sourceType: input.sourceType,
    sourceLabel: input.sourceLabel,
    collectionMode: input.collectionMode,
    authMethod: input.authMethod,
    scopeGranted: input.requestedScope ?? [],
    state: 'planned',
    connectionStatus: 'planned',
    createdAt: now,
    updatedAt: now,
  };
}

export function transitionSourceState(source: SourceConnection, nextState: SourceState, now = new Date().toISOString(), blockingReason?: BlockingReason): SourceConnection {
  return {
    ...source,
    state: nextState,
    connectionStatus: nextState,
    lastBlockingReason: nextState === 'blocked' ? blockingReason : source.lastBlockingReason,
    updatedAt: now,
  };
}

export function startSyncAttempt(input: StartSyncAttemptInput): SyncAttempt {
  const now = input.now ?? new Date().toISOString();
  return {
    syncAttemptId: `sync_${input.sourceId}_${input.mode}_${Date.now()}`,
    workspaceId: input.workspaceId,
    sourceId: input.sourceId,
    mode: input.mode,
    state: input.checkpointId ? 'awaiting_user_action' : 'running',
    startedAt: now,
    checkpointId: input.checkpointId,
  };
}

export function blockSyncAttempt(input: BlockSyncAttemptInput): SyncAttempt {
  const now = input.now ?? new Date().toISOString();
  return {
    ...input.attempt,
    state: 'blocked',
    blockingReason: input.blockingReason,
    checkpointId: input.checkpointId ?? input.attempt.checkpointId,
    fallbackOptions: input.fallbackOptions ?? input.attempt.fallbackOptions,
    endedAt: now,
  };
}

export function completeSyncAttempt(input: CompleteSyncAttemptInput): SyncAttempt {
  const now = input.now ?? new Date().toISOString();
  return {
    ...input.attempt,
    state: 'completed',
    attemptSummary: input.attemptSummary ?? input.attempt.attemptSummary,
    endedAt: now,
  };
}

export function createCoverageGap(input: CreateCoverageGapInput): CoverageGap {
  return {
    gapId: `gap_${input.workspaceId}_${input.gapType}_${Math.abs(hashString(`${input.description}:${input.affectedArea}`))}`,
    workspaceId: input.workspaceId,
    gapType: input.gapType,
    severity: input.severity,
    description: input.description,
    affectedArea: input.affectedArea,
    recommendedNextAction: input.recommendedNextAction,
    relatedSourceIds: input.relatedSourceIds ?? [],
    state: 'open',
  };
}

export function summarizeCoverageGaps(gaps: CoverageGap[]) {
  return gaps.reduce(
    (acc, gap) => {
      acc.total += 1;
      acc.byState[gap.state] = (acc.byState[gap.state] ?? 0) + 1;
      acc.bySeverity[gap.severity] = (acc.bySeverity[gap.severity] ?? 0) + 1;
      acc.byType[gap.gapType] = (acc.byType[gap.gapType] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      byState: {} as Record<CoverageGapState, number>,
      bySeverity: {} as Record<CoverageGap['severity'], number>,
      byType: {} as Record<string, number>,
    },
  );
}

export function updateCoverageGapState(gap: CoverageGap, state: CoverageGapState): CoverageGap {
  return {
    ...gap,
    state,
  };
}

export function deriveWorkspaceStatus(params: {
  sources?: SourceConnection[];
  syncAttempts?: SyncAttempt[];
  coverageGaps?: CoverageGap[];
  unresolvedReviewCount?: number;
  readyForHomeTaxAssist?: boolean;
  submitted?: boolean;
}): WorkspaceStatus {
  if (params.submitted) return 'submitted';
  if (params.readyForHomeTaxAssist) return 'ready_for_hometax_assist';
  if ((params.unresolvedReviewCount ?? 0) > 0) return 'review_pending';

  const runningSync = (params.syncAttempts ?? []).some((attempt) => attempt.state === 'running');
  if (runningSync) return 'collecting_sources';

  const awaitingUser = (params.syncAttempts ?? []).some((attempt) => attempt.state === 'awaiting_user_action' || attempt.state === 'blocked');
  if (awaitingUser) return 'collecting_sources';

  const sourceActive = (params.sources ?? []).some((source) => {
    const state = source.state ?? source.connectionStatus;
    return state && state !== 'completed' && state !== 'disabled';
  });
  if (sourceActive) return 'collecting_sources';

  const openCoverageGaps = (params.coverageGaps ?? []).some((gap) => gap.state === 'open');
  if (openCoverageGaps) return 'normalizing';

  return 'draft_ready_for_review';
}

export function updateWorkspaceProgress(
  workspace: FilingWorkspace,
  params: {
    sources?: SourceConnection[];
    syncAttempts?: SyncAttempt[];
    coverageGaps?: CoverageGap[];
    unresolvedReviewCount?: number;
    readyForHomeTaxAssist?: boolean;
    submitted?: boolean;
    blockingReason?: BlockingReason;
    now?: string;
  },
): FilingWorkspace {
  const now = params.now ?? new Date().toISOString();
  return {
    ...workspace,
    status: deriveWorkspaceStatus(params),
    unresolvedReviewCount: params.unresolvedReviewCount ?? workspace.unresolvedReviewCount,
    openCoverageGapCount: (params.coverageGaps ?? []).filter((gap) => gap.state === 'open').length,
    lastBlockingReason: params.blockingReason ?? workspace.lastBlockingReason,
    updatedAt: now,
  };
}

export function createAuditEvent(input: {
  workspaceId: string;
  eventType: AuditEvent['eventType'];
  actorType: AuditEvent['actorType'];
  actorRef?: string;
  entityRefs?: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
  now?: string;
}): AuditEvent {
  const now = input.now ?? new Date().toISOString();
  return {
    eventId: `evt_${input.eventType}_${Date.now()}`,
    workspaceId: input.workspaceId,
    eventType: input.eventType,
    actorType: input.actorType,
    actorRef: input.actorRef,
    entityRefs: input.entityRefs ?? [],
    summary: input.summary,
    metadata: input.metadata,
    createdAt: now,
  };
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

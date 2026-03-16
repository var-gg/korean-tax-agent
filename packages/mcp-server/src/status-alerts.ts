import type { ActiveBlocker } from '../../core/src/types.js';
import type { GetFilingSummaryData } from './contracts.js';

export type FilingAlertSnapshot = Pick<
  GetFilingSummaryData,
  'status' | 'blockers' | 'nextRecommendedAction' | 'operatorUpdate'
> & {
  workspaceId: string;
  activeBlockers: ActiveBlocker[];
};

export type FilingAlertSeverity = 'high' | 'medium' | 'info' | 'none';

export type FilingAlertDecision = {
  shouldNotify: boolean;
  reason:
    | 'initial_state'
    | 'status_changed'
    | 'blocker_changed'
    | 'next_action_changed'
    | 'no_change';
  severity: FilingAlertSeverity;
  message?: string;
};

export function toFilingAlertSnapshot(data: GetFilingSummaryData): FilingAlertSnapshot {
  return {
    workspaceId: data.workspaceId,
    status: data.status,
    blockers: data.runtimeSnapshot?.blockerCodes ?? data.blockers,
    activeBlockers: data.runtimeSnapshot?.activeBlockers ?? [],
    nextRecommendedAction: data.nextRecommendedAction,
    operatorUpdate: data.operatorUpdate,
  };
}

export function decideFilingAlert(
  previous: FilingAlertSnapshot | undefined,
  current: FilingAlertSnapshot,
): FilingAlertDecision {
  if (!previous) {
    return {
      shouldNotify: true,
      reason: 'initial_state',
      severity: classifyFilingAlertSeverity(current),
      message: current.operatorUpdate,
    };
  }

  if (previous.status !== current.status) {
    return {
      shouldNotify: true,
      reason: 'status_changed',
      severity: classifyFilingAlertSeverity(current),
      message: current.operatorUpdate,
    };
  }

  if (joinTokens(previous.blockers) !== joinTokens(current.blockers) || joinTokens(previous.activeBlockers.map((blocker) => blocker.blockingReason)) !== joinTokens(current.activeBlockers.map((blocker) => blocker.blockingReason))) {
    return {
      shouldNotify: true,
      reason: 'blocker_changed',
      severity: classifyFilingAlertSeverity(current),
      message: current.operatorUpdate,
    };
  }

  if ((previous.nextRecommendedAction ?? '') !== (current.nextRecommendedAction ?? '')) {
    return {
      shouldNotify: true,
      reason: 'next_action_changed',
      severity: classifyFilingAlertSeverity(current),
      message: current.operatorUpdate,
    };
  }

  return {
    shouldNotify: false,
    reason: 'no_change',
    severity: 'none',
  };
}

export function classifyFilingAlertSeverity(snapshot: FilingAlertSnapshot): FilingAlertSeverity {
  const blockerCodes = snapshot.activeBlockers.length > 0
    ? snapshot.activeBlockers.map((blocker) => blocker.blockingReason)
    : snapshot.blockers;

  if (
    snapshot.status === 'blocked'
    || blockerCodes.includes('missing_auth')
    || blockerCodes.includes('missing_consent')
    || blockerCodes.includes('export_required')
    || snapshot.operatorUpdate.includes('COLLECTION BLOCKED')
  ) {
    return 'high';
  }

  if (
    snapshot.status === 'review_pending'
    || blockerCodes.includes('awaiting_review_decision')
    || blockerCodes.includes('comparison_incomplete')
    || blockerCodes.includes('official_data_refresh_required')
  ) {
    return 'medium';
  }

  if (
    snapshot.status === 'ready_for_hometax_assist'
    || snapshot.status === 'submission_in_progress'
    || snapshot.operatorUpdate.includes('READY FOR HOMETAX ASSIST')
    || snapshot.operatorUpdate.includes('SUBMISSION IN PROGRESS')
  ) {
    return 'info';
  }

  return 'medium';
}

function joinTokens(values: string[]): string {
  return [...values].sort().join('|');
}

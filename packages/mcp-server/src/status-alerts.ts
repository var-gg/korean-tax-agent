import type { GetFilingSummaryData } from './contracts.js';

export type FilingAlertSnapshot = Pick<
  GetFilingSummaryData,
  'status' | 'blockers' | 'nextRecommendedAction' | 'operatorUpdate'
> & {
  workspaceId: string;
};

export type FilingAlertDecision = {
  shouldNotify: boolean;
  reason:
    | 'initial_state'
    | 'status_changed'
    | 'blocker_changed'
    | 'next_action_changed'
    | 'no_change';
  message?: string;
};

export function toFilingAlertSnapshot(data: GetFilingSummaryData): FilingAlertSnapshot {
  return {
    workspaceId: data.workspaceId,
    status: data.status,
    blockers: data.blockers,
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
      message: current.operatorUpdate,
    };
  }

  if (previous.status !== current.status) {
    return {
      shouldNotify: true,
      reason: 'status_changed',
      message: current.operatorUpdate,
    };
  }

  if (joinTokens(previous.blockers) !== joinTokens(current.blockers)) {
    return {
      shouldNotify: true,
      reason: 'blocker_changed',
      message: current.operatorUpdate,
    };
  }

  if ((previous.nextRecommendedAction ?? '') !== (current.nextRecommendedAction ?? '')) {
    return {
      shouldNotify: true,
      reason: 'next_action_changed',
      message: current.operatorUpdate,
    };
  }

  return {
    shouldNotify: false,
    reason: 'no_change',
  };
}

function joinTokens(values: string[]): string {
  return [...values].sort().join('|');
}

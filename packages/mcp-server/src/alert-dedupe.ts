import type { FilingAlertDispatchPlan } from './alert-transport.js';

export type FilingAlertDeliveryRecord = {
  workspaceId: string;
  fingerprint: string;
  sentAtMs: number;
  severity: FilingAlertDispatchPlan['severity'];
  route: FilingAlertDispatchPlan['route'];
};

export type FilingAlertDedupeDecision = {
  shouldSend: boolean;
  reason: 'send' | 'suppressed_duplicate' | 'missing_message';
  fingerprint: string;
  cooldownMs: number;
};

export function computeFilingAlertFingerprint(
  workspaceId: string,
  dispatchPlan: FilingAlertDispatchPlan,
): string {
  return [workspaceId, dispatchPlan.route, dispatchPlan.severity, dispatchPlan.message ?? ''].join('||');
}

export function shouldSendFilingAlert(
  workspaceId: string,
  dispatchPlan: FilingAlertDispatchPlan,
  previousRecord: FilingAlertDeliveryRecord | undefined,
  nowMs: number,
): FilingAlertDedupeDecision {
  const fingerprint = computeFilingAlertFingerprint(workspaceId, dispatchPlan);
  const cooldownMs = getFilingAlertCooldownMs(dispatchPlan.severity);

  if (!dispatchPlan.shouldSend || !dispatchPlan.message) {
    return {
      shouldSend: false,
      reason: 'missing_message',
      fingerprint,
      cooldownMs,
    };
  }

  if (
    previousRecord
    && previousRecord.fingerprint === fingerprint
    && nowMs - previousRecord.sentAtMs < cooldownMs
  ) {
    return {
      shouldSend: false,
      reason: 'suppressed_duplicate',
      fingerprint,
      cooldownMs,
    };
  }

  return {
    shouldSend: true,
    reason: 'send',
    fingerprint,
    cooldownMs,
  };
}

export function getFilingAlertCooldownMs(severity: FilingAlertDispatchPlan['severity']): number {
  switch (severity) {
    case 'high':
      return 10 * 60 * 1000;
    case 'medium':
      return 30 * 60 * 1000;
    case 'info':
      return 2 * 60 * 60 * 1000;
    case 'none':
    default:
      return 0;
  }
}

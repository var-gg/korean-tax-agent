import { buildFilingAlertDigests, type FilingAlertDigestInput, type FilingAlertDigestPlan } from './alert-digest.js';
import type { FilingAlertDispatchPlan } from '../alert-transport.js';

export type FilingAlertDeliveryCandidate = {
  workspaceId: string;
  dispatchPlan: FilingAlertDispatchPlan;
};

export type FilingAlertImmediateSend = {
  workspaceId: string;
  target: string;
  message: string;
  route: FilingAlertDispatchPlan['route'];
  severity: 'high';
};

export type FilingAlertDeliveryPolicyResult = {
  immediateSends: FilingAlertImmediateSend[];
  digestInputs: FilingAlertDigestInput[];
  digests: FilingAlertDigestPlan[];
};

export function planFilingAlertDelivery(
  candidates: FilingAlertDeliveryCandidate[],
): FilingAlertDeliveryPolicyResult {
  const immediateSends: FilingAlertImmediateSend[] = [];
  const digestInputs: FilingAlertDigestInput[] = [];

  for (const candidate of candidates) {
    const { workspaceId, dispatchPlan } = candidate;
    if (!dispatchPlan.shouldSend || !dispatchPlan.target || !dispatchPlan.message) {
      continue;
    }

    if (dispatchPlan.severity === 'high') {
      immediateSends.push({
        workspaceId,
        target: dispatchPlan.target,
        message: dispatchPlan.message,
        route: dispatchPlan.route,
        severity: 'high',
      });
      continue;
    }

    if (dispatchPlan.severity === 'medium' || dispatchPlan.severity === 'info') {
      digestInputs.push({
        workspaceId,
        dispatchPlan,
      });
    }
  }

  return {
    immediateSends,
    digestInputs,
    digests: buildFilingAlertDigests(digestInputs),
  };
}

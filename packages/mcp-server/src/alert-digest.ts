import type { FilingAlertDispatchPlan } from './alert-transport.js';

export type FilingAlertDigestInput = {
  workspaceId: string;
  dispatchPlan: FilingAlertDispatchPlan;
};

export type FilingAlertDigestPlan = {
  target: string;
  route: FilingAlertDispatchPlan['route'];
  severity: 'medium' | 'info';
  workspaceIds: string[];
  message: string;
  itemCount: number;
};

export function buildFilingAlertDigests(inputs: FilingAlertDigestInput[]): FilingAlertDigestPlan[] {
  const groups = new Map<string, FilingAlertDigestInput[]>();

  for (const input of inputs) {
    const { dispatchPlan } = input;
    if (!dispatchPlan.shouldSend || !dispatchPlan.target || !dispatchPlan.message) {
      continue;
    }

    if (dispatchPlan.severity !== 'medium' && dispatchPlan.severity !== 'info') {
      continue;
    }

    const key = [dispatchPlan.target, dispatchPlan.route, dispatchPlan.severity].join('||');
    const group = groups.get(key) ?? [];
    group.push(input);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => toDigestPlan(group));
}

function toDigestPlan(group: FilingAlertDigestInput[]): FilingAlertDigestPlan {
  const first = group[0];
  const target = first.dispatchPlan.target as string;
  const severity = first.dispatchPlan.severity as 'medium' | 'info';
  const route = first.dispatchPlan.route;
  const workspaceIds = group.map((item) => item.workspaceId);
  const lines = group.map((item) => `- ${item.workspaceId}: ${firstLine(item.dispatchPlan.message as string)}`);

  return {
    target,
    route,
    severity,
    workspaceIds,
    itemCount: group.length,
    message: [
      severity === 'medium' ? '⚠️ FILING ALERT DIGEST' : 'ℹ️ FILING STATUS DIGEST',
      `items=${group.length} route=${route}`,
      ...lines,
    ].join('\n'),
  };
}

function firstLine(message: string): string {
  return message.split(/\r?\n/, 1)[0] ?? message;
}

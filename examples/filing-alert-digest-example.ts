import { buildFilingAlertDigests } from '../packages/mcp-server/src/alert-digest.js';
import type { FilingAlertDispatchPlan } from '../packages/mcp-server/src/alert-transport.js';

const digestInputs: Array<{ workspaceId: string; dispatchPlan: FilingAlertDispatchPlan }> = [
  {
    workspaceId: 'workspace_alpha',
    dispatchPlan: {
      shouldSend: true,
      target: 'discord:#tax-operator-updates',
      route: 'operator-updates',
      severity: 'info',
      message: '✅ READY FOR HOMETAX ASSIST\nNEXT: prepare the draft for HomeTax handoff',
    },
  },
  {
    workspaceId: 'workspace_beta',
    dispatchPlan: {
      shouldSend: true,
      target: 'discord:#tax-operator-updates',
      route: 'operator-updates',
      severity: 'info',
      message: '✅ READY FOR HOMETAX ASSIST\nNEXT: prepare the draft for HomeTax handoff',
    },
  },
  {
    workspaceId: 'workspace_gamma',
    dispatchPlan: {
      shouldSend: true,
      target: 'discord:#tax-operator-watch',
      route: 'operator-watch',
      severity: 'medium',
      message: '⚠️ REVIEW PENDING\nNEXT: resolve review items before preparation',
    },
  },
  {
    workspaceId: 'workspace_delta',
    dispatchPlan: {
      shouldSend: true,
      target: 'discord:#tax-operator-immediate',
      route: 'operator-immediate',
      severity: 'high',
      message: '⏸️ COLLECTION BLOCKED\nNEXT: resume the blocked source sync flow',
    },
  },
];

const digests = buildFilingAlertDigests(digestInputs);

console.log('\n--- Digest plans ---\n');
for (const digest of digests) {
  console.log(digest);
  console.log('');
}

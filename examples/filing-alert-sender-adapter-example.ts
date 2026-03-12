import { planFilingAlertDelivery } from '../packages/mcp-server/src/alert-delivery-policy.js';
import { buildFilingAlertSenderBatch, discordFilingAlertChannel } from '../packages/mcp-server/src/alert-sender-adapter.js';
import type { FilingAlertDispatchPlan } from '../packages/mcp-server/src/alert-transport.js';

const candidates: Array<{ workspaceId: string; dispatchPlan: FilingAlertDispatchPlan }> = [
  {
    workspaceId: 'workspace_blocked',
    dispatchPlan: {
      shouldSend: true,
      target: 'discord:#tax-operator-immediate',
      route: 'operator-immediate',
      severity: 'high',
      message: '⏸️ COLLECTION BLOCKED\nNEXT: resume the blocked source sync flow',
    },
  },
  {
    workspaceId: 'workspace_review_1',
    dispatchPlan: {
      shouldSend: true,
      target: 'discord:#tax-operator-watch',
      route: 'operator-watch',
      severity: 'medium',
      message: '⚠️ REVIEW PENDING\nNEXT: resolve review items before preparation',
    },
  },
  {
    workspaceId: 'workspace_ready',
    dispatchPlan: {
      shouldSend: true,
      target: 'discord:#tax-operator-updates',
      route: 'operator-updates',
      severity: 'info',
      message: '✅ READY FOR HOMETAX ASSIST\nNEXT: prepare the draft for HomeTax handoff',
    },
  },
];

const delivery = planFilingAlertDelivery(candidates);
const senderBatch = buildFilingAlertSenderBatch({
  immediateSends: delivery.immediateSends,
  digests: delivery.digests,
  channel: discordFilingAlertChannel(),
});

console.log('\n--- Sender batch ---\n');
console.log(senderBatch);

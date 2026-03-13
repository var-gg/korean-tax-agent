import { planFilingAlertDelivery } from '../packages/mcp-server/src/integrations/alert-delivery-policy.js';
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
    workspaceId: 'workspace_review_2',
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

const planned = planFilingAlertDelivery(candidates);

console.log('\n--- Immediate sends ---\n');
console.log(planned.immediateSends);
console.log('\n--- Digest plans ---\n');
console.log(planned.digests);
console.log('\n(See examples/filing-alert-sender-adapter-example.ts for provider-facing payload conversion.)');

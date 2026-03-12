import rawDemo from './demo-workspace.json';
import { buildFilingAlertDispatchPlan } from '../packages/mcp-server/src/alert-transport.js';
import { routeFilingAlert } from '../packages/mcp-server/src/alert-routing.js';
import { KoreanTaxMCPFacade } from '../packages/mcp-server/src/facade.js';
import { decideFilingAlert, toFilingAlertSnapshot, type FilingAlertSnapshot } from '../packages/mcp-server/src/status-alerts.js';
import type { ClassificationDecision, ConsentRecord, LedgerTransaction, SourceConnection, SyncAttempt } from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  workspace: import('../packages/core/src/types.js').FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: Array<{ description: string }>;
  transactions: LedgerTransaction[];
  decisions: ClassificationDecision[];
};

const facade = new KoreanTaxMCPFacade({
  consentRecords: demo.consentRecords,
  workspaces: [demo.workspace],
  sources: demo.sources,
  syncAttempts: demo.syncAttempts,
  coverageGapsByWorkspace: {
    [demo.workspaceId]: demo.coverageGaps.map((gap) => gap.description),
  },
  transactions: demo.transactions,
  decisions: demo.decisions,
});

const before = facade.invokeTool({
  name: 'tax.filing.get_summary',
  input: { workspaceId: demo.workspaceId, detailLevel: 'short' },
});
const beforeSnapshot = toFilingAlertSnapshot((before as typeof before & { data: any }).data);
const afterSnapshot = simulateReadyForAssistTransition(beforeSnapshot);

const decision = decideFilingAlert(beforeSnapshot, afterSnapshot);
const routing = routeFilingAlert(decision);
const dispatchPlan = buildFilingAlertDispatchPlan(routing, decision, {
  immediateTarget: 'discord:#tax-operator-immediate',
  watchTarget: 'discord:#tax-operator-watch',
  updatesTarget: 'discord:#tax-operator-updates',
});

console.log('\n--- Dispatch plan ---\n');
console.log(dispatchPlan);

function simulateReadyForAssistTransition(previous: FilingAlertSnapshot): FilingAlertSnapshot {
  return {
    ...previous,
    status: 'ready_for_hometax_assist',
    blockers: [],
    nextRecommendedAction: 'tax.filing.prepare_hometax',
    operatorUpdate: [
      '✅ READY FOR HOMETAX ASSIST',
      'STATUS: The filing draft is ready for HomeTax preparation.',
      'READINESS: submission=submission assist ready | comparison=matched enough | freshness=current enough',
      'QUEUE: reviews=0 | warnings=0 | draft=draft_ready_001',
      'NEXT: prepare the draft for HomeTax handoff',
    ].join('\n'),
  };
}

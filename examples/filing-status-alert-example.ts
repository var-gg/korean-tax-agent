import rawDemo from './demo-workspace.json';
import { KoreanTaxMCPFacade } from '../packages/mcp-server/src/facade.js';
import { routeFilingAlert } from '../packages/mcp-server/src/alert-routing.js';
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

console.log('\n--- Before snapshot ---\n');
console.log(beforeSnapshot.operatorUpdate);
console.log('\n--- Alert decision ---\n');
console.log(`reason=${decision.reason} severity=${decision.severity}`);
console.log('\n--- Routing ---\n');
console.log(`route=${routing.route} shouldSend=${routing.shouldSend}`);
console.log('\n--- Message to send ---\n');
console.log(decision.message ?? 'NO_MESSAGE');

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

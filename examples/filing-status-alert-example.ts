import rawDemo from './demo-workspace.json';
import { KoreanTaxMCPFacade } from '../packages/mcp-server/src/facade.js';
import { decideFilingAlert, toFilingAlertSnapshot } from '../packages/mcp-server/src/status-alerts.js';
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

facade.runtime.store.workspaces.set(demo.workspaceId, {
  ...demo.workspace,
  workspaceId: demo.workspaceId,
  status: 'ready_for_hometax_assist',
  submissionReadiness: 'submission_assist_ready',
  comparisonSummaryState: 'matched_enough',
  freshnessState: 'current_enough',
  unresolvedReviewCount: 0,
  lastCollectionStatus: 'completed',
  lastBlockingReason: undefined,
  currentDraftId: 'draft_ready_001',
  updatedAt: new Date().toISOString(),
});

const after = facade.invokeTool({
  name: 'tax.filing.get_summary',
  input: { workspaceId: demo.workspaceId, detailLevel: 'short' },
});
const afterSnapshot = toFilingAlertSnapshot((after as typeof after & { data: any }).data);

const decision = decideFilingAlert(beforeSnapshot, afterSnapshot);

console.log('\n--- Alert decision ---\n');
console.log(decision.reason);
console.log('\n--- Message to send ---\n');
console.log(decision.message ?? 'NO_MESSAGE');

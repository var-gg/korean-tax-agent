import rawDemo from './demo-workspace.json';
import { KoreanTaxMCPFacade } from '../packages/mcp-server/src/facade.js';
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

const discordReply = facade.invokeAndFormatFilingSummaryForDiscord({
  workspaceId: demo.workspaceId,
  detailLevel: 'short',
});

const genericReply = facade.invokeAndFormatFilingSummary(
  {
    workspaceId: demo.workspaceId,
    detailLevel: 'standard',
  },
  'generic',
);

console.log('\n--- Discord/operator reply ---\n');
console.log(discordReply.message);
console.log('\n--- Generic chat reply ---\n');
console.log(genericReply.message);
console.log('\n--- Canonical runtime snapshot ---\n');
console.log({
  blockerCodes: genericReply.response.data.runtimeSnapshot?.blockerCodes ?? [],
  activeBlockers: genericReply.response.data.runtimeSnapshot?.activeBlockers ?? [],
  submissionComparison: genericReply.response.data.runtimeSnapshot?.submissionComparison,
});
console.log('\n--- Canonical readiness state ---\n');
console.log(genericReply.response.readinessState ?? null);

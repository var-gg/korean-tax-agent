import rawDemo from './demo-workspace.json';
import { InMemoryKoreanTaxMCPRuntime } from '../packages/mcp-server/src/runtime.js';
import type {
  ConsentRecord,
  CoverageGap,
  FilingWorkspace,
  SourceConnection,
  SyncAttempt,
} from '../packages/core/src/types.js';

const demo = rawDemo as {
  workspaceId: string;
  workspace: FilingWorkspace;
  consentRecords: ConsentRecord[];
  sources: SourceConnection[];
  syncAttempts: SyncAttempt[];
  coverageGaps: CoverageGap[];
};

const runtime = new InMemoryKoreanTaxMCPRuntime({
  consentRecords: demo.consentRecords,
  workspaces: [demo.workspace],
  sources: demo.sources,
  syncAttempts: demo.syncAttempts,
  coverageGapsByWorkspace: { [demo.workspaceId]: demo.coverageGaps },
});

const workspaceStatus = runtime.invoke('tax.workspace.get_status', {
  workspaceId: demo.workspaceId,
});

const filingSummary = runtime.invoke('tax.filing.get_summary', {
  workspaceId: demo.workspaceId,
});

console.log(JSON.stringify({
  example: 'external-agent-next-step',
  note: 'The external AI agent does not guess. It asks MCP for current state, reads nextRecommendedAction, and only then decides what callable tool to invoke next.',
  workspaceStatus: {
    status: workspaceStatus.data.workspace.status,
    lastBlockingReason: workspaceStatus.data.workspace.lastBlockingReason,
    nextRecommendedAction: workspaceStatus.data.nextRecommendedAction,
  },
  filingSummary: {
    status: filingSummary.data.status,
    operatorUpdate: filingSummary.data.operatorUpdate,
    nextRecommendedAction: filingSummary.data.nextRecommendedAction,
  },
}, null, 2));

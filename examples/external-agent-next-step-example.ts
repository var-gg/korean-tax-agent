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

const draft = runtime.invoke('tax.filing.compute_draft', {
  workspaceId: demo.workspaceId,
  draftMode: 'refresh',
});
const prepare = runtime.invoke('tax.filing.prepare_hometax', {
  workspaceId: demo.workspaceId,
  draftId: draft.data.draftId,
});

console.log(JSON.stringify({
  example: 'external-agent-next-step',
  note: 'The external AI agent does not guess. It asks MCP for current state, reads nextRecommendedAction, and only then decides what callable tool to invoke next. HomeTax handoff is guided/manual-assist only, not hidden browser automation.',
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
  prepareHomeTax: {
    status: prepare.status,
    browserAssistReady: prepare.data.browserAssistReady,
    nextRecommendedAction: prepare.nextRecommendedAction,
    orderedSections: prepare.data.orderedSections.map((section) => ({
      order: section.order,
      sectionKey: section.sectionKey,
      checkpointType: section.checkpointType,
      fieldCount: section.mappedFields.length,
    })),
    blockingItems: prepare.data.handoff.blockingItems,
  },
}, null, 2));

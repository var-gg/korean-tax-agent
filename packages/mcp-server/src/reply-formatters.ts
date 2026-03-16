import type { GetFilingSummaryData, MCPResponseEnvelope } from './contracts.js';

function buildRuntimeSnapshotAppendix(data: GetFilingSummaryData): string | undefined {
  const runtimeSnapshot = data.runtimeSnapshot;
  if (!runtimeSnapshot) return undefined;

  const activeBlockerLine = runtimeSnapshot.activeBlockers.length > 0
    ? `Active blockers: ${runtimeSnapshot.activeBlockers.map((blocker) => blocker.message || blocker.blockingReason).join(' | ')}`
    : undefined;

  const comparisonLine = runtimeSnapshot.submissionComparison
    ? `Submission comparison: ${runtimeSnapshot.submissionComparison.submissionComparisonState}`
    : undefined;

  return [activeBlockerLine, comparisonLine].filter(Boolean).join('\n') || undefined;
}

export type ReplySurface = 'discord' | 'generic';

export function formatFilingSummaryForReply(
  response: MCPResponseEnvelope<GetFilingSummaryData>,
  surface: ReplySurface = 'generic',
): string {
  if (!response.ok) {
    return response.errorMessage ?? 'Unable to render filing summary.';
  }

  if (surface === 'discord') {
    return response.data.operatorUpdate;
  }

  return [response.data.headline, response.data.summaryText, buildRuntimeSnapshotAppendix(response.data)]
    .filter(Boolean)
    .join('\n');
}

export function formatFilingSummaryForDiscord(
  response: MCPResponseEnvelope<GetFilingSummaryData>,
): string {
  return formatFilingSummaryForReply(response, 'discord');
}

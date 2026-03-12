import type { GetFilingSummaryData, MCPResponseEnvelope } from './contracts.js';

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

  return [response.data.headline, response.data.summaryText]
    .filter(Boolean)
    .join('\n');
}

export function formatFilingSummaryForDiscord(
  response: MCPResponseEnvelope<GetFilingSummaryData>,
): string {
  return formatFilingSummaryForReply(response, 'discord');
}

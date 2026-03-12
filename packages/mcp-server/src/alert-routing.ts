import type { FilingAlertDecision, FilingAlertSeverity } from './status-alerts.js';

export type FilingAlertRoute = 'operator-immediate' | 'operator-watch' | 'operator-updates' | 'drop';

export type FilingAlertRoutingDecision = {
  route: FilingAlertRoute;
  shouldSend: boolean;
  severity: FilingAlertSeverity;
};

export function routeFilingAlert(decision: FilingAlertDecision): FilingAlertRoutingDecision {
  switch (decision.severity) {
    case 'high':
      return {
        route: 'operator-immediate',
        shouldSend: decision.shouldNotify,
        severity: decision.severity,
      };
    case 'medium':
      return {
        route: 'operator-watch',
        shouldSend: decision.shouldNotify,
        severity: decision.severity,
      };
    case 'info':
      return {
        route: 'operator-updates',
        shouldSend: decision.shouldNotify,
        severity: decision.severity,
      };
    case 'none':
    default:
      return {
        route: 'drop',
        shouldSend: false,
        severity: decision.severity,
      };
  }
}

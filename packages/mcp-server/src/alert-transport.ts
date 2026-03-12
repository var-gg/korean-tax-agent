import type { FilingAlertRoutingDecision } from './alert-routing.js';
import type { FilingAlertDecision } from './status-alerts.js';

export type FilingAlertTransportTargets = {
  immediateTarget: string;
  watchTarget: string;
  updatesTarget: string;
};

export type FilingAlertDispatchPlan = {
  shouldSend: boolean;
  target?: string;
  message?: string;
  route: FilingAlertRoutingDecision['route'];
  severity: FilingAlertDecision['severity'];
};

export function buildFilingAlertDispatchPlan(
  routing: FilingAlertRoutingDecision,
  decision: FilingAlertDecision,
  targets: FilingAlertTransportTargets,
): FilingAlertDispatchPlan {
  if (!routing.shouldSend || !decision.message) {
    return {
      shouldSend: false,
      route: routing.route,
      severity: decision.severity,
    };
  }

  switch (routing.route) {
    case 'operator-immediate':
      return {
        shouldSend: true,
        target: targets.immediateTarget,
        message: decision.message,
        route: routing.route,
        severity: decision.severity,
      };
    case 'operator-watch':
      return {
        shouldSend: true,
        target: targets.watchTarget,
        message: decision.message,
        route: routing.route,
        severity: decision.severity,
      };
    case 'operator-updates':
      return {
        shouldSend: true,
        target: targets.updatesTarget,
        message: decision.message,
        route: routing.route,
        severity: decision.severity,
      };
    case 'drop':
    default:
      return {
        shouldSend: false,
        route: routing.route,
        severity: decision.severity,
      };
  }
}

// Compatibility shim: integration-oriented digest helpers now live under ./integrations.
export {
  buildFilingAlertDigests,
  type FilingAlertDigestInput,
  type FilingAlertDigestPlan,
} from './integrations/alert-digest.js';

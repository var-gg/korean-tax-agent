// Compatibility shim: integration-oriented delivery-policy helpers now live under ./integrations.
export {
  planFilingAlertDelivery,
  type FilingAlertDeliveryCandidate,
  type FilingAlertDeliveryPolicyResult,
  type FilingAlertImmediateSend,
} from './integrations/alert-delivery-policy.js';

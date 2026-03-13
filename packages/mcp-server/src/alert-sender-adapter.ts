// Compatibility shim: integration-oriented sender adapters now live under ./integrations.
export {
  buildFilingAlertSenderBatch,
  discordFilingAlertChannel,
  toSenderPayloadFromDigest,
  toSenderPayloadFromImmediate,
  type FilingAlertSenderBatch,
  type FilingAlertSenderPayload,
} from './integrations/alert-sender-adapter.js';

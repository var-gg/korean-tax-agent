import type { FilingAlertDigestPlan } from './alert-digest.js';
import type { FilingAlertImmediateSend } from './alert-delivery-policy.js';

export type FilingAlertSenderPayload = {
  channel: string;
  target: string;
  message: string;
};

export type FilingAlertSenderBatch = {
  immediatePayloads: FilingAlertSenderPayload[];
  digestPayloads: FilingAlertSenderPayload[];
};

export function toSenderPayloadFromImmediate(
  immediate: FilingAlertImmediateSend,
  channel: string,
): FilingAlertSenderPayload {
  return {
    channel,
    target: immediate.target,
    message: immediate.message,
  };
}

export function toSenderPayloadFromDigest(
  digest: FilingAlertDigestPlan,
  channel: string,
): FilingAlertSenderPayload {
  return {
    channel,
    target: digest.target,
    message: digest.message,
  };
}

export function buildFilingAlertSenderBatch(
  params: {
    immediateSends: FilingAlertImmediateSend[];
    digests: FilingAlertDigestPlan[];
    channel: string;
  },
): FilingAlertSenderBatch {
  return {
    immediatePayloads: params.immediateSends.map((item) => toSenderPayloadFromImmediate(item, params.channel)),
    digestPayloads: params.digests.map((item) => toSenderPayloadFromDigest(item, params.channel)),
  };
}

export function discordFilingAlertChannel(): string {
  return 'discord';
}

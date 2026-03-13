import type { FilingAlertDedupeDecision, FilingAlertDeliveryRecord } from '../alert-dedupe.js';
import type { FilingAlertDispatchPlan } from '../alert-transport.js';

export class InMemoryFilingAlertStore {
  private readonly records = new Map<string, FilingAlertDeliveryRecord>();

  getLastRecord(workspaceId: string): FilingAlertDeliveryRecord | undefined {
    return this.records.get(workspaceId);
  }

  saveRecord(record: FilingAlertDeliveryRecord): void {
    this.records.set(record.workspaceId, record);
  }

  applySendDecision(
    workspaceId: string,
    dispatchPlan: FilingAlertDispatchPlan,
    dedupeDecision: FilingAlertDedupeDecision,
    nowMs: number,
  ): FilingAlertDeliveryRecord | undefined {
    if (!dedupeDecision.shouldSend) {
      return this.getLastRecord(workspaceId);
    }

    const record: FilingAlertDeliveryRecord = {
      workspaceId,
      fingerprint: dedupeDecision.fingerprint,
      sentAtMs: nowMs,
      severity: dispatchPlan.severity,
      route: dispatchPlan.route,
    };

    this.saveRecord(record);
    return record;
  }

  clear(workspaceId: string): void {
    this.records.delete(workspaceId);
  }
}

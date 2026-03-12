import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { FilingAlertDedupeDecision, FilingAlertDeliveryRecord } from './alert-dedupe.js';
import type { FilingAlertDispatchPlan } from './alert-transport.js';

export class FileBackedFilingAlertStore {
  constructor(private readonly filePath: string) {}

  async getLastRecord(workspaceId: string): Promise<FilingAlertDeliveryRecord | undefined> {
    const records = await this.readAll();
    return records[workspaceId];
  }

  async saveRecord(record: FilingAlertDeliveryRecord): Promise<void> {
    const records = await this.readAll();
    records[record.workspaceId] = record;
    await this.writeAll(records);
  }

  async applySendDecision(
    workspaceId: string,
    dispatchPlan: FilingAlertDispatchPlan,
    dedupeDecision: FilingAlertDedupeDecision,
    nowMs: number,
  ): Promise<FilingAlertDeliveryRecord | undefined> {
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

    await this.saveRecord(record);
    return record;
  }

  async clear(workspaceId: string): Promise<void> {
    const records = await this.readAll();
    delete records[workspaceId];
    await this.writeAll(records);
  }

  private async readAll(): Promise<Record<string, FilingAlertDeliveryRecord>> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      return JSON.parse(raw) as Record<string, FilingAlertDeliveryRecord>;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return {};
      }
      throw error;
    }
  }

  private async writeAll(records: Record<string, FilingAlertDeliveryRecord>): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(records, null, 2) + '\n', 'utf8');
  }
}

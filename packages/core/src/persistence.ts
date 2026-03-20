import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export interface SnapshotPersistenceAdapter<TSnapshot> {
  load(): TSnapshot | undefined;
  save(snapshot: TSnapshot): void;
}

export interface JsonFileSnapshotPersistenceAdapterOptions {
  path: string;
  jsonSpace?: number;
}

export class JsonFileSnapshotPersistenceAdapter<TSnapshot> implements SnapshotPersistenceAdapter<TSnapshot> {
  private readonly path: string;
  private readonly jsonSpace: number;

  constructor(options: JsonFileSnapshotPersistenceAdapterOptions) {
    this.path = options.path;
    this.jsonSpace = options.jsonSpace ?? 2;
  }

  load(): TSnapshot | undefined {
    try {
      const raw = readFileSync(this.path, 'utf8');
      return JSON.parse(raw) as TSnapshot;
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : undefined;
      if (code === 'ENOENT') return undefined;
      throw error;
    }
  }

  save(snapshot: TSnapshot): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tempPath = `${this.path}.tmp-${process.pid}`;
    try {
      writeFileSync(tempPath, `${JSON.stringify(snapshot, null, this.jsonSpace)}\n`, 'utf8');
      renameSync(tempPath, this.path);
    } catch (error) {
      try {
        rmSync(tempPath, { force: true });
      } catch {
        // best effort cleanup only
      }
      throw error;
    }
  }
}

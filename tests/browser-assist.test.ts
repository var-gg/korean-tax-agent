import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import {
  BrowserAssistSessionError,
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
  InMemoryBrowserHostExecutor,
  InMemoryOpenClawBrowserRelay,
  OpenClawBrowserHostError,
  OpenClawBrowserHostExecutor,
  OpenClawBrowserControlServerClient,
  OpenClawBrowserRuntimeCommandClient,
  OpenClawBrowserToolTransport,
  PersistentBrowserAssistSessionStore,
  handleOpenClawBrowserRuntimeCommand,
  RecordingBrowserRuntimeAdapter,
  SystemBrowserRuntimeAdapter,
  createBrowserAssistService,
  createBrowserAssistToolAdapter,
} from '../packages/browser-assist/src/index.js';
import { JsonFileSnapshotPersistenceAdapter } from '../packages/core/src/persistence.js';

function sequence<T>(values: T[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] as T;
}

function createSnapshotDerivedAriaRefProvenance(input: {
  snapshotContext: { artifact: { artifactId: string; version: string; capturedAt?: string } };
  inspection?: { source?: 'target' | 'snapshot' | 'runtime'; url?: string; normalizedUrl?: string; capturedAt?: string };
  evidence?: { title?: string; textSnippet?: string; description?: string };
}) {
  return {
    kind: 'snapshot-derived' as const,
    inspection: {
      source: input.inspection?.source ?? 'snapshot',
      url: input.inspection?.url,
      normalizedUrl: input.inspection?.normalizedUrl,
      capturedAt: input.inspection?.capturedAt,
    },
    snapshotContext: input.snapshotContext,
    derivation: {
      locatorKind: 'aria-ref' as const,
      basis: 'snapshot-ref' as const,
    },
    evidence: input.evidence,
  };
}

function createSnapshotDerivedAriaRefCandidate(input: {
  ref: string;
  label?: string;
  description?: string;
  snapshotContext: { artifact: { artifactId: string; version: string; capturedAt?: string } };
  inspection?: { source?: 'target' | 'snapshot' | 'runtime'; url?: string; normalizedUrl?: string; capturedAt?: string };
  evidence?: { title?: string; textSnippet?: string; description?: string };
}) {
  const description = input.description ?? input.evidence?.description ?? input.label ?? input.ref;
  const label = input.label ?? description;
  return {
    kind: 'snapshot-derived' as const,
    label,
    snapshotContext: input.snapshotContext,
    staleness: {
      status: 'current' as const,
      tiedToCurrentSnapshot: true,
      reason: 'matches_bound_snapshot' as const,
      candidateSnapshotContext: input.snapshotContext,
      currentSnapshotContext: input.snapshotContext,
      detail: 'Candidate is still tied to the currently bound snapshot artifact/version.',
    },
    guidance: {
      manualSelectionOnly: true as const,
      ranking: {
        ordinal: 1,
        sortKey: ['1', '6', label.toLocaleLowerCase('en-US'), input.ref.toLocaleLowerCase('en-US')].join('|'),
        criteria: ['label-kind', 'evidence-fields', 'label', 'ref'] as const,
      },
      signals: {
        labelKind: label.includes(':') ? 'role-name' as const : label.trim() === input.ref.trim() ? 'ref' as const : 'text' as const,
        evidenceFields: [input.evidence?.title ? 'title' : undefined, input.evidence?.textSnippet ? 'textSnippet' : undefined, (input.evidence?.description ?? description) ? 'description' : undefined].filter(Boolean) as Array<'title' | 'textSnippet' | 'description'>,
      },
      rationale: 'Manual choice metadata only.',
    },
    locator: {
      kind: 'aria-ref' as const,
      ref: input.ref,
      description,
      provenance: createSnapshotDerivedAriaRefProvenance({
        snapshotContext: input.snapshotContext,
        inspection: input.inspection,
        evidence: input.evidence ?? { description },
      }),
    },
  };
}

async function canSpawnNodeSubprocess(): Promise<boolean> {
  return await new Promise((resolve) => {
    try {
      const child = spawn(process.execPath, [
        '-e',
        "process.stdin.resume(); process.stdin.on('end', () => process.exit(0));",
      ], {
        windowsHide: true,
      });
      let settled = false;
      const finish = (value: boolean) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      child.once('error', () => finish(false));
      child.once('exit', (code) => finish(code === 0));
      child.stdin?.end('{}');
    } catch {
      resolve(false);
    }
  });
}

describe('browser assist', () => {
  it('starts, resumes, completes, and reports runtime state', async () => {
    const ids = sequence(['session-1', 'checkpoint-auth', 'checkpoint-review']);
    const now = sequence([
      '2026-03-16T00:00:00.000Z',
      '2026-03-16T00:00:01.000Z',
      '2026-03-16T00:00:02.000Z',
      '2026-03-16T00:00:03.000Z',
    ]);
    const runtime = new RecordingBrowserRuntimeAdapter({
      now: sequence([
        '2026-03-16T00:00:00.500Z',
        '2026-03-16T00:00:02.500Z',
        '2026-03-16T00:00:03.500Z',
      ]),
      transport: 'test-browser',
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      now,
      createId: ids,
    });
    const tools = createBrowserAssistToolAdapter(service);

    const started = await tools.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr',
      requestedBy: 'browser-assist-test',
      filingDraftId: 'draft-001',
      metadata: { taxYear: '2025' },
    });

    expect(started.session.schemaVersion).toBe(2);
    expect(started.session.status).toBe('waiting_for_user');
    expect(started.activeCheckpoint?.code).toBe('user-authentication');
    expect(started.session.runtimeState.currentTargetUrl).toBe('https://hometax.go.kr');
    expect(started.session.runtimeState.lastOpenedUrl).toBe('https://hometax.go.kr');
    expect(runtime.openedTargets).toHaveLength(1);

    const current = await tools.getHomeTaxAssistStatus({ sessionId: started.session.id });
    expect(current.session.events).toHaveLength(2);
    expect(current.activeCheckpoint?.id).toBe('checkpoint-auth');

    const afterAuth = await tools.resumeHomeTaxAssist({
      sessionId: started.session.id,
      note: 'User completed the HomeTax login flow.',
    });
    expect(afterAuth.session.status).toBe('waiting_for_user');
    expect(afterAuth.activeCheckpoint?.id).toBe('checkpoint-review');
    expect(afterAuth.session.runtimeState.activeCheckpointId).toBe('checkpoint-review');
    expect(runtime.handoffs).toHaveLength(1);
    expect(afterAuth.session.events[3]?.type).toBe('checkpoint-handed-off');

    const completed = await tools.resumeHomeTaxAssist({
      sessionId: started.session.id,
      checkpointId: 'checkpoint-review',
      note: 'Target filing page is open.',
    });
    expect(completed.session.status).toBe('completed');
    expect(completed.activeCheckpoint).toBeNull();
    expect(completed.session.runtimeState.activeCheckpointId).toBeNull();
    expect(runtime.handoffs).toHaveLength(2);
    expect(completed.session.events.at(-1)?.type).toBe('session-completed');
  });

  it('reloads persisted browser-assist sessions across store restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'browser-assist-store-'));
    const persistence = new JsonFileSnapshotPersistenceAdapter<any>({ path: join(dir, 'browser-assist-sessions.json') });
    const createService = () => createBrowserAssistService({
      store: new PersistentBrowserAssistSessionStore(persistence),
      runtime: new RecordingBrowserRuntimeAdapter({
        now: sequence(['2026-03-16T00:10:00.500Z', '2026-03-16T00:10:01.500Z']),
      }),
      now: sequence(['2026-03-16T00:10:00.000Z', '2026-03-16T00:10:01.000Z']),
      createId: sequence(['session-persist', 'checkpoint-auth-persist', 'checkpoint-review-persist']),
    });

    const service = createService();
    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/persist',
      requestedBy: 'persist-test',
      filingDraftId: 'draft-persist',
    });

    const restartedService = createService();
    const restored = await restartedService.getHomeTaxAssistStatus(started.session.id);
    expect(restored.session.id).toBe(started.session.id);
    expect(restored.session.filingDraftId).toBe('draft-persist');
    expect(restored.activeCheckpoint?.code).toBe('user-authentication');
  });

  it('blocks resume after stop', async () => {
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime: new RecordingBrowserRuntimeAdapter({
        now: sequence(['2026-03-16T01:00:00.000Z', '2026-03-16T01:00:01.500Z']),
      }),
      now: sequence(['2026-03-16T01:00:00.000Z', '2026-03-16T01:00:01.000Z']),
      createId: sequence(['session-stop', 'checkpoint-auth-stop', 'checkpoint-review-stop']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr',
      requestedBy: 'browser-assist-test',
    });

    const stopped = await service.stopHomeTaxAssist({
      sessionId: started.session.id,
      reason: 'user-cancelled',
      note: 'Waiting for updated draft data.',
    });

    expect(stopped.session.status).toBe('stopped');
    expect(stopped.activeCheckpoint).toBeNull();
    expect(stopped.session.runtimeState.activeCheckpointId).toBeNull();

    await expect(service.resumeHomeTaxAssist({ sessionId: started.session.id })).rejects.toMatchObject<Partial<BrowserAssistSessionError>>({
      code: 'SESSION_STOPPED',
    });
  });

  it('supports a minimum system-browser bridge with injected launcher', async () => {
    const launches: Array<{ targetUrl: string; sessionId: string }> = [];
    const runtime = new SystemBrowserRuntimeAdapter({
      now: sequence(['2026-03-16T02:00:00.500Z', '2026-03-16T02:00:01.500Z']),
      transport: 'system-browser-bridge',
      runtimeTargetPrefix: 'system-target',
      launcher: async (targetUrl, context) => {
        launches.push({ targetUrl, sessionId: context.sessionId });
      },
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      now: sequence(['2026-03-16T02:00:00.000Z', '2026-03-16T02:00:01.000Z']),
      createId: sequence(['session-system', 'checkpoint-auth-system', 'checkpoint-review-system']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/entry',
      requestedBy: 'system-runtime-test',
    });

    expect(launches).toHaveLength(1);
    expect(launches[0]).toEqual({
      targetUrl: 'https://hometax.go.kr/entry',
      sessionId: 'session-system',
    });
    expect(started.session.openReceipt.transport).toBe('system-browser-bridge');
    expect(started.session.openReceipt.runtimeTargetId).toBe('system-target:session-system');

    const afterAuth = await service.resumeHomeTaxAssist({
      sessionId: started.session.id,
      checkpointId: 'checkpoint-auth-system',
    });

    expect(afterAuth.session.runtimeState.runtimeTargetId).toBe('system-target:session-system');
    expect(afterAuth.session.runtimeState.activeCheckpointId).toBe('checkpoint-review-system');
  });

  it('supports a browser-host runtime adapter through an injected client', async () => {
    const clientCalls: Array<{ method: string; sessionId: string; runtimeTargetId?: string | undefined }> = [];
    const runtime = new BrowserHostRuntimeAdapter({
      now: sequence(['2026-03-16T03:00:00.500Z', '2026-03-16T03:00:01.500Z', '2026-03-16T03:00:02.500Z']),
      client: {
        async openTarget(input: any) {
          clientCalls.push({ method: 'openTarget', sessionId: input.sessionId });
          return {
            runtimeTargetId: `browser-target:${input.sessionId}`,
            transport: 'browser-host',
            currentTargetUrl: `${input.target.entryUrl}/login`,
          };
        },
        async getRuntimeState(input: any) {
          clientCalls.push({
            method: 'getRuntimeState',
            sessionId: input.sessionId,
            runtimeTargetId: input.runtimeState?.runtimeTargetId,
          });
          return {
            runtimeTargetId: input.runtimeState?.runtimeTargetId,
            currentTargetUrl: `${input.target.entryUrl}/ready`,
            lastOpenedUrl: input.runtimeState?.lastOpenedUrl ?? input.target.entryUrl,
          };
        },
        async handoffCheckpoint(input) {
          clientCalls.push({
            method: 'handoffCheckpoint',
            sessionId: input.sessionId,
            runtimeTargetId: input.runtimeState?.runtimeTargetId,
          });
          return {
            runtimeTargetId: input.runtimeState?.runtimeTargetId,
            currentTargetUrl: input.targetUrl,
            lastOpenedUrl: input.runtimeState?.lastOpenedUrl ?? input.target.entryUrl,
            activeCheckpointId: input.nextCheckpoint ? input.nextCheckpoint.id : null,
            updatedAt: input.handedOffAt,
          };
        },
      },
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      now: sequence(['2026-03-16T03:00:00.000Z', '2026-03-16T03:00:01.000Z']),
      createId: sequence(['session-browser-host', 'checkpoint-auth-browser-host', 'checkpoint-review-browser-host']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr',
      requestedBy: 'browser-host-runtime-test',
    });
    expect(started.session.openReceipt.runtimeTargetId).toBe('browser-target:session-browser-host');
    expect(started.session.runtimeState.currentTargetUrl).toBe('https://hometax.go.kr/login');

    const current = await service.getHomeTaxAssistStatus(started.session.id);
    expect(current.session.runtimeState.currentTargetUrl).toBe('https://hometax.go.kr/ready');

    const afterAuth = await service.resumeHomeTaxAssist({
      sessionId: started.session.id,
      checkpointId: 'checkpoint-auth-browser-host',
    });
    expect(afterAuth.session.runtimeState.runtimeTargetId).toBe('browser-target:session-browser-host');
    expect(afterAuth.session.runtimeState.activeCheckpointId).toBe('checkpoint-review-browser-host');
    expect(clientCalls.map((call) => call.method)).toEqual(['openTarget', 'getRuntimeState', 'handoffCheckpoint']);
  });

  it('falls back to cached browser-host runtime state when the client only supports openTarget', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      now: sequence(['2026-03-16T04:00:00.500Z', '2026-03-16T04:00:01.500Z']),
      client: {
        async openTarget(input: any) {
          return {
            runtimeTargetId: `browser-target:${input.sessionId}`,
            currentTargetUrl: input.target.entryUrl,
          };
        },
      },
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      now: sequence(['2026-03-16T04:00:00.000Z', '2026-03-16T04:00:01.000Z']),
      createId: sequence(['session-browser-host-fallback', 'checkpoint-auth-fallback', 'checkpoint-review-fallback']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr',
      requestedBy: 'browser-host-runtime-fallback-test',
    });
    const current = await service.getHomeTaxAssistStatus(started.session.id);
    const afterAuth = await service.resumeHomeTaxAssist({
      sessionId: started.session.id,
      checkpointId: 'checkpoint-auth-fallback',
    });

    expect(current.session.runtimeState.runtimeTargetId).toBe('browser-target:session-browser-host-fallback');
    expect(afterAuth.session.runtimeState.activeCheckpointId).toBe('checkpoint-review-fallback');
    expect(afterAuth.session.runtimeState.transport).toBe('browser-host');
  });

  it('supports an executor-backed browser-host runtime path in-repo', async () => {
    const executor = new InMemoryBrowserHostExecutor({
      now: sequence(['2026-03-16T05:00:00.500Z', '2026-03-16T05:00:01.500Z']),
      transport: 'browser-host',
      runtimeTargetPrefix: 'browser-target',
    });
    const runtime = new BrowserHostRuntimeAdapter({ executor });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      now: sequence(['2026-03-16T05:00:00.000Z', '2026-03-16T05:00:01.000Z']),
      createId: sequence(['session-browser-host-executor', 'checkpoint-auth-executor', 'checkpoint-review-executor']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/browser-host-smoke',
      requestedBy: 'browser-host-executor-test',
    });
    const current = await service.getHomeTaxAssistStatus(started.session.id);
    const afterAuth = await service.resumeHomeTaxAssist({
      sessionId: started.session.id,
      checkpointId: 'checkpoint-auth-executor',
    });

    expect(started.session.openReceipt.runtimeTargetId).toBe('browser-target:session-browser-host-executor');
    expect(current.session.runtimeState.runtimeTargetId).toBe('browser-target:session-browser-host-executor');
    expect(afterAuth.activeCheckpoint?.id).toBe('checkpoint-review-executor');
    expect(executor.executions.map((execution) => execution.method)).toEqual([
      'openTarget',
      'getRuntimeState',
      'handoffCheckpoint',
    ]);
  });

  it('supports an OpenClaw executor behind the generic browser-host runtime adapter', async () => {
    const relay = new InMemoryOpenClawBrowserRelay({
      now: sequence([
        '2026-03-16T06:00:00.250Z',
        '2026-03-16T06:00:01.250Z',
        '2026-03-16T06:00:02.250Z',
      ]),
      targetPrefix: 'openclaw-tab',
    });
    const executor = new OpenClawBrowserHostExecutor({
      relay,
      now: sequence([
        '2026-03-16T06:00:00.500Z',
        '2026-03-16T06:00:01.500Z',
        '2026-03-16T06:00:02.500Z',
      ]),
      transportLabel: 'openclaw-browser-tool',
    });
    const runtime = new BrowserHostRuntimeAdapter({ executor });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      now: sequence(['2026-03-16T06:00:00.000Z', '2026-03-16T06:00:01.000Z']),
      createId: sequence(['session-openclaw', 'checkpoint-auth-openclaw', 'checkpoint-review-openclaw']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw',
      requestedBy: 'openclaw-runtime-test',
    });
    const runtimeTargetId = started.session.runtimeState.runtimeTargetId as string;
    relay.setTargetState(runtimeTargetId, {
      url: 'https://hometax.go.kr/openclaw/ready',
    });

    const current = await service.getHomeTaxAssistStatus(started.session.id);
    const afterAuth = await service.resumeHomeTaxAssist({
      sessionId: started.session.id,
      checkpointId: 'checkpoint-auth-openclaw',
    });

    expect(started.session.openReceipt.transport).toBe('openclaw-browser-tool');
    expect(started.session.openReceipt.runtimeTargetId).toBe('openclaw-tab:session-openclaw');
    expect(current.session.runtimeState.currentTargetUrl).toBe('https://hometax.go.kr/openclaw/ready');
    expect(afterAuth.session.runtimeState.runtimeTargetId).toBe('openclaw-tab:session-openclaw');
    expect(afterAuth.session.runtimeState.activeCheckpointId).toBe('checkpoint-review-openclaw');
    expect(executor.executions.map((execution) => execution.method)).toEqual([
      'openTarget',
      'getRuntimeState',
      'handoffCheckpoint',
    ]);
    expect(relay.operations.map((operation) => operation.method)).toEqual([
      'getCapabilities',
      'attach',
      'open',
      'getCapabilities',
      'getTarget',
      'getCapabilities',
      'getTarget',
      'getCapabilities',
      'handoffCheckpoint',
    ]);
  });

  it('supports an external-runtime OpenClaw browser transport behind the executor', async () => {
    const clientCalls: string[] = [];
    const transport = new OpenClawBrowserToolTransport({
      client: {
        async getCapabilities() {
          clientCalls.push('getCapabilities');
          return {
            hostAvailable: true,
            activeTarget: null,
            runtimeInspection: true,
            checkpointHandoff: true,
          };
        },
        async listTargets() {
          clientCalls.push('listTargets');
          return [
            {
              targetId: 'openclaw-tab:session-openclaw-live',
              url: 'https://hometax.go.kr/openclaw/live/ready',
              attached: true,
              available: true,
              sessionId: 'session-openclaw-live',
            },
          ];
        },
        async openTarget(input: any) {
          clientCalls.push(`openTarget:${input.url}`);
          return {
            targetId: 'openclaw-tab:session-openclaw-live',
            url: input.url,
            sessionId: input.sessionId,
          };
        },
        async getTarget(input) {
          clientCalls.push(`getTarget:${input.targetId}`);
          return {
            targetId: input.targetId,
            url: 'https://hometax.go.kr/openclaw/live/ready',
            attached: true,
            available: true,
            sessionId: 'session-openclaw-live',
          };
        },
        async handoffCheckpoint(input) {
          clientCalls.push(`handoffCheckpoint:${input.targetId}`);
          return {
            targetId: input.targetId,
            url: input.targetUrl,
            attached: true,
            available: true,
            sessionId: input.sessionId,
          };
        },
      },
    });
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        transport,
        transportLabel: 'openclaw-browser-tool-live',
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-live', 'checkpoint-auth-openclaw-live', 'checkpoint-review-openclaw-live']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/live',
      requestedBy: 'openclaw-runtime-test',
    });
    const status = await service.getHomeTaxAssistStatus(started.session.id);
    const afterAuth = await service.resumeHomeTaxAssist({
      sessionId: started.session.id,
      checkpointId: 'checkpoint-auth-openclaw-live',
    });

    expect(started.session.openReceipt.transport).toBe('openclaw-browser-tool-live');
    expect(status.session.runtimeState.currentTargetUrl).toBe('https://hometax.go.kr/openclaw/live/ready');
    expect(afterAuth.session.runtimeState.runtimeTargetId).toBe('openclaw-tab:session-openclaw-live');
    expect(clientCalls).toContain('getCapabilities');
    expect(clientCalls).toContain('listTargets');
    expect(clientCalls).toContain('getTarget:openclaw-tab:session-openclaw-live');
    expect(clientCalls).toContain('handoffCheckpoint:openclaw-tab:session-openclaw-live');
    expect(clientCalls.some((call) => call === 'openTarget:https://hometax.go.kr/openclaw/live')).toBe(false);
  });

  it('runs the command-backed OpenClaw runtime client protocol', async () => {
    if (!(await canSpawnNodeSubprocess())) {
      return;
    }

    const client = new OpenClawBrowserRuntimeCommandClient({
      command: process.execPath,
      args: [
        '-e',
        `const fs = require('fs');
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
if (input.operation === 'listTargets') {
  process.stdout.write(JSON.stringify({ ok: true, result: [{ targetId: 'openclaw-tab:cmd', sessionId: 'session-cmd', url: 'https://hometax.go.kr/cmd', attached: true, available: true }] }));
} else if (input.operation === 'handoffCheckpoint') {
  process.stdout.write(JSON.stringify({ ok: true, result: { targetId: input.input.targetId, sessionId: input.input.sessionId, url: input.input.targetUrl, attached: true, available: true } }));
} else {
  process.stdout.write(JSON.stringify({ ok: true, result: { hostAvailable: true, runtimeInspection: true, checkpointHandoff: true } }));
}`,
      ],
    });

    await expect(client.listTargets({ sessionId: 'session-cmd' })).resolves.toEqual([
      expect.objectContaining({ targetId: 'openclaw-tab:cmd' }),
    ]);
    await expect(client.handoffCheckpoint({
      sessionId: 'session-cmd',
      targetId: 'openclaw-tab:cmd',
      targetUrl: 'https://hometax.go.kr/cmd/ready',
      handedOffAt: '2026-03-16T00:00:00.000Z',
    })).resolves.toEqual(expect.objectContaining({ url: 'https://hometax.go.kr/cmd/ready' }));
  });

  it('maps runtime command requests to the thin bridge handler', async () => {
    await expect(handleOpenClawBrowserRuntimeCommand({
      operation: 'openTarget',
      input: {
        sessionId: 'session-handler',
        url: 'https://hometax.go.kr/handler',
        label: 'HomeTax',
      },
    }, {
      client: {
        listTargets: async () => [],
        openTarget: async (input) => ({ targetId: 'target-handler', sessionId: input.sessionId, url: input.url, attached: true, available: true }),
      },
    })).resolves.toEqual({
      ok: true,
      result: expect.objectContaining({ targetId: 'target-handler', sessionId: 'session-handler' }),
    });

    await expect(handleOpenClawBrowserRuntimeCommand({
      operation: 'handoffCheckpoint',
      input: {
        sessionId: 'session-handler',
        targetId: 'target-handler',
        targetUrl: 'https://hometax.go.kr/handler/ready',
        handedOffAt: '2026-03-16T00:00:00.000Z',
      },
    }, {
      client: {
        listTargets: async () => [],
        openTarget: async () => ({ targetId: 'unused' }),
      },
    })).resolves.toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED' }),
    });
  });

  it('maps OpenClaw browser control server actions through the live bridge client', async () => {
    const calls: Array<{ action: string; body: any }> = [];
    const client = new OpenClawBrowserControlServerClient({
      baseUrl: 'http://openclaw.test',
      profile: 'chrome',
      fetchImpl: async (url, init) => {
        const body = JSON.parse(String(init?.body || '{}'));
        calls.push({ action: body.action, body });
        const payload = body.action === 'status'
          ? { running: true }
          : body.action === 'tabs'
            ? [{ id: 'target-live', url: 'https://hometax.go.kr/live/ready', title: 'Live tab', active: true }]
            : body.action === 'open'
              ? { id: 'target-live', url: body.url, title: 'Opened live tab' }
              : {};
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });

    await expect(client.getCapabilities({ runtimeTargetId: 'target-live' })).resolves.toMatchObject({
      hostAvailable: true,
      activeTarget: true,
      runtimeInspection: true,
      snapshotInspection: true,
      checkpointHandoff: true,
      domActions: true,
      supportedLocatorKinds: ['aria-ref'],
    });
    await expect(client.openTarget({
      sessionId: 'session-live',
      url: 'https://hometax.go.kr/live',
      label: 'HomeTax',
    })).resolves.toEqual(expect.objectContaining({ targetId: 'target-live', url: 'https://hometax.go.kr/live' }));
    await expect(client.handoffCheckpoint({
      sessionId: 'session-live',
      targetId: 'target-live',
      targetUrl: 'https://hometax.go.kr/live/ready',
      handedOffAt: '2026-03-16T00:00:00.000Z',
    })).resolves.toEqual(expect.objectContaining({ targetId: 'target-live' }));
    expect(calls.map((call) => call.action)).toEqual(['status', 'tabs', 'open', 'tabs']);
    expect(calls[2]?.body).toMatchObject({ action: 'open', profile: 'chrome', url: 'https://hometax.go.kr/live' });
  });

  it('extracts typed snapshot-derived aria-ref candidates from the OpenClaw live bridge snapshot response', async () => {
    const calls: Array<{ action: string; body: any }> = [];
    const client = new OpenClawBrowserControlServerClient({
      baseUrl: 'http://openclaw.test',
      profile: 'chrome',
      fetchImpl: async (_url, init) => {
        const body = JSON.parse(String(init?.body || '{}'));
        calls.push({ action: body.action, body });
        const payload = body.action === 'snapshot'
          ? {
              snapshotId: 'snapshot:live-candidate',
              snapshotVersion: 'v3',
              url: 'https://hometax.go.kr/live/candidate',
              title: 'Candidate Ready',
              capturedAt: '2026-03-16T04:30:00.000Z',
              nodes: [
                { ref: 'aria-submit-7', role: 'button', name: '신고서 제출', text: '신고서 제출' },
                { ref: 'aria-cancel-2', role: 'button', name: '취소', text: '취소' },
              ],
            }
          : {};
        return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
      },
    });

    const target = await client.snapshotTarget({ targetId: 'target-live' });

    expect(target).toEqual(expect.objectContaining({
      targetId: 'target-live',
      inspection: expect.objectContaining({
        source: 'snapshot',
        snapshotContext: {
          artifact: {
            artifactId: 'snapshot:live-candidate',
            version: 'v3',
            capturedAt: '2026-03-16T04:30:00.000Z',
          },
        },
        locatorCandidates: [
          expect.objectContaining({
            kind: 'snapshot-derived',
            label: 'button: 신고서 제출',
            locator: expect.objectContaining({
              kind: 'aria-ref',
              ref: 'aria-submit-7',
              provenance: expect.objectContaining({
                kind: 'snapshot-derived',
                derivation: { locatorKind: 'aria-ref', basis: 'snapshot-ref' },
                evidence: expect.objectContaining({ description: '신고서 제출' }),
              }),
            }),
            guidance: expect.objectContaining({
              manualSelectionOnly: true,
              ranking: expect.objectContaining({ ordinal: 1, criteria: ['label-kind', 'evidence-fields', 'label', 'ref'] }),
              signals: expect.objectContaining({ labelKind: 'role-name', evidenceFields: ['title', 'textSnippet', 'description'] }),
            }),
            staleness: expect.objectContaining({
              status: 'current',
              tiedToCurrentSnapshot: true,
              reason: 'matches_bound_snapshot',
            }),
          }),
          expect.objectContaining({
            kind: 'snapshot-derived',
            label: 'button: 취소',
            locator: expect.objectContaining({ kind: 'aria-ref', ref: 'aria-cancel-2' }),
          }),
        ],
      }),
    }));
    expect(calls.map((call) => call.action)).toEqual(['snapshot']);
    expect(calls[0]?.body).toMatchObject({ action: 'snapshot', refs: 'aria', targetId: 'target-live' });
  });

  it('surfaces relay unavailability during OpenClaw openTarget', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        relay: {
          async open() {
            throw new Error('relay offline');
          },
        },
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-relay-error', 'checkpoint-auth-openclaw-relay-error', 'checkpoint-review-openclaw-relay-error']),
    });

    await expect(service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/error',
      requestedBy: 'openclaw-runtime-test',
    })).rejects.toMatchObject<Partial<OpenClawBrowserHostError>>({
      code: 'OPENCLAW_RELAY_UNAVAILABLE',
      operation: 'openTarget',
    });
  });

  it('surfaces unavailable OpenClaw targets during checkpoint handoff', async () => {
    const relay = new InMemoryOpenClawBrowserRelay({
      targetPrefix: 'openclaw-tab',
    });
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({ relay }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-unavailable', 'checkpoint-auth-openclaw-unavailable', 'checkpoint-review-openclaw-unavailable']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/unavailable',
      requestedBy: 'openclaw-runtime-test',
    });
    relay.setTargetState(started.session.runtimeState.runtimeTargetId as string, {
      attached: false,
    });

    await expect(service.resumeHomeTaxAssist({
      sessionId: started.session.id,
      checkpointId: 'checkpoint-auth-openclaw-unavailable',
    })).rejects.toMatchObject<Partial<OpenClawBrowserHostError>>({
      code: 'OPENCLAW_TARGET_UNAVAILABLE',
      operation: 'handoffCheckpoint',
    });
  });

  it('surfaces missing OpenClaw targets during runtime state refresh', async () => {
    const relay = new InMemoryOpenClawBrowserRelay({
      targetPrefix: 'openclaw-tab',
    });
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({ relay }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-missing', 'checkpoint-auth-openclaw-missing', 'checkpoint-review-openclaw-missing']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/missing',
      requestedBy: 'openclaw-runtime-test',
    });
    relay.dropTarget(started.session.runtimeState.runtimeTargetId as string);

    await expect(service.getHomeTaxAssistStatus(started.session.id)).rejects.toMatchObject<Partial<OpenClawBrowserHostError>>({
      code: 'OPENCLAW_TARGET_NOT_FOUND',
      operation: 'getRuntimeState',
    });
  });

  it('surfaces OpenClaw session mismatches during runtime state refresh', async () => {
    const relay = new InMemoryOpenClawBrowserRelay({
      targetPrefix: 'openclaw-tab',
    });
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({ relay }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-mismatch', 'checkpoint-auth-openclaw-mismatch', 'checkpoint-review-openclaw-mismatch']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/mismatch',
      requestedBy: 'openclaw-runtime-test',
    });
    relay.setTargetState(started.session.runtimeState.runtimeTargetId as string, {
      sessionId: 'other-session',
    });

    await expect(service.getHomeTaxAssistStatus(started.session.id)).rejects.toMatchObject<Partial<OpenClawBrowserHostError>>({
      code: 'OPENCLAW_SESSION_MISMATCH',
      operation: 'getRuntimeState',
    });
  });

  it('re-resolves a stale OpenClaw target id to a single session-matching replacement', async () => {
    const relay = new InMemoryOpenClawBrowserRelay({
      targetPrefix: 'openclaw-tab',
    });
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({ relay }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-reresolve', 'checkpoint-auth-openclaw-reresolve', 'checkpoint-review-openclaw-reresolve']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/reresolve',
      requestedBy: 'openclaw-runtime-test',
    });
    const staleTargetId = started.session.runtimeState.runtimeTargetId as string;
    relay.dropTarget(staleTargetId);
    relay.addTarget({
      targetId: 'openclaw-tab:session-openclaw-reresolve:2',
      sessionId: started.session.id,
      url: 'https://hometax.go.kr/openclaw/reresolve/ready',
      available: true,
      attached: true,
      title: 'Ready tab',
    });

    const status = await service.getHomeTaxAssistStatus(started.session.id);
    expect(status.session.runtimeState.runtimeTargetId).toBe('openclaw-tab:session-openclaw-reresolve:2');
    expect(status.session.runtimeState.currentTargetUrl).toBe('https://hometax.go.kr/openclaw/reresolve/ready');
  });

  it('fails explicitly when OpenClaw reconnect candidates remain ambiguous', async () => {
    const relay = new InMemoryOpenClawBrowserRelay({
      targetPrefix: 'openclaw-tab',
    });
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({ relay }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-ambiguous', 'checkpoint-auth-openclaw-ambiguous', 'checkpoint-review-openclaw-ambiguous']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/ambiguous',
      requestedBy: 'openclaw-runtime-test',
    });
    relay.dropTarget(started.session.runtimeState.runtimeTargetId as string);
    relay.addTarget({
      targetId: 'openclaw-tab:session-openclaw-ambiguous:2',
      sessionId: started.session.id,
      url: 'https://hometax.go.kr/openclaw/ambiguous/step',
      available: true,
      attached: true,
    });
    relay.addTarget({
      targetId: 'openclaw-tab:session-openclaw-ambiguous:3',
      sessionId: started.session.id,
      url: 'https://hometax.go.kr/openclaw/ambiguous/step-2',
      available: true,
      attached: true,
    });

    await expect(service.getHomeTaxAssistStatus(started.session.id)).rejects.toMatchObject<Partial<OpenClawBrowserHostError>>({
      code: 'OPENCLAW_TARGET_AMBIGUOUS',
      operation: 'getRuntimeState',
    });
  });

  it('adds snapshot-backed inspection when the OpenClaw path supports it', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        transport: new OpenClawBrowserToolTransport({
          client: {
            async getCapabilities() {
              return { hostAvailable: true, activeTarget: null, runtimeInspection: true, snapshotInspection: true, checkpointHandoff: true };
            },
            async listTargets() {
              return [];
            },
            async openTarget(input: any) {
              return { targetId: `openclaw-tab:${input.sessionId}`, sessionId: input.sessionId, url: input.url, attached: true, available: true };
            },
            async getTarget(input) {
              return { targetId: input.targetId, sessionId: 'session-openclaw-snapshot', url: 'https://hometax.go.kr/openclaw/snapshot/ready', attached: true, available: true };
            },
            async snapshotTarget(input) {
              const snapshotContext = {
                artifact: {
                  artifactId: 'snapshot:openclaw-tab:session-openclaw-snapshot',
                  version: 'snapshot-v1',
                  capturedAt: '2026-03-16T00:00:05.000Z',
                },
              };
              return {
                targetId: input.targetId,
                sessionId: 'session-openclaw-snapshot',
                url: 'https://hometax.go.kr/openclaw/snapshot/ready',
                title: 'Snapshot Ready',
                attached: true,
                available: true,
                inspection: {
                  source: 'snapshot',
                  title: 'Snapshot Ready',
                  url: 'https://hometax.go.kr/openclaw/snapshot/ready',
                  normalizedUrl: 'https://hometax.go.kr/openclaw/snapshot/ready',
                  textSnippet: '납세 신고서 제출 화면',
                  capturedAt: '2026-03-16T00:00:05.000Z',
                  snapshotContext,
                  locatorCandidates: [
                    createSnapshotDerivedAriaRefCandidate({
                      ref: 'aria-submit-1',
                      label: 'button: 신고서 제출',
                      description: '신고서 제출 버튼',
                      snapshotContext,
                      inspection: {
                        source: 'snapshot',
                        url: 'https://hometax.go.kr/openclaw/snapshot/ready',
                        normalizedUrl: 'https://hometax.go.kr/openclaw/snapshot/ready',
                        capturedAt: '2026-03-16T00:00:05.000Z',
                      },
                      evidence: {
                        title: 'button: 신고서 제출',
                        textSnippet: '납세 신고서 제출 화면',
                        description: '신고서 제출 버튼',
                      },
                    }),
                  ],
                },
              };
            },
            async handoffCheckpoint(input) {
              return { targetId: input.targetId, sessionId: input.sessionId, url: input.targetUrl, attached: true, available: true };
            },
          },
        }),
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-snapshot', 'checkpoint-auth-openclaw-snapshot', 'checkpoint-review-openclaw-snapshot']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/snapshot',
      requestedBy: 'openclaw-runtime-test',
    });
    const status = await service.getHomeTaxAssistStatus(started.session.id);
    expect(status.session.runtimeState.inspection?.title).toBe('Snapshot Ready');
    expect(status.session.runtimeState.inspection?.source).toBe('snapshot');
    expect(status.session.runtimeState.inspection?.textSnippet).toContain('납세 신고서 제출');
    expect(status.session.runtimeState.inspection?.locatorCandidates).toEqual([
      expect.objectContaining({
        kind: 'snapshot-derived',
        label: 'button: 신고서 제출',
        locator: expect.objectContaining({
          kind: 'aria-ref',
          ref: 'aria-submit-1',
          provenance: expect.objectContaining({
            kind: 'snapshot-derived',
            derivation: { locatorKind: 'aria-ref', basis: 'snapshot-ref' },
            evidence: expect.objectContaining({ description: '신고서 제출 버튼' }),
          }),
        }),
      }),
    ]);
    expect(status.session.runtimeState.snapshotContext).toEqual({
      artifact: {
        artifactId: 'snapshot:openclaw-tab:session-openclaw-snapshot',
        version: 'snapshot-v1',
        capturedAt: '2026-03-16T00:00:05.000Z',
      },
    });
  });

  it('surfaces unsupported OpenClaw runtime inspection explicitly', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        relay: {
          async open(input) {
            return {
              targetId: `openclaw-tab:${input.sessionId}`,
              sessionId: input.sessionId,
              url: input.url,
            };
          },
        },
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-unsupported', 'checkpoint-auth-openclaw-unsupported', 'checkpoint-review-openclaw-unsupported']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/unsupported',
      requestedBy: 'openclaw-runtime-test',
    });

    await expect(service.getHomeTaxAssistStatus(started.session.id)).rejects.toMatchObject<Partial<OpenClawBrowserHostError>>({
      code: 'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED',
      operation: 'getRuntimeState',
    });
  });

  it('derives deterministic candidate guidance metadata without auto-selecting a locator', async () => {
    const snapshotContext = {
      artifact: {
        artifactId: 'snapshot:guidance',
        version: 'v1',
        capturedAt: '2026-03-16T09:00:00.000Z',
      },
    };
    const runtime = new BrowserHostRuntimeAdapter({
      client: {
        async openTarget(input: any) {
          return {
            transport: 'browser-host',
            runtimeTargetId: `browser-target:${input.sessionId}`,
            targetUrl: input.target.entryUrl,
            currentTargetUrl: input.target.entryUrl,
            lastOpenedUrl: input.target.entryUrl,
            snapshotContext,
            activeCheckpointId: input.activeCheckpoint.id,
            inspection: {
              source: 'snapshot',
              url: input.target.entryUrl,
              normalizedUrl: input.target.entryUrl,
              capturedAt: '2026-03-16T09:00:00.000Z',
              snapshotContext,
              locatorCandidates: [
                createSnapshotDerivedAriaRefCandidate({
                  ref: 'z-ref',
                  label: 'z-ref',
                  snapshotContext,
                  inspection: { source: 'snapshot', url: input.target.entryUrl, normalizedUrl: input.target.entryUrl, capturedAt: '2026-03-16T09:00:00.000Z' },
                  evidence: {},
                }),
                createSnapshotDerivedAriaRefCandidate({
                  ref: 'a-submit',
                  label: 'button: 제출',
                  description: '제출 버튼',
                  snapshotContext,
                  inspection: { source: 'snapshot', url: input.target.entryUrl, normalizedUrl: input.target.entryUrl, capturedAt: '2026-03-16T09:00:00.000Z' },
                  evidence: { title: '제출', textSnippet: '제출', description: '제출 버튼' },
                }),
              ],
            },
          };
        },
      },
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-guidance', 'checkpoint-auth-guidance', 'checkpoint-review-guidance']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/guidance',
      requestedBy: 'guidance-test',
    });
    const candidates = started.session.runtimeState.inspection?.locatorCandidates ?? [];

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.locator.ref).toBe('z-ref');
    expect(candidates[0]?.guidance.manualSelectionOnly).toBe(true);
    expect(candidates[0]?.guidance.ranking.ordinal).toBe(2);
    expect(candidates[1]?.guidance.ranking.ordinal).toBe(1);
    expect(candidates[1]?.guidance.signals.labelKind).toBe('role-name');
    expect(candidates[1]?.guidance.ranking.sortKey < candidates[0]?.guidance.ranking.sortKey).toBe(true);
  });

  it('propagates coherent snapshot-derived inspection locator candidates through generic runtime state normalization', async () => {
    const snapshotContext = {
      artifact: {
        artifactId: 'snapshot:generic-candidate',
        version: 'snapshot-v1',
        capturedAt: '2026-03-16T03:15:00.000Z',
      },
    };
    const runtime = new BrowserHostRuntimeAdapter({
      client: {
        async openTarget(input: any) {
          return {
            transport: 'browser-host',
            runtimeTargetId: `browser-target:${input.sessionId}`,
            targetUrl: input.target.entryUrl,
            currentTargetUrl: input.target.entryUrl,
            lastOpenedUrl: input.target.entryUrl,
            snapshotContext,
            activeCheckpointId: input.activeCheckpoint.id,
            inspection: {
              source: 'snapshot',
              title: 'Generic Snapshot Ready',
              url: input.target.entryUrl,
              normalizedUrl: input.target.entryUrl,
              textSnippet: '납부 버튼',
              capturedAt: '2026-03-16T03:15:00.000Z',
              snapshotContext,
              locatorCandidates: [
                createSnapshotDerivedAriaRefCandidate({
                  ref: 'aria-pay-1',
                  label: 'button: 납부',
                  description: '납부 버튼',
                  snapshotContext,
                  inspection: {
                    source: 'snapshot',
                    url: input.target.entryUrl,
                    normalizedUrl: input.target.entryUrl,
                    capturedAt: '2026-03-16T03:15:00.000Z',
                  },
                }),
              ],
            },
          };
        },
      },
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-generic-candidate', 'checkpoint-auth-generic-candidate', 'checkpoint-review-generic-candidate']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/generic/candidate',
      requestedBy: 'browser-assist-test',
    });

    expect(started.session.runtimeState.inspection?.locatorCandidates).toEqual([
      expect.objectContaining({
        kind: 'snapshot-derived',
        label: 'button: 납부',
        snapshotContext,
        locator: expect.objectContaining({
          kind: 'aria-ref',
          ref: 'aria-pay-1',
          provenance: expect.objectContaining({
            inspection: expect.objectContaining({
              source: 'snapshot',
              normalizedUrl: 'https://hometax.go.kr/generic/candidate',
            }),
            snapshotContext,
          }),
        }),
      }),
    ]);
  });

  it('retains snapshot-derived inspection locator candidates as stale when only the bound snapshot version turns over', async () => {
    const inspectionSnapshotContext = {
      artifact: {
        artifactId: 'snapshot:generic-candidate-mismatch',
        version: 'snapshot-v1',
        capturedAt: '2026-03-16T03:25:00.000Z',
      },
    };
    const runtime = new BrowserHostRuntimeAdapter({
      client: {
        async openTarget(input: any) {
          return {
            transport: 'browser-host',
            runtimeTargetId: `browser-target:${input.sessionId}`,
            targetUrl: input.target.entryUrl,
            currentTargetUrl: input.target.entryUrl,
            lastOpenedUrl: input.target.entryUrl,
            snapshotContext: inspectionSnapshotContext,
            activeCheckpointId: input.activeCheckpoint.id,
            inspection: {
              source: 'snapshot',
              title: 'Mismatched Snapshot Ready',
              url: input.target.entryUrl,
              normalizedUrl: input.target.entryUrl,
              textSnippet: '오래된 버튼',
              capturedAt: '2026-03-16T03:25:00.000Z',
              snapshotContext: inspectionSnapshotContext,
              locatorCandidates: [
                createSnapshotDerivedAriaRefCandidate({
                  ref: 'aria-old-1',
                  label: 'button: 오래된 버튼',
                  description: '오래된 버튼',
                  snapshotContext: {
                    artifact: {
                      artifactId: 'snapshot:generic-candidate-mismatch',
                      version: 'snapshot-v0',
                      capturedAt: '2026-03-16T03:24:59.000Z',
                    },
                  },
                  inspection: {
                    source: 'snapshot',
                    url: input.target.entryUrl,
                    normalizedUrl: input.target.entryUrl,
                    capturedAt: '2026-03-16T03:25:00.000Z',
                  },
                }),
              ],
            },
          };
        },
      },
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-generic-candidate-mismatch', 'checkpoint-auth-generic-candidate-mismatch', 'checkpoint-review-generic-candidate-mismatch']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/generic/candidate/mismatch',
      requestedBy: 'browser-assist-test',
    });

    expect(started.session.runtimeState.inspection?.locatorCandidates).toEqual([
      expect.objectContaining({
        locator: expect.objectContaining({ ref: 'aria-old-1' }),
        staleness: expect.objectContaining({
          status: 'stale',
          tiedToCurrentSnapshot: false,
          reason: 'snapshot_turnover',
        }),
      }),
    ]);
  });

  it('returns audited DOM action receipts through the generic in-memory host seam', async () => {
    const executor = new InMemoryBrowserHostExecutor({
      now: sequence(['2026-03-16T07:00:00.500Z', '2026-03-16T07:00:01.500Z']),
      transport: 'browser-host',
      runtimeTargetPrefix: 'browser-target',
    });
    const runtime = new BrowserHostRuntimeAdapter({ executor });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-dom-action', 'checkpoint-auth-dom-action', 'checkpoint-review-dom-action']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/dom-action',
      requestedBy: 'dom-action-test',
    });
    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'e12', description: 'Submit button' },
      action: { kind: 'click' },
      snapshotContext: started.session.runtimeState?.snapshotContext,
      requestedAt: '2026-03-16T07:00:02.000Z',
    });

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        sessionId: started.session.id,
        runtimeTargetId: 'browser-target:session-dom-action',
        locator: { kind: 'aria-ref', ref: 'e12' },
        action: { kind: 'click' },
        snapshotContext: {
          artifact: {
            artifactId: 'browser-target:session-dom-action',
            version: '2026-03-16T07:00:00.500Z',
            capturedAt: '2026-03-16T07:00:00.500Z',
          },
        },
        readiness: {
          target: 'ready',
          inspection: 'present',
          snapshot: 'present',
          snapshotRef: { freshness: 'current' },
          preconditions: { target: 'required', inspection: 'optional', snapshot: 'required', locatorNeedsSnapshotRef: true },
        },
        confirmation: { host: 'browser-host', metadata: { simulated: 'true' } },
      },
    });
  });


  it('records accepted explicit snapshot rebinding submissions in generic action receipts', async () => {
    const executor = new InMemoryBrowserHostExecutor({
      now: sequence(['2026-03-16T07:20:00.500Z', '2026-03-16T07:20:01.500Z']),
      transport: 'browser-host',
      runtimeTargetPrefix: 'browser-target',
    });
    const runtime = new BrowserHostRuntimeAdapter({ executor });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-dom-action-rebind', 'checkpoint-auth-dom-action-rebind', 'checkpoint-review-dom-action-rebind']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/dom-action-rebind',
      requestedBy: 'dom-action-test',
    });

    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old submit button' },
      action: { kind: 'click' },
      snapshotContext: started.session.runtimeState?.snapshotContext,
      rebinding: started.session.runtimeState?.snapshotContext ? {
        snapshotContext: started.session.runtimeState.snapshotContext,
        locator: {
          kind: 'aria-ref',
          ref: 'fresh-e44',
          description: 'Fresh submit button',
          provenance: createSnapshotDerivedAriaRefProvenance({
            snapshotContext: started.session.runtimeState.snapshotContext,
            inspection: started.session.runtimeState.inspection,
            evidence: { description: 'Fresh submit button' },
          }),
        },
        previousLocator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old submit button' },
      } : undefined,
    });

    expect(result).toMatchObject({
      ok: true,
      receipt: {
        locator: { kind: 'aria-ref', ref: 'fresh-e44' },
        requestedLocator: { kind: 'aria-ref', ref: 'stale-e12' },
        rebinding: {
          provided: true,
          accepted: true,
          usedLocator: {
            kind: 'aria-ref',
            ref: 'fresh-e44',
            provenance: { kind: 'snapshot-derived', derivation: { basis: 'snapshot-ref' } },
          },
          submission: {
            locator: {
              kind: 'aria-ref',
              ref: 'fresh-e44',
              provenance: { kind: 'snapshot-derived', derivation: { basis: 'snapshot-ref' } },
            },
          },
        },
        readiness: {
          rebinding: {
            status: 'accepted',
          },
        },
      },
    });
  });

  it('adds host-agnostic recovery advice to generic snapshot-bound action failures', async () => {
    const executor = new InMemoryBrowserHostExecutor({
      now: sequence(['2026-03-16T07:10:00.500Z', '2026-03-16T07:10:01.500Z']),
      transport: 'browser-host',
      runtimeTargetPrefix: 'browser-target',
    });
    const runtime = new BrowserHostRuntimeAdapter({ executor });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-dom-action-recovery', 'checkpoint-auth-dom-action-recovery', 'checkpoint-review-dom-action-recovery']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/dom-action-recovery',
      requestedBy: 'dom-action-test',
    });

    const missingRequestedSnapshot = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'e12' },
      action: { kind: 'click' },
    });
    const staleSnapshotRef = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'e12' },
      action: { kind: 'click' },
      snapshotContext: started.session.runtimeState?.snapshotContext
        ? {
            artifact: {
              ...started.session.runtimeState.snapshotContext.artifact,
              version: 'stale-v0',
            },
          }
        : undefined,
    });

    expect(missingRequestedSnapshot).toMatchObject({
      ok: false,
      code: 'missing_snapshot_context',
      recoveryAdvice: {
        kind: 'snapshot-bound-action',
        autoRecovery: 'none',
        steps: [
          {
            action: 'reacquire',
            resource: 'snapshot_ref',
            state: 'missing',
          },
        ],
      },
    });
    expect(staleSnapshotRef).toMatchObject({
      ok: false,
      code: 'stale_ref',
      recoveryAdvice: {
        kind: 'snapshot-bound-action',
        autoRecovery: 'none',
        steps: [
          {
            action: 'reacquire',
            resource: 'snapshot_ref',
            state: 'obsolete',
          },
        ],
      },
    });
  });

  it('capability-gates DOM actions before dispatch', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      client: {
        async openTarget(input: any) {
          return {
            runtimeTargetId: `browser-target:${input.sessionId}`,
            currentTargetUrl: input.target.entryUrl,
          };
        },
      },
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-dom-gated', 'checkpoint-auth-dom-gated', 'checkpoint-review-dom-gated']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/dom-gated',
      requestedBy: 'dom-action-test',
    });
    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'e12' },
      action: { kind: 'click' },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'action_unsupported' }));
  });

  it('maps the narrow OpenClaw DOM action slice with explicit success and locator failures', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        relay: new InMemoryOpenClawBrowserRelay({ targetPrefix: 'openclaw-tab' }),
        now: sequence(['2026-03-16T08:00:00.500Z', '2026-03-16T08:00:01.500Z', '2026-03-16T08:00:02.500Z']),
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-action', 'checkpoint-auth-openclaw-action', 'checkpoint-review-openclaw-action']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/action',
      requestedBy: 'openclaw-runtime-test',
    });

    const success = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'e44', description: 'Ready button' },
      action: { kind: 'press', key: 'Enter' },
      snapshotContext: started.session.runtimeState?.snapshotContext,
    });
    const unsupportedLocator = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'role-name', role: 'button', name: 'Ready' },
      action: { kind: 'click' },
    });

    expect(success).toMatchObject({
      ok: true,
      receipt: {
        sessionId: started.session.id,
        runtimeTargetId: 'openclaw-tab:session-openclaw-action',
        locator: { kind: 'aria-ref', ref: 'e44' },
        action: { kind: 'press', key: 'Enter' },
        snapshotContext: {
          artifact: {
            artifactId: 'snapshot:openclaw-tab:session-openclaw-action',
          },
        },
        readiness: {
          target: 'ready',
          inspection: 'present',
          snapshot: 'present',
          snapshotRef: { freshness: 'current' },
          preconditions: { target: 'required', inspection: 'required', snapshot: 'required', locatorNeedsSnapshotRef: true },
        },
        confirmation: { host: 'openclaw-browser-tool', metadata: { locatorKind: 'aria-ref', actionKind: 'press' } },
      },
    });
    expect(unsupportedLocator).toEqual(expect.objectContaining({ ok: false, code: 'locator_unsupported' }));
  });


  it('uses selected inspection locator candidates for explicit OpenClaw aria-ref rebinding without hidden fallback', async () => {
    const dispatchedRefs: string[] = [];
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        transport: new OpenClawBrowserToolTransport({
          client: {
            async getCapabilities() {
              return {
                hostAvailable: true,
                activeTarget: true,
                runtimeInspection: true,
                snapshotInspection: true,
                checkpointHandoff: true,
                domActions: true,
                actionReadiness: true,
                snapshotRefLocators: true,
                explicitSnapshotRebinding: true,
                supportedDomActionKinds: ['click', 'fill', 'press'],
                supportedLocatorKinds: ['aria-ref'],
              };
            },
            async listTargets() { return []; },
            async openTarget(input: any) {
              return { targetId: `openclaw-tab:${input.sessionId}`, sessionId: input.sessionId, url: input.url, attached: true, available: true };
            },
            async getTarget(input) {
              return { targetId: input.targetId, sessionId: 'session-openclaw-explicit-rebind', url: 'https://hometax.go.kr/openclaw/action/rebind', attached: true, available: true };
            },
            async snapshotTarget(input) {
              const snapshotContext = { artifact: { artifactId: 'snapshot:openclaw-explicit-rebind', version: 'v2', capturedAt: '2026-03-16T08:10:04.000Z' } };
              return {
                targetId: input.targetId,
                sessionId: 'session-openclaw-explicit-rebind',
                url: 'https://hometax.go.kr/openclaw/action/rebind',
                title: 'Action Rebind Ready',
                attached: true,
                available: true,
                inspection: {
                  source: 'snapshot',
                  title: 'Action Rebind Ready',
                  url: 'https://hometax.go.kr/openclaw/action/rebind',
                  normalizedUrl: 'https://hometax.go.kr/openclaw/action/rebind',
                  textSnippet: '새 제출 버튼',
                  capturedAt: '2026-03-16T08:10:04.000Z',
                  snapshotContext,
                  locatorCandidates: [
                    createSnapshotDerivedAriaRefCandidate({
                      ref: 'fresh-e44',
                      label: 'button: 새 제출',
                      description: 'Fresh button',
                      snapshotContext,
                      inspection: {
                        source: 'snapshot',
                        url: 'https://hometax.go.kr/openclaw/action/rebind',
                        normalizedUrl: 'https://hometax.go.kr/openclaw/action/rebind',
                        capturedAt: '2026-03-16T08:10:04.000Z',
                      },
                      evidence: {
                        title: 'button: 새 제출',
                        textSnippet: '새 제출 버튼',
                        description: 'Fresh button',
                      },
                    }),
                  ],
                },
              };
            },
            async executeDomAction(input: any) {
              dispatchedRefs.push(input.locator.kind === 'aria-ref' ? input.locator.ref : 'non-aria');
              return {
                targetId: input.runtimeTargetId,
                actedAt: '2026-03-16T08:10:05.000Z',
                hostActionId: 'host-action-rebind-1',
                metadata: { locatorKind: input.locator.kind, actionKind: input.action.kind },
              };
            },
          },
        }),
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-explicit-rebind', 'checkpoint-auth-openclaw-explicit-rebind', 'checkpoint-review-openclaw-explicit-rebind']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/action/rebind',
      requestedBy: 'openclaw-runtime-test',
    });
    const selectedCandidate = started.session.runtimeState.inspection?.locatorCandidates?.[0];
    expect(selectedCandidate).toEqual(expect.objectContaining({
      kind: 'snapshot-derived',
      locator: expect.objectContaining({ kind: 'aria-ref', ref: 'fresh-e44' }),
    }));

    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old button' },
      action: { kind: 'click' },
      snapshotContext: selectedCandidate?.snapshotContext ?? started.session.runtimeState?.snapshotContext,
      rebinding: selectedCandidate ? {
        snapshotContext: selectedCandidate.snapshotContext,
        locator: selectedCandidate.locator,
        previousLocator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old button' },
      } : undefined,
    });

    expect(dispatchedRefs).toEqual(['fresh-e44']);
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        locator: { kind: 'aria-ref', ref: 'fresh-e44' },
        requestedLocator: { kind: 'aria-ref', ref: 'stale-e12' },
        rebinding: {
          provided: true,
          accepted: true,
          usedLocator: { kind: 'aria-ref', ref: 'fresh-e44' },
        },
        readiness: { rebinding: { status: 'accepted' } },
      },
    });
  });

  it('does not auto-select inspection locator candidates for OpenClaw aria-ref actions', async () => {
    const dispatchedRefs: string[] = [];
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        transport: new OpenClawBrowserToolTransport({
          client: {
            async getCapabilities() {
              return {
                hostAvailable: true,
                activeTarget: true,
                runtimeInspection: true,
                snapshotInspection: true,
                checkpointHandoff: true,
                domActions: true,
                actionReadiness: true,
                snapshotRefLocators: true,
                explicitSnapshotRebinding: true,
                supportedDomActionKinds: ['click', 'fill', 'press'],
                supportedLocatorKinds: ['aria-ref'],
              };
            },
            async listTargets() { return []; },
            async openTarget(input: any) {
              return { targetId: `openclaw-tab:${input.sessionId}`, sessionId: input.sessionId, url: input.url, attached: true, available: true };
            },
            async getTarget(input) {
              return { targetId: input.targetId, sessionId: 'session-openclaw-no-auto-select', url: 'https://hometax.go.kr/openclaw/action/no-auto-select', attached: true, available: true };
            },
            async snapshotTarget(input) {
              const snapshotContext = { artifact: { artifactId: 'snapshot:openclaw-no-auto-select', version: 'v4', capturedAt: '2026-03-16T08:30:04.000Z' } };
              return {
                targetId: input.targetId,
                sessionId: 'session-openclaw-no-auto-select',
                url: 'https://hometax.go.kr/openclaw/action/no-auto-select',
                title: 'Action Candidate Ready',
                attached: true,
                available: true,
                inspection: {
                  source: 'snapshot',
                  title: 'Action Candidate Ready',
                  url: 'https://hometax.go.kr/openclaw/action/no-auto-select',
                  normalizedUrl: 'https://hometax.go.kr/openclaw/action/no-auto-select',
                  textSnippet: '새 제출 버튼',
                  capturedAt: '2026-03-16T08:30:04.000Z',
                  snapshotContext,
                  locatorCandidates: [
                    createSnapshotDerivedAriaRefCandidate({
                      ref: 'fresh-e44',
                      label: 'button: 새 제출',
                      description: 'Fresh button',
                      snapshotContext,
                      inspection: {
                        source: 'snapshot',
                        url: 'https://hometax.go.kr/openclaw/action/no-auto-select',
                        normalizedUrl: 'https://hometax.go.kr/openclaw/action/no-auto-select',
                        capturedAt: '2026-03-16T08:30:04.000Z',
                      },
                    }),
                  ],
                },
              };
            },
            async executeDomAction(input: any) {
              dispatchedRefs.push(input.locator.kind === 'aria-ref' ? input.locator.ref : 'non-aria');
              return {
                targetId: input.runtimeTargetId,
                actedAt: '2026-03-16T08:30:05.000Z',
                hostActionId: 'host-action-no-auto-select-1',
                metadata: { locatorKind: input.locator.kind, actionKind: input.action.kind },
              };
            },
          },
        }),
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-no-auto-select', 'checkpoint-auth-openclaw-no-auto-select', 'checkpoint-review-openclaw-no-auto-select']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/action/no-auto-select',
      requestedBy: 'openclaw-runtime-test',
    });
    expect(started.session.runtimeState.inspection?.locatorCandidates?.[0]?.locator.ref).toBe('fresh-e44');

    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old button' },
      action: { kind: 'click' },
      snapshotContext: started.session.runtimeState?.snapshotContext,
    });

    expect(dispatchedRefs).toEqual(['stale-e12']);
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        locator: { kind: 'aria-ref', ref: 'stale-e12' },
        requestedLocator: { kind: 'aria-ref', ref: 'stale-e12' },
        rebinding: {
          provided: false,
          accepted: false,
        },
      },
    });
  });

  it('rejects mismatched explicit rebinding submissions for OpenClaw aria-ref actions', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        relay: new InMemoryOpenClawBrowserRelay({ targetPrefix: 'openclaw-tab' }),
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-rebind-mismatch', 'checkpoint-auth-openclaw-rebind-mismatch', 'checkpoint-review-openclaw-rebind-mismatch']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/action',
      requestedBy: 'openclaw-runtime-test',
    });

    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'stale-e12' },
      action: { kind: 'click' },
      snapshotContext: started.session.runtimeState?.snapshotContext,
      rebinding: started.session.runtimeState?.snapshotContext ? {
        snapshotContext: {
          artifact: {
            ...started.session.runtimeState.snapshotContext.artifact,
            version: 'other-v999',
          },
        },
        locator: {
          kind: 'aria-ref',
          ref: 'fresh-e44',
          provenance: createSnapshotDerivedAriaRefProvenance({
            snapshotContext: {
              artifact: {
                ...started.session.runtimeState.snapshotContext.artifact,
                version: 'other-v999',
              },
            },
            inspection: started.session.runtimeState.inspection,
          }),
        },
        previousLocator: { kind: 'aria-ref', ref: 'stale-e12' },
      } : undefined,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'rebinding_artifact_mismatch',
      receipt: {
        locator: { kind: 'aria-ref', ref: 'fresh-e44' },
        requestedLocator: { kind: 'aria-ref', ref: 'stale-e12' },
        rebinding: {
          provided: true,
          accepted: false,
          rejectionCode: 'rebinding_artifact_mismatch',
        },
        readiness: {
          rebinding: {
            status: 'rejected',
            rejectionCode: 'rebinding_artifact_mismatch',
          },
        },
      },
    });
  });

  it('rejects explicit rebinding submissions when locator provenance/evidence is missing', async () => {
    const executor = new InMemoryBrowserHostExecutor({
      now: sequence(['2026-03-16T07:25:00.500Z', '2026-03-16T07:25:01.500Z']),
      transport: 'browser-host',
      runtimeTargetPrefix: 'browser-target',
    });
    const runtime = new BrowserHostRuntimeAdapter({ executor });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-dom-action-rebind-missing-provenance', 'checkpoint-auth-dom-action-rebind-missing-provenance', 'checkpoint-review-dom-action-rebind-missing-provenance']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/dom-action-rebind',
      requestedBy: 'dom-action-test',
    });

    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old submit button' },
      action: { kind: 'click' },
      snapshotContext: started.session.runtimeState?.snapshotContext,
      rebinding: started.session.runtimeState?.snapshotContext ? {
        snapshotContext: started.session.runtimeState.snapshotContext,
        locator: { kind: 'aria-ref', ref: 'fresh-e44', description: 'Fresh submit button' },
      } : undefined,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'invalid_rebinding_submission',
      receipt: {
        rebinding: {
          provided: true,
          accepted: false,
          rejectionCode: 'invalid_rebinding_submission',
          detail: 'Snapshot-backed rebinding submissions must carry snapshot-derived locator provenance/evidence.',
        },
      },
    });
  });

  it('rejects explicit rebinding submissions when locator provenance mismatches the bound inspection context', async () => {
    const executor = new InMemoryBrowserHostExecutor({
      now: sequence(['2026-03-16T07:26:00.500Z', '2026-03-16T07:26:01.500Z']),
      transport: 'browser-host',
      runtimeTargetPrefix: 'browser-target',
    });
    const runtime = new BrowserHostRuntimeAdapter({ executor });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-dom-action-rebind-inspection-mismatch', 'checkpoint-auth-dom-action-rebind-inspection-mismatch', 'checkpoint-review-dom-action-rebind-inspection-mismatch']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/dom-action-rebind',
      requestedBy: 'dom-action-test',
    });

    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'stale-e12', description: 'Old submit button' },
      action: { kind: 'click' },
      snapshotContext: started.session.runtimeState?.snapshotContext,
      rebinding: started.session.runtimeState?.snapshotContext ? {
        snapshotContext: started.session.runtimeState.snapshotContext,
        locator: {
          kind: 'aria-ref',
          ref: 'fresh-e44',
          description: 'Fresh submit button',
          provenance: createSnapshotDerivedAriaRefProvenance({
            snapshotContext: started.session.runtimeState.snapshotContext,
            inspection: { source: 'snapshot', normalizedUrl: 'https://example.com/other' },
          }),
        },
      } : undefined,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'invalid_rebinding_submission',
      receipt: {
        rebinding: {
          provided: true,
          accepted: false,
          rejectionCode: 'invalid_rebinding_submission',
          detail: 'Submitted rebinding locator provenance does not match the current inspection context for the bound target.',
        },
      },
    });
  });

  it('refuses aria-ref actions when inspection and runtime snapshot context are absent', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        relay: new InMemoryOpenClawBrowserRelay({ targetPrefix: 'openclaw-tab' }),
      }),
    });

    const result = await runtime.executeDomAction({
      sessionId: 'session-missing-snapshot',
      runtimeState: {
        sessionId: 'session-missing-snapshot',
        transport: 'openclaw-browser-tool',
        runtimeTargetId: 'openclaw-tab:session-missing-snapshot',
        currentTargetUrl: 'https://hometax.go.kr/openclaw/action',
        lastOpenedUrl: 'https://hometax.go.kr/openclaw/action',
        activeCheckpointId: null,
        updatedAt: '2026-03-16T08:00:03.000Z',
      },
      locator: { kind: 'aria-ref', ref: 'e12' },
      action: { kind: 'click' },
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'missing_inspection_context',
      recoveryAdvice: {
        kind: 'snapshot-bound-action',
        autoRecovery: 'none',
        steps: [
          { action: 'reinspect', resource: 'inspection_context', state: 'missing' },
          { action: 'reinspect', resource: 'snapshot_context', state: 'missing' },
        ],
      },
      receipt: {
        readiness: {
          target: 'ready',
          inspection: 'missing',
          snapshot: 'missing',
          snapshotRef: { freshness: 'missing_runtime_snapshot' },
        },
      },
    });
  });

  it('refuses aria-ref actions when explicit snapshot request context is absent', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        relay: new InMemoryOpenClawBrowserRelay({ targetPrefix: 'openclaw-tab' }),
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-missing-request-snapshot', 'checkpoint-auth-openclaw-missing-request-snapshot', 'checkpoint-review-openclaw-missing-request-snapshot']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/action',
      requestedBy: 'openclaw-runtime-test',
    });

    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'e12' },
      action: { kind: 'click' },
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'missing_snapshot_context',
      recoveryAdvice: {
        kind: 'snapshot-bound-action',
        autoRecovery: 'none',
        steps: [
          { action: 'reacquire', resource: 'snapshot_ref', state: 'missing' },
        ],
      },
      receipt: {
        readiness: {
          target: 'ready',
          inspection: 'present',
          snapshot: 'present',
          snapshotRef: { freshness: 'missing_requested_snapshot' },
        },
      },
    });
  });

  it('adds rebind advice when snapshot-bound OpenClaw actions have no bound target', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        relay: new InMemoryOpenClawBrowserRelay({ targetPrefix: 'openclaw-tab' }),
      }),
    });

    const result = await runtime.executeDomAction({
      sessionId: 'session-openclaw-missing-binding',
      runtimeState: null,
      locator: { kind: 'aria-ref', ref: 'e12' },
      action: { kind: 'click' },
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'target_not_found',
      recoveryAdvice: {
        kind: 'snapshot-bound-action',
        autoRecovery: 'none',
        steps: [
          { action: 'rebind', resource: 'target_binding', state: 'missing' },
        ],
      },
    });
  });

  it('distinguishes snapshot-version stale refs from ambiguous aria-ref failures', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      executor: new OpenClawBrowserHostExecutor({
        relay: new InMemoryOpenClawBrowserRelay({ targetPrefix: 'openclaw-tab' }),
      }),
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-openclaw-ref-errors', 'checkpoint-auth-openclaw-ref-errors', 'checkpoint-review-openclaw-ref-errors']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/openclaw/action',
      requestedBy: 'openclaw-runtime-test',
    });

    const stale = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'e44' },
      action: { kind: 'click' },
      snapshotContext: started.session.runtimeState?.snapshotContext
        ? {
            artifact: {
              ...started.session.runtimeState.snapshotContext.artifact,
              version: 'stale-v0',
            },
          }
        : undefined,
    });
    const ambiguous = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'ambiguous-ref' },
      action: { kind: 'click' },
      snapshotContext: started.session.runtimeState?.snapshotContext,
    });

    expect(stale).toMatchObject({
      ok: false,
      code: 'stale_ref',
      recoveryAdvice: {
        kind: 'snapshot-bound-action',
        autoRecovery: 'none',
        steps: [
          { action: 'reacquire', resource: 'snapshot_ref', state: 'obsolete' },
        ],
      },
      receipt: {
        readiness: {
          snapshot: 'present',
          snapshotRef: { freshness: 'stale' },
        },
      },
    });
    expect(ambiguous).toMatchObject({
      ok: false,
      code: 'ambiguous_ref',
      recoveryAdvice: {
        kind: 'snapshot-bound-action',
        autoRecovery: 'none',
        steps: [
          { action: 'reinspect', resource: 'inspection_context', state: 'obsolete' },
          { action: 'reacquire', resource: 'snapshot_ref', state: 'obsolete' },
        ],
      },
    });
  });

  it('capability-gates readiness-aware action dispatch', async () => {
    const runtime = new BrowserHostRuntimeAdapter({
      client: {
        async getCapabilities() {
          return {
            hostAvailable: true,
            domActions: true,
            actionReadiness: false,
            supportedDomActionKinds: ['click'],
            supportedLocatorKinds: ['aria-ref'],
          };
        },
        async openTarget(input: any) {
          return {
            runtimeTargetId: `browser-target:${input.sessionId}`,
            currentTargetUrl: input.target.entryUrl,
          };
        },
        async executeDomAction() {
          throw new Error('should not dispatch');
        },
      },
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-dom-readiness-gated', 'checkpoint-auth-dom-readiness-gated', 'checkpoint-review-dom-readiness-gated']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/dom-readiness-gated',
      requestedBy: 'dom-action-test',
    });
    const result = await runtime.executeDomAction({
      sessionId: started.session.id,
      runtimeState: started.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'e12' },
      action: { kind: 'click' },
    });

    expect(result).toEqual(expect.objectContaining({ ok: false, code: 'action_unsupported' }));
  });

  it('annotates retained snapshot-derived candidates as stale after snapshot turnover without auto-selection', async () => {
    const initialSnapshotContext = { artifact: { artifactId: 'snapshot:turnover', version: 'v1', capturedAt: '2026-03-17T09:00:00.000Z' } };
    const currentSnapshotContext = { artifact: { artifactId: 'snapshot:turnover', version: 'v2', capturedAt: '2026-03-17T09:05:00.000Z' } };
    const staleCandidate = createSnapshotDerivedAriaRefCandidate({
      ref: 'old-e12',
      label: 'button: 이전 제출',
      description: 'Old submit button',
      snapshotContext: initialSnapshotContext,
      inspection: {
        source: 'snapshot',
        url: 'https://hometax.go.kr/turnover',
        normalizedUrl: 'https://hometax.go.kr/turnover',
        capturedAt: '2026-03-17T09:00:00.000Z',
      },
      evidence: {
        title: 'button: 이전 제출',
        textSnippet: '이전 제출',
        description: 'Old submit button',
      },
    });
    const freshCandidate = createSnapshotDerivedAriaRefCandidate({
      ref: 'fresh-e44',
      label: 'button: 새 제출',
      description: 'Fresh submit button',
      snapshotContext: currentSnapshotContext,
      inspection: {
        source: 'snapshot',
        url: 'https://hometax.go.kr/turnover',
        normalizedUrl: 'https://hometax.go.kr/turnover',
        capturedAt: '2026-03-17T09:05:00.000Z',
      },
      evidence: {
        title: 'button: 새 제출',
        textSnippet: '새 제출',
        description: 'Fresh submit button',
      },
    });
    const dispatchedRefs: string[] = [];
    const runtime = new BrowserHostRuntimeAdapter({
      executor: {
        async getCapabilities() {
          return {
            hostAvailable: true,
            activeTarget: true,
            runtimeInspection: true,
            snapshotInspection: true,
            targetResolution: true,
            checkpointHandoff: true,
            domActions: true,
            actionReadiness: true,
            snapshotRefLocators: true,
            explicitSnapshotRebinding: true,
            snapshotLocatorProvenance: true,
            inspectionCandidateGuidance: true,
            inspectionCandidateStaleness: true,
            supportedDomActionKinds: ['click'],
            supportedLocatorKinds: ['aria-ref'],
          };
        },
        async openTarget(input: any) {
          return {
            sessionId: input.sessionId,
            runtimeTargetId: 'target-turnover',
            targetUrl: input.targetUrl,
            currentTargetUrl: input.targetUrl,
            openedAt: '2026-03-17T09:00:00.000Z',
            updatedAt: '2026-03-17T09:00:00.000Z',
            transport: 'test-turnover',
            inspection: {
              source: 'snapshot',
              url: input.targetUrl,
              normalizedUrl: input.targetUrl,
              capturedAt: '2026-03-17T09:00:00.000Z',
              snapshotContext: initialSnapshotContext,
              locatorCandidates: [staleCandidate],
            },
            snapshotContext: initialSnapshotContext,
          };
        },
        async getRuntimeState(input: any) {
          return {
            sessionId: input.sessionId,
            runtimeTargetId: 'target-turnover',
            currentTargetUrl: input.target.entryUrl,
            updatedAt: '2026-03-17T09:05:00.000Z',
            inspection: {
              source: 'snapshot',
              url: input.target.entryUrl,
              normalizedUrl: input.target.entryUrl,
              capturedAt: '2026-03-17T09:05:00.000Z',
              snapshotContext: currentSnapshotContext,
              locatorCandidates: [staleCandidate, freshCandidate],
            },
            snapshotContext: currentSnapshotContext,
          };
        },
        async executeDomAction(input: any) {
          dispatchedRefs.push(input.rebinding?.locator.kind === 'aria-ref' ? input.rebinding.locator.ref : input.locator.kind === 'aria-ref' ? input.locator.ref : 'non-aria');
          return {
            ok: true as const,
            receipt: {
              actionId: 'action-turnover-1',
              sessionId: input.sessionId,
              runtimeTargetId: 'target-turnover',
              targetUrl: 'https://hometax.go.kr/turnover',
              action: input.action,
              locator: input.rebinding?.locator ?? input.locator,
              requestedLocator: input.locator,
              actedAt: '2026-03-17T09:06:00.000Z',
              readiness: {
                preconditions: { target: 'required', inspection: 'optional', snapshot: 'required', locatorNeedsSnapshotRef: true },
                target: 'ready', inspection: 'present', snapshot: 'present',
                snapshotRef: { freshness: 'current', current: currentSnapshotContext, requested: input.snapshotContext },
                rebinding: input.rebinding ? { status: 'accepted', submitted: input.rebinding, accepted: input.rebinding } : { status: 'not-provided' },
              },
              rebinding: {
                provided: Boolean(input.rebinding),
                accepted: Boolean(input.rebinding),
                submission: input.rebinding,
                usedLocator: input.rebinding?.locator,
                usedSnapshotContext: input.rebinding?.snapshotContext,
              },
              host: 'test-turnover',
            },
          };
        },
      },
    });
    const service = createBrowserAssistService({
      store: new InMemoryBrowserAssistSessionStore(),
      runtime,
      createId: sequence(['session-turnover', 'checkpoint-auth-turnover', 'checkpoint-review-turnover']),
    });

    const started = await service.startHomeTaxAssist({
      targetUrl: 'https://hometax.go.kr/turnover',
      requestedBy: 'turnover-test',
    });
    const refreshed = await service.getHomeTaxAssistStatus(started.session.id);
    const candidates = refreshed.session.runtimeState.inspection?.locatorCandidates ?? [];

    expect(candidates.map((candidate) => ({ ref: candidate.locator.ref, status: candidate.staleness.status, tied: candidate.staleness.tiedToCurrentSnapshot }))).toEqual([
      { ref: 'old-e12', status: 'stale', tied: false },
      { ref: 'fresh-e44', status: 'current', tied: true },
    ]);

    const actionResult = await runtime.executeDomAction({
      sessionId: refreshed.session.id,
      runtimeState: refreshed.session.runtimeState,
      locator: { kind: 'aria-ref', ref: 'old-e12', description: 'Old submit button' },
      action: { kind: 'click' },
      snapshotContext: currentSnapshotContext,
      rebinding: {
        snapshotContext: freshCandidate.snapshotContext,
        locator: freshCandidate.locator,
        previousLocator: { kind: 'aria-ref', ref: 'old-e12', description: 'Old submit button' },
      },
    });

    expect(actionResult).toEqual(expect.objectContaining({ ok: true }));
    expect(dispatchedRefs).toEqual(['fresh-e44']);
  });

});

import { describe, expect, it } from 'vitest';
import {
  BrowserAssistSessionError,
  InMemoryBrowserAssistSessionStore,
  RecordingBrowserRuntimeAdapter,
  SystemBrowserRuntimeAdapter,
  createBrowserAssistService,
  createBrowserAssistToolAdapter,
} from '../packages/browser-assist/src/index.js';

function sequence<T>(values: T[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)] as T;
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
      transport: 'openclaw-browser-bridge',
      runtimeTargetPrefix: 'openclaw-tab',
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
    expect(started.session.openReceipt.transport).toBe('openclaw-browser-bridge');
    expect(started.session.openReceipt.runtimeTargetId).toBe('openclaw-tab:session-system');

    const afterAuth = await service.resumeHomeTaxAssist({
      sessionId: started.session.id,
      checkpointId: 'checkpoint-auth-system',
    });

    expect(afterAuth.session.runtimeState.runtimeTargetId).toBe('openclaw-tab:session-system');
    expect(afterAuth.session.runtimeState.activeCheckpointId).toBe('checkpoint-review-system');
  });
});

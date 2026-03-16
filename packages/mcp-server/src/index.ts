import type {
  BrowserAssistRuntimeState,
  BrowserAssistTarget,
  OpenClawBrowserToolExecutor,
} from '@korean-tax-agent/browser-assist';

export * from './contracts.js';
export * from './tools.js';
export * from './runtime.js';
export * from './facade.js';

export interface StubOpenClawBrowserToolExecutorOptions {
  now?: () => string;
  transport?: string;
  runtimeTargetPrefix?: string;
}

export interface StubOpenClawBrowserToolExecutionRecord {
  method: 'openTarget' | 'handoffCheckpoint' | 'getRuntimeState';
  sessionId: string;
  runtimeTargetId?: string;
}

interface StubRuntimeState extends BrowserAssistRuntimeState {}

export class StubOpenClawBrowserToolExecutor implements OpenClawBrowserToolExecutor {
  readonly executions: StubOpenClawBrowserToolExecutionRecord[] = [];
  private readonly now: () => string;
  private readonly transport: string;
  private readonly runtimeTargetPrefix: string;
  private readonly stateBySessionId = new Map<string, StubRuntimeState>();

  constructor(options: StubOpenClawBrowserToolExecutorOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.transport = options.transport ?? 'openclaw-browser-tool';
    this.runtimeTargetPrefix = options.runtimeTargetPrefix ?? 'openclaw-tab';
  }

  async openTarget(input: {
    sessionId: string;
    target: BrowserAssistTarget;
    activeCheckpoint: { id: string };
  }) {
    const openedAt = this.now();
    const runtimeTargetId = `${this.runtimeTargetPrefix}:${input.sessionId}`;
    const runtimeState: StubRuntimeState = {
      sessionId: input.sessionId,
      transport: this.transport,
      runtimeTargetId,
      currentTargetUrl: input.target.entryUrl,
      lastOpenedUrl: input.target.entryUrl,
      activeCheckpointId: input.activeCheckpoint.id,
      updatedAt: openedAt,
    };

    this.stateBySessionId.set(input.sessionId, cloneValue(runtimeState));
    this.executions.push({ method: 'openTarget', sessionId: input.sessionId, runtimeTargetId });

    return {
      transport: runtimeState.transport,
      runtimeTargetId: runtimeState.runtimeTargetId,
      targetUrl: input.target.entryUrl,
      currentTargetUrl: runtimeState.currentTargetUrl,
      lastOpenedUrl: runtimeState.lastOpenedUrl,
      activeCheckpointId: runtimeState.activeCheckpointId,
      openedAt,
    };
  }

  async handoffCheckpoint(input: {
    sessionId: string;
    target: BrowserAssistTarget;
    targetUrl: string;
    nextCheckpoint: { id: string } | null;
    handedOffAt: string;
    runtimeState: BrowserAssistRuntimeState | null;
  }) {
    const previousState = this.stateBySessionId.get(input.sessionId) ?? input.runtimeState ?? {
      sessionId: input.sessionId,
      transport: this.transport,
      runtimeTargetId: `${this.runtimeTargetPrefix}:${input.sessionId}`,
      currentTargetUrl: input.target.entryUrl,
      lastOpenedUrl: input.target.entryUrl,
      activeCheckpointId: null,
      updatedAt: input.handedOffAt,
    };

    const nextState: StubRuntimeState = {
      sessionId: input.sessionId,
      transport: previousState.transport,
      runtimeTargetId: previousState.runtimeTargetId,
      currentTargetUrl: input.targetUrl || previousState.currentTargetUrl,
      lastOpenedUrl: previousState.lastOpenedUrl,
      activeCheckpointId: input.nextCheckpoint ? input.nextCheckpoint.id : null,
      updatedAt: input.handedOffAt,
    };

    this.stateBySessionId.set(input.sessionId, cloneValue(nextState));
    this.executions.push({
      method: 'handoffCheckpoint',
      sessionId: input.sessionId,
      runtimeTargetId: nextState.runtimeTargetId,
    });

    return cloneValue(nextState);
  }

  async getRuntimeState(input: {
    sessionId: string;
    runtimeState: BrowserAssistRuntimeState | null;
  }) {
    const runtimeState = this.stateBySessionId.get(input.sessionId) ?? input.runtimeState ?? null;
    this.executions.push({
      method: 'getRuntimeState',
      sessionId: input.sessionId,
      runtimeTargetId: runtimeState?.runtimeTargetId,
    });
    return runtimeState ? cloneValue(runtimeState) : null;
  }
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

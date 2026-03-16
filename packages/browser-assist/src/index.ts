import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export * from './openclaw.js';
export * from './openclaw-runtime.js';

export type BrowserAssistFlowId = 'hometax-filing';
export type BrowserAssistCheckpointCode = 'user-authentication' | 'target-page-review';
export type BrowserAssistCheckpointStatus = 'pending' | 'completed';
export type BrowserAssistSessionStatus = 'waiting_for_user' | 'completed' | 'stopped';
export type BrowserAssistEventType =
  | 'session-started'
  | 'target-opened'
  | 'checkpoint-completed'
  | 'checkpoint-handed-off'
  | 'session-completed'
  | 'session-stopped';

export interface BrowserAssistTarget {
  flow: BrowserAssistFlowId;
  entryUrl: string;
  label: string;
}

export interface BrowserAssistCheckpoint {
  id: string;
  code: BrowserAssistCheckpointCode;
  title: string;
  instructions: string;
  status: BrowserAssistCheckpointStatus;
  blocking: boolean;
  completionNote?: string;
}

export interface BrowserAssistEvent {
  type: BrowserAssistEventType;
  at: string;
  detail: string;
  checkpointId?: string;
}

export interface BrowserAssistRuntimeState {
  sessionId: string;
  transport: string;
  runtimeTargetId?: string;
  currentTargetUrl: string;
  lastOpenedUrl: string;
  activeCheckpointId: string | null;
  updatedAt: string;
}

export interface BrowserAssistOpenReceipt extends BrowserAssistRuntimeState {
  targetUrl: string;
  openedAt: string;
}

export interface BrowserAssistSession {
  schemaVersion: 2;
  id: string;
  status: BrowserAssistSessionStatus;
  requestedBy: string;
  filingDraftId?: string;
  target: BrowserAssistTarget;
  currentCheckpointId: string | null;
  checkpoints: BrowserAssistCheckpoint[];
  openReceipt: BrowserAssistOpenReceipt;
  runtimeState: BrowserAssistRuntimeState;
  metadata: Record<string, string>;
  events: BrowserAssistEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface BrowserAssistStatusSnapshot {
  session: BrowserAssistSession;
  activeCheckpoint: BrowserAssistCheckpoint | null;
}

export interface StartHomeTaxAssistInput {
  targetUrl: string;
  requestedBy: string;
  filingDraftId?: string;
  targetLabel?: string;
  metadata?: Record<string, string>;
}

export interface ResumeHomeTaxAssistInput {
  sessionId: string;
  checkpointId?: string;
  note?: string;
}

export interface StopHomeTaxAssistInput {
  sessionId: string;
  reason: string;
  note?: string;
}

export interface BrowserRuntimeOpenRequest {
  sessionId: string;
  target: BrowserAssistTarget;
  activeCheckpoint: BrowserAssistCheckpoint;
}

export interface BrowserRuntimeCheckpointHandoffRequest {
  sessionId: string;
  target: BrowserAssistTarget;
  targetUrl: string;
  completedCheckpoint: BrowserAssistCheckpoint | null;
  nextCheckpoint: BrowserAssistCheckpoint | null;
  handedOffAt: string;
}

export interface BrowserAssistRuntimeAdapter {
  openTarget(
    request: BrowserRuntimeOpenRequest,
  ): Promise<BrowserAssistOpenReceipt> | BrowserAssistOpenReceipt;
  handoffCheckpoint?(
    request: BrowserRuntimeCheckpointHandoffRequest,
  ): Promise<BrowserAssistRuntimeState> | BrowserAssistRuntimeState;
  getRuntimeState?(input: {
    sessionId: string;
    target: BrowserAssistTarget;
  }): Promise<BrowserAssistRuntimeState | null> | BrowserAssistRuntimeState | null;
}

export interface BrowserAssistSessionStore {
  getSession(sessionId: string): Promise<BrowserAssistSession | undefined> | BrowserAssistSession | undefined;
  saveSession(session: BrowserAssistSession): Promise<void> | void;
}

export interface BrowserAssistService {
  startHomeTaxAssist(input: StartHomeTaxAssistInput): Promise<BrowserAssistStatusSnapshot>;
  resumeHomeTaxAssist(input: ResumeHomeTaxAssistInput): Promise<BrowserAssistStatusSnapshot>;
  getHomeTaxAssistStatus(sessionId: string): Promise<BrowserAssistStatusSnapshot>;
  stopHomeTaxAssist(input: StopHomeTaxAssistInput): Promise<BrowserAssistStatusSnapshot>;
}

export interface BrowserAssistToolAdapter {
  startHomeTaxAssist(input: StartHomeTaxAssistInput): Promise<BrowserAssistStatusSnapshot>;
  resumeHomeTaxAssist(input: ResumeHomeTaxAssistInput): Promise<BrowserAssistStatusSnapshot>;
  getHomeTaxAssistStatus(input: { sessionId: string }): Promise<BrowserAssistStatusSnapshot>;
  stopHomeTaxAssist(input: StopHomeTaxAssistInput): Promise<BrowserAssistStatusSnapshot>;
}

export interface CreateBrowserAssistServiceOptions {
  store: BrowserAssistSessionStore;
  runtime: BrowserAssistRuntimeAdapter;
  now?: () => string;
  createId?: () => string;
}

export interface RecordingBrowserRuntimeAdapterOptions {
  now?: () => string;
  transport?: string;
}

export interface SystemBrowserRuntimeAdapterOptions {
  now?: () => string;
  transport?: string;
  runtimeTargetPrefix?: string;
  launcher?: (
    targetUrl: string,
    context: {
      sessionId: string;
      target: BrowserAssistTarget;
      activeCheckpoint: BrowserAssistCheckpoint;
    },
  ) => Promise<void> | void;
}

export interface BrowserHostCapabilities {
  hostAvailable: boolean;
  activeTarget: boolean | null;
  runtimeInspection: boolean;
  checkpointHandoff: boolean;
}

export interface BrowserHostRuntimeClient {
  getCapabilities?(input: {
    sessionId?: string;
    runtimeState?: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserHostCapabilities>> | Partial<BrowserHostCapabilities>;
  openTarget(input: BrowserRuntimeOpenRequest): Promise<Partial<BrowserAssistOpenReceipt>> | Partial<BrowserAssistOpenReceipt>;
  getRuntimeState?(input: {
    sessionId: string;
    target: BrowserAssistTarget;
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null> | Partial<BrowserAssistRuntimeState> | null;
  handoffCheckpoint?(input: BrowserRuntimeCheckpointHandoffRequest & {
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null> | Partial<BrowserAssistRuntimeState> | null;
}

export interface BrowserHostExecutor {
  getCapabilities?(input: {
    sessionId?: string;
    runtimeState?: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserHostCapabilities>> | Partial<BrowserHostCapabilities>;
  openTarget(input: BrowserRuntimeOpenRequest): Promise<Partial<BrowserAssistOpenReceipt>> | Partial<BrowserAssistOpenReceipt>;
  getRuntimeState?(input: {
    sessionId: string;
    target: BrowserAssistTarget;
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null> | Partial<BrowserAssistRuntimeState> | null;
  handoffCheckpoint?(input: BrowserRuntimeCheckpointHandoffRequest & {
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null> | Partial<BrowserAssistRuntimeState> | null;
}

export interface ExecutorBackedBrowserHostClientOptions {
  executor: BrowserHostExecutor;
}

export interface InMemoryBrowserHostExecutorOptions {
  now?: () => string;
  transport?: string;
  runtimeTargetPrefix?: string;
}

export interface BrowserHostExecutionRecord {
  method: 'openTarget' | 'handoffCheckpoint' | 'getRuntimeState';
  input:
    | BrowserRuntimeOpenRequest
    | (BrowserRuntimeCheckpointHandoffRequest & { runtimeState: BrowserAssistRuntimeState | null })
    | { sessionId: string; target: BrowserAssistTarget; runtimeState: BrowserAssistRuntimeState | null };
  output: Partial<BrowserAssistOpenReceipt> | Partial<BrowserAssistRuntimeState> | null;
}

export interface BrowserHostRuntimeAdapterOptions {
  client?: BrowserHostRuntimeClient;
  executor?: BrowserHostExecutor;
  now?: () => string;
  transport?: string;
}

export interface BrowserRuntimeOpenRecord {
  request: BrowserRuntimeOpenRequest;
  receipt: BrowserAssistOpenReceipt;
}

export interface BrowserRuntimeCheckpointHandoffRecord {
  request: BrowserRuntimeCheckpointHandoffRequest;
  runtimeState: BrowserAssistRuntimeState;
}

export const browserAssistToolIds = {
  start: 'tax.browser.start_hometax_assist',
  resume: 'tax.browser.resume_hometax_assist',
  status: 'tax.browser.get_hometax_assist_status',
  stop: 'tax.browser.stop_hometax_assist',
} as const;

export class BrowserAssistSessionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'BrowserAssistSessionError';
  }
}

export class RecordingBrowserRuntimeAdapter implements BrowserAssistRuntimeAdapter {
  readonly openedTargets: BrowserRuntimeOpenRecord[] = [];
  readonly handoffs: BrowserRuntimeCheckpointHandoffRecord[] = [];
  private readonly now: () => string;
  private readonly transport: string;
  private readonly stateBySessionId = new Map<string, BrowserAssistRuntimeState>();

  constructor(options: RecordingBrowserRuntimeAdapterOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.transport = options.transport ?? 'recording-browser';
  }

  async openTarget(request: BrowserRuntimeOpenRequest): Promise<BrowserAssistOpenReceipt> {
    const openedAt = this.now();
    const receipt = createRuntimeReceipt({
      sessionId: request.sessionId,
      openedAt,
      updatedAt: openedAt,
      transport: this.transport,
      runtimeTargetId: `recording-target:${request.sessionId}`,
      targetUrl: request.target.entryUrl,
      currentTargetUrl: request.target.entryUrl,
      lastOpenedUrl: request.target.entryUrl,
      activeCheckpointId: request.activeCheckpoint.id,
    });

    this.openedTargets.push({
      request: cloneValue(request),
      receipt: cloneValue(receipt),
    });
    this.stateBySessionId.set(request.sessionId, cloneValue(receipt));
    return cloneValue(receipt);
  }

  async handoffCheckpoint(request: BrowserRuntimeCheckpointHandoffRequest): Promise<BrowserAssistRuntimeState> {
    const previousState = this.stateBySessionId.get(request.sessionId);
    const nextState = createRuntimeState({
      sessionId: request.sessionId,
      transport: previousState?.transport ?? this.transport,
      runtimeTargetId: previousState?.runtimeTargetId ?? `recording-target:${request.sessionId}`,
      currentTargetUrl: request.targetUrl || previousState?.currentTargetUrl || request.target.entryUrl,
      lastOpenedUrl: previousState?.lastOpenedUrl || request.target.entryUrl,
      activeCheckpointId: request.nextCheckpoint ? request.nextCheckpoint.id : null,
      updatedAt: request.handedOffAt || this.now(),
    });

    this.handoffs.push({
      request: cloneValue(request),
      runtimeState: cloneValue(nextState),
    });
    this.stateBySessionId.set(request.sessionId, cloneValue(nextState));
    return cloneValue(nextState);
  }

  async getRuntimeState(input: { sessionId: string }): Promise<BrowserAssistRuntimeState | null> {
    const state = this.stateBySessionId.get(input.sessionId);
    return state ? cloneValue(state) : null;
  }
}

export class SystemBrowserRuntimeAdapter implements BrowserAssistRuntimeAdapter {
  private readonly now: () => string;
  private readonly transport: string;
  private readonly runtimeTargetPrefix: string;
  private readonly launcher: NonNullable<SystemBrowserRuntimeAdapterOptions['launcher']>;
  private readonly stateBySessionId = new Map<string, BrowserAssistRuntimeState>();

  constructor(options: SystemBrowserRuntimeAdapterOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.transport = options.transport ?? 'system-browser';
    this.runtimeTargetPrefix = options.runtimeTargetPrefix ?? 'system-target';
    this.launcher = options.launcher ?? openUrlInSystemBrowser;
  }

  async openTarget(request: BrowserRuntimeOpenRequest): Promise<BrowserAssistOpenReceipt> {
    await this.launcher(request.target.entryUrl, {
      sessionId: request.sessionId,
      target: cloneValue(request.target),
      activeCheckpoint: cloneValue(request.activeCheckpoint),
    });

    const openedAt = this.now();
    const receipt = createRuntimeReceipt({
      sessionId: request.sessionId,
      openedAt,
      updatedAt: openedAt,
      transport: this.transport,
      runtimeTargetId: `${this.runtimeTargetPrefix}:${request.sessionId}`,
      targetUrl: request.target.entryUrl,
      currentTargetUrl: request.target.entryUrl,
      lastOpenedUrl: request.target.entryUrl,
      activeCheckpointId: request.activeCheckpoint.id,
    });

    this.stateBySessionId.set(request.sessionId, cloneValue(receipt));
    return cloneValue(receipt);
  }

  async handoffCheckpoint(request: BrowserRuntimeCheckpointHandoffRequest): Promise<BrowserAssistRuntimeState> {
    const previousState = this.stateBySessionId.get(request.sessionId);
    const nextState = createRuntimeState({
      sessionId: request.sessionId,
      transport: previousState?.transport ?? this.transport,
      runtimeTargetId: previousState?.runtimeTargetId ?? `${this.runtimeTargetPrefix}:${request.sessionId}`,
      currentTargetUrl: request.targetUrl || previousState?.currentTargetUrl || request.target.entryUrl,
      lastOpenedUrl: previousState?.lastOpenedUrl || request.target.entryUrl,
      activeCheckpointId: request.nextCheckpoint ? request.nextCheckpoint.id : null,
      updatedAt: request.handedOffAt || this.now(),
    });

    this.stateBySessionId.set(request.sessionId, cloneValue(nextState));
    return cloneValue(nextState);
  }

  async getRuntimeState(input: { sessionId: string }): Promise<BrowserAssistRuntimeState | null> {
    const state = this.stateBySessionId.get(input.sessionId);
    return state ? cloneValue(state) : null;
  }
}

export class ExecutorBackedBrowserHostClient implements BrowserHostRuntimeClient {
  private readonly executor: BrowserHostExecutor;

  constructor(options: ExecutorBackedBrowserHostClientOptions) {
    if (!options?.executor || typeof options.executor.openTarget !== 'function') {
      throw new TypeError('ExecutorBackedBrowserHostClient requires an executor with openTarget().');
    }

    this.executor = options.executor;
  }

  async getCapabilities(input: {
    sessionId?: string;
    runtimeState?: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserHostCapabilities>> {
    if (typeof this.executor.getCapabilities !== 'function') {
      return defaultBrowserHostCapabilities();
    }

    return cloneValue(await this.executor.getCapabilities(cloneValue(input)));
  }

  async openTarget(input: BrowserRuntimeOpenRequest): Promise<Partial<BrowserAssistOpenReceipt>> {
    const receipt = await this.executor.openTarget(cloneValue(input));
    return cloneValue(receipt);
  }

  async handoffCheckpoint(input: BrowserRuntimeCheckpointHandoffRequest & {
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null> {
    if (typeof this.executor.handoffCheckpoint !== 'function') {
      return null;
    }

    const runtimeState = await this.executor.handoffCheckpoint(cloneValue(input));
    return runtimeState ? cloneValue(runtimeState) : null;
  }

  async getRuntimeState(input: {
    sessionId: string;
    target: BrowserAssistTarget;
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null> {
    if (typeof this.executor.getRuntimeState !== 'function') {
      return null;
    }

    const runtimeState = await this.executor.getRuntimeState(cloneValue(input));
    return runtimeState ? cloneValue(runtimeState) : null;
  }
}

export class InMemoryBrowserHostExecutor implements BrowserHostExecutor {
  readonly executions: BrowserHostExecutionRecord[] = [];
  private readonly now: () => string;
  private readonly transport: string;
  private readonly runtimeTargetPrefix: string;
  private readonly stateBySessionId = new Map<string, BrowserAssistRuntimeState>();

  constructor(options: InMemoryBrowserHostExecutorOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.transport = options.transport ?? 'browser-host';
    this.runtimeTargetPrefix = options.runtimeTargetPrefix ?? 'browser-target';
  }

  async getCapabilities(): Promise<Partial<BrowserHostCapabilities>> {
    return defaultBrowserHostCapabilities({
      hostAvailable: true,
      activeTarget: null,
      runtimeInspection: true,
      checkpointHandoff: true,
    });
  }

  async openTarget(input: BrowserRuntimeOpenRequest): Promise<Partial<BrowserAssistOpenReceipt>> {
    const openedAt = this.now();
    const receipt = createRuntimeReceipt({
      sessionId: input.sessionId,
      openedAt,
      updatedAt: openedAt,
      transport: this.transport,
      runtimeTargetId: `${this.runtimeTargetPrefix}:${input.sessionId}`,
      targetUrl: input.target.entryUrl,
      currentTargetUrl: input.target.entryUrl,
      lastOpenedUrl: input.target.entryUrl,
      activeCheckpointId: input.activeCheckpoint.id,
    });

    this.stateBySessionId.set(input.sessionId, cloneValue(receipt));
    this.executions.push({
      method: 'openTarget',
      input: cloneValue(input),
      output: cloneValue(receipt),
    });
    return cloneValue(receipt);
  }

  async handoffCheckpoint(input: BrowserRuntimeCheckpointHandoffRequest & {
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null> {
    const previousState = this.stateBySessionId.get(input.sessionId) ?? input.runtimeState ?? null;
    const nextState = createRuntimeState({
      sessionId: input.sessionId,
      transport: previousState?.transport ?? this.transport,
      runtimeTargetId: previousState?.runtimeTargetId ?? `${this.runtimeTargetPrefix}:${input.sessionId}`,
      currentTargetUrl: input.targetUrl || previousState?.currentTargetUrl || input.target.entryUrl,
      lastOpenedUrl: previousState?.lastOpenedUrl || input.target.entryUrl,
      activeCheckpointId: input.nextCheckpoint ? input.nextCheckpoint.id : null,
      updatedAt: input.handedOffAt || this.now(),
    });

    this.stateBySessionId.set(input.sessionId, cloneValue(nextState));
    this.executions.push({
      method: 'handoffCheckpoint',
      input: cloneValue(input),
      output: cloneValue(nextState),
    });
    return cloneValue(nextState);
  }

  async getRuntimeState(input: {
    sessionId: string;
    target: BrowserAssistTarget;
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null> {
    const runtimeState = this.stateBySessionId.get(input.sessionId) ?? input.runtimeState ?? null;
    this.executions.push({
      method: 'getRuntimeState',
      input: cloneValue(input),
      output: runtimeState ? cloneValue(runtimeState) : null,
    });
    return runtimeState ? cloneValue(runtimeState) : null;
  }
}

export class BrowserHostRuntimeAdapter implements BrowserAssistRuntimeAdapter {
  private readonly client: BrowserHostRuntimeClient;
  private readonly now: () => string;
  private readonly transport: string;
  private readonly stateBySessionId = new Map<string, BrowserAssistRuntimeState>();

  constructor(options: BrowserHostRuntimeAdapterOptions) {
    this.client = resolveBrowserHostRuntimeClient(options);
    this.now = options.now ?? (() => new Date().toISOString());
    this.transport = options.transport ?? 'browser-host';
  }

  async getCapabilities(input: {
    sessionId?: string;
    runtimeState?: BrowserAssistRuntimeState | null;
  } = {}): Promise<BrowserHostCapabilities> {
    if (typeof this.client.getCapabilities !== 'function') {
      return defaultBrowserHostCapabilities({
        hostAvailable: true,
        activeTarget: input.runtimeState?.runtimeTargetId ? true : null,
        runtimeInspection: typeof this.client.getRuntimeState === 'function',
        checkpointHandoff: typeof this.client.handoffCheckpoint === 'function',
      });
    }

    return normalizeBrowserHostCapabilities(await this.client.getCapabilities(cloneValue(input)));
  }

  async openTarget(request: BrowserRuntimeOpenRequest): Promise<BrowserAssistOpenReceipt> {
    const clientReceipt = await this.client.openTarget(cloneValue(request));
    const openedAt = clientReceipt.openedAt ?? this.now();
    const receipt = createRuntimeReceipt({
      sessionId: request.sessionId,
      openedAt,
      updatedAt: clientReceipt.updatedAt ?? openedAt,
      transport: clientReceipt.transport ?? this.transport,
      runtimeTargetId: clientReceipt.runtimeTargetId,
      targetUrl: clientReceipt.targetUrl ?? request.target.entryUrl,
      currentTargetUrl: clientReceipt.currentTargetUrl ?? request.target.entryUrl,
      lastOpenedUrl: clientReceipt.lastOpenedUrl ?? request.target.entryUrl,
      activeCheckpointId: clientReceipt.activeCheckpointId ?? request.activeCheckpoint.id,
    });

    this.stateBySessionId.set(request.sessionId, cloneValue(receipt));
    return cloneValue(receipt);
  }

  async handoffCheckpoint(request: BrowserRuntimeCheckpointHandoffRequest): Promise<BrowserAssistRuntimeState> {
    const previousState = this.stateBySessionId.get(request.sessionId) ?? null;

    if (typeof this.client.handoffCheckpoint === 'function') {
      const clientState = await this.client.handoffCheckpoint({
        ...cloneValue(request),
        runtimeState: previousState ? cloneValue(previousState) : null,
      });

      const nextState = createRuntimeState({
        sessionId: request.sessionId,
        transport: clientState?.transport ?? previousState?.transport ?? this.transport,
        runtimeTargetId: clientState?.runtimeTargetId ?? previousState?.runtimeTargetId,
        currentTargetUrl: clientState?.currentTargetUrl ?? request.targetUrl ?? previousState?.currentTargetUrl ?? request.target.entryUrl,
        lastOpenedUrl: clientState?.lastOpenedUrl ?? previousState?.lastOpenedUrl ?? request.target.entryUrl,
        activeCheckpointId: clientState?.activeCheckpointId ?? (request.nextCheckpoint ? request.nextCheckpoint.id : null),
        updatedAt: clientState?.updatedAt ?? request.handedOffAt ?? this.now(),
      });

      this.stateBySessionId.set(request.sessionId, cloneValue(nextState));
      return cloneValue(nextState);
    }

    const nextState = createRuntimeState({
      sessionId: request.sessionId,
      transport: previousState?.transport ?? this.transport,
      runtimeTargetId: previousState?.runtimeTargetId,
      currentTargetUrl: request.targetUrl ?? previousState?.currentTargetUrl ?? request.target.entryUrl,
      lastOpenedUrl: previousState?.lastOpenedUrl ?? request.target.entryUrl,
      activeCheckpointId: request.nextCheckpoint ? request.nextCheckpoint.id : null,
      updatedAt: request.handedOffAt ?? this.now(),
    });

    this.stateBySessionId.set(request.sessionId, cloneValue(nextState));
    return cloneValue(nextState);
  }

  async getRuntimeState(input: { sessionId: string; target: BrowserAssistTarget }): Promise<BrowserAssistRuntimeState | null> {
    const previousState = this.stateBySessionId.get(input.sessionId) ?? null;

    if (typeof this.client.getRuntimeState === 'function') {
      const clientState = await this.client.getRuntimeState({
        sessionId: input.sessionId,
        target: cloneValue(input.target),
        runtimeState: previousState ? cloneValue(previousState) : null,
      });

      if (clientState) {
        const nextState = createRuntimeState({
          sessionId: input.sessionId,
          transport: clientState.transport ?? previousState?.transport ?? this.transport,
          runtimeTargetId: clientState.runtimeTargetId ?? previousState?.runtimeTargetId,
          currentTargetUrl: clientState.currentTargetUrl ?? previousState?.currentTargetUrl ?? input.target.entryUrl,
          lastOpenedUrl: clientState.lastOpenedUrl ?? previousState?.lastOpenedUrl ?? input.target.entryUrl,
          activeCheckpointId: clientState.activeCheckpointId ?? previousState?.activeCheckpointId ?? null,
          updatedAt: clientState.updatedAt ?? previousState?.updatedAt ?? this.now(),
        });

        this.stateBySessionId.set(input.sessionId, cloneValue(nextState));
        return cloneValue(nextState);
      }
    }

    return previousState ? cloneValue(previousState) : null;
  }
}

export class InMemoryBrowserAssistSessionStore implements BrowserAssistSessionStore {
  private readonly sessions = new Map<string, BrowserAssistSession>();

  async getSession(sessionId: string): Promise<BrowserAssistSession | undefined> {
    const session = this.sessions.get(sessionId);
    return session ? cloneValue(session) : undefined;
  }

  async saveSession(session: BrowserAssistSession): Promise<void> {
    this.sessions.set(session.id, cloneValue(session));
  }
}

export function createBrowserAssistService(options: CreateBrowserAssistServiceOptions): BrowserAssistService {
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? randomUUID;

  return {
    async startHomeTaxAssist(input) {
      const sessionId = createId();
      const createdAt = now();
      const target = createTarget(input);
      const checkpoints = createHomeTaxCheckpoints(createId);
      const activeCheckpoint = checkpoints[0];
      const openReceipt = normalizeRuntimeReceipt(
        await options.runtime.openTarget({ sessionId, target, activeCheckpoint }),
        { sessionId, target, activeCheckpoint },
      );

      const session: BrowserAssistSession = {
        schemaVersion: 2,
        id: sessionId,
        status: 'waiting_for_user',
        requestedBy: input.requestedBy,
        filingDraftId: input.filingDraftId,
        target,
        currentCheckpointId: activeCheckpoint.id,
        checkpoints,
        openReceipt,
        runtimeState: createRuntimeState({
          sessionId,
          transport: openReceipt.transport,
          runtimeTargetId: openReceipt.runtimeTargetId,
          currentTargetUrl: openReceipt.currentTargetUrl,
          lastOpenedUrl: openReceipt.lastOpenedUrl,
          activeCheckpointId: activeCheckpoint.id,
          updatedAt: openReceipt.openedAt,
        }),
        metadata: cloneValue(input.metadata ?? {}),
        events: [
          createEvent('session-started', createdAt, `Started HomeTax assist session for ${target.entryUrl}.`),
          createEvent('target-opened', openReceipt.openedAt, `Opened ${target.entryUrl} via ${openReceipt.transport}.`, activeCheckpoint.id),
        ],
        createdAt,
        updatedAt: openReceipt.openedAt,
      };

      await options.store.saveSession(session);
      return createSnapshot(session);
    },

    async resumeHomeTaxAssist(input) {
      const session = await getRequiredSession(options.store, input.sessionId);
      if (session.status === 'completed') {
        throw new BrowserAssistSessionError('SESSION_COMPLETED', `Session ${input.sessionId} is already completed.`);
      }
      if (session.status === 'stopped') {
        throw new BrowserAssistSessionError('SESSION_STOPPED', `Session ${input.sessionId} has been stopped.`);
      }

      const activeCheckpoint = getActiveCheckpoint(session);
      if (!activeCheckpoint) {
        throw new BrowserAssistSessionError('CHECKPOINT_MISSING', `Session ${input.sessionId} does not have an active checkpoint.`);
      }

      const checkpointId = input.checkpointId || activeCheckpoint.id;
      if (checkpointId !== activeCheckpoint.id) {
        throw new BrowserAssistSessionError(
          'CHECKPOINT_MISMATCH',
          `Session ${input.sessionId} expects checkpoint ${activeCheckpoint.id}, not ${checkpointId}.`,
        );
      }

      const completedAt = now();
      const completedCheckpoint = markCheckpointCompleted(activeCheckpoint, input.note);
      replaceCheckpoint(session, completedCheckpoint);
      const nextCheckpoint = getNextPendingCheckpoint(session);
      session.events.push(
        createEvent(
          'checkpoint-completed',
          completedAt,
          input.note ? `Completed ${completedCheckpoint.title}: ${input.note}` : `Completed ${completedCheckpoint.title}.`,
          completedCheckpoint.id,
        ),
      );
      session.updatedAt = completedAt;

      if (nextCheckpoint) {
        session.currentCheckpointId = nextCheckpoint.id;
        session.runtimeState = await handoffRuntimeCheckpoint(options.runtime, {
          session,
          completedCheckpoint,
          nextCheckpoint,
          handedOffAt: completedAt,
        });
        session.events.push(
          createEvent('checkpoint-handed-off', completedAt, `Handed off runtime context to ${nextCheckpoint.title}.`, nextCheckpoint.id),
        );
      } else {
        session.currentCheckpointId = null;
        session.status = 'completed';
        session.runtimeState = await handoffRuntimeCheckpoint(options.runtime, {
          session,
          completedCheckpoint,
          nextCheckpoint: null,
          handedOffAt: completedAt,
        });
        session.events.push(createEvent('session-completed', completedAt, 'All browser assist checkpoints completed.'));
      }

      await options.store.saveSession(session);
      return createSnapshot(session);
    },

    async getHomeTaxAssistStatus(sessionId) {
      const session = await getRequiredSession(options.store, sessionId);
      const runtimeState = await getRuntimeStateOrFallback(options.runtime, session);
      if (runtimeState) {
        session.runtimeState = runtimeState;
      }
      return createSnapshot(session);
    },

    async stopHomeTaxAssist(input) {
      const session = await getRequiredSession(options.store, input.sessionId);
      if (session.status === 'stopped') {
        return createSnapshot(session);
      }
      if (!String(input.reason || '').trim()) {
        throw new BrowserAssistSessionError('STOP_REASON_REQUIRED', 'A non-empty stop reason is required.');
      }

      const stoppedAt = now();
      session.status = 'stopped';
      session.currentCheckpointId = null;
      session.updatedAt = stoppedAt;
      session.runtimeState = await handoffRuntimeCheckpoint(options.runtime, {
        session,
        completedCheckpoint: getActiveCheckpoint(session),
        nextCheckpoint: null,
        handedOffAt: stoppedAt,
      });
      session.events.push(createEvent('session-stopped', stoppedAt, input.note ? `${input.reason}: ${input.note}` : input.reason));
      await options.store.saveSession(session);
      return createSnapshot(session);
    },
  };
}

export function createBrowserAssistToolAdapter(service: BrowserAssistService): BrowserAssistToolAdapter {
  return {
    startHomeTaxAssist(input) {
      return service.startHomeTaxAssist(input);
    },
    resumeHomeTaxAssist(input) {
      return service.resumeHomeTaxAssist(input);
    },
    getHomeTaxAssistStatus(input) {
      return service.getHomeTaxAssistStatus(input.sessionId);
    },
    stopHomeTaxAssist(input) {
      return service.stopHomeTaxAssist(input);
    },
  };
}

function createTarget(input: StartHomeTaxAssistInput): BrowserAssistTarget {
  const entryUrl = String(input.targetUrl || '').trim();
  if (!entryUrl) {
    throw new BrowserAssistSessionError('TARGET_URL_REQUIRED', 'A non-empty targetUrl is required to start HomeTax assist.');
  }
  return {
    flow: 'hometax-filing',
    entryUrl,
    label: String(input.targetLabel || '').trim() || 'HomeTax filing entry',
  };
}

function createHomeTaxCheckpoints(createId: () => string): BrowserAssistCheckpoint[] {
  return [
    {
      id: createId(),
      code: 'user-authentication',
      title: 'Authenticate in HomeTax',
      instructions: 'Complete the required HomeTax login or certificate flow in the opened browser session.',
      status: 'pending',
      blocking: true,
    },
    {
      id: createId(),
      code: 'target-page-review',
      title: 'Confirm the target page is ready',
      instructions: 'Resume once the HomeTax page is open at the intended filing screen and ready for assisted or manual entry.',
      status: 'pending',
      blocking: true,
    },
  ];
}

function createSnapshot(session: BrowserAssistSession): BrowserAssistStatusSnapshot {
  const clonedSession = cloneValue(session);
  const activeCheckpoint = getActiveCheckpoint(clonedSession);
  return {
    session: clonedSession,
    activeCheckpoint: activeCheckpoint ? cloneValue(activeCheckpoint) : null,
  };
}

async function getRequiredSession(store: BrowserAssistSessionStore, sessionId: string): Promise<BrowserAssistSession> {
  const session = await store.getSession(sessionId);
  if (!session) {
    throw new BrowserAssistSessionError('SESSION_NOT_FOUND', `Session ${sessionId} was not found.`);
  }
  return session;
}

function getActiveCheckpoint(session: BrowserAssistSession): BrowserAssistCheckpoint | null {
  if (!session.currentCheckpointId) {
    return null;
  }
  return session.checkpoints.find((checkpoint) => checkpoint.id === session.currentCheckpointId) || null;
}

function getNextPendingCheckpoint(session: BrowserAssistSession): BrowserAssistCheckpoint | null {
  return session.checkpoints.find((checkpoint) => checkpoint.status === 'pending') || null;
}

function markCheckpointCompleted(checkpoint: BrowserAssistCheckpoint, note?: string): BrowserAssistCheckpoint {
  const trimmedNote = typeof note === 'string' ? note.trim() : '';
  return {
    ...checkpoint,
    status: 'completed',
    completionNote: trimmedNote || undefined,
  };
}

function replaceCheckpoint(session: BrowserAssistSession, updatedCheckpoint: BrowserAssistCheckpoint): void {
  session.checkpoints = session.checkpoints.map((checkpoint) =>
    checkpoint.id === updatedCheckpoint.id ? updatedCheckpoint : checkpoint,
  );
}

function createEvent(type: BrowserAssistEventType, at: string, detail: string, checkpointId?: string): BrowserAssistEvent {
  return { type, at, detail, checkpointId };
}

async function handoffRuntimeCheckpoint(
  runtime: BrowserAssistRuntimeAdapter,
  input: {
    session: BrowserAssistSession;
    completedCheckpoint: BrowserAssistCheckpoint | null;
    nextCheckpoint: BrowserAssistCheckpoint | null;
    handedOffAt: string;
  },
): Promise<BrowserAssistRuntimeState> {
  const previousState = input.session.runtimeState || input.session.openReceipt;
  if (typeof runtime.handoffCheckpoint === 'function') {
    const runtimeState = await runtime.handoffCheckpoint({
      sessionId: input.session.id,
      target: cloneValue(input.session.target),
      targetUrl: previousState.currentTargetUrl || input.session.target.entryUrl,
      completedCheckpoint: input.completedCheckpoint ? cloneValue(input.completedCheckpoint) : null,
      nextCheckpoint: input.nextCheckpoint ? cloneValue(input.nextCheckpoint) : null,
      handedOffAt: input.handedOffAt,
    });

    return normalizeRuntimeState(runtimeState, {
      session: input.session,
      nextCheckpoint: input.nextCheckpoint,
      handedOffAt: input.handedOffAt,
    });
  }

  return createRuntimeState({
    sessionId: input.session.id,
    transport: previousState.transport || 'unknown-runtime',
    runtimeTargetId: previousState.runtimeTargetId,
    currentTargetUrl: previousState.currentTargetUrl || input.session.target.entryUrl,
    lastOpenedUrl: previousState.lastOpenedUrl || input.session.target.entryUrl,
    activeCheckpointId: input.nextCheckpoint ? input.nextCheckpoint.id : null,
    updatedAt: input.handedOffAt,
  });
}

async function getRuntimeStateOrFallback(
  runtime: BrowserAssistRuntimeAdapter,
  session: BrowserAssistSession,
): Promise<BrowserAssistRuntimeState | null> {
  if (typeof runtime.getRuntimeState === 'function') {
    const runtimeState = await runtime.getRuntimeState({
      sessionId: session.id,
      target: cloneValue(session.target),
    });
    if (runtimeState) {
      return normalizeRuntimeState(runtimeState, {
        session,
        nextCheckpoint: getActiveCheckpoint(session),
        handedOffAt: session.updatedAt,
      });
    }
  }
  return session.runtimeState || null;
}

function normalizeRuntimeReceipt(
  receipt: BrowserAssistOpenReceipt,
  context: { sessionId: string; target: BrowserAssistTarget; activeCheckpoint: BrowserAssistCheckpoint },
): BrowserAssistOpenReceipt {
  const openedAt = receipt?.openedAt || new Date().toISOString();
  const targetUrl = receipt?.targetUrl || receipt?.currentTargetUrl || context.target.entryUrl;
  return createRuntimeReceipt({
    sessionId: context.sessionId,
    openedAt,
    updatedAt: receipt?.updatedAt || openedAt,
    transport: receipt?.transport || 'unknown-runtime',
    runtimeTargetId: receipt?.runtimeTargetId,
    targetUrl,
    currentTargetUrl: receipt?.currentTargetUrl || context.target.entryUrl,
    lastOpenedUrl: receipt?.lastOpenedUrl || targetUrl,
    activeCheckpointId: receipt?.activeCheckpointId || context.activeCheckpoint.id,
  });
}

function normalizeRuntimeState(
  runtimeState: BrowserAssistRuntimeState,
  context: { session: BrowserAssistSession; nextCheckpoint: BrowserAssistCheckpoint | null; handedOffAt: string },
): BrowserAssistRuntimeState {
  const activeCheckpoint = context.nextCheckpoint || getActiveCheckpoint(context.session);
  return createRuntimeState({
    sessionId: context.session.id,
    transport: runtimeState?.transport || 'unknown-runtime',
    runtimeTargetId: runtimeState?.runtimeTargetId,
    currentTargetUrl: runtimeState?.currentTargetUrl || context.session.target.entryUrl,
    lastOpenedUrl: runtimeState?.lastOpenedUrl || runtimeState?.currentTargetUrl || context.session.target.entryUrl,
    activeCheckpointId: activeCheckpoint ? activeCheckpoint.id : null,
    updatedAt: runtimeState?.updatedAt || context.handedOffAt || context.session.updatedAt,
  });
}

function createRuntimeReceipt(input: BrowserAssistOpenReceipt): BrowserAssistOpenReceipt {
  return {
    sessionId: input.sessionId,
    targetUrl: input.targetUrl,
    openedAt: input.openedAt,
    transport: input.transport,
    runtimeTargetId: input.runtimeTargetId,
    currentTargetUrl: input.currentTargetUrl,
    lastOpenedUrl: input.lastOpenedUrl,
    activeCheckpointId: input.activeCheckpointId,
    updatedAt: input.updatedAt,
  };
}

function createRuntimeState(input: BrowserAssistRuntimeState): BrowserAssistRuntimeState {
  return {
    sessionId: input.sessionId,
    transport: input.transport,
    runtimeTargetId: input.runtimeTargetId,
    currentTargetUrl: input.currentTargetUrl,
    lastOpenedUrl: input.lastOpenedUrl,
    activeCheckpointId: input.activeCheckpointId ?? null,
    updatedAt: input.updatedAt,
  };
}

function defaultBrowserHostCapabilities(overrides: Partial<BrowserHostCapabilities> = {}): BrowserHostCapabilities {
  return {
    hostAvailable: true,
    activeTarget: null,
    runtimeInspection: false,
    checkpointHandoff: false,
    ...cloneValue(overrides),
  };
}

function normalizeBrowserHostCapabilities(input: Partial<BrowserHostCapabilities> | null | undefined): BrowserHostCapabilities {
  return {
    hostAvailable: input?.hostAvailable ?? true,
    activeTarget: input?.activeTarget ?? null,
    runtimeInspection: input?.runtimeInspection ?? false,
    checkpointHandoff: input?.checkpointHandoff ?? false,
  };
}

function resolveBrowserHostRuntimeClient(
  options: BrowserHostRuntimeAdapterOptions,
): BrowserHostRuntimeClient {
  if (options?.client && typeof options.client.openTarget === 'function') {
    return options.client;
  }

  if (options?.executor && typeof options.executor.openTarget === 'function') {
    return new ExecutorBackedBrowserHostClient({ executor: options.executor });
  }

  throw new TypeError(
    'BrowserHostRuntimeAdapter requires either client.openTarget() or executor.openTarget().',
  );
}

async function openUrlInSystemBrowser(targetUrl: string): Promise<void> {
  if (process.platform === 'win32') {
    await execFileAsync('cmd.exe', ['/c', 'start', '', targetUrl], { windowsHide: true });
    return;
  }
  if (process.platform === 'darwin') {
    await execFileAsync('open', [targetUrl]);
    return;
  }
  await execFileAsync('xdg-open', [targetUrl]);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

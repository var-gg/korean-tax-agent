import type {
  BrowserAssistOpenReceipt,
  BrowserAssistRuntimeState,
  BrowserHostExecutor,
  BrowserRuntimeCheckpointHandoffRequest,
  BrowserRuntimeOpenRequest,
} from './index.js';

export type OpenClawBrowserHostOperation = 'openTarget' | 'getRuntimeState' | 'handoffCheckpoint';

export type OpenClawBrowserHostErrorCode =
  | 'OPENCLAW_RELAY_UNAVAILABLE'
  | 'OPENCLAW_TARGET_UNAVAILABLE'
  | 'OPENCLAW_TARGET_NOT_FOUND'
  | 'OPENCLAW_SESSION_MISMATCH'
  | 'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED';

export interface OpenClawRelayTarget {
  targetId: string;
  sessionId?: string | null;
  url?: string;
  title?: string;
  available?: boolean;
  attached?: boolean;
  updatedAt?: string;
}

export interface OpenClawRelayOpenRequest {
  sessionId: string;
  url: string;
  label: string;
}

export interface OpenClawRelayAttachRequest {
  sessionId: string;
  url: string;
  label: string;
}

export interface OpenClawBrowserRelay {
  open(input: OpenClawRelayOpenRequest): Promise<OpenClawRelayTarget> | OpenClawRelayTarget;
  attach?(input: OpenClawRelayAttachRequest): Promise<OpenClawRelayTarget | null> | OpenClawRelayTarget | null;
  getTarget?(input: { targetId: string }): Promise<OpenClawRelayTarget | null> | OpenClawRelayTarget | null;
}

export interface OpenClawBrowserHostExecutorOptions {
  relay: OpenClawBrowserRelay;
  now?: () => string;
  transport?: string;
}

export interface OpenClawBrowserHostExecutionRecord {
  method: OpenClawBrowserHostOperation;
  sessionId: string;
  runtimeTargetId?: string;
  usedAttachedTarget?: boolean;
}

export interface InMemoryOpenClawBrowserRelayOptions {
  now?: () => string;
  targetPrefix?: string;
}

export interface InMemoryOpenClawRelayOperationRecord {
  method: 'open' | 'attach' | 'getTarget';
  sessionId?: string;
  targetId?: string;
}

interface OpenClawSessionBinding {
  sessionId: string;
  runtimeTargetId: string;
  lastOpenedUrl: string;
  currentTargetUrl: string;
}

export class OpenClawBrowserHostError extends Error {
  readonly code: OpenClawBrowserHostErrorCode;
  readonly operation: OpenClawBrowserHostOperation;
  override cause?: unknown;

  constructor(
    code: OpenClawBrowserHostErrorCode,
    operation: OpenClawBrowserHostOperation,
    message: string,
    options: { cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'OpenClawBrowserHostError';
    this.code = code;
    this.operation = operation;
    this.cause = options.cause;
  }
}

export class OpenClawBrowserHostExecutor implements BrowserHostExecutor {
  readonly executions: OpenClawBrowserHostExecutionRecord[] = [];
  private readonly relay: OpenClawBrowserRelay;
  private readonly now: () => string;
  private readonly transport: string;
  private readonly bindingBySessionId = new Map<string, OpenClawSessionBinding>();

  constructor(options: OpenClawBrowserHostExecutorOptions) {
    if (!options?.relay || typeof options.relay.open !== 'function') {
      throw new TypeError('OpenClawBrowserHostExecutor requires relay.open().');
    }

    this.relay = options.relay;
    this.now = options.now ?? (() => new Date().toISOString());
    this.transport = options.transport ?? 'openclaw-browser-relay';
  }

  async openTarget(input: BrowserRuntimeOpenRequest): Promise<Partial<BrowserAssistOpenReceipt>> {
    const opened = await this.openOrAttachTarget(input);
    const currentTargetUrl = opened.target.url ?? input.target.entryUrl;
    const openedAt = opened.target.updatedAt ?? this.now();

    this.bindingBySessionId.set(input.sessionId, {
      sessionId: input.sessionId,
      runtimeTargetId: opened.target.targetId,
      lastOpenedUrl: input.target.entryUrl,
      currentTargetUrl,
    });
    this.executions.push({
      method: 'openTarget',
      sessionId: input.sessionId,
      runtimeTargetId: opened.target.targetId,
      usedAttachedTarget: opened.usedAttachedTarget,
    });

    return {
      transport: this.transport,
      runtimeTargetId: opened.target.targetId,
      targetUrl: input.target.entryUrl,
      currentTargetUrl,
      lastOpenedUrl: input.target.entryUrl,
      activeCheckpointId: input.activeCheckpoint.id,
      openedAt,
      updatedAt: openedAt,
    };
  }

  async getRuntimeState(input: {
    sessionId: string;
    target: { entryUrl: string };
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null> {
    const { binding, target } = await this.readBoundTarget({
      operation: 'getRuntimeState',
      sessionId: input.sessionId,
      entryUrl: input.target.entryUrl,
      runtimeState: input.runtimeState,
    });
    const currentTargetUrl = target.url ?? binding.currentTargetUrl ?? input.target.entryUrl;
    const lastOpenedUrl = input.runtimeState?.lastOpenedUrl ?? binding.lastOpenedUrl ?? input.target.entryUrl;
    const updatedAt = target.updatedAt ?? this.now();

    this.bindingBySessionId.set(input.sessionId, {
      ...binding,
      currentTargetUrl,
      lastOpenedUrl,
    });
    this.executions.push({
      method: 'getRuntimeState',
      sessionId: input.sessionId,
      runtimeTargetId: target.targetId,
    });

    return {
      transport: this.transport,
      runtimeTargetId: target.targetId,
      currentTargetUrl,
      lastOpenedUrl,
      activeCheckpointId: input.runtimeState?.activeCheckpointId ?? null,
      updatedAt,
    };
  }

  async handoffCheckpoint(
    input: BrowserRuntimeCheckpointHandoffRequest & {
      runtimeState: BrowserAssistRuntimeState | null;
    },
  ): Promise<Partial<BrowserAssistRuntimeState> | null> {
    const { binding, target } = await this.readBoundTarget({
      operation: 'handoffCheckpoint',
      sessionId: input.sessionId,
      entryUrl: input.target.entryUrl,
      runtimeState: input.runtimeState,
    });
    const currentTargetUrl = target.url ?? input.targetUrl ?? binding.currentTargetUrl ?? input.target.entryUrl;
    const lastOpenedUrl = input.runtimeState?.lastOpenedUrl ?? binding.lastOpenedUrl ?? input.target.entryUrl;

    this.bindingBySessionId.set(input.sessionId, {
      ...binding,
      currentTargetUrl,
      lastOpenedUrl,
    });
    this.executions.push({
      method: 'handoffCheckpoint',
      sessionId: input.sessionId,
      runtimeTargetId: target.targetId,
    });

    return {
      transport: this.transport,
      runtimeTargetId: target.targetId,
      currentTargetUrl,
      lastOpenedUrl,
      activeCheckpointId: input.nextCheckpoint ? input.nextCheckpoint.id : null,
      updatedAt: input.handedOffAt || target.updatedAt || this.now(),
    };
  }

  private async openOrAttachTarget(input: BrowserRuntimeOpenRequest): Promise<{
    target: OpenClawRelayTarget;
    usedAttachedTarget: boolean;
  }> {
    if (typeof this.relay.attach === 'function') {
      const attachedTarget = await this.callRelay('openTarget', () =>
        this.relay.attach!({
          sessionId: input.sessionId,
          url: input.target.entryUrl,
          label: input.target.label,
        }),
      );
      if (attachedTarget) {
        return {
          target: this.validateTarget({
            operation: 'openTarget',
            sessionId: input.sessionId,
            target: attachedTarget,
            allowMissing: false,
          }),
          usedAttachedTarget: true,
        };
      }
    }

    const openedTarget = await this.callRelay('openTarget', () =>
      this.relay.open({
        sessionId: input.sessionId,
        url: input.target.entryUrl,
        label: input.target.label,
      }),
    );
    return {
      target: this.validateTarget({
        operation: 'openTarget',
        sessionId: input.sessionId,
        target: openedTarget,
        allowMissing: false,
      }),
      usedAttachedTarget: false,
    };
  }

  private async readBoundTarget(input: {
    operation: Exclude<OpenClawBrowserHostOperation, 'openTarget'>;
    sessionId: string;
    entryUrl: string;
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<{ binding: OpenClawSessionBinding; target: OpenClawRelayTarget }> {
    const binding = this.resolveBinding(input);
    const getTarget = this.relay.getTarget;

    if (typeof getTarget !== 'function') {
      throw new OpenClawBrowserHostError(
        'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED',
        input.operation,
        `OpenClaw relay does not support ${input.operation} target inspection.`,
      );
    }

    const target = await this.callRelay(input.operation, () => getTarget.call(this.relay, { targetId: binding.runtimeTargetId }));

    return {
      binding,
      target: this.validateTarget({
        operation: input.operation,
        sessionId: input.sessionId,
        target,
        allowMissing: false,
        expectedTargetId: binding.runtimeTargetId,
      }),
    };
  }

  private resolveBinding(input: {
    operation: Exclude<OpenClawBrowserHostOperation, 'openTarget'>;
    sessionId: string;
    entryUrl: string;
    runtimeState: BrowserAssistRuntimeState | null;
  }): OpenClawSessionBinding {
    const existingBinding = this.bindingBySessionId.get(input.sessionId);
    const runtimeTargetId = input.runtimeState?.runtimeTargetId ?? existingBinding?.runtimeTargetId;

    if (!runtimeTargetId) {
      throw new OpenClawBrowserHostError(
        'OPENCLAW_TARGET_UNAVAILABLE',
        input.operation,
        `No OpenClaw target is attached for session ${input.sessionId}.`,
      );
    }

    return {
      sessionId: input.sessionId,
      runtimeTargetId,
      lastOpenedUrl: input.runtimeState?.lastOpenedUrl ?? existingBinding?.lastOpenedUrl ?? input.entryUrl,
      currentTargetUrl: input.runtimeState?.currentTargetUrl ?? existingBinding?.currentTargetUrl ?? input.entryUrl,
    };
  }

  private validateTarget(input: {
    operation: OpenClawBrowserHostOperation;
    sessionId: string;
    target: OpenClawRelayTarget | null;
    allowMissing: boolean;
    expectedTargetId?: string;
  }): OpenClawRelayTarget {
    if (!input.target) {
      if (input.allowMissing) {
        throw new OpenClawBrowserHostError(
          'OPENCLAW_TARGET_UNAVAILABLE',
          input.operation,
          `No OpenClaw target is attached for session ${input.sessionId}.`,
        );
      }

      throw new OpenClawBrowserHostError(
        'OPENCLAW_TARGET_NOT_FOUND',
        input.operation,
        input.expectedTargetId
          ? `OpenClaw target ${input.expectedTargetId} was not found for session ${input.sessionId}.`
          : `OpenClaw target lookup returned no result for session ${input.sessionId}.`,
      );
    }

    const targetSessionId = normalizeSessionId(input.target.sessionId);
    if (targetSessionId && targetSessionId !== input.sessionId) {
      throw new OpenClawBrowserHostError(
        'OPENCLAW_SESSION_MISMATCH',
        input.operation,
        `OpenClaw target ${input.target.targetId} belongs to session ${targetSessionId}, not ${input.sessionId}.`,
      );
    }

    if (input.target.available === false || input.target.attached === false || !String(input.target.targetId || '').trim()) {
      throw new OpenClawBrowserHostError(
        'OPENCLAW_TARGET_UNAVAILABLE',
        input.operation,
        `OpenClaw target ${input.target.targetId || '<unknown>'} is not available for session ${input.sessionId}.`,
      );
    }

    return cloneValue(input.target);
  }

  private async callRelay<T>(operation: OpenClawBrowserHostOperation, action: () => Promise<T> | T): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof OpenClawBrowserHostError) {
        throw error;
      }

      throw new OpenClawBrowserHostError(
        'OPENCLAW_RELAY_UNAVAILABLE',
        operation,
        `OpenClaw relay is unavailable during ${operation}.`,
        { cause: error },
      );
    }
  }
}

export class InMemoryOpenClawBrowserRelay implements OpenClawBrowserRelay {
  readonly operations: InMemoryOpenClawRelayOperationRecord[] = [];
  private readonly now: () => string;
  private readonly targetPrefix: string;
  private readonly targetById = new Map<string, OpenClawRelayTarget>();
  private readonly targetOrdinalBySessionId = new Map<string, number>();
  private readonly targetIdBySessionId = new Map<string, string>();

  constructor(options: InMemoryOpenClawBrowserRelayOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.targetPrefix = options.targetPrefix ?? 'openclaw-tab';
  }

  async open(input: OpenClawRelayOpenRequest): Promise<OpenClawRelayTarget> {
    this.operations.push({
      method: 'open',
      sessionId: input.sessionId,
    });

    const targetId = this.createTargetId(input.sessionId);
    const target: OpenClawRelayTarget = {
      targetId,
      sessionId: input.sessionId,
      url: input.url,
      available: true,
      attached: true,
      updatedAt: this.now(),
    };

    this.targetById.set(targetId, cloneValue(target));
    this.targetIdBySessionId.set(input.sessionId, targetId);
    return cloneValue(target);
  }

  async attach(input: OpenClawRelayAttachRequest): Promise<OpenClawRelayTarget | null> {
    this.operations.push({
      method: 'attach',
      sessionId: input.sessionId,
    });

    const targetId = this.targetIdBySessionId.get(input.sessionId);
    if (!targetId) {
      return null;
    }

    const target = this.targetById.get(targetId);
    return target ? cloneValue(target) : null;
  }

  async getTarget(input: { targetId: string }): Promise<OpenClawRelayTarget | null> {
    this.operations.push({
      method: 'getTarget',
      targetId: input.targetId,
    });

    const target = this.targetById.get(input.targetId);
    return target ? cloneValue(target) : null;
  }

  setTargetState(targetId: string, patch: Partial<OpenClawRelayTarget>): void {
    const currentTarget = this.targetById.get(targetId);
    if (!currentTarget) {
      throw new Error(`Target ${targetId} was not found.`);
    }

    const currentSessionId = normalizeSessionId(currentTarget.sessionId);
    const nextSessionId = patch.sessionId === undefined ? currentSessionId : normalizeSessionId(patch.sessionId);
    if (currentSessionId && currentSessionId !== nextSessionId) {
      this.targetIdBySessionId.delete(currentSessionId);
    }
    if (nextSessionId) {
      this.targetIdBySessionId.set(nextSessionId, targetId);
    }

    const nextTarget: OpenClawRelayTarget = {
      ...currentTarget,
      ...cloneValue(patch),
      sessionId: nextSessionId,
      updatedAt: patch.updatedAt ?? this.now(),
    };
    this.targetById.set(targetId, nextTarget);
  }

  dropTarget(targetId: string): void {
    const currentTarget = this.targetById.get(targetId);
    if (currentTarget) {
      const sessionId = normalizeSessionId(currentTarget.sessionId);
      if (sessionId) {
        this.targetIdBySessionId.delete(sessionId);
      }
    }
    this.targetById.delete(targetId);
  }

  private createTargetId(sessionId: string): string {
    const nextOrdinal = (this.targetOrdinalBySessionId.get(sessionId) ?? 0) + 1;
    this.targetOrdinalBySessionId.set(sessionId, nextOrdinal);
    if (nextOrdinal === 1) {
      return `${this.targetPrefix}:${sessionId}`;
    }
    return `${this.targetPrefix}:${sessionId}:${nextOrdinal}`;
  }
}

function normalizeSessionId(value: string | null | undefined): string | null {
  const sessionId = String(value || '').trim();
  return sessionId ? sessionId : null;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

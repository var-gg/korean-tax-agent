import type {
  BrowserAssistOpenReceipt,
  BrowserAssistRuntimeState,
  BrowserHostCapabilities,
  BrowserHostExecutor,
  BrowserRuntimeCheckpointHandoffRequest,
  BrowserRuntimeOpenRequest,
} from './index.js';

export type OpenClawBrowserHostOperation = 'openTarget' | 'getRuntimeState' | 'handoffCheckpoint';

export type OpenClawBrowserHostErrorCode =
  | 'OPENCLAW_RELAY_UNAVAILABLE'
  | 'OPENCLAW_BROWSER_UNAVAILABLE'
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

export interface OpenClawBrowserTransportCapabilities extends BrowserHostCapabilities {}

export interface OpenClawBrowserTransport {
  getCapabilities?(input: {
    sessionId?: string;
    runtimeTargetId?: string | null;
  }): Promise<Partial<OpenClawBrowserTransportCapabilities>> | Partial<OpenClawBrowserTransportCapabilities>;
  open(input: OpenClawRelayOpenRequest): Promise<OpenClawRelayTarget> | OpenClawRelayTarget;
  attach?(input: OpenClawRelayAttachRequest): Promise<OpenClawRelayTarget | null> | OpenClawRelayTarget | null;
  getTarget?(input: { targetId: string }): Promise<OpenClawRelayTarget | null> | OpenClawRelayTarget | null;
}

export interface OpenClawBrowserRelay extends OpenClawBrowserTransport {}

export interface OpenClawBrowserHostExecutorOptions {
  transport?: OpenClawBrowserTransport;
  relay?: OpenClawBrowserRelay;
  now?: () => string;
  transportLabel?: string;
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
  method: 'open' | 'attach' | 'getTarget' | 'getCapabilities';
  sessionId?: string;
  targetId?: string;
}

export interface OpenClawBrowserToolClientOpenResult {
  targetId?: string;
  url?: string;
  title?: string;
}

export interface OpenClawBrowserToolClientTab {
  targetId?: string;
  url?: string;
  title?: string;
  attached?: boolean;
  available?: boolean;
  active?: boolean;
  sessionId?: string | null;
}

export interface OpenClawBrowserToolClientStatus {
  available?: boolean;
  connected?: boolean;
  attached?: boolean;
}

export interface OpenClawBrowserToolClient {
  status(): Promise<OpenClawBrowserToolClientStatus> | OpenClawBrowserToolClientStatus;
  open(input: { url: string }): Promise<OpenClawBrowserToolClientOpenResult> | OpenClawBrowserToolClientOpenResult;
  tabs(): Promise<OpenClawBrowserToolClientTab[]> | OpenClawBrowserToolClientTab[];
}

export interface OpenClawBrowserToolTransportOptions {
  client: OpenClawBrowserToolClient;
  now?: () => string;
  resolveAttachedTarget?: (
    tabs: OpenClawBrowserToolClientTab[],
    input: OpenClawRelayAttachRequest,
  ) => OpenClawBrowserToolClientTab | null | undefined;
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
  private readonly transport: OpenClawBrowserTransport;
  private readonly now: () => string;
  private readonly transportLabel: string;
  private readonly bindingBySessionId = new Map<string, OpenClawSessionBinding>();

  constructor(options: OpenClawBrowserHostExecutorOptions) {
    const transport = options?.transport ?? options?.relay;
    if (!transport || typeof transport.open !== 'function') {
      throw new TypeError('OpenClawBrowserHostExecutor requires transport.open() or relay.open().');
    }

    this.transport = transport;
    this.now = options.now ?? (() => new Date().toISOString());
    this.transportLabel = options.transportLabel ?? 'openclaw-browser-tool';
  }

  async getCapabilities(input: {
    sessionId?: string;
    runtimeState?: BrowserAssistRuntimeState | null;
  }): Promise<Partial<OpenClawBrowserTransportCapabilities>> {
    const fallback = defaultOpenClawCapabilities({
      activeTarget: input.runtimeState?.runtimeTargetId ? null : false,
      runtimeInspection: typeof this.transport.getTarget === 'function',
      checkpointHandoff: typeof this.transport.getTarget === 'function',
    });

    if (typeof this.transport.getCapabilities !== 'function') {
      return fallback;
    }

    return normalizeOpenClawCapabilities(
      await this.callRelay('getRuntimeState', () =>
        this.transport.getCapabilities!({
          sessionId: input.sessionId,
          runtimeTargetId: input.runtimeState?.runtimeTargetId ?? null,
        }),
      ),
      fallback,
    );
  }

  async openTarget(input: BrowserRuntimeOpenRequest): Promise<Partial<BrowserAssistOpenReceipt>> {
    const capabilities = await this.getCapabilities({ sessionId: input.sessionId, runtimeState: null });
    if (capabilities.hostAvailable === false) {
      throw new OpenClawBrowserHostError(
        'OPENCLAW_BROWSER_UNAVAILABLE',
        'openTarget',
        'OpenClaw browser host is unavailable.',
      );
    }

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
      transport: this.transportLabel,
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
      transport: this.transportLabel,
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
      transport: this.transportLabel,
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
    if (typeof this.transport.attach === 'function') {
      const attachedTarget = await this.callRelay('openTarget', () =>
        this.transport.attach!({
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
            expectedTargetId: attachedTarget.targetId,
          }),
          usedAttachedTarget: true,
        };
      }
    }

    const openedTarget = await this.callRelay('openTarget', () =>
      this.transport.open({
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
        expectedTargetId: openedTarget.targetId,
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
    const capabilities = await this.getCapabilities({
      sessionId: input.sessionId,
      runtimeState: input.runtimeState,
    });

    if (!capabilities.hostAvailable) {
      throw new OpenClawBrowserHostError(
        'OPENCLAW_BROWSER_UNAVAILABLE',
        input.operation,
        'OpenClaw browser host is unavailable.',
      );
    }

    if (capabilities.activeTarget === false) {
      throw new OpenClawBrowserHostError(
        'OPENCLAW_TARGET_UNAVAILABLE',
        input.operation,
        `No OpenClaw target is attached for session ${input.sessionId}.`,
      );
    }

    const getTarget = this.transport.getTarget;
    if (typeof getTarget !== 'function' || !capabilities.runtimeInspection) {
      throw new OpenClawBrowserHostError(
        'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED',
        input.operation,
        `OpenClaw transport does not support ${input.operation} target inspection.`,
      );
    }

    const target = await this.callRelay(input.operation, () => getTarget.call(this.transport, { targetId: binding.runtimeTargetId }));

    return {
      binding,
      target: this.validateTarget({
        operation: input.operation,
        sessionId: input.sessionId,
        target,
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
    expectedTargetId?: string;
  }): OpenClawRelayTarget {
    if (!input.target) {
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
        `OpenClaw transport is unavailable during ${operation}.`,
        { cause: error },
      );
    }
  }
}

export class OpenClawBrowserToolTransport implements OpenClawBrowserTransport {
  private readonly client: OpenClawBrowserToolClient;
  private readonly now: () => string;
  private readonly resolveAttachedTarget: NonNullable<OpenClawBrowserToolTransportOptions['resolveAttachedTarget']>;

  constructor(options: OpenClawBrowserToolTransportOptions) {
    if (!options?.client) {
      throw new TypeError('OpenClawBrowserToolTransport requires a client.');
    }

    this.client = options.client;
    this.now = options.now ?? (() => new Date().toISOString());
    this.resolveAttachedTarget = options.resolveAttachedTarget ?? defaultAttachedTargetResolver;
  }

  async getCapabilities(input: {
    sessionId?: string;
    runtimeTargetId?: string | null;
  }): Promise<Partial<OpenClawBrowserTransportCapabilities>> {
    const status = await this.client.status();
    const tabs = await this.client.tabs();
    const normalizedTabs = Array.isArray(tabs) ? tabs : [];
    const hostAvailable = Boolean(status?.available ?? status?.connected ?? false);
    const activeTarget = input.runtimeTargetId
      ? normalizedTabs.some((tab) => normalizeTargetId(tab.targetId) === input.runtimeTargetId)
      : normalizedTabs.length > 0
        ? true
        : false;

    return {
      hostAvailable,
      activeTarget,
      runtimeInspection: true,
      checkpointHandoff: true,
    };
  }

  async open(input: OpenClawRelayOpenRequest): Promise<OpenClawRelayTarget> {
    const result = await this.client.open({ url: input.url });
    const targetId = normalizeTargetId(result?.targetId);
    if (!targetId) {
      throw new Error('OpenClaw browser open() did not return a targetId.');
    }

    return {
      targetId,
      sessionId: input.sessionId,
      url: result.url ?? input.url,
      title: result.title,
      available: true,
      attached: true,
      updatedAt: this.now(),
    };
  }

  async attach(input: OpenClawRelayAttachRequest): Promise<OpenClawRelayTarget | null> {
    const tabs = await this.client.tabs();
    const attachedTarget = this.resolveAttachedTarget(Array.isArray(tabs) ? tabs : [], input);
    return attachedTarget ? normalizeToolTab(attachedTarget, input.sessionId, this.now) : null;
  }

  async getTarget(input: { targetId: string }): Promise<OpenClawRelayTarget | null> {
    const tabs = await this.client.tabs();
    const matchingTab = (Array.isArray(tabs) ? tabs : []).find((tab) => normalizeTargetId(tab.targetId) === input.targetId);
    return matchingTab ? normalizeToolTab(matchingTab, matchingTab.sessionId ?? null, this.now) : null;
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

  async getCapabilities(input: {
    sessionId?: string;
    runtimeTargetId?: string | null;
  }): Promise<Partial<OpenClawBrowserTransportCapabilities>> {
    this.operations.push({
      method: 'getCapabilities',
      sessionId: input.sessionId,
      targetId: input.runtimeTargetId ?? undefined,
    });

    return {
      hostAvailable: true,
      activeTarget: null,
      runtimeInspection: true,
      checkpointHandoff: true,
    };
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

function normalizeTargetId(value: string | null | undefined): string | null {
  const targetId = String(value || '').trim();
  return targetId ? targetId : null;
}

function normalizeOpenClawCapabilities(
  input: Partial<OpenClawBrowserTransportCapabilities> | null | undefined,
  fallback: OpenClawBrowserTransportCapabilities,
): OpenClawBrowserTransportCapabilities {
  return {
    hostAvailable: input?.hostAvailable ?? fallback.hostAvailable,
    activeTarget: input?.activeTarget ?? fallback.activeTarget,
    runtimeInspection: input?.runtimeInspection ?? fallback.runtimeInspection,
    checkpointHandoff: input?.checkpointHandoff ?? fallback.checkpointHandoff,
  };
}

function defaultOpenClawCapabilities(
  overrides: Partial<OpenClawBrowserTransportCapabilities> = {},
): OpenClawBrowserTransportCapabilities {
  return {
    hostAvailable: true,
    activeTarget: null,
    runtimeInspection: false,
    checkpointHandoff: false,
    ...cloneValue(overrides),
  };
}

function defaultAttachedTargetResolver(
  tabs: OpenClawBrowserToolClientTab[],
  input: OpenClawRelayAttachRequest,
): OpenClawBrowserToolClientTab | null {
  return (
    tabs.find((tab) => Boolean(tab.attached) && normalizeSessionId(tab.sessionId) === input.sessionId) ??
    tabs.find((tab) => Boolean(tab.attached) && String(tab.url || '').trim() === input.url) ??
    null
  );
}

function normalizeToolTab(
  tab: OpenClawBrowserToolClientTab,
  sessionId: string | null,
  now: () => string,
): OpenClawRelayTarget {
  const targetId = normalizeTargetId(tab.targetId);
  if (!targetId) {
    throw new Error('OpenClaw browser tab does not include a targetId.');
  }

  return {
    targetId,
    sessionId: normalizeSessionId(sessionId),
    url: tab.url,
    title: tab.title,
    available: tab.available ?? true,
    attached: tab.attached ?? true,
    updatedAt: now(),
  };
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

import { spawn } from 'node:child_process';

import type {
  BrowserAssistOpenReceipt,
  BrowserAssistRuntimeState,
  BrowserHostActionReadiness,
  BrowserHostCapabilities,
  BrowserHostDomActionFailureCode,
  BrowserHostDomActionRecoveryAdvice,
  BrowserHostDomActionRequest,
  BrowserHostDomActionResult,
  BrowserHostExecutor,
  BrowserHostInspectionMetadata,
  BrowserHostLocatorKind,
  BrowserHostRecoveryAdviceStep,
  BrowserHostSnapshotContext,
  BrowserHostTargetResolutionEvidence,
  BrowserHostTargetResolutionResult,
  BrowserRuntimeCheckpointHandoffRequest,
  BrowserRuntimeOpenRequest,
} from './index.js';

export type OpenClawBrowserHostOperation = 'openTarget' | 'getRuntimeState' | 'handoffCheckpoint' | 'executeDomAction';

export type OpenClawBrowserHostErrorCode =
  | 'OPENCLAW_RELAY_UNAVAILABLE'
  | 'OPENCLAW_BROWSER_UNAVAILABLE'
  | 'OPENCLAW_TARGET_UNAVAILABLE'
  | 'OPENCLAW_TARGET_NOT_FOUND'
  | 'OPENCLAW_TARGET_AMBIGUOUS'
  | 'OPENCLAW_SESSION_MISMATCH'
  | 'OPENCLAW_SNAPSHOT_UNAVAILABLE'
  | 'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED'
  | 'OPENCLAW_ACTION_REJECTED'
  | 'OPENCLAW_ACTION_TIMEOUT'
  | 'OPENCLAW_LOCATOR_UNSUPPORTED'
  | 'OPENCLAW_MISSING_INSPECTION_CONTEXT'
  | 'OPENCLAW_MISSING_SNAPSHOT_CONTEXT'
  | 'OPENCLAW_STALE_REF'
  | 'OPENCLAW_AMBIGUOUS_REF';

export interface OpenClawRelayTarget {
  targetId: string;
  sessionId?: string | null;
  url?: string;
  title?: string;
  available?: boolean;
  attached?: boolean;
  active?: boolean;
  updatedAt?: string;
  inspection?: BrowserHostInspectionMetadata;
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

export interface OpenClawRelayCheckpointHandoffRequest {
  sessionId: string;
  targetId: string;
  targetUrl: string;
  completedCheckpointId?: string | null;
  nextCheckpointId?: string | null;
  handedOffAt: string;
}

export interface OpenClawBrowserTransportCapabilities extends BrowserHostCapabilities {}

export interface OpenClawRelayActionReceipt {
  targetId: string;
  actedAt?: string;
  hostActionId?: string;
  metadata?: Record<string, string>;
}

export interface OpenClawBrowserTransport {
  getCapabilities?(input: {
    sessionId?: string;
    runtimeTargetId?: string | null;
  }): Promise<Partial<OpenClawBrowserTransportCapabilities>> | Partial<OpenClawBrowserTransportCapabilities>;
  open(input: OpenClawRelayOpenRequest): Promise<OpenClawRelayTarget> | OpenClawRelayTarget;
  attach?(input: OpenClawRelayAttachRequest): Promise<OpenClawRelayTarget | null> | OpenClawRelayTarget | null;
  listTargets?(input: { sessionId?: string; url?: string; targetId?: string | null }): Promise<OpenClawRelayTarget[]> | OpenClawRelayTarget[];
  getTarget?(input: { targetId: string }): Promise<OpenClawRelayTarget | null> | OpenClawRelayTarget | null;
  snapshotTarget?(input: { targetId: string }): Promise<OpenClawRelayTarget | null> | OpenClawRelayTarget | null;
  handoffCheckpoint?(
    input: OpenClawRelayCheckpointHandoffRequest,
  ): Promise<OpenClawRelayTarget | null> | OpenClawRelayTarget | null;
  executeDomAction?(input: BrowserHostDomActionRequest & { runtimeTargetId: string }): Promise<OpenClawRelayActionReceipt> | OpenClawRelayActionReceipt;
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
  initialTargets?: OpenClawRelayTarget[];
}

export interface InMemoryOpenClawRelayOperationRecord {
  method: 'open' | 'attach' | 'getTarget' | 'getCapabilities' | 'handoffCheckpoint';
  sessionId?: string;
  targetId?: string;
}

export interface OpenClawBrowserToolClientTarget extends OpenClawRelayTarget {}

export interface OpenClawBrowserToolClient {
  getCapabilities?(input: {
    sessionId?: string;
    runtimeTargetId?: string | null;
  }): Promise<Partial<OpenClawBrowserTransportCapabilities>> | Partial<OpenClawBrowserTransportCapabilities>;
  listTargets(input: {
    sessionId?: string;
    url?: string;
    targetId?: string | null;
  }): Promise<OpenClawBrowserToolClientTarget[]> | OpenClawBrowserToolClientTarget[];
  openTarget(input: OpenClawRelayOpenRequest): Promise<OpenClawBrowserToolClientTarget> | OpenClawBrowserToolClientTarget;
  getTarget?(input: { targetId: string }): Promise<OpenClawBrowserToolClientTarget | null> | OpenClawBrowserToolClientTarget | null;
  snapshotTarget?(input: { targetId: string }): Promise<OpenClawBrowserToolClientTarget | null> | OpenClawBrowserToolClientTarget | null;
  handoffCheckpoint?(
    input: OpenClawRelayCheckpointHandoffRequest,
  ): Promise<OpenClawBrowserToolClientTarget | null> | OpenClawBrowserToolClientTarget | null;
  executeDomAction?(input: BrowserHostDomActionRequest & { runtimeTargetId: string }): Promise<OpenClawRelayActionReceipt> | OpenClawRelayActionReceipt;
}

export interface OpenClawBrowserToolTransportOptions {
  client: OpenClawBrowserToolClient;
  now?: () => string;
  resolveAttachedTarget?: (
    targets: OpenClawRelayTarget[],
    input: OpenClawRelayAttachRequest,
  ) => OpenClawRelayTarget | null | undefined;
}

export type OpenClawBrowserRuntimeCommandOperation =
  | 'getCapabilities'
  | 'listTargets'
  | 'openTarget'
  | 'getTarget'
  | 'snapshotTarget'
  | 'handoffCheckpoint'
  | 'executeDomAction';

export interface OpenClawBrowserRuntimeCommandRequest<TInput = unknown> {
  operation: OpenClawBrowserRuntimeCommandOperation;
  input: TInput;
}

export interface OpenClawBrowserRuntimeCommandSuccess<TResult = unknown> {
  ok: true;
  result: TResult;
}

export interface OpenClawBrowserRuntimeCommandFailure {
  ok: false;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface OpenClawBrowserRuntimeCommandClientOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
}

interface OpenClawSessionBinding {
  sessionId: string;
  runtimeTargetId: string;
  lastOpenedUrl: string;
  currentTargetUrl: string;
  inspection?: BrowserHostInspectionMetadata;
  snapshotContext?: BrowserHostSnapshotContext;
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

export class OpenClawBrowserRuntimeCommandClient implements OpenClawBrowserToolClient {
  private readonly command: string;
  private readonly args: string[];
  private readonly cwd?: string;
  private readonly env?: NodeJS.ProcessEnv;
  private readonly timeoutMs: number;

  constructor(options: OpenClawBrowserRuntimeCommandClientOptions) {
    if (!String(options?.command || '').trim()) {
      throw new TypeError('OpenClawBrowserRuntimeCommandClient requires a non-empty command.');
    }
    this.command = options.command;
    this.args = Array.isArray(options.args) ? [...options.args] : [];
    this.cwd = options.cwd;
    this.env = options.env ? { ...options.env } : undefined;
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, options.timeoutMs as number) : 30000;
  }

  async getCapabilities(input: { sessionId?: string; runtimeTargetId?: string | null }) {
    return this.invoke<Partial<OpenClawBrowserTransportCapabilities>>('getCapabilities', input);
  }

  async listTargets(input: { sessionId?: string; url?: string; targetId?: string | null }) {
    const result = await this.invoke<OpenClawBrowserToolClientTarget[]>('listTargets', input);
    return Array.isArray(result) ? result : [];
  }

  async openTarget(input: OpenClawRelayOpenRequest) {
    return this.invoke<OpenClawBrowserToolClientTarget>('openTarget', input);
  }

  async getTarget(input: { targetId: string }) {
    return this.invoke<OpenClawBrowserToolClientTarget | null>('getTarget', input);
  }

  async snapshotTarget(input: { targetId: string }) {
    return this.invoke<OpenClawBrowserToolClientTarget | null>('snapshotTarget', input);
  }

  async handoffCheckpoint(input: OpenClawRelayCheckpointHandoffRequest) {
    return this.invoke<OpenClawBrowserToolClientTarget | null>('handoffCheckpoint', input);
  }

  async executeDomAction(input: BrowserHostDomActionRequest & { runtimeTargetId: string }) {
    return this.invoke<OpenClawRelayActionReceipt>('executeDomAction', input);
  }

  private async invoke<TResult>(
    operation: OpenClawBrowserRuntimeCommandOperation,
    input: unknown,
  ): Promise<TResult> {
    const request: OpenClawBrowserRuntimeCommandRequest = { operation, input: cloneValue(input) };
    return new Promise<TResult>((resolve, reject) => {
      const child = spawn(this.command, this.args, {
        cwd: this.cwd,
        env: this.env ? { ...process.env, ...this.env } : process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, this.timeoutMs);
      const finish = (error: Error | null, result?: TResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(result as TResult);
      };
      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        stderr += chunk;
      });
      child.on('error', (error) => finish(error));
      child.on('close', (code) => {
        if (timedOut) {
          finish(new Error(`OpenClaw runtime command timed out after ${this.timeoutMs}ms.`));
          return;
        }
        const trimmedStdout = stdout.trim();
        if (!trimmedStdout) {
          finish(new Error(`OpenClaw runtime command produced no JSON response.${stderr.trim() ? ` ${stderr.trim()}` : ''}`.trim()));
          return;
        }
        let parsed: OpenClawBrowserRuntimeCommandSuccess<TResult> | OpenClawBrowserRuntimeCommandFailure;
        try {
          parsed = JSON.parse(trimmedStdout) as OpenClawBrowserRuntimeCommandSuccess<TResult> | OpenClawBrowserRuntimeCommandFailure;
        } catch (error) {
          finish(new Error(`OpenClaw runtime command returned invalid JSON (${error instanceof Error ? error.message : String(error)}).${stderr.trim() ? ` stderr=${stderr.trim()}` : ''}`));
          return;
        }
        if (code !== 0 || !parsed.ok) {
          finish(buildCommandClientError(parsed, stderr, code));
          return;
        }
        finish(null, cloneValue(parsed.result));
      });
      child.stdin.on('error', (error) => finish(error));
      child.stdin.end(JSON.stringify(request));
    });
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

  async getCapabilities(input: { sessionId?: string; runtimeState?: BrowserAssistRuntimeState | null }) {
    return this.readCapabilities('getRuntimeState', input);
  }

  async openTarget(input: BrowserRuntimeOpenRequest): Promise<Partial<BrowserAssistOpenReceipt>> {
    const capabilities = await this.readCapabilities('openTarget', { sessionId: input.sessionId, runtimeState: null });
    if (capabilities.hostAvailable === false) {
      throw new OpenClawBrowserHostError('OPENCLAW_BROWSER_UNAVAILABLE', 'openTarget', 'OpenClaw browser host is unavailable.');
    }
    const opened = await this.openOrAttachTarget(input);
    const enrichedTarget = capabilities.snapshotInspection ? await this.enrichWithSnapshotInspection('openTarget', opened.target, {
      sessionId: input.sessionId,
      runtimeTargetId: opened.target.targetId,
      lastOpenedUrl: input.target.entryUrl,
      currentTargetUrl: opened.target.url ?? input.target.entryUrl,
      inspection: opened.target.inspection,
      snapshotContext: resolveSnapshotContextFromTarget(opened.target),
    }) : opened.target;
    const currentTargetUrl = enrichedTarget.url ?? input.target.entryUrl;
    const openedAt = enrichedTarget.updatedAt ?? this.now();
    const snapshotContext = resolveSnapshotContextFromTarget(enrichedTarget);
    this.bindingBySessionId.set(input.sessionId, {
      sessionId: input.sessionId,
      runtimeTargetId: enrichedTarget.targetId,
      lastOpenedUrl: input.target.entryUrl,
      currentTargetUrl,
      inspection: enrichedTarget.inspection,
      snapshotContext,
    });
    this.executions.push({ method: 'openTarget', sessionId: input.sessionId, runtimeTargetId: enrichedTarget.targetId, usedAttachedTarget: opened.usedAttachedTarget });
    return {
      transport: this.transportLabel,
      runtimeTargetId: enrichedTarget.targetId,
      targetUrl: input.target.entryUrl,
      currentTargetUrl,
      lastOpenedUrl: input.target.entryUrl,
      inspection: enrichedTarget.inspection,
      snapshotContext,
      activeCheckpointId: input.activeCheckpoint.id,
      openedAt,
      updatedAt: openedAt,
    };
  }

  async getRuntimeState(input: { sessionId: string; target: { entryUrl: string }; runtimeState: BrowserAssistRuntimeState | null }) {
    const { binding, target } = await this.readBoundTarget({ operation: 'getRuntimeState', sessionId: input.sessionId, entryUrl: input.target.entryUrl, runtimeState: input.runtimeState });
    const inspectedTarget = await this.enrichWithSnapshotInspection('getRuntimeState', target, binding);
    const currentTargetUrl = inspectedTarget.url ?? binding.currentTargetUrl ?? input.target.entryUrl;
    const lastOpenedUrl = input.runtimeState?.lastOpenedUrl ?? binding.lastOpenedUrl ?? input.target.entryUrl;
    const updatedAt = inspectedTarget.updatedAt ?? this.now();
    const snapshotContext = resolveSnapshotContextFromTarget(inspectedTarget) ?? binding.snapshotContext;
    this.bindingBySessionId.set(input.sessionId, { ...binding, runtimeTargetId: inspectedTarget.targetId, currentTargetUrl, lastOpenedUrl, inspection: inspectedTarget.inspection, snapshotContext });
    this.executions.push({ method: 'getRuntimeState', sessionId: input.sessionId, runtimeTargetId: inspectedTarget.targetId });
    return {
      transport: this.transportLabel,
      runtimeTargetId: inspectedTarget.targetId,
      currentTargetUrl,
      lastOpenedUrl,
      inspection: inspectedTarget.inspection,
      snapshotContext,
      activeCheckpointId: input.runtimeState?.activeCheckpointId ?? null,
      updatedAt,
    };
  }

  async handoffCheckpoint(input: BrowserRuntimeCheckpointHandoffRequest & { runtimeState: BrowserAssistRuntimeState | null }) {
    const { binding } = await this.readBoundTarget({ operation: 'handoffCheckpoint', sessionId: input.sessionId, entryUrl: input.target.entryUrl, runtimeState: input.runtimeState });
    const capabilities = await this.readCapabilities('handoffCheckpoint', { sessionId: input.sessionId, runtimeState: input.runtimeState });
    if (!capabilities.hostAvailable) {
      throw new OpenClawBrowserHostError('OPENCLAW_BROWSER_UNAVAILABLE', 'handoffCheckpoint', 'OpenClaw browser host is unavailable.');
    }
    if (capabilities.activeTarget === false) {
      throw new OpenClawBrowserHostError('OPENCLAW_TARGET_UNAVAILABLE', 'handoffCheckpoint', `No OpenClaw target is attached for session ${input.sessionId}.`);
    }
    if (typeof this.transport.handoffCheckpoint !== 'function' || !capabilities.checkpointHandoff) {
      throw new OpenClawBrowserHostError('OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED', 'handoffCheckpoint', 'OpenClaw transport does not support runtime checkpoint handoff.');
    }
    const target = this.validateTarget({
      operation: 'handoffCheckpoint',
      sessionId: input.sessionId,
      target: await this.callRelay('handoffCheckpoint', () => this.transport.handoffCheckpoint!({
        sessionId: input.sessionId,
        targetId: binding.runtimeTargetId,
        targetUrl: input.targetUrl || binding.currentTargetUrl || input.target.entryUrl,
        completedCheckpointId: input.completedCheckpoint?.id ?? null,
        nextCheckpointId: input.nextCheckpoint?.id ?? null,
        handedOffAt: input.handedOffAt || this.now(),
      })),
      expectedTargetId: binding.runtimeTargetId,
    });
    const inspectedTarget = await this.enrichWithSnapshotInspection('handoffCheckpoint', target, binding);
    const currentTargetUrl = inspectedTarget.url ?? input.targetUrl ?? binding.currentTargetUrl ?? input.target.entryUrl;
    const lastOpenedUrl = input.runtimeState?.lastOpenedUrl ?? binding.lastOpenedUrl ?? input.target.entryUrl;
    const snapshotContext = resolveSnapshotContextFromTarget(inspectedTarget) ?? binding.snapshotContext;
    this.bindingBySessionId.set(input.sessionId, { ...binding, runtimeTargetId: inspectedTarget.targetId, currentTargetUrl, lastOpenedUrl, inspection: inspectedTarget.inspection, snapshotContext });
    this.executions.push({ method: 'handoffCheckpoint', sessionId: input.sessionId, runtimeTargetId: inspectedTarget.targetId });
    return {
      transport: this.transportLabel,
      runtimeTargetId: inspectedTarget.targetId,
      currentTargetUrl,
      lastOpenedUrl,
      inspection: inspectedTarget.inspection,
      snapshotContext,
      activeCheckpointId: input.nextCheckpoint ? input.nextCheckpoint.id : null,
      updatedAt: inspectedTarget.updatedAt ?? (input.handedOffAt || this.now()),
    };
  }


  async executeDomAction(input: BrowserHostDomActionRequest): Promise<BrowserHostDomActionResult> {
    const capabilities = await this.readCapabilities('executeDomAction', { sessionId: input.sessionId, runtimeState: input.runtimeState });
    const runtimeTargetId = input.runtimeState?.runtimeTargetId ?? this.bindingBySessionId.get(input.sessionId)?.runtimeTargetId;
    const readiness = this.createActionReadiness(input, runtimeTargetId);
    if (!capabilities.hostAvailable) return this.actionFailure('host_unavailable', 'OpenClaw browser host is unavailable.', input, runtimeTargetId, readiness);
    if (!capabilities.domActions || typeof this.transport.executeDomAction !== 'function') return this.actionFailure('action_unsupported', 'OpenClaw transport does not support DOM actions.', input, runtimeTargetId, readiness);
    if (!capabilities.actionReadiness) return this.actionFailure('action_unsupported', 'OpenClaw transport does not advertise action readiness semantics.', input, runtimeTargetId, readiness);
    if (!capabilities.explicitSnapshotRebinding && input.rebinding) return this.actionFailure('action_unsupported', 'OpenClaw transport does not advertise explicit snapshot rebinding support.', input, runtimeTargetId, readiness);
    if (!runtimeTargetId) return this.actionFailure('target_not_found', `No OpenClaw target is attached for session ${input.sessionId}.`, input, runtimeTargetId, readiness);
    if (!capabilities.supportedDomActionKinds.includes(input.action.kind)) return this.actionFailure('action_unsupported', `OpenClaw does not support DOM action ${input.action.kind}.`, input, runtimeTargetId, readiness);
    if (!capabilities.supportedLocatorKinds.includes(input.locator.kind)) return this.actionFailure(input.locator.kind === 'aria-ref' ? 'action_unsupported' : 'locator_unsupported', `OpenClaw does not support locator kind ${input.locator.kind}.`, input, runtimeTargetId, readiness);
    if (readiness.rebinding.status === 'rejected') return this.actionFailure(readiness.rebinding.rejectionCode ?? 'invalid_rebinding_submission', readiness.rebinding.detail ?? 'Explicit rebinding submission was rejected.', input, runtimeTargetId, readiness);
    if (readiness.inspection === 'missing') return this.actionFailure('missing_inspection_context', 'OpenClaw aria-ref actions require inspection context for the bound target.', input, runtimeTargetId, readiness);
    if (readiness.snapshot === 'missing') return this.actionFailure('missing_snapshot_context', 'OpenClaw aria-ref actions require a current snapshot artifact context before execution.', input, runtimeTargetId, readiness);
    if (readiness.snapshotRef.freshness === 'missing_requested_snapshot') return this.actionFailure('missing_snapshot_context', 'OpenClaw aria-ref actions require explicit snapshot context tied to the aria-ref before execution.', input, runtimeTargetId, readiness);
    if (readiness.snapshotRef.freshness === 'stale') return this.actionFailure('stale_ref', 'OpenClaw aria-ref action expected a different snapshot artifact/version than the bound runtime snapshot.', input, runtimeTargetId, readiness);
    const resolvedLocator = readiness.rebinding.status === 'accepted' && readiness.rebinding.accepted ? cloneValue(readiness.rebinding.accepted.locator) : cloneValue(input.locator);
    try {
      const receipt = await this.callRelay('executeDomAction', () => this.transport.executeDomAction!({ ...cloneValue(input), locator: cloneValue(resolvedLocator), runtimeTargetId }));
      return {
        ok: true,
        receipt: {
          actionId: receipt.hostActionId ?? `${input.sessionId}:${runtimeTargetId}:${input.action.kind}:${receipt.actedAt ?? this.now()}`,
          sessionId: input.sessionId,
          runtimeTargetId,
          action: cloneValue(input.action),
          locator: resolvedLocator,
          requestedLocator: cloneValue(input.locator),
          snapshotContext: readiness.snapshotRef.current ? cloneValue(readiness.snapshotRef.current) : undefined,
          rebinding: {
            provided: readiness.rebinding.status !== 'not-provided',
            accepted: readiness.rebinding.status === 'accepted',
            submission: readiness.rebinding.submitted ? cloneValue(readiness.rebinding.submitted) : undefined,
            usedLocator: readiness.rebinding.status === 'accepted' ? cloneValue(resolvedLocator) : undefined,
            usedSnapshotContext: readiness.rebinding.status === 'accepted' ? cloneValue(readiness.rebinding.accepted?.snapshotContext) : undefined,
            rejectionCode: undefined,
            detail: readiness.rebinding.detail,
          },
          readiness,
          actedAt: receipt.actedAt ?? this.now(),
          targetDescription: resolvedLocator.description ?? input.locator.description,
          confirmation: { host: this.transportLabel, metadata: cloneValue(receipt.metadata ?? {}) },
        },
      };
    } catch (error) {
      const mapped = mapOpenClawHostError(error, 'executeDomAction');
      if (mapped?.code === 'OPENCLAW_TARGET_NOT_FOUND') return this.actionFailure('target_not_found', mapped.message, input, runtimeTargetId, readiness);
      if (mapped?.code == 'OPENCLAW_TARGET_AMBIGUOUS') return this.actionFailure('ambiguous_target', mapped.message, input, runtimeTargetId, readiness);
      if (mapped?.code == 'OPENCLAW_SESSION_MISMATCH') return this.actionFailure('session_mismatch', mapped.message, input, runtimeTargetId, readiness);
      if (mapped?.code == 'OPENCLAW_MISSING_INSPECTION_CONTEXT') return this.actionFailure('missing_inspection_context', mapped.message, input, runtimeTargetId, readiness);
      if (mapped?.code == 'OPENCLAW_MISSING_SNAPSHOT_CONTEXT') return this.actionFailure('missing_snapshot_context', mapped.message, input, runtimeTargetId, readiness);
      if (mapped?.code == 'OPENCLAW_STALE_REF') return this.actionFailure('stale_ref', mapped.message, input, runtimeTargetId, readiness);
      if (mapped?.code == 'OPENCLAW_AMBIGUOUS_REF') return this.actionFailure('ambiguous_ref', mapped.message, input, runtimeTargetId, readiness);
      if (mapped?.code == 'OPENCLAW_ACTION_TIMEOUT') return this.actionFailure('timeout', mapped.message, input, runtimeTargetId, readiness, true);
      if (mapped?.code === 'OPENCLAW_LOCATOR_UNSUPPORTED' || mapped?.code === 'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED') return this.actionFailure('locator_unsupported', mapped.message, input, runtimeTargetId, readiness);
      if (mapped?.code == 'OPENCLAW_ACTION_REJECTED') return this.actionFailure('action_rejected', mapped.message, input, runtimeTargetId, readiness);
      return this.actionFailure('transport_failure', error instanceof Error ? error.message : String(error), input, runtimeTargetId, readiness, true);
    }
  }

  private async readCapabilities(operation: OpenClawBrowserHostOperation, input: { sessionId?: string; runtimeState?: BrowserAssistRuntimeState | null }) {
    const fallback = defaultOpenClawCapabilities({
      activeTarget: input.runtimeState?.runtimeTargetId ? null : false,
      runtimeInspection: typeof this.transport.getTarget === 'function' || typeof this.transport.listTargets === 'function',
      snapshotInspection: typeof this.transport.snapshotTarget === 'function',
      targetResolution: typeof this.transport.listTargets === 'function',
      checkpointHandoff: typeof this.transport.handoffCheckpoint === 'function',
      domActions: typeof this.transport.executeDomAction === 'function',
      actionReadiness: typeof this.transport.executeDomAction === 'function',
      snapshotRefLocators: typeof this.transport.executeDomAction === 'function',
      explicitSnapshotRebinding: typeof this.transport.executeDomAction === 'function',
      supportedDomActionKinds: typeof this.transport.executeDomAction === 'function' ? ['click', 'fill', 'press'] : [],
      supportedLocatorKinds: typeof this.transport.executeDomAction === 'function' ? ['aria-ref'] satisfies BrowserHostLocatorKind[] : [],
    });
    if (typeof this.transport.getCapabilities !== 'function') {
      return fallback;
    }
    return normalizeOpenClawCapabilities(
      await this.callRelay(operation, () => this.transport.getCapabilities!({ sessionId: input.sessionId, runtimeTargetId: input.runtimeState?.runtimeTargetId ?? null })),
      fallback,
    );
  }

  private async openOrAttachTarget(input: BrowserRuntimeOpenRequest) {
    if (typeof this.transport.attach === 'function') {
      const attachedTarget = await this.callRelay('openTarget', () => this.transport.attach!({ sessionId: input.sessionId, url: input.target.entryUrl, label: input.target.label }));
      if (attachedTarget) {
        return { target: this.validateTarget({ operation: 'openTarget', sessionId: input.sessionId, target: attachedTarget, expectedTargetId: attachedTarget.targetId }), usedAttachedTarget: true };
      }
    }
    const openedTarget = await this.callRelay('openTarget', () => this.transport.open({ sessionId: input.sessionId, url: input.target.entryUrl, label: input.target.label }));
    return { target: this.validateTarget({ operation: 'openTarget', sessionId: input.sessionId, target: openedTarget, expectedTargetId: openedTarget.targetId }), usedAttachedTarget: false };
  }

  private async readBoundTarget(input: { operation: Exclude<OpenClawBrowserHostOperation, 'openTarget'>; sessionId: string; entryUrl: string; runtimeState: BrowserAssistRuntimeState | null }) {
    const binding = this.resolveBinding(input);
    const capabilities = await this.readCapabilities(input.operation, { sessionId: input.sessionId, runtimeState: input.runtimeState });
    if (!capabilities.hostAvailable) throw new OpenClawBrowserHostError('OPENCLAW_BROWSER_UNAVAILABLE', input.operation, 'OpenClaw browser host is unavailable.');
    if (capabilities.activeTarget === false && !binding.runtimeTargetId) {
      throw new OpenClawBrowserHostError('OPENCLAW_TARGET_UNAVAILABLE', input.operation, `No OpenClaw target is attached for session ${input.sessionId}.`);
    }
    if (!capabilities.runtimeInspection || (typeof this.transport.getTarget !== 'function' && typeof this.transport.listTargets !== 'function')) {
      throw new OpenClawBrowserHostError('OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED', input.operation, `OpenClaw transport does not support ${input.operation} target inspection.`);
    }
    let target = typeof this.transport.getTarget === 'function'
      ? await this.callRelay(input.operation, () => this.transport.getTarget!.call(this.transport, { targetId: binding.runtimeTargetId }))
      : null;
    if (!target) {
      target = await this.reconnectTarget(input.operation, binding, input.entryUrl);
    }
    const validated = this.validateTarget({ operation: input.operation, sessionId: input.sessionId, target, expectedTargetId: binding.runtimeTargetId });
    if (validated.targetId !== binding.runtimeTargetId) {
      this.bindingBySessionId.set(input.sessionId, {
        ...binding,
        runtimeTargetId: validated.targetId,
        currentTargetUrl: validated.url ?? binding.currentTargetUrl,
        inspection: validated.inspection ?? binding.inspection,
        snapshotContext: resolveSnapshotContextFromTarget(validated) ?? binding.snapshotContext,
      });
    }
    return { binding: this.bindingBySessionId.get(input.sessionId) ?? binding, target: validated };
  }

  private async reconnectTarget(operation: Exclude<OpenClawBrowserHostOperation, 'openTarget'>, binding: OpenClawSessionBinding, entryUrl: string): Promise<OpenClawRelayTarget> {
    if (typeof this.transport.listTargets !== 'function') {
      throw new OpenClawBrowserHostError('OPENCLAW_TARGET_NOT_FOUND', operation, `OpenClaw target ${binding.runtimeTargetId} was not found for session ${binding.sessionId}.`);
    }
    const targets = normalizeToolTargets(await this.callRelay(operation, () => this.transport.listTargets!({ sessionId: binding.sessionId, url: binding.currentTargetUrl || entryUrl, targetId: null })), this.now);
    let resolved: OpenClawRelayTarget | null;
    try {
      const resolution = resolveTargetCandidate(targets, { sessionId: binding.sessionId, boundTargetId: binding.runtimeTargetId, entryUrl, currentTargetUrl: binding.currentTargetUrl, lastOpenedUrl: binding.lastOpenedUrl });
      if (resolution.outcome === 'ambiguous') throw createOpenClawCodeError('OPENCLAW_TARGET_AMBIGUOUS', summarizeResolutionFailure(binding.sessionId, resolution));
      if (resolution.outcome === 'missing') throw createOpenClawCodeError('OPENCLAW_TARGET_NOT_FOUND', summarizeResolutionFailure(binding.sessionId, resolution));
      resolved = resolution.target;
    } catch (error) {
      const mapped = mapOpenClawHostError(error, operation);
      if (mapped) throw mapped;
      throw error;
    }
    if (!resolved) {
      throw new OpenClawBrowserHostError('OPENCLAW_TARGET_NOT_FOUND', operation, `OpenClaw target ${binding.runtimeTargetId} was not found for session ${binding.sessionId}.`);
    }
    return cloneValue(resolved);
  }

  private async enrichWithSnapshotInspection(operation: OpenClawBrowserHostOperation, target: OpenClawRelayTarget, binding: OpenClawSessionBinding): Promise<OpenClawRelayTarget> {
    if (typeof this.transport.snapshotTarget !== 'function') return cloneValue(target);
    try {
      const snapshot = await this.callRelay(operation, () => this.transport.snapshotTarget!({ targetId: target.targetId }));
      if (!snapshot) return cloneValue(target);
      const normalized = this.validateTarget({ operation, sessionId: binding.sessionId, target: snapshot, expectedTargetId: target.targetId });
      return {
        ...target,
        ...normalized,
        url: normalized.url ?? target.url,
        title: normalized.title ?? target.title,
        inspection: mergeInspectionMetadata(target.inspection, normalized.inspection, this.now),
      };
    } catch (error) {
      const mapped = mapOpenClawHostError(error, operation);
      if (mapped?.code === 'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED' || mapped?.code === 'OPENCLAW_SNAPSHOT_UNAVAILABLE') {
        return cloneValue(target);
      }
      throw error;
    }
  }

  private resolveBinding(input: { operation: Exclude<OpenClawBrowserHostOperation, 'openTarget'>; sessionId: string; entryUrl: string; runtimeState: BrowserAssistRuntimeState | null }): OpenClawSessionBinding {
    const existingBinding = this.bindingBySessionId.get(input.sessionId);
    const runtimeTargetId = input.runtimeState?.runtimeTargetId ?? existingBinding?.runtimeTargetId;
    if (!runtimeTargetId) throw new OpenClawBrowserHostError('OPENCLAW_TARGET_UNAVAILABLE', input.operation, `No OpenClaw target is attached for session ${input.sessionId}.`);
    return {
      sessionId: input.sessionId,
      runtimeTargetId,
      lastOpenedUrl: input.runtimeState?.lastOpenedUrl ?? existingBinding?.lastOpenedUrl ?? input.entryUrl,
      currentTargetUrl: input.runtimeState?.currentTargetUrl ?? existingBinding?.currentTargetUrl ?? input.entryUrl,
      inspection: input.runtimeState?.inspection ?? existingBinding?.inspection,
      snapshotContext: resolveSnapshotContextFromRuntimeState(input.runtimeState) ?? existingBinding?.snapshotContext,
    };
  }

  private validateTarget(input: { operation: OpenClawBrowserHostOperation; sessionId: string; target: OpenClawRelayTarget | null; expectedTargetId?: string }): OpenClawRelayTarget {
    if (!input.target) {
      throw new OpenClawBrowserHostError('OPENCLAW_TARGET_NOT_FOUND', input.operation, input.expectedTargetId ? `OpenClaw target ${input.expectedTargetId} was not found for session ${input.sessionId}.` : `OpenClaw target lookup returned no result for session ${input.sessionId}.`);
    }
    const targetSessionId = normalizeSessionId(input.target.sessionId);
    if (targetSessionId && targetSessionId !== input.sessionId) {
      throw new OpenClawBrowserHostError('OPENCLAW_SESSION_MISMATCH', input.operation, `OpenClaw target ${input.target.targetId} belongs to session ${targetSessionId}, not ${input.sessionId}.`);
    }
    if (!isUsableTarget(input.target)) {
      const unusableTargetId = (input.target as OpenClawRelayTarget | null | undefined)?.targetId || '<unknown>';
      throw new OpenClawBrowserHostError('OPENCLAW_TARGET_UNAVAILABLE', input.operation, `OpenClaw target ${unusableTargetId} is not available for session ${input.sessionId}.`);
    }
    return cloneValue(input.target);
  }

  private createActionReadiness(input: BrowserHostDomActionRequest, runtimeTargetId?: string): BrowserHostActionReadiness {
    const inspectionRequired = input.readiness?.inspection ?? (input.locator.kind === 'aria-ref' ? 'required' : 'none');
    const snapshotRequired = input.readiness?.snapshot ?? (input.locator.kind === 'aria-ref' ? 'required' : 'none');
    const binding = this.bindingBySessionId.get(input.sessionId);
    const inspectionPresent = Boolean(input.runtimeState?.inspection ?? binding?.inspection);
    const currentSnapshotContext = normalizeSnapshotContext(input.runtimeState?.snapshotContext ?? input.runtimeState?.inspection?.snapshotContext ?? binding?.snapshotContext);
    const requestedSnapshotContext = normalizeSnapshotContext(input.snapshotContext);
    const rebinding = createRebindingReadiness(input, currentSnapshotContext, requestedSnapshotContext);
    return {
      preconditions: {
        target: input.readiness?.target ?? 'required',
        inspection: inspectionRequired,
        snapshot: snapshotRequired,
        locatorNeedsSnapshotRef: input.locator.kind === 'aria-ref',
      },
      target: runtimeTargetId ? 'ready' : 'missing',
      inspection: inspectionRequired === 'none' ? 'not-required' : inspectionPresent ? 'present' : 'missing',
      snapshot: snapshotRequired === 'none' ? 'not-required' : currentSnapshotContext ? 'present' : 'missing',
      snapshotRef: createSnapshotRefReadiness(snapshotRequired, currentSnapshotContext, requestedSnapshotContext),
      rebinding,
    };
  }

  private actionFailure(code: 'action_unsupported' | 'locator_unsupported' | 'target_not_found' | 'ambiguous_target' | 'ambiguous_ref' | 'host_unavailable' | 'session_mismatch' | 'missing_inspection_context' | 'missing_snapshot_context' | 'invalid_rebinding_submission' | 'rebinding_artifact_mismatch' | 'rebound_locator_not_snapshot_derived' | 'stale_ref' | 'timeout' | 'transport_failure' | 'action_rejected', message: string, input: BrowserHostDomActionRequest, runtimeTargetId?: string, readiness?: BrowserHostActionReadiness, retryable?: boolean): BrowserHostDomActionResult {
    const resolvedReadiness = readiness ?? this.createActionReadiness(input, runtimeTargetId);
    const recoveryAdvice = createSnapshotBoundActionRecoveryAdvice({
      code,
      actionRequest: input,
      readiness: resolvedReadiness,
    });
    return {
      ok: false,
      code,
      message,
      retryable,
      recoveryAdvice: recoveryAdvice ? cloneValue(recoveryAdvice) : undefined,
      receipt: {
        actionId: `${input.sessionId}:${runtimeTargetId ?? 'no-target'}:${input.action.kind}:${input.requestedAt ?? this.now()}`,
        sessionId: input.sessionId,
        runtimeTargetId,
        action: cloneValue(input.action),
        locator: cloneValue(resolvedReadiness.rebinding.status === 'accepted' && resolvedReadiness.rebinding.accepted ? resolvedReadiness.rebinding.accepted.locator : input.locator),
        requestedLocator: cloneValue(input.locator),
        snapshotContext: resolvedReadiness.snapshotRef.current ? cloneValue(resolvedReadiness.snapshotRef.current) : undefined,
        rebinding: {
          provided: resolvedReadiness.rebinding.status !== 'not-provided',
          accepted: resolvedReadiness.rebinding.status === 'accepted',
          submission: resolvedReadiness.rebinding.submitted ? cloneValue(resolvedReadiness.rebinding.submitted) : undefined,
          usedLocator: resolvedReadiness.rebinding.status === 'accepted' && resolvedReadiness.rebinding.accepted ? cloneValue(resolvedReadiness.rebinding.accepted.locator) : undefined,
          usedSnapshotContext: resolvedReadiness.rebinding.status === 'accepted' ? cloneValue(resolvedReadiness.rebinding.accepted?.snapshotContext) : undefined,
          rejectionCode: resolvedReadiness.rebinding.status === 'rejected' ? resolvedReadiness.rebinding.rejectionCode : undefined,
          detail: resolvedReadiness.rebinding.detail,
        },
        readiness: cloneValue(resolvedReadiness),
        actedAt: input.requestedAt ?? this.now(),
        targetDescription: (resolvedReadiness.rebinding.status === 'accepted' && resolvedReadiness.rebinding.accepted ? resolvedReadiness.rebinding.accepted.locator.description : input.locator.description),
      },
    };
  }

  private async callRelay<T>(operation: OpenClawBrowserHostOperation, action: () => Promise<T> | T): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof OpenClawBrowserHostError) throw error;
      const mapped = mapOpenClawHostError(error, operation);
      if (mapped) throw mapped;
      throw new OpenClawBrowserHostError('OPENCLAW_RELAY_UNAVAILABLE', operation, `OpenClaw transport is unavailable during ${operation}.`, { cause: error });
    }
  }
}

export class OpenClawBrowserToolTransport implements OpenClawBrowserTransport {
  private readonly client: OpenClawBrowserToolClient;
  private readonly now: () => string;
  private readonly resolveAttachedTarget: NonNullable<OpenClawBrowserToolTransportOptions['resolveAttachedTarget']>;

  constructor(options: OpenClawBrowserToolTransportOptions) {
    if (!options?.client) throw new TypeError('OpenClawBrowserToolTransport requires a client.');
    this.client = options.client;
    this.now = options.now ?? (() => new Date().toISOString());
    this.resolveAttachedTarget = options.resolveAttachedTarget ?? defaultAttachedTargetResolver;
  }

  async getCapabilities(input: { sessionId?: string; runtimeTargetId?: string | null }) {
    const reported = typeof this.client.getCapabilities === 'function'
      ? await this.client.getCapabilities({ sessionId: input.sessionId, runtimeTargetId: input.runtimeTargetId ?? null })
      : {};
    let activeTarget = reported?.activeTarget;
    if (activeTarget === undefined && input.runtimeTargetId) {
      const currentTarget = await this.getTarget({ targetId: input.runtimeTargetId });
      activeTarget = currentTarget ? isUsableTarget(currentTarget) : false;
    }
    return normalizeOpenClawCapabilities({
      hostAvailable: reported?.hostAvailable ?? true,
      activeTarget,
      runtimeInspection: reported?.runtimeInspection ?? true,
      snapshotInspection: reported?.snapshotInspection ?? (typeof this.client.snapshotTarget === 'function'),
      targetResolution: reported?.targetResolution ?? (typeof this.client.listTargets === 'function'),
      checkpointHandoff: reported?.checkpointHandoff ?? (typeof this.client.handoffCheckpoint === 'function'),
      domActions: reported?.domActions ?? (typeof this.client.executeDomAction === 'function'),
      actionReadiness: reported?.actionReadiness ?? (typeof this.client.executeDomAction === 'function'),
      snapshotRefLocators: reported?.snapshotRefLocators ?? (typeof this.client.executeDomAction === 'function'),
      explicitSnapshotRebinding: reported?.explicitSnapshotRebinding ?? (typeof this.client.executeDomAction === 'function'),
      supportedDomActionKinds: reported?.supportedDomActionKinds ?? (typeof this.client.executeDomAction === 'function' ? ['click', 'fill', 'press'] : []),
      supportedLocatorKinds: reported?.supportedLocatorKinds ?? (typeof this.client.executeDomAction === 'function' ? ['aria-ref'] : []),
    }, defaultOpenClawCapabilities({ runtimeInspection: true, snapshotInspection: typeof this.client.snapshotTarget === 'function', targetResolution: typeof this.client.listTargets === 'function', checkpointHandoff: typeof this.client.handoffCheckpoint === 'function', domActions: typeof this.client.executeDomAction === 'function', actionReadiness: typeof this.client.executeDomAction === 'function', snapshotRefLocators: typeof this.client.executeDomAction === 'function', explicitSnapshotRebinding: typeof this.client.executeDomAction === 'function', supportedDomActionKinds: typeof this.client.executeDomAction === 'function' ? ['click', 'fill', 'press'] : [], supportedLocatorKinds: typeof this.client.executeDomAction === 'function' ? ['aria-ref'] : [] }));
  }

  async open(input: OpenClawRelayOpenRequest): Promise<OpenClawRelayTarget> {
    return normalizeToolTarget(await this.client.openTarget(cloneValue(input)), input.sessionId, this.now);
  }

  async listTargets(input: { sessionId?: string; url?: string; targetId?: string | null }): Promise<OpenClawRelayTarget[]> {
    return normalizeToolTargets(await this.client.listTargets(cloneValue(input)), this.now);
  }

  async attach(input: OpenClawRelayAttachRequest): Promise<OpenClawRelayTarget | null> {
    const targets = await this.listTargets({ sessionId: input.sessionId, url: input.url, targetId: null });
    const attachedTarget = this.resolveAttachedTarget(targets, input);
    return attachedTarget ? cloneValue(attachedTarget) : null;
  }

  async getTarget(input: { targetId: string }): Promise<OpenClawRelayTarget | null> {
    if (typeof this.client.getTarget === 'function') {
      const target = await this.client.getTarget({ targetId: input.targetId });
      return target ? normalizeToolTarget(target, target.sessionId ?? null, this.now) : null;
    }
    const targets = (await this.listTargets({ targetId: input.targetId })).filter((target) => target.targetId === input.targetId);
    if (targets.length > 1) throw createOpenClawCodeError('OPENCLAW_TARGET_AMBIGUOUS', `OpenClaw runtime returned multiple targets for ${input.targetId}.`);
    return targets[0] ? cloneValue(targets[0]) : null;
  }

  async snapshotTarget(input: { targetId: string }): Promise<OpenClawRelayTarget | null> {
    if (typeof this.client.snapshotTarget !== 'function') {
      throw createOpenClawCodeError('OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED', 'OpenClaw runtime client does not support snapshot inspection.');
    }
    const target = await this.client.snapshotTarget(cloneValue(input));
    return target ? normalizeToolTarget(target, target.sessionId ?? null, this.now) : null;
  }

  async handoffCheckpoint(input: OpenClawRelayCheckpointHandoffRequest): Promise<OpenClawRelayTarget | null> {
    if (typeof this.client.handoffCheckpoint !== 'function') {
      throw createOpenClawCodeError('OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED', 'OpenClaw runtime client does not support checkpoint handoff.');
    }
    const target = await this.client.handoffCheckpoint(cloneValue(input));
    return target ? normalizeToolTarget(target, input.sessionId, this.now) : null;
  }

  async executeDomAction(input: BrowserHostDomActionRequest & { runtimeTargetId: string }): Promise<OpenClawRelayActionReceipt> {
    if (typeof this.client.executeDomAction !== 'function') {
      throw createOpenClawCodeError('OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED', 'OpenClaw runtime client does not support DOM actions.');
    }
    return cloneValue(await this.client.executeDomAction(cloneValue(input)));
  }
}

export class InMemoryOpenClawBrowserRelay implements OpenClawBrowserRelay {
  readonly operations: InMemoryOpenClawRelayOperationRecord[] = [];
  private readonly now: () => string;
  private readonly targetPrefix: string;
  private readonly targetById = new Map<string, OpenClawRelayTarget>();
  private readonly targetOrdinalBySessionId = new Map<string, number>();

  constructor(options: InMemoryOpenClawBrowserRelayOptions = {}) {
    this.now = options.now ?? (() => new Date().toISOString());
    this.targetPrefix = options.targetPrefix ?? 'openclaw-tab';
    for (const initialTarget of options.initialTargets ?? []) {
      this.addTarget(initialTarget);
    }
  }

  async getCapabilities(input: { sessionId?: string; runtimeTargetId?: string | null }) {
    this.operations.push({ method: 'getCapabilities', sessionId: input.sessionId, targetId: input.runtimeTargetId ?? undefined });
    return {
      hostAvailable: true,
      activeTarget: input.runtimeTargetId ? isUsableTarget(this.targetById.get(input.runtimeTargetId) ?? null) : null,
      runtimeInspection: true,
      snapshotInspection: true,
      targetResolution: true,
      checkpointHandoff: true,
      domActions: true,
      actionReadiness: true,
      snapshotRefLocators: true,
      supportedDomActionKinds: ['click', 'fill', 'press'],
      supportedLocatorKinds: ['aria-ref'],
    } satisfies Partial<OpenClawBrowserTransportCapabilities>;
  }

  async open(input: OpenClawRelayOpenRequest): Promise<OpenClawRelayTarget> {
    this.operations.push({ method: 'open', sessionId: input.sessionId });
    const targetId = this.createTargetId(input.sessionId);
    const target: OpenClawRelayTarget = { targetId, sessionId: input.sessionId, url: input.url, available: true, attached: true, updatedAt: this.now() };
    this.targetById.set(targetId, cloneValue(target));
    return cloneValue(target);
  }

  async attach(input: OpenClawRelayAttachRequest): Promise<OpenClawRelayTarget | null> {
    this.operations.push({ method: 'attach', sessionId: input.sessionId });
    const target = defaultAttachedTargetResolver(this.listTargetsInternal(), input);
    return target ? cloneValue(target) : null;
  }

  async listTargets(): Promise<OpenClawRelayTarget[]> {
    return this.listTargetsInternal();
  }

  async getTarget(input: { targetId: string }): Promise<OpenClawRelayTarget | null> {
    this.operations.push({ method: 'getTarget', targetId: input.targetId });
    const target = this.targetById.get(input.targetId);
    return target ? cloneValue(target) : null;
  }

  async snapshotTarget(input: { targetId: string }): Promise<OpenClawRelayTarget | null> {
    const target = this.targetById.get(input.targetId);
    if (!target) return null;
    const capturedAt = this.now();
    const snapshotContext = createOpenClawSnapshotContext(input.targetId, target.updatedAt ?? capturedAt, capturedAt);
    const snapshotTarget: OpenClawRelayTarget = {
      ...cloneValue(target),
      inspection: {
        source: 'snapshot',
        title: target.title,
        url: target.url,
        normalizedUrl: normalizeComparableUrl(target.url) ?? undefined,
        textSnippet: `snapshot:${target.title ?? target.url ?? target.targetId}`,
        capturedAt,
        snapshotContext,
      },
    };
    this.targetById.set(input.targetId, cloneValue(snapshotTarget));
    return snapshotTarget;
  }

  async handoffCheckpoint(input: OpenClawRelayCheckpointHandoffRequest): Promise<OpenClawRelayTarget | null> {
    this.operations.push({ method: 'handoffCheckpoint', sessionId: input.sessionId, targetId: input.targetId });
    const currentTarget = this.targetById.get(input.targetId);
    if (!currentTarget) return null;
    const nextTarget: OpenClawRelayTarget = { ...currentTarget, sessionId: normalizeSessionId(currentTarget.sessionId) ?? input.sessionId, url: input.targetUrl || currentTarget.url, updatedAt: input.handedOffAt || this.now() };
    this.targetById.set(input.targetId, cloneValue(nextTarget));
    return cloneValue(nextTarget);
  }

  async executeDomAction(input: BrowserHostDomActionRequest & { runtimeTargetId: string }): Promise<OpenClawRelayActionReceipt> {
    if (input.locator.kind !== 'aria-ref') {
      throw createOpenClawCodeError('OPENCLAW_LOCATOR_UNSUPPORTED', `OpenClaw relay only supports aria-ref locators, not ${input.locator.kind}.`);
    }
    const target = this.targetById.get(input.runtimeTargetId);
    if (!target) {
      throw createOpenClawCodeError('OPENCLAW_TARGET_NOT_FOUND', `OpenClaw target ${input.runtimeTargetId} was not found.`);
    }
    const targetSessionId = normalizeSessionId(target.sessionId);
    if (targetSessionId && targetSessionId !== input.sessionId) {
      throw createOpenClawCodeError('OPENCLAW_SESSION_MISMATCH', `OpenClaw target ${input.runtimeTargetId} belongs to session ${targetSessionId}, not ${input.sessionId}.`);
    }
    const snapshotRequired = (input.readiness?.snapshot ?? 'required') === 'required';
    const currentSnapshotContext = resolveSnapshotContextFromTarget(target) ?? resolveSnapshotContextFromRuntimeState(input.runtimeState);
    const requestedSnapshotContext = normalizeSnapshotContext(input.snapshotContext);
    if (snapshotRequired && !currentSnapshotContext) {
      throw createOpenClawCodeError('OPENCLAW_MISSING_SNAPSHOT_CONTEXT', 'OpenClaw aria-ref actions require a current snapshot artifact context before execution.');
    }
    if (snapshotRequired && !requestedSnapshotContext) {
      throw createOpenClawCodeError('OPENCLAW_MISSING_SNAPSHOT_CONTEXT', 'OpenClaw aria-ref actions require explicit snapshot context tied to the aria-ref before execution.');
    }
    if (
      snapshotRequired
      && currentSnapshotContext
      && requestedSnapshotContext
      && (
        currentSnapshotContext.artifact.artifactId !== requestedSnapshotContext.artifact.artifactId
        || currentSnapshotContext.artifact.version !== requestedSnapshotContext.artifact.version
      )
    ) {
      throw createOpenClawCodeError('OPENCLAW_STALE_REF', `OpenClaw aria-ref ${input.locator.ref} is stale for snapshot ${currentSnapshotContext.artifact.artifactId}@${currentSnapshotContext.artifact.version}.`);
    }
    if (input.locator.ref === 'stale-ref') {
      throw createOpenClawCodeError('OPENCLAW_STALE_REF', `OpenClaw aria-ref ${input.locator.ref} is stale for target ${input.runtimeTargetId}.`);
    }
    if (input.locator.ref === 'ambiguous-ref') {
      throw createOpenClawCodeError('OPENCLAW_AMBIGUOUS_REF', `OpenClaw aria-ref ${input.locator.ref} resolved ambiguously for target ${input.runtimeTargetId}.`);
    }
    return {
      targetId: input.runtimeTargetId,
      actedAt: this.now(),
      hostActionId: `${input.sessionId}:${input.runtimeTargetId}:${input.action.kind}:${this.now()}`,
      metadata: { locatorKind: input.locator.kind, actionKind: input.action.kind },
    };
  }

  addTarget(target: OpenClawRelayTarget): OpenClawRelayTarget {
    const normalizedTarget = normalizeToolTarget(target, target.sessionId ?? null, this.now);
    this.targetById.set(normalizedTarget.targetId, normalizedTarget);
    return cloneValue(normalizedTarget);
  }

  setTargetState(targetId: string, patch: Partial<OpenClawRelayTarget>): void {
    const currentTarget = this.targetById.get(targetId);
    if (!currentTarget) throw new Error(`Target ${targetId} was not found.`);
    this.targetById.set(targetId, {
      ...currentTarget,
      ...cloneValue(patch),
      sessionId: patch.sessionId === undefined ? normalizeSessionId(currentTarget.sessionId) : normalizeSessionId(patch.sessionId),
      updatedAt: patch.updatedAt ?? this.now(),
    });
  }

  dropTarget(targetId: string): void {
    this.targetById.delete(targetId);
  }

  private createTargetId(sessionId: string): string {
    const nextOrdinal = (this.targetOrdinalBySessionId.get(sessionId) ?? 0) + 1;
    this.targetOrdinalBySessionId.set(sessionId, nextOrdinal);
    return nextOrdinal === 1 ? `${this.targetPrefix}:${sessionId}` : `${this.targetPrefix}:${sessionId}:${nextOrdinal}`;
  }

  private listTargetsInternal(): OpenClawRelayTarget[] {
    return Array.from(this.targetById.values()).map((target) => cloneValue(target));
  }
}

function buildCommandClientError(
  response: OpenClawBrowserRuntimeCommandSuccess | OpenClawBrowserRuntimeCommandFailure,
  stderr: string,
  exitCode?: number | null,
): Error {
  const error = new Error(response && !response.ok ? response.error.message : `OpenClaw runtime command exited with code ${String(exitCode ?? 'unknown')}.`) as Error & { code?: string; details?: unknown; stderr?: string; exitCode?: number | null };
  error.name = 'OpenClawBrowserRuntimeCommandError';
  error.code = response && !response.ok ? response.error.code : undefined;
  error.details = response && !response.ok ? response.error.details : undefined;
  error.stderr = stderr.trim() || undefined;
  error.exitCode = exitCode;
  return error;
}

function normalizeSessionId(value: string | null | undefined): string | null {
  const sessionId = String(value || '').trim();
  return sessionId ? sessionId : null;
}

function normalizeTargetId(value: string | null | undefined): string | null {
  const targetId = String(value || '').trim();
  return targetId ? targetId : null;
}

function normalizeComparableUrl(value: string | null | undefined): string | null {
  const url = String(value || '').trim();
  return url ? url : null;
}

function normalizeOpenClawCapabilities(input: Partial<OpenClawBrowserTransportCapabilities> | null | undefined, fallback: OpenClawBrowserTransportCapabilities): OpenClawBrowserTransportCapabilities {
  return {
    hostAvailable: input?.hostAvailable ?? fallback.hostAvailable,
    activeTarget: input?.activeTarget ?? fallback.activeTarget,
    runtimeInspection: input?.runtimeInspection ?? fallback.runtimeInspection,
    snapshotInspection: input?.snapshotInspection ?? fallback.snapshotInspection,
    targetResolution: input?.targetResolution ?? fallback.targetResolution,
    checkpointHandoff: input?.checkpointHandoff ?? fallback.checkpointHandoff,
    domActions: input?.domActions ?? fallback.domActions,
    actionReadiness: input?.actionReadiness ?? fallback.actionReadiness,
    snapshotRefLocators: input?.snapshotRefLocators ?? fallback.snapshotRefLocators,
    explicitSnapshotRebinding: input?.explicitSnapshotRebinding ?? fallback.explicitSnapshotRebinding,
    supportedDomActionKinds: Array.isArray(input?.supportedDomActionKinds) ? [...input.supportedDomActionKinds] : [...fallback.supportedDomActionKinds],
    supportedLocatorKinds: Array.isArray(input?.supportedLocatorKinds) ? [...input.supportedLocatorKinds] : [...fallback.supportedLocatorKinds],
  };
}

function defaultOpenClawCapabilities(overrides: Partial<OpenClawBrowserTransportCapabilities> = {}): OpenClawBrowserTransportCapabilities {
  return { hostAvailable: true, activeTarget: null, runtimeInspection: false, snapshotInspection: false, targetResolution: false, checkpointHandoff: false, domActions: false, actionReadiness: false, snapshotRefLocators: false, explicitSnapshotRebinding: false, supportedDomActionKinds: [], supportedLocatorKinds: [], ...cloneValue(overrides) };
}

function defaultAttachedTargetResolver(targets: OpenClawRelayTarget[], input: OpenClawRelayAttachRequest): OpenClawRelayTarget | null {
  const normalizedUrl = normalizeComparableUrl(input.url);
  const rankedTargets = targets
    .filter(isUsableTarget)
    .map((target) => {
      const matchesSession = normalizeSessionId(target.sessionId) === input.sessionId;
      const matchesUrl = normalizedUrl !== null && urlsMatchForAttach(target.url, normalizedUrl);
      return { target, matchesSession, matchesUrl, score: (matchesSession ? 100 : 0) + (matchesUrl ? 10 : 0) + (target.active ? 1 : 0) };
    })
    .filter((candidate) => candidate.matchesSession || candidate.matchesUrl);
  if (rankedTargets.length === 0) return null;
  const highest = Math.max(...rankedTargets.map((candidate) => candidate.score));
  const best = rankedTargets.filter((candidate) => candidate.score === highest);
  if (best.length > 1) {
    throw createOpenClawCodeError('OPENCLAW_TARGET_AMBIGUOUS', best.some((candidate) => candidate.matchesSession)
      ? `Multiple OpenClaw targets are already attached for session ${input.sessionId}.`
      : `Multiple OpenClaw targets match ${input.url}; refusing to attach implicitly.`);
  }
  return cloneValue(best[0].target);
}

function urlsMatchForAttach(targetUrl: string | null | undefined, requestedUrl: string): boolean {
  const normalizedTargetUrl = normalizeComparableUrl(targetUrl);
  if (!normalizedTargetUrl) return false;
  if (normalizedTargetUrl === requestedUrl) return true;
  return normalizedTargetUrl.startsWith(`${requestedUrl}/`) || requestedUrl.startsWith(`${normalizedTargetUrl}/`);
}

function normalizeToolTargets(targets: OpenClawBrowserToolClientTarget[] | OpenClawRelayTarget[] | null | undefined, now: () => string): OpenClawRelayTarget[] {
  return (Array.isArray(targets) ? targets : []).map((target) => normalizeToolTarget(target as OpenClawBrowserToolClientTarget, (target as OpenClawRelayTarget).sessionId ?? null, now));
}

function normalizeToolTarget(target: OpenClawBrowserToolClientTarget | OpenClawRelayTarget, fallbackSessionId: string | null, now: () => string): OpenClawRelayTarget {
  const targetId = normalizeTargetId(target.targetId);
  if (!targetId) throw new Error('OpenClaw browser target does not include a targetId.');
  return {
    targetId,
    sessionId: normalizeSessionId(target.sessionId ?? fallbackSessionId),
    url: target.url,
    title: target.title,
    available: target.available ?? true,
    attached: target.attached ?? true,
    active: target.active ?? false,
    updatedAt: target.updatedAt ?? now(),
    inspection: normalizeInspectionMetadata(target.inspection, target, now),
  };
}

function isUsableTarget(target: OpenClawRelayTarget | null | undefined): target is OpenClawRelayTarget {
  return Boolean(target && normalizeTargetId(target.targetId) && target.available !== false && target.attached !== false);
}

function createOpenClawCodeError(code: OpenClawBrowserHostErrorCode, message: string): Error {
  const error = new Error(message) as Error & { code?: OpenClawBrowserHostErrorCode };
  error.code = code;
  return error;
}

function mapOpenClawHostError(error: unknown, operation: OpenClawBrowserHostOperation): OpenClawBrowserHostError | null {
  const code = normalizeOpenClawHostErrorCode((error as { code?: unknown } | null | undefined)?.code);
  if (!code) return null;
  return new OpenClawBrowserHostError(code, operation, error instanceof Error ? error.message : `OpenClaw runtime reported ${code}.`, { cause: error });
}

function normalizeOpenClawHostErrorCode(value: unknown): OpenClawBrowserHostErrorCode | null {
  switch (value) {
    case 'OPENCLAW_RELAY_UNAVAILABLE':
    case 'OPENCLAW_BROWSER_UNAVAILABLE':
    case 'OPENCLAW_TARGET_UNAVAILABLE':
    case 'OPENCLAW_TARGET_NOT_FOUND':
    case 'OPENCLAW_TARGET_AMBIGUOUS':
    case 'OPENCLAW_SESSION_MISMATCH':
    case 'OPENCLAW_SNAPSHOT_UNAVAILABLE':
    case 'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED':
    case 'OPENCLAW_ACTION_REJECTED':
    case 'OPENCLAW_ACTION_TIMEOUT':
    case 'OPENCLAW_LOCATOR_UNSUPPORTED':
    case 'OPENCLAW_MISSING_INSPECTION_CONTEXT':
    case 'OPENCLAW_MISSING_SNAPSHOT_CONTEXT':
    case 'OPENCLAW_STALE_REF':
    case 'OPENCLAW_AMBIGUOUS_REF':
      return value;
    default:
      return null;
  }
}

function createSnapshotBoundActionRecoveryAdvice(input: {
  code: BrowserHostDomActionFailureCode;
  actionRequest: BrowserHostDomActionRequest;
  readiness: BrowserHostActionReadiness;
}): BrowserHostDomActionRecoveryAdvice | undefined {
  if (!input.readiness.preconditions.locatorNeedsSnapshotRef && input.actionRequest.locator.kind !== 'aria-ref') {
    return undefined;
  }

  const steps: BrowserHostRecoveryAdviceStep[] = [];
  switch (input.code) {
    case 'target_not_found':
      pushRecoveryAdviceStep(steps, {
        action: 'rebind',
        resource: 'target_binding',
        state: 'missing',
        detail: 'Rebind the session to the intended browser target before retrying the snapshot-bound action.',
      });
      break;
    case 'ambiguous_target':
    case 'session_mismatch':
      pushRecoveryAdviceStep(steps, {
        action: 'rebind',
        resource: 'target_binding',
        state: 'obsolete',
        detail: 'Confirm the intended browser target for this session and rebind before retrying the snapshot-bound action.',
      });
      break;
  }

  if (input.code === 'missing_inspection_context') {
    pushRecoveryAdviceStep(steps, {
      action: 'reinspect',
      resource: 'inspection_context',
      state: 'missing',
      detail: 'Reinspect the currently bound target so the action can use current inspection context.',
    });
  }

  if (
    (input.code === 'missing_inspection_context' || input.code === 'missing_snapshot_context')
    && (input.readiness.snapshot === 'missing' || input.readiness.snapshotRef.freshness === 'missing_runtime_snapshot')
  ) {
    pushRecoveryAdviceStep(steps, {
      action: 'reinspect',
      resource: 'snapshot_context',
      state: 'missing',
      detail: 'Reinspect the currently bound target to capture a current snapshot artifact before retrying the snapshot-bound action.',
    });
  }

  if (
    input.code === 'missing_snapshot_context'
    && input.readiness.snapshotRef.freshness === 'missing_requested_snapshot'
  ) {
    pushRecoveryAdviceStep(steps, {
      action: 'reacquire',
      resource: 'snapshot_ref',
      state: 'missing',
      detail: 'Reacquire the locator from an explicit snapshot artifact/version and include that snapshot context in the action request.',
    });
  }

  if (input.code === 'stale_ref') {
    pushRecoveryAdviceStep(steps, {
      action: 'reacquire',
      resource: 'snapshot_ref',
      state: 'obsolete',
      detail: 'Reacquire the locator from the currently bound snapshot artifact/version instead of reusing an older snapshot ref.',
    });
  }

  if (input.code === 'ambiguous_ref') {
    pushRecoveryAdviceStep(steps, {
      action: 'reinspect',
      resource: 'inspection_context',
      state: 'obsolete',
      detail: 'Reinspect the currently bound target to confirm the current page structure before choosing a locator.',
    });
    pushRecoveryAdviceStep(steps, {
      action: 'reacquire',
      resource: 'snapshot_ref',
      state: 'obsolete',
      detail: 'Reacquire a fresh locator from the current snapshot instead of reusing the ambiguous snapshot ref.',
    });
  }

  if (!steps.length) return undefined;
  return {
    kind: 'snapshot-bound-action',
    autoRecovery: 'none',
    steps,
  };
}

function pushRecoveryAdviceStep(steps: BrowserHostRecoveryAdviceStep[], step: BrowserHostRecoveryAdviceStep): void {
  if (steps.some((current) =>
    current.action === step.action
    && current.resource === step.resource
    && current.state === step.state
  )) {
    return;
  }
  steps.push(step);
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function normalizeSnapshotLocatorRebinding(rebinding: BrowserHostDomActionRequest['rebinding'] | null | undefined) {
  if (!rebinding) return undefined;
  const snapshotContext = normalizeSnapshotContext(rebinding.snapshotContext);
  const previousSnapshotContext = normalizeSnapshotContext(rebinding.previousSnapshotContext);
  if (!snapshotContext) return undefined;
  return {
    snapshotContext,
    locator: cloneValue(rebinding.locator),
    previousSnapshotContext,
    previousLocator: rebinding.previousLocator ? cloneValue(rebinding.previousLocator) : undefined,
  };
}

function createRebindingReadiness(input: BrowserHostDomActionRequest, currentSnapshotContext: BrowserHostSnapshotContext | undefined, requestedSnapshotContext: BrowserHostSnapshotContext | undefined) {
  const submitted = normalizeSnapshotLocatorRebinding(input.rebinding);
  if (!submitted) return { status: 'not-provided' as const };
  if (submitted.locator.kind !== 'aria-ref') return { status: 'rejected' as const, submitted, rejectionCode: 'rebound_locator_not_snapshot_derived' as const, detail: 'Rebinding submissions for snapshot-backed refs must carry an aria-ref locator derived from a snapshot artifact.' };
  if (!currentSnapshotContext || submitted.snapshotContext.artifact.artifactId != currentSnapshotContext.artifact.artifactId || submitted.snapshotContext.artifact.version != currentSnapshotContext.artifact.version) return { status: 'rejected' as const, submitted, rejectionCode: 'rebinding_artifact_mismatch' as const, detail: 'Submitted rebinding locator was not derived from the currently bound snapshot artifact/version.' };
  if (!requestedSnapshotContext) return { status: 'rejected' as const, submitted, rejectionCode: 'invalid_rebinding_submission' as const, detail: 'Snapshot-backed rebinding submissions require the action request to name the fresh snapshot artifact/version explicitly.' };
  if (submitted.snapshotContext.artifact.artifactId != requestedSnapshotContext.artifact.artifactId || submitted.snapshotContext.artifact.version != requestedSnapshotContext.artifact.version) return { status: 'rejected' as const, submitted, rejectionCode: 'rebinding_artifact_mismatch' as const, detail: 'Submitted rebinding locator does not match the explicit snapshot artifact/version requested for the action.' };
  return { status: 'accepted' as const, submitted, accepted: submitted };
}

function normalizeSnapshotContext(snapshotContext: BrowserHostSnapshotContext | null | undefined): BrowserHostSnapshotContext | undefined {
  const artifactId = String(snapshotContext?.artifact?.artifactId || '').trim();
  const version = String(snapshotContext?.artifact?.version || '').trim();
  if (!artifactId || !version) return undefined;
  const capturedAt = typeof snapshotContext?.artifact?.capturedAt === 'string' && snapshotContext.artifact.capturedAt.trim() ? snapshotContext.artifact.capturedAt.trim() : undefined;
  return { artifact: { artifactId, version, capturedAt } };
}

function createSnapshotRefReadiness(snapshotRequirement: 'required' | 'optional' | 'none', currentSnapshotContext: BrowserHostSnapshotContext | undefined, requestedSnapshotContext: BrowserHostSnapshotContext | undefined) {
  if (snapshotRequirement === 'none') return { freshness: 'not-required' as const };
  if (!currentSnapshotContext) return { freshness: 'missing_runtime_snapshot' as const, requested: requestedSnapshotContext };
  if (!requestedSnapshotContext) return { freshness: 'missing_requested_snapshot' as const, current: currentSnapshotContext };
  if (currentSnapshotContext.artifact.artifactId === requestedSnapshotContext.artifact.artifactId && currentSnapshotContext.artifact.version === requestedSnapshotContext.artifact.version) return { freshness: 'current' as const, current: currentSnapshotContext, requested: requestedSnapshotContext };
  return { freshness: 'stale' as const, current: currentSnapshotContext, requested: requestedSnapshotContext };
}


function resolveReconnectCandidate(targets: OpenClawRelayTarget[], input: { sessionId: string; boundTargetId: string; entryUrl: string; currentTargetUrl: string; lastOpenedUrl: string }): OpenClawRelayTarget | null {
  const usable = targets.filter(isUsableTarget);
  const exactSession = usable.filter((target) => normalizeSessionId(target.sessionId) === input.sessionId);
  const byBoundId = exactSession.find((target) => target.targetId === input.boundTargetId);
  if (byBoundId) return cloneValue(byBoundId);
  const urlCandidates = exactSession.filter((target) => urlLooksRelated(target.url, input.currentTargetUrl) || urlLooksRelated(target.url, input.lastOpenedUrl) || urlLooksRelated(target.url, input.entryUrl));
  if (urlCandidates.length === 1) return cloneValue(urlCandidates[0]);
  if (urlCandidates.length > 1) throw createOpenClawCodeError('OPENCLAW_TARGET_AMBIGUOUS', `Multiple OpenClaw targets match the known session/url flow for ${input.sessionId}.`);
  if (exactSession.length === 1) return cloneValue(exactSession[0]);
  if (exactSession.length > 1) throw createOpenClawCodeError('OPENCLAW_TARGET_AMBIGUOUS', `Multiple OpenClaw targets remain attached for session ${input.sessionId}.`);
  const looseUrl = usable.filter((target) => urlLooksRelated(target.url, input.currentTargetUrl) || urlLooksRelated(target.url, input.lastOpenedUrl) || urlLooksRelated(target.url, input.entryUrl));
  if (looseUrl.length === 1) return cloneValue(looseUrl[0]);
  if (looseUrl.length > 1) throw createOpenClawCodeError('OPENCLAW_TARGET_AMBIGUOUS', `Multiple OpenClaw targets match the known URL flow for ${input.sessionId}.`);
  return null;
}

function urlLooksRelated(targetUrl: string | null | undefined, expectedUrl: string | null | undefined): boolean {
  const left = normalizeComparableUrl(targetUrl);
  const right = normalizeComparableUrl(expectedUrl);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}


function resolveSnapshotContextFromTarget(target: OpenClawRelayTarget | null | undefined): BrowserHostSnapshotContext | undefined {
  return normalizeSnapshotContext(target?.inspection?.snapshotContext);
}

function resolveSnapshotContextFromRuntimeState(runtimeState: BrowserAssistRuntimeState | null | undefined): BrowserHostSnapshotContext | undefined {
  return normalizeSnapshotContext(runtimeState?.snapshotContext ?? runtimeState?.inspection?.snapshotContext);
}

function normalizeInspectionMetadata(inspection: BrowserHostInspectionMetadata | null | undefined, target: Pick<OpenClawRelayTarget, 'url' | 'title' | 'updatedAt'>, now: () => string): BrowserHostInspectionMetadata | undefined {
  const source = inspection?.source ?? 'target';
  const url = inspection?.url ?? target.url;
  const normalizedUrl = inspection?.normalizedUrl ?? normalizeComparableUrl(url) ?? undefined;
  const title = inspection?.title ?? target.title;
  const textSnippet = inspection?.textSnippet;
  const capturedAt = inspection?.capturedAt ?? target.updatedAt ?? now();
  const snapshotContext = normalizeSnapshotContext(inspection?.snapshotContext);
  if (!title && !url && !textSnippet && !inspection && !snapshotContext) return undefined;
  return { source, title, url, normalizedUrl, textSnippet, capturedAt, snapshotContext };
}

function mergeInspectionMetadata(current: BrowserHostInspectionMetadata | undefined, incoming: BrowserHostInspectionMetadata | undefined, now: () => string): BrowserHostInspectionMetadata | undefined {
  if (!current) return incoming ? cloneValue(incoming) : undefined;
  if (!incoming) return cloneValue(current);
  return {
    source: incoming.source ?? current.source ?? 'target',
    title: incoming.title ?? current.title,
    url: incoming.url ?? current.url,
    normalizedUrl: incoming.normalizedUrl ?? current.normalizedUrl ?? normalizeComparableUrl(incoming.url ?? current.url) ?? undefined,
    textSnippet: incoming.textSnippet ?? current.textSnippet,
    capturedAt: incoming.capturedAt ?? current.capturedAt ?? now(),
    snapshotContext: normalizeSnapshotContext(incoming.snapshotContext ?? current.snapshotContext),
  };
}

function createOpenClawSnapshotContext(targetId: string, versionSeed: string, capturedAt: string): BrowserHostSnapshotContext {
  return {
    artifact: {
      artifactId: `snapshot:${targetId}`,
      version: versionSeed,
      capturedAt,
    },
  };
}

function resolveTargetCandidate(targets: OpenClawRelayTarget[], input: { sessionId: string; boundTargetId: string; entryUrl: string; currentTargetUrl: string; lastOpenedUrl: string }): BrowserHostTargetResolutionResult<OpenClawRelayTarget> {
  const usable = targets.filter(isUsableTarget);
  const exactSession = usable.filter((target) => normalizeSessionId(target.sessionId) === input.sessionId);
  const byBoundId = exactSession.find((target) => target.targetId === input.boundTargetId);
  if (byBoundId) return { outcome: 'resolved', target: cloneValue(byBoundId), evidences: [{ kind: 'boundTarget', detail: 'Recovered the previously bound target id within the same session.', sessionId: input.sessionId, targetId: byBoundId.targetId, matchesBoundTarget: true, matchesSession: true }] };
  const sessionUrlCandidates = exactSession.filter((target) => urlLooksRelated(target.url, input.currentTargetUrl) || urlLooksRelated(target.url, input.lastOpenedUrl) || urlLooksRelated(target.url, input.entryUrl));
  if (sessionUrlCandidates.length === 1) return { outcome: 'resolved', target: cloneValue(sessionUrlCandidates[0]), evidences: [{ kind: 'sameSession', detail: 'Recovered a single usable target in the same session.', sessionId: input.sessionId, targetId: sessionUrlCandidates[0].targetId, matchesSession: true }, { kind: 'urlFlow', detail: 'Target matched the known entry/current URL flow.', sessionId: input.sessionId, targetId: sessionUrlCandidates[0].targetId, url: sessionUrlCandidates[0].url, matchesUrlFlow: true }] };
  if (sessionUrlCandidates.length > 1) return { outcome: 'ambiguous', candidates: sessionUrlCandidates.map(cloneValue), evidences: sessionUrlCandidates.map((target) => ({ kind: 'urlFlow', detail: 'Multiple same-session targets matched the known URL flow.', sessionId: input.sessionId, targetId: target.targetId, url: target.url, matchesSession: true, matchesUrlFlow: true, active: target.active ?? false })) };
  if (exactSession.length === 1) return { outcome: 'resolved', target: cloneValue(exactSession[0]), evidences: [{ kind: 'sameSession', detail: 'Recovered the only usable target still attached for the session.', sessionId: input.sessionId, targetId: exactSession[0].targetId, matchesSession: true, active: exactSession[0].active ?? false }] };
  const activeSession = exactSession.filter((target) => target.active);
  if (activeSession.length === 1) return { outcome: 'resolved', target: cloneValue(activeSession[0]), evidences: [{ kind: 'sameSession', detail: 'Recovered an active target in the same session.', sessionId: input.sessionId, targetId: activeSession[0].targetId, matchesSession: true, active: true }] };
  if (exactSession.length > 1) return { outcome: 'ambiguous', candidates: exactSession.map(cloneValue), evidences: exactSession.map((target) => ({ kind: target.active ? 'activeTarget' : 'sameSession', detail: 'Multiple usable targets remain attached for the session.', sessionId: input.sessionId, targetId: target.targetId, matchesSession: true, active: target.active ?? false })) };
  const looseUrl = usable.filter((target) => urlLooksRelated(target.url, input.currentTargetUrl) || urlLooksRelated(target.url, input.lastOpenedUrl) || urlLooksRelated(target.url, input.entryUrl));
  if (looseUrl.length === 1) return { outcome: 'resolved', target: cloneValue(looseUrl[0]), evidences: [{ kind: 'urlFlow', detail: 'Recovered a single usable target from the known URL flow outside the bound session.', sessionId: input.sessionId, targetId: looseUrl[0].targetId, url: looseUrl[0].url, matchesUrlFlow: true, active: looseUrl[0].active ?? false }] };
  if (looseUrl.length > 1) return { outcome: 'ambiguous', candidates: looseUrl.map(cloneValue), evidences: looseUrl.map((target) => ({ kind: 'urlFlow', detail: 'Multiple usable targets matched the known URL flow.', sessionId: input.sessionId, targetId: target.targetId, url: target.url, matchesUrlFlow: true, active: target.active ?? false })) };
  return { outcome: 'missing', evidences: [{ kind: 'boundTarget', detail: 'No usable target matched the stale bound target id, session, or URL flow.', sessionId: input.sessionId, targetId: input.boundTargetId, matchesBoundTarget: false, matchesSession: false, matchesUrlFlow: false }] };
}

function summarizeResolutionFailure(sessionId: string, resolution: Exclude<BrowserHostTargetResolutionResult<OpenClawRelayTarget>, { outcome: 'resolved' }>): string {
  if (resolution.outcome === 'missing') return `No OpenClaw target could be resolved for session ${sessionId}.`;
  return `Multiple OpenClaw targets remain plausible for session ${sessionId}; refusing implicit recovery.`;
}

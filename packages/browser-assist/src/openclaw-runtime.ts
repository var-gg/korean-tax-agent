import type {
  OpenClawBrowserRuntimeCommandFailure,
  OpenClawBrowserRuntimeCommandOperation,
  OpenClawBrowserRuntimeCommandRequest,
  OpenClawBrowserRuntimeCommandSuccess,
  OpenClawBrowserToolClientTarget,
  OpenClawBrowserTransportCapabilities,
  OpenClawRelayCheckpointHandoffRequest,
  OpenClawRelayOpenRequest,
} from './openclaw.js';

export interface OpenClawBrowserControlServerClientOptions {
  baseUrl: string;
  profile?: string;
  target?: 'sandbox' | 'host' | 'node';
  node?: string;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

export interface OpenClawBrowserRuntimeHandlerOptions {
  client: {
    getCapabilities?(input: { sessionId?: string; runtimeTargetId?: string | null }): Promise<Partial<OpenClawBrowserTransportCapabilities>> | Partial<OpenClawBrowserTransportCapabilities>;
    listTargets(input: { sessionId?: string; url?: string; targetId?: string | null }): Promise<OpenClawBrowserToolClientTarget[]> | OpenClawBrowserToolClientTarget[];
    openTarget(input: OpenClawRelayOpenRequest): Promise<OpenClawBrowserToolClientTarget> | OpenClawBrowserToolClientTarget;
    getTarget?(input: { targetId: string }): Promise<OpenClawBrowserToolClientTarget | null> | OpenClawBrowserToolClientTarget | null;
    snapshotTarget?(input: { targetId: string }): Promise<OpenClawBrowserToolClientTarget | null> | OpenClawBrowserToolClientTarget | null;
    handoffCheckpoint?(input: OpenClawRelayCheckpointHandoffRequest): Promise<OpenClawBrowserToolClientTarget | null> | OpenClawBrowserToolClientTarget | null;
  };
}

export async function runOpenClawBrowserRuntimeCommand(options: OpenClawBrowserRuntimeHandlerOptions): Promise<void> {
  const request = JSON.parse(await readStdin()) as OpenClawBrowserRuntimeCommandRequest;
  const response = await handleOpenClawBrowserRuntimeCommand(request, options);
  process.stdout.write(JSON.stringify(response));
}

export async function handleOpenClawBrowserRuntimeCommand(
  request: OpenClawBrowserRuntimeCommandRequest,
  options: OpenClawBrowserRuntimeHandlerOptions,
): Promise<OpenClawBrowserRuntimeCommandSuccess | OpenClawBrowserRuntimeCommandFailure> {
  try {
    switch (request.operation) {
      case 'getCapabilities':
        return { ok: true, result: await (options.client.getCapabilities?.(request.input as { sessionId?: string; runtimeTargetId?: string | null }) ?? {}) };
      case 'listTargets':
        return { ok: true, result: await options.client.listTargets(request.input as { sessionId?: string; url?: string; targetId?: string | null }) };
      case 'openTarget':
        return { ok: true, result: await options.client.openTarget(request.input as OpenClawRelayOpenRequest) };
      case 'getTarget':
        if (typeof options.client.getTarget !== 'function') {
          return unsupported(request.operation);
        }
        return { ok: true, result: await options.client.getTarget(request.input as { targetId: string }) };
      case 'snapshotTarget':
        if (typeof options.client.snapshotTarget !== 'function') {
          return unsupported(request.operation);
        }
        return { ok: true, result: await options.client.snapshotTarget(request.input as { targetId: string }) };
      case 'handoffCheckpoint':
        if (typeof options.client.handoffCheckpoint !== 'function') {
          return unsupported(request.operation);
        }
        return { ok: true, result: await options.client.handoffCheckpoint(request.input as OpenClawRelayCheckpointHandoffRequest) };
      default:
        return unsupported((request as { operation?: string }).operation);
    }
  } catch (error) {
    return {
      ok: false,
      error: {
        message: error instanceof Error ? error.message : String(error),
        code: normalizeErrorCode((error as { code?: unknown } | null | undefined)?.code),
        details: error instanceof Error ? { name: error.name } : undefined,
      },
    };
  }
}

export class OpenClawBrowserControlServerClient {
  private readonly baseUrl: string;
  private readonly profile: string;
  private readonly target?: 'sandbox' | 'host' | 'node';
  private readonly node?: string;
  private readonly headers: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenClawBrowserControlServerClientOptions) {
    const baseUrl = String(options?.baseUrl || '').trim();
    if (!baseUrl) throw new TypeError('OpenClawBrowserControlServerClient requires a non-empty baseUrl.');
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.profile = String(options?.profile || 'chrome').trim() || 'chrome';
    this.target = options?.target;
    this.node = options?.node;
    this.headers = { ...(options?.headers ?? {}) };
    this.fetchImpl = options?.fetchImpl ?? fetch;
  }

  async getCapabilities(input: { runtimeTargetId?: string | null }) {
    const status = await this.call<{ running?: boolean }>('status', {});
    let activeTarget: boolean | null = null;
    if (input.runtimeTargetId) {
      const match = await this.getTarget({ targetId: input.runtimeTargetId });
      activeTarget = Boolean(match);
    }
    return {
      hostAvailable: status?.running !== false,
      activeTarget,
      runtimeInspection: true,
      snapshotInspection: true,
      checkpointHandoff: true,
    } satisfies Partial<OpenClawBrowserTransportCapabilities>;
  }

  async listTargets(input: { url?: string; targetId?: string | null }) {
    const response = await this.call<Array<{ id?: string; targetId?: string; url?: string; title?: string; active?: boolean }>>('tabs', { profile: this.profile });
    return (Array.isArray(response) ? response : [])
      .map((tab) => ({
        targetId: String(tab.targetId || tab.id || '').trim(),
        url: tab.url,
        title: tab.title,
        active: tab.active,
        attached: true,
        available: true,
      }))
      .filter((tab) => tab.targetId)
      .filter((tab) => !input.targetId || tab.targetId === input.targetId);
  }

  async openTarget(input: OpenClawRelayOpenRequest) {
    const opened = await this.call<{ targetId?: string; id?: string; url?: string; title?: string }>('open', {
      profile: this.profile,
      url: input.url,
    });
    const targetId = String(opened?.targetId || opened?.id || '').trim();
    if (!targetId) {
      throw createError('OPENCLAW_TARGET_UNAVAILABLE', 'OpenClaw browser open did not return a target id.');
    }
    return {
      targetId,
      sessionId: input.sessionId,
      url: opened?.url ?? input.url,
      title: opened?.title,
      available: true,
      attached: true,
    } satisfies OpenClawBrowserToolClientTarget;
  }

  async getTarget(input: { targetId: string }) {
    const targets = await this.listTargets({ targetId: input.targetId });
    return targets[0] ?? null;
  }

  async snapshotTarget(input: { targetId: string }) {
    const snapshot = await this.call<any>('snapshot', { profile: this.profile, targetId: input.targetId, refs: 'aria' });
    const text = extractSnapshotText(snapshot);
    const url = normalizeString(snapshot?.url) ?? normalizeString(snapshot?.page?.url);
    const title = normalizeString(snapshot?.title) ?? normalizeString(snapshot?.page?.title) ?? normalizeString(snapshot?.documentTitle);
    return {
      targetId: input.targetId,
      url,
      title,
      attached: true,
      available: true,
      inspectionSource: 'snapshot',
      snapshotText: text ?? undefined,
      snapshotTakenAt: new Date().toISOString(),
    } satisfies OpenClawBrowserToolClientTarget;
  }

  async handoffCheckpoint(input: OpenClawRelayCheckpointHandoffRequest) {
    return this.getTarget({ targetId: input.targetId });
  }

  private async call<TResult>(action: string, body: Record<string, unknown>): Promise<TResult> {
    const response = await this.fetchImpl(`${this.baseUrl}/browser`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify({ action, profile: this.profile, target: this.target, node: this.node, ...body }),
    });
    if (!response.ok) {
      throw createError('OPENCLAW_BROWSER_UNAVAILABLE', `OpenClaw browser control server returned ${response.status} ${response.statusText}.`);
    }
    return await response.json() as TResult;
  }
}

export function createOpenClawBrowserControlServerClientFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = String(env.OPENCLAW_BROWSER_SERVER_URL || '').trim();
  if (!baseUrl) {
    throw createError('OPENCLAW_BROWSER_UNAVAILABLE', 'OPENCLAW_BROWSER_SERVER_URL is required for the live OpenClaw browser runtime bridge.');
  }
  const token = String(env.OPENCLAW_BROWSER_SERVER_TOKEN || '').trim();
  return new OpenClawBrowserControlServerClient({
    baseUrl,
    profile: String(env.OPENCLAW_BROWSER_PROFILE || 'chrome').trim() || 'chrome',
    target: normalizeTarget(env.OPENCLAW_BROWSER_TARGET),
    node: String(env.OPENCLAW_BROWSER_NODE || '').trim() || undefined,
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });
}

function normalizeTarget(value: string | undefined): 'sandbox' | 'host' | 'node' | undefined {
  return value === 'sandbox' || value === 'host' || value === 'node' ? value : undefined;
}

function unsupported(operation: string | undefined): OpenClawBrowserRuntimeCommandFailure {
  return {
    ok: false,
    error: {
      message: `OpenClaw runtime operation ${String(operation || '<unknown>')} is unsupported.`,
      code: 'OPENCLAW_RUNTIME_OPERATION_UNSUPPORTED',
    },
  };
}

function createError(code: string, message: string): Error & { code?: string } {
  const error = new Error(message) as Error & { code?: string };
  error.code = code;
  return error;
}

function normalizeErrorCode(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}


function normalizeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function extractSnapshotText(snapshot: any): string | null {
  if (!snapshot || typeof snapshot !== 'object') return null;
  const direct = [snapshot.text, snapshot.markdown, snapshot.snapshot, snapshot.content].find((value) => typeof value === 'string' && value.trim());
  if (typeof direct === 'string' && direct.trim()) return direct.trim().slice(0, 4000);
  const lines = Array.isArray(snapshot.lines) ? snapshot.lines.filter((value: unknown) => typeof value === 'string' && value.trim()) : [];
  if (lines.length > 0) return lines.join(' ').slice(0, 4000);
  const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : Array.isArray(snapshot.elements) ? snapshot.elements : [];
  const parts = nodes.flatMap((node: any) => [node?.name, node?.text, node?.value]).filter((value: unknown) => typeof value === 'string' && value.trim());
  return parts.length > 0 ? parts.join(' ').slice(0, 4000) : null;
}

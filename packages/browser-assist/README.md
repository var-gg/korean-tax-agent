# Browser Assist

Consent-aware HomeTax browser assistance with a minimal real-browser runtime boundary.

## What works today

- start a HomeTax assist session with an explicit target URL
- open that target through a runtime adapter
- keep session/checkpoint state in a store
- expose runtime-facing state for:
  - current target URL
  - last opened URL
  - active checkpoint handoff
  - runtime target id / tab handle shape
- resume through authentication and page-ready checkpoints
- query status or stop a session explicitly

## Adapter boundaries

- `BrowserAssistSessionStore` owns persistence and keeps start/resume/status testable without a browser.
- `BrowserAssistRuntimeAdapter` owns browser-specific behavior.
  - `openTarget()` opens the initial URL and returns a receipt.
  - optional `handoffCheckpoint()` updates runtime state as the session moves from one consent checkpoint to the next.
  - optional `getRuntimeState()` lets status reads reflect the latest runtime-side state.
- `createBrowserAssistToolAdapter()` exposes `start`, `resume`, `status`, and `stop` methods shaped for the MCP tool layer.

## Runtime adapters included

### `RecordingBrowserRuntimeAdapter`

Pure test/dry-run adapter. It records:

- open requests
- checkpoint handoff requests
- runtime state per session

Use this in tests and smoke flows.

### `SystemBrowserRuntimeAdapter`

Minimum real-browser bridge for today.

- Opens the target URL in the user's system browser.
- Keeps a per-session runtime state object so the contract already has a place for a future browser-host-backed or tab-aware adapter.
- Supports dependency injection of a `launcher()` so it stays testable.

This is intentionally shallow: it does not do DOM automation, tab inspection, or page mutation.

### `BrowserHostRuntimeAdapter`

Adapter for a host-backed browser runtime boundary.

- Accepts either an injected `BrowserHostRuntimeClient` or a `BrowserHostExecutor`.
- Uses `ExecutorBackedBrowserHostClient` as the in-repo client path when an executor is provided.
- Supports `openTarget()`, `getRuntimeState()`, and `handoffCheckpoint()` today.
- Caches per-session runtime state so the adapter is usable with a mock or partially implemented client.

### `InMemoryBrowserHostExecutor`

Concrete in-repo stub executor for the generic browser-host seam.

- Keeps per-session runtime state keyed by session id.
- Records executor calls for tests, smoke workflows, and generic examples.
- Provides the minimum transport boundary for host-agnostic runtime tests.

### `OpenClawBrowserHostExecutor`

First concrete host adapter implementation behind the generic browser-host seam.

- Encapsulates OpenClaw-specific open/attach/inspect behavior without changing the core contract.
- Implements the minimum stable surface for `openTarget()`, `getRuntimeState()`, and `handoffCheckpoint()`.
- Delegates to a transport/provider object so the executor stays capability-aware and host-agnostic above the OpenClaw layer.
- Surfaces explicit failure codes for transport unavailability, browser-host unavailability, missing/unavailable targets, ambiguous reconnects, session mismatch, unsupported runtime inspection, and snapshot failures.
- Works with both `InMemoryOpenClawBrowserRelay` and `OpenClawBrowserToolTransport` while keeping broad DOM automation out of scope.
- T9 adds a narrow audited action slice: `click`, `fill`, and `press` against generic locators, capability-gated and returned as explicit action results instead of hidden side effects.
- T10 adds explicit host-agnostic action readiness/precondition reporting so action requests and receipts can say whether target, inspection, and snapshot-ref context were required, present, or missing.
- T11 upgrades snapshot-backed refs from “inspection is present” to an explicit versioned artifact context (`snapshotContext.artifact.{artifactId,version,capturedAt}`) that flows through inspection, runtime state, action requests, readiness, and receipts.
- The first honest OpenClaw action mapping only supports `aria-ref` locators; those actions now explicitly require that request snapshot context match the bound runtime snapshot artifact/version and distinguish `missing_snapshot_context`, `stale_ref`, and `ambiguous_ref` from broader transport failures.
- T12 adds narrow host-agnostic `recoveryAdvice` metadata on explicit snapshot-bound action failures so callers can inspect whether they need to reinspect the current target, reacquire a fresh snapshot artifact, or rebind/reacquire the locator from that fresh snapshot. T14 extends that advice with optional expected locator provenance metadata (`snapshot-derived`, derivation basis, snapshot artifact, inspection URL/source) so the next manual acquisition can be audited. The core does not auto-recover, auto-resnapshot, or retry.

### `OpenClawBrowserToolTransport`

Production-style OpenClaw transport for the executor path.

- Wraps a narrow external runtime client (`getCapabilities()`, `listTargets()`, `openTarget()`, optional `getTarget()` and `handoffCheckpoint()`).
- Maps OpenClaw browser availability and tab inspection into generic host capabilities.
- Supports attach-or-open semantics for `openTarget()` and tab-backed inspection for `getRuntimeState()` / `handoffCheckpoint()`.

### `OpenClawBrowserRuntimeCommandClient` + `scripts/openclaw-browser-runtime.ts`

Thin real bridge/runtime path for T6.

- `OpenClawBrowserRuntimeCommandClient` already spoke the T5 stdin/stdout command protocol seam.
- `scripts/openclaw-browser-runtime.ts` is the concrete adapter entrypoint that reads that protocol and calls a live OpenClaw browser control server client.
- `OpenClawBrowserControlServerClient` currently maps the stable slice onto OpenClaw browser server actions: `status`, `tabs`, `open`, and narrow `snapshot` reads.
- `getRuntimeState()` and `handoffCheckpoint()` can now enrich runtime state with normalized inspection metadata (`inspection.source/title/url/normalizedUrl/textSnippet/capturedAt/snapshotContext`) when the transport advertises inspection support.
- Reconnect and rebind now flow through a generic evidence-based target-resolution contract instead of OpenClaw-only heuristics; OpenClaw is just the first adapter implementing it.
- `handoffCheckpoint()` remains state-preserving: it re-resolves/re-binds the bound target instead of inventing DOM automation.
- Live use is environment-dependent: it requires `OPENCLAW_BROWSER_SERVER_URL` and usually a relay-attached Chrome target/profile if you want attach semantics.

### `InMemoryOpenClawBrowserRelay`

In-repo relay stub for the OpenClaw executor path.

- Simulates OpenClaw `open`, `attach`, `getTarget`, and capability reporting behavior.
- Lets tests/examples update or drop target state to exercise redirects and failure modes.
- Keeps OpenClaw-specific behavior isolated to the adapter layer.

## Example

```ts
import {
  InMemoryBrowserAssistSessionStore,
  SystemBrowserRuntimeAdapter,
  createBrowserAssistService,
} from '@korean-tax-agent/browser-assist';

const service = createBrowserAssistService({
  store: new InMemoryBrowserAssistSessionStore(),
  runtime: new SystemBrowserRuntimeAdapter({
    transport: 'system-browser',
  }),
});

const started = await service.startHomeTaxAssist({
  targetUrl: 'https://hometax.go.kr',
  requestedBy: 'agent',
});

console.log(started.session.runtimeState);
```

## OpenClaw example

```ts
import {
  BrowserHostRuntimeAdapter,
  InMemoryBrowserAssistSessionStore,
  OpenClawBrowserHostExecutor,
  OpenClawBrowserToolTransport,
  createBrowserAssistService,
} from '@korean-tax-agent/browser-assist';

const transport = new OpenClawBrowserToolTransport({
  client: {
    status: async () => ({ available: true, connected: true }),
    open: async ({ url }) => ({ targetId: 'openclaw-tab:demo', url }),
    tabs: async () => [{
      targetId: 'openclaw-tab:demo',
      url: 'https://hometax.go.kr/ready',
      attached: true,
      available: true,
    }],
  },
});

const executor = new OpenClawBrowserHostExecutor({
  transport,
  transportLabel: 'openclaw-browser-tool-live',
});

const runtime = new BrowserHostRuntimeAdapter({ executor });

const service = createBrowserAssistService({
  store: new InMemoryBrowserAssistSessionStore(),
  runtime,
});
```

See `examples/browser-assist-openclaw-adapter.ts` for a fuller mockable flow.
For the real command-bridge path, see `examples/browser-assist-openclaw-live-bridge.ts` and `scripts/openclaw-browser-runtime.ts`.

## Future wiring points

- `OpenClawBrowserHostExecutor` is the first concrete host adapter wired into the generic `BrowserHostExecutor` seam.
- `OpenClawBrowserToolTransport` is the first production-style transport/provider behind that executor; it now supports a real external runtime/client binding path while `InMemoryOpenClawBrowserRelay` remains the in-repo stub path.
- `BrowserHostExecutor.openTarget()` remains the minimum host seam to map a browser-assist session into a real host/browser open or attach call.
- `BrowserHostExecutor.getRuntimeState()` remains the host seam to read tab or session state back into `getHomeTaxAssistStatus()`.
- `BrowserHostExecutor.handoffCheckpoint()` remains the host seam to carry consent-checkpoint context across login/page-ready transitions.
- `BrowserHostRuntimeAdapter.getCapabilities()` now exposes host availability plus runtime-inspection / checkpoint-handoff support without coupling the core to OpenClaw-specific names.
- `packages/mcp-server/src/index.ts` now includes a `StubBrowserHostExecutor` for the future host package boundary.
- `../../docs/37-browser-host-capability-contract.md` describes the contract and responsibility split in more detail.

## Decisions and blockers

- Session state carries explicit checkpoints because HomeTax login and final approval must remain visible user actions.
- The runtime adapter shape stays stable while the transport is split into a browser-assist client layer and a host executor seam.
- Remaining gaps:
  - OpenClaw coverage is intentionally limited to open/status/handoff state, not DOM automation
  - the repo now ships a thin command runtime (`scripts/openclaw-browser-runtime.ts`), but the truly live path still depends on an external OpenClaw browser control server and, for attach semantics, a relay-attached Chrome tab/profile
  - attach resolution is intentionally narrow and should be refined by the real host integration rather than by core workflow code
  - no DOM automation or HomeTax field entry
  - persistence is still only in-memory until another store is provided

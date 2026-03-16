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
- Surfaces explicit failure codes for relay unavailability, missing/unavailable targets, session mismatch, and unsupported runtime inspection.
- Works with `InMemoryOpenClawBrowserRelay` for tests, smoke paths, and examples while keeping DOM automation out of scope.

### `InMemoryOpenClawBrowserRelay`

In-repo relay stub for the OpenClaw executor path.

- Simulates OpenClaw `open`, `attach`, and `getTarget` behavior.
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
  InMemoryOpenClawBrowserRelay,
  OpenClawBrowserHostExecutor,
  createBrowserAssistService,
} from '@korean-tax-agent/browser-assist';

const relay = new InMemoryOpenClawBrowserRelay({
  targetPrefix: 'openclaw-tab',
});

const executor = new OpenClawBrowserHostExecutor({
  relay,
  transport: 'openclaw-browser-tool',
});

const runtime = new BrowserHostRuntimeAdapter({
  executor,
});

const service = createBrowserAssistService({
  store: new InMemoryBrowserAssistSessionStore(),
  runtime,
});
```

See `examples/browser-assist-openclaw-adapter.ts` for a fuller mockable flow.

## Future wiring points

- `OpenClawBrowserHostExecutor` is the first concrete host adapter wired into the generic `BrowserHostExecutor` seam.
- `BrowserHostExecutor.openTarget()` remains the minimum host seam to map a browser-assist session into a real host/browser open or attach call.
- `BrowserHostExecutor.getRuntimeState()` remains the host seam to read tab or session state back into `getHomeTaxAssistStatus()`.
- `BrowserHostExecutor.handoffCheckpoint()` remains the host seam to carry consent-checkpoint context across login/page-ready transitions.
- `packages/mcp-server/src/index.ts` now includes a `StubBrowserHostExecutor` for the future host package boundary.
- `../../docs/37-browser-host-capability-contract.md` describes the contract and responsibility split in more detail.

## Decisions and blockers

- Session state carries explicit checkpoints because HomeTax login and final approval must remain visible user actions.
- The runtime adapter shape stays stable while the transport is split into a browser-assist client layer and a host executor seam.
- Remaining gaps:
  - OpenClaw coverage is intentionally limited to open/status/handoff state, not DOM automation
  - the in-repo `InMemoryOpenClawBrowserRelay` is only a relay stub for tests/examples
  - real browser tab attachment and current-page introspection still depend on a live OpenClaw relay implementation
  - no DOM automation or HomeTax field entry
  - persistence is still only in-memory until another store is provided

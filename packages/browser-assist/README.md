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
- Keeps a per-session runtime state object so the contract already has a place for a future OpenClaw `browser`-tool-backed or tab-aware adapter.
- Supports dependency injection of a `launcher()` so it stays testable.

This is intentionally shallow: it does not do DOM automation, tab inspection, or page mutation.

### `OpenClawBrowserRuntimeAdapter`

Adapter for an OpenClaw browser-tool-backed runtime boundary.

- Accepts either an injected `OpenClawBrowserRuntimeClient` or an `OpenClawBrowserToolExecutor`.
- Uses `OpenClawBrowserToolRuntimeClient` as the in-repo client path when an executor is provided.
- Supports `openTarget()`, `getRuntimeState()`, and `handoffCheckpoint()` today.
- Caches per-session runtime state so the adapter is usable with a mock or partially implemented client.

### `InMemoryOpenClawBrowserToolExecutor`

Concrete in-repo stub executor for the OpenClaw path.

- Keeps per-session runtime state keyed by session id.
- Records executor calls for tests, smoke workflows, and examples.
- Provides the minimum transport boundary until a real host/browser-tool bridge is attached.

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
  InMemoryBrowserAssistSessionStore,
  InMemoryOpenClawBrowserToolExecutor,
  OpenClawBrowserRuntimeAdapter,
  createBrowserAssistService,
} from '@korean-tax-agent/browser-assist';

const executor = new InMemoryOpenClawBrowserToolExecutor({
  runtimeTargetPrefix: 'openclaw-tab',
});

const runtime = new OpenClawBrowserRuntimeAdapter({
  executor,
});

const service = createBrowserAssistService({
  store: new InMemoryBrowserAssistSessionStore(),
  runtime,
});
```

See `examples/browser-assist-openclaw-adapter.ts` for a fuller mockable flow.

## Future wiring points

- `OpenClawBrowserToolExecutor.openTarget()` is the host seam to map a browser-assist session into an OpenClaw browser open or attach call.
- `OpenClawBrowserToolExecutor.getRuntimeState()` is the host seam to read tab or session state back into `getHomeTaxAssistStatus()`.
- `OpenClawBrowserToolExecutor.handoffCheckpoint()` is the host seam to carry consent-checkpoint context across login/page-ready transitions.
- `packages/mcp-server/src/index.ts` now includes a `StubOpenClawBrowserToolExecutor` for the future host package boundary.

## Decisions and blockers

- Session state carries explicit checkpoints because HomeTax login and final approval must remain visible user actions.
- The runtime adapter shape stays stable while the transport is split into a browser-assist client layer and a host executor seam.
- Remaining gaps:
  - no actual OpenClaw host transport yet; the in-repo executor is still an in-memory stub
  - no real browser tab attachment or current-page introspection
  - no DOM automation or HomeTax field entry
  - persistence is still only in-memory until another store is provided

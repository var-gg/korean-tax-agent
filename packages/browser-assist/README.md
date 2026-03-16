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

## Next bridge

See `docs/rfcs/04-openclaw-browser-bridge.md` for the proposed direct bridge from this package into an OpenClaw browser-controlled tab lifecycle.

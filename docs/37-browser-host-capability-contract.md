# Browser Host Capability Contract

- Status: active
- Canonical: English
- Parent: [README.md](./README.md)
- Related:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [08-hometax-submission-flow.md](./08-hometax-submission-flow.md)
  - [19-agentic-auth-and-consent-flow.md](./19-agentic-auth-and-consent-flow.md)
  - [rfcs/04-openclaw-browser-bridge.md](./rfcs/04-openclaw-browser-bridge.md)

## Purpose

The browser-assist package needs a stable host boundary that is not branded around one runtime.

This document defines that minimum browser-host contract so:

- MCP/core remains host-agnostic,
- browser-assist session semantics stay stable,
- OpenClaw can land as the first concrete adapter instead of the core concept,
- later hosts can implement the same seam without rewriting HomeTax workflow state.

## Canonical contract

The generic core names are:

- `BrowserHostRuntimeClient`
- `BrowserHostExecutor`
- `BrowserHostRuntimeAdapter`
- `ExecutorBackedBrowserHostClient`

The first concrete host implementation now landed as:

- `OpenClawBrowserHostExecutor`
- backed by an adapter-local transport/provider layer (`OpenClawBrowserTransport`)
- with both `InMemoryOpenClawBrowserRelay` and `OpenClawBrowserToolTransport` implementations

The adapter accepts either a client or an executor. The executor is the host/package seam. The client is the browser-assist-side wrapper that can call into that seam. Capability reporting is additive: the generic boundary can expose host availability, whether a target is currently attached/open, and whether runtime inspection / checkpoint handoff are supported.

```ts
interface BrowserHostRuntimeClient {
  openTarget(input: BrowserRuntimeOpenRequest): Promise<Partial<BrowserAssistOpenReceipt>>;
  getRuntimeState(input: {
    sessionId: string;
    target: BrowserAssistTarget;
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null>;
  handoffCheckpoint(input: BrowserRuntimeCheckpointHandoffRequest & {
    runtimeState: BrowserAssistRuntimeState | null;
  }): Promise<Partial<BrowserAssistRuntimeState> | null>;
}
```

`BrowserHostExecutor` mirrors the same method shape.

Implementation note:
- the current code still tolerates partial client/executor implementations during migration,
- but a supported host adapter should implement all three methods below.

## Minimum host contract

### `openTarget`

Required responsibility:

- open or attach the initial browser target for the session,
- bind the browser-assist session to a host-visible target handle when one exists,
- return enough state for the session to persist a usable runtime receipt.

Minimum return expectations:

- `transport`
- `runtimeTargetId` when the host has a stable target handle
- `targetUrl` or `currentTargetUrl`
- `lastOpenedUrl`
- `openedAt` when available

What the core assumes:

- this is the only place where a new browser target should be created implicitly,
- the host can choose whether that means open, attach, or reuse,
- the result becomes the baseline runtime state for later status reads and checkpoint handoff.

### `getRuntimeState`

Required responsibility:

- refresh the latest runtime-side view of the same session/target,
- keep `getHomeTaxAssistStatus()` grounded in actual host state,
- avoid inventing workflow progress that the user has not confirmed.

Minimum return expectations:

- current target URL when known,
- stable `runtimeTargetId` when known,
- last intentionally opened URL when known,
- updated timestamp or equivalent freshness marker.

What the core assumes:

- status reads can happen after redirects, certificate/login flows, or tab changes,
- the host is the source of truth for runtime-side location,
- checkpoint completion is still controlled by explicit resume, not by passive observation alone.

### `handoffCheckpoint`

Required responsibility:

- carry runtime context from one visible checkpoint to the next,
- preserve or intentionally update the host target association,
- record what changed after a user-completed checkpoint.

Minimum return expectations:

- same or updated `runtimeTargetId`,
- updated `currentTargetUrl`,
- updated `activeCheckpointId`,
- updated timestamp.

What the core assumes:

- HomeTax assist moves through explicit stages such as authentication and target-page confirmation,
- the host may need to preserve the same tab across those stages,
- checkpoint handoff is where the runtime can acknowledge that the user completed a step without hiding the step itself.

## Optional future capabilities

These are useful but should remain optional until a host proves them stable:

- `snapshotInspection`
  - read-only inspection enrichment such as title or visible-page summary carried back through runtime state
- `snapshot`
  - richer page metadata such as title, load state, or visible DOM summary
- `act`
  - controlled browser actions such as click/type/select with audit-friendly wrapping
- `navigate`
  - explicit post-open navigation or redirect-following control
- `targetResolution`
  - re-resolve an existing browser tab/window from stale bindings using inspectable evidence such as same-session, URL-flow, or active-target matches

Why these stay out of the minimum contract:

- they are the most likely place for host-specific instability,
- HomeTax flows can already benefit from open/status/handoff without fragile DOM automation,
- capability growth should be additive and advertised, not forced into the first host abstraction.

## Responsibility split

### MCP/core

Owns:

- session ids, checkpoints, and workflow state,
- persistence and resume semantics,
- readiness/blocking logic,
- consent and audit framing,
- when a tool may continue versus when it must wait for the user.

Must not own:

- host/browser transport details,
- tab attachment logic,
- DOM actions or browser process control,
- hidden auto-completion of auth/final-approval steps.

### Browser host executor or client

Owns:

- mapping session actions to host/browser operations,
- tracking runtime target handles,
- reflecting runtime-side URL/state back into the session,
- preserving runtime context across checkpoint handoff.

Must not own:

- tax workflow state transitions,
- review or readiness policy,
- silent advancement of user-gated workflow checkpoints.

### AI agent

Owns:

- deciding when to start, resume, or stop assist,
- narrating the next user-visible step,
- asking for confirmation at checkpoints,
- deciding when optional host capabilities are worth using.

Must not own:

- pretending a checkpoint is complete because the page looks different,
- silently bypassing authentication/certificate/final submission steps,
- treating host-side browser state as equivalent to user approval.

## Why checkpoint-driven control matters for HomeTax

HomeTax is not just a navigation problem. It includes high-friction, user-visible transitions:

- login and certificate flows,
- redirects into the real filing surface,
- page-ready verification before the agent continues,
- final submission stages that must remain explicit.

Checkpoint-driven control matters because it:

- keeps authentication and approval visible to the user,
- lets the host keep tab continuity without pretending the workflow is autonomous,
- gives the agent a clean point to pause, narrate, and resume,
- preserves an auditable line between user action and runtime state refresh,
- avoids overfitting the core contract to brittle DOM automation assumptions.

For HomeTax specifically, `handoffCheckpoint()` is the seam that says:

- the user completed a required step,
- the same browser target may still matter,
- the runtime can now refresh context for the next stage without silently collapsing two distinct approvals into one.

## Guidance for T3: OpenClaw as the first adapter

OpenClaw should implement this contract, not rename it.

The safest first adapter slice is:

1. map OpenClaw browser open/attach behavior into `openTarget()`
2. map OpenClaw tab snapshot/state reads into `getRuntimeState()`
3. keep `handoffCheckpoint()` state-oriented first, without DOM mutation
4. defer `snapshot`, `act`, `navigate`, and `resolveTarget` expansion until the host behavior is stable

Current implementation note:
- the repo now includes `OpenClawBrowserHostExecutor` for exactly this slice,
- `OpenClawBrowserToolTransport` is the first production-style transport behind that executor, with a narrow external runtime/client binding seam,
- `InMemoryOpenClawBrowserRelay` remains for tests/examples/smoke coverage,
- no DOM mutation or field-level automation is part of this tranche.

That keeps the product direction host-agnostic while still letting OpenClaw be the first real implementation.

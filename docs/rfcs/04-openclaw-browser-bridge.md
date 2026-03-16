# RFC 04 - OpenClaw browser bridge for HomeTax assist

## Goal

Connect `packages/browser-assist` to an OpenClaw-controlled browser without changing the current MCP-facing session contract.

## What exists now

The current package already has the right minimum boundaries:

- `BrowserAssistSessionStore`
- `BrowserAssistRuntimeAdapter`
- `start / resume / status / stop`
- runtime-facing state:
  - `runtimeTargetId`
  - `currentTargetUrl`
  - `lastOpenedUrl`
  - `activeCheckpointId`

This means the next OpenClaw implementation can be added behind the runtime boundary rather than by rewriting the service contract.

## Proposed adapter shape

Use the generic browser-host seam already exposed by `packages/browser-assist`:

- `BrowserHostRuntimeAdapter`
- `BrowserHostRuntimeClient`
- `BrowserHostExecutor`

Then add an OpenClaw-specific implementation behind that seam, rather than making OpenClaw the generic adapter name.

### Responsibilities

1. open the initial HomeTax URL through OpenClaw `browser.open` or `browser.navigate`
2. capture the returned `targetId`
3. persist runtime-side tab metadata into `runtimeState`
4. on checkpoint handoff, keep the session bound to the same tab when possible
5. on status reads, refresh the latest URL/title/readiness from OpenClaw browser state

### Non-goals

- full HomeTax DOM automation in the first adapter
- field-level typing or submission clicks
- automatic bypass of authentication or certificate steps

## Suggested shape

```ts
interface OpenClawBrowserClient {
  open(input: { url: string }): Promise<{ targetId: string; url?: string }>;
  navigate(input: { targetId: string; url: string }): Promise<{ url?: string }>;
  snapshot(input: { targetId: string }): Promise<{
    url?: string;
    title?: string;
    loadState?: 'loading' | 'domcontentloaded' | 'load';
  }>;
}
```

```ts
class OpenClawBrowserHostClient implements BrowserHostRuntimeClient {
  constructor(private readonly client: OpenClawBrowserClient) {}
}
```

## Runtime state additions

The existing state should remain stable. The adapter may enrich it through metadata, but these fields should stay canonical:

- `runtimeTargetId`: OpenClaw browser `targetId`
- `currentTargetUrl`: last known tab URL
- `lastOpenedUrl`: initial or last intentional navigation target
- `activeCheckpointId`: current browser-assist checkpoint

Optional future metadata:

- `pageTitle`
- `loadState`
- `lastSnapshotAt`
- `relayProfile` (`chrome` or `openclaw`)

## Flow

### 1. Start

- `startHomeTaxAssist()` calls runtime `openTarget()`
- adapter opens `https://hometax.go.kr` in OpenClaw browser
- adapter returns:
  - `runtimeTargetId`
  - `currentTargetUrl`
  - `lastOpenedUrl`
  - `openedAt`

### 2. Authentication checkpoint

- user performs login/certificate steps manually
- agent waits on explicit resume
- no hidden login automation

### 3. Handoff to page-ready checkpoint

- `resumeHomeTaxAssist()` marks auth checkpoint complete
- runtime `handoffCheckpoint()` keeps the same `runtimeTargetId`
- status remains visible through `activeCheckpointId`

### 4. Status refresh

- `getHomeTaxAssistStatus()` can call adapter `getRuntimeState()`
- adapter snapshots the same tab and refreshes `currentTargetUrl`
- if URL changed because the user navigated, the session sees it without changing the contract

## Why this is the right next step

- preserves the current MCP tool shape
- keeps user-auth steps explicit
- lets OpenClaw browser control plug in without forcing DOM automation yet
- creates a clean seam for later features:
  - attach existing Chrome tab
  - DOM inspection
  - guided selectors
  - field-level assist

## Next implementation slice

The smallest practical implementation after this RFC is:

1. define an adapter-facing `OpenClawBrowserClient`
2. add an `OpenClawBrowserHostClient` or `OpenClawBrowserHostExecutor`
3. wire that implementation into `BrowserHostRuntimeAdapter`
4. implement `openTarget()` using browser open/navigation
5. implement `getRuntimeState()` using browser snapshot
6. keep `handoffCheckpoint()` state-only for the first pass

That would give the project a real OpenClaw-controlled tab bridge without yet committing to fragile HomeTax DOM automation.

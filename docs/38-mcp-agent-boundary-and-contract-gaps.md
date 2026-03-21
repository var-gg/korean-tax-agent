# MCP / External Agent Boundary (Current Contract)

- Status: active
- Canonical: English
- Parent: [README.md](../README.md)
- Related:
  - [05-architecture.md](./05-architecture.md)
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
  - [39-agent-operator-quickstart.md](./39-agent-operator-quickstart.md)

## Purpose
This document is now a **current-boundary reference**, not an old tranche gap list.

It explains the implementation reality the repo already follows:
- MCP is the workflow/control-plane layer
- the external AI agent owns browser, file, OCR, and user-facing conversation
- the user should only be interrupted for login, consent, and judgment checkpoints

## Current boundary

### MCP owns
- workspace state
- collection planning and coverage gaps
- artifact ingestion by reference
- normalization, classification, review, draft computation, comparison, readiness, blockers, and audit
- HomeTax handoff/session state
- submission approval/result/receipt records
- read-only export-package generation

### External AI agent owns
- browser control and visible portal operation
- local file discovery / selection
- OCR or extraction before structured payloads are sent into MCP
- user-facing explanation and checkpoint narration
- the actual final click in submission flow

### User intervention policy
The user should be asked to act only for:
- **login**
- **consent**
- **judgment**

That includes:
- authentication checkpoints
- permission / scope approval
- review resolution
- final approval before submit

It does **not** mean the user should be asked to manually reconstruct hidden MCP state or guess the next step when MCP already exposes it.

## Historical note
Earlier versions of this document focused on runtime/facade exposure gaps.
Those specific gaps are no longer the main issue:
- `tax.setup.inspect_environment` and `tax.setup.init_config` are exposed
- `tax.sources.plan_collection` is exposed
- runtime/facade/tool-manifest/docs drift is covered by tests

So this document should no longer be read as a "missing implementation" checklist.
It should be read as the **current contract boundary** for future PRs and agent integrations.

## Practical rules for future changes

### In scope
Good MCP changes usually look like:
- richer state models
- better stop reason codes
- stronger review/audit outputs
- better read-only exports
- more precise handoff/checkpoint metadata
- better readiness / blocker decisions

### Out of scope
Boundary-violating changes usually look like:
- MCP directly browsing HomeTax pages as product responsibility
- MCP opening arbitrary local paths itself
- MCP running OCR internally as product responsibility
- MCP becoming the user-facing persuasive/conversational layer
- MCP silently bypassing consent, login, review, or final approval checkpoints

## Contract discipline
When adding or changing MCP tools:
1. update the canonical tool manifest
2. update contracts/runtime/facade/docs/tests together
3. preserve the boundary: MCP accepts refs, extracted payloads, and observations
4. do not smuggle browser/file/OCR responsibilities into MCP just because a host runtime can do them

## Why this matters
The repo is now broad enough that a smart AI agent can use it end to end.
That only stays true if the boundary remains simple and stable:
- MCP decides and records workflow truth
- the external AI agent performs browser/file/OCR/user interaction work around that truth
- the user intervenes only for login, consent, and judgment

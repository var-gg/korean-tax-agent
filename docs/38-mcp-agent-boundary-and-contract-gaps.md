# MCP / External Agent Boundary and Contract Gaps

- Status: active
- Canonical: English
- Parent: [README.md](./README.md)
- Related:
  - [05-architecture.md](./05-architecture.md)
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [13-implementation-roadmap.md](./13-implementation-roadmap.md)
  - [15-backlog.md](./15-backlog.md)

## Purpose

This document fixes the tranche-[1/6] boundary first: **MCP is the workflow server called by an external AI agent.**

That means MCP is the domain/tool layer: workflow state, checkpoints, validation, normalization, classification, drafting, comparison, readiness, blockers, and audit.
The external AI agent side owns browser automation, local file access, OCR/document extraction, and user-facing conversation/explanation/persuasion.

If a future change makes MCP look like it is discovering local files, reading screenshots directly, or driving HomeTax as product responsibility, that change is crossing the intended boundary.

## Scope boundary

### MCP is in scope for
- workspace and source state
- sync attempts, checkpoints, and resume semantics
- artifact registration and ingestion by reference
- normalization, classification, review, drafting, comparison, readiness, blockers, and audit
- narrow session/handoff contracts for browser assist

### MCP is out of scope for
- opening `C:\...` paths directly
- driving tabs/pages/selectors directly as product responsibility
- OCRing receipts or PDFs itself
- being the conversational UX layer that convinces or explains to the user

## Public contract cleanup applied in this tranche

### Reframed responsibilities
- import tools/docs now prefer **artifact refs / uploaded file refs** instead of local file-path responsibility
- comparison docs/contracts now prefer **portal-observed values supplied by the external agent** instead of implying MCP itself saw the browser page
- browser-assist start is framed as **workflow handoff/checkpoint session creation**, not as MCP becoming the browser controller
- OCR-shaped import responsibility in docs was reframed from `tax.import.scan_receipts` to `tax.import.submit_extracted_receipt_fields`

### Minimal contract change landed in code
- `CompareWithHomeTaxInput` now accepts optional `portalObservedFields[]` so the caller can provide structured HomeTax-observed values directly
- runtime/tool implementation prefers those supplied observed values when present

## Runtime / contracts / tool consistency findings

### Implemented in runtime/facade today
- `tax.sources.get_collection_status`
- `tax.workspace.get_status`
- `tax.filing.get_summary`
- `tax.sources.connect`
- `tax.sources.sync`
- `tax.sources.resume_sync`
- `tax.profile.detect_filing_path`
- `tax.classify.run`
- `tax.classify.list_review_items`
- `tax.classify.resolve_review_item`
- `tax.filing.compute_draft`
- `tax.filing.compare_with_hometax`
- `tax.filing.refresh_official_data`
- `tax.filing.prepare_hometax`
- `tax.browser.start_hometax_assist`

### Declared in docs/contracts but not implemented in runtime/facade
Priority 1 — should be resolved before broadening scope further:
- `tax.setup.inspect_environment`
- `tax.setup.init_config`
- `tax.sources.plan_collection` (implemented as a function in `tools.ts`, but not exposed through runtime/facade contract dispatch)

Priority 2 — keep as documented backlog until the runtime surface is ready:
- `tax.sources.plan_collection`
- `tax.sources.list`
- `tax.sources.disconnect`
- `tax.ledger.normalize`
- documented import tool family (`tax.import.*`)
- `tax.ledger.list_transactions`
- `tax.ledger.link_evidence`
- `tax.browser.resume_hometax_assist`
- `tax.browser.stop_hometax_assist`
- `tax.browser.get_checkpoint`

## Why these gaps matter

The main risk is not missing breadth by itself; it is **declared capability drift**.
If docs or exported contracts imply MCP can do more than the runtime actually exposes, future PRs are likely to reintroduce blurred responsibilities or build against non-existent tools.

## Recommended next tranche after [1/6]

**[2/6] Close the smallest contract/runtime gaps before expanding capability.**

Exact recommendation:
1. expose `tax.sources.plan_collection` through runtime/facade
2. either implement or temporarily de-scope `tax.setup.inspect_environment` and `tax.setup.init_config` from exported contracts
3. add a single source-of-truth implemented-tool matrix test so docs/contracts/runtime stay aligned
4. keep new work focused on MCP-side workflow/state/validation semantics, not browser/file/OCR orchestration

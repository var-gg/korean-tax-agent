# Korean Tax Agent

**Languages:** [English](README.md) | [한국어](README.ko.md)

Open-source, agent-native product for **raising supported-path completion rates toward 99% assisted filing success for Korean comprehensive income tax**, from material preparation through submission.

This repository is building a **host-agnostic MCP core** for Korean comprehensive income tax workflow, plus optional runtime-specific integrations and examples.
It should remain usable whether the operator runs it through OpenClaw, Codex-style apps, Claude-oriented agent workspaces, or other agent runtimes.

## MCP vs external AI agent boundary

This repo treats **MCP as a workflow server**, not as the whole agent.
The boundary is intentional and should constrain future PRs.

**MCP owns:**
- workspace state and checkpoints
- validation, normalization, and classification
- review queues, draft computation, comparison, readiness, blockers, and audit
- narrow agent-facing tool contracts that accept artifact refs, uploaded file refs, structured extracted payloads, and portal-observed values

**The external AI agent owns:**
- browser control and visible step-by-step portal operation
- local file access and choosing which files to upload or reference
- OCR or document extraction before structured values are handed to MCP
- user-facing conversation, narration, persuasion, and checkpoint explanation

Concrete examples:
- **in scope for MCP:** compare a draft against `portalObservedFields`, create mismatch review items, decide whether submission readiness is blocked
- **out of scope for MCP:** open a browser tab, inspect the DOM directly, read a PDF from `C:\...`, run OCR on a receipt image, or convince a user to approve a risky action

See also: [docs/05-architecture.md](./docs/05-architecture.md), [docs/09-mcp-tool-spec.md](./docs/09-mcp-tool-spec.md), [docs/27-v1-supported-paths-and-stop-conditions.md](./docs/27-v1-supported-paths-and-stop-conditions.md), and [docs/38-mcp-agent-boundary-and-contract-gaps.md](./docs/38-mcp-agent-boundary-and-contract-gaps.md).

## External AI agent integration quickstart

If you are integrating this repo into an external AI agent, the intended split is:
- call MCP tools for **domain state and decisions**
- use the external AI agent/runtime for **browser, file, OCR, and user interaction**

A minimal integration loop is:
1. Call `tax.setup.init_config` and `tax.sources.plan_collection`.
2. Let the external AI agent gather consent/auth, pick files, inspect HomeTax pages, and extract structured values.
3. Send **artifact refs**, **uploaded file refs**, **structured extracted payloads**, and **portal-observed values** into MCP tools.
4. Read `tax.workspace.get_status` or `tax.filing.get_summary` and follow `nextRecommendedAction`.
5. Record the observed submission result (`success` / `fail` / `unknown`) before export; this closes the assist session and converges workspace state.
6. Stop and ask the user for help whenever MCP reports consent/auth/review/coverage/comparison blockers.

Trust-policy note:
- `stopReasonCodes` are reserved for active blockers that should stop or hard-downgrade progression.
- `tax.workspace.get_status`, `tax.filing.get_summary`, and `runtimeSnapshot.blockerCodes` should agree on active blocker truth.
- Collection planning should follow the canonical source-method registry (`packages/mcp-server/src/source-method-registry.ts`) for preferred/fallback/known-invalid methods and re-verification timing.
- Non-blocking downgrade signals should appear as warnings and operator explanation instead of pretending filing is fully blocked.

Runnable examples for this external-agent model:
- [`examples/external-agent-artifact-ingestion-example.ts`](./examples/external-agent-artifact-ingestion-example.ts)
- [`examples/external-agent-compare-with-hometax-example.ts`](./examples/external-agent-compare-with-hometax-example.ts)
- [`examples/external-agent-next-step-example.ts`](./examples/external-agent-next-step-example.ts)

Policy extraction note:
- `packages/mcp-server/src/policy/` now holds extracted domain-policy helpers for collection, regime, opportunity, and submission logic.
- `runtime.ts` and `tools.ts` remain the public orchestration/dispatch surfaces.
- Public tool names and response envelopes are intentionally unchanged.

## Durable persistence (opt-in)

Default behavior stays the same: the prototype runtime and browser-assist session store are still **in-memory by default**.

If you want state to survive process restart, opt in to the shared JSON snapshot adapter:

```ts
import { JsonFileSnapshotPersistenceAdapter } from '@korean-tax-agent/core';
import { InMemoryKoreanTaxMCPRuntime } from '@korean-tax-agent/mcp-server';
import { PersistentBrowserAssistSessionStore } from '@korean-tax-agent/browser-assist';

const runtimePersistence = new JsonFileSnapshotPersistenceAdapter({
  path: './data/runtime-snapshot.json',
});
const browserAssistPersistence = new JsonFileSnapshotPersistenceAdapter({
  path: './data/browser-assist-sessions.json',
});

const runtime = new InMemoryKoreanTaxMCPRuntime({
  persistence: runtimePersistence,
});

const browserAssistStore = new PersistentBrowserAssistSessionStore(browserAssistPersistence);
```

Notes:
- persistence is **opt-in**; no snapshot file is created unless you pass an adapter
- writes are atomic (`temp` file + `rename`)
- snapshot files include `schemaVersion`
- no external DB or network dependency is added

## MCP tool manifest maintenance

The canonical single source of truth for MCP tool exposure is:
- `packages/mcp-server/src/tool-manifest.ts`

When adding a new tool:
1. update the canonical manifest first
2. add/update the contract in `contracts.ts`
3. wire runtime support and facade exposure
4. update docs status (`implemented` vs `future/pending`)
5. run drift tests (`npm test`) and type checks (`npm run check`)

## Product message

This project is not trying to be:
- a global tax engine,
- a generic “do everything” agent platform,
- or silent fully autonomous tax filing.

This project is trying to be:
- a Korea-specific assisted filing product,
- an AI agent + MCP workflow system that moves from material preparation to submission,
- a consent-gated and checkpoint-driven filing flow,
- and a portable MCP surface that different agent runtimes can adopt.

In short:
- **product scope:** Korean comprehensive income tax, from material preparation to supported-path submission
- **launch goal:** supported paths completion
- **core interface:** host-agnostic MCP contracts and state model
- **runtime posture:** works with multiple agent runtimes; not tied to one bridge or messenger
- **submission posture:** assisted and explicit, not silent automation

## Why this exists

Korean tax filing is not just a calculation problem.
It is a workflow problem.

Users often need to:
- gather documents from multiple sources,
- resolve missing or ambiguous evidence,
- review risky classifications,
- and manually move through government-facing steps that do not feel API-native.

This project treats tax filing as an **AI agent + MCP assisted workflow** rather than a single form or calculator.

## Current status

This repository is now in an **executable prototype** stage aligned to a clear launch target: improve supported-path completion for Korean comprehensive income tax filing by letting the AI agent lead material preparation while the user intervenes only for login, consent, and judgment checkpoints.

That means:
- core workflow contracts are documented,
- an in-memory MCP runtime exists for end-to-end filing flow exercises,
- the repo already supports a checkpoint-driven prototype path from classification to HomeTax preparation.

Implemented prototype coverage currently includes:
- filing-path detection,
- review queue generation and resolution,
- draft computation with persisted readiness metadata,
- opt-in durable JSON snapshot persistence for runtime state and browser-assist session state,
- a simulated `tax.filing.refresh_official_data` step that updates runtime freshness/readiness state,
- `tax.filing.compare_with_hometax` using caller-supplied `portalObservedFields`,
- mismatch-to-review escalation,
- mismatch resolution applied back to the draft,
- `tax.filing.prepare_hometax`,
- `tax.browser.start_hometax_assist` / `tax.browser.resume_hometax_assist` handoff state,
- minimum browser-assist session lifecycle and host-handoff bridge.

A minimum real-browser bridge is included through `SystemBrowserRuntimeAdapter`. The repo now also has a generic browser-host runtime seam, capability reporting, and a first concrete `OpenClawBrowserHostExecutor` adapter that can run either against the in-repo relay stub or a production-style `OpenClawBrowserToolTransport` bound to an external OpenClaw runtime/client path for the stable open/runtime-state/checkpoint-handoff slice. T6 added a thin command-bridge runtime script (`scripts/openclaw-browser-runtime.ts`) plus a live-style control-server client for that path. T7 added narrow snapshot-backed inspection and reconnect/rebind support; T8 lifts that into a host-agnostic target-resolution contract plus normalized inspection metadata so recovery evidence and inspection results are no longer adapter-local heuristics. T9 added an audited DOM action slice, T10 made action readiness explicit, T11 formalizes snapshot artifact identity/versioning so snapshot-backed refs are bound to a concrete snapshot artifact (`snapshotContext.artifact.{artifactId,version,capturedAt}`) instead of generic inspection presence, and T12 adds structured recovery advice on explicit snapshot-bound action failures. T13 adds a narrow host-agnostic explicit rebinding submission contract so callers can submit a fresh snapshot-derived locator/ref plus fresh snapshot artifact/version after that advice, have the submission validated/recorded explicitly in readiness and receipts, and reuse it without any hidden auto-rebinding or retries. T14 adds a narrow host-agnostic provenance/evidence contract for snapshot-derived locators/refs so inspection outputs, recovery advice, rebinding submissions, and action receipts can say which inspection context and snapshot artifact produced a locator, and audit that explicit rebinding without introducing acquisition orchestration or auto-recovery. T15 makes fresh locator acquisition itself caller-visible by letting inspection return typed snapshot-derived locator candidates with snapshot identity plus provenance/evidence, T16 adds deterministic caller-visible guidance metadata (`guidance.ranking/signals/rationale`) for manual comparison only, and T17 adds caller-visible candidate staleness/invalidation metadata (`candidate.staleness`) so callers can see whether an inspected snapshot-derived candidate is still tied to the currently bound snapshot artifact/version or has gone stale after snapshot turnover. That metadata is status only: the manual loop is still inspect candidates, compare them yourself, notice stale/current annotations, choose one, submit explicit rebinding, then act. Failures still carry inspectable `recoveryAdvice` metadata describing whether the next manual step is to reinspect the current target, reacquire a fresh snapshot artifact, or rebind a locator/ref against that fresh snapshot—without auto-recovery, hidden retries, or orchestration loops. Full browser automation and HomeTax field-level interaction are still pending. 
## Start here

### English reading path
If you want to stay in English, read in this order:
1. [docs/README.md](./docs/README.md)
2. [docs/00-overview.md](./docs/00-overview.md)
3. [docs/16-v1-prd.md](./docs/16-v1-prd.md)
4. [docs/17-data-collection-strategy.md](./docs/17-data-collection-strategy.md)
5. [docs/21-first-agentic-scenario.md](./docs/21-first-agentic-scenario.md)

### Korean reading path
If you want to stay in Korean, start here instead:
1. [README.ko.md](./README.ko.md)
2. [docs/README.ko.md](./docs/README.ko.md)

This repo is intended to be readable in either language without losing the main path.
When a Korean companion exists, Korean readers should be able to continue in Korean.
When a Korean companion does not exist, the English original is linked explicitly.

## Product test

The core product test is:
- the AI agent leads material preparation,
- the user intervenes only for login, consent, and judgment,
- supported paths progress from estimate-ready to draft-ready to submission-assist-ready with explicit checkpoints,
- and no part of that flow depends on silent automation.

## Prototype workflow snapshot

The current callable prototype filing loop is:
1. `tax.setup.inspect_environment`
2. `tax.setup.init_config`
3. `tax.sources.plan_collection`
4. `tax.sources.connect`
5. `tax.sources.list` (workspace source inventory / status view)
6. `tax.sources.sync`
7. `tax.sources.resume_sync`
8. `tax.sources.disconnect` (future sync only; retained imports stay in place)
9. `tax.ledger.normalize`
10. `tax.profile.detect_filing_path`
11. `tax.classify.run`
12. `tax.classify.list_review_items`
13. `tax.filing.compute_draft`
14. `tax.classify.resolve_review_item` when review items are open
15. `tax.filing.compute_draft` again after review resolution
16. `tax.filing.refresh_official_data` to refresh runtime freshness state
17. `tax.filing.compare_with_hometax` with caller-supplied `portalObservedFields`
18. if mismatches exist: resolve comparison review items and recompute/prepare as needed
19. `tax.filing.prepare_hometax`
20. `tax.browser.start_hometax_assist`
21. `tax.browser.resume_hometax_assist`

Steps 17-18 are a **workflow handoff** into an external browser-capable agent/runtime. They do not mean the MCP server itself becomes the browser controller or performs field-level HomeTax automation on its own.

Unsupported scope stays unsupported even if an external agent exists:
- MCP does **not** browse HomeTax directly
- MCP does **not** discover local files on its own
- MCP does **not** OCR receipts/PDFs/images
- MCP does **not** replace the user for consent, login, or judgment checkpoints

The external AI agent must stop and ask for more input/action when any of the following appears:
- `missing_consent`
- `missing_auth`
- `export_required`
- `missing_material_coverage` such as missing withholding or missing expense evidence
- `awaiting_review_decision`
- `comparison_incomplete` or material HomeTax mismatches that create review items
- unsupported filing path or unsupported HomeTax state

For runnable examples, use:
- `npm run smoke:workflow`
- `npm run smoke:openclaw-runtime`
- `npm run smoke:openclaw-bridge`
- `npm run smoke:openclaw-reconnect-snapshot`
- `npm run smoke:openclaw-action`
- `npm run example:browser-assist`
- `npm run example:openclaw-browser-assist`
- `npm run example:openclaw-live-bridge`

## What this repo contains

- `docs/` — public product, architecture, workflow, and roadmap documents
- `packages/` — implementation packages for core logic, MCP server, and browser assistance
- `skills/` — OpenClaw skill definition for agent-guided tax workflow
- `examples/` — sample config and sample import formats
- `templates/` — user consent and import templates

## Key design principles

- Human approval only at critical steps
- Agentic collection before manual upload fallback
- Local-first handling of sensitive data where possible
- Audit trail for automated classification and filing decisions
- Checkpoint-driven automation instead of hidden automation
- Public architecture, private user data
- Docs-first implementation

## Documentation language and navigation

Technical source-of-truth docs are currently written in **English**.
This is intentional.

Why:
- the repo is meant to be open source,
- the contributor surface is part of the broader MCP / agent tooling ecosystem,
- technical specs need tight alignment with code, types, and protocol terms.

Korean companion docs are provided selectively for onboarding, product understanding, and Korea-specific tax-domain clarity.

Reading-language rule:
- English readers should be able to continue through English docs without being forced into Korean.
- Korean readers should be able to continue through Korean companion docs when available.
- If an English spec and a translated doc diverge, the **English version is canonical**.

See also:
- [docs/README.md](./docs/README.md)
- [docs/README.ko.md](./docs/README.ko.md)
- [docs/23-documentation-language-policy.md](./docs/23-documentation-language-policy.md)

## Important docs

### Product and scope
- [docs/00-overview.md](./docs/00-overview.md)
- [docs/02-user-journey.md](./docs/02-user-journey.md)
- [docs/03-scope-and-non-goals.md](./docs/03-scope-and-non-goals.md)
- [docs/16-v1-prd.md](./docs/16-v1-prd.md)

### Agentic collection and user checkpoints
- [docs/17-data-collection-strategy.md](./docs/17-data-collection-strategy.md)
- [docs/18-source-feasibility-matrix.md](./docs/18-source-feasibility-matrix.md)
- [docs/19-agentic-auth-and-consent-flow.md](./docs/19-agentic-auth-and-consent-flow.md)
- [docs/08-hometax-submission-flow.md](./docs/08-hometax-submission-flow.md)

### Architecture and workflow contracts
- [docs/05-architecture.md](./docs/05-architecture.md)
- [docs/06-data-model.md](./docs/06-data-model.md)
- [docs/20-workspace-state-model.md](./docs/20-workspace-state-model.md)
- [docs/22-core-type-gap-analysis.md](./docs/22-core-type-gap-analysis.md)
- [docs/09-mcp-tool-spec.md](./docs/09-mcp-tool-spec.md)
- [docs/37-browser-host-capability-contract.md](./docs/37-browser-host-capability-contract.md)
- [docs/10-skill-design.md](./docs/10-skill-design.md)

### Risk and review
- [docs/04-risk-and-compliance.md](./docs/04-risk-and-compliance.md)
- [docs/07-consent-model.md](./docs/07-consent-model.md)
- [docs/11-review-queue.md](./docs/11-review-queue.md)
- [docs/12-security-storage.md](./docs/12-security-storage.md)

### Delivery
- [docs/13-implementation-roadmap.md](./docs/13-implementation-roadmap.md)
- [docs/14-open-source-strategy.md](./docs/14-open-source-strategy.md)

### Filing-input research
- [docs/25-korean-comprehensive-income-tax-data-research.md](./docs/25-korean-comprehensive-income-tax-data-research.md)
- [docs/26-domain-model-gap-analysis.md](./docs/26-domain-model-gap-analysis.md)
- [docs/15-backlog.md](./docs/15-backlog.md)

## License

This project is licensed under the **Apache License 2.0**.
See [`LICENSE`](LICENSE).


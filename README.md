# Korean Tax Agent

**Languages:** [English](README.md) | [한국어](README.ko.md)

Open-source, agent-native workflow for **Korean comprehensive income tax preparation**.

This repository is building a **host-agnostic MCP core** for Korean comprehensive income tax workflow, plus optional runtime-specific integrations and examples.
It should remain usable whether the operator runs it through OpenClaw, Codex-style apps, Claude-oriented agent workspaces, or other agent runtimes.

## Product message

This project is not trying to be:
- a global tax engine,
- a generic “do everything” agent platform,
- or silent fully autonomous tax filing.

This project is trying to be:
- a Korea-specific tax workflow product,
- an agent-guided preparation and review system,
- a consent-gated and checkpoint-driven filing flow,
- and a portable MCP surface that different agent runtimes can adopt.

In short:
- **product scope:** Korean comprehensive income tax workflow
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

This project treats tax filing as an **agent-guided workflow** rather than a single form or calculator.

## Current status

This repository is now in an **executable prototype** stage.

That means:
- core workflow contracts are documented,
- an in-memory MCP runtime exists for end-to-end filing flow exercises,
- the repo already supports a checkpoint-driven prototype path from classification to HomeTax preparation.

Implemented prototype coverage currently includes:
- filing-path detection,
- review queue generation and resolution,
- draft computation with persisted readiness metadata,
- official-data refresh,
- HomeTax comparison,
- mismatch-to-review escalation,
- mismatch resolution applied back to the draft,
- HomeTax preparation and browser-assist handoff,
- minimum browser-assist session lifecycle and real-browser open bridge.

A minimum real-browser bridge is included through `SystemBrowserRuntimeAdapter`. The repo now also has a generic browser-host runtime seam, capability reporting, and a first concrete `OpenClawBrowserHostExecutor` adapter that can run either against the in-repo relay stub or a production-style `OpenClawBrowserToolTransport` bound to an external OpenClaw runtime/client path for the stable open/runtime-state/checkpoint-handoff slice. T6 added a thin command-bridge runtime script (`scripts/openclaw-browser-runtime.ts`) plus a live-style control-server client for that path. T7 extends that path with narrow snapshot-backed inspection and deterministic reconnect/rebind heuristics for attached-tab environments. Full browser automation and HomeTax field-level interaction are still pending.
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

## Prototype workflow snapshot

The current prototype filing loop is:
1. `tax.profile.detect_filing_path`
2. `tax.classify.run`
3. `tax.classify.list_review_items`
4. `tax.filing.compute_draft`
5. `tax.classify.resolve_review_item`
6. `tax.filing.compute_draft` (recompute)
7. `tax.filing.refresh_official_data`
8. `tax.filing.compare_with_hometax`
9. if mismatches exist: create review items and resolve them
10. `tax.filing.prepare_hometax`
11. `tax.browser.start_hometax_assist`

For runnable examples, use:
- `npm run smoke:workflow`
- `npm run smoke:openclaw-runtime`
- `npm run smoke:openclaw-bridge`
- `npm run smoke:openclaw-reconnect-snapshot`
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


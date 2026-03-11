# Korean Tax Agent

**Languages:** [English](README.md) | [한국어](README.ko.md)

Open-source, agent-native workflow for **Korean comprehensive income tax preparation**.

This repository explores how an AI agent can guide a taxpayer through setup, consent, data collection, review, draft generation, and HomeTax-adjacent filing assistance — while keeping the human in control at critical checkpoints.

## Why this exists

Korean tax filing is not just a calculation problem.
It is a workflow problem.

Users often need to:
- gather documents from multiple sources,
- resolve missing or ambiguous evidence,
- review risky classifications,
- and manually move through government-facing steps that do not feel API-native.

This project treats tax filing as an **agent-guided workflow** rather than a single form or calculator.

## Positioning

This project is for **Korean comprehensive income tax filers who are willing to use agentic AI tooling**.
It is not limited to freelance developers.

The product scope is intentionally focused:
- **product scope:** Korean comprehensive income tax workflow
- **interaction model:** consent-gated, review-driven, agent-assisted
- **submission posture:** assisted and explicit, not silent automation

This is a **Korea-specific product workflow**, not a universal global tax engine.
Some internal patterns may later be reusable beyond this product, such as:
- consent checkpoints,
- review queues,
- resumable sync flows,
- workspace state models,
- audit trails for agent actions.

## Core idea

A user should be able to:
1. clone the repo,
2. run a bootstrap/setup flow,
3. connect filing-relevant data sources with explicit consent,
4. let the agent collect and normalize tax data,
5. review only ambiguous or high-risk items,
6. generate a filing draft,
7. optionally use browser assistance for HomeTax preparation and input.

The intended feeling is not:
> "Please upload everything first."

The intended feeling is:
> "I log in or approve when asked, and the agent keeps the workflow moving."

## Current status

This repository is currently in **docs-first scaffold** stage.

That means:
- the public architecture is being designed in the open,
- workflow contracts are being documented before heavy implementation,
- the product direction is already concrete enough to guide prototyping.

## Start here

If you are new to the repo, read these first:
1. `docs/00-overview.md`
2. `docs/16-v1-prd.md`
3. `docs/17-data-collection-strategy.md`
4. `docs/21-first-agentic-scenario.md`

Then use `docs/README.md` as the full document index.

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

## Documentation language

Technical source-of-truth docs are currently written in **English**.
This is intentional.

Why:
- the repo is meant to be open source,
- the contributor surface is part of the broader MCP / agent tooling ecosystem,
- technical specs need tight alignment with code, types, and protocol terms.

Korean companion docs may be added selectively for public onboarding and Korea-specific tax-domain clarity.
If an English spec and a translated doc diverge, the **English version is canonical**.

See also:
- `docs/23-documentation-language-policy.md`
- `README.ko.md`

## Important docs

### Product and scope
- `docs/00-overview.md`
- `docs/02-user-journey.md`
- `docs/03-scope-and-non-goals.md`
- `docs/16-v1-prd.md`

### Agentic collection and user checkpoints
- `docs/17-data-collection-strategy.md`
- `docs/18-source-feasibility-matrix.md`
- `docs/19-agentic-auth-and-consent-flow.md`
- `docs/08-hometax-submission-flow.md`

### Architecture and workflow contracts
- `docs/05-architecture.md`
- `docs/06-data-model.md`
- `docs/20-workspace-state-model.md`
- `docs/22-core-type-gap-analysis.md`
- `docs/09-mcp-tool-spec.md`
- `docs/10-skill-design.md`

### Risk and review
- `docs/04-risk-and-compliance.md`
- `docs/07-consent-model.md`
- `docs/11-review-queue.md`
- `docs/12-security-storage.md`

### Delivery
- `docs/13-implementation-roadmap.md`
- `docs/14-open-source-strategy.md`
- `docs/15-backlog.md`

## Initial scope

- Target users: Korean comprehensive income tax filers comfortable using AI agents
- Primary mode: personal/self-hosted or operator-controlled workflow
- Filing posture: semi-automated, consent-gated, review-driven
- Submission posture: assisted, not silent/hidden full automation

## Non-goals for v1

- fully autonomous, zero-review tax filing
- replacing professional tax/legal advice
- broad financial-data aggregation via regulated MyData partnerships
- supporting every taxpayer type from day one
- pretending all important data sources have stable APIs

## Repo workflow

Public product and engineering TODOs live in docs and GitHub Issues.
Private operational notes and real taxpayer data should stay outside the public repo.

## License

A license has **not been selected yet**.
Until one is added, default copyright restrictions apply.

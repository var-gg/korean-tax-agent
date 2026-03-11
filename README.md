# Korean Tax Agent

Open-source, agent-native workflow for Korean comprehensive income tax filing.

## Positioning

This project is for **comprehensive income tax filers who can use AGENT AI tooling**.
It is not limited to freelance developers.

The goal is to:
- minimize manual work,
- keep human approval at critical steps,
- let an agent guide setup, data collection, review, and filing preparation,
- stop before or at the final submission gate unless the user explicitly approves.

## Core idea

A user should be able to:
1. check out this repo,
2. run a bootstrap/setup flow,
3. connect filing-relevant data sources with explicit consent,
4. let the agent collect and normalize tax data,
5. review only ambiguous or high-risk items,
6. generate a filing draft,
7. optionally use browser assistance for HomeTax preparation and input.

The intended feeling is not "please upload everything first."
The intended feeling is "I log in or approve when asked, and the agent keeps the workflow moving."

## Current status

This repository is currently in **docs-first scaffold** stage.

That means:
- the public architecture is being designed in the open,
- the workflow contracts are being documented before heavy implementation,
- the product direction is already concrete enough to guide prototyping.

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

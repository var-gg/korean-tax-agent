# Korean Tax Agent

Open-source, agent-native workflow for Korean comprehensive income tax filing.

## Positioning

This project is for **comprehensive income tax filers who can use AGENT AI tooling**. It is not limited to freelance developers.

Goal:
- minimize manual work,
- keep human approval at critical steps,
- let an agent guide setup, data collection, review, and filing preparation,
- stop before or at the final submission gate unless the user explicitly approves.

## Core idea

A user should be able to:
1. check out this repo,
2. run a bootstrap/setup flow,
3. connect required data sources with explicit consent,
4. let the agent collect and normalize tax data,
5. review only ambiguous or high-risk items,
6. generate a filing draft,
7. optionally use browser assistance for HomeTax input.

## What this repo contains

- `docs/` product, architecture, consent, security, roadmap, and filing-flow documents
- `packages/` implementation packages for core logic, MCP server, and browser assistance
- `skills/` OpenClaw skill definition for agent-guided tax workflow
- `examples/` sample config and sample import formats
- `templates/` user consent and import templates

## Design principles

- Human approval only at critical steps
- Local-first handling of sensitive data where possible
- Audit trail for automated classification and filing decisions
- Docs-first implementation
- Public architecture, private user data

## Current status

This repository is currently in **docs-first scaffold** stage.

See:
- `docs/00-overview.md`
- `docs/02-user-journey.md`
- `docs/05-architecture.md`
- `docs/13-implementation-roadmap.md`
- `docs/17-data-collection-strategy.md`
- `docs/18-source-feasibility-matrix.md`
- `docs/19-agentic-auth-and-consent-flow.md`

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

## Repo workflow

Public product/engineering TODOs live in docs and GitHub Issues.
Private operational notes and real taxpayer data should stay outside the public repo.

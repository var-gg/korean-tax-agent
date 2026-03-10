---
name: korean-tax-filing
description: Agent-guided workflow for Korean comprehensive income tax preparation and assisted filing. Use when an OpenClaw-compatible agent needs to set up, collect tax-related data, classify ambiguous items, generate a filing draft, or guide a user through consent-gated HomeTax preparation.
---

# Korean Tax Filing

Use this skill to run a consent-aware, review-driven tax workflow.

## Operating rules
- Read `docs/00-overview.md`, `docs/02-user-journey.md`, `docs/07-consent-model.md`, and `docs/09-mcp-tool-spec.md` before executing broad workflow changes.
- Treat real taxpayer data as private runtime data, not repo content.
- Stop for explicit user approval at authentication, high-risk review, and final submission gates.
- Prefer grouped review questions over repeated one-off prompts.

## Resource map
- Workflow details: `references/workflow.md`
- Safety and consent: `references/safety-rules.md`
- Ambiguous item handling: `references/review-guidelines.md`
- Connector handling notes: `references/connector-playbook.md`

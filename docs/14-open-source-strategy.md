# Open Source Strategy

See also:
- `README.md`
- `docs/README.md`
- `docs/16-v1-prd.md`
- `docs/21-first-agentic-scenario.md`


## Why this should be public
- trust matters in tax-adjacent automation
- users need to inspect behavior and limits
- contributors can improve connectors, review logic, and docs
- public docs create a stronger onboarding story than code alone

## What should remain outside the public repo
- real taxpayer data
- private operating notes tied to actual filings
- credentials, tokens, and auth artifacts
- environment-specific secrets

## Repo-visible planning artifacts
- roadmap
- open questions
- backlog
- RFCs for major design decisions

## Collaboration posture
Use docs for durable product intent and GitHub Issues for granular task tracking.

## Documentation language posture
This project should keep **English as the canonical language for technical documentation** so that:
- open-source contributors can onboard more easily,
- MCP and agent-tooling terminology stays aligned with code,
- protocol and state-model language remains stable as implementation evolves.

At the same time, Korean companion docs are valuable for:
- local onboarding,
- explaining Korea-specific tax workflow context,
- communicating the product to Korean users and collaborators.

Recommended rule:
- English = canonical technical spec
- Korean = selective companion docs for high-value public entry points

See also:
- `docs/23-documentation-language-policy.md`

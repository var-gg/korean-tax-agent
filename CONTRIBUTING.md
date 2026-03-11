# Contributing

Thanks for your interest in contributing to Korean Tax Agent.

This project is still in an early **docs-first scaffold** stage, so the highest-value contributions are usually:
- clarifying product scope,
- tightening workflow contracts,
- identifying risky assumptions,
- improving architecture and type alignment,
- and adding implementation that matches the documented direction.

## Before you contribute

Please read these first:
1. `README.md`
2. `docs/00-overview.md`
3. `docs/16-v1-prd.md`
4. `docs/17-data-collection-strategy.md`
5. `docs/21-first-agentic-scenario.md`

If your change affects workflow semantics or product scope, update docs alongside code.

## Contribution principles

### 1. Keep product claims honest
Do not make the project sound more automated, more compliant, or more broadly integrated than it actually is.

Examples:
- Prefer "preparation" or "assistance" over implying silent end-to-end filing.
- Prefer explicit notes about review checkpoints over marketing-style automation claims.

### 2. Preserve the core product posture
The project is intentionally:
- Korea-specific,
- agent-guided,
- checkpoint-driven,
- review-oriented,
- and local-first where possible.

Changes that weaken those properties should be discussed before implementation.

### 3. Docs and contracts matter
This repo is not code-only.
Architecture docs, workflow docs, type contracts, and user trust boundaries are part of the product surface.

### 4. Human control at critical steps
Avoid designs that hide sensitive actions.
Consent, login, high-risk classification decisions, and submission gates should remain visible and reviewable.

## How to propose changes

### Small changes
For typo fixes, wording improvements, small refactors, and low-risk doc updates:
- open a PR directly.

### Larger changes
For new workflow behavior, new integration patterns, or meaningful scope changes:
- open an Issue first, or
- explain the rationale clearly in the PR.

Please describe:
- the problem,
- the proposed approach,
- tradeoffs,
- and any effect on user trust, consent, review burden, or auditability.

## Pull request expectations

A good PR should usually include:
- a clear summary,
- why the change is needed,
- linked issue(s) if relevant,
- doc updates when behavior or scope changes,
- and focused changes rather than unrelated cleanup.

If you add or change behavior, mention whether it affects:
- consent flow,
- collection flow,
- review queue behavior,
- draft generation,
- HomeTax assistance,
- or workspace state/audit history.

## Coding expectations

General expectations:
- keep changes readable and incremental,
- prefer explicit domain naming over clever abstractions,
- preserve traceability between source facts, decisions, and outputs,
- avoid introducing hidden automation across trust boundaries.

If implementation and docs diverge, either:
- update the docs in the same PR, or
- explicitly call out the mismatch and proposed follow-up.

## Reporting issues

Useful bug reports usually include:
- what you expected,
- what happened instead,
- steps to reproduce,
- relevant files or docs,
- and whether the issue is about product logic, architecture, UX flow, or implementation.

## License

By contributing to this repository, you agree that your contributions will be licensed under the repository's Apache-2.0 license.

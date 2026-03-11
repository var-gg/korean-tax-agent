# Documentation Language Policy

## Purpose
This repository is intended to become a public open-source project for **agent-native Korean comprehensive income tax workflow tooling**.

The domain is Korea-specific, but the implementation surface is also part of the broader:
- MCP ecosystem,
- agent tooling ecosystem,
- open-source developer ecosystem.

Because of that, documentation needs to serve **both**:
1. global technical readers and contributors,
2. Korean users, operators, and domain collaborators.

## Policy
### Canonical language
**English is the canonical language for technical source-of-truth documentation.**

This includes:
- architecture documents,
- data models,
- workflow contracts,
- state models,
- contributor-facing technical design notes,
- implementation roadmap and engineering RFCs.

If an English document and a translated document diverge, the **English version wins** until the translation is updated.

### Korean companion docs
Korean documentation should be added **selectively and intentionally**, not by translating everything at once.

Priority candidates for Korean companion docs:
- repository README / public introduction,
- product overview,
- user-facing workflow explanation,
- Korean tax-domain explanation,
- onboarding docs for local collaborators.

These Korean docs are meant to improve:
- accessibility for Korean readers,
- clarity of tax-domain context,
- public communication,
- onboarding for domain collaborators who are not deeply technical.

## What we are explicitly not doing
### Not switching the whole repo to Korean-first right now
We are still actively evolving:
- the state model,
- MCP contracts,
- collection strategy,
- implementation boundaries.

During this phase, making Korean the primary authoring language would create:
- more rewrite churn,
- more translation drift,
- weaker alignment with code identifiers and protocol terms,
- extra work when preparing for public OSS collaboration.

### Not doing a giant end-stage translation pass
A single late-stage translation push usually creates:
- inconsistent terminology,
- rushed quality,
- poor diff hygiene,
- translation debt that appears all at once.

Instead, Korean companion docs should be added gradually, starting from the highest-leverage public documents.

## Practical rules
### Naming and structure
Recommended pattern:
- English source-of-truth docs remain in `docs/`
- Korean companion docs can live in `docs/ko/` or use a clear `.ko.md` suffix

Example:
- `docs/00-overview.md`
- `docs/ko/00-overview.ko.md`

We do **not** need to mirror every file immediately.

### Translation posture
When writing a Korean companion doc:
- preserve technical identifiers in English when helpful,
- translate explanations, not protocol names blindly,
- keep core MCP / type / state terms stable,
- note clearly when a Korean doc is a companion rather than the canonical spec.

### Suggested stable terms to keep in English when useful
Examples:
- MCP
- workspace
- review queue
- state model
- sync attempt
- coverage gap
- browser assist
- consent checkpoint

These can be explained in Korean prose without renaming the core identifier everywhere.

## Immediate repo guidance
For now:
1. keep writing technical docs in English,
2. add a short language note to the root README and docs index,
3. maintain a Korean reading entry point in `docs/README.ko.md`,
4. selectively add Korean companion docs for public-facing entry points and high-leverage workflow/domain docs,
5. avoid repo-wide bilingual duplication unless a doc is clearly high-value.

## Initial Korean companion priorities
Recommended first Korean companion docs:
1. root `README`
2. `docs/00-overview.md`
3. `docs/16-v1-prd.md`
4. `docs/21-first-agentic-scenario.md`

## Maintainer note
The point of this policy is not "English for everything forever."
The point is:
- keep the technical core stable,
- keep open-source contribution easy,
- add Korean where it improves adoption and understanding,
- avoid translation debt explosions later.

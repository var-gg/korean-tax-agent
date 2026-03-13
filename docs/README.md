# Docs Index

**Languages:** [English](./README.md) | [한국어](./README.ko.md)

This directory contains the public product and engineering design documents for Korean Tax Agent.

## Positioning in one page

Korean Tax Agent is building:
- a **Korean comprehensive income tax workflow product**,
- with a **host-agnostic MCP core**,
- plus optional runtime-specific integration patterns and examples.

The repo is intentionally not limited to one agent host.
It should remain understandable and adoptable across multiple agent environments.

## Language and reading policy

Technical source-of-truth docs are authored in **English**.
Korean companion docs are added selectively for onboarding, product understanding, and Korea-specific explanation.
If there is ever a mismatch, the English document is the canonical version.

Reading-language rule:
- If you start in English, you should be able to keep reading in English.
- If you start in Korean, you should be able to keep reading in Korean when a Korean companion exists.
- When no Korean companion exists, the English original should be linked explicitly.

See also:
- [README.ko.md](./README.ko.md)
- [23-documentation-language-policy.md](./23-documentation-language-policy.md)
- [../README.ko.md](../README.ko.md)

## Recommended reading order

### English reading path
If you are new to the project and want to stay in English:
1. [00-overview.md](./00-overview.md)
2. [16-v1-prd.md](./16-v1-prd.md)
3. [17-data-collection-strategy.md](./17-data-collection-strategy.md)
4. [21-first-agentic-scenario.md](./21-first-agentic-scenario.md)
5. [25-korean-comprehensive-income-tax-data-research.md](./25-korean-comprehensive-income-tax-data-research.md)
6. [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)
7. [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)

### Korean reading path
If you want the Korean companion path instead, start here:
1. [README.ko.md](./README.ko.md)
2. [00-overview.ko.md](./00-overview.ko.md)
3. [16-v1-prd.ko.md](./16-v1-prd.ko.md)
4. [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md)
5. [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
6. [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md)
7. [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)
8. [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)

## Reading layers

The docs are meant to be readable in layers:
- first understand the product,
- then understand the agentic collection model,
- then understand the technical architecture and state model,
- then understand the implementation path.

### If you want the architecture
Read next:
1. [05-architecture.md](./05-architecture.md)
2. [06-data-model.md](./06-data-model.md)
3. [20-workspace-state-model.md](./20-workspace-state-model.md)
4. [24-workflow-state-machine.md](./24-workflow-state-machine.md)
5. [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
6. [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
7. [10-skill-design.md](./10-skill-design.md)

### If you want collection and trust boundaries
Read:
1. [17-data-collection-strategy.md](./17-data-collection-strategy.md)
2. [18-source-feasibility-matrix.md](./18-source-feasibility-matrix.md)
3. [19-agentic-auth-and-consent-flow.md](./19-agentic-auth-and-consent-flow.md)
4. [07-consent-model.md](./07-consent-model.md)
5. [08-hometax-submission-flow.md](./08-hometax-submission-flow.md)

### If you want review, risk, and governance context
Read:
1. [11-review-queue.md](./11-review-queue.md)
2. [04-risk-and-compliance.md](./04-risk-and-compliance.md)
3. [12-security-storage.md](./12-security-storage.md)
4. [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
5. [14-open-source-strategy.md](./14-open-source-strategy.md)

### If you want the implementation plan
Read:
1. [13-implementation-roadmap.md](./13-implementation-roadmap.md)
2. [15-backlog.md](./15-backlog.md)
3. [06-data-model.md](./06-data-model.md)

## Document map

### Product foundation
- [00-overview.md](./00-overview.md) — high-level product definition
- [01-product-principles.md](./01-product-principles.md) — guiding principles
- [02-user-journey.md](./02-user-journey.md) — user-facing workflow phases
- [03-scope-and-non-goals.md](./03-scope-and-non-goals.md) — scope boundaries
- [16-v1-prd.md](./16-v1-prd.md) — v1 product requirements and release standard

### Risk, trust, and review
- [04-risk-and-compliance.md](./04-risk-and-compliance.md) — core product risks and safeguards
- [07-consent-model.md](./07-consent-model.md) — durable consent and approval structure
- [11-review-queue.md](./11-review-queue.md) — how ambiguity is surfaced to the user
- [12-security-storage.md](./12-security-storage.md) — storage and security posture

### Architecture and workflow engine
- [05-architecture.md](./05-architecture.md) — top-level system components and flow
- [06-data-model.md](./06-data-model.md) — canonical entity model including collection lifecycle
- [09-mcp-tool-spec.md](./09-mcp-tool-spec.md) — MCP workflow tool contract
- [10-skill-design.md](./10-skill-design.md) — agent skill design expectations
- [20-workspace-state-model.md](./20-workspace-state-model.md) — persistent operational state model
- [24-workflow-state-machine.md](./24-workflow-state-machine.md) — compact workflow control reference across collection, review, and assist
- [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md) — current code-model gaps and implementation priorities

### Agentic collection and filing execution
- [08-hometax-submission-flow.md](./08-hometax-submission-flow.md) — assisted filing flow
- [17-data-collection-strategy.md](./17-data-collection-strategy.md) — collection modes and v1 posture
- [18-source-feasibility-matrix.md](./18-source-feasibility-matrix.md) — realistic source-by-source feasibility
- [19-agentic-auth-and-consent-flow.md](./19-agentic-auth-and-consent-flow.md) — user checkpoint interaction model
- [21-first-agentic-scenario.md](./21-first-agentic-scenario.md) — first narrow end-to-end scenario

### Delivery, domain research, and project management
- [13-implementation-roadmap.md](./13-implementation-roadmap.md) — phased implementation path
- [14-open-source-strategy.md](./14-open-source-strategy.md) — open-source packaging and trust posture
- [15-backlog.md](./15-backlog.md) — ongoing work list
- [23-documentation-language-policy.md](./23-documentation-language-policy.md) — canonical English + selective Korean companion policy
- [25-korean-comprehensive-income-tax-data-research.md](./25-korean-comprehensive-income-tax-data-research.md) — first-pass domain map for real filing inputs
- [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md) — code/model gaps revealed by the filing-input research
- [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md) — explicit V1 support boundaries, readiness levels, and stop conditions
- [28-three-party-happy-path.md](./28-three-party-happy-path.md) — user/agent/MCP happy-path conversation with stage-by-stage notification and design-gap analysis
- [29-source-strategy-for-real-tax-work.md](./29-source-strategy-for-real-tax-work.md) — what data really matters first in tax work, what counts as anchor vs enrichment, and how source planning should work
- [30-source-planning-conversation.md](./30-source-planning-conversation.md) — concrete user/agent/MCP source-planning dialogue patterns, including HomeTax-first, local-first, and export-first cases
- [31-source-collection-blocked-path.md](./31-source-collection-blocked-path.md) — realistic blocked-path handling for UI drift, export-required branches, provider blocks, and honest readiness downgrades
- [32-readiness-calibration-by-input-coverage.md](./32-readiness-calibration-by-input-coverage.md) — how estimate, draft, and submission-assist readiness should be calibrated from domain coverage rather than file volume
- [33-runtime-and-mcp-fields-for-readiness-and-coverage.md](./33-runtime-and-mcp-fields-for-readiness-and-coverage.md) — concrete runtime fields and MCP response shapes for readiness, coverage, blockers, and major unknowns
- [34-proposed-type-shapes-for-runtime-coverage-and-readiness.md](./34-proposed-type-shapes-for-runtime-coverage-and-readiness.md) — TypeScript-friendly proposed types for workspace readiness, coverage, blockers, gaps, draft calibration, and MCP readiness state
- [35-mapping-current-core-types-to-proposed-readiness-types.md](./35-mapping-current-core-types-to-proposed-readiness-types.md) — 1:1 migration map from current core types to the proposed readiness/coverage model with additive rollout guidance

## Korean companion docs
Current Korean companions:
- [README.ko.md](./README.ko.md)
- [../README.ko.md](../README.ko.md)
- [00-overview.ko.md](./00-overview.ko.md)
- [05-architecture.ko.md](./05-architecture.ko.md)
- [06-data-model.ko.md](./06-data-model.ko.md)
- [08-hometax-submission-flow.ko.md](./08-hometax-submission-flow.ko.md)
- [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md)
- [16-v1-prd.ko.md](./16-v1-prd.ko.md)
- [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md)
- [18-source-feasibility-matrix.ko.md](./18-source-feasibility-matrix.ko.md)
- [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md)
- [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md)
- [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md)
- [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md)
- [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md)
- [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md)
- [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)
- [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)

## Reading philosophy
If you only read one technical document, read [20-workspace-state-model.md](./20-workspace-state-model.md).
If you only read one product-flow document, read [21-first-agentic-scenario.md](./21-first-agentic-scenario.md).
If you only read one implementation contract document, read [09-mcp-tool-spec.md](./09-mcp-tool-spec.md).

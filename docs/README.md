# Docs Index

**Languages:** technical specs are canonical in English; Korean companion docs are added selectively. Korean reading entry: [README.ko.md](./README.ko.md).

This directory contains the public product and engineering design documents for Korean Tax Agent.

## Language note
Technical source-of-truth docs are authored in **English**.
Korean companion docs may be added selectively for public onboarding and tax-domain explanation.
If there is ever a mismatch, the English document is the canonical version.

See also:
- [23-documentation-language-policy.md](./23-documentation-language-policy.md)
- [../README.ko.md](../README.ko.md)

The docs are meant to be readable in layers:
- first understand the product,
- then understand the agentic collection model,
- then understand the technical architecture and state model,
- then understand the implementation path.

## Recommended reading order

### If you are new to the project
Start here:
1. [00-overview.md](./00-overview.md)
2. [16-v1-prd.md](./16-v1-prd.md)
3. [17-data-collection-strategy.md](./17-data-collection-strategy.md)
4. [21-first-agentic-scenario.md](./21-first-agentic-scenario.md)

These four documents explain:
- what the project is
- who it is for
- why the workflow is agentic rather than upload-first
- what the first realistic end-to-end scenario looks like

### If you want the architecture
Read next:
1. [05-architecture.md](./05-architecture.md)
2. [06-data-model.md](./06-data-model.md)
3. [20-workspace-state-model.md](./20-workspace-state-model.md)
4. [24-workflow-state-machine.md](./24-workflow-state-machine.md)
5. [22-core-type-gap-analysis.md](./22-core-type-gap-analysis.md)
6. [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
7. [10-skill-design.md](./10-skill-design.md)

These documents explain:
- the major components
- the canonical entities
- the persistent state backbone
- the workflow control vocabulary and transition model
- the current doc-to-code gaps
- the MCP surface
- the agent skill layer

### If you want to understand collection and trust boundaries
Read:
1. [17-data-collection-strategy.md](./17-data-collection-strategy.md)
2. [18-source-feasibility-matrix.md](./18-source-feasibility-matrix.md)
3. [19-agentic-auth-and-consent-flow.md](./19-agentic-auth-and-consent-flow.md)
4. [07-consent-model.md](./07-consent-model.md)
5. [08-hometax-submission-flow.md](./08-hometax-submission-flow.md)

These documents explain:
- how data collection should work in practice
- which source paths are realistic in v1
- how authentication and consent checkpoints should behave
- how HomeTax assistance stays visible and user-controlled

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

## Korean companion docs
Currently available:
- [README.ko.md](./README.ko.md) — Korean docs index and reading path
- [../README.ko.md](../README.ko.md) — Korean repository introduction
- [00-overview.ko.md](./00-overview.ko.md) — Korean companion for the product overview
- [08-hometax-submission-flow.ko.md](./08-hometax-submission-flow.ko.md) — Korean companion for the assisted filing flow
- [09-mcp-tool-spec.ko.md](./09-mcp-tool-spec.ko.md) — Korean companion for the MCP tool spec
- [16-v1-prd.ko.md](./16-v1-prd.ko.md) — Korean companion for the v1 PRD
- [17-data-collection-strategy.ko.md](./17-data-collection-strategy.ko.md) — Korean companion for the data collection strategy
- [18-source-feasibility-matrix.ko.md](./18-source-feasibility-matrix.ko.md) — Korean companion for the source feasibility matrix
- [19-agentic-auth-and-consent-flow.ko.md](./19-agentic-auth-and-consent-flow.ko.md) — Korean companion for the auth and consent flow
- [20-workspace-state-model.ko.md](./20-workspace-state-model.ko.md) — Korean companion for the workspace state model
- [21-first-agentic-scenario.ko.md](./21-first-agentic-scenario.ko.md) — Korean companion for the first agentic scenario
- [22-core-type-gap-analysis.ko.md](./22-core-type-gap-analysis.ko.md) — Korean companion for the core type gap analysis
- [24-workflow-state-machine.ko.md](./24-workflow-state-machine.ko.md) — Korean companion for the workflow state machine
- [25-korean-comprehensive-income-tax-data-research.ko.md](./25-korean-comprehensive-income-tax-data-research.ko.md) — Korean companion for filing-input research
- [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md) — Korean companion for the domain gap analysis
- [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md) — Korean companion for V1 support boundaries and stop conditions

## Reading philosophy
If you only read one technical document, read [20-workspace-state-model.md](./20-workspace-state-model.md).
If you only read one product-flow document, read [21-first-agentic-scenario.md](./21-first-agentic-scenario.md).
If you only read one implementation contract document, read [09-mcp-tool-spec.md](./09-mcp-tool-spec.md).

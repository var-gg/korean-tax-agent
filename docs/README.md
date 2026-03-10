# Docs Index

This directory contains the public product and engineering design documents for Korean Tax Agent.

The docs are meant to be readable in layers:
- first understand the product,
- then understand the agentic collection model,
- then understand the technical architecture and state model,
- then understand the implementation path.

## Recommended reading order

### If you are new to the project
Start here:
1. `00-overview.md`
2. `16-v1-prd.md`
3. `17-data-collection-strategy.md`
4. `21-first-agentic-scenario.md`

These four documents explain:
- what the project is
- who it is for
- why the workflow is agentic rather than upload-first
- what the first realistic end-to-end scenario looks like

### If you want the architecture
Read next:
1. `05-architecture.md`
2. `20-workspace-state-model.md`
3. `09-mcp-tool-spec.md`
4. `10-skill-design.md`

These documents explain:
- the major components
- the persistent state backbone
- the MCP surface
- the agent skill layer

### If you want to understand collection and trust boundaries
Read:
1. `17-data-collection-strategy.md`
2. `18-source-feasibility-matrix.md`
3. `19-agentic-auth-and-consent-flow.md`
4. `07-consent-model.md`
5. `08-hometax-submission-flow.md`

These documents explain:
- how data collection should work in practice
- which source paths are realistic in v1
- how authentication and consent checkpoints should behave
- how HomeTax assistance stays visible and user-controlled

### If you want review, risk, and governance context
Read:
1. `11-review-queue.md`
2. `04-risk-and-compliance.md`
3. `12-security-storage.md`
4. `14-open-source-strategy.md`

### If you want the implementation plan
Read:
1. `13-implementation-roadmap.md`
2. `15-backlog.md`
3. `06-data-model.md`

## Document map

### Product foundation
- `00-overview.md` — high-level product definition
- `01-product-principles.md` — guiding principles
- `02-user-journey.md` — user-facing workflow phases
- `03-scope-and-non-goals.md` — scope boundaries
- `16-v1-prd.md` — v1 product requirements and release standard

### Risk, trust, and review
- `04-risk-and-compliance.md` — core product risks and safeguards
- `07-consent-model.md` — durable consent and approval structure
- `11-review-queue.md` — how ambiguity is surfaced to the user
- `12-security-storage.md` — storage and security posture

### Architecture and workflow engine
- `05-architecture.md` — top-level system components and flow
- `06-data-model.md` — canonical domain modeling direction
- `09-mcp-tool-spec.md` — MCP workflow tool contract
- `10-skill-design.md` — agent skill design expectations
- `20-workspace-state-model.md` — persistent operational state model

### Agentic collection and filing execution
- `08-hometax-submission-flow.md` — assisted filing flow
- `17-data-collection-strategy.md` — collection modes and v1 posture
- `18-source-feasibility-matrix.md` — realistic source-by-source feasibility
- `19-agentic-auth-and-consent-flow.md` — user checkpoint interaction model
- `21-first-agentic-scenario.md` — first narrow end-to-end scenario

### Delivery and project management
- `13-implementation-roadmap.md` — phased implementation path
- `14-open-source-strategy.md` — open-source packaging and trust posture
- `15-backlog.md` — ongoing work list

## Reading philosophy
If you only read one technical document, read `20-workspace-state-model.md`.
If you only read one product-flow document, read `21-first-agentic-scenario.md`.
If you only read one implementation contract document, read `09-mcp-tool-spec.md`.

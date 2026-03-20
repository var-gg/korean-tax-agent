# Architecture

- Status: active
- Doc role: canonical
- Locale: en
- Korean companion: [05-architecture.ko.md](./05-architecture.ko.md)
- Parent: [README.md](./README.md)
- Related:
  - [06-data-model.md](./06-data-model.md)
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [21-first-agentic-scenario.md](./21-first-agentic-scenario.md)
- Next recommended reading:
  - [06-data-model.md](./06-data-model.md)
  - [20-workspace-state-model.md](./20-workspace-state-model.md)

## Top-level components

### 1. Core domain package
Responsibilities:
- canonical transaction/document schema
- normalization pipeline
- classification engine
- review queue generation
- filing draft assembly
- audit trail model

### 2. MCP server package
Responsibilities:
- expose agent-callable workflow tools
- validate agent-supplied inputs such as artifact refs, uploaded file refs, structured extracted payloads, and portal-observed values
- orchestrate workflow state, normalization, classification, review, and draft generation
- surface consent-required actions clearly

Must not become responsible for:
- directly opening local files
- directly controlling browser pages or tabs
- directly performing OCR/document extraction
- directly handling user-facing explanation, persuasion, or conversational UX

### 3. Browser assist package
Responsibilities:
- define HomeTax assist session semantics and checkpoint handoff contracts
- pause for authentication and user approval checkpoints
- avoid hidden submission behavior

Important boundary:
- package-level browser-assist contracts may describe session state and runtime handoff expectations
- concrete browser execution still belongs to the external AI agent and its host/runtime bridge, not to MCP business logic

### 4. OpenClaw skill
Responsibilities:
- tell the agent when and how to use the system
- enforce safety and consent rules
- guide setup and filing workflow sequencing

## Data flow
1. Source planning and source state
2. consent and auth checkpoints
3. source intake and sync attempts
4. normalization
5. coverage gap detection
6. classification
7. review queue
8. filing draft generation
9. browser-assisted filing/export

## Persistent state backbone
The architecture assumes an explicit workspace state model that preserves:
- taxpayer profile state
- source registry
- consent records
- auth checkpoints
- sync attempts
- imported artifacts
- normalized ledger entities
- coverage gaps
- review items
- draft versions
- browser assist sessions
- audit events

See:
- `docs/20-workspace-state-model.md`
- `docs/21-first-agentic-scenario.md`

## Repository structure rationale
- `docs/` stays public and repo-visible for trust and onboarding
- `packages/` isolates implementation concerns
- `skills/` keeps agent instructions explicit and portable
- `examples/` and `templates/` reduce setup ambiguity

## Responsibility boundary examples

### In scope for MCP
- record that a HomeTax comparison was supplied for a draft
- validate whether required comparison sections are still missing
- persist blockers, review items, readiness, and audit events
- accept uploaded-file references or extracted field payloads and normalize them into workflow state

### Out of scope for MCP
- read `C:\\Users\\...\\receipt.pdf` directly
- drive the browser to HomeTax, inspect the live page, or click buttons by itself
- run OCR on receipt images
- decide how to phrase a trust-building explanation to the user

### Split of responsibilities in practice
1. external AI agent collects/observes data
2. agent submits refs or structured observations to MCP
3. MCP updates workflow state, computes readiness, and returns the next checkpoint/blocker
4. agent explains the next step to the user and, if needed, uses its own host/browser/file/OCR capabilities

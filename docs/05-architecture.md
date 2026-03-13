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
- expose agent-callable tools
- validate tool inputs
- orchestrate data import, classification, review, and draft generation
- surface consent-required actions clearly

### 3. Browser assist package
Responsibilities:
- support HomeTax navigation and assisted input flows
- pause for authentication and user approval checkpoints
- avoid hidden submission behavior

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

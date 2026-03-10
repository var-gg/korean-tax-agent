# Architecture

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
1. Source intake
2. normalization
3. classification
4. review queue
5. filing draft generation
6. browser-assisted filing/export

## Repository structure rationale
- `docs/` stays public and repo-visible for trust and onboarding
- `packages/` isolates implementation concerns
- `skills/` keeps agent instructions explicit and portable
- `examples/` and `templates/` reduce setup ambiguity

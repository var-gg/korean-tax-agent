# Data Collection Strategy

## Objective
Design the system so the AI agent can collect as much filing-relevant data as possible through guided interaction, while asking the user to intervene only at meaningful checkpoints such as consent, authentication, ambiguity resolution, and final submission.

This document is about realistic collection posture, not idealized full automation.

## Operating principle
The preferred collection order is:
1. agent-led connector discovery
2. scoped consent
3. browser-mediated or provider-mediated authentication by the user
4. agent/runtime-driven extraction or observation outside MCP, followed by MCP normalization and reconciliation
5. targeted follow-up questions only for gaps or risk-changing ambiguities

The system should avoid starting from a manual-upload mindset.
Manual uploads remain a fallback, not the primary product identity.

## Collection modes

### 1. Direct connector mode
Use when a provider offers a stable, allowed, and practical integration path.

Typical shape:
- agent lists available connectors
- user approves source scope
- user authenticates
- agent syncs records and documents
- later refreshes run with the existing consent scope when allowed

Best use cases:
- stable operator-controlled connectors
- sources with durable session or token semantics
- repeat sync scenarios

Main risks:
- provider policy changes
- token/session expiration
- legal/commercial constraints around access patterns

### 2. Browser-assisted collection mode
Use when the source is accessible through normal user web flows, but not through a stable public API.

Typical shape:
- agent opens a visible browser path
- user completes login, identity confirmation, or one-time security step
- external AI agent/runtime resumes navigation and extracts or observes the needed data
- agent pauses again only when another real user checkpoint is required

Best use cases:
- HomeTax and similar portals
- regulated portals with human-first login flows
- download pages where data exists but API support is weak or absent

Main risks:
- UI drift
- anti-bot friction
- security keyboards, captchas, or unexpected interstitials
- brittle selectors or inconsistent document labels

### 3. Export-ingestion mode
Use when the best realistic path is to have the source itself produce a file or statement which the agent then ingests.

Typical shape:
- agent guides the user to the right export screen
- user triggers export or confirms a download
- external AI agent/runtime uploads or references the resulting artifact for MCP ingestion
- agent normalizes and links the imported artifact into the filing workspace

Best use cases:
- bank/card statements
- brokerage transaction exports
- tax portal bulk materials
- evidence bundles

Main risks:
- format drift
- inconsistent naming conventions
- missing metadata
- duplicate imports across repeated export cycles

### 4. Targeted fact capture mode
Use only when the data cannot be reliably collected or inferred from accessible records.

Typical shape:
- agent detects a missing fact that blocks classification or filing
- agent asks a focused question
- user answers once
- answer becomes structured workspace state, not just chat text

Best use cases:
- taxpayer profile details
- business-use ratio or mixed-use clarification
- unsupported tax treatments
- explanation of unusual transactions

Main risks:
- low reliability if overused
- user fatigue if the system asks broad or vague questions

## Source categories

### Tax authority portals
Examples:
- HomeTax
- related national tax workflows and downloadable materials

Preferred mode:
- browser-assisted collection first
- export-ingestion when bulk documents are available

Why:
- these systems are the most authoritative source for many filing-relevant materials
- they are also the most likely to require direct user authentication and visible control

### Financial institutions
Examples:
- banks
- card issuers
- brokerages
- payment services

Preferred mode:
- direct connector if truly stable and allowed
- otherwise export-ingestion or browser-assisted collection

Why:
- financial records matter for reconciliation and evidence
- many providers have strong anti-automation and inconsistent export quality

### Evidence/document sources
Examples:
- local folders
- synced drives
- email attachments
- messaging-delivered receipts

Preferred mode:
- uploaded-file or artifact-ref ingestion after the external AI agent/runtime selects the material
- targeted retrieval based on transaction gaps

Why:
- supporting evidence often exists outside formal tax systems
- the external AI agent/runtime should seek evidence only when needed, not indiscriminately scan everything without scope; MCP should only receive scoped refs/artifacts and derived structured data

### User-provided facts
Examples:
- taxpayer type
- household or deduction-relevant facts
- mixed-use explanations
- missing counterparty context

Preferred mode:
- targeted fact capture

Why:
- some filing decisions cannot be resolved from records alone

## Reality-based design rules

### Rule 1. Start from likely-accessible systems, not ideal APIs
For many Korean tax-adjacent systems, practical access may come from visible browser workflows and exported artifacts rather than clean public APIs.

### Rule 2. Authentication is a user action, extraction is an agent action
The product should train users to expect:
- the user logs in or completes a security challenge
- the agent does the repetitive navigation, extraction, linking, and reconciliation work around that checkpoint

### Rule 3. Fallbacks must be first-class
Every targeted source should have a documented fallback path.
A realistic product is not one that assumes all connectors succeed.
It is one that degrades gracefully when they do not.

### Rule 4. The system should gather progressively, not all at once
The agent should not require every source to be connected before providing value.
It should build a partial workspace, identify missing coverage, and continue improving the draft as additional sources are connected.

### Rule 5. Missing data is itself a structured state
If data cannot be collected, the system should record:
- what was attempted
- why it failed
- what filing area is affected
- what the best next action is

## Preferred product posture for v1
V1 should present itself as:
- agentic
- checkpoint-driven
- browser-capable
- consent-aware
- resilient to partial collection success
- able to distinguish supported paths from unsupported ones
- able to report whether a case is estimate-ready, draft-ready, or submission-assist-ready

V1 should not present itself as:
- fully silent automation
- universal live integration across all institutions
- guaranteed API-based coverage of all filing sources
- submission-ready merely because some sources were collected

## Recommended v1 source strategy

### Tier 1. Must design for
- HomeTax browser-assisted access and document gathering
- filing workspace fact intake
- local and operator-approved evidence/document ingestion
- repeatable ingestion of exported statements and tax materials

### Tier 2. Should design interfaces for, even if partially implemented
- bank/card/brokerage connector abstraction
- source sync lifecycle and re-auth semantics
- provider capability discovery

### Tier 3. Later expansion
- broad institution coverage
- provider-specific optimizations
- recurring refreshes across many institutions
- richer automatic evidence retrieval from communication tools or cloud storage

## Workspace implications
The filing workspace should track collection state, not just raw files.

Minimum state areas:
- source registry
- consent records
- auth checkpoints
- sync attempts
- imported artifacts
- normalized transactions/documents
- unresolved coverage gaps
- review items
- draft versions
- audit events

## User experience target
A good run should feel like this:
- the agent explains what data it wants and why
- the user approves scope and logs in when needed
- the agent keeps going without constant prompting
- when blocked, the agent asks only sharp, high-value questions
- the draft becomes more complete over time as new sources are connected

## Product test
If the workflow still mostly feels like "please upload more files," the product is not yet agentic enough.
If the workflow feels like "the AI agent leads material preparation, and I only step in for login, consent, and judgment," the design is on track.

## MCP boundary for collection

In this repo, MCP is the workflow/state layer for collection progress, not the collector of raw host resources.
That means:
- MCP can track source state, sync attempts, blockers, coverage gaps, and imported artifact records
- MCP should not directly read local folders, drive a browser, or run OCR
- external agents may do those things, then submit artifact refs, uploaded file refs, extracted fields, or portal-observed values back to MCP

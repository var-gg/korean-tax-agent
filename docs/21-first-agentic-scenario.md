# First Agentic Scenario

## Objective
Describe the first end-to-end scenario the project should optimize for.

This scenario should stay inside the intended V1 support boundary.
It is not meant to prove that every filing path is supportable.
See also: [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md).

This is not the broadest possible workflow.
It is the narrowest realistic path that proves the product feels genuinely agentic:
- the user talks to the agent,
- the user clears trust and identity checkpoints,
- the agent performs the repetitive collection and structuring work,
- the system produces a draft with a manageable review queue.

## Scenario definition
Target user:
- an AI-capable Korean comprehensive income tax filer
- has HomeTax access
- can access at least some exported financial statements or locally stored evidence
- is willing to answer targeted follow-up questions

Target outcome:
- a filing workspace is created
- HomeTax materials are collected or partially collected
- additional exported evidence is ingested if needed
- ambiguous items are surfaced through a review queue
- a first draft summary is produced
- the workflow reaches a HomeTax-assist-ready state or a clearly blocked state with explicit next steps

Support-boundary assumption:
- this first scenario should represent a Tier A or near-Tier-A path,
- not a bookkeeping-heavy or otherwise clearly out-of-scope case.

## Narrative flow

### Step 1. User starts the filing workflow
The user says they want to prepare a filing for a given year.

The agent:
- creates or selects the workspace
- asks only essential profile questions
- explains that it will try to gather data progressively

Expected effect:
- workspace moves to `initialized` then `collecting_sources`
- initial taxpayer facts are recorded
- no source-specific checkpoint is active yet

### Step 2. Agent plans the first collection path
The agent identifies the next best sources.
In the first scenario, HomeTax should usually be first.

The agent says, in effect:
- I want to connect HomeTax first because it is the highest-value source for filing materials and cross-checks

Expected effect:
- source planning output is recorded
- HomeTax source enters `planned` or `awaiting_consent`

### Step 3. User grants scoped consent
The agent requests a clear source scope.

Example:
- allow access to HomeTax materials for your 2025 filing workspace

Expected effect:
- consent record written
- source becomes ready for auth
- active checkpoint becomes `source_consent`, then clears once approved

### Step 4. User completes authentication
The system opens the HomeTax path.
The user logs in and completes any required security steps.

The agent does not overtalk here.
It simply explains what the user needs to do and what will happen next.

Expected effect:
- auth checkpoint recorded
- active checkpoint becomes `authentication`, then clears on completion
- source moves to `ready` or sync starts immediately

### Step 5. Agent performs collection
After login, the agent resumes.
It navigates, extracts visible filing-relevant information, and ingests any downloadable materials it can collect.

Possible outcomes:
- full success
- partial success with some blocked screens
- export-required checkpoint
- provider/UI blockage

Expected effect:
- sync attempt records progress and outcome
- artifacts are created
- if interrupted, the sync attempt records `checkpointType`, `blockingReason`, and `pendingUserAction`
- blocked paths become structured fallback suggestions rather than vague failure

### Step 6. Agent normalizes and assesses coverage
The agent converts raw artifacts into normalized transactions, documents, and evidence links.
It also checks what is still missing.

Examples of missing areas:
- expense evidence not found for notable costs
- bank or card history needed for reconciliation
- taxpayer fact still missing for a deduction decision

Expected effect:
- normalized ledger updated
- coverage gaps created where needed
- next collection recommendation becomes available

### Step 7. Agent expands collection only where it matters
If important coverage gaps remain, the agent proposes the next best action.

Examples:
- please let me ingest the folder where your downloaded statements live
- I need one exported card statement to reconcile these expenses
- I need you to answer one question about whether this expense was mixed personal/business use

The agent should prefer targeted follow-up over broad requests like "upload everything."

Expected effect:
- second-wave collection or fact capture occurs only for high-value gaps

### Step 8. Agent runs classification and generates review queue
The system classifies normalized data and generates a compact review queue.

The user should see only the items that matter, such as:
- low-confidence classifications
- missing evidence for meaningful expenses
- source conflicts or duplicates
- high-risk tax judgment calls

Expected effect:
- review items created
- review batches created where safe

### Step 9. User resolves targeted questions
The agent asks fewer, sharper questions.
The user answers only the items that materially change confidence or tax risk.

Expected effect:
- review items resolved
- approved overrides become durable decisions
- a new draft can be computed

### Step 10. Agent computes the first draft
The system produces a draft summary with assumptions, warnings, unresolved blockers, and an explicit readiness level.

The agent explains:
- what was collected
- what remains uncertain
- whether the result is estimate-ready, draft-ready, or submission-assist-ready
- whether the draft is actually ready for HomeTax assistance

Expected effect:
- draft version created
- readiness level recorded
- workspace moves to `draft_ready_for_review` or remains blocked with clear reasons

### Step 11. Agent prepares HomeTax assist or stops honestly
If the draft is submission-assist-ready and the case is still inside the supported V1 path boundary, the workflow can move to HomeTax assist preparation.
If not, the system should stop with explicit next actions.

Acceptable outcomes for the first scenario:
- ready for HomeTax assist
- blocked on one last source or review decision
- partial draft produced with visible limitations
- downgraded to draft-ready only, with explicit explanation of why submission assist cannot yet start

## Success standard for this scenario
The first scenario succeeds if the user feels:
- I did not have to manually orchestrate the workflow
- I only stepped in for consent, login, and real judgment calls
- the agent kept making progress between checkpoints
- the remaining gaps are clearly explained

## Failure standard
The scenario should be considered a product failure if it feels like:
- a glorified upload wizard
- repeated vague questioning
- hidden or confusing blocked states
- the user cannot tell what data was collected and what was not

## Why this scenario matters
This scenario is the product truth test.
If it works, the project has a real agentic core.
If it does not, adding more connectors or more automation later will only create a more complicated non-agentic workflow.

# Agentic Auth and Consent Flow

## Objective
Define how the agent should interact with the user during source connection, authentication, data collection, and sensitive workflow transitions.

The desired experience is:
- the agent keeps the workflow moving,
- the user intervenes only at real trust, identity, or judgment checkpoints,
- the system never hides a risk-changing action.

## Core interaction model
The workflow should feel like:
1. the agent explains the next useful source or action
2. the agent asks for scoped approval
3. the user performs login or a required confirmation
4. the agent resumes collection automatically
5. the agent asks follow-up questions only when blocked or when risk meaningfully changes

## Key principle
Authentication is a checkpoint.
Consent is a decision.
They often happen near each other, but they are not the same thing.

## Interaction stages

### Stage 1. Plan the next collection step
Before opening a connector or browser flow, the agent should explain:
- what source it wants to access
- why it is useful
- what data categories are expected
- whether the user will need to log in or confirm anything

The explanation should be short and operational, not legalistic.

### Stage 2. Obtain scoped source access consent
The agent should request source access consent in language the user can understand.

Good example:
- allow access to HomeTax materials for the 2025 filing workflow

Bad example:
- allow all future financial actions across all sources

If the source scope expands materially later, the agent should ask again.

### Stage 3. Start authentication checkpoint
When authentication is needed, the system should:
- open the relevant flow visibly
- tell the user exactly what to do next
- stop pretending work can continue until the checkpoint is completed

Examples:
- log in to HomeTax and tell me when you are on the materials page
- complete the bank login and approval prompt, then I will continue fetching statements

### Stage 4. Resume agent work automatically
After authentication completes, the agent should resume collection without asking for low-value confirmation steps.

Examples of work that should happen automatically after login:
- navigation to the relevant screen
- download or extraction of approved materials
- ingestion into the filing workspace
- normalization and duplicate detection
- coverage analysis

### Stage 5. Ask targeted follow-up questions only when needed
The agent should interrupt only for:
- a new sensitive source
- a new authentication event
- a blocked browser step
- a high-impact review decision
- missing facts that cannot be inferred from collected data
- final submission approval

## Prompt quality standard
A good prompt should answer three questions:
- what am I asking you to do
- why is it needed
- what happens after you do it

Example:
- Please log in to HomeTax in the browser window. Once you are signed in, I will pull the available filing materials and organize them into the 2025 workspace.

## Anti-patterns to avoid
- asking the user to upload everything first before trying collection
- asking for repeated approval inside the same unchanged source scope
- treating login completion as permission for later final submission
- asking vague questions like "anything else I should know?"
- hiding failed collection attempts instead of turning them into structured next steps

## Checkpoint taxonomy

### Checkpoint A. Source consent
Needed when:
- connecting a new sensitive source
- expanding an existing source scope

Expected user action:
- approve or deny the requested scope

### Checkpoint B. Authentication
Needed when:
- the user must directly log in
- a provider requires step-up verification
- an authenticated session expired

Expected user action:
- complete login or verification

### Checkpoint C. Collection blocker
Needed when:
- the browser path changed
- a download requires a user click
- a captcha or unautomatable step appears

Expected user action:
- perform a narrow action and return control

### Checkpoint D. Review judgment
Needed when:
- a tax treatment is ambiguous and material
- evidence is missing for an important deduction or expense
- source conflicts cannot be reconciled automatically

Expected user action:
- choose an option or provide a fact

### Checkpoint E. Final submission
Needed when:
- the filing draft is ready and the system is about to submit or export externally

Expected user action:
- explicit approval

## Resume semantics
The system should support pause and resume naturally.
A resumed session should preserve:
- source context
- current checkpoint
- already granted consent scope
- current auth state if still valid
- pending user action
- partial collection results

The agent should be able to say:
- we already collected HomeTax materials and bank exports; next I need you to log in to the card portal so I can fetch expense history

## Failure handling posture
When a collection path fails, the agent should not collapse into generic failure.
It should classify the failure and propose the best next move.

Preferred failure classes:
- `missing_consent`
- `missing_auth`
- `ui_changed`
- `blocked_by_provider`
- `export_required`
- `insufficient_metadata`
- `unsupported_source`

These failure classes should map cleanly into workspace state via:
- `blockingReason`
- `pendingUserAction`
- `checkpointType` when the workflow is waiting on the user

For each failure, the system should record:
- what it tried
- what failed
- what user action or fallback is recommended

## Experience benchmark
A strong run should feel like the user is working with an operator who says:
- I know what to fetch next
- I only need you for trust and identity checkpoints
- I will keep going once you clear that gate
- I will not make hidden tax decisions for you

## Relationship to MCP design
The MCP surface should expose tools that map cleanly to this interaction model.
That implies explicit support for:
- source planning and discovery
- consent-required responses
- auth-required responses
- progress and pause/resume handling
- collection attempt summaries
- fallback recommendation fields

# User Journey

## Phase 1. Repository setup
- User checks out the repo.
- User runs bootstrap/setup.
- Agent verifies environment and available integrations.

## Phase 2. Initial consent and source connection
- Agent explains which sources can be connected.
- User grants consent for selected sources.
- User completes required login/authentication.

## Phase 3. Data intake
- Agent attempts the highest-value collection path first.
- User intervenes mainly for login, download confirmation, or narrow follow-up facts.
- Manual upload remains a fallback where direct collection or export-assisted collection is unavailable.
- System normalizes all intake into a common ledger model.

## Phase 4. Classification and review queue generation
- System classifies revenue, expense, withholding, and deduction candidates.
- Low-confidence or high-impact items enter a review queue.
- Agent asks only targeted follow-up questions.

## Phase 5. Draft generation
- System computes a filing draft and supporting summaries.
- Agent presents risks, missing evidence, and notable assumptions.

## Phase 6. Submission assistance
- User authenticates into HomeTax when required.
- Browser-assist flow helps navigate and populate filing inputs.
- User reviews final values.

## Phase 7. Final approval
- Agent presents a final summary.
- User explicitly approves final submission or stops before submit.

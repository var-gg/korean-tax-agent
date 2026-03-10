# Review Queue

## Why it exists
The review queue is how the system minimizes user interruption without hiding important tax judgment calls.

## Items that should enter review
- low-confidence classification
- high-amount transactions with weak evidence
- mixed personal/business expenses
- source conflicts or duplicates
- unsupported tax treatments for automated handling
- collection gaps that materially affect filing completeness
- failed or partial source retrieval where a user decision is needed

## UX goal
Ask fewer, sharper questions.

## Batch strategy
Where safe, group similar items into one review batch so the user can approve or reject patterns rather than answer repetitive prompts one by one.

## Output expectation
Every review item should include:
- reason
- suggested classification
- confidence
- evidence summary
- user action required

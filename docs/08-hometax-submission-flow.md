# HomeTax Submission Flow

## Objective
Support assisted HomeTax filing while preserving visible user control.

## Proposed flow
1. User starts filing workflow.
2. Agent confirms draft readiness and unresolved review items.
3. Browser assist opens HomeTax flow.
4. User completes required authentication.
5. Agent navigates filing sections and populates prepared values where supported.
6. Agent highlights mismatches or blocked fields.
7. User reviews final summary.
8. User explicitly approves final submission.

## Constraints
- HomeTax UI and auth flows may change frequently.
- Some fields may require manual confirmation or manual entry.
- The browser flow must support pause/resume and partial completion.

## v1 policy
Do not assume silent final submission. Keep final confirmation visible and user-controlled.

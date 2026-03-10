# Consent Model

## Design goal
Keep consent checkpoints minimal while ensuring the user understands and approves sensitive actions.

## Consent classes

### C1. Source access consent
Examples:
- import bank or card records
- read uploaded tax files
- connect email/drive sources

Expected pattern:
- one-time per source or integration
- renewable if scope changes

### C2. Authentication step consent
Examples:
- HomeTax login
- bank/card provider login
- certificate or simple-auth flow

Expected pattern:
- user performs direct authentication
- agent pauses and resumes around the event

### C3. Review override consent
Examples:
- mixed-use expense accepted as business expense
- uncertain revenue classification resolved manually
- missing evidence accepted with user note

Expected pattern:
- per ambiguous/high-impact item or grouped review batch

### C4. Final submission consent
Examples:
- final HomeTax submission
- export of completed filing package

Expected pattern:
- explicit per filing attempt
- not implied by prior source-access consent

## Rule
Reduce the number of prompts, but never hide a prompt that materially changes taxpayer risk.

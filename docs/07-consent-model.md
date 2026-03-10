# Consent Model

## Design goal
Keep consent checkpoints minimal while ensuring the user understands and approves sensitive actions.

The system should optimize for:
- fewer interruptions,
- broader but understandable consent scopes,
- explicit stops when taxpayer risk materially changes,
- durable recording of what was approved, by whom, and when.

## Consent principles

1. **Consent should be specific enough to be meaningful**
   - "connect HomeTax materials" is meaningful.
   - "allow all future actions" is not.

2. **Authentication is not the same as consent**
   - A user logging in does not automatically authorize classification overrides or final submission.

3. **Consent should be reusable within a clear scope**
   - Repeated prompts for the same low-risk action should be avoided if scope has not changed.

4. **Risk-changing actions require fresh visibility**
   - Final submission and high-risk overrides should never be hidden behind earlier approvals.

5. **All consent events should be auditable**
   - The system should record the action, scope, actor, timestamp, and relevant filing context.

## Consent classes

### C1. Source access consent
Examples:
- import bank or card records
- read uploaded tax files
- connect email/drive sources
- import HomeTax-exported materials

Expected pattern:
- one-time per source or integration
- renewable if requested scope changes
- revocable by the user

Minimum metadata:
- consentId
- sourceType
- scopeGranted
- grantedAt
- expiresAt (optional)
- revokedAt (optional)

### C2. Authentication step consent
Examples:
- HomeTax login
- bank/card provider login
- certificate or simple-auth flow

Expected pattern:
- user performs direct authentication
- agent pauses and resumes around the event
- auth completion should be treated as session state, not durable blanket consent

Minimum metadata:
- authEventId
- provider
- authMethod
- startedAt
- completedAt
- sessionBinding

### C3. Review override consent
Examples:
- mixed-use expense accepted as business expense
- uncertain revenue classification resolved manually
- missing evidence accepted with user note
- duplicate-looking items kept as separate transactions

Expected pattern:
- per ambiguous/high-impact item or grouped review batch
- includes visible explanation of suggested choice and downside risk
- attributed to a human actor or approved automation policy

Minimum metadata:
- reviewResolutionId
- reviewItemIds[]
- selectedResolution
- rationale
- approvedBy
- approvedAt

### C4. Final submission consent
Examples:
- final HomeTax submission
- export of completed filing package to an external destination

Expected pattern:
- explicit per filing attempt
- not implied by prior source-access consent
- requires current draft summary, unresolved warning summary, and visible approval step

Minimum metadata:
- submissionConsentId
- filingYear
- draftVersion
- warningCount
- approvedBy
- approvedAt

## Consent scopes

### Durable scope
May remain valid across sessions unless revoked or materially changed:
- source connection approval
- local document access approval
- recurring import permission within unchanged source scope

### Session scope
Should usually be limited to the active run/session:
- authenticated session state
- browser-assist continuation authority
- in-progress review batching context

### One-shot scope
Must be re-approved each time:
- final submission
- external export to a new target
- materially different filing posture after major draft changes

## When the system must stop and ask
The agent must stop for explicit user approval when:
- connecting a new sensitive source
- requested source scope broadens materially
- authentication requires direct user interaction
- classification confidence is low and tax impact is material
- a review override changes liability/risk meaningfully
- draft warnings remain high severity
- final submission is about to occur

## When the system may continue without a new prompt
The agent may continue under prior consent when:
- syncing an already approved source within the same granted scope
- re-running normalization/classification after non-material internal changes
- generating updated summaries from already imported data
- resuming a paused workflow where no new sensitive action is introduced

## Consent record envelope
Suggested normalized structure:

```json
{
  "consentId": "consent_123",
  "consentType": "source_access | auth_step | review_override | final_submission",
  "scope": {
    "sourceType": "hometax",
    "actions": ["read_documents"],
    "filingYear": 2025
  },
  "status": "granted | revoked | expired | superseded",
  "grantedBy": "user",
  "grantedAt": "2026-03-10T07:00:00Z",
  "note": "Initial HomeTax import approval"
}
```

## Rule
Reduce the number of prompts, but never hide a prompt that materially changes taxpayer risk.

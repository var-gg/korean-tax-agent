# HomeTax Submission Flow

- Status: active
- Canonical: English
- Korean companion: [08-hometax-submission-flow.ko.md](./08-hometax-submission-flow.ko.md)
- Parent: [README.md](./README.md)
- Related:
  - [19-agentic-auth-and-consent-flow.md](./19-agentic-auth-and-consent-flow.md)
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
- Next recommended reading:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [21-first-agentic-scenario.md](./21-first-agentic-scenario.md)


## Objective
Support assisted HomeTax filing while preserving visible user control and improving supported-path completion from material preparation through submission.

The browser-assist layer should help the user move faster, but should never make the filing feel invisible or uncontrolled.

## Operating posture
- assisted, not silent
- checkpoint-driven, not fire-and-forget
- pause/resume friendly
- explicit final approval before submit

## Entry conditions and support boundary
HomeTax assist should only start for cases that are inside the currently supported V1 path boundary.
If the filing path is unsupported, materially under-collected, or still blocked on high-severity review, the workflow should stop before browser assist begins.

The system should distinguish at least:
- `estimate_ready` (`estimate-ready`)
- `draft_ready` (`draft-ready`)
- `submission_assist_ready` (`submission-assist-ready`)

Only `submission_assist_ready` / `submission-assist-ready` cases should proceed into active HomeTax assistance.
See also: [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md).

## Proposed end-to-end flow

### Phase 1. Readiness check
1. User starts filing workflow.
2. Agent confirms draft readiness level.
3. Agent confirms unresolved review item status.
4. Agent confirms material source coverage and withholding coverage.
5. System blocks progression if critical review items remain open.
6. System blocks progression if the case is outside supported V1 paths or not yet submission-assist-ready.

Expected outputs:
- draft version
- readiness level
- warning summary
- unresolved blocker summary
- HomeTax-assist readiness flag
- comparison readiness / freshness note

### Phase 2. Session start
1. Browser assist opens HomeTax flow.
2. System creates an assist session id.
3. Agent explains the next expected checkpoint.

Expected outputs:
- assist session id
- current target screen/section
- auth required flag

### Phase 3. Authentication checkpoint
1. User completes required HomeTax authentication.
2. Agent waits without fabricating auth success.
3. System resumes only after detecting or being told that authentication completed.

Rules:
- user must directly perform the login/auth step
- auth should be modeled as a blocking checkpoint
- authentication success does not imply final submission approval

### Phase 4. Section navigation and field mapping
1. The external AI agent navigates filing sections.
2. MCP provides the workflow state, section plan, and field mapping.
3. `prepare_hometax`, `start_hometax_assist`, `resume_hometax_assist`, and `get_checkpoint` should reuse the same section/field plan.
4. Unsupported, ambiguous, or blocked fields are surfaced clearly.

Checkpoint payloads should expose operational contract fields such as:
- `screenKey`
- `checkpointKey`
- `sectionKey`
- `entryMode`
- `allowedNextActions`
- `requiredEvidenceRefs`
- `mismatchBatchId`
- `lastConfirmedDraftId`
- `lastConfirmedDraftVersion`
- `staleAfterRefresh`
- `retryPolicy`
- `resumePreconditions`

Possible field states:
- `auto_fill_ready`
- `manual_confirmation_required`
- `manual_entry_required`
- `blocked`
- `mismatch_detected`

### Phase 5. Assisted population
1. Agent populates supported fields where safe.
2. Agent pauses when manual confirmation is needed.
3. Agent logs mismatches between draft values and visible HomeTax fields.

Important rule:
- never silently override a visible mismatch without surfacing it to the user

### Phase 6. Pre-submit review
1. Agent presents a final summary before submit.
2. Summary should include:
   - filing year
   - major income/expense/deduction totals
   - unresolved non-blocking warnings
   - fields that required manual handling
   - any section that could not be verified automatically

### Phase 7. Final approval gate
1. User explicitly approves final submission.
2. System records submission consent.
3. Only then may the assist flow trigger the final submit step.

### Phase 8. Submission result handling
1. System records whether submission succeeded, failed, or is uncertain.
2. Agent summarizes the result and next steps.
3. If the outcome is ambiguous, the system should prefer "unknown/pending verification" over false success.
4. Completion should include post-submit evidence such as receipt capture, next-step confirmation, and any still-required follow-up actions.

## Pause/resume model
The browser flow must support interruption at any of these checkpoints:
- before auth
- after auth
- before entering a new filing section
- on mismatch detection
- before final submission

Suggested session fields:
- assistSessionId
- workspaceId
- draftId
- checkpoint
- lastKnownSection
- authState
- pendingUserAction
- startedAt
- updatedAt

## Failure modes to handle explicitly
- HomeTax UI changed and selector mapping failed
- authentication expired mid-flow
- draft version changed during assist session
- field values differ from expected mapping
- required supporting material is missing
- browser session closed unexpectedly

Boundary reminder:
- selector / DOM / OCR responsibility is still outside MCP
- MCP should expose workflow truth and checkpoint contract, not browser implementation detail

## Stop conditions inside HomeTax assist
The assist flow should pause or stop when:
- the filing path is later found to be unsupported or downgraded,
- material source coverage is still missing,
- high-severity review remains unresolved,
- required sections cannot be mapped,
- visible HomeTax values materially mismatch the draft,
- official data freshness is questionable and refresh/recompute is required,
- required supporting material is unavailable,
- or explicit user approval is missing.

## v1 policy
Do not assume silent final submission. Keep final confirmation visible and user-controlled.
Do not enter browser assist for cases that are only estimate-ready or draft-ready.

# Agent / Operator Quickstart

- Status: active
- Canonical: English
- Parent: [README.md](../README.md)
- Related:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
  - [38-mcp-agent-boundary-and-contract-gaps.md](./38-mcp-agent-boundary-and-contract-gaps.md)

## Purpose
This is the **minimum-context quickstart for a smart AI agent or operator**.
Read this first if you need to use the repo without absorbing every historical document.

## Product in one paragraph
This repo provides a host-agnostic MCP workflow layer for Korean comprehensive income tax.
It supports:
- setup
- source planning / imports
- normalization
- taxpayer facts
- review / resolution
- draft computation
- HomeTax comparison
- HomeTax preparation / assist handoff
- final approval / submission result capture
- read-only export package generation

## Supported path posture
Use the support-tier language consistently:
- **Tier A**: supported path, proceed when stop reasons are clear
- **Tier B**: downgraded assist, proceed cautiously with stronger review/operator attention
- **Tier C**: stop, human-led handling required

Do not over-claim support when stopReasonCodes or unsupported adjustments say otherwise.

## User intervention policy
The user should only be interrupted for:
- **login**
- **consent**
- **judgment**

Examples:
- login/authentication checkpoint
- source consent or scope approval
- review resolution or mismatch judgment
- final approval before submit

The external AI agent should not ask the user to perform hidden MCP bookkeeping.
If MCP already returns the next step, use it.

No-prep orchestration success bar:
- first wave should center on HomeTax authoritative materials
- user questions should stay limited and targeted
- conditional documents should be requested only when the collection truth actually narrows to them
- wrong first artifacts (for example XLS-only withholding lists) should recover toward official PDF/print fallback rather than repeating the same bad tactic
- summary-only bundles should trigger itemized-detail follow-up instead of being treated as sufficient business-expense evidence
- password-gated secure-mail HTML should be treated as an attachment/password checkpoint, not as importable evidence itself
- the no-prep full-close suite should prove the workflow can continue through compare / assist / approval / result / export, not only stop at `prepare_hometax`

## Core tool sequence
Canonical high-level sequence:
1. `tax.setup.inspect_environment`
2. `tax.setup.init_config`
3. `tax.sources.plan_collection`
4. `tax.sources.connect` / `tax.import.*`
5. `tax.ledger.normalize`
6. `tax.profile.detect_filing_path`
7. `tax.profile.upsert_facts` / `tax.profile.list_missing_facts`
8. `tax.classify.run`
9. `tax.classify.list_review_items`
10. `tax.classify.resolve_review_item`
11. `tax.filing.compute_draft`
12. `tax.filing.refresh_official_data`
13. `tax.filing.compare_with_hometax`
14. `tax.filing.prepare_hometax`
15. `tax.browser.start_hometax_assist`  
   - only valid when `prepare_hometax` is ok and submission readiness is `submission_assist_ready`
16. `tax.browser.resume_hometax_assist`
17. `tax.filing.record_submission_approval`
18. external browser agent performs final click
19. `tax.browser.record_submission_result`
20. `tax.filing.export_package`

Submission lifecycle policy:
- `tax.browser.record_submission_result` is the lifecycle-closing step.
- When success / fail / unknown is recorded, the HomeTax assist session is auto-closed.
- After `tax.filing.record_submission_approval` and before result recording, read models may surface `awaiting_external_submit_click` / `externalSubmitRequired=true`.
- Final workspace state should converge to `submitted`, `submission_failed`, or `submission_uncertain` before export.
- The full-close acceptance suite should prove the path can stay coherent from collection through compare / assist / approval / result / export, not just stop at `comparison_incomplete`.

## Important read models
If you only remember two read surfaces, remember these:
- `tax.workspace.get_status`
- `tax.filing.get_summary`

They are the preferred surfaces for:
- stop/go branching
- operator narration
- current blocker explanation
- next-step routing

Read-model contract:
- `stopReasonCodes` = active blockers that currently stop or hard-downgrade progression
- `warningCodes` = non-blocking downgrade/warning signals
- `runtimeSnapshot.blockerCodes` should agree with active blocker truth
- legacy fields like `blockers` should not contradict `stopReasonCodes`
- collection read surfaces (`plan_collection`, `get_collection_status`, `list_coverage_gaps`) should expose executable `collectionTasks[]`, not vague "send more files" requests
- collection task guidance should be interpreted through the canonical source-method registry (preferred/fallback/known-invalid methods plus re-verify timing)
- filing-path/draft surfaces should expose posture-aware regime and allocation signals such as `bookkeepingMode`, `taxpayerPosture`, `specialCreditEligibility`, `businessExpenseAllocationCandidates`, `opportunityCandidates`, and machine-readable/operator-readable warnings
- when a browser/export tactic fails or yields an insufficient artifact, record it with `tax.sources.record_collection_observation` so MCP can steer to a better fallback next time

## Important stop reasons
Treat these as active hard blockers, not suggestions:
- `missing_consent`
- `missing_auth`
- `awaiting_review_decision`
- `awaiting_final_approval`
- `comparison_incomplete`
- `unsupported_filing_path`
- `official_data_refresh_required`
- `missing_withholding_record`
- `missing_deduction_fact`
- `conflicting_withholding_record`
- `unresolved_duplicate`
- `severe_mismatch`
- `unsupported_adjustment`
- `tier_c_stop`

If these appear, do not pretend the workflow is ready.

## External agent boundary
MCP owns:
- workflow state
- decisions
- blockers
- review queues
- draft/readiness/comparison/preparation state
- submission approval/result records
- export artifacts
- HomeTax checkpoint contract fields such as screenKey / checkpointKey / entryMode / allowedNextActions / retryPolicy / resumePreconditions

External AI agent owns:
- browser
- local files
- OCR/extraction before MCP input
- user-facing explanation
- the actual final submit click
- selector / DOM / OCR implementation details during browser execution

## Minimal operating rules
- prefer `nextRecommendedAction` over agent guesswork
- prefer structured fields over prose reconstruction
- for HomeTax assist, prefer `screenKey`, `checkpointKey`, `entryMode`, `allowedNextActions`, `requiredEvidenceRefs`, `retryPolicy`, and `resumePreconditions` over agent inference
- stop when MCP says login/consent/judgment is required
- do not auto-resume when draft version changed or checkpoint says staleAfterRefresh
- do not invent support for unsupported adjustments or Tier C paths
- do not claim successful submission on ambiguous portal results
- if confidenceBand is low or stopReasonCodes include duplicate / withholding / mismatch blockers, downgrade or stop instead of pushing through
- disclose drafting assumptions explicitly to the operator before filing steps
- use `tax.filing.export_package` for human review / audit / handoff, not external sending

## Fastest mental model
Think of the repo like this:
- MCP = workflow truth
- external AI agent = browser/file/OCR/operator bridge
- user = only login / consent / judgment checkpoints

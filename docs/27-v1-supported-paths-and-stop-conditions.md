# V1 Supported Paths and Stop Conditions

- Status: active
- Canonical: English
- Korean companion: [27-v1-supported-paths-and-stop-conditions.ko.md](./27-v1-supported-paths-and-stop-conditions.ko.md)
- Parent: [README.md](./README.md)
- Related:
  - [16-v1-prd.md](./16-v1-prd.md)
  - [17-data-collection-strategy.md](./17-data-collection-strategy.md)
  - [21-first-agentic-scenario.md](./21-first-agentic-scenario.md)
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)
- Next recommended reading:
  - [08-hometax-submission-flow.md](./08-hometax-submission-flow.md)
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)

## Objective
Define the practical V1 filing paths the project intends to support first,
and the conditions under which the external AI agent must stop, defer, or hand control back to the user.

In this repo, MCP is the domain/tool layer.
The external AI agent handles browser work, file selection, OCR/extraction, and user conversation around checkpoints.
This document defines when that external AI agent must stop instead of pretending MCP can cover unsupported browser/file/OCR/user-judgment work.

This document exists to reduce ambiguity.
V1 should not pretend to support every Korean comprehensive income tax filing path equally well.

## Why this document matters
The architecture and workflow documents already describe how an agentic filing system should operate.
What they do not do alone is sharply answer:
- which real filing cases are in scope first,
- which ones are supportable only with heavy manual help,
- and when the product must stop rather than bluff.

That boundary is critical for trust.

## Framing principle
V1 should optimize for:
- supported paths completion,
- honest readiness reporting,
- high-confidence assisted filing on supported paths,
- and explicit user checkpoints.

V1 should not optimize for:
- claiming universal filing coverage,
- silently forcing unsupported cases through the workflow,
- or masking domain uncertainty behind generic automation.

## Acceptance-suite success / stop criteria
The supported-path acceptance suite should prove that current surfaces are usable end to end.

Success means:
- the workflow can move through init_config → plan_collection → import/normalize → facts → review → draft → refresh → compare → prepare → assist → approval/result → export
- `nextRecommendedAction` stays meaningful at each major step
- readiness can be observed moving through `estimate_ready` → `draft_ready` → `submission_assist_ready`
- user intervention stays limited to login / consent / judgment / targeted fact answer
- no-prep collection scenarios still start with HomeTax authoritative materials rather than vague upload requests
- conditional deduction/supporting documents are requested only when they become the narrow remaining collection truth
- wrong first artifacts (such as XLS-only withholding lists or summary-only views) recover toward official PDF/print fallback instead of repeating the same bad tactic
- compare-after-refresh stop/go remains consistent across status/summary/assist gating
- no-prep full-close acceptance proves result recording and export can be reached from the same collection-first scenario without switching to a separately seeded runtime path
- result recording auto-closes the assist session and the final workspace converges to `submitted`, `submission_failed`, or `submission_uncertain`
- export_package includes blockers, checklist, and receipt information when available

Stop means:
- Tier C or unsupported/manual-heavy conditions still block submission-assist progression
- unresolved material mismatch, unresolved duplicate, conflicting withholding, or unsupported adjustment blocks submission-assist-ready progression
- approval/result boundaries are respected and ambiguous portal states do not claim success

Trust-policy reminders:
- `stopReasonCodes` should contain only active blockers that actually stop or hard-downgrade progression
- low-confidence classification must generate review work and readiness downgrade, but may live in warnings until it becomes an active blocker
- duplicate detection should be deterministic across repeated imports, not heuristic guesswork hidden from the operator
- operator-facing summaries should explain blockers in plain language while also returning machine-readable stopReasonCodes
- regime shifts (for example prior-year 3.3% posture to current double-entry/bookkeeping-heavy posture) should surface as first-class warnings, not hidden assumptions
- current-year regime should be inferred from imported official materials when possible; prior-year regime is only a warning hint, not the sole automatic basis
- multi-industry cases (for example 940926 + 940909) should use the official principal-industry formula: principal revenue + secondary revenue × (principal threshold / secondary threshold), calculated separately for each threshold family rather than naïve summation or fixed 0.5 weighting
- wage-income-oriented credits should not auto-apply to pure business posture
- mixed-use phone/internet/card/home/vehicle costs need allocation basis, business-use ratio, and evidence before tax benefit is treated as settled
- legal opportunity signals (for example bookkeeping tax-credit possibility, business-account/card ergonomics, resident-register skip when no dependents, official withholding receipt necessity, and itemized-card-detail follow-up) should be surfaced as structured opportunity/warning fields rather than vague prose
- assumptions used in drafting must be disclosed explicitly

## Support tier definitions

### Tier A — supported assisted paths
Meaning:
- the project intends to support this path as a normal V1 workflow,
- the AI agent can collect, review, draft, and assist through HomeTax with clear checkpoints,
- and the system has a credible path to produce a submission-assist-ready draft.

### Tier B — manual-heavy / limited support paths
Meaning:
- some workflow help is still useful,
- but the user should expect more manual fact capture, evidence handling, or portal-side work,
- and the system may stop before full submission assistance.

### Tier C — out of scope for V1
Meaning:
- the agent may explain why the case is unsupported,
- may still organize inputs or surface blockers,
- but should not represent the case as reliably submission-ready.

## Tier A: target supported paths
These are the best candidates for an initial real-world filing product.

### 1. HomeTax-friendly simple filing paths
Characteristics:
- filing path is close to prefilled or lightly adjusted flows,
- the user can reasonably review the computed result,
- HomeTax assist is mostly about navigation, comparison, and confirmation.

Examples:
- prefilled-like flows where major official values already exist,
- relatively simple personal comprehensive income filing flows with low ambiguity.

Why this is a good V1 path:
- lower document chaos,
- fewer bespoke business logic branches,
- faster user trust loop.

### 2. Freelancer-style cases with clear withholding records
Characteristics:
- income sources are understandable,
- withholding or prepaid tax records can be collected explicitly,
- expense treatment is limited or manageable,
- there is a workable route to draft verification.

Why this is a good V1 path:
- many users still need real help,
- but the domain complexity is lower than advanced business-bookkeeping cases.

### 3. Mixed-income individual cases with limited complexity
Characteristics:
- salary plus side income, or a similarly understandable combination,
- no advanced partnership or bookkeeping complexity,
- withholding and source coverage can be checked explicitly.

Why this is a good V1 path:
- this is a realistic user segment,
- and it forces the product to model source coverage and withholding truthfully.

### 4. Simpler expense-claiming cases with explicit review gates
Characteristics:
- some expenses exist,
- but the volume and ambiguity are still manageable,
- and unclear items can be surfaced through review rather than guessed away.

Why this is still acceptable for V1:
- it tests the review-queue design in a realistic way,
- without immediately requiring full high-complexity bookkeeping support.

## Tier B: manual-heavy / limited support paths
These paths may still be partially useful in V1, but should be described carefully.

### 1. General filing paths requiring broader fact capture
Examples:
- cases where deduction or credit eligibility depends on facts not naturally present in transaction history,
- cases where the user must provide multiple manual explanations or evidence bundles.

Expected V1 behavior:
- collect and organize facts,
- expose blockers,
- produce a draft with clear assumptions and warnings,
- assist only where confidence is high.

### 2. Cases with incomplete official data that may change during filing season
Examples:
- filings where official source refreshes can materially change values,
- cases where the product can estimate but not yet claim stable submission readiness.

Expected V1 behavior:
- support refresh, diff, recompute, and comparison,
- avoid pretending the first draft is final.

### 3. Creator or platform-income cases requiring extra tax treatment handling
Examples:
- cases involving foreign withholding or platform-issued evidence,
- situations where source collection is possible but domain treatment is not yet deeply productized.

Expected V1 behavior:
- preserve records explicitly,
- surface the need for additional review,
- stop before confident submission assistance if the support tier is not met.

## Tier C: out-of-scope paths for V1
The exact boundaries can evolve, but V1 should treat the following as out of scope unless explicitly narrowed and upgraded later.

### 1. Advanced bookkeeping-heavy filings
Examples:
- cases requiring substantial business-book maintenance,
- filings that depend on advanced accounting reconstruction,
- cases where correctness depends on complex business-use allocation beyond reasonable V1 review support.

### 2. High-complexity multi-party or allocation-heavy cases
Examples:
- partnership-like or jointly allocated situations,
- filings with significant shared-income or distributed-income interpretation requirements.

### 3. Cases requiring specialist optimization rather than workflow support
Examples:
- situations where multiple legitimate tax treatments exist and the main task is professional optimization,
- cases where legal interpretation risk is too high for an open-source V1 product posture.

## Required input classes for a submission-ready path
A case should not be treated as submission-ready merely because transactions were imported.
At minimum, a supportable path should have enough coverage across the following input classes.

### 1. Filing path determination inputs
Examples:
- filing year,
- residency or filing context,
- taxpayer posture,
- filing-path clues from official or user-provided facts,
- business-registration or business-context hints where relevant.

### 2. Income inventory
Examples:
- income categories,
- payer or source clues,
- covered versus uncovered income sources,
- timing period,
- evidence linkage.

### 3. Withholding / prepaid tax records
Examples:
- withholding records,
- prepaid tax clues,
- local-tax-related amounts where relevant,
- provenance and review status.

### 4. Expense and evidence coverage
Examples:
- claimed expense candidates,
- linked evidence,
- business-use explanation where needed,
- unresolved ambiguity count.

### 5. Deduction / credit facts
Examples:
- fact checklists,
- required evidence,
- support-tier labeling,
- unsupported or deferred categories.

### 6. Filing-field mapping and comparison readiness
Examples:
- draft field values by section,
- manual-entry flags,
- assumptions,
- mismatch state against visible HomeTax values.

## Submission readiness levels
The product should distinguish at least these levels.

### Estimate-ready
Meaning:
- enough inputs exist for an approximate result,
- but there are still material unknowns.

### Draft-ready
Meaning:
- a structured filing draft exists,
- major assumptions and blockers are surfaced,
- but submission assistance may still be blocked.

### Submission-assist-ready
Meaning:
- required blockers for the supported path have been resolved,
- HomeTax field mapping is available,
- and the agent can proceed into assisted filing with explicit user checkpoints.

The system should prefer these layered readiness levels over a single vague notion of “ready.”

## Unsupported scope reminder
Even on a supported filing path, these remain outside MCP scope:
- direct browser automation as MCP responsibility
- local file discovery by MCP
- OCR/document extraction by MCP
- replacing explicit user consent, login, or review judgment

The external AI agent may perform those tasks in its own runtime, but it must hand MCP only the resulting refs, structured extracted payloads, and portal-observed values.

## Stop conditions
The external AI agent should stop, pause, or downgrade claims when any of the following holds.

### Stop 1. Unsupported filing path detected
Examples:
- the case clearly falls into a Tier C path,
- or the filing path cannot be safely determined.

Required behavior:
- explain the support boundary,
- preserve collected facts,
- avoid presenting the case as safely submission-ready.

### Stop 2. Missing material source coverage
Examples:
- likely income sources remain uncollected,
- important withholding records are missing,
- expected evidence is absent for material expense claims.

Required behavior:
- create explicit coverage gaps,
- identify the next best collection step,
- do not overstate confidence.

### Stop 3. Unresolved high-severity review items
Examples:
- mixed-use expense ambiguity,
- duplicate conflict on a material item,
- high-impact fact uncertainty.

Required behavior:
- hold draft progression or submission readiness,
- route through explicit review.

### Stop 4. Draft-to-HomeTax comparison is incomplete or materially mismatched
Examples:
- required sections cannot be mapped,
- visible HomeTax values disagree materially with the draft,
- the portal state changed after refresh.

Required behavior:
- surface the mismatch,
- prefer verification over silent overwrite,
- block final submission until resolved or consciously accepted.

### Stop 5. Required user checkpoint is missing
Examples:
- source consent not granted,
- authentication not completed,
- final submission approval not explicitly provided.

Required behavior:
- pause with a resumable checkpoint,
- never fabricate completion.

### Stop 6. Official data freshness is no longer trustworthy
Examples:
- official refresh suggests changed values,
- filing-season updates may invalidate a previous draft,
- the system cannot verify whether the visible portal data is current.

Required behavior:
- refresh,
- diff,
- recompute,
- compare again before claiming submission readiness.

## Human handoff conditions
Even within supported paths, the agent should explicitly hand off when:
- the user needs to perform an identity or portal action directly,
- a material ambiguity requires human judgment,
- the product reaches a manual-only support tier,
- or the user asks to take over.

## Relationship to MCP and state design
This document implies that the workflow surface and state model need explicit concepts for:
- filing-path detection,
- withholding record tracking,
- readiness by level,
- field-level draft mapping,
- HomeTax comparison state,
- and domain-aware coverage gaps.

See also:
- [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
- [20-workspace-state-model.md](./20-workspace-state-model.md)
- [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)

## Summary
V1 should be narrow on purpose.
A trustworthy V1 is one that:
- clearly says which filing paths it supports,
- distinguishes estimate-ready, draft-ready, and submission-assist-ready,
- stops on material domain uncertainty,
- optimizes for supported paths completion,
- and keeps the user in visible control through the final filing steps.

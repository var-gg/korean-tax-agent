# Domain Model Gap Analysis for Real Filing Inputs

- Status: active
- Canonical: English
- Korean companion: [26-domain-model-gap-analysis.ko.md](./26-domain-model-gap-analysis.ko.md)
- Parent: [README.md](../README.md)
- Related:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
  - [39-agent-operator-quickstart.md](./39-agent-operator-quickstart.md)

## Objective
This document no longer tracks already-landed domain entities as gaps.
Instead, it records the **remaining operational risks** now that the repo already has first-class support for:
- taxpayer facts
- withholding / prepaid-tax records
- filing adjustment candidates
- filing field values / section-level output
- submission approval / result / receipt capture
- export-package artifacts

## Current implementation baseline
The current codebase already models and exposes:
- targeted taxpayer fact capture and missing-fact planning
- explicit withholding records with provenance and review state
- adjustment candidates with supported / manual_only / out_of_scope posture
- field-level filing draft values and section-level HomeTax handoff output
- comparison-state and mismatch severity on filing fields
- submission approval records, submission results, and receipt refs
- read-only export packages for audit / handoff / review

That means those areas should not be described as "missing domain model" anymore.

## Remaining operational-risk summary
The biggest remaining risks are now less about missing nouns and more about:
- maintaining honest transitions across **estimate-ready**, **draft-ready**, and **submission-assist-ready** states
- calibration quality
- operator load management
- source/evidence scale
- recovery behavior under ambiguous portal conditions
- host-runtime consistency for browser assist

## Risk 1. Confidence calibration is still heuristic-heavy
Current state:
- confidenceScore, duplicateRisk, materiality, mismatchSeverity, and stopReasonCodes exist
- low-confidence classification and severe mismatch can already downgrade or stop readiness

Remaining risk:
- confidence and escalation behavior still depend on heuristic thresholds rather than fully validated production calibration
- supported-path accuracy needs real operator feedback loops to tune stop/downgrade decisions

Recommendation:
- validate thresholds with replay fixtures and pilot operator feedback
- add scenario-level calibration examples for Tier A / B / C boundaries

Priority:
- **high**

## Risk 2. Duplicate handling is modeled, but operator ergonomics can improve
Current state:
- duplicate candidate risk is surfaced
- duplicate-related review paths already exist

Remaining risk:
- large workspaces can still produce too many duplicate-oriented review moments
- duplicate grouping/explanation quality matters for operator trust and user question count

Recommendation:
- strengthen duplicate-group rendering in summaries, exports, and review batches
- document operator decision patterns for duplicate-heavy imports

Priority:
- **high**

## Risk 3. Review batching needs more production-grade tuning
Current state:
- reviewBatchId exists and hardening metadata can guide batching

Remaining risk:
- batching policy is still basic
- the system should better separate high-materiality questions from low-impact grouped questions

Recommendation:
- refine batch construction rules
- add explicit examples for grouped vs isolated review prompts

Priority:
- **high**

## Risk 4. Evidence operations need stronger scale conventions
Current state:
- evidence linking, evidence index export, provenance refs, and review state are present

Remaining risk:
- large workspaces can accumulate many artifacts/documents quickly
- operator review becomes harder if evidence naming/indexing conventions drift across imports and exports

Recommendation:
- standardize evidence-index conventions and artifact naming guidance
- document retention / archive expectations for export-package outputs

Priority:
- **medium-high**

## Risk 5. Ambiguous portal outcomes still need more recovery examples
Current state:
- submission_result supports success / fail / unknown
- false success is blocked
- receipt refs and verificationRequired are stored

Remaining risk:
- operators and external AI agents still need clearer examples for ambiguous portal states, partial receipts, and post-submit verification loops

Recommendation:
- add scenario docs for submission_uncertain and ambiguous receipt capture
- define operator follow-up patterns after unknown results

Priority:
- **medium-high**

## Risk 6. Browser-assist portability remains an operational concern
Current state:
- MCP/browser boundary is explicit
- start/resume/checkpoint handoff is structured
- host-agnostic browser runtime seam exists

Remaining risk:
- different host runtimes may still vary in checkpoint handling, reconnect quality, and operator narration style
- browser assist is only as strong as the host/runtime discipline around MCP stop conditions

Recommendation:
- keep host-runtime docs and examples aligned with the current MCP boundary
- add more restart/recovery examples for assist interruption cases

Priority:
- **medium**

## Bottom line
The repo is past the stage where taxpayer facts, withholding, adjustment candidates, or filing field values should be called domain gaps.

The remaining risk is operational hardening:
- calibrate trust policy better
- reduce review/operator load
- improve evidence scale hygiene
- improve ambiguous-result recovery
- keep browser-assist integrations disciplined around the MCP boundary

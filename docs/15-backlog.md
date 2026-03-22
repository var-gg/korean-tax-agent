# Backlog

## Recently productized from backlog
- Structured legal opportunity engine now surfaces official-rule-based candidates such as bookkeeping tax credit possibility, business account/card ergonomics, mixed-use allocation review, wage-credit non-auto-application for pure business, resident-register skip when no dependents, official withholding receipt requirement, and itemized card detail follow-up.

- Status: active
- Canonical: English
- Parent: [README.md](../README.md)

## Purpose
This backlog tracks **remaining product and operational work** after the current MCP/runtime surface landed.
It should not repeat already-implemented runtime/facade exposure work.

## Product
- tighten Tier A / Tier B / Tier C supported-path examples with concrete taxpayer scenarios
- define operator-facing acceptance criteria for "99% assisted filing success" measurement
- add release-ready disclaimer / operator guidance language for public packaging

## Operational trust and review
- refine review batching so high-materiality items split cleanly while low-impact items stay grouped
- improve duplicate-group explanation UX for operators and external AI agents beyond the current deterministic duplicateGroup/link rules
- define operator playbooks for ambiguous submission results and receipt-verification follow-up

## Collection and evidence operations
- improve source-priority heuristics for mixed-income edge cases
- standardize evidence-index conventions for long-running workspaces with many imports
- tighten stale-official-data handling for refresh / recompute / compare loops

## Browser assist and handoff
- map more HomeTax screen variants and page-state transitions for assist checkpoints
- expand host/runtime examples around stopReason, restartGuidance, and awaiting_external_submit_click handling
- document assist-session handoff examples for more host runtimes

## Exports and audit
- add richer operator examples for export-package consumption across review / audit / handoff scenarios
- define retention guidance for snapshot-friendly export artifacts and receipt bundles

## Open questions
- what is the smallest operator-facing packaging/distribution path for real pilot use
- which supported-path examples should become canonical demo fixtures
- how much post-submission follow-up guidance belongs in MCP docs versus host/runtime docs

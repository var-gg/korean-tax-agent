# MCP Tool Spec

## Purpose
The MCP surface should expose a compact, agent-friendly tool layer for:
- environment setup,
- data import,
- normalization,
- classification,
- review handling,
- draft generation,
- HomeTax-assisted submission.

The goal is not to expose every internal function, but to give the agent a reliable workflow API with clear consent and audit behavior.

## Tool design rules
- every sensitive action must surface consent state
- every mutating action should produce audit metadata
- review-item resolution must be explicit and attributable
- tool responses should be structured for agent follow-up, not prose-only
- long-running steps should support progress/pause/resume semantics

## Common response envelope
Suggested response shape:

```json
{
  "ok": true,
  "data": {},
  "warnings": [],
  "requiresConsent": false,
  "requiresAuth": false,
  "nextRecommendedAction": "tax.classify.run",
  "audit": {
    "eventType": "import_completed",
    "eventId": "evt_123"
  }
}
```

## Proposed tool groups

### setup

#### `tax.setup.inspect_environment`
Purpose:
- detect storage readiness, supported connectors, browser-assist capability, and missing prerequisites

Input:
- optional working config path

Output:
- environment summary
- missing dependencies
- supported import modes
- browser-assist availability

#### `tax.setup.init_config`
Purpose:
- initialize a local filing workspace/config

Input:
- filing year
- storage mode
- optional workspace path
- optional taxpayer type hint

Output:
- created workspace info
- initial config summary

#### `tax.setup.list_connectors`
Purpose:
- show available source connectors/import modes and their consent/auth requirements

Output:
- connector list
- capability matrix
- consent/auth notes

### sources

#### `tax.sources.connect`
Purpose:
- register and start connecting a source

Input:
- source type
- requested scope
- workspace id

Output:
- connection state
- consent requirement
- auth requirement
- next step

Notes:
- should not silently complete sensitive auth on behalf of the user

#### `tax.sources.list`
Purpose:
- list connected and available sources for a workspace

#### `tax.sources.sync`
Purpose:
- pull or refresh data from an already approved source

Input:
- source id
- sync mode (`incremental`, `full`)

Output:
- imported artifact counts
- changed item summary
- warnings

#### `tax.sources.disconnect`
Purpose:
- disable a source connection for future syncs

Notes:
- should not automatically delete prior imported records unless separately requested and approved

### imports

#### `tax.import.upload_transactions`
Purpose:
- ingest user-provided transaction files

Input:
- file refs
- source format hint
- workspace id

Output:
- artifact ids
- parse summary
- normalization readiness

#### `tax.import.upload_documents`
Purpose:
- ingest receipts, invoices, tax statements, and related evidence files

#### `tax.import.scan_receipts`
Purpose:
- OCR/extract fields from receipt-like inputs

Output:
- extracted field candidates
- confidence
- review candidates

#### `tax.import.import_hometax_materials`
Purpose:
- ingest HomeTax-exported files or acquired materials

Output:
- recognized document types
- parse results
- unsupported material warnings

### ledger

#### `tax.ledger.normalize`
Purpose:
- normalize imported source artifacts into canonical transactions/documents

Input:
- workspace id
- optional artifact ids
- normalization mode

Output:
- transaction/document counts
- duplicate candidates
- normalization warnings

#### `tax.ledger.list_transactions`
Purpose:
- query normalized transactions with filters

Input:
- workspace id
- date range
- direction
- review status
- limit/offset

#### `tax.ledger.link_evidence`
Purpose:
- attach evidence documents to transactions manually or semi-automatically

Input:
- transaction ids
- document ids
- link mode

### classification

#### `tax.classify.run`
Purpose:
- classify normalized records into tax-relevant categories/treatments

Input:
- workspace id
- optional subset filters
- ruleset version

Output:
- classified count
- low-confidence count
- generated review items
- summary by category

#### `tax.classify.list_review_items`
Purpose:
- list unresolved or filtered review items

Input:
- workspace id
- severity filter
- reason filter
- batched only flag

#### `tax.classify.resolve_review_item`
Purpose:
- apply a human-approved resolution to one or more review items

Input:
- review item ids
- selected option
- rationale
- approver identity

Output:
- resolved items
- affected draft/decision deltas

Notes:
- should emit strong audit metadata

### filing

#### `tax.filing.compute_draft`
Purpose:
- compute or refresh the filing draft from current normalized and resolved data

Input:
- workspace id
- draft mode
- include assumptions flag

Output:
- draft id
- income/expense/deduction/withholding summaries
- warnings
- unresolved blockers

#### `tax.filing.get_summary`
Purpose:
- retrieve a concise filing summary for user review or agent narration

Input:
- workspace id or draft id
- detail level

#### `tax.filing.export_package`
Purpose:
- produce human-reviewable export artifacts

Possible outputs:
- JSON package
- CSV review reports
- evidence index
- submission prep checklist

Notes:
- exporting to an external destination may require distinct consent depending on target

#### `tax.filing.prepare_hometax`
Purpose:
- convert draft outputs into a HomeTax-assist-ready structure

Output:
- section mapping
- required manual fields
- blocked/unsupported fields
- browser assist readiness

### browser assist

#### `tax.browser.start_hometax_assist`
Purpose:
- begin a visible, pause/resume HomeTax assistance session

Input:
- workspace id
- draft id
- mode (`guide_only`, `fill_assist`)

Output:
- assist session id
- current checkpoint
- auth required flag

#### `tax.browser.resume_hometax_assist`
Purpose:
- continue a paused assist session after auth, user action, or interruption

#### `tax.browser.stop_hometax_assist`
Purpose:
- stop the active assist session cleanly

#### `tax.browser.get_checkpoint`
Purpose:
- inspect current HomeTax progress, blockers, and pending user actions

## Consent and auth semantics

### `requiresConsent`
Set true when the requested action cannot proceed under currently recorded scope.

### `requiresAuth`
Set true when the user must directly complete a login/authentication step.

### `blockingReason`
Recommended when `ok=false` or the workflow must stop:
- `missing_consent`
- `missing_auth`
- `unresolved_high_risk_review`
- `draft_not_ready`
- `unsupported_hometax_state`

## Recommended workflow sequence
1. `tax.setup.inspect_environment`
2. `tax.setup.init_config`
3. `tax.setup.list_connectors`
4. `tax.sources.connect` / upload imports
5. `tax.ledger.normalize`
6. `tax.classify.run`
7. `tax.classify.list_review_items`
8. `tax.classify.resolve_review_item`
9. `tax.filing.compute_draft`
10. `tax.filing.prepare_hometax`
11. `tax.browser.start_hometax_assist`

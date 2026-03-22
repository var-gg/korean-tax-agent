# 41 - Pilot Replay Bundle

- Status: active
- Canonical: English
- Parent: [README.md](../README.md)
- Related:
  - [39-agent-operator-quickstart.md](./39-agent-operator-quickstart.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
  - [`examples/host/pilot-replay-bundle-schema.json`](../examples/host/pilot-replay-bundle-schema.json)
  - [`examples/host/export-pilot-replay-bundle.ts`](../examples/host/export-pilot-replay-bundle.ts)

## Purpose
When an operator runs repeated pilot tests across **AI agent + MCP + user**, every run should leave behind the same replayable evidence shape.

This document standardizes the **pilot replay bundle** format before adding any new top-level MCP tool.
The immediate goal is operational hardening:
- repeatable off-season testing
- cleaner postmortems
- cross-run comparison
- faster regression diagnosis

## Scope boundary
The replay bundle is a **host-level artifact**.
It is not a raw browser log dump and not a replacement for the MCP runtime snapshot.

### Keep in host/private storage
These should remain outside the MCP bundle payload unless separately redacted and explicitly exported:
- raw browser traces / DOM logs
- raw file system paths
- OCR raw text dumps
- full user chat transcripts
- screenshots containing secrets or personal identifiers
- passwords / OTP / session cookies / tokens

### What MCP-facing replay should contain
The replay bundle should preferentially contain **structured MCP-facing outputs**:
- `tax.workspace.get_status`
- `tax.filing.get_summary`
- `tax.filing.export_package`
- `tax.sources.record_collection_observation`
- plus the host agent’s redacted tool-call trace and operator/user interaction summaries

## Required bundle fields
Minimum fields:
- `runId`
- `repoCommit`
- `workspaceId`
- `filingYear`
- `hostRuntime`
- `startedAt`
- `endedAt`
- `userIntent`
- `toolCallTrace[]`
- `collectionObservations[]`
- `statusSnapshots[]`
- `browserCheckpointSummaries[]`
- `operatorQuestions[]`
- `artifactsCollected[]`
- `exportPackageRefs[]`
- `finalOutcome`
- `unresolvedBlockers[]`
- `improvementHypotheses[]`

The canonical JSON schema and examples live at:
- [`examples/host/pilot-replay-bundle-schema.json`](../examples/host/pilot-replay-bundle-schema.json)

## Redaction rules
Sensitive values must be redacted before a bundle is saved or shared.
At minimum redact:
- resident registration number / 주민등록번호
- account numbers
- card numbers
- passwords / OTP / access codes
- exact auth tokens / cookies
- raw file paths containing personal names if they are not necessary

Preferred redaction markers:
- `[REDACTED_SSN]`
- `[REDACTED_ACCOUNT]`
- `[REDACTED_PASSWORD]`
- `[REDACTED_TOKEN]`
- `[REDACTED_PATH]`

## Failure runs are mandatory
A failed run is **not optional logging**.
Failure bundles are required because they capture:
- where a loop started
- whether the blocker was MCP / browser / human / seasonality / evidence quality
- what the agent wrongly inferred
- what the next test should change

## Status snapshots
`statusSnapshots[]` should be taken at key checkpoints, not every heartbeat.
Recommended minimum points:
1. right after `tax.setup.init_config`
2. after first source planning / collection branch choice
3. after normalize
4. after draft compute
5. after compare_with_hometax
6. before start_hometax_assist
7. after final approval or final result
8. after export_package or closeout

Each snapshot should include at least one of:
- `get_status`
- `get_summary`

## Browser checkpoint summaries
`browserCheckpointSummaries[]` should stay compact and structured.
Capture:
- checkpoint type/key/screenKey when present
- auth requirement state
- pending user action summary
- allowed next actions
- whether the browser lane was paused, resumed, or closed

Do **not** dump raw DOM or raw screenshots here.

## Tool-call trace
`toolCallTrace[]` should record the host agent’s MCP-facing interaction history.
Minimal fields per entry:
- timestamp
- tool name
- sanitized input summary
- result status
- blocking reason
- next recommended action
- notes

The trace is for replayability, not for storing every token of internal reasoning.

## Markdown summary + JSON bundle
Every run should produce both:
- a **JSON bundle** for machine comparison / re-ingestion / automation
- a **Markdown summary** for human review

Recommended pairing:
- `pilot-replay-<runId>.json`
- `pilot-replay-<runId>.md`

## Off-season heading loop procedure
For off-season pilot tests, use this same loop every run.

### 비시즌 헤딩 루프
1. record the user intent and expected lane
2. initialize workspace and save snapshot #1
3. run collection/normalize/draft/compare as usual
4. capture filing-window fields from `get_status` / `get_summary`
5. if submission lane is blocked or downgraded, **do not classify it as a generic browser/auth failure without evidence**
6. save collection observations and browser checkpoint summaries
7. export replay bundle even if the run stops before final submit
8. add at least one `improvementHypotheses[]` item before closing the run

This loop exists so repeated off-season trials stay comparable.

## Example exporter
Use the example host script to generate a replay bundle from structured input:
- [`examples/host/export-pilot-replay-bundle.ts`](../examples/host/export-pilot-replay-bundle.ts)

The script writes:
- JSON replay bundle
- Markdown run summary

## Recommended host workflow
1. gather redacted structured inputs from the host runtime
2. feed them into the exporter script
3. store both JSON and Markdown under a host-controlled run directory
4. attach export package refs rather than copying full artifact payloads into the replay file
5. preserve failure bundles exactly as seriously as successful bundles

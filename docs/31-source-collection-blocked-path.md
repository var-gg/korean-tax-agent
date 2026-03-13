# Source Collection Blocked Path

- Status: active
- Doc role: canonical
- Locale: en
- Parent: [README.md](./README.md)
- Related:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [19-agentic-auth-and-consent-flow.md](./19-agentic-auth-and-consent-flow.md)
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
  - [28-three-party-happy-path.md](./28-three-party-happy-path.md)
  - [30-source-planning-conversation.md](./30-source-planning-conversation.md)
- Next recommended reading:
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)
  - [29-source-strategy-for-real-tax-work.md](./29-source-strategy-for-real-tax-work.md)

## Objective
Describe what should happen when source collection does **not** follow the happy path.

This document is not about generic failure logging.
It is about maintaining an honest, agentic workflow when a collection attempt is interrupted by:
- UI drift,
- provider-side friction,
- export-only reality,
- incomplete source coverage,
- or unsupported filing complexity.

The goal is to make blocked states useful rather than vague.
A blocked path should still answer:
- what was attempted,
- what failed,
- what the user should do next,
- what fallback exists,
- and whether the filing can still progress to estimate-ready, draft-ready, or only stop honestly.

## Why this document matters
A product can look good in a happy path document while still failing the real trust test.
That trust test is:
**what does the system do when collection breaks halfway through?**

If the answer is:
- vague failure,
- repeated retries,
- or hidden loss of confidence,
then the workflow is not yet credible.

## Core rule
A blocked path is not a single thing.
Always separate:
- workspace status,
- source state,
- sync attempt state,
- checkpoint type,
- blocking reason,
- pending user action,
- fallback option,
- readiness impact.

The system should never compress all of this into “failed to sync.”

## Three-party posture in a blocked path

### User
The user should be asked only for the narrowest next action that can unblock progress.
The user should not be asked to diagnose the system.

### Agent
The agent should:
- explain what failed in practical language,
- say what was already collected successfully,
- say what filing area is affected,
- propose the best next move,
- and avoid bluffing about readiness.

### MCP
The MCP layer should:
- classify the failure,
- preserve partial progress,
- expose fallback options,
- keep the workflow resumable when possible,
- and downgrade readiness honestly when required.

## What a good blocked response looks like
A good blocked response should usually include:
- `status`
- `checkpointType` when waiting on the user
- `blockingReason`
- `pendingUserAction`
- `fallbackOptions[]`
- `resumeToken` if resumable
- `progress`
- `warnings[]`
- `readinessImpact`
- `nextRecommendedAction`

### Example response shape
```json
{
  "ok": true,
  "status": "awaiting_user_action",
  "checkpointType": "collection_blocker",
  "blockingReason": "export_required",
  "pendingUserAction": "Open the provider export page and download the statement for 2025.",
  "resumeToken": "resume_sync_001",
  "fallbackOptions": [
    "use_existing_saved_statement",
    "manual_statement_upload"
  ],
  "progress": {
    "phase": "collection",
    "step": "provider_statement_access",
    "percent": 45
  },
  "data": {
    "sourceId": "src_card_001",
    "partialArtifactsImported": 1,
    "readinessImpact": {
      "estimateReadiness": "unchanged",
      "draftReadiness": "at_risk",
      "submissionReadiness": "blocked"
    }
  },
  "nextRecommendedAction": "tax.sources.resume_sync"
}
```

## Scenario A. HomeTax login succeeds, but the materials page changed
This is one of the most realistic early blocked paths.

### Situation
- user approved HomeTax access
- user logged in successfully
- automation resumed
- expected materials path or selector no longer matches reality

### User-visible problem
From the user’s perspective, this often feels like:
- “I logged in, but then it got stuck.”

### Example MCP response
```json
{
  "ok": true,
  "status": "awaiting_user_action",
  "checkpointType": "collection_blocker",
  "blockingReason": "ui_changed",
  "pendingUserAction": "Navigate to the filing materials or statement page manually, then return control so collection can resume from there.",
  "resumeToken": "resume_htx_ui_001",
  "fallbackOptions": [
    "open_download_history_page",
    "ingest_existing_hometax_exports"
  ],
  "progress": {
    "phase": "collection",
    "step": "navigate_hometax_materials",
    "percent": 35
  },
  "data": {
    "sourceId": "src_hometax_001",
    "sourceState": "paused",
    "syncAttemptId": "sync_htx_002",
    "partialArtifactsImported": 0,
    "readinessImpact": {
      "estimateReadiness": "unchanged",
      "draftReadiness": "unchanged",
      "submissionReadiness": "blocked_until_official_collection_or_fallback"
    }
  },
  "nextRecommendedAction": "tax.sources.resume_sync",
  "audit": {
    "eventType": "collection_blocked",
    "eventId": "evt_blocked_htx_ui_001"
  }
}
```

### Agent to user
> HomeTax login worked, but the page layout I expected for filing materials did not match the current screen.
> Please move to the filing materials or statement page manually. Once that page is open, I can try resuming from there.

### What the agent should avoid saying
- “Something broke.”
- “The system failed.”
- “Please try everything again from scratch.”

### Why this blocked path matters
This path tests whether the product can:
- preserve auth progress,
- preserve source scope,
- resume from a later point,
- and turn UI drift into a narrow user action instead of a collapsed workflow.

### Likely implementation gaps revealed
- weak resume semantics after partial navigation
- insufficient UI-state capture
- brittle source/session distinction for HomeTax collection

---

## Scenario B. The provider requires export, not direct collection
This is not necessarily a failure.
It is often the realistic shape of v1.

### Situation
- the agent attempted browser-assisted or direct collection for a bank/card source
- the provider exposes data only through a statement export path
- direct automated extraction is impractical or blocked

### Example MCP response
```json
{
  "ok": true,
  "status": "awaiting_user_action",
  "checkpointType": "collection_blocker",
  "blockingReason": "export_required",
  "pendingUserAction": "Open the statement export page, download the 2025 file, and keep it accessible for ingestion.",
  "resumeToken": "resume_export_001",
  "fallbackOptions": [
    "use_existing_saved_statement",
    "manual_upload"
  ],
  "progress": {
    "phase": "collection",
    "step": "provider_export_required",
    "percent": 40
  },
  "data": {
    "sourceId": "src_card_001",
    "sourceState": "paused",
    "preferredCollectionMode": "export_ingestion",
    "readinessImpact": {
      "estimateReadiness": "unchanged_or_improved_if_other_sources_exist",
      "draftReadiness": "waiting_for_evidence_import",
      "submissionReadiness": "not_ready"
    }
  },
  "nextRecommendedAction": "tax.sources.resume_sync"
}
```

### Agent to user
> This provider is effectively export-first for this workflow.
> Please download the 2025 statement file. Once the file is available, I can ingest it and continue without pretending a live integration exists.

### Product lesson
`export_required` should often be treated as:
- a workflow branch,
- not a shameful hidden error.

### Likely implementation gaps revealed
- export path may still be modeled as an error instead of a first-class collection mode
- resume semantics after file creation may be underspecified
- file-ingestion linkage to the original source attempt may be weak

---

## Scenario C. Provider blocks automation after authentication
This is different from a UI change.

### Situation
- user consented
- user logged in
- provider introduces step-up friction, bot defenses, or a page pattern that cannot be safely automated

### Example MCP response
```json
{
  "ok": true,
  "status": "blocked",
  "checkpointType": "collection_blocker",
  "blockingReason": "blocked_by_provider",
  "pendingUserAction": "Use the provider’s visible export/download path if available, or choose another source for this filing gap.",
  "fallbackOptions": [
    "provider_export_flow",
    "existing_saved_documents",
    "skip_source_and_mark_coverage_gap"
  ],
  "progress": {
    "phase": "collection",
    "step": "provider_block_detected",
    "percent": 30
  },
  "data": {
    "sourceId": "src_bank_001",
    "sourceState": "blocked",
    "readinessImpact": {
      "estimateReadiness": "possibly_unchanged",
      "draftReadiness": "depends_on_gap_materiality",
      "submissionReadiness": "at_risk"
    }
  },
  "nextRecommendedAction": "tax.sources.plan_collection",
  "audit": {
    "eventType": "provider_block_detected",
    "eventId": "evt_provider_block_001"
  }
}
```

### Agent to user
> I got through login, but this source is not realistically collectable through the current automated path.
> The best next move is to use the provider’s export path if it exists, or switch to another source that covers the same filing gap.

### Why this matters
The system must distinguish:
- `ui_changed` → maybe resumable on the same path
- `blocked_by_provider` → likely needs fallback or source-plan revision

### Likely implementation gaps revealed
- insufficient distinction between “temporary collection blocker” and “structural provider block”
- lack of ranking logic for fallback source substitution
- unclear readiness downgrade rules when a source becomes unreachable

---

## Scenario D. Official data collected, but withholding coverage is still materially incomplete
This is where a workflow should stop boasting.

### Situation
- HomeTax artifacts were collected
- some income was detected
- major withholding/prepaid tax information is still missing or weakly supported

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001",
    "collectionSummary": {
      "officialMaterials": "partial",
      "incomeCoverage": "medium",
      "withholdingCoverage": "low"
    },
    "coverageGaps": [
      {
        "gapType": "missing_withholding_record",
        "severity": "high",
        "description": "Freelance-related withholding or prepaid tax records are not yet materially covered."
      }
    ],
    "readinessImpact": {
      "estimateReadiness": "possible_with_assumptions",
      "draftReadiness": "limited",
      "submissionReadiness": "blocked"
    }
  },
  "blockingReason": "missing_material_coverage",
  "warnings": [
    "Do not present this case as submission-assist-ready while withholding coverage remains materially incomplete."
  ],
  "nextRecommendedAction": "tax.sources.plan_collection"
}
```

### Agent to user
> I collected some official material, but I still do not have strong enough coverage for withheld or prepaid tax on the freelance side.
> I can still produce a rough estimate if you want, but I should not present this as ready for assisted filing yet.

### Why this matters
This is a critical trust moment.
The system should be able to say:
- “we have something,”
- but also,
- “we do not have enough for this stronger claim.”

### Likely implementation gaps revealed
- withholding coverage may still be under-modeled
- readiness downgrade language may still be too coarse
- estimate-ready vs draft-ready vs submission-ready boundaries may still be underspecified in code

---

## Scenario E. User clears source blockers, but the filing path itself moves out of scope
This is a deeper stop condition.

### Situation
- source collection mostly worked
- evidence was gathered
- classification reveals the case is more like a bookkeeping-heavy or specialist path

### Example MCP response
```json
{
  "ok": true,
  "status": "blocked",
  "blockingReason": "unsupported_filing_path",
  "data": {
    "workspaceId": "ws_2025_001",
    "supportTier": "C",
    "reasoning": [
      "advanced_bookkeeping_reconstruction_needed",
      "material_allocation_complexity_detected"
    ],
    "readinessImpact": {
      "estimateReadiness": "possible",
      "draftReadiness": "limited_manual_only",
      "submissionReadiness": "unsupported"
    }
  },
  "fallbackOptions": [
    "preserve_workspace_for_manual_review",
    "export_structured_summary_for_tax_professional"
  ],
  "nextRecommendedAction": "tax.workspace.export_summary",
  "audit": {
    "eventType": "unsupported_filing_path_detected",
    "eventId": "evt_unsupported_path_001"
  }
}
```

### Agent to user
> I can keep organizing the material, but this case no longer looks like a supported v1 assisted filing path.
> The main issue is that it now depends on bookkeeping-heavy or allocation-heavy treatment that the workflow should not bluff through.

### Why this matters
A strong blocked-path design does not just describe technical failure.
It also describes **honest domain stop conditions**.

### Likely implementation gaps revealed
- support-tier reassessment may not be continuous enough
- domain-driven stop conditions may not yet be tightly bound to workflow states
- export/hand-off paths for manual or professional follow-up may still be missing

---

## Scenario F. HomeTax assist is prepared, but comparison is incomplete
This is later than source collection, but belongs in the same blocked-path family.

### Situation
- draft exists
- HomeTax assist session begins
- visible HomeTax section does not line up enough with prepared draft-field mappings

### Example MCP response
```json
{
  "ok": true,
  "status": "blocked",
  "checkpointType": "collection_blocker",
  "blockingReason": "comparison_incomplete",
  "pendingUserAction": "Review the visible HomeTax section and confirm whether manual entry is needed for the mismatched fields.",
  "fallbackOptions": [
    "manual_field_entry_with_tracking",
    "pause_assist_and_refine_mapping"
  ],
  "data": {
    "assistSessionId": "assist_001",
    "mismatchSummary": {
      "sectionKey": "withholding_section",
      "mismatchSeverity": "high"
    },
    "readinessImpact": {
      "submissionReadiness": "blocked_until_comparison_resolved"
    }
  },
  "nextRecommendedAction": "tax.browser.resume_hometax_assist"
}
```

### Agent to user
> The draft exists, but I do not yet have a trustworthy enough comparison for this HomeTax section.
> We can either track manual entry here or pause and refine the mapping before continuing.

### Why this matters
It proves that even after draft generation, the system may still need to stop honestly.
Submission-assist-ready should not bypass comparison truth.

---

## Notification guidance for blocked paths

### Good notification style
Blocked-path notifications should say:
- what worked,
- what failed,
- what filing area is affected,
- what the next narrow action is,
- and whether readiness changed.

Examples:
- HomeTax login succeeded, but the materials page layout changed; please open the statement page manually so I can resume.
- This provider is export-first for this workflow; download the statement and I’ll ingest it.
- I can still estimate, but I should not call this submission-ready while withholding coverage remains incomplete.

### Bad notification style
Avoid:
- “Sync failed.”
- “Try again later.”
- “Need more data.”
- “Processing issue occurred.”

These hide the true state of the workflow.

## What blocked paths reveal about current design gaps

### 1. Resumability is a first-class feature, not a nice-to-have
Many realistic blocked paths are not fatal.
They require:
- resume tokens,
- partial progress preservation,
- and checkpoint-local recovery.

### 2. Blocking reasons need to be domain-aware, not purely technical
The workflow must distinguish:
- technical blockage,
- collection-mode branch,
- material missing coverage,
- and unsupported filing posture.

### 3. Readiness impact should be explicit in blocked responses
A blocked source is not just a source issue.
It changes what the system can responsibly claim.

### 4. Fallbacks must be attached to the original attempt
The system should not drop context when switching from:
- browser-assisted flow,
- to export,
- to local evidence ingestion.

### 5. Honest stop conditions are part of product quality
A system that stops correctly is better than one that continues with false certainty.

## One-line conclusion
A credible blocked-path design does not say:
- the source failed.

It says:
- here is what we tried,
- here is why progress stopped,
- here is the narrowest next move,
- here is the fallback,
- and here is what this means for filing readiness.

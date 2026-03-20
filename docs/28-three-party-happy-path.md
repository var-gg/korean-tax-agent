# Three-Party Happy Path: User, Agent, and MCP

- Status: active
- Doc role: canonical
- Locale: en
- Parent: [README.md](./README.md)
- Related:
  - [21-first-agentic-scenario.md](./21-first-agentic-scenario.md)
  - [19-agentic-auth-and-consent-flow.md](./19-agentic-auth-and-consent-flow.md)
  - [20-workspace-state-model.md](./20-workspace-state-model.md)
  - [24-workflow-state-machine.md](./24-workflow-state-machine.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
- Next recommended reading:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)

## Objective
This document describes a realistic **happy path conversation** among three parties:
- the **user**,
- the **agent**,
- and the **MCP workflow layer**.

It is not just a demo script.
It is meant to function as a **design diagnostic**.
At each stage, it shows:
- what the user says,
- what the agent should do,
- what the MCP layer should return,
- what kind of notification or progress update the agent should surface,
- and what this reveals about current implementation gaps.

## Why this document exists
This repo already explains:
- the intended product posture,
- the collection model,
- the workflow state model,
- and the MCP response contract.

What is still easy to miss is the **actual three-party interaction loop**:
- how the user starts,
- how the agent narrates and pauses,
- how the MCP layer signals progress, checkpoint, and readiness,
- and where the design still feels under-specified from a real Korean comprehensive income tax filing perspective.

## Scope of this happy path
This scenario intentionally stays near a **Tier A** V1 path.
Assumptions:
- filing year is known,
- the user can access HomeTax,
- the user can provide at least some local or exported evidence if needed,
- the case is not bookkeeping-heavy,
- the workflow aims to reach **submission-assist-ready**, not silent final submission.

Representative taxpayer posture:
- Korean comprehensive income tax filer,
- relatively understandable filing path,
- at least partially visible official data,
- manageable expense/review complexity.

## Interaction model in one sentence
The user provides **intent, approvals, authentication, and judgment**.
The agent handles **orchestration, explanation, and targeted follow-up**.
The MCP layer provides **structured state, progress, checkpoint, and workflow outputs**.

## Stage 0. User starts the workflow

### User
> I want to start preparing my 2025 comprehensive income tax filing.

### Agent to user
> Good. I’ll create a 2025 filing workspace first, then I’ll figure out the most useful collection path.
> I’ll try to gather things progressively so you only need to step in for approvals, login, and important judgment calls.

### Agent action
- create or select filing workspace
- mark workflow start for filing year 2025

### MCP tool shape
Suggested tool:
- `tax.setup.init_config`
- or a future workspace-specific entry tool such as `tax.workspace.create`

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001",
    "filingYear": 2025,
    "workspaceStatus": "initialized",
    "estimateReadiness": "not_ready",
    "draftReadiness": "not_ready",
    "submissionReadiness": "not_ready"
  },
  "nextRecommendedAction": "tax.profile.detect_filing_path",
  "audit": {
    "eventType": "workspace_created",
    "eventId": "evt_ws_create_001"
  }
}
```

### Agent notification posture
At this stage, the user-visible notification should be simple:
- workspace created,
- next step is profile/path detection,
- no source access has started yet.

### What the agent is doing at this stage
- creating the operational workspace,
- framing the workflow as progressive rather than upload-first,
- preventing the user from feeling they must prepare everything before value begins.

### What MCP should make possible here
- explicit workspace creation,
- explicit readiness baseline,
- next recommended action,
- initial audit event.

### Likely current design gaps revealed
- whether workspace creation is a first-class tool or still bundled into setup semantics,
- whether readiness defaults are consistently exposed from the first turn,
- whether the API uses workspace language or config language too early.

---

## Stage 1. Agent captures minimum filing facts

### Agent to user
> Before I choose the collection path, I need just a few basics.
> Is this for you personally, and is this a relatively typical case like freelance income, mixed salary + side income, or something else?

### User
> It’s for me personally. Mostly salary plus some side freelance income.

### Agent action
- capture minimal taxpayer facts
- detect preliminary filing posture
- avoid broad questionnaires

### MCP tool shape
Suggested tools:
- `tax.profile.capture_facts`
- `tax.profile.detect_filing_path`

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001",
    "taxpayerProfile": {
      "taxpayerType": "mixed_income_individual",
      "filingYear": 2025
    },
    "filingPathAssessment": {
      "supportTier": "A_candidate",
      "confidence": "medium",
      "reasoning": [
        "salary_plus_side_income_detected",
        "no_advanced_bookkeeping_signal"
      ]
    },
    "workspaceStatus": "collecting_sources"
  },
  "nextRecommendedAction": "tax.sources.plan_collection",
  "audit": {
    "eventType": "filing_path_detected",
    "eventId": "evt_path_detect_001"
  }
}
```

### Agent notification posture
The user should hear:
- what kind of case the system currently thinks this is,
- that this is a preliminary supported-path assessment,
- and that the next step is collection planning.

### What the agent is doing at this stage
- narrowing the workflow to a real Korean comprehensive income tax path,
- deciding whether the workflow should proceed as a likely Tier A path,
- reducing unnecessary question load.

### What MCP should make possible here
- fact capture separated from path detection,
- explicit support-tier estimate,
- structured reasoning for why the current path seems supportable.

### Likely current design gaps revealed
- taxpayer facts may still be under-modeled,
- filing posture may be too coarse,
- support-tier detection may not yet expose enough reasoning for user trust.

---

## Stage 2. Agent plans the first source path

### Agent to user
> I want to start with HomeTax first.
> For this kind of case, it’s usually the highest-value source for official filing materials and cross-checking.

### Agent action
- plan source priority
- select HomeTax as first anchor source
- estimate likely checkpoints: consent, authentication, maybe collection blocker

### MCP tool shape
Suggested tool:
- `tax.sources.plan_collection`

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001",
    "recommendedSources": [
      {
        "sourceType": "hometax",
        "priority": 1,
        "expectedValue": "high",
        "expectedCheckpoints": [
          "source_consent",
          "authentication"
        ]
      },
      {
        "sourceType": "local_evidence_folder",
        "priority": 2,
        "expectedValue": "medium"
      }
    ],
    "coverageSummary": {
      "official_data": "missing",
      "withholding_records": "unknown",
      "expense_evidence": "partial_or_unknown"
    }
  },
  "nextRecommendedAction": "tax.sources.connect",
  "audit": {
    "eventType": "collection_plan_created",
    "eventId": "evt_collection_plan_001"
  }
}
```

### Agent notification posture
The user should understand:
- why HomeTax is first,
- what value it brings,
- and that this is not yet the same as granting broad financial access everywhere.

### What the agent is doing at this stage
- prioritizing official data before broad manual evidence gathering,
- treating HomeTax as the filing anchor,
- preparing the user for a narrow consent request.

### What MCP should make possible here
- source recommendation with expected value,
- expected checkpoint disclosure,
- partial coverage summary before collection begins.

### Likely current design gaps revealed
- source-planning outputs may still be under-specified,
- expected checkpoint metadata may not yet be standardized,
- coverage pre-state may not yet be rich enough to explain why HomeTax is first.

---

## Stage 3. Agent requests scoped HomeTax consent

### Agent to user
> To continue, I need your approval to access HomeTax materials for this 2025 filing workspace.
> I’ll use that only for collecting filing-relevant documents and comparing draft values later.

### User
> Okay, go ahead.

### Agent action
- request source-scoped consent
- record approval
- prepare source connection

### MCP tool shape
Suggested tool:
- `tax.sources.connect`

### Example MCP response
```json
{
  "ok": true,
  "status": "awaiting_auth",
  "requiresConsent": false,
  "requiresAuth": true,
  "checkpointType": "authentication",
  "checkpointId": "chk_auth_htx_001",
  "data": {
    "workspaceId": "ws_2025_001",
    "sourceId": "src_hometax_001",
    "sourceType": "hometax",
    "sourceState": "awaiting_auth",
    "consentRecord": {
      "consentType": "source_access",
      "scope": "hometax_materials_for_2025_workspace",
      "status": "granted"
    }
  },
  "pendingUserAction": "Log in to HomeTax and complete the required authentication steps.",
  "nextRecommendedAction": "tax.browser.resume_hometax_assist",
  "audit": {
    "eventType": "source_connected_consent_granted",
    "eventId": "evt_source_connect_001"
  }
}
```

### Agent notification posture
This is the first real checkpoint.
The agent should tell the user:
- what was approved,
- what is needed next,
- and that login is still a separate step from consent.

### What the agent is doing at this stage
- converting the user’s approval into durable workflow state,
- preventing the common mistake of treating login and consent as the same thing,
- transitioning cleanly into auth.

### What MCP should make possible here
- durable consent record,
- source connection state,
- immediate checkpoint creation,
- resumable continuation rather than opaque failure.

### Likely current design gaps revealed
- separation of source connect vs auth start may still be fuzzy,
- consent record may still need richer workspace/source linkage,
- checkpoint ids and resume semantics may not yet be fully stable in implementation.

---

## Stage 4. User completes HomeTax authentication

### Agent to user
> Please log in to HomeTax in the opened flow.
> Once you finish login and the relevant materials page is reachable, I’ll continue the collection automatically.

### User
> Logged in.

### Agent action
- resume the paused source sync
- begin collection after auth checkpoint completion

### MCP tool shape
Suggested tool:
- `tax.sources.resume_sync`

### Example MCP response
```json
{
  "ok": true,
  "status": "in_progress",
  "requiresAuth": false,
  "checkpointType": null,
  "checkpointId": "chk_auth_htx_001",
  "data": {
    "workspaceId": "ws_2025_001",
    "sourceId": "src_hometax_001",
    "sourceState": "syncing",
    "syncAttemptId": "sync_htx_001"
  },
  "progress": {
    "phase": "collection",
    "step": "navigating_hometax_materials",
    "percent": 20
  },
  "nextRecommendedAction": "tax.sources.sync"
}
```

### Agent notification posture
At this stage, the user does not need a wall of text.
A concise progress update is enough:
- authentication completed,
- collection resumed,
- agent is now navigating and collecting.

### What the agent is doing at this stage
- taking over immediately after the identity checkpoint,
- avoiding repetitive “Are you sure?” type prompts,
- keeping the workflow moving.

### What MCP should make possible here
- clean resume after checkpoint completion,
- sync attempt creation,
- progress state that the agent can narrate without guessing.

### Likely current design gaps revealed
- auth completion detection may still depend too much on user confirmation,
- sync attempt state may not yet be modeled distinctly enough from source state,
- progress fields may not yet be fine-grained enough for useful narration.

---

## Stage 5. MCP collects HomeTax artifacts

### Agent internal behavior
The agent should now be doing work that the user should not have to micromanage:
- navigating HomeTax sections,
- identifying available filing materials,
- downloading or extracting available artifacts,
- recording any blocked branches explicitly.

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001",
    "sourceId": "src_hometax_001",
    "syncAttemptId": "sync_htx_001",
    "importedArtifacts": [
      {
        "artifactId": "art_htx_001",
        "artifactType": "pdf",
        "label": "official_tax_material_bundle"
      },
      {
        "artifactId": "art_htx_002",
        "artifactType": "html_snapshot",
        "label": "visible_hometax_summary"
      }
    ],
    "warnings": [],
    "partialBlockers": []
  },
  "nextRecommendedAction": "tax.ledger.normalize",
  "audit": {
    "eventType": "source_sync_completed",
    "eventId": "evt_sync_htx_001"
  }
}
```

### Agent to user
> I’ve collected the HomeTax materials I could access for this workspace.
> Next I’m going to normalize what was collected and check whether anything important is still missing.

### Agent notification posture
The notification should explain:
- source collection happened,
- the result is not yet a finished filing draft,
- the next stage is structuring and gap analysis.

### What the agent is doing at this stage
- turning the successful login into concrete filing materials,
- creating the raw input layer for downstream draft computation,
- avoiding premature claims of completeness.

### What MCP should make possible here
- imported artifact inventory,
- warning and partial-blocker signaling,
- a clean handoff to normalization.

### Likely current design gaps revealed
- artifact types may still be too generic,
- HomeTax-derived withholding/prepaid tax information may not yet be modeled as first-class enough outputs,
- partial blockers may need stronger structured semantics when collection is only partially complete.

---

## Stage 6. Agent normalizes data and checks coverage

### Agent action
- normalize imported HomeTax artifacts
- derive transactions, documents, evidence references, official records
- identify missing coverage

### MCP tool shape
Suggested tools:
- `tax.ledger.normalize`
- `tax.sources.get_collection_status`

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001",
    "normalizedSummary": {
      "documents": 6,
      "transactions": 14,
      "officialRecords": 3
    },
    "coverageGaps": [
      {
        "gapType": "missing_expense_evidence",
        "severity": "medium",
        "description": "Potential freelance-related expenses need supporting evidence."
      }
    ],
    "workspaceStatus": "collecting_sources"
  },
  "nextRecommendedAction": "tax.sources.plan_collection",
  "audit": {
    "eventType": "normalization_completed",
    "eventId": "evt_normalize_001"
  }
}
```

### Agent to user
> I’ve organized the HomeTax data.
> The main missing area right now is expense evidence for the freelance side, so I want to gather just enough additional material for that rather than asking for everything.

### Agent notification posture
This is where the product starts to feel agentic.
The user should see:
- the system has moved beyond collection into structured understanding,
- the next ask is targeted,
- and missing data is treated as explicit state, not vague uncertainty.

### What the agent is doing at this stage
- converting raw HomeTax material into workflow-ready entities,
- diagnosing what is still needed for a responsible Korean comprehensive income tax draft,
- preparing a narrow second-wave collection request.

### What MCP should make possible here
- normalized counts,
- explicit coverage gaps,
- severity labeling,
- next-step recommendations.

### Likely current design gaps revealed
- coverage gaps may not yet be modeled durably enough,
- official records and withholding data may need stronger first-class entities,
- deduction/evidence gaps may still be underspecified for real filing readiness.

---

## Stage 7. Agent requests one narrow evidence expansion

### Agent to user
> I don’t need everything.
> I just need the folder where your downloaded freelance expense receipts or statements are stored, so I can check whether the notable expense candidates have supporting evidence.

### User
> Okay, use my exported receipts folder.

### Agent action
- connect local or approved evidence source
- ingest only targeted materials

### MCP tool shape
Suggested tools:
- `tax.sources.connect`
- `tax.sources.sync`

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001",
    "sourceId": "src_local_receipts_001",
    "sourceType": "local_folder",
    "sourceState": "completed",
    "importedArtifacts": 9,
    "targetedReason": "missing_expense_evidence"
  },
  "nextRecommendedAction": "tax.ledger.normalize",
  "audit": {
    "eventType": "targeted_evidence_ingested",
    "eventId": "evt_local_ingest_001"
  }
}
```

### Agent notification posture
The user should feel:
- this was a narrow ask,
- it had a reason,
- and the workflow did not degrade into generic upload behavior.

### What the agent is doing at this stage
- expanding collection only where material filing gaps exist,
- preserving the promise of low-friction, high-value intervention.

### What MCP should make possible here
- source connection with explicit reason,
- targeted ingestion tracking,
- linkage between coverage gap and collection expansion.

### Likely current design gaps revealed
- target-reason linkage may not yet be a first-class part of source planning,
- local evidence ingestion may still be too artifact-centric and not enough evidence-link centric,
- duplicate detection across official and local artifacts may need richer modeling.

---

## Stage 8. Agent runs classification and review generation

### Agent action
- classify normalized items
- generate review queue only for material ambiguity

### MCP tool shape
Suggested tools:
- `tax.classify.run`
- `tax.classify.list_review_items`

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001",
    "classificationSummary": {
      "autoClassified": 18,
      "reviewRequired": 1
    },
    "reviewItems": [
      {
        "reviewItemId": "rev_001",
        "type": "mixed_use_expense",
        "severity": "medium",
        "description": "One communication expense may be partially personal use."
      }
    ],
    "workspaceStatus": "review_pending"
  },
  "nextRecommendedAction": "tax.classify.resolve_review_item",
  "audit": {
    "eventType": "review_queue_generated",
    "eventId": "evt_review_queue_001"
  }
}
```

### Agent to user
> I only have one item I need your judgment on.
> One communication expense may be mixed business and personal use. Once you tell me how to treat that, I can recompute the draft.

### Agent notification posture
This stage must demonstrate review compression.
The user should feel:
- the system filtered noise,
- only a meaningful judgment call remains,
- and the workflow is close to draft computation.

### What the agent is doing at this stage
- compressing ambiguity into a small number of decisions,
- protecting the user from low-value review burden,
- preserving traceability for material tax treatment.

### What MCP should make possible here
- compact review queue,
- severity-based review items,
- direct link to the next resolution action.

### Likely current design gaps revealed
- review items may still need better provenance and materiality fields,
- evidence-linked review explanations may not yet be strong enough,
- review batching rules may still be too thin for real-world scaling.

---

## Stage 9. User answers the review question

### User
> Treat 70% of that communication expense as business use.

### Agent action
- resolve review item with explicit user-provided judgment
- preserve attribution
- recompute draft

### MCP tool shape
Suggested tools:
- `tax.classify.resolve_review_item`
- `tax.filing.compute_draft`

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "reviewItemId": "rev_001",
    "resolution": {
      "kind": "user_override",
      "businessUseRatio": 0.7,
      "applied": true
    },
    "draftId": "draft_001"
  },
  "nextRecommendedAction": "tax.filing.get_summary",
  "audit": {
    "eventType": "review_item_resolved",
    "eventId": "evt_review_resolve_001"
  }
}
```

### Agent notification posture
The user should hear:
- that their decision was applied,
- that this was recorded as an explicit judgment,
- and that the system is now recomputing the draft.

### What the agent is doing at this stage
- turning user judgment into durable workflow state,
- ensuring the system does not silently invent policy-heavy tax treatment,
- preserving auditability.

### What MCP should make possible here
- explicit override attribution,
- durable resolution semantics,
- recomputation trigger.

### Likely current design gaps revealed
- review resolution schema may still be too shallow for nuanced taxpayer judgments,
- attribution fields may need stronger user/operator distinctions,
- recompute-to-delta explanation may still be weak.

---

## Stage 10. Agent computes draft and explains readiness

### MCP tool shape
Suggested tools:
- `tax.filing.compute_draft`
- `tax.filing.get_summary`
- `tax.filing.list_blockers`

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "workspaceId": "ws_2025_001",
    "draftId": "draft_001",
    "draftSummary": {
      "incomeCategories": ["salary", "freelance"],
      "withholdingCoverage": "mostly_complete",
      "expenseCoverage": "sufficient_for_draft",
      "warnings": []
    },
    "estimateReadiness": "ready",
    "draftReadiness": "ready",
    "submissionReadiness": "ready",
    "remainingBlockers": []
  },
  "nextRecommendedAction": "tax.filing.prepare_hometax",
  "audit": {
    "eventType": "draft_computed",
    "eventId": "evt_draft_compute_001"
  }
}
```

### Agent to user
> Your first structured draft is ready.
> At this point, the case looks submission-assist-ready: I have the main official materials, enough evidence for the meaningful expense items, and no unresolved blocker that would make HomeTax assist misleading.

### Agent notification posture
This is an important trust moment.
The notification should explain:
- what is ready,
- why it is ready,
- and why this is not being overstated.

### What the agent is doing at this stage
- translating raw workflow state into an honest Korean tax filing readiness claim,
- distinguishing draft-ready from submission-assist-ready,
- preparing the user for HomeTax assist rather than automatic submission.

### What MCP should make possible here
- separate estimate/draft/submission readiness,
- blocker listing,
- enough draft summary structure for meaningful agent narration.

### Likely current design gaps revealed
- submission readiness may still be too optimistic without field-level comparison support,
- withholding/prepaid tax coverage may still need stronger first-class reporting,
- draft summaries may still be too high-level for trustworthy final handoff.

---

## Stage 11. Agent prepares HomeTax assist

### Agent to user
> The draft is ready for HomeTax assistance.
> I can now move into the assisted portal workflow, where I compare the prepared draft against visible HomeTax sections and pause if manual confirmation is needed.

### Agent action
- prepare HomeTax assist
- create assist session
- move from draft workflow into portal-assisted workflow

### MCP tool shape
Suggested tools:
- `tax.filing.prepare_hometax`
- `tax.browser.start_hometax_assist`

### Example MCP response
```json
{
  "ok": true,
  "status": "awaiting_user_action",
  "checkpointType": "authentication",
  "data": {
    "workspaceId": "ws_2025_001",
    "draftId": "draft_001",
    "assistSessionId": "assist_001",
    "targetSection": "hometax_entry_start",
    "draftFieldMappingState": "prepared"
  },
  "pendingUserAction": "Open the HomeTax assist flow and complete any required login or re-authentication.",
  "nextRecommendedAction": "tax.browser.resume_hometax_assist",
  "audit": {
    "eventType": "hometax_assist_prepared",
    "eventId": "evt_hometax_prepare_001"
  }
}
```

### Agent notification posture
The user should understand:
- this is the start of visible submission assistance,
- not silent submission,
- and another authentication checkpoint may still be normal here.

### What the agent is doing at this stage
- handing off from computation into portal execution,
- preserving visible user control,
- keeping assist and submission separate.

### What MCP should make possible here
- assist session creation,
- field-mapping state,
- resumable browser-assist semantics,
- checkpoint-safe transition into HomeTax.

### Likely current design gaps revealed
- field-level mapping may still be weaker than readiness language implies,
- HomeTax comparison state may need stronger explicit entities,
- assist session and collection session semantics may still need clearer separation.

---

## What the user should feel in the happy path
If this flow is working correctly, the user should feel:
- I did not have to orchestrate the filing process manually.
- I only stepped in for approval, login, and one meaningful tax judgment.
- The agent kept moving the workflow forward.
- I could tell what was known, what was missing, and why the system was asking for something.
- “Submission-assist-ready” meant something concrete, not just optimistic language.

## Notification design guidance by phase

### Good notification style
Notifications should be short, operational, and confidence-calibrated.
Examples:
- workspace created; next step is path detection
- HomeTax chosen as first source because official filing materials are still missing
- consent recorded; login is now required
- authentication complete; collection resumed
- HomeTax materials collected; now normalizing and checking gaps
- one review decision remains before draft recomputation
- draft is ready; no material blocker remains for HomeTax assist

### Bad notification style
Avoid:
- verbose narration of every internal step
- vague statements like “processing...” with no workflow meaning
- claiming readiness without explaining what inputs were actually covered
- collapsing consent, auth, and final submission into generic “approval” language

## What this scenario reveals about likely missing pieces
This happy path is useful because it makes likely implementation gaps visible.

### 1. Filing facts are still likely too thin
The scenario depends on:
- taxpayer posture,
- mixed-income hints,
- and filing-path confidence.
These may still need richer first-class modeling.

### 2. Withholding / prepaid tax truth needs stronger representation
A real Korean comprehensive income tax happy path depends heavily on:
- official withholding signals,
- prepaid tax clues,
- and clear reporting of whether those are complete enough.
This is likely still under-modeled.

### 3. Coverage gaps need durable workflow semantics
The scenario assumes the system can say:
- what is missing,
- how severe it is,
- and what the next best collection action is.
That requires more than a warning string.

### 4. Review compression needs materiality-aware design
The happy path works because only one meaningful judgment reaches the user.
If review generation is noisy, the whole experience collapses into a manual workflow.

### 5. Submission readiness must be more than draft existence
The scenario uses `submissionReadiness = ready` only because:
- major source coverage is present,
- meaningful review is resolved,
- and HomeTax assist can begin honestly.
This implies stronger field-level mapping and comparison support than a summary-only draft model.

### 6. Assist session design must stay distinct from collection session design
Collection and HomeTax assist are related but not identical loops.
The happy path highlights the need for:
- assist session state,
- comparison checkpoints,
- and final approval boundaries.

## One-line conclusion
A credible Korean comprehensive income tax happy path is not:
- user uploads everything,
- system computes something,
- system claims readiness.

It is:
- the user starts with intent,
- the agent orchestrates progressively,
- the MCP layer exposes explicit checkpointed workflow state,
- and readiness is earned through visible source coverage, narrow review, and honest assist preparation.
on.
on.

# Source Planning Conversation

- Status: active
- Doc role: canonical
- Locale: en
- Parent: [README.md](./README.md)
- Related:
  - [19-agentic-auth-and-consent-flow.md](./19-agentic-auth-and-consent-flow.md)
  - [28-three-party-happy-path.md](./28-three-party-happy-path.md)
  - [29-source-strategy-for-real-tax-work.md](./29-source-strategy-for-real-tax-work.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
- Next recommended reading:
  - [09-mcp-tool-spec.md](./09-mcp-tool-spec.md)
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)

## Objective
Show how **source planning itself** should work as a three-party interaction among:
- the user,
- the agent,
- and the MCP workflow layer.

This document focuses on the stage *before* the broader happy path finishes.
Its question is narrower:
**how does the system decide where to collect from next, what does it ask the user, what does MCP return, and how do browser/export/local-folder flows fit into that decision?**

## Why this document matters
The repo already says:
- the workflow should be checkpoint-driven,
- HomeTax is often a high-value source,
- and data collection should be progressive.

But those principles still leave practical product questions open:
- when should HomeTax be first,
- when should local evidence be requested first,
- when should exports be preferred over direct integration,
- when should the agent ask for login,
- and who is responsible for opening visible browser flows.

This document is meant to make that interaction concrete.

## Core rule
Source planning is not:
- showing a connector marketplace,
- asking the user to pick random sources,
- or front-loading every possible integration.

Source planning is:
- the agent deciding the next best source by filing value,
- the MCP layer explaining that choice in structured form,
- and the user only intervening for scope approval, authentication, and truly necessary factual clarifications.

## Three-party responsibilities during source planning

### User
The user should provide:
- filing intent,
- minimum facts,
- approval for source scope,
- login/authentication when needed,
- and occasional factual clarifications.

The user should not need to design the source plan manually.

### Agent
The agent should:
- ask only enough to understand the likely filing path,
- choose the next most valuable source,
- explain why that source matters,
- translate structured MCP output into clear user prompts,
- and avoid broad “upload everything” requests.

### MCP
The MCP layer should:
- evaluate source value relative to current missing filing domains,
- represent source role as anchor or enrichment,
- expose required checkpoint types,
- return realistic next actions,
- and describe what specific filing risk is reduced by connecting a source.

## Interaction layers to keep separate

### 1. Source-planning layer
This answers:
- what source should we target next,
- why,
- and what filing domain does it improve.

### 2. Checkpoint layer
This answers:
- does the user need to approve,
- authenticate,
- click an export,
- or answer a fact question.

### 3. Execution layer
This answers:
- what actually opens the browser,
- what performs automation,
- what ingests the file,
- and what resumes after a checkpoint.

The planning layer should not depend on every execution detail being settled in advance.
But it must be explicit about when an execution-layer action is required.

## Source-planning conversation pattern
The pattern should usually be:
1. user starts the filing workflow
2. agent captures minimal filing facts
3. MCP recommends the next best source with a reason
4. agent explains the recommendation in operational language
5. user approves scope if needed
6. MCP returns the next checkpoint or runnable step
7. the execution layer opens the visible flow when required
8. the agent resumes when the checkpoint clears

## Scenario A. HomeTax-first planning path
This is the default-looking path for many Tier A or near-Tier-A cases.

### Situation
- filing year is known
- case appears to be mixed-income or freelancer-like
- official filing materials are not yet present
- withholding visibility is still weak

### User
> I want to start my 2025 filing.

### Agent to user
> I’ll first figure out the highest-value source.
> For many cases like this, HomeTax is the best starting point because it can anchor the filing context and help reveal official materials or withholding-related records.

### Agent action
- send current taxpayer facts and readiness gaps to source-planning logic

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "recommendedSources": [
      {
        "sourceType": "hometax",
        "role": "anchor",
        "priority": 1,
        "expectedValue": "high",
        "supports": [
          "official_filing_context",
          "withholding_visibility",
          "submission_path"
        ],
        "expectedCheckpoints": [
          "source_consent",
          "authentication"
        ]
      }
    ],
    "planningReason": {
      "missingDomains": [
        "official_materials",
        "withholding_prepaid_tax"
      ],
      "whyThisSourceFirst": "HomeTax is the strongest likely source for official filing-year context and visible official tax materials."
    }
  },
  "nextRecommendedAction": "tax.sources.connect"
}
```

### Agent to user
> I want to connect HomeTax first for this workspace.
> That gives me the best chance of pulling official filing materials and checking what withholding-related information is already visible before I ask you for anything broader.

### What the user should understand
- HomeTax is not being chosen arbitrarily
- the choice is tied to filing-domain value
- this is about official filing truth, not convenience alone

### What MCP is doing here
- mapping current gaps to a source recommendation
- labeling HomeTax as an anchor source
- forecasting likely checkpoints

### What execution is implied
If the user approves, the next step is likely:
- visible browser flow,
- then user authentication,
- then MCP-guided source sync resume.

---

## Scenario B. Local evidence first because official materials alone will not answer the immediate question
This is a useful non-default path.

### Situation
- official tax context may already be known
- user specifically wants expense-heavy freelance help
- the biggest current blocker is missing expense evidence rather than missing filing-year official context

### User
> My biggest problem is organizing freelance expenses. I already checked HomeTax myself, but all my receipts are scattered.

### Agent to user
> In that case, I may start with your receipts folder or exported expense statements first, because the immediate blocker is evidence coverage rather than basic official context.

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "recommendedSources": [
      {
        "sourceType": "local_evidence_folder",
        "role": "anchor_for_current_gap",
        "priority": 1,
        "expectedValue": "high",
        "supports": [
          "expense_evidence",
          "receipt_linkage"
        ],
        "expectedCheckpoints": [
          "source_consent"
        ]
      },
      {
        "sourceType": "hometax",
        "role": "anchor",
        "priority": 2,
        "expectedValue": "high",
        "supports": [
          "official_filing_context"
        ]
      }
    ],
    "planningReason": {
      "missingDomains": [
        "expense_evidence"
      ],
      "whyThisSourceFirst": "The most immediate material blocker is weak support for expense claims, and a scoped local evidence source can improve that faster than additional portal work."
    }
  },
  "nextRecommendedAction": "tax.sources.connect"
}
```

### Agent to user
> I’ll start narrowly with the folder where your receipts or saved statements live.
> I’m not asking for everything on your machine—just the evidence source that helps the current filing gap.

### What this reveals
- HomeTax-first is common, but not absolute
- source planning should be gap-driven, not dogmatic
- local sources can become the most valuable next source when the filing gap is evidence rather than official context

### What execution is implied
If the user approves:
- scoped local-folder access,
- artifact ingestion,
- then normalization and evidence linkage.

---

## Scenario C. Export-first planning path for bank/card data
This path is realistic when provider integration is unstable or unnecessary.

### Situation
- expense reconciliation or inflow tracing is needed
- direct connector support is not yet practical
- provider export is a more reliable first move

### Agent to user
> I need transaction detail from your bank or card records, but I do not need to force a direct live integration first.
> If your provider has an export or statement download path, that is often the fastest and safest V1 route.

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "recommendedSources": [
      {
        "sourceType": "card_statement_export",
        "role": "enrichment",
        "priority": 1,
        "expectedValue": "medium_high",
        "supports": [
          "expense_reconciliation",
          "merchant_detail"
        ],
        "preferredCollectionMode": "export_ingestion",
        "expectedCheckpoints": [
          "source_consent",
          "authentication",
          "collection_blocker"
        ]
      }
    ],
    "planningReason": {
      "missingDomains": [
        "expense_reconciliation"
      ],
      "whyThisSourceFirst": "A provider export is currently more realistic than a direct connector and still materially improves evidence and reconciliation coverage."
    },
    "fallbackOptions": [
      "local_saved_statement_folder",
      "manual_statement_upload"
    ]
  },
  "nextRecommendedAction": "tax.sources.connect"
}
```

### Agent to user
> I recommend using a statement export here rather than treating live financial API integration as mandatory.
> Once you reach the export page or save the file, I can ingest it and continue.

### What the user should understand
- export-first is not a degraded product failure
- it is often the most realistic V1 collection mode
- direct institution integration is optional when it does not materially improve the workflow enough

### What execution is implied
Depending on implementation:
- the execution layer may open a browser path to the provider,
- the user may log in and trigger export,
- the system ingests the resulting file,
- the agent continues with normalization.

---

## Scenario D. User asks for “connect everything” and the agent should resist
This is an important design guardrail.

### User
> Just connect all my banks and cards first.

### Agent to user
> I can expand to those sources if they become material, but I don’t want to start with broad collection that doesn’t improve filing truth enough.
> I’ll start with the sources most likely to answer the current tax questions first.

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "planningWarning": "broad_source_expansion_not_preferred",
    "recommendedSources": [
      {
        "sourceType": "hometax",
        "role": "anchor",
        "priority": 1
      },
      {
        "sourceType": "local_evidence_folder",
        "role": "enrichment",
        "priority": 2
      }
    ],
    "deferredSources": [
      "bank_transaction_history",
      "card_transaction_history"
    ],
    "deferReason": "Current filing gaps are better reduced by official materials and targeted evidence before broad financial expansion."
  },
  "nextRecommendedAction": "tax.sources.connect"
}
```

### Why this matters
A realistic system should be able to push back against unnecessary breadth.
Otherwise the product regresses into:
- generic aggregation,
- privacy-heavy source sprawl,
- and poor user trust.

---

## Scenario E. User already has the right file
Sometimes source planning should collapse immediately into ingestion.

### User
> I already downloaded the withholding statement and a card statement PDF.

### Agent to user
> Great. In that case I can ingest those first instead of making you repeat portal steps.

### Example MCP response
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "recommendedSources": [
      {
        "sourceType": "existing_export_bundle",
        "role": "anchor_or_enrichment_depends_on_contents",
        "priority": 1,
        "expectedValue": "high"
      }
    ],
    "planningReason": {
      "whyThisSourceFirst": "Relevant filing artifacts are already available locally, so immediate ingestion is lower friction than recreating collection through a live portal first."
    }
  },
  "nextRecommendedAction": "tax.sources.ingest_artifacts"
}
```

### Design implication
The workflow should not fetishize live connection when the correct material is already present.
The agent should choose the lowest-friction path that materially improves filing truth.

---

## How source planning should talk about checkpoints
The agent should never blur together:
- source choice,
- consent,
- authentication,
- export click,
- local-folder approval,
- and final filing approval.

These are different checkpoints.

### Good example
> I want to use HomeTax first because it helps with official filing context.
> If you approve, the next step will be logging in through the visible browser flow.
> After that, I’ll resume collection automatically.

### Bad example
> Approve everything and I’ll take it from there.

## What MCP should return during source planning
A useful source-planning response should usually include:
- `recommendedSources[]`
- source role (`anchor`, `enrichment`, or similar)
- `planningReason`
- `missingDomains[]`
- expected checkpoints
- preferred collection mode
- fallback options
- next recommended action

### Example response shape
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "recommendedSources": [
      {
        "sourceType": "hometax",
        "role": "anchor",
        "priority": 1,
        "preferredCollectionMode": "browser_assisted",
        "expectedCheckpoints": [
          "source_consent",
          "authentication"
        ]
      }
    ],
    "planningReason": {
      "missingDomains": [
        "official_materials",
        "withholding_prepaid_tax"
      ],
      "whyThisSourceFirst": "Official filing context is currently the highest-value missing domain."
    },
    "fallbackOptions": [
      "existing_export_bundle"
    ]
  },
  "nextRecommendedAction": "tax.sources.connect"
}
```

## Browser and UI responsibility in source planning
The user question “what opens the window?” should have a clean answer.

### MCP responsibility
MCP should indicate:
- that a visible browser flow is needed,
- which source/checkpoint it belongs to,
- and what event should resume the workflow.

### Agent responsibility
The agent should explain:
- what the user will see,
- what they need to do,
- and what will happen after the checkpoint clears.

### Execution-layer responsibility
The browser-assist or execution layer should:
- open the window or browser tab,
- preserve session state,
- and return control back into the MCP-driven workflow.

This means source planning should not hardcode UI details too early,
but it must make visible browser-mediated checkpoints explicit.

## Product implications from this conversation model

### 1. Source planning is a tax reasoning problem, not a connector catalog problem
The next source should be chosen because it reduces a filing-domain gap,
not because it is technically available.

### 2. HomeTax-first is a heuristic, not a religion
The system should prefer HomeTax often,
but still be able to say when local evidence or existing exports are a better first move.

### 3. Exports are first-class, not embarrassing fallbacks
For many financial sources, export-ingestion is a perfectly valid V1 strategy.

### 4. User trust improves when the workflow is narrow and justified
Users should hear:
- why this source,
- why now,
- and what filing risk it reduces.

### 5. MCP should encode operational learning over time
As the team learns what works in practice,
that knowledge should improve:
- source ranking,
- fallback preference,
- checkpoint forecasting,
- and readiness calibration.

## One-line conclusion
Good source planning does not ask:
- what can we connect?

It asks:
- what filing truth is currently missing,
- which source reduces that risk best,
- what checkpoint is required next,
- and how can the agent keep the workflow moving with the least user burden?

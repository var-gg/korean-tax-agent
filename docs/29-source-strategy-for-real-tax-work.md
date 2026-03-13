# Source Strategy for Real Tax Work

- Status: active
- Doc role: canonical
- Locale: en
- Parent: [README.md](./README.md)
- Related:
  - [17-data-collection-strategy.md](./17-data-collection-strategy.md)
  - [18-source-feasibility-matrix.md](./18-source-feasibility-matrix.md)
  - [25-korean-comprehensive-income-tax-data-research.md](./25-korean-comprehensive-income-tax-data-research.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
  - [28-three-party-happy-path.md](./28-three-party-happy-path.md)
- Next recommended reading:
  - [28-three-party-happy-path.md](./28-three-party-happy-path.md)
  - [26-domain-model-gap-analysis.md](./26-domain-model-gap-analysis.md)

## Objective
Clarify what the system is actually trying to collect in a real Korean comprehensive income tax workflow,
where those materials are likely to come from,
and how the user, agent, and MCP should interact during source planning.

This document exists because a realistic filing workflow can become confused if the product talks about:
- connectors,
- browser flows,
- source sync,
- and MCP tools,
without first stating the domain truth:
**what filing inputs actually matter, which of them are anchor inputs, and which of them are optional enrichment.**

## Core claim
V1 should not be framed as:
- universal financial API aggregation,
- a live integration with every major Korean financial institution,
- or a system that becomes submission-ready from transaction feeds alone.

V1 should be framed as:
- a checkpoint-driven tax workflow,
- anchored first in official tax materials and withholding/prepaid tax facts,
- then expanded only where additional evidence or reconciliation is materially needed.

## One-line product truth
The system is not trying to know everything.
It is trying to know **enough of the right things** to move a filing workspace from:
- not ready,
- to estimate-ready,
- to draft-ready,
- to submission-assist-ready,
without bluffing.

## What real tax work actually needs
A Korean comprehensive income tax workflow does not begin with “collect all financial data.”
It begins with: **what inputs are materially required for a responsible filing path?**

Those inputs fall into five major domains.

### 1. Filing-path and taxpayer facts
Examples:
- filing year
- taxpayer posture
- mixed-income vs freelancer vs sole-proprietor clues
- whether business expenses are expected
- whether deduction-sensitive facts are likely needed

Why this is first:
The system cannot choose good sources until it has a rough idea of what kind of filing case it is looking at.

### 2. Income facts
Examples:
- which income streams exist
- which payer/source clues exist
- whether a stream appears in official tax materials already
- whether a stream is only visible in external records

Why this matters:
A filing cannot be responsibly prepared if the system does not know whether major income is missing.

### 3. Withholding / prepaid tax facts
Examples:
- service-income withholding
- salary-related withholding
- any official statement showing prepaid or already-reported tax
- local tax components where relevant

Why this is critical:
A refund estimate or tax-due estimate is not trustworthy if the workflow does not know what tax was already withheld or prepaid.

### 4. Expense and evidence facts
Examples:
- claimable expense candidates
- receipts, invoices, card statements, bank exports
- evidence linkage to material expense items
- mixed-use explanation where needed

Why this matters:
Expenses often live outside official tax systems.
But the system should gather them progressively rather than demanding every receipt up front.

### 5. Deduction / credit facts
Examples:
- taxpayer-specific facts that do not naturally appear in payment feeds
- eligibility-related facts
- supporting documents for categories that require them

Why this matters:
Transaction history alone is not the full filing truth.
Some parts of the filing always require user facts or explicit evidence capture.

## Anchor inputs vs enrichment inputs
The most important source-strategy distinction is not API vs browser.
It is:
- which inputs are **anchors**,
- and which inputs are **enrichment**.

### Anchor inputs
Anchor inputs are the minimum inputs that strongly shape filing truth.
These are the first things V1 should seek.

#### A. HomeTax / official tax materials
Typical value:
- filing context
- visible official values
- withholding-related statements where available
- official filing documents
- submission path

Why this is an anchor:
HomeTax is often the strongest available source of official filing context and official numbers.
It is not the whole truth, but it is often the best first source.

#### B. Withholding / prepaid tax records
Typical value:
- tax already withheld
- payer-linked tax statements
- prepayment clues

Why this is an anchor:
If withholding is missing, the system may still produce a rough estimate, but it should be very cautious about claiming draft or submission readiness.

#### C. Minimum taxpayer facts
Typical value:
- filing posture
- support tier assessment
- key deduction-sensitive facts

Why this is an anchor:
Without these facts, source planning becomes too blind and review burden shifts too late.

### Enrichment inputs
Enrichment inputs increase confidence, improve reconciliation, or expand evidence coverage.
They matter a lot, but not always at the first moment.

#### D. Bank transaction history
Typical value:
- inflow/outflow tracing
- reconciliation
- income or expense clue expansion

Typical role:
- useful for finding missing flows,
- useful for checking coverage,
- not automatically the first required source.

#### E. Card transaction history
Typical value:
- expense evidence
- merchant-level detail
- recurring business spending clues

Typical role:
- often helpful for expense support,
- but usually secondary to official records and explicit withholding materials.

#### F. Local folders / exported statements / uploaded evidence bundles
Typical value:
- receipts and invoices
- saved PDF statements
- statement exports
- ad hoc business evidence

Typical role:
- critical once a coverage gap is found,
- but should be requested narrowly.

#### G. Brokerages / platforms / other external sources
Typical value:
- income statements
- realized gain/loss records
- dividend/withholding documents

Typical role:
- important in relevant cases,
- but often case-specific rather than universal first-step sources.

## What this means for v1
V1 should not imply:
- “connect every bank first”
- “full transaction ingestion is the foundation of all filing readiness”
- “major financial APIs must be deeply integrated before the product is useful”

Instead, V1 should imply:
- start from official and filing-shaping inputs,
- then expand only where meaningful evidence or reconciliation is missing,
- and keep readiness claims proportional to actual source coverage.

## Practical source strategy by readiness level

### Estimate-ready
The system may reach estimate-ready with:
- basic taxpayer posture
- at least rough income identification
- at least partial withholding/prepaid tax visibility
- a rough expense basis or explicit assumptions

What may still be missing:
- complete evidence coverage
- complete deduction facts
- full submission comparison readiness

Interpretation:
Estimate-ready is useful, but still fragile.
It should not be described as filing-ready.

### Draft-ready
The system should usually require:
- filing posture captured with reasonable confidence
- major income streams identified
- withholding/prepaid tax materially covered
- meaningful expense candidates either evidenced or explicitly under review
- key deduction-related facts captured or explicitly marked missing

Interpretation:
This is the first level where a serious filing draft becomes believable.
A draft without withholding truth should usually be treated cautiously.

### Submission-assist-ready
The system should usually require:
- no likely material income omission
- no likely material withholding/prepaid tax omission
- major expenses either supported, reviewed, or consciously excluded
- high-severity review items resolved or explicitly accepted
- enough section/field preparation to compare draft values against visible HomeTax values

Interpretation:
Submission-assist-ready means:
- the workflow can responsibly guide the user into HomeTax assistance,
- not that the system has universal certainty,
- and not that bank/card integrations were necessarily exhaustive.

## Should the project pre-analyze every major Korean financial API?
No, not as a prerequisite for product truth.

That analysis is useful,
but it should be layered.

### Layer 1. Source-family truth
The product must first understand:
- what kinds of sources exist,
- what kinds of filing inputs they can provide,
- what collection mode is realistic for each,
- and whether a source is anchor or enrichment.

This is required now.

### Layer 2. Provider-specific feasibility
The product can then learn:
- which banks export cleanly,
- which card issuers have predictable statement paths,
- which brokerages are practical to support,
- where browser assist is realistic,
- and where provider policies make direct connectors unrealistic.

This should evolve over time.
It is not the same thing as the core source strategy.

## What MCP is actually for in this model
MCP is not just a raw wrapper over external APIs.
Its more important role is to transform partial, messy, real-world collection progress into structured workflow state.

### MCP should answer questions like:
- what source should we go after next?
- why is this source worth collecting?
- what user checkpoint is required?
- what was collected successfully?
- what filing domain is still missing?
- what level of readiness is honest right now?

### MCP should return things like:
- source recommendations
- checkpoint state
- blocking reason
- pending user action
- coverage gaps
- withholding coverage status
- draft readiness state
- next recommended action

### In other words
MCP’s core value is not:
- “I know every institution’s live API.”

It is:
- “I can convert the current state of source discovery, collection, evidence, and tax interpretation into a structured workflow contract the agent can act on.”

## Three-party interaction during source planning

### User responsibility
The user provides:
- initial filing intent
- source access approval
- authentication when required
- high-value factual answers
- final judgments where tax treatment is ambiguous

The user should not be asked to manually orchestrate source order.

### Agent responsibility
The agent should:
- choose the next best source based on filing value,
- explain why it is asking,
- avoid broad file-dump requests,
- translate MCP state into clear user prompts,
- and keep the workflow moving between checkpoints.

### MCP responsibility
The MCP layer should:
- evaluate source priority,
- expose realistic collection modes,
- record checkpoints and sync attempts,
- represent what was collected,
- represent what remains materially missing,
- and return the next best workflow action.

## Example: how source planning should really feel

### User
> I want to prepare my 2025 filing.

### Agent
> I’ll start by figuring out the highest-value source.
> For a case like this, HomeTax is usually first because it can provide official filing materials and help anchor withholding information.

### MCP response shape
```json
{
  "ok": true,
  "status": "completed",
  "data": {
    "recommendedSources": [
      {
        "sourceType": "hometax",
        "priority": 1,
        "role": "anchor",
        "expectedValue": "high",
        "supports": [
          "official_filing_context",
          "withholding_clues",
          "submission_path"
        ]
      },
      {
        "sourceType": "local_evidence_folder",
        "priority": 2,
        "role": "enrichment",
        "expectedValue": "medium",
        "supports": [
          "expense_evidence"
        ]
      }
    ],
    "readinessRisk": {
      "missingDomains": [
        "official_materials",
        "withholding_visibility"
      ]
    }
  },
  "nextRecommendedAction": "tax.sources.connect"
}
```

### Why this matters
This kind of answer is more valuable than a generic connector list.
It tells the agent:
- why HomeTax is first,
- what filing domain it is expected to improve,
- and what remains risky if it is skipped.

## What the document implies for browser/UI responsibility
The MCP layer can say:
- which flow should be opened,
- which checkpoint is active,
- and what user action is needed.

The agent can say:
- what the user should expect,
- which visible browser step is happening,
- and what will happen next.

The actual visible browser flow may be implemented by:
- a browser-assist package,
- a controlled browser automation layer,
- or another operator-visible execution surface.

This means the source strategy should not be blocked on deciding every UI primitive first.
But it should require that browser-mediated checkpoints are first-class in the workflow model.

## Product implications

### 1. HomeTax-first is usually right, but not absolute
HomeTax is often the best first anchor.
But the system should still be able to say when another source is first because the filing posture demands it.

### 2. Withholding truth is not optional for trustworthy readiness
A product that only sees inflows and outflows may still estimate something,
but it should be cautious about calling that draft-ready or submission-assist-ready.

### 3. Bank/card integrations are valuable, but not the product foundation by themselves
They are best understood as reconciliation and evidence sources unless the filing path makes them primary.

### 4. The workflow must support partial truth honestly
The product should be able to say:
- we have official materials but weak expense coverage,
- or we have expense evidence but weak withholding visibility,
- or we have an estimate but not enough for submission assist.

### 5. MCP should encode learned operational knowledge
As the team learns:
- which sources are realistic,
- which blockers are common,
- which fallbacks work,
that knowledge should be reflected in MCP tool responses and source-planning logic.

This is how real-world “headbanging knowledge” becomes product behavior.

## One-line conclusion
A realistic Korean tax source strategy is not:
- ingest every account first,
- trust transaction feeds alone,
- and call it filing-ready.

It is:
- start from official and withholding-shaping inputs,
- collect additional evidence only where it materially improves filing truth,
- and use MCP to turn messy source reality into structured workflow decisions the agent can explain and act on.

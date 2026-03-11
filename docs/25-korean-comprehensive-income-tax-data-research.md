# Korean Comprehensive Income Tax Data Research

## Purpose
Make the real filing domain less of a black box.

This document translates the product idea into a practical question:
**what data must exist, from which sources, with what confidence, before the system can help a Korean comprehensive income tax filer estimate outcomes and prepare a filing draft responsibly?**

This is an implementation-facing domain research note.
It is not legal advice and it does not claim full coverage of every taxpayer subtype.
Its purpose is to define the minimum product-facing data model for a realistic v1 workflow.

## Scope of this document
This document focuses on:
- taxpayer situations likely relevant to early product scope
- the difference between "draft calculation", "refund/tax estimate", and "submission-ready preparation"
- the practical source map for the required data
- which data can often come from HomeTax versus which data usually must come from outside HomeTax
- which missing items are blockers versus review items versus tolerable uncertainty

This document does **not** attempt to:
- replace certified tax advice
- finalize every Korean tax rule edge case
- guarantee filing correctness from incomplete evidence
- fully specify every tax form or every deduction regime

## Why this matters
The current repo already models a good workflow skeleton:
- source connection
- sync checkpoints
- review queue
- draft computation
- HomeTax assist readiness

But a workflow engine is only as good as its domain inputs.
If the system does not know which source data is actually required for real Korean comprehensive income tax preparation, then even a polished runtime can still become a black box.

This document is meant to reduce that risk.

## Working assumptions for v1
For early product scope, assume the first realistic user segments are:
1. freelancer / independent contractor with business income and possible 3.3% withholding
2. sole proprietor with business income and deductible expenses
3. mixed-income individual with salary plus side income
4. narrow additional cases where documents are available but some interpretation remains manual

The project should **not** assume support for every taxpayer profile from day one.

## Core domain question
For one filing year, the system must be able to determine at least the following:
1. what kinds of income exist
2. how much income is attributable to each relevant category
3. what tax already appears withheld or prepaid
4. what expenses or cost items are claimable or potentially claimable
5. which deductions/credits require taxpayer facts beyond transaction history
6. which items remain uncertain enough that a user review checkpoint is mandatory

## Three levels of readiness
The product should distinguish clearly between three states that are often mixed together.

### 1. Estimate-ready
The system can produce a rough tax/refund estimate when:
- major income streams are identified
- major withholding/prepaid tax is identified or reasonably imported
- at least a rough expense basis exists
- major unknowns are explicitly labeled as assumptions

This is useful for:
- early expectation setting
- prioritizing missing data collection
- deciding whether it is worth continuing

This is **not** enough for submission.

### 2. Draft-ready
The system can produce a meaningful filing draft when:
- income categories are mapped with enough confidence
- withholding/prepaid tax inputs are materially complete
- expense treatment is either supported by evidence, accepted by rule path, or escalated for review
- key taxpayer facts required for deductions are captured or marked unavailable
- unresolved material ambiguities are visible in a review queue

This supports:
- a draft summary
- refund/tax due estimate with narrower range
- HomeTax preparation mapping

### 3. Submission-ready
The system can responsibly guide HomeTax preparation when:
- material income omissions are unlikely
- material withholding/prepaid tax omissions are unlikely
- major expense and deduction items are either confirmed or explicitly user-approved as assumptions
- unresolved high-severity review items are cleared or accepted with visible risk
- the user has a final opportunity to compare draft totals with visible HomeTax values

This still does not mean silent autonomous filing.
It means the workflow is mature enough for assisted preparation.

## Taxpayer situations to support first

### A. Freelancer / independent contractor (often 3.3% withholding)
Typical signals:
- service income from clients
- some payments may already have withholding reflected in official records
- expenses often live outside official tax systems

High-value data:
- payment / income records
- withholding or payment statement documents
- business expense evidence
- business-use explanations for mixed-use spending

Main risk:
- income may be partly visible in official records while deductible expenses are not

### B. Sole proprietor
Typical signals:
- recurring sales/income
- business bank/card usage
- receipts, statements, invoices, and bookkeeping fragments

High-value data:
- gross receipts / revenue
- expense evidence
- asset or equipment purchases that may need different treatment
- business profile facts affecting expense interpretation

Main risk:
- business expense treatment is not reliably inferable from transaction feeds alone

### C. Mixed-income individual (salary + side income)
Typical signals:
- salary information may already be partly represented via official records
- side income requires additional collection and review
- deductions may depend on personal/family facts

High-value data:
- salary-related official records
- side-income evidence and classification
- withholding/prepaid tax across all streams
- deduction/credit eligibility facts

Main risk:
- users may assume official prefill covers everything when side income or side expenses are still missing

## Data domains that matter
The workflow should explicitly model the following domains.

### 1. Taxpayer profile facts
Examples:
- taxpayer type
- residency status
- business registration status
- filing year
- industry or work-type hint
- whether side income exists in addition to salary
- whether the user expects business expenses to be claimed

Why it matters:
- this determines source strategy
- this shapes classification rules and review prompts
- this affects what counts as a blocker versus a tolerable unknown

### 2. Income domain
Examples:
- business/service income
- salary-related income for mixed-income users
- other reported income types that affect the filing draft
- per-source income documents and transaction evidence

What the system needs:
- income amount
- period or occurrence date
- likely category
- source of record
- whether it is already represented in official materials
- linked evidence

### 3. Withholding / prepaid tax domain
Examples:
- client-side withholding on service payments
- already-paid or reported tax that can offset final liability
- official statements that show withholding or prepayment

Why this is critical:
A refund estimate is impossible to trust if withheld/prepaid tax is missing.

The system must treat this as a first-class domain, not a side note.

### 4. Expense domain
Examples:
- recurring business expenses
- equipment or asset purchases
- software, subscriptions, communications, travel, supplies, outsourced services
- mixed-use expenses needing human judgment

What the system needs:
- amount and date
- merchant/counterparty clue
- likely tax treatment
- evidence attachment state
- whether the item is ordinary expense, ambiguous, or potentially non-current / special handling

### 5. Deductions / credits domain
Examples:
- items that depend on taxpayer-specific facts rather than payment feeds alone
- reliefs requiring additional eligibility information or supporting documents

Design implication:
The system should not pretend transaction ingestion alone is enough.
There must be a structured place for:
- taxpayer-entered facts
- deduction eligibility facts
- required supporting evidence
- unsupported deduction categories explicitly marked out-of-scope

### 6. Submission comparison domain
Before assisted HomeTax preparation, the system should be able to compare:
- draft totals produced by the workflow
- visible totals or sections shown in HomeTax
- known mismatches requiring review

This comparison layer is necessary for trust.

## Source map: where the data usually comes from

### HomeTax / official tax portal materials
Usually highest-value for:
- official filing context
- visible prefilled values where available
- withholding or statement-type documents
- downloadable materials relevant to the filing year
- final assisted submission path

Usually weaker for:
- full real-world business expense evidence
- mixed-use explanations
- messy local receipts outside official systems
- nuanced operational business context

Product implication:
HomeTax is the anchor source, but not the whole filing truth.

### Bank exports / account history
Useful for:
- tracing inflows and outflows
- discovering income events not already normalized
- cross-checking timing and counterparty clues
- supporting expense reconstruction

Weaknesses:
- payment memo quality may be poor
- tax category meaning is rarely explicit
- withholding information may not be reliably present

### Card exports / statements
Useful for:
- expense candidate discovery
- merchant-level descriptions
- recurring business spending patterns

Weaknesses:
- weak evidence by itself for some categories
- mixed personal/business use is common
- merchant descriptions are not tax treatment decisions

### Receipts / invoices / statements / uploaded PDFs
Useful for:
- evidence strengthening
- documenting claimable expenses
- recovering context absent from bank/card rows
- supporting review resolution

Weaknesses:
- OCR / parsing variance
- duplicates
- inconsistent formats

### User-entered facts
Useful for:
- taxpayer type determination
- business purpose explanations
- deduction eligibility facts
- missing official details
- policy choices where the system must not guess

Weaknesses:
- user uncertainty
- friction if too many questions are asked

## Minimal data needed by outcome type

## A. Minimal data for a rough refund/tax estimate
The system should have at least:
- preliminary taxpayer type
- materially important income streams
- materially important withholding/prepaid tax figures if any
- rough expense basis or explicit statement that expenses are not yet included
- explicit list of assumptions and missing data

Without these, the estimate should be labeled unreliable or withheld.

## B. Minimal data for a filing draft
The system should have at least:
- categorized income records
- withholding/prepaid tax records or official statement values
- expense candidates processed through evidence/risk logic
- review queue for ambiguous high-impact items
- core taxpayer facts needed to choose the right filing path

## C. Minimal data for HomeTax assist readiness
The system should have at least:
- a current draft version
- unresolved blocker count below threshold
- section mapping for values expected in HomeTax
- known manual fields list
- visible mismatch policy for draft-vs-portal comparison

## Blockers vs review items vs tolerable uncertainty
The workflow needs stricter vocabulary than "missing data".

### Hard blockers
These should generally stop draft progression or HomeTax assist readiness.
Examples:
- taxpayer type or filing posture still unclear
- major income stream likely missing
- withholding/prepaid tax likely missing for a material income stream
- draft section cannot be computed because required source facts are absent
- required final review or approval not completed

### Review items
These should not always stop all progress, but they must remain visible.
Examples:
- mixed-use expense classification
- duplicate candidate ambiguity
- equipment-like purchase needing user judgment
- unsupported but material deduction interpretation

### Tolerable uncertainty
These may allow estimate/draft continuation when clearly labeled.
Examples:
- low-value uncategorized expenses
- weak merchant labeling for immaterial amounts
- optional evidence that does not materially change liability

## Product guidance: what the system should never fake
The system should not present confidence it does not have.
It should never imply that all necessary filing data is present merely because:
- HomeTax login succeeded
- some official documents were imported
- a draft number was computed

Instead it should explicitly communicate:
- what is confirmed from official materials
- what is inferred from non-official sources
- what is user-asserted
- what remains estimated
- what still blocks trustworthy refund/tax estimation

## Implications for the data model
The current codebase should evolve toward explicit support for the following concepts.

### First-class domain entities or fields
The product likely needs stronger modeling for:
- taxpayer facts required for filing-path determination
- withholding/prepaid tax records as a first-class category, not just generic transactions
- deduction/credit eligibility facts and supporting evidence requirements
- estimate confidence and draft confidence
- source-of-truth provenance per computed value
- materiality / severity thresholds tied to filing impact

### Provenance and confidence
For any number that influences the draft or refund estimate, the system should be able to answer:
- where did this come from?
- is it official, imported, inferred, or user-entered?
- what evidence supports it?
- is this final, review-required, or estimated?

### Comparison-ready outputs
Before HomeTax assist, draft outputs should be prepared in a way that supports:
- section-level mapping
- manual-entry checklists
- mismatch logging against visible portal values

## Recommended v1 prioritization
If the team must choose what to model first, prioritize:
1. taxpayer type and filing posture facts
2. income classification with provenance
3. withholding/prepaid tax capture
4. expense evidence and ambiguity handling
5. draft confidence / blocker model
6. HomeTax comparison-ready section mapping

## Recommended next research tasks
This document is still a first-pass domain map.
The next research pass should validate or refine:
1. which official HomeTax materials most reliably expose withholding/prepaid tax information for early target users
2. which taxpayer segments are realistic for v1 support versus explicit out-of-scope
3. which deduction/credit categories are worth first-class support in v1
4. where rough estimate thresholds should stop and ask for more evidence
5. which business-expense categories create the most frequent user review burden

## Bottom line
The workflow architecture is already becoming solid.
The next maturity step is making the domain inputs equally explicit.

The system should not be framed as "collect some files and let the AI figure it out."
It should be framed as:
- collect official materials first,
- collect missing real-world evidence second,
- separate confirmed values from inferred values,
- ask the user only for material judgment calls,
- and advance to HomeTax assistance only when the draft is honest about what it knows and what it does not know.

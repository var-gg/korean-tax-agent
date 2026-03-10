# Source Feasibility Matrix

## Purpose
Document realistic collection paths for major source categories before implementation commits to specific connectors.

This file is intentionally qualitative.
It should help product and engineering decide what belongs in v1, what needs live validation, and what should remain a fallback path.

## Feasibility labels
- **v1-design**: must be reflected in architecture and tool contracts now
- **v1-prototype**: worth implementing in an early prototype if validation is promising
- **later**: important, but should not shape early execution too heavily
- **fallback-only**: support as a backup path, not a primary product identity

## 1. HomeTax portal
Target data:
- taxpayer-visible filing materials
- downloadable tax documents
- filing status and prefilled inputs where available
- final submission path

Best collection path:
- browser-assisted collection
- export-ingestion when the portal offers downloadable artifacts

Likely blockers:
- login and identity checks
- UI changes
- intermittent anti-automation friction
- unclear document naming or varying paths by taxpayer type

Required user action:
- authentication
- explicit approval at major checkpoints
- final submission approval

Assessment:
- **v1-design** and **v1-prototype**
- this is the most important real-world source to validate early

## 2. Bank transaction history
Target data:
- deposits and withdrawals relevant to income tracing and expense evidence
- transfer memos and counterparty clues

Best collection path:
- export-ingestion first
- browser-assisted collection if practical
- direct connector only if stable and allowed

Likely blockers:
- institution-specific login friction
- OTP or secondary verification
- inconsistent export formats

Required user action:
- login or export confirmation

Assessment:
- **v1-design**
- **v1-prototype** only for a narrow initial set or generic export workflows

## 3. Card transaction history
Target data:
- expense records
- merchant descriptions
- timestamps and amounts

Best collection path:
- export-ingestion first
- browser-assisted collection where statement retrieval is predictable

Likely blockers:
- limited metadata quality
- anti-bot friction
- inconsistent statement structures across issuers

Required user action:
- login and export confirmation when needed

Assessment:
- **v1-design**
- implementation should begin from generic statement ingestion rather than many issuer-specific connectors

## 4. Brokerage / securities accounts
Target data:
- realized gains/losses where relevant
- dividend and withholding records
- account statements

Best collection path:
- export-ingestion first
- browser-assisted retrieval if statements are accessible after login

Likely blockers:
- product complexity
- varying tax treatment by asset type
- institution-specific export idiosyncrasies

Required user action:
- login
- possible statement export confirmation

Assessment:
- **v1-design**
- likely **later** for rich automation beyond import/ingestion support

## 5. Local file system and operator-approved folders
Target data:
- receipts
- invoices
- PDF statements
- screenshots and ad hoc evidence

Best collection path:
- local-access ingestion with explicit scope
- targeted scan based on missing evidence rather than full indiscriminate crawling

Likely blockers:
- messy filenames
- duplicates
- weak metadata

Required user action:
- initial access approval
- occasional clarification if evidence is ambiguous

Assessment:
- **v1-design** and **v1-prototype**
- high practical value with relatively low integration risk

## 6. Cloud drives
Target data:
- synced receipts, invoices, and exported tax materials

Best collection path:
- connector-based retrieval where practical
- otherwise local synced-folder access

Likely blockers:
- provider policy constraints
- permission scoping complexity
- noisy irrelevant files

Required user action:
- source access consent
- login when direct connector is used

Assessment:
- **v1-design**
- direct connectors may be **later** depending on practical validation

## 7. Email attachments
Target data:
- invoices
- card statements
- brokerage notices
- tax authority notifications

Best collection path:
- connector-based targeted retrieval
- or user-approved export/search workflows

Likely blockers:
- broad privacy scope
- weak sender/document consistency
- attachment parsing variance

Required user action:
- explicit narrow scope consent
- possible login or mailbox approval

Assessment:
- **later** for direct integration
- valuable, but privacy and noise make this a poor first connector surface

## 8. Messaging-delivered receipts or statements
Target data:
- ad hoc evidence sent by merchants or platforms

Best collection path:
- targeted user-approved retrieval or local export ingestion

Likely blockers:
- platform constraints
- privacy risk
- poor structure

Required user action:
- explicit access approval

Assessment:
- **fallback-only** in early stages

## 9. User-entered taxpayer facts
Target data:
- taxpayer type
- residency and filing context
- business-use explanations
- unsupported edge-case clarifications

Best collection path:
- targeted fact capture in conversation

Likely blockers:
- user uncertainty
- over-questioning fatigue

Required user action:
- answer focused prompts

Assessment:
- **v1-design** and **v1-prototype**
- this is unavoidable and should be structured well

## Strategy conclusion
The early product should optimize for:
- HomeTax browser-mediated collection
- export-ingestion pipelines for financial records
- local evidence ingestion
- targeted conversational fact capture

The early product should avoid depending on:
- broad direct live integrations across many Korean institutions
- full API coverage assumptions
- noisy high-privacy connectors before the core workflow proves value

## Validation backlog
Questions that require real-world testing:
- which HomeTax material flows are stable enough for browser assistance
- which financial institutions allow practical export-driven workflows
- which provider login paths create unacceptable friction
- how often exported documents contain enough metadata for confident normalization
- which evidence sources add real draft quality improvement versus noise

# Risk and Compliance

## Key risks
- incorrect classification of mixed-use or ambiguous expenses
- incomplete source coverage leading to missing income or deductions
- brittle browser automation around HomeTax UI changes
- unsafe handling of taxpayer identity and financial data
- user over-trust in agent output without review

## Required safeguards
- explicit consent before source connection or sensitive data access
- visible review queue for low-confidence and high-impact items
- final approval gate before submission
- audit trail for classifications, overrides, and export steps
- local-first or encrypted-at-rest storage for sensitive artifacts

## Positioning
This project is a tax workflow assistant, not a silent tax proxy.

## Compliance posture questions to refine later
- which data classes require stronger encryption or segregation
- which source connectors may create legal/commercial constraints
- what disclaimers are appropriate per distribution model
- what records must be preserved for user verification and later amendment

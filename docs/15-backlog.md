# Backlog

## Product
- define supported taxpayer profiles for v1 more precisely
- define minimum filing success criteria
- define explicit stop conditions before submission
- define readiness downgrade rules after refresh or new evidence
- define support-tier examples for Tier A / B / C paths

## State and contracts
- define filing-path detection contract
- define readiness-level fields across workspace, draft, and assist session
- define HomeTax comparison-state payloads
- define official-data refresh / diff / recompute flow

## Connectors
- evaluate HomeTax data import options
- evaluate CSV-first bank/card strategy
- evaluate email receipt ingestion patterns

## Core logic
- draft canonical schema in code
- define confidence scoring for classification
- define duplicate detection strategy

## Browser assist
- map HomeTax screens and checkpoints
- define retry and pause behavior
- define mismatch reporting format

## Open questions
- how much of deduction handling belongs in v1
- what distribution/setup path is simplest for agent users
- what legal/disclaimer language should ship in repo docs

## MCP boundary / contract alignment
- close runtime/facade exposure gap for `tax.sources.plan_collection`
- decide whether `tax.setup.inspect_environment` and `tax.setup.init_config` should be implemented now or temporarily removed from exported contracts
- add an implemented-tool matrix check across docs, contracts, and runtime/facade
- keep import contracts ref-based and extraction-result-based rather than path-based or OCR-execution-based

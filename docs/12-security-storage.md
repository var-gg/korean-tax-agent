# Security and Storage

## Baseline approach
- prefer local-first storage
- isolate sensitive taxpayer data from public repo materials
- encrypt sensitive fields or files at rest where feasible
- keep auth/session artifacts out of version control

## Storage classes

### Public repo content
- docs
- examples with synthetic data
- templates
- code

### Private runtime content
- imported tax records
- extracted receipts
- authentication artifacts
- filing outputs containing taxpayer identity
- audit logs tied to real user records

## Operational rule
No real taxpayer data should be committed to the public repository.

## Future design questions
- secret management approach
- local DB choice and encryption strategy
- retention window for filing artifacts
- redaction/export rules for debugging

# V1 PRD

- Status: active
- Canonical: English
- Korean companion: [16-v1-prd.ko.md](./16-v1-prd.ko.md)
- Parent: [README.md](./README.md)
- Related:
  - [00-overview.md](./00-overview.md)
  - [21-first-agentic-scenario.md](./21-first-agentic-scenario.md)
  - [25-korean-comprehensive-income-tax-data-research.md](./25-korean-comprehensive-income-tax-data-research.md)
  - [27-v1-supported-paths-and-stop-conditions.md](./27-v1-supported-paths-and-stop-conditions.md)
- Next recommended reading:
  - [18-source-feasibility-matrix.md](./18-source-feasibility-matrix.md)
  - [20-workspace-state-model.md](./20-workspace-state-model.md)


## 1. Product
Korean Tax Agent is an open-source, agent-native workflow for Korean comprehensive income tax preparation.

V1 focuses on helping an AI-capable user:
- collect relevant tax materials,
- normalize and classify them,
- review ambiguous items efficiently,
- generate a filing-ready draft,
- optionally complete HomeTax-adjacent entry work with visible browser assistance.

## 2. Target user
Primary target user:
- a Korean comprehensive income tax filer,
- comfortable using AI agents and local/self-hosted tooling,
- willing to review important tax decisions,
- seeking major reduction in repetitive filing work rather than zero-responsibility automation.

Initial user archetypes:
- freelancer / contractor
- 1-person business operator
- mixed-income individual with side income
- early adopter who can tolerate setup complexity if the workflow saves time later

## 3. User problem
Today, comprehensive income tax filing is painful because users must:
- gather materials from many fragmented sources,
- manually organize transactions and evidence,
- repeatedly interpret ambiguous categories,
- navigate HomeTax with limited workflow support,
- maintain confidence that nothing important was silently missed.

## 4. V1 promise
V1 should let the user say:
- "I can get my tax materials into one workflow."
- "The agent handles the repetitive structuring work."
- "I only spend time on the items that actually matter."
- "I stay in control of risky decisions and final submission."

## 5. Core jobs to be done
1. Initialize a filing workspace for a given year.
2. Import or connect relevant source materials.
3. Normalize transactions and supporting evidence.
4. Classify likely tax treatment.
5. Surface only ambiguous / risky items for review.
6. Compute a draft summary.
7. Prepare HomeTax-ready mapping.
8. Assist browser entry with pause/resume checkpoints.

## 6. In scope for V1
- local/self-hosted usage posture
- document/file-based imports
- HomeTax material imports
- transaction normalization
- evidence linkage
- review queue for low-confidence / high-risk items
- filing draft generation
- visible HomeTax browser assistance
- explicit consent and audit trail model
- explicit support-boundary communication for supported vs limited vs out-of-scope filing paths
- readiness reporting that distinguishes estimate-ready, draft-ready, and submission-assist-ready states

## 7. Out of scope for V1
- silent end-to-end autonomous filing with no user checkpoints
- MyData-grade broad regulated integrations
- support for every Korean tax form/persona from day one
- replacing licensed professional tax advice
- direct promises of legal/compliance correctness across all edge cases
- multi-tenant SaaS operations platform
- pretending unsupported or manual-heavy filing paths are safely submission-ready

## 8. UX principles
1. **Review compression**
   - collapse many low-value steps into a few meaningful review moments.
2. **Visible control**
   - users should always understand when a sensitive step is happening.
3. **Traceability**
   - outputs should link back to source facts and review decisions.
4. **Checkpoint-driven automation**
   - automate aggressively between checkpoints, not across them invisibly.
5. **Local-first trust posture**
   - keep sensitive taxpayer data local where possible.

## 9. Success criteria
A V1 workflow is successful if a target user can:
- create a filing workspace,
- import representative documents/transactions,
- generate a draft summary,
- resolve a manageable review queue,
- understand whether the case is estimate-ready, draft-ready, or submission-assist-ready,
- reach a HomeTax-assist-ready state only when the supported-path conditions are actually met,
- complete assisted submission preparation without losing confidence in what happened.

## 10. Success metrics
Product-level success metrics for early validation:
- time-to-first-draft
- number of review items per 100 imported records
- percentage of records auto-classified above confidence threshold
- number of manual copy/paste steps removed from HomeTax workflow
- number of unresolved blockers before submission stage

## 11. Risks
Main V1 risks:
- HomeTax UI drift breaks browser assist reliability
- imported data quality varies widely across users
- tax classification ambiguity is higher than expected
- excessive consent prompts ruin usability
- insufficient consent prompts create user risk/trust problems

## 12. V1 deliverables
- docs-backed product spec
- core domain types
- MCP tool contract layer
- review queue model
- HomeTax assist state/checkpoint model
- minimal runnable prototype path

## 13. Release standard
Do not call V1 complete until:
- import -> normalize -> classify -> review -> draft flow is coherent,
- consent checkpoints are explicit,
- HomeTax-assist checkpoints are modeled,
- supported filing paths and stop conditions are documented clearly,
- the system distinguishes estimate-ready, draft-ready, and submission-assist-ready states,
- system outputs are auditable enough for user trust,
- documentation is sufficient for an early open-source adopter to understand the architecture.

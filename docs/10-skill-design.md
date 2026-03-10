# Skill Design

## Purpose
The skill should let an OpenClaw-compatible agent run the tax workflow with minimal ambiguity.

## Skill responsibilities
- identify when the repo skill is relevant
- enforce setup-before-filing flow
- ask for consent only when needed
- stop on unresolved high-risk items
- distinguish public product docs from private user data

## Resource split
- `SKILL.md`: compact workflow and trigger guidance
- `references/workflow.md`: end-to-end operating flow
- `references/safety-rules.md`: safety and consent gates
- `references/review-guidelines.md`: how to handle ambiguous items
- `references/connector-playbook.md`: source-specific handling notes

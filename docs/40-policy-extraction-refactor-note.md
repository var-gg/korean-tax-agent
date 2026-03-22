# 40 - Policy extraction refactor note

Status: pilot modularization complete
Intent: no behavior change (public contract preserved)

## What changed
The MCP server now has a `packages/mcp-server/src/policy/` directory with these extracted modules:
- `collection-policy.ts`
- `regime-policy.ts`
- `opportunity-policy.ts`
- `submission-policy.ts`

`tools.ts` and `runtime.ts` remain the public orchestration/dispatch surfaces, but they now delegate core policy decisions to the extracted modules.

## What did not change
- public tool names
- response envelope shape
- existing contract names used by external agents
- expected filing workflow semantics verified by the existing test suite

## Collection planning note
The prior `buildTierAFreelancerCollectionTasks` shape is now represented through a profile-aware collection resolver path. The current pilot profiles are:
- `it_freelancer`
- `double_entry_service`
- `generic_fallback`

This keeps today’s behavior stable while opening a path for future collection-profile branching without re-growing a single monolithic helper.

## Verification
- `npm run check`
- `npm test`

Both passed after extraction.

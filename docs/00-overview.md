# Overview

## Product definition

Korean Tax Agent is an open-source, agent-native workflow for people subject to Korean comprehensive income tax preparation who can operate AGENT AI tooling.

The project combines:
- setup guidance,
- consent-aware data collection,
- transaction normalization,
- tax review workflows,
- filing draft generation,
- optional HomeTax browser assistance.

## User promise

After checkout and setup, the agent should be able to guide the user through filing preparation while only asking for:
- explicit data access consent,
- required identity/authentication steps,
- clarification on ambiguous tax items,
- final approval before submission.

## Product shape

This is not just an MCP server.
It is a combined system made of:
- docs,
- skill instructions,
- MCP tools,
- browser-assist flows,
- templates and examples.

The product itself is intentionally **Korea-specific**.
It is centered on Korean comprehensive income tax workflow and HomeTax-adjacent assistance.

However, some workflow building blocks are intentionally shaped so they can be reused elsewhere, including:
- consent checkpoints,
- review queues,
- resumable sync flows,
- workspace state models,
- audit trails.

That does **not** mean this project is trying to become a universal all-countries tax engine.
The reusable layer is meant to stay narrow and workflow-oriented.

## Primary value

- reduce repetitive tax prep work
- reduce missed evidence and missing documents
- make ambiguous items reviewable instead of hidden
- give agent users a practical filing workflow they can self-host and inspect

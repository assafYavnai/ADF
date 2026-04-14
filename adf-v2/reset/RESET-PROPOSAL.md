# ADF v2 Reset Proposal

Status: approved proposal captured in repo truth
Purpose: preserve the approved reset direction, the reason for the change, and the ordered path forward

## Proposal summary

ADF v2 should be reset from the top down.

That means:
1. rewrite top truth first
2. classify legacy/v1 carry-over deliberately
3. isolate/archive legacy from active truth
4. only then run destructive cleanup/reset work

## Why this proposal exists

The currently visible repo truth is misleading for v2.

Main problems:
- `main` still exposes older architecture and runtime/tooling surfaces that can be mistaken for active v2 truth
- older docs still project a different system model than the newly approved startup ontology
- branch experiments and legacy/reference code are too easy to confuse with the approved restart direction
- context is too easy to lose between sessions and agents if it lives only in chat

## Current approved reset framing

- v2 is a clean restart
- v1/legacy code is reference-only unless explicitly carried over
- active top-level startup ontology is CEO / CTO / DEV
- current CTO code on branch is exploratory validation, not mainline truth
- MCP Brain is a likely carry-over substrate
- LangGraph is a probable carry-over candidate

## Current state overview

At the time this proposal was written:
- repo `main` still contains older truth surfaces that can mislead new sessions/agents
- an earlier `adf-v2/00-mission-foundation/` scaffold exists but is not being treated as the active reset control pack
- the newly approved reset control pack is now `adf-v2/reset/`

## Change objective

The change is not just to clean files.
The change is to make the repo itself carry the active v2 truth so:
- drift stops
- new agents can resume reliably
- future cleanup is grounded in explicit decisions
- legacy does not masquerade as active architecture

## Immediate consequence

No destructive cleanup should start before:
- top truth is rewritten
- carry-over is classified
- reset context and progress rules are living in repo truth

## Success condition for this proposal

This proposal has succeeded when:
- the reset control pack is the first place new sessions start
- the top v2 truth is written clearly
- legacy carry-over is explicit instead of inferred
- archive/delete work can proceed without ambiguity

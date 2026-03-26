# Problem Statement and Evidence

## Main problem
The front-end COO agent drifts.

The issue is not just specialist routing.
The issue is that over time the COO itself:
- stops adhering to CEO instructions
- stops adhering to its own rules
- forgets or inconsistently applies governance
- becomes apologetic after failure rather than systematically prevented from drifting

## Symptoms identified in discussion
From the conversation, we repeatedly identified these failure classes:

### 1. Rule drift
At the beginning the agent follows rules.
Later, especially after more rules are added or changed, it drifts and starts violating them.

### 2. Identity drift
The COO slowly behaves less like a COO and more like:
- a generic helper
- a direct implementor
- a debugger
- an apologizer
- an improviser

### 3. Bootstrap / startup drift
Bootstrap authority is split across multiple documents and surfaces.
The current startup behavior is too early, noisy, and not executive enough.

### 4. Tool-use drift
The system does not consistently route through existing tools.
Hardcoded tool lists are brittle and stale.

### 5. Context drift
Long conversations over-rely on raw conversational memory instead of authoritative externalized state.

### 6. Authority ambiguity
Normative authority and supporting evidence are not always cleanly separated.

## Evidence from our discussion
These are the strongest recurring conclusions from the chat:

- The current COO setup is too tied to specific providers and old bootstrap assumptions.
- `AGENTS.md` is too heavy and should become a thin router.
- Tool discovery should move away from hardcoded lists.
- The current front-end agent cannot simply be trusted to remember and obey rules forever.
- Long-running free-form chat context is too weak a control mechanism.
- If we want reliable behavior, governance must move into:
  - controller logic
  - contracts
  - schemas
  - authoritative state
  - validation gates
  - closeout routines

## Root cause
The root cause is not “the prompt is weak”.
The root cause is architectural:

- too much truth is expected to live in the running model session
- too little truth is externalized into enforceable artifacts
- rules are prose more than gates
- state reconstruction is too weak
- the system currently trusts the agent session too much

## Consequence
As long as this remains true, ADF will continue to drift no matter how many additional rules are written.

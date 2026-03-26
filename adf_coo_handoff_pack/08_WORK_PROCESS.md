# Work Process

## Agreed process
We explicitly agreed that the work process should be:

1. define the next layer here
2. send that layer to Codex for implementation
3. verify implementation with another agent
4. while implementation is underway, continue defining the next layer
5. only then move on

## Why this process
Because:
- the architecture is changing significantly
- long monolithic redesign attempts will drift
- verification should be independent
- we want small controlled slices
- we want context preserved through artifacts, not just through one session

## Implementation cadence
For each layer:

### Step A — Define
Define:
- scope
- contract
- expected outputs
- acceptance criteria
- verification expectations

### Step B — Implement
Send to Codex (or another implementor) with a clear bounded package.

### Step C — Verify
Use another agent to verify:
- implementation correctness
- contract adherence
- test coverage
- runtime behavior
- documentation/schema coherence

### Step D — Record
Update:
- decision board
- backlog
- learning / after-action if needed
- current state summary

## Important rule
Do not broaden scope mid-step.

If a step is:
- architecture
- controller
- tool migration
- role migration
then keep it that way.

## Current process priority
The current highest-level process direction is:

1. architecture / infrastructure first
2. component contracts
3. new ADF folder structure
4. environment / dependency verification
5. foundational tool migration
6. controller definition and implementation
7. COO role redefinition
8. bootstrap/framework migration

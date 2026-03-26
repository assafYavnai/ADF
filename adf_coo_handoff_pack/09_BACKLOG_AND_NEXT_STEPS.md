# Backlog and Next Steps

## Current top-level theme
Architecture / infrastructure first.

## Immediate architecture backlog

### B-001 — Finalize component contract model
Need a clear contract model for:
- controller
- tools
- roles
- councils
- MCP services
- adapters
- runtime artifacts
- audit / learning artifacts

Status: pending

### B-002 — Define new ADF folder structure
We agreed that once component contracts are clear, the new folder structure follows from that.

Status: pending

### B-003 — Verify infrastructure prerequisites
Need to define and verify foundational runtime prerequisites:
- Node.js
- TypeScript
- DB
- Brain API
- any other required runtime/build components

Status: pending

### B-004 — Define controller behavior in detail
We have the high-level flow only.
Need:
- turn-state schema
- classifier schema
- closeout schema
- controller artifact model
- validation gates

Status: pending

### B-005 — Migrate or wrap foundational tools
We explicitly said the first tools we likely need in the new architecture are:
- Tool Builder family
- agent-role-builder
and likely other foundational tools that need to fit the new TS-centered architecture direction

Status: in discussion

### B-006 — Rebuild COO role/package using the final process
This should happen after:
- Tech Council guidance
- role-builder alignment
- controller/control-plane architecture is clearer

Status: pending

### B-007 — Bootstrap / router redesign
Includes:
- thinner `AGENTS.md`
- new bootstrap flow
- executive summary at end of bootstrap
- context restoration path
- tool discovery / registry integration

Status: pending

## Tool / role state from our discussion

### Tech Council
Status:
- built
- upgraded to live roster-backed advisory execution
- usable now

### agent-role-builder
Status:
- built
- later fix requested to enforce true live roster participants instead of deterministic internal board

### COO
Status:
- discussed deeply
- architecture direction agreed
- not yet re-packaged through final agreed process

## Practical next-step options
These are the likely next definition items:

Option A:
- define component contract model first

Option B:
- define new ADF folder structure first

Option C:
- define controller artifacts/state model first

Based on the latest discussion, the best next step is probably:
**component contract model first**
because it drives folder structure and controller implementation shape.

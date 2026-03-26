# Decision Board

This file records the major architecture and process decisions made in the chat.

## Locked decisions

### D-001 — ADF architecture baseline
Locked.

ADF is moving forward with:

- **Controller runtime:** Node.js + TypeScript
- **Process orchestration:** `node:child_process`
- **Schemas / validation:** JSON Schema + Zod
- **PowerShell / shell:** only for leaf adapters and existing Windows-centric tools
- **Python:** allowed for specialist tools, not the controller

Status: **Locked**

---

### D-002 — Do not restart ADF from scratch
We are **not** creating a new ADF from zero.
We are migrating inside the codebase.

Status: **Locked**

---

### D-003 — Architecture / infrastructure first
Before deep workflow redesign, we first define:
- architecture
- component model
- contracts
- folder structure
- runtime prerequisites

Status: **Locked**

---

### D-004 — Work process is staged
Implementation happens step by step.

Pattern:
1. define the next layer here
2. send that layer to Codex for implementation
3. verify implementation with another agent
4. while implementation is underway, continue defining the next layer
5. only then move on

Status: **Locked**

---

### D-005 — COO remains the front end
The COO remains the user-facing entry point of ADF.

We are not replacing the COO with some other visible front-end.

Status: **Locked**

---

### D-006 — Controller is introduced as control plane
A controller layer will govern turn handling and state reconstruction.

The controller is not the COO identity.
The COO remains the front-end persona.
The controller governs how each turn is processed.

Status: **Locked (conceptually)**

---

### D-007 — Use model-based classification
For natural language prompts, a pure script is not enough.
Intent classification will require a model call in most cases.

Important nuance:
- controller = deterministic orchestrator
- classifier = short-lived model call
- COO = main reasoning worker
- specialists = bounded workers

Status: **Locked**

---

### D-008 — Thin `AGENTS.md`
`AGENTS.md` should become thin:
- repo router
- entrypoint pointer
- not the real bootstrap brain

Status: **Agreed, to be implemented**

---

### D-009 — End-of-bootstrap executive summary
Bootstrap should finish before speaking.
Then:
1. concise readiness status
2. current “what’s on our table”
3. invitation to the CEO

Status: **Agreed, to be implemented**

---

### D-010 — Tool discovery should move away from hardcoded lists
The tool inventory should come from a canonical discovery/registry mechanism, not hardcoded lists inside bootstrap docs.

Status: **Agreed, to be implemented**

---

### D-011 — Tech Council created first
Tech Council was prioritized because the COO/bootstrap redesign touches:
- framework authority
- startup/read-order
- shared command semantics
- cross-component surfaces

Status: **Implemented**
Note: later upgraded to live roster-backed execution.

---

### D-012 — Role creation should be standardized
We concluded that roles should be built by a dedicated role tool, not by ad-hoc writing.

Status: **Implemented as `agent-role-builder`**
Note: later we required live roster enforcement there as well.

---

### D-013 — Naming: `agent-role-builder`
Final agreed name for the role-building tool:
- durable tool name: `agent-role-builder`

Status: **Locked**

---

### D-014 — Slug-prefixed role artifact names
To avoid noisy generic file names, role package artifacts should use slug-prefixed names, e.g.:
- `<slug>-role.md`
- `<slug>-role-contract.json`
- `<slug>-decision-log.md`
- `<slug>-board-summary.md`
- `<slug>-pushback.json`

Status: **Locked**

---

### D-015 — 12-factor-agent-style discipline
We agreed to adopt 12-factor-style principles from day 1:
- own the prompt
- explicit state
- measured execution
- resumable flows
- strong contracts
- explicit artifact ownership

Status: **Locked as direction**

---

### D-016 — New component structures must be contract-based
Each building block in the new ADF must have a contract-defined structure.
Examples:
- tools
- MCP services
- controllers
- roles
- runtimes
- tests
- build artifacts
- runtime artifacts

Status: **Locked as direction**

## Current practical state
- Tool Builder family fixed and usable
- Tech Council built and upgraded
- agent-role-builder built, with later demand for true live roster enforcement
- COO redesign still conceptually defined but not yet re-packaged through the final agreed architecture-first sequence

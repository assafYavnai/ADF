# ADF v2 - Mission Foundation Handoff

Status: aligned working handoff
Location purpose: layer-global handoff for restarting or resuming mission-foundation work
Audience: next agent / architect / CEO review session

---

## Why This Document Exists

This file preserves the mission-foundation restart logic for ADF v2 in a way a new agent can use without reconstructing the earlier chat history.

This file is the canonical startup authority for the mission-foundation layer.
It should carry the 3-layer restart frame directly:
- broader work
- current task
- next step

Later-step detail and open items should also point back here rather than replacing this frame.

The core restart decision remains:

**ADF v2 should be built as a thinner architectural restart under `adf-v2/`, not as continued patching of legacy ADF as the source of truth.**

Legacy ADF remains useful as reference material, but v2 is the active architectural source of truth for this work.

For the explicit v1 pain statement and the rationale for the v2 fork, also read:
- `adf-v2/00-mission-foundation/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`

---

## Strategic Conclusions Already Taken

### 1. `adf-v2/` lives in the same repo

Reason:
- keep history and reference material close
- keep selective reuse possible
- avoid fragmenting truth across multiple repos too early

Constraint:
- same repo does not mean same architecture
- legacy ADF is reference only for v2
- `adf-v2/` is the source of truth for v2 intent

### 2. v2 starts thinner than the older company-style model

v2 should not restart from a broad simulated company structure.

It starts from a thinner software-delivery control model centered on:
- CEO
- CTO
- Scripts
- Agents
- Durable state

### 3. CEO stays high-level

The CEO should remain at:
- vision
- priorities
- approval at the right abstraction

The CEO should not have to operate:
- implementation route details
- review mechanics
- merge mechanics
- route repair
- cleanup or state recovery

### 4. CTO is the governing layer

The CTO:
- shapes requirements
- drives clarification
- freezes decisions correctly
- produces the implementation request package
- governs lower-layer execution
- certifies delivery upward truthfully

### 5. Scripts own governance truth

Scripts own:
- lifecycle truth
- control logic
- state transitions
- deterministic governance behavior

Agents do reasoning-based execution, but do not own lifecycle truth.

---

## Current Mission-Foundation State

The mission foundation is no longer at the stage of imagining `VISION.md` and `PHASE1.md` as future outputs.

The current authoritative foundation package already includes:
- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
- `adf-v2/00-mission-foundation/SYSTEM-OBLIGATIONS.md`
- `adf-v2/00-mission-foundation/BOXED-COMPONENT-MODEL.md`
- `adf-v2/CEO-AGENT-WORKING-PROTOCOL.md`
- `adf-v2/CTO-ROLE.md`
- `adf-v2/00-mission-foundation/CTO-CONTEXT-ARCHITECTURE.md`
- `adf-v2/00-mission-foundation/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`
- `adf-v2/00-mission-foundation/context/DECISIONS.md`

The main remaining draft artifacts in this layer are:
- `adf-v2/00-mission-foundation/context/artifacts/TRUST-MODEL.md`
- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`

This means the next session should continue from the existing mission-foundation package, not restart mission drafting from scratch.

---

## Current Foundation Direction

ADF v2 is being framed as:
- a fire-and-forget implementation startup for the CEO
- built from boxed components
- driven by explicit contracts
- governed by scripts
- using agents where reasoning is required
- preserving durable state and audit truth

The mission-foundation package is intentionally defining:
- mission
- role boundaries
- context architecture
- decision discipline
- completion meaning
- trust at the right abstraction

It is intentionally not yet defining:
- full workflow mechanics
- later-company departments
- detailed implementation topology
- the full trust-governance machinery

---

## Restart Frame

### Broader work

Finish phase `00` from outside to inside:
- who exists at the top
- how work moves through the system
- what building blocks are needed
- how those building blocks may connect
- how trust works across that real structure
- final phase-`00` consistency and freeze-read

### Current task

Define who exists at the top.

This is not yet the workflow model, the component inventory, the connection model, or the trust freeze pass.
It is the thin top-level governing-entity definition only.

### Next step

Shape and freeze the thin top-level governing-entity document:
- define the top-level entities for phase `1`
- define their boundaries at the same high level
- do not widen into workflows, components, connection topology, or trust mechanics

The exact filename is still open and should not replace the real current task in startup answers.

### Later steps and open items

After the top-level governing-entity document:
- define the workflow model
- derive the component inventory from those workflows
- define the allowed connection model between those components
- finalize the trust model on top of that structure
- run the final phase-`00` freeze-read pass

The exact filename and final shape of the thin top-level governing-entity document remain open until explicitly frozen.

---

## What Should Happen Next

The next session should not restart the foundation.

It should do exactly this:

1. Review the current mission-foundation package and current drafts.
2. Use `DELIVERY-COMPLETION-DEFINITION.md`, `SYSTEM-OBLIGATIONS.md`, and `BOXED-COMPONENT-MODEL.md` in the layer root as frozen mission-foundation source of truth.
3. Keep broader trust-model questions in `context/artifacts/TRUST-MODEL.md`.
4. Keep out-of-scope but important items in `context/OPEN-ITEMS.md`.
5. Use the current working completion sequence below as the restart frame for finishing phase `00`.

## Current Working Completion Sequence For Phase `00`

This is the current recommended list for finishing the mission-foundation layer.

It is a working sequence, not yet a frozen decision.

1. define the top-level governing entities and boundaries
   this is the thin high-level doc for who exists at the top
2. define the main workflows
   example: request -> shaping -> execution -> verification -> return as `complete` or `blocked`
3. derive the needed building blocks from those workflows
   this is the component inventory
4. define how those building blocks are allowed to connect
   this is the allowed wiring and boundary model
5. finalize the trust model on top of that real structure
6. run one final phase-`00` consistency and freeze-read pass across all outputs

In plain language:
- first define who exists at the top
- then define how work moves
- then define what lego blocks are needed
- then define how those blocks may connect
- then define trust across that real structure
- then close the layer cleanly

---

## Strong Recommendations For The Next Agent

### Keep the model thin

Do not reintroduce early:
- COO as a foundational layer
- PM as a separate foundational layer
- department sprawl
- broad virtual-company simulation
- deep workflow machinery before the foundation is frozen

### Preserve canonical role language

Use the mission-foundation role set consistently:
- CEO
- CTO
- Scripts
- Agents
- Durable state

Avoid introducing replacement umbrella role names unless they are explicitly defined.

### Keep current document boundaries clean

For `DELIVERY-COMPLETION-DEFINITION.md`:
- keep it high level
- keep it service-boundary focused
- include only the narrow delivery-boundary meaning of trust
- do not absorb the full trust model

For `TRUST-MODEL.md`:
- treat it as draft, not frozen canon

For `OPEN-ITEMS.md`:
- use it to preserve real but out-of-scope work so scope can stay bounded without losing important issues

---

## Open Questions Still Outside This Handoff

The biggest remaining open questions are no longer about whether v2 should exist.

They are now mostly about:
- the exact name and final shape of the top-level governing-entity document
- the workflow model
- the component inventory derived from the workflows
- the connection model derived from the workflows and components
- broader trust-model definition
- trust thresholds and governance mechanics
- the final phase-`00` closeout pass

Those should be resolved in their own artifacts, not by reopening the core mission foundation.

---

## Suggested Folder Growth Pattern

The exact later filenames can still evolve, but the current growth pattern is:

- `adf-v2/00-mission-foundation/context/HANDOFF.md`
- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
- `adf-v2/00-mission-foundation/context/DECISIONS.md`
- `adf-v2/00-mission-foundation/context/artifacts/TRUST-MODEL.md`
- `adf-v2/00-mission-foundation/context/artifacts/SYSTEM-OBLIGATIONS.md`
- `adf-v2/00-mission-foundation/context/artifacts/BOXED-COMPONENT-MODEL.md`
- `adf-v2/01-architecture/ARCHITECTURE.md`
- `adf-v2/01-architecture/CONTROL-PLANE.md`
- `adf-v2/02-migration/MIGRATION.md`
- `adf-v2/03-thin-core/`

The naming goal is:
- explicit sequence
- easy restart in new chats
- no hidden context requirement

---

## Final Summary For The Next Agent

ADF v2 mission foundation is already underway.

Do not restart mission drafting from scratch.
Continue from the current package, treat `DELIVERY-COMPLETION-DEFINITION.md`, `SYSTEM-OBLIGATIONS.md`, and `BOXED-COMPONENT-MODEL.md` as frozen layer canon, and use the current working completion sequence to finish phase `00` without reviving the old `ROLE-MODEL.md` assumption.

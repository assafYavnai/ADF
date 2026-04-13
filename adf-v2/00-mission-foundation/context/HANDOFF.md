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
- DEV

Scripts, agents, durable state, and approved shared substrate remain below that top-level ontology as governed ingredients or capabilities rather than peer top-level entities.

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

### 5. DEV is the top-level execution entity under CTO governance

DEV:
- carries out governed development execution
- returns truthful terminal results or truthful pushback
- is assembled from boxed components
- may use lower-layer governed ingredients and capabilities without collapsing the ontology into those ingredients

---

## Current Mission-Foundation State

The mission foundation is no longer at the stage of imagining `VISION.md` and `PHASE1.md` as future outputs.

The current authoritative foundation package already includes:
- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
- `adf-v2/00-mission-foundation/SYSTEM-OBLIGATIONS.md`
- `adf-v2/00-mission-foundation/BOXED-COMPONENT-MODEL.md`
- `adf-v2/CEO-AGENT-WORKING-PROTOCOL.md`
- `adf-v2/CTO-CEO-WORKING-MODE.md`
- `adf-v2/CTO-ROLE.md`
- `adf-v2/00-mission-foundation/CTO-CONTEXT-ARCHITECTURE.md`
- `adf-v2/00-mission-foundation/V1-PAIN-POINT-AND-V2-FORK-RATIONALE.md`
- `adf-v2/00-mission-foundation/context/DECISIONS.md`
- `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`

The main remaining draft artifacts in this layer are:
- `adf-v2/00-mission-foundation/context/artifacts/DEV-ROLE.md`
- `adf-v2/00-mission-foundation/context/artifacts/TRUST-MODEL.md`
- `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`
- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`

The ontology correction pass is complete enough that the repo should now restart from the corrected three-entity ontology rather than from the obsolete five-item frame.

---

## Current Foundation Direction

ADF v2 is being framed as:
- a fire-and-forget implementation startup for the CEO
- built from boxed components
- driven by explicit contracts
- governed through clear role and route boundaries
- preserving durable state and audit truth

The top-level mission-foundation ontology is now:
- CEO
- CTO
- DEV

Below that layer, scripts, agents, durable state, and approved shared substrate remain lower-level governed ingredients or capabilities.
They are not peer top-level entities in current canon.

The mission-foundation package is intentionally defining:
- mission
- top-level entity boundaries
- context architecture
- decision discipline
- completion meaning
- trust at the right abstraction

It is intentionally not yet defining:
- full workflow mechanics
- detailed implementation topology
- the full trust-governance machinery
- an exhaustive internal recipe for every box

---

## Restart Frame

### Broader work

Finish phase `00` from outside to inside:
- review and tighten the first DEV role draft under the corrected ontology
- define the workflow model
- derive the component inventory from those workflows
- define the allowed connection model between those components
- finalize the trust model on top of that structure
- run the final phase-`00` consistency and freeze-read

### Current task

Review and tighten the first working DEV role draft as the next required artifact-level pass after ontology correction.

Primary canonical register for that next artifact:
- `adf-v2/00-mission-foundation/context/OPEN-ITEMS.md`

Required context for starting that task:
- `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`
- `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`
- `adf-v2/00-mission-foundation/context/artifacts/DEV-ROLE.md`

### Next step

Run the first review pass on `DEV-ROLE.md` at the same high level as the corrected ontology:
- check whether DEV's accountability boundary under CTO governance is explicit enough
- check whether the split between CTO ownership and DEV ownership is clear enough
- keep lower-layer ingredients non-exhaustive and below the ontology layer
- do not widen yet into workflow topology, component inventory, or the full trust model
- treat the artifact as draft until a later freeze-read says otherwise

If drift appears between startup docs and task parking, `OPEN-ITEMS.md` is the primary canonical register and `NEXT-STEP-HANDOFF.md` must mirror it.

### Later steps and open items

After the DEV role or rules artifact:
- define the workflow model
- derive the component inventory from those workflows
- define the allowed connection model between those components
- finalize the trust model on top of that structure
- run the final phase-`00` freeze-read pass

The exact final promoted filename and final freeze shape of the current top-level governing-entity draft remain open until explicitly frozen.

---

## What Should Happen Next

The next session should not restart the foundation.

It should do exactly this:

1. Review the corrected mission-foundation package and the reconciliation record.
2. Use `MISSION-STATEMENT.md`, `DELIVERY-COMPLETION-DEFINITION.md`, `SYSTEM-OBLIGATIONS.md`, and `BOXED-COMPONENT-MODEL.md` in the layer root as frozen mission-foundation source of truth.
3. Use `context/ONTOLOGY-RECONCILIATION.md` to understand what was corrected, what was reviewed, and which wording is historical only.
4. Use `context/OPEN-ITEMS.md` as the primary canonical register for the current DEV role draft and its remaining review work.
5. Review and tighten `context/artifacts/DEV-ROLE.md` at the same high level before moving deeper into workflow or component definition.

## Current Working Completion Sequence For Phase `00`

This is the current recommended list for finishing the mission-foundation layer.

It is a working sequence, not yet a frozen decision.

1. define DEV role and rules
2. define the main workflows
   example: request -> shaping -> execution -> verification -> return as `complete` or `blocked`
3. derive the needed building blocks from those workflows
   this is the component inventory
4. define how those building blocks are allowed to connect
   this is the allowed wiring and boundary model
5. finalize the trust model on top of that real structure
6. run one final phase-`00` consistency and freeze-read pass across all outputs

In plain language:
- first tighten and freeze-read DEV at the correct high level under the corrected ontology
- then define how work moves
- then define what lego blocks are needed
- then define how those blocks may connect
- then define trust across that real structure
- then close the layer cleanly

---

## Strong Recommendations For The Next Agent

### Keep the model thin

Do not reintroduce early:
- the obsolete five-item top-level ontology
- COO as a foundational layer
- PM as a separate foundational layer
- department sprawl
- broad virtual-company simulation
- deep workflow machinery before the foundation is frozen

### Preserve canonical top-level language

Use the mission-foundation top-level set consistently:
- CEO
- CTO
- DEV

When lower-layer composition must be mentioned:
- scripts
- agents
- durable state
- approved shared substrate

Treat that lower-layer wording as governed ingredients or capabilities below the ontology layer, not as peer top-level entities.

### Keep current document boundaries clean

For `DELIVERY-COMPLETION-DEFINITION.md`:
- keep it high level
- keep it service-boundary focused
- include only the narrow delivery-boundary meaning of trust
- do not absorb the full trust model

For `TRUST-MODEL.md`:
- treat it as draft, not frozen canon

For `OPEN-ITEMS.md`:
- use it as the primary canonical register for the DEV role or rules next artifact

---

## Open Questions Still Outside This Handoff

The biggest remaining open questions are no longer about whether v2 should exist or what the top-level ontology is.

They are now mostly about:
- the DEV role and rules artifact
- the exact final promoted filename and freeze shape of the current top-level governing-entity draft
- the workflow model
- the component inventory derived from the workflows
- the connection model derived from the workflows and components
- broader trust-model definition
- trust thresholds and governance mechanics
- the final phase-`00` closeout pass

Those should be resolved in their own artifacts, not by reopening the ontology correction.

---

## Suggested Folder Growth Pattern

The exact later filenames can still evolve, but the current growth pattern is:

- `adf-v2/00-mission-foundation/context/HANDOFF.md`
- `adf-v2/00-mission-foundation/context/ONTOLOGY-RECONCILIATION.md`
- `adf-v2/00-mission-foundation/MISSION-STATEMENT.md`
- `adf-v2/00-mission-foundation/DELIVERY-COMPLETION-DEFINITION.md`
- `adf-v2/00-mission-foundation/SYSTEM-OBLIGATIONS.md`
- `adf-v2/00-mission-foundation/BOXED-COMPONENT-MODEL.md`
- `adf-v2/00-mission-foundation/context/DECISIONS.md`
- `adf-v2/00-mission-foundation/context/artifacts/DEV-ROLE.md`
- `adf-v2/00-mission-foundation/context/artifacts/TRUST-MODEL.md`
- `adf-v2/00-mission-foundation/context/artifacts/TOP-LEVEL-GOVERNING-ENTITIES.md`
- later workflow, component, and connection docs

The naming goal is:
- explicit sequence
- easy restart in new chats
- no hidden context requirement

---

## Final Summary For The Next Agent

ADF v2 mission foundation is already underway.

Do not restart mission drafting from scratch.
Continue from the corrected three-entity ontology, treat `MISSION-STATEMENT.md`, `DELIVERY-COMPLETION-DEFINITION.md`, `SYSTEM-OBLIGATIONS.md`, and `BOXED-COMPONENT-MODEL.md` as frozen layer canon, use `ONTOLOGY-RECONCILIATION.md` to understand the correction pass, and review/tighten `context/artifacts/DEV-ROLE.md` as the current draft using `OPEN-ITEMS.md` as the primary canonical register.

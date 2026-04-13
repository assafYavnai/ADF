# ADF v2 Mission Statement

Status: working mission foundation  
Scope: `adf-v2/00-mission-foundation/`  
Purpose: define the executive charter for ADF v2 Phase 1

---

## Identity

ADF v2 is a fire-and-forget implementation system that turns a well-defined requirements package into truly complete, production-ready artifacts end to end.

## Core promise

ADF v2 delivers through boxed components that communicate through contracts. Every system function follows defined JSON inputs, JSON outputs, and failure protocols, so delivery does not depend on hidden interpretation.

## Foundational approach

ADF v2 is defined top-down and built bottom-up. It is built from self-contained boxed components that inherit a shared structure, communicate through defined contracts, and carry defined obligations. Roles and workflows are assemblies built from those components.

## Phase 1 mission

Phase 1 builds the minimum reliable implementation startup for the CEO: CTO-led shaping, DEV execution assembled from boxed components, and truly complete, production-ready delivery.

## Phase 1 scope

- define the ADF startup model
- define the boxed component model that all core system functions must follow
- define the minimum top-level entities, role boundaries, and workflows required for the startup model
- build the minimum set of boxed components required to run that model
- prove the model with a first complete end-to-end delivery chain

## Phase 1 out of scope

- full virtual company modeling
- later-company roles, departments, and business functions
- enterprise process breadth beyond the startup model
- rebuilding legacy ADF behavior for compatibility
- wide feature expansion before the startup model is defined and proven

## Top-Level Entities

- **CEO** - vision, priorities, approval, and high-level governing intent
- **CTO** - the top-level governing delivery entity assembled from boxed components; shapes approved intent into a trustworthy implementation request package, governs admission into execution, and certifies truthful upward return
- **DEV** - the top-level governed development entity assembled from boxed components; carries out bounded development execution under CTO governance and returns truthful terminal results or truthful pushback

Below that top-level ontology, governed ingredients and capabilities such as scripts, agents, durable state, and approved shared substrate may participate inside boxed components and higher-level assemblies as applicable. They are not peer top-level entities in the mission-foundation model.

## Success test

- the CEO can stay at vision, priorities, and approval level without managing technical delivery
- the CTO can turn CEO-approved intent into a well-defined implementation request package and certify delivery truthfully upward
- DEV can execute the approved package under governance without leaking hidden supervision, cleanup, or repair burden upward
- governance is predictable and deterministic: the same slice may produce different implementations, but the process, states, controls, and KPIs remain consistent
- slices can be implemented safely in parallel
- merge handles multiple slice requests through a governed FIFO merge queue
- local `main` stays clean at all times: no modified or untracked files; implementation runs in isolated worktrees
- no broken statuses, state, or leftover operational damage remain after execution
- internal execution pushback is contained and governed before delivery is declared complete
- every component has full audit trail, KPI visibility, and defined status or error history
- every component passes standalone tests
- required human testing is completed before approval
- the first end-to-end delivery chain reaches truly complete, production-ready delivery

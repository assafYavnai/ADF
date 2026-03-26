# How To Use ProjectBrain As Reference

## Context

ADF v2 is being built in a **new, clean project directory**. ProjectBrain (`C:\ProjectBrain`) remains the original project and contains all prior work, decisions, designs, and discussion artifacts.

This file explains what lives in ProjectBrain, what is worth referencing, and how a future session in the new project should use it.

---

## What ProjectBrain Contains

### 1. The Handoff Pack (this directory)

**Path**: `C:\ProjectBrain\prompts\adf_coo_handoff_pack\`

This is the primary reference. It contains:

| File | What It Holds |
|---|---|
| `00_START_HERE.md` | Reading order, locked direction, design philosophy |
| `01_VISION_AND_TARGET_STATE.md` | Target behavior, migration philosophy |
| `02_PROBLEM_STATEMENT_AND_EVIDENCE.md` | The drift problem, root cause analysis, failure classes |
| `03_DECISION_BOARD.md` | 16 locked decisions (D-001 through D-016) |
| `04_ARCHITECTURE_BASELINE.md` | Technology stack decisions, migration implications |
| `05_CONTROLLER_HIGH_LEVEL_FLOW.md` | Controller turn flow, operational principles, open items |
| `06_COMPONENT_MODEL_AND_CONTRACTS.md` | Contract direction for tools, roles, controller |
| `07_12_FACTOR_AGENTS_SUMMARY_AND_REFERENCES.md` | 12-factor-agents summary, external reference URLs |
| `08_WORK_PROCESS.md` | Agreed implementation cadence: define, implement, verify, record |
| `09_BACKLOG_AND_NEXT_STEPS.md` | Backlog items B-001 through B-007, tool/role status |
| `10_OPEN_QUESTIONS_AND_RISKS.md` | Open questions Q-001 through Q-005, risks R-001 through R-006 |
| `11_SECOND_PASS_COMPLETENESS_CHECK.md` | Coverage audit of the pack itself |
| `12_ARCHITECTURE_RECOMMENDATION.md` | Detailed 12-factor-agents + memory-stack analysis, implementation plan, what to import vs. not |
| `13_REFERENCE_PROJECT_USAGE.md` | This file |

**When to read**: At the start of the new project. The handoff pack is the complete context for why ADF v2 exists and what decisions are already locked.

### 2. Memory-Stack Design

**Path**: `C:\ProjectBrain\ADF\WAT\MD-examples\memory-stack\`

Contains the full 6-layer memory architecture design: installer kit, layer definitions, managed block templates, configuration examples, verification checklist.

**When to read**: When implementing the knowledge/memory layers of ADF v2. The design is portable — it was built to be installed into a new workspace.

### 3. ADF COO Role and Tools

**Path**: `C:\ProjectBrain\ADF\COO\`

Contains the current COO role definition, audit logs, tool infrastructure, and job outputs.

**When to read**: When porting the COO concept to ADF v2. Useful for understanding what the COO does today, not for copying its implementation. The current implementation is what we are replacing.

### 4. ADF Components

**Path**: `C:\ProjectBrain\ADF\Components\`

Contains MCP runtime, tests, and component definitions.

**When to read**: When porting specific components (MCP services, tools) to the new contract-based structure. Cherry-pick what works; do not import the structure.

### 5. ADF Framework Files

**Path**: `C:\ProjectBrain\ADF\` (root-level files like guides, directives, WAT)

Contains design guides, the WAT (Working Agreements and Truths), framework directives, and role definitions.

**When to read**: When you need to understand a design principle or governance rule that was established in the original ADF. Some of these are still valid; others are superseded by the handoff pack decisions.

### 6. Brain MCP Server

**Path**: Referenced via MCP tools (e.g., `mcp__project-brain__*`)

The Brain is an MCP-based knowledge management server with discussions, plans, decisions, memory, artifacts, and workflow tracking.

**When to read/use**: The Brain may continue serving ADF v2 as a knowledge backend. If the new controller needs access to discussions, decisions, or structured memory, the Brain MCP tools are the interface.

### 7. Prompts Directory

**Path**: `C:\ProjectBrain\prompts\`

Contains prompt templates and packages used in the original ADF.

**When to read**: When designing owned prompts for ADF v2 (Factor 2). Some prompt patterns may be reusable; the templates themselves should be rewritten for the new architecture.

---

## How To Reference ProjectBrain From the New Project

### Method 1: Direct File Read (Recommended)

From the new project's Claude Code session, read files directly:

```
Read C:\ProjectBrain\prompts\adf_coo_handoff_pack\03_DECISION_BOARD.md
```

No symlinks, no copies. The files stay in ProjectBrain. You read them when you need context.

### Method 2: CLAUDE.md Pointer

In the new project's `CLAUDE.md`, add a reference section:

```markdown
## Reference Project
Prior ADF work, decisions, and designs live in C:\ProjectBrain.
Key reference: C:\ProjectBrain\prompts\adf_coo_handoff_pack\ (read 00_START_HERE.md for orientation).
Do not import structure or files wholesale. Read for context, build fresh.
```

### Method 3: Decision Import

Copy the decision board into the new project's `decisions/` directory as a starting point. These decisions are locked and carry forward:

- D-001: Node.js + TypeScript for controller
- D-002: Do not restart from scratch (already honored — we are starting v2 clean, not restarting the org's work)
- D-003: Architecture / infrastructure first
- D-004: Staged work process
- D-005: COO remains the front end
- D-006: Controller as control plane
- D-007: Model-based classification
- D-008: Thin AGENTS.md
- D-009: End-of-bootstrap executive summary
- D-010: Tool discovery via registry, not hardcoded lists
- D-011: Tech Council created first
- D-012: Standardized role creation
- D-013: agent-role-builder naming
- D-014: Slug-prefixed role artifacts
- D-015: 12-factor-agent-style discipline
- D-016: Contract-based component structures

### Method 4: Selective Component Port

When ready to port a specific component (Tech Council, agent-role-builder, Tool Builder), read its source in ProjectBrain, understand what it does, then rebuild it to fit the new contract-based structure. Do not copy files — rebuild to the new contracts.

---

## Rules For Referencing

1. **Read, don't import.** ProjectBrain is a reference, not a source of copy-paste. Every component in ADF v2 should be built to fit its own contracts.

2. **Decisions carry forward. Structure does not.** The 16 locked decisions are still valid. The folder layout, file naming, and bootstrap chain are not.

3. **When in doubt, check the handoff pack first.** It is the authoritative summary of all prior work. If something is not in the handoff pack, it was either not important enough to capture or was superseded.

4. **The Brain MCP server is a live service.** If it is running and accessible, use it for discussions, decisions, and structured memory. It is not tied to ProjectBrain's file structure.

5. **Memory-stack is a design to implement, not a kit to install as-is.** The design principles (6-layer separation, PARA, routing-only MEMORY.md, etc.) are what matter. The installer scripts were built for OpenClaw — ADF v2 will implement the same principles in its own way.

6. **Do not read current ADF runtime files as truth.** The current AGENTS.md, COO role, bootstrap chain, and PowerShell governance are the old architecture. They represent what we are replacing. Read them only to understand what behavior needs to be preserved, not how to implement it.

---

## Quick Reference Paths

| What You Need | Where To Find It |
|---|---|
| All locked decisions | `C:\ProjectBrain\prompts\adf_coo_handoff_pack\03_DECISION_BOARD.md` |
| Architecture recommendation | `C:\ProjectBrain\prompts\adf_coo_handoff_pack\12_ARCHITECTURE_RECOMMENDATION.md` |
| 12-factor-agents principles | `C:\ProjectBrain\prompts\adf_coo_handoff_pack\12_ARCHITECTURE_RECOMMENDATION.md` (detailed) or `07_12_FACTOR_AGENTS_SUMMARY_AND_REFERENCES.md` (summary) |
| Memory-stack design | `C:\ProjectBrain\ADF\WAT\MD-examples\memory-stack\` |
| Controller flow concept | `C:\ProjectBrain\prompts\adf_coo_handoff_pack\05_CONTROLLER_HIGH_LEVEL_FLOW.md` |
| Component contract direction | `C:\ProjectBrain\prompts\adf_coo_handoff_pack\06_COMPONENT_MODEL_AND_CONTRACTS.md` |
| Work process | `C:\ProjectBrain\prompts\adf_coo_handoff_pack\08_WORK_PROCESS.md` |
| Open risks | `C:\ProjectBrain\prompts\adf_coo_handoff_pack\10_OPEN_QUESTIONS_AND_RISKS.md` |
| Problem statement / why we are doing this | `C:\ProjectBrain\prompts\adf_coo_handoff_pack\02_PROBLEM_STATEMENT_AND_EVIDENCE.md` |
| Vision / target state | `C:\ProjectBrain\prompts\adf_coo_handoff_pack\01_VISION_AND_TARGET_STATE.md` |
| Current COO implementation (old) | `C:\ProjectBrain\ADF\COO\` |
| Current ADF components (old) | `C:\ProjectBrain\ADF\Components\` |
| Brain MCP tools | Available via `mcp__project-brain__*` tool namespace |

# ADF COO / Controller Handoff Pack

## Purpose
This package is the working handoff for redesigning ADF around a governed controller-first architecture, while preserving the COO as the user-facing entry point.

It is intended to survive context drift across future sessions and across implementor agents.

## How to use this package
Read in this order:

1. `01_VISION_AND_TARGET_STATE.md`
2. `02_PROBLEM_STATEMENT_AND_EVIDENCE.md`
3. `03_DECISION_BOARD.md`
4. `04_ARCHITECTURE_BASELINE.md`
5. `05_CONTROLLER_HIGH_LEVEL_FLOW.md`
6. `06_COMPONENT_MODEL_AND_CONTRACTS.md`
7. `07_12_FACTOR_AGENTS_SUMMARY_AND_REFERENCES.md`
8. `08_WORK_PROCESS.md`
9. `09_BACKLOG_AND_NEXT_STEPS.md`
10. `10_OPEN_QUESTIONS_AND_RISKS.md`
11. `11_SECOND_PASS_COMPLETENESS_CHECK.md`

## What this package is
- a high-level but detailed architecture and process handoff
- a memory-preserving bundle for future ChatGPT / Codex sessions
- a decision record
- a backlog and sequencing guide

## What this package is not
- not the final repo truth
- not executable code
- not a substitute for repo commits
- not a substitute for future reviewed authority decisions

## Current locked direction
- ADF keeps the COO as the user-facing front end
- We do **not** restart ADF from scratch
- We migrate **inside the codebase**
- We do architecture / infrastructure first
- We standardize around:
  - **Node.js + TypeScript** for controller/runtime
  - **node:child_process** for process orchestration
  - **JSON Schema + Zod** for schemas and validation
  - **PowerShell / shell** only for leaf adapters and existing Windows-centric tools
  - **Python** allowed for specialist tools, not the controller

## Current major built tools from discussion
- Tech Council: built and upgraded to live roster-backed advisory mode
- agent-role-builder: built; later identified need for true live roster enforcement as well

## Design philosophy
- Do not rely on one drifting long-lived agent session as truth
- Externalize truth into artifacts, contracts, and governed state
- Keep the COO as the conversational front end
- Introduce a controller layer that governs every turn
- Use bounded specialist invocations when needed

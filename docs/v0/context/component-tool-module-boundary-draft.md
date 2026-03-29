# Component, Tool, and Module Boundary Draft

Status: draft design decision
Last updated: 2026-03-29
Purpose: capture the current high-level distinction between components, tools, and modules so future agents do not blur reusable machinery with company-facing execution units.

---

## Why This Draft Exists

During Phase 1 architecture discussion, a recurring ambiguity appeared:

- the COO is clearly a component
- `agent-role-builder` behaves like a tool
- but inside `agent-role-builder` there are reusable building blocks such as review, validation, learning, and fixing

This draft captures the current answer:

- what a component is
- what a tool is
- what a module is
- where the current line should be drawn

This is still a draft architectural direction, not yet a final locked governance decision.

---

## Current High-Level Distinction

### 1. Component

A **component** is a product or company unit with its own mission, ownership, and operating responsibility.

It is not just code organization.
It is a meaningful part of the system.

Examples:

- COO
- memory-engine
- future CTO queue manager
- future context service

Properties of a component:

- owns a clear business or operational role
- may hold state
- may coordinate multiple tools
- may use multiple modules internally
- survives as a named unit in the company/product model

### 2. Tool

A **tool** is a callable company-facing execution unit with a clear request, a clear result, and terminal outcomes.

It is something governance, a component, or another orchestrator can call to get a bounded job done.

Examples:

- `agent-role-builder`
- future `llm-tool-builder`
- possible future `run-review-cycle`

Properties of a tool:

- has a top-level request contract
- has a top-level result contract
- owns terminal statuses
- owns a bounded job
- may write evidence artifacts
- may promote canonical outputs
- can be understood as "do X"

### 3. Module

A **module** is a reusable building block used to implement tools or components.

It is reusable machinery, not the top-level company action itself.

Examples:

- review board runtime
- learning engine
- validator
- fixer
- provenance
- telemetry
- LLM invoker

Properties of a module:

- reusable across more than one tool/component
- usually internal rather than directly CEO-facing
- provides mechanism rather than business ownership
- may later be exposed through a tool surface if needed

---

## The Current Boundary Rule

The proposed boundary is:

- **component** = mission-owned company/product unit
- **tool** = callable unit with a business/operational outcome
- **module** = reusable internal building block

The key test is not size.
The key test is responsibility.

### If it answers:

`Can the company call this as a standalone action and expect a bounded result?`

Then it is probably a **tool**.

### If it answers:

`Is this reusable machinery used by tools/components to get their jobs done?`

Then it is probably a **module**.

---

## Concrete Example: Agent Role Builder

The code scan of `tools/agent-role-builder/` strongly suggests that `agent-role-builder` is a **tool**, not a module.

### Why `agent-role-builder` is a tool

The tool has:

- a callable top-level entrypoint in [index.ts](C:/ADF/tools/agent-role-builder/src/index.ts)
- a request contract in [request.ts](C:/ADF/tools/agent-role-builder/src/schemas/request.ts)
- a result contract in [result.ts](C:/ADF/tools/agent-role-builder/src/schemas/result.ts)
- run directories and persistent evidence artifacts
- terminal statuses such as `frozen`, `blocked`, `pushback`, and `resume_required`
- canonical output promotion when the run succeeds

That makes it a bounded callable company action:

- given a role request
- produce a governed role package or return a governed failure state

That is tool behavior.

### Which parts inside `agent-role-builder` look like modules

Inside the tool, several pieces behave like reusable modules:

#### Validator module

- [validator.ts](C:/ADF/tools/agent-role-builder/src/services/validator.ts)
- validates requests
- runs self-checks

#### Role generation module

- [role-generator.ts](C:/ADF/tools/agent-role-builder/src/services/role-generator.ts)
- generates role markdown
- revises role markdown after review feedback
- generates role contract

#### Review board module

- [board.ts](C:/ADF/tools/agent-role-builder/src/services/board.ts)
- orchestrates reviewers and leader
- handles split verdicts
- handles arbitration
- writes round artifacts
- manages review/fix/retry flow

#### Fixer / recovery module

- currently embedded inside [board.ts](C:/ADF/tools/agent-role-builder/src/services/board.ts)
- writes structured bug reports
- attempts parse-error auto-fix
- blocks the board when unrecoverable failures remain

#### Shared learning module

- [engine.ts](C:/ADF/shared/learning-engine/engine.ts)
- [compliance-map.ts](C:/ADF/shared/learning-engine/compliance-map.ts)
- [fix-items-map.ts](C:/ADF/shared/learning-engine/fix-items-map.ts)

This is already a shared module family in practice, even though the live board orchestration is not fully extracted yet.

---

## Important Current Truth

The review process is currently **partly modeled, partly tool-integrated**.

### What is already shared

Reusable review-related pieces already exist in `shared/learning-engine/`:

- rulebook guide
- review prompt template
- learning engine API
- compliance-map schema
- fix-items-map schema
- implementor rulebook

### What is still embedded

The actual working review runtime is still mostly embedded inside:

- [board.ts](C:/ADF/tools/agent-role-builder/src/services/board.ts)

That includes:

- reviewer protocol
- leader protocol
- round orchestration
- split-verdict behavior
- arbitration behavior
- per-round artifact writing
- fixer path for parse failures

So the current architecture truth is:

- the **doctrine and shared schemas exist**
- the **battle-tested orchestration still lives inside a specific tool**

---

## What This Implies

### 1. Reuse should happen through modules

When the same mechanism is needed by multiple tools/components, it should become a shared module rather than being re-implemented.

Examples:

- review board
- fixer
- learning
- provenance
- telemetry

### 2. Tools should compose modules

A tool should be allowed to combine:

- local tool-specific logic
- shared modules
- component-specific adapters such as `rulebook.json` and `review-prompt.json`

### 3. Not every helper becomes a tool

Internal helper logic should stay inside a module unless it becomes useful as a standalone callable action.

Example:

- `parse_reviewer_json` is not a tool
- a future `run_review_cycle` could be a tool surface over the review module

### 4. Extraction should follow proven reuse

If a pattern only exists in one place, it can remain local at first.
If it is clearly cross-cutting or needed a second time, it should be extracted into a shared module.

That means the review board runtime is a good candidate for future extraction because:

- it is already useful beyond `agent-role-builder`
- it includes reusable governance behavior
- future tools and components will likely need the same review machinery

---

## Current Draft Decision

Current recommended distinction:

- **Components own mission**
- **Tools own callable outcomes**
- **Modules own reusable mechanisms**

In current ADF terms:

- COO = component
- memory-engine = component
- agent-role-builder = tool
- review board = module candidate
- fixer = module candidate
- learning engine = shared module
- provenance = shared module
- telemetry = shared module
- LLM invoker = shared module

---

## Open Follow-Up

The next related design question is:

Should the review board runtime be extracted into a shared module now, or stay inside `agent-role-builder` as the proving ground until a second tool needs it?


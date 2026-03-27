# Step 2e: Tool Bootstrap — Fix agent-role-builder via llm-tool-builder

Status: **planned**
Last updated: 2026-03-27

---

## Bug Found

**agent-role-builder convergence gap**: The role-generator produces markdown once from the request and never updates it based on board feedback. Each review round reviews the same static draft, finding increasingly granular issues. The board cannot converge because the draft doesn't improve between rounds.

**Evidence**: 3 board runs (self-role-001, 002, 003) — all resulted in resume_required. Issues went from 6 → 3 → 10 (more thorough, not converging).

**Root cause**: `role-generator.ts` generates from request only. No feedback incorporation loop exists between board rounds.

**Proposed fix**: After each round, if status is pushback, regenerate the draft incorporating the leader's unresolved issues and reviewer findings. Round N+1 then reviews the updated draft.

---

## Bootstrap Sequence

### 1. Log bug and proposed fix
- Bug logged to Brain as open_loop
- Fix specification documented

### 2. Import llm-tool-builder
- Full port from PowerShell to TypeScript
- Integrated with agent-role-builder for role creation
- **skip-build-agent-role flag**: boolean in request JSON, defaults to false
  - When true: skips the agent-role-builder call (bootstrap mode)
  - When false: always calls agent-role-builder (normal governed mode)
- **import-existing-role field**: optional path to an existing role definition
  - Allows attaching a pre-built role to a tool
  - Covers bootstrap cases and user-defined roles

### 3. Fix agent-role-builder (skip-build-agent-role = true)
- Use llm-tool-builder to update agent-role-builder
- Fix: add feedback incorporation loop to role-generator.ts and board.ts
- Skip flag avoids the chicken-and-egg (tool can't create own role yet)

### 4. Build role for agent-role-builder
- Use the now-fixed agent-role-builder to create its own role
- Board should converge because drafts now improve between rounds
- Result: frozen role package at tools/agent-role-builder/role/

### 5. Attach role to agent-role-builder (skip-build-agent-role = false)
- Use llm-tool-builder(update) to formally attach the role from step 4
- Skip flag now false — full governance restored
- Also: llm-tool-builder creates its OWN role through agent-role-builder

### 6. Test and verify
- Both tools have governed roles
- agent-role-builder role was created by itself (dog food)
- llm-tool-builder role was created by agent-role-builder
- agent-role-builder feedback loop works (board converges)
- Evidence: frozen role artifacts for both tools

---

## Tool-builder Capabilities (from ProjectBrain analysis)

- Supports create AND update (auto-detected by file existence)
- Same contract schema (v2.1) for both paths
- Same 8-phase workflow
- Unified result format
- No separate "fix" operation — updates serve that purpose

---

## Files to Create/Modify

| File | Action |
|---|---|
| `tools/llm-tool-builder/src/` | Full port from PowerShell |
| `tools/llm-tool-builder/src/schemas/contract.ts` | Tool contract schema (v2.1) with skip-build-agent-role + import-existing-role |
| `tools/agent-role-builder/src/services/board.ts` | Fix: feedback incorporation loop |
| `tools/agent-role-builder/src/services/role-generator.ts` | Fix: regenerate from feedback |
| `tools/agent-role-builder/role/` | Created by agent-role-builder (step 4) |
| `tools/llm-tool-builder/role/` | Created by agent-role-builder via llm-tool-builder (step 5) |

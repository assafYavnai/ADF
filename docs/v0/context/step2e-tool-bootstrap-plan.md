# Step 2e: Tool Bootstrap — Fix agent-role-builder via llm-tool-builder

Status: **in progress** — bug fix applied, llm-tool-builder import next
Last updated: 2026-03-27

## Implementation Shift

Original Phase 2e was "bootstrap verification" (agent-role-builder creates its own role).
Bug found: static draft doesn't incorporate board feedback between rounds.
Shifted to: fix the tool first via llm-tool-builder, then bootstrap.

### What's already done (before this plan):
- agent-role-builder feedback loop implemented (reviseRoleMarkdown in role-generator.ts)
- board.ts updated to pass revised draft between rounds
- Role-generator enhanced with artifact classification
- MemoryEngineClient added for COO brain integration
- 3 board runs as evidence (self-role-001, 002, 003)
- Bug logged to Brain

### What's next:
- Import llm-tool-builder (full port)
- Execute bootstrap sequence (steps 1-6 below)

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
- **existing_role_path field**: optional path in request JSON
  - If null/empty: skip role creation (bootstrap mode, must be well documented in tool)
  - If path provided: import that role (covers user-defined roles, pre-built roles)
  - If neither: call agent-role-builder to create a new governed role
  - One field, three behaviors, self-documenting

### 3. Fix agent-role-builder (existing_role_path = null, bootstrap mode)
- Use llm-tool-builder to update agent-role-builder
- Bug fix already applied: feedback loop in board.ts + reviseRoleMarkdown
- llm-tool-builder validates the fix compiles and works
- existing_role_path = null avoids chicken-and-egg

### 4. Build role for agent-role-builder
- Use the now-fixed agent-role-builder to create its own role
- Board should converge because drafts now improve between rounds
- Result: frozen role package at tools/agent-role-builder/role/

### 5. Attach role and create llm-tool-builder role
- Use llm-tool-builder(update) to attach the role from step 4 to agent-role-builder
  (existing_role_path = "tools/agent-role-builder/role/agent-role-builder-role.md")
- Use agent-role-builder to create llm-tool-builder's role
  (supersedes the manually written tool-builder.md from ProjectBrain)
- Both tools now fully governed with evidence

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

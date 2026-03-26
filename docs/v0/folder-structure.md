# ADF Suggested Folder Structure

Status: proposed
Last updated: 2026-03-26

---

## Target Directory Structure

```
ADF/
  controller/                    # Node.js/TS stateless reducer
    src/
      loop.ts                    # main control loop
      context-engineer.ts        # thread_to_prompt()
      classifier.ts              # intent classification
      thread.ts                  # Thread + Event types (Zod)
      tools.ts                   # tool registry + dispatch
    package.json
    tsconfig.json
  memory/                        # Layer D (daily residue)
    YYYY-MM-DD.md
  knowledge/                     # Layer C (PARA)
    projects/
    areas/
    resources/
    archives/
  tools/                         # tool packages (contract-based)
  roles/                         # role packages (slug-prefixed)
  schemas/                       # shared Zod schemas + JSON Schema exports
  prompts/                       # owned prompt templates (versioned)
  decisions/                     # decision board
  threads/                       # persisted thread state (JSON)
  docs/                          # documentation
    v0/                          # current version docs
  MEMORY.md                      # Layer A (routing index)
  AGENTS.md                      # thin rules that survive compaction
  CLAUDE.md                      # agent bootstrap pointer
```

## Key Conventions

- **controller/** — the core deterministic orchestrator. All TypeScript. This is the brain of ADF.
- **memory/** — daily residue files named by date. Short-horizon context recovery.
- **knowledge/** — PARA structure. The single source of truth for durable facts.
- **tools/** — each tool lives in its own subfolder with a contract (input/output schemas, side effects, approval requirements).
- **roles/** — role packages use slug-prefixed artifact names (e.g., `coo-role.md`, `coo-role-contract.json`).
- **schemas/** — shared Zod schemas that multiple components depend on. JSON Schema exports for external consumers.
- **prompts/** — versioned prompt templates. Prompts are code, not incidental strings.
- **decisions/** — locked decisions carried forward from the handoff pack.
- **threads/** — serialized thread state (JSON). Enables pause/resume/replay.

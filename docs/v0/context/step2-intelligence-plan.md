# Step 2: Intelligence — Tools, Roles, LLM Wiring

Status: **planned**
Last updated: 2026-03-27

---

## CEO Directives

- Use CLI (codex/claude) not API SDKs — leverages existing auth and token pools
- Codex is primary, Claude is fallback
- Classifier uses medium reasoning (cheap model, no need to overthink)
- COO Intelligence uses strongest models with highest reasoning and full bypass permissions
- Classifier has no action permissions (read-only sandbox or no sandbox)
- **Every LLM-powered agent must have a governed role** created through agent-role-builder — no exceptions, even cheap models
- Import both agent-role-builder and tool-builder now (foundational tooling, no reason to defer)
- COO folder structure: controller/, classifier/, intelligence/, context-engineer/, shared/

## LLM Configuration

| Role | Primary (Codex) | Flags | Fallback (Claude) | Flags |
|---|---|---|---|---|
| **Classifier** | `gpt-5.3-codex-spark` | `medium` reasoning, `--sandbox read-only` | `claude --model haiku` | `--effort medium` |
| **COO Intelligence** | `gpt-5.4` | `xhigh` reasoning, `--dangerously-bypass-approvals-and-sandbox` | `claude --model opus` | `--effort max`, `--dangerously-skip-permissions` |

## COO Folder Structure

```
COO/
  controller/                   # deterministic loop — no LLM
    loop.ts
    thread.ts
  classifier/                   # intent classification — fast LLM
    classifier.ts
    role/
      classifier-role.md
      classifier-role-contract.json
    prompt.md
  intelligence/                 # COO reasoning — strong LLM
    intelligence.ts
    role/
      intelligence-role.md
      intelligence-role-contract.json
    prompt.md
  context-engineer/             # context assembly — no LLM
    context-engineer.ts
  shared/                       # cross-layer utilities
    llm.ts                      # CLI-based LLM caller (Codex/Claude)
    tools.ts                    # tool registry
  package.json
  tsconfig.json
```

---

## Implementation Plan

### Phase 2a: Restructure COO folders
Move existing files from `COO/src/` to the new layer structure:
- `loop.ts` → `COO/controller/loop.ts`
- `thread.ts` → `COO/controller/thread.ts`
- `classifier.ts` → `COO/classifier/classifier.ts`
- `context-engineer.ts` → `COO/context-engineer/context-engineer.ts`
- `tools.ts` → `COO/shared/tools.ts`
- Move `prompts/coo-system.md` → `COO/intelligence/prompt.md`
- Update tsconfig rootDir and all import paths
- Verify compile

### Phase 2b: Import agent-role-builder to TypeScript
- Port from PowerShell (`C:\ProjectBrain\ADF\COO\tools\agent-role-builder\`) to TypeScript
- Place under `tools/role-builder/`
- Keep the core architecture:
  - Live board with Codex+Claude reviewer pairs
  - Multi-round review with arbitration
  - 4 terminal states: frozen / pushback / blocked / resume_required
  - Schema validation + self-check
  - Slug-prefixed role packages
  - Decision log + board summary + after-action review
- Simplify:
  - Remove PowerShell encoding workarounds (not needed in TS)
  - Remove lock-utils (use native TS file locking)
  - Use Zod instead of JSON Schema files
  - Use our `COO/shared/llm.ts` for CLI calls
- Port the 5 schemas to Zod: request, result, role-package, pushback, resume-package

### Phase 2c: Import tool-builder to TypeScript
- Port from PowerShell (`C:\ProjectBrain\ADF\COO\tools\tool-builder\`) to TypeScript
- Place under `tools/tool-builder/`
- Same simplification approach as role-builder
- Uses role-builder patterns for board review

### Phase 2d: Create COO roles using role-builder
- Build the **Intelligence role** (COO reasoning agent):
  - Authority: reports to CEO, owns execution/planning/memory operations
  - Scope: executive reasoning, structured responses, decision extraction
  - Guardrails: CEO language, evidence-based, pushback on bad decisions
  - Informed by: current ADF-ROLE.md + redesign pack + 12 proven rules
- Build the **Classifier role** (intent classification agent):
  - Authority: reports to Controller, read-only
  - Scope: classify user intent into workflow routing
  - Guardrails: JSON-only output, no actions, no reasoning beyond classification

### Phase 2e: Wire LLM CLI calls
- Create `COO/shared/llm.ts` — CLI-based LLM caller
  - `classifierCall(prompt)` — Codex spark primary, Claude haiku fallback
  - `cooCall(prompt)` — Codex gpt-5.4 primary, Claude opus fallback
  - Uses `node:child_process.execFile`
  - Configurable timeouts (classifier: 60s, COO: 120s)

### Phase 2f: Wire controller loop + end-to-end test
- Update `COO/controller/loop.ts` with default LLM config
- Create `COO/controller/cli.ts` — REPL entry point for testing
- End-to-end test: user input → classify → context assembly → COO response → thread commit

---

## Dependencies
- Codex CLI installed and authenticated (verified: v0.116.0)
- Claude CLI installed and authenticated (verified: v2.1.84)
- PostgreSQL running for memory engine (verified: port 5432)
- Ollama running for embeddings (verified: port 11434)

## Open Questions
- Should the COO CLI entry point also start the memory engine server, or assume it's running separately?
- Do we need `--no-color` or similar flag for clean stdout parsing from Claude?
- Max buffer size for LLM responses — 10MB enough?
- Tool-builder: what is the minimal port scope? Full board review or simplified for v1?

## Files to Create/Modify

| File | Action |
|---|---|
| `COO/controller/loop.ts` | move from src/, update imports |
| `COO/controller/thread.ts` | move from src/, update imports |
| `COO/classifier/classifier.ts` | move from src/, update imports |
| `COO/classifier/role/` | create via role-builder |
| `COO/classifier/prompt.md` | create |
| `COO/intelligence/intelligence.ts` | create — COO reasoning handler |
| `COO/intelligence/role/` | create via role-builder |
| `COO/intelligence/prompt.md` | move from prompts/coo-system.md |
| `COO/context-engineer/context-engineer.ts` | move from src/, update imports |
| `COO/shared/llm.ts` | create — CLI LLM caller |
| `COO/shared/tools.ts` | move from src/, update imports |
| `COO/controller/cli.ts` | create — REPL entry point |
| `tools/role-builder/` | create — TS port of agent-role-builder |
| `tools/tool-builder/` | create — TS port of tool-builder |
| `docs/v0/architecture.md` | updated — agent role governance rule |
| `docs/v0/components-and-layers.md` | created — component/layer taxonomy |

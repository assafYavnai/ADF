# ADF Architecture

Status: locked decisions
Last updated: 2026-03-27

---

## Technology Stack

| Layer | Decision |
|---|---|
| **Controller runtime** | Node.js + TypeScript |
| **Process orchestration** | `node:child_process` |
| **Schemas / validation** | Zod (TS-native) + JSON Schema (external consumers) |
| **Thread persistence** | JSON files initially, DB later if needed |
| **Memory persistence** | PostgreSQL + pgvector (Brain MCP engine) |
| **LLM calls** | CLI-based (Codex CLI primary, Claude CLI fallback). No SDK dependency — uses existing CLI auth and token pools. |
| **Shell** | Bash is the primary supported shell. ADF CLI launches from Bash. PowerShell only for Windows-specific leaf tasks. |
| **Python** | Allowed for specialist tools, not the controller |

### Shell Policy

- **Bash** is the default shell for ADF operations, scripts, and CLI entry point
- **PowerShell** is restricted to Windows-specific tasks where Bash cannot reach (e.g., Windows registry, COM objects, native Windows APIs)
- ADF is OS-agnostic — Bash provides the cross-platform baseline

### LLM Model Configuration

ADF uses CLI-based LLM calls via `node:child_process`. No API SDKs. Codex is the primary provider (more tokens available), Claude is the fallback.

| Role | Primary (Codex) | Reasoning | Fallback (Claude) | Effort |
|---|---|---|---|---|
| **Classifier** | `gpt-5.3-codex-spark` | `medium` | `claude --model haiku` | `medium` |
| **COO** | `gpt-5.4` | `xhigh` | `claude --model opus` | `max` |

**Classifier**: intent classification only. Fast, cheap model. No action permissions (`--sandbox read-only`). No bypass.

**COO**: executive reasoning, planning, memory operations. Strongest available model. Full permissions:
- Codex: `--dangerously-bypass-approvals-and-sandbox`
- Claude: `--dangerously-skip-permissions`

### LLM Call Pattern

```
User input → Controller
  → Classifier call (Codex spark, fast)
  → Route to workflow
  → COO call (Codex gpt-5.4 or Claude opus, strong)
  → Validate + commit state
```

Both calls use `codex exec` / `claude --print` for non-interactive execution. Prompt passed as argument, response captured from stdout/file.

---

## Architecture Model

### Core Principle

Agent as a **stateless reducer** (12-factor-agents). The controller is a deterministic orchestrator — not an LLM, not a drifting session. Each turn is a pure function: `next_event = agent(thread)`.

### Turn Flow

```
User input
  ↓
Controller ingress
  ↓
Load current state
  - COO role
  - current contracts
  - active summary
  - open loops
  - tool registry
  - rule versions
  ↓
Intent classification
  - bounded classifier model call
  ↓
Select workflow
  - direct COO response
  - tool path
  - specialist path
  - clarification / pushback
  ↓
Retrieve scoped context
  - only what this turn needs
  ↓
Execute selected path
  - COO call and/or tool/specialist call
  ↓
Validate outputs
  - contracts
  - required artifacts
  - status correctness
  - approval boundaries
  ↓
Commit state
  - summary
  - open loops
  - minutes/context
  - audit/logs
  - resume/session state
  ↓
Return response
```

### Key Components

1. **Thread model** — typed event list (Zod). Event types: `user_input`, `classifier_result`, `tool_call`, `tool_result`, `coo_response`, `error`, `human_request`, `state_commit`. The thread IS the state — single source of truth per session.

2. **Controller loop** — deterministic `thread → next_event` reducer. TypeScript program, not a framework invocation. Every routing decision, gate, and error path is explicit code.

3. **Context engineer** — `thread_to_prompt()` function. Assembles thread events + PARA facts + auto-recalled memory + daily residue + owned prompts into optimized context per LLM call.

4. **Intent classifier** — small bounded LLM call per turn. Zod-validated structured output. Decides: direct COO response, tool path, specialist path, clarification, pushback.

5. **COO agent** — user-facing reasoning worker. Called as a function per turn with assembled context. Emits structured outputs. Does not maintain internal state.

6. **Tool schema registry** — tools defined as Zod types. Discovery via registry, not hardcoded lists. Each tool has a contract: input schema, output schema, side effects, approval requirements.

### Operational Principles

- Input first goes to the controller, never directly to the COO
- Intent classification is model-assisted (script alone is not enough for natural language)
- Controller remains deterministic even when invoking a classifier
- Fresh model calls per turn (classifier, COO, specialists)
- Continuity comes from externalized state (contracts, summaries, open loops, PARA), not from trusting a raw running session

### Component Contract Rule

Every component must have: root folder, contract, source files, build artifacts, runtime artifacts, test surface, and audit surface.

---

## 6-Layer Memory Stack

| Layer | Name | Purpose |
|---|---|---|
| **A** | Routing | MEMORY.md + AGENTS.md — tiny bootstrap/index, not a fact warehouse |
| **B** | Session Recovery | LCM (lossless-claw) — scoped to COO conversation layer, not controller execution state |
| **C** | Durable Knowledge | PARA (`projects/`, `areas/`, `resources/`, `archives/`) — single source of truth for facts |
| **D** | Daily Residue | `memory/YYYY-MM-DD.md` — what happened today, short-horizon continuity |
| **E** | Auto-Recall | Gigabrain — pre-prompt recall/capture, feeds context engineer |
| **F** | Cross-Session Graph | OpenStinger (optional) — semantic + temporal recall across sessions |

### Memory Design Principles

1. File truth beats magic — durable truth lives in files, not hidden config
2. Tiny bootstrap — MEMORY.md and AGENTS.md stay lean and focused
3. Layer separation — each layer has exactly one job
4. Patch, don't replace — managed insert blocks, not wholesale rewrites
5. Optional upgrades — OpenStinger is additive, not required
6. Non-destructive — backups before any modification
7. Human review stays in loop — config changes proposed, not blindly applied

### Integration Point

The **context engineer** is where 12-factor-agents meets memory-stack. Before each LLM call, it assembles: thread events (12-factor) + durable knowledge (PARA) + auto-recalled memory (Gigabrain) + daily residue + owned prompts.

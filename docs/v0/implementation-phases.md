# ADF Implementation Phases

Status: locked direction
Last updated: 2026-03-26

---

## Phase 1: Foundation (Memory + Thread + Controller Shell)

These must exist before anything else works.

1. **Thread model** (TypeScript + Zod) — typed event list. Event types: `user_input`, `classifier_result`, `tool_call`, `tool_result`, `coo_response`, `error`, `human_request`, `state_commit`. Single source of truth per session.

2. **Memory-stack foundation** — PARA structure, daily residue directory, MEMORY.md routing, AGENTS.md rules. Install the file-backed knowledge layer first.

3. **Controller loop** (TypeScript) — deterministic orchestrator. Takes thread, calls `determine_next_step()`, executes, appends event, loops or pauses. Not an LLM. A stateless reducer.

4. **Context engineer** — `thread_to_prompt()` function. Assembles thread events + PARA facts + auto-recalled memory + daily residue + owned prompts into optimized context per LLM call.

---

## Phase 2: Intelligence (Classifier + COO + Tools + Governance Infrastructure)

5. **Shared infrastructure** — provenance (traceability on every operation), LLM invoker (CLI-based, Codex primary / Claude fallback), telemetry (async metrics to PostgreSQL), learning engine (rule extraction from review feedback).

6. **COO layer restructure** — controller/, classifier/, intelligence/, context-engineer/, shared/. Each LLM-powered layer gets its own role, rulebook, and review prompt.

7. **agent-role-builder** — TS port with live multi-LLM review board. Creates governed role packages. Structured reviewer feedback (conceptual groups with severity), split-verdict strategy, budget exhaustion protocol.

8. **llm-tool-builder** — TS port. Always calls agent-role-builder. Contract-based governance.

9. **Learning engine** — shared generic service. Extracts rules from review feedback, updates component rulebooks. Runs between every review and fix.

10. **COO roles** — classifier role + intelligence role created through agent-role-builder with full governance.

---

## Phase 3: Resilience (Pause/Resume + Gates + Auto-Recall)

8. **Pause/resume** — serialize thread to storage, deserialize to resume. Enables human-in-the-loop, long-running ops, session recovery.

9. **Approval gates** — controller pauses between tool selection and execution for high-stakes operations. CEO approval via tool call pattern.

10. **Auto-recall integration** — Gigabrain-equivalent that surfaces relevant PARA facts into context engineer before each turn.

11. **Error compaction** — consecutive failure tracking, escalation after 3 failures, resolved error pruning from context.

---

## Phase 4: Scale (Specialists + Cross-Session + Triggers)

12. **Specialist agents** — bounded workers for specific domains. Fresh context per invocation. Structured input/output contracts.

13. **Cross-session recall** (optional) — OpenStinger-equivalent for semantic/temporal search.

14. **Multi-channel triggers** — launch from CLI, webhooks, scheduled tasks.

---

## Work Process Per Phase

For each item:

| Step | Action |
|---|---|
| **Define** | Scope, contract, expected outputs, acceptance criteria |
| **Implement** | Bounded implementation package |
| **Verify** | Independent verification: correctness, contract adherence, tests, runtime behavior |
| **Record** | Update decision board, backlog, learning artifacts |

Rule: do not broaden scope mid-step.

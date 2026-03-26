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

## Phase 2: Intelligence (Classifier + COO + Tool Registry)

5. **Intent classifier** — small bounded LLM call per turn. Zod-validated structured output. Decides: direct COO response, tool path, specialist path, clarification, pushback.

6. **COO agent** — the user-facing reasoning worker. Called as a function per turn with assembled context. Emits structured outputs. Does not maintain internal state.

7. **Tool schema registry** — tools defined as Zod types. Discovery via registry, not hardcoded lists. Each tool has a contract: input schema, output schema, side effects, approval requirements.

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

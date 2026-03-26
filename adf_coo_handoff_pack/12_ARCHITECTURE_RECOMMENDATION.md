# Architecture Recommendation: 12-Factor-Agents + Memory-Stack

## Decision

Build ADF v2 as a **fresh project in a new directory/repo**. Import proven components from ProjectBrain as needed. Do not build from within the current structure.

## Why Fresh Start

1. The handoff pack (files 01-11) diagnoses the problem as architectural. The current ADF structure — scattered files, PowerShell-first governance, prose-based rules, bootstrap spread across surfaces — is the root cause of drift. Building inside it inherits the confusion.

2. 12-factor-agents explicitly describes this inflection point: teams reach 70-80% with a framework, realize it is not acceptable, reverse-engineer it, and start over. The handoff pack IS the reverse-engineering. The next step is a clean build.

3. The "build from within" approach already failed once. Risk R-001 in the handoff pack: "Premature implementation before architecture freeze — this already happened once." Risk R-003: "New code keeps landing in old scattered style."

4. The fundamental execution model is changing. Going from "long-running COO session that drifts" to "stateless reducer with externalized state" is not a refactor. It is a different architecture.

5. Memory-stack is designed as a portable installer that creates its own clean structure. It works best as a foundation, not a patch.

---

## Two Systems, One Architecture

### 12-Factor-Agents (Execution Layer)

Source: https://github.com/humanlayer/12-factor-agents/tree/main
Author: Dex Horthy / HumanLayer

12-factor-agents is a set of design principles for building production-grade LLM-powered software. It is not a framework or library. It describes what teams who ship reliable agents actually do.

**Core premise**: Good production agents are mostly software, with model calls at the right places. The agent itself is a stateless reducer — a pure function that takes accumulated state (the thread) and produces the next event.

### Memory-Stack (Knowledge Layer)

Source: `C:\ProjectBrain\ADF\WAT\MD-examples\memory-stack`

Memory-stack is a 6-layer separation-of-concerns architecture for agent memory. Each layer solves exactly one memory problem. It was designed as a portable, non-destructive installer kit.

### How They Relate

They are complementary, not competing. 12-factor-agents tells you how to build the agent loop. Memory-stack tells you how to structure persistent knowledge. You need both.

| Concern | 12-Factor-Agents | Memory-Stack |
|---|---|---|
| In-session state | Thread = ordered event list | LCM (session recovery) |
| Cross-session memory | "Another input to context — you own retrieval" | PARA (durable facts), OpenStinger (semantic recall) |
| Context construction | `thread_to_prompt()` custom engineering | Gigabrain (auto-recall pre-prompt) |
| Agent architecture | Stateless reducer, deterministic controller | Not covered — memory only |
| Bootstrap/routing | Own your prompts, own your control flow | MEMORY.md (routing), AGENTS.md (rules) |
| State persistence | Serialize thread to DB | PARA files, daily residue files |

The integration point is the **context engineer** — the function that assembles each turn's LLM context from thread events (12-factor) + durable knowledge (PARA) + auto-recalled memory (Gigabrain) + daily residue + owned prompts.

### One Tension: LCM vs Thread-as-State

Memory-stack's LCM (Layer B — session recovery) overlaps with 12-factor's thread. In 12-factor, the thread IS the session state — serializable, resumable, forkable. LCM becomes redundant for the controller's execution state. However, LCM retains value for the COO conversation layer — the human-facing dialogue that sits on top of the controller. Resolution: keep LCM scoped to the COO conversation, not the controller execution state.

---

## The 12 Factors — Detailed Reference

### Factor 1: Natural Language to Tool Calls

The atomic unit of an agent is converting natural language into structured JSON that triggers deterministic code. An LLM reads a user request, emits a structured object (function name + parameters), and deterministic code executes it.

**Pattern**: User says "create a payment link for $750" -> LLM outputs `{ "function": "create_payment_link", "amount": 750 }` -> your code calls the API.

**ADF v2 implication**: Every tool interaction follows this pattern. The COO reasoning layer emits structured outputs. The controller dispatches them. No magic routing.

### Factor 2: Own Your Prompts

Treat prompts as first-class code. Do not hide them behind framework abstractions that expose only `role`, `goal`, and `personality` knobs. Write prompts explicitly in the codebase. Version them. Test them.

**ADF v2 implication**: Every prompt — COO system prompt, classifier prompt, specialist prompts — lives as a versioned file in a `prompts/` directory. Not embedded in bootstrap docs. Not scattered across AGENTS.md. Owned, tested, iterable.

### Factor 3: Own Your Context Window (Context Engineering)

The context window is the primary interface with the LLM. Control exactly what goes into it.

**Five categories of context**:
1. System prompt and instructions
2. Retrieved documents (RAG / memory)
3. Past state: tool calls, results, history (the thread)
4. Cross-session memory from prior conversations
5. Output format instructions

**Key pattern — custom context format**: Instead of standard chat message arrays, build custom XML-tagged event formats packed into a single user message. Maximum control over token efficiency and attention allocation.

```python
class Thread:
  events: List[Event]

class Event:
  type: Literal["user_input", "tool_call", "tool_result", "error", ...]
  data: Union[UserInput, ToolCall, ToolResult, str, ...]

def event_to_prompt(event: Event) -> str:
    data = event.data if isinstance(event.data, str) \
           else stringifyToYaml(event.data)
    return f"<{event.type}>\n{data}\n</{event.type}>"

def thread_to_prompt(thread: Thread) -> str:
  return '\n\n'.join(event_to_prompt(event) for event in thread.events)
```

**ADF v2 implication**: The context engineer function is a core component. It assembles thread events + PARA facts + auto-recalled memory + daily residue + owned prompts into a single optimized context per LLM call. It can filter resolved errors, summarize verbose results, and prune stale context.

### Factor 4: Tools Are Just Structured Outputs

A "tool call" is the LLM emitting structured JSON that your deterministic code routes via a switch statement. The LLM decides what to do; your code controls how.

**ADF v2 implication**: Define tool schemas as Zod types. The LLM outputs JSON matching one schema. The controller dispatches via match/switch. Tools are your code, not the LLM's. The tool registry is a typed catalog, not a hardcoded list.

### Factor 5: Unify Execution State and Business State

Most agent architectures maintain two separate state stores — execution state (current step, retry counts) and business state (conversation history, tool results). This is unnecessary. Merge them.

**The thread IS the state**: If the context window contains the full event history, all execution metadata is derivable. "Current step" = last event. "Waiting for human" = last event is `request_human_input`. No separate state machine.

**Seven benefits**:
1. Single source of truth — one thread object
2. Trivially serializable — save/load as JSON
3. Complete debug history — every event visible
4. Extensible — new state = new event type
5. Resumable — load thread, continue from last event
6. Forkable — copy subset of events into new thread
7. UI-friendly — render threads as dashboards

**What stays outside**: Session IDs, passwords, secrets — things that must never enter the context window.

**ADF v2 implication**: No separate execution state store. The thread object is the controller's entire state. Persist it to disk/DB. Resume by loading it. Debug by replaying it.

### Factor 6: Launch/Pause/Resume with Simple APIs

An agent must be launchable, pausable, and resumable via simple APIs.

**Three capabilities**:
1. Launch — simple API to start from any context
2. Pause — halt during long-running ops or human-in-the-loop waits
3. Resume — external triggers resume from exactly where it paused

**Critical requirement**: You must be able to pause between tool selection (LLM deciding what to do) and tool execution (actually doing it). This enables human approval gates.

**Implementation**: Since thread IS the state, pause = serialize thread to storage. Resume = deserialize and call `determine_next_step()` again.

**ADF v2 implication**: The controller loop must support pause points. When the COO requests human approval or a long-running tool, the thread is serialized, the loop stops, and a webhook/trigger resumes it later.

### Factor 7: Contact Humans with Tool Calls

Human interaction is a tool call, not a special code path. The LLM emits `request_human_input` structured output like any other tool.

```typescript
interface RequestHumanInput {
  intent: "request_human_input";
  question: string;
  context: string;
  urgency: "low" | "medium" | "high";
  response_format: "free_text" | "yes_no" | "multiple_choice";
}
```

**Workflow**: Agent emits request -> system serializes state, sends notification -> human responds -> webhook fires with thread ID + response -> agent resumes.

**ADF v2 implication**: The CEO (user) interaction is modeled as a tool call. This unifies in-session CEO requests with async notifications. Human responses become thread events like any other.

### Factor 8: Own Your Control Flow

Write your own agent loop. Do not rely on a framework's generic loop.

**Three patterns**:
1. Async interrupts — break loop, wait for webhook, resume
2. Sync passes — fetch data, append to context, continue immediately
3. Approval gates — pause for human authorization before executing

**Additional loop capabilities**: result summarization/caching, LLM-as-judge validation, context window management (compaction, pruning), logging/monitoring, rate limiting, durable pause/resume.

**ADF v2 implication**: The controller IS the control flow. It is a TypeScript program, not a framework invocation. Every routing decision, every gate, every error recovery path is explicit code.

### Factor 9: Compact Errors into Context Window

When a tool call fails, append the error as a thread event and let the LLM try to recover. LLMs are good at reading error messages and adjusting.

**Guard against spin-outs**: Track consecutive error count. After ~3 consecutive failures on the same tool, escalate. Also remove resolved error events from context to keep it clean.

**ADF v2 implication**: Errors are thread events. The context engineer can prune resolved errors. The controller tracks consecutive failure count and escalates to the CEO when stuck.

### Factor 10: Small, Focused Agents

Keep agents narrowly scoped. As context windows grow, LLMs lose focus. Optimal agents handle 3-10 steps, maybe 20 maximum.

**Pattern**: Compose multiple small agents within a deterministic workflow. The outer workflow is code; focused agents handle specific decision steps.

**ADF v2 implication**: The COO is one focused agent. Specialists are separate focused agents. The controller orchestrates them. No mega-agent that does everything. Each agent call is bounded — fresh context, scoped purpose, structured output.

### Factor 11: Trigger from Anywhere

Agents should be activatable from any channel — CLI, Slack, webhooks, scheduled tasks, system alerts.

**ADF v2 implication**: The controller exposes a simple launch API. The CEO can interact via Claude Code CLI, but the architecture does not depend on it. Future: Slack, webhooks, scheduled triggers.

### Factor 12: Make Your Agent a Stateless Reducer

An agent is a `fold`/`reduce` function: `next_event = agent(thread)`. It holds no internal state between invocations. The thread is the state. The agent is a pure function over it.

**ADF v2 implication**: This is the core architectural principle. The controller calls the COO as a function: given this thread, what is the next event? The COO does not maintain internal state. Continuity comes from the thread + externalized memory (PARA), not from a long-running session.

### Factor 13 (Honorable Mention): Pre-fetch Context

If you know what data the model will need, fetch it deterministically before calling the LLM. Do not waste a round-trip letting the model ask for it.

**ADF v2 implication**: The controller pre-fetches relevant PARA facts, today's daily residue, open loops, and tool registry before calling the COO. The COO sees a pre-assembled context, not a set of tools it needs to call to gather information.

---

## The 6-Layer Memory-Stack — Detailed Reference

### Layer A: Routing and Bootstrap (Files)

- **MEMORY.md**: Tiny routing/index layer. Uses retrieval model, not preload. Never becomes a fact warehouse.
- **AGENTS.md**: Durable operating rules, ownership, approvals, stop behavior. Stays lean. Rules that must survive compaction live here.

### Layer B: Session Recovery and Compaction (LCM)

- **lossless-claw (LCM)**: Current-thread context preservation and recovery.
- Handles session-local compaction and recovery.
- Explicitly NOT canonical long-term truth.
- In ADF v2: scoped to the COO conversation layer, not the controller execution state (which uses 12-factor thread-as-state).

### Layer C: Durable Knowledge / Source of Truth (PARA)

- **PARA** structure in a canonical directory.
- Four areas: `projects/`, `areas/`, `resources/`, `archives/`.
- Each contains: `summary.md` (cheap read) + `items.json` (atomic facts).
- Rules: Atomic entries, supersede outdated facts (don't delete), never store secrets.
- This is the single source of truth for facts that must survive across everything.

### Layer D: Daily Residue and Short-Horizon Continuity

- **memory/YYYY-MM-DD.md**: Daily timeline and execution residue.
- Captures what happened today, short-term notes, session artifacts.
- Quick context recovery within current work session.

### Layer E: Automatic Recall and Capture (Gigabrain)

- Memory slot plugin for automatic pre-prompt recall/capture.
- Features: Deduplication, vault mirroring.
- Makes useful facts surface automatically without explicit retrieval requests.
- In ADF v2: this feeds the context engineer. Before each turn, relevant facts are auto-retrieved and injected into the context window.

### Layer F: Cross-Session Graph Recall (OpenStinger, Optional)

- Semantic + temporal recall across sessions.
- Optional in v1. Runs alongside PARA, not as a replacement.
- Solves: "I know I decided this before but can't remember when/where."

### Memory-Stack Design Principles

1. **File truth beats magic** — durable truth lives in files, not hidden config.
2. **Tiny bootstrap** — MEMORY.md and AGENTS.md stay lean and focused.
3. **Layer separation** — each layer has exactly one job.
4. **Patch, don't replace** — managed insert blocks, not wholesale rewrites.
5. **Optional upgrades** — OpenStinger is additive, not required.
6. **Non-destructive** — backups before any modification.
7. **Human review stays in loop** — config changes proposed, not blindly applied.

---

## What Needs To Be Built

### Phase 1: Foundation (Memory + Thread + Controller Shell)

These must exist before anything else works:

1. **Thread model** (TypeScript + Zod) — typed event list. Event types: `user_input`, `classifier_result`, `tool_call`, `tool_result`, `coo_response`, `error`, `human_request`, `state_commit`. Single source of truth per session.

2. **Memory-stack foundation** — PARA structure, daily residue directory, MEMORY.md routing, AGENTS.md rules. Install the file-backed knowledge layer first.

3. **Controller loop** (TypeScript) — deterministic orchestrator. Takes thread -> calls `determine_next_step()` -> executes -> appends event -> loops or pauses. Not an LLM. A stateless reducer.

4. **Context engineer** — `thread_to_prompt()` function. Assembles thread events + PARA facts + auto-recalled memory + daily residue + owned prompts into optimized context per LLM call.

### Phase 2: Intelligence (Classifier + COO + Tool Registry)

5. **Intent classifier** — small bounded LLM call per turn. Zod-validated structured output. Decides: direct COO response, tool path, specialist path, clarification, pushback.

6. **COO agent** — the user-facing reasoning worker. Called as a function per turn with assembled context. Emits structured outputs. Does not maintain internal state.

7. **Tool schema registry** — tools defined as Zod types. Discovery via registry, not hardcoded lists. Each tool has a contract: input schema, output schema, side effects, approval requirements.

### Phase 3: Resilience (Pause/Resume + Gates + Auto-Recall)

8. **Pause/resume** — serialize thread to storage, deserialize to resume. Enables human-in-the-loop, long-running ops, session recovery.

9. **Approval gates** — controller pauses between tool selection and execution for high-stakes operations. CEO approval via tool call pattern.

10. **Auto-recall integration** — Gigabrain-equivalent that surfaces relevant PARA facts into context engineer before each turn.

11. **Error compaction** — consecutive failure tracking, escalation after 3 failures, resolved error pruning from context.

### Phase 4: Scale (Specialists + Cross-Session + Triggers)

12. **Specialist agents** — bounded workers for specific domains. Fresh context per invocation. Structured input/output contracts.

13. **Cross-session recall** (optional) — OpenStinger-equivalent for semantic/temporal search.

14. **Multi-channel triggers** — launch from CLI, webhooks, scheduled tasks.

---

## What To Import From ProjectBrain

### Import (proven, valuable):
- **Tech Council** — proven advisory mechanism. Port the logic, not the files.
- **agent-role-builder** — proven concept. Port after live roster fix.
- **Tool Builder v2.1** — base template for specialist roles. Port the template.
- **Locked decisions from handoff pack** (D-001 through D-016) — still valid. They inform the new build.
- **Memory-stack design** — install as knowledge layer foundation.
- **Brain MCP server** — if it works as a service, it can serve the new system.
- **Design guides and review processes** — the methodology, not the files.

### Do NOT import:
- Current AGENTS.md / bootstrap chain
- Current COO role definition
- Current folder structure
- Current PowerShell governance scripts
- Current scattered tool inventories
- Any file whose purpose is unclear without reading 3 other files

---

## Suggested Directory Structure

```
adf-v2/
  controller/                    # Node.js/TS stateless reducer
    src/
      loop.ts                    # main control loop
      context-engineer.ts        # thread_to_prompt()
      classifier.ts              # intent classification
      thread.ts                  # Thread + Event types (Zod)
      tools.ts                   # tool registry + dispatch
    package.json
    tsconfig.json
  memory/                        # memory-stack Layer D (daily residue)
    YYYY-MM-DD.md
  knowledge/                     # memory-stack Layer C (PARA)
    projects/
    areas/
    resources/
    archives/
  tools/                         # tool packages (contract-based)
  roles/                         # role packages (slug-prefixed)
  schemas/                       # shared Zod schemas + JSON Schema exports
  prompts/                       # owned prompt templates (versioned)
  decisions/                     # decision board (imported from handoff)
  threads/                       # persisted thread state (JSON)
  MEMORY.md                      # memory-stack Layer A (routing index)
  AGENTS.md                      # thin rules that survive compaction
  CLAUDE.md                      # agent bootstrap pointer
```

---

## Technology Stack (Confirmed)

- **Controller runtime**: Node.js + TypeScript
- **Process orchestration**: `node:child_process`
- **Schemas / validation**: Zod (TypeScript-native) + JSON Schema (export for external consumers)
- **Thread persistence**: JSON files initially, DB later if needed
- **Memory persistence**: Files (PARA structure)
- **LLM calls**: Direct API (Anthropic SDK / OpenAI SDK), not through a framework
- **PowerShell / shell**: Only for leaf adapters and existing Windows-centric tools
- **Python**: Allowed for specialist tools, not the controller

---

## References

- 12-factor-agents: https://github.com/humanlayer/12-factor-agents/tree/main
- Anthropic — Building Effective Agents: https://www.anthropic.com/engineering/building-effective-agents
- Model Context Protocol SDKs: https://modelcontextprotocol.io/docs/sdk
- LangGraph Durable Execution: https://docs.langchain.com/oss/javascript/langgraph/durable-execution
- Memory-stack source: `C:\ProjectBrain\ADF\WAT\MD-examples\memory-stack`
- ADF COO Handoff Pack: `C:\ProjectBrain\prompts\adf_coo_handoff_pack\` (files 00-11)

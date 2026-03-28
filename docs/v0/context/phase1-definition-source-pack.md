# Phase 1 Definition Source Pack

Status: active reference pack
Last updated: 2026-03-29
Purpose: preserve the current source set for Phase 1 company-definition, feature-flow, and requirements-gathering decisions so future agents do not need the CEO to restate it.

---

## How To Use This Pack

Use this pack before asking the CEO a new Phase 1 design, workflow, queue, or requirements question.

Required protocol:

1. Check the relevant sources in this pack first.
2. Summarize the findings that already exist.
3. Give a recommendation.
4. Ask only the smallest unresolved question.

Do not ask the CEO a broad design question if the answer is already present in these sources.

---

## Source Priority

Use the sources in this order:

1. Canonical workflow and requirement artifacts
2. Seed-case requirement artifacts that preserved prior intent
3. Discussion threads that contain approved or near-approved intent not yet promoted into governed artifacts

---

## Registered Sources

### 1. ProjectBrain canonical requirements workflow

- Source: [requirements-gathering.md](C:/ProjectBrain/ADF/WAT/Workflows/requirements-gathering.md)
- Type: canonical workflow reference
- Why it matters:
  - defines the explicit requirements-gathering and freeze workflow
  - preserves one-question-at-a-time clarification
  - preserves UI freeze when UI is involved
  - preserves explicit freeze and readiness gates
  - preserves working-artifact discipline instead of leaving truth only in chat

### 2. LangGraph seed requirement artifact

- Source: [langgraph-intent-proof-gaps-requirements.json](C:/ProjectBrain/Tasks/langgraph-intent-proof-gaps/requirements/langgraph-intent-proof-gaps-requirements.json)
- Type: seeded requirement artifact carrying preserved user intent and framework corrections
- Why it matters:
  - captures feature-mode intake expectations explicitly
  - preserves the rule that vague high-level input is valid
  - preserves reflect-for-approval before detailed low-level contract derivation
  - preserves audit-trace and proof-of-implementation expectations
  - serves as the main durable bridge from earlier discussion into later framework requirements

### 3. Claude discussion thread `fe414e1e-ec03-430b-ad0c-05662a3f4fda`

- Source: [history.jsonl](C:/Users/sufin/.claude/history.jsonl)
- Type: discussion-source thread
- Why it matters:
  - contains the clearest explicit statement that requirements remain open until the user is asked whether more should be added and gives freeze approval
  - reinforces that the agent must verify enough information exists to pass to review
  - carries the learning-loop orientation around review failures, guides, and repeated self-checking
  - is the reference thread mentioned by the CEO for phase, run, and cycle-level postmortem thinking
  - contains the strongest early statement of an outer-scope object before technical requirements, including goal, executive summary, expected result, testing view, and later subtopic clarification

Key preserved finding:

- `the requirements are open` means:
  - check whether the user has more to add
  - get user approval to freeze the requirements
  - verify enough information exists to pass to review
  - otherwise keep clarifying
- a feature should first be understood as a human-facing scope object before it is turned into a technical requirement package

### 4. Codex discussion thread `019cdbb4-e909-7491-b583-efaa955ea5c1`

- Source: [rollout-2026-03-11T09-03-12-019cdbb4-e909-7491-b583-efaa955ea5c1.jsonl](C:/Users/sufin/.codex/sessions/2026/03/11/rollout-2026-03-11T09-03-12-019cdbb4-e909-7491-b583-efaa955ea5c1.jsonl)
- Type: discussion-source thread
- Why it matters:
  - preserves the feature-mode intake direction before it was fully documented in ADF
  - contains user expectations around feature terminology, expected-result markers, and source-trace fidelity
  - is one of the main discussion sources later preserved inside the LangGraph seed requirement artifact
  - preserves the distinction between outer-scope clarification and later low-level contract writing

Key preserved finding:

- feature intake should work as:
  - user starts high-level
  - the COO guides clarification
  - the COO reflects a human-facing high-level summary for approval
  - only then does the COO derive the detailed low-level requirement contract

### 5. Codex ADF discussion thread `019d2c3c-a887-7140-bce3-778e169396f4`

- Source: [history.jsonl](C:/Users/sufin/.codex/history.jsonl)
- Type: current ADF architectural discussion thread
- Why it matters:
  - contains the current virtual-company framing
  - defines the CEO/COO/CTO high-level company model
  - defines the executive briefing model
  - defines the current Phase 1 feature-flow framing and queue semantics
  - defines the current context-service direction and the need for a production-grade context layer

Key preserved finding:

- Phase 1 is an implementation-focused startup
- the first supported work type is `feature`
- the CEO-facing briefing is:
  - `Issues That Need Your Attention`
  - `On The Table`
  - `In Motion`
  - `What's Next`

### 6. Claude ADF discussion thread `f848183c-6e28-46d1-bae2-7bf7e2ef16b9`

- Sources:
  - [session artifact folder](C:/Users/sufin/.claude/projects/C--ADF/f848183c-6e28-46d1-bae2-7bf7e2ef16b9)
  - example saved subagent trace: [agent-a0013b6f1bd8370f0.jsonl](C:/Users/sufin/.claude/projects/C--ADF/f848183c-6e28-46d1-bae2-7bf7e2ef16b9/subagents/agent-a0013b6f1bd8370f0.jsonl)
- Type: supplemental ADF implementation discussion and artifact-analysis source
- Why it matters:
  - the transcript is only partially reconstructable from saved artifacts, but it is still a valid source pack entry the CEO explicitly named
  - it contains ADF-side exploration of tool-builder semantics, Brain/memory-engine code, and related governed-tooling context
  - it is useful when Phase 1 questions touch tool-governance, update/fix semantics, or related operational ADF implementation context

Current usable summary:

- the saved artifact trail shows ADF implementation-side analysis of:
  - tool-builder create vs update/fix semantics
  - Brain/memory-engine code surfaces
  - governed-tooling and runtime support context

### 7. Current synthesis draft

- Source: [phase1-feature-flow-and-executive-briefing-draft.md](C:/ADF/docs/v0/context/phase1-feature-flow-and-executive-briefing-draft.md)
- Type: current ADF synthesis draft
- Why it matters:
  - this is the current combined discussion record inside ADF
  - it is the fastest local handoff surface for a contextless agent
  - it already distills the current high-level agreements into one resumable document

---

## Current Combined Requirements-Gathering Findings

When the sources above are combined, the current requirements-gathering understanding is:

1. The user may start vague and high-level.
2. The COO should stay operator-facing and non-technical by default.
3. The COO should ask one question at a time.
4. The COO should gather the feature as a human-facing **onion**, peeling from the outside in.
5. The outer shell should lock:
   - topic and goal
   - expected result
   - success view from the CEO point of view
6. Only after the outer shell is clear should the COO peel inward into:
   - major feature parts
   - per-part clarification
   - UI/experience meaning when relevant
   - boundaries, non-goals, and constraints
7. If UI is involved, UI alignment and a mockup or preview loop belong inside requirements shaping.
8. The COO should present the **whole onion** for user approval before deriving the detailed requirement contract.
9. Requirements freeze must be explicit, not silent.
10. Before freeze, the COO must check whether the user has more to add.
11. Before handoff, the COO must verify the scope is complete enough to pass review without guessing.
12. After freeze, the detailed requirement artifact must preserve the approved human meaning rather than replacing it.
13. Review failure and phase failure should feed learning and guide improvement.
14. Audit trace and agent/session traceability matter and should not be treated as optional.

Related local synthesis:

- [phase1-feature-flow-and-executive-briefing-draft.md](C:/ADF/docs/v0/context/phase1-feature-flow-and-executive-briefing-draft.md)
- [requirements-gathering-onion-model.md](C:/ADF/docs/v0/context/requirements-gathering-onion-model.md)

---

## Question-Asking Protocol For Future Agents

Before asking the CEO a new Phase 1 design or workflow question:

1. Read the relevant sources from this pack.
2. Start with `What I found`.
3. Give a short recommendation.
4. Ask one focused unresolved question.

Expected shape:

- `What I found: ...`
- `Recommendation: ...`
- `Question: ...`

Do not send a blob of speculative questions when the sources already answer most of them.

---

## Scope Note

This pack is a research-source registry and synthesis aid.

It is not the final governed authority.

When a source here is later promoted into a governed ADF workflow, contract, or decision, that governed artifact should take precedence.

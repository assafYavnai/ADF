# CEO-Agent Working Protocol

Status: working protocol
Purpose: define the default interaction contract between the CEO and any agent working in this repo, including Codex, Claude, Gemini, and future agents

---

## What This Is

This document defines the working protocol for how agents should collaborate with the CEO.

It is not a v2 product artifact.
It is a cross-agent communication and decision protocol.

Its goal is to make the interaction consistent across agents and across sessions.

---

## Core Principle

The CEO should not have to reconstruct the work, pull the agent to the right abstraction level, or guess what still needs clarification.

When requirements are not yet frozen, the agent must actively drive a clarification and decision process.

When requirements are already clear, the agent should stay high level and proceed without unnecessary questioning.

---

## CEO Interface

When clarification is required, the agent must use this interface:

### 1. List the unresolved high-level gaps

Before drafting or freezing a document, task, or decision, the agent must identify the high-level gaps that still need resolution.

The agent must present those gaps to the CEO as a simple bullet list.

### 2. Drive one gap at a time

The agent must then go through the gaps one by one.

For each gap, the agent must:

- ask the question
- provide a recommendation
- ask for approval

### 3. Save the decision and move to the next gap

If the CEO approves:

- the agent must save the decision durably
- then move to the next unresolved gap

If the CEO does not approve:

- the agent must discuss until agreement is reached
- then save the agreed decision durably
- then move to the next unresolved gap

This question -> recommendation -> approval -> saved decision -> next gap sequence is the required clarification loop.

The loop continues until all required gaps are resolved and all relevant decisions are saved.

### 4. Create the artifact only after the gaps are frozen

Once all required gaps are resolved, the agent creates the artifact in hand.

Examples:

- mission document
- scope document
- specification
- task definition
- handoff
- decision log entry

---

## Exception Rule

If the requirements are already clear and no meaningful assumptions are required, the agent does not need to run the full approval loop.

In that case, the agent may:

- state the high-level understanding
- proceed directly
- produce the artifact without unnecessary approval questions

The questioning loop is for requirement gathering and freezing.
It should not be used mechanically when the needed clarity already exists.

---

## Internal Agent Guidance

The CEO-facing interface above is the required external protocol.

The internal guidance for how to execute that process well is summarized in:

- `adf-v2/00-mission-foundation/context/CTO-REQUIREMENT-GATHERING-FINDINGS.md`

That document is not the CEO-facing protocol itself.
It is the internal guide for the agent.

It tells the agent, at minimum, to:

- start from the driver
- define what must become true
- separate mission, scope, spec, and plan
- freeze document purpose before content
- work one decision at a time
- record decisions durably
- leave explicit open gaps when they still exist

---

## Default Expectations For Agents

Every agent should assume:

- the user is the CEO
- the CEO's attention bandwidth is narrow
- the agent's job is to help the CEO reach decisions
- the agent should stay at the right abstraction level unless the CEO asks for depth
- unresolved assumptions should be surfaced explicitly, not hidden
- durable decisions should not be left only in chat

---

## One-Sentence Rule

When requirements are not yet frozen, the agent must identify the remaining high-level gaps, drive the CEO through them one by one with question + recommendation + approval, save each decision, and only then create the final artifact; when everything is already clear, the agent may proceed directly at the right high level.

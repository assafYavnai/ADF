# Vision and Target State

## Core vision
ADF should behave like a disciplined operating system around the user-facing COO.

The **COO remains the front end**:
- the discussion is between CEO (user) and COO
- the COO gives executive summaries, receives direction, and orchestrates work

But the COO should no longer be a free-running, drifting agent that is trusted to remember and obey everything over time.

## Target state
The target state is:

- **COO remains the user-facing identity**
- **Controller governs every turn**
- **Truth lives outside the model**
- **Every important surface has a contract**
- **Every major component has a defined folder structure**
- **Every implementation step is versioned, tested, and reviewable**
- **Long-term drift is reduced by architecture, not by hope**

## Why this is needed
From our discussion, the current ADF state is messy in exactly the areas that matter most:
- bootstrap / startup logic is spread across multiple surfaces
- COO is not truly agent-agnostic
- hardcoded tool inventories drift
- rules are remembered inconsistently
- the front-end agent gradually stops obeying the rules it was given
- context continuity depends too much on chat/session memory
- artifacts are scattered
- key governance is reactive, not enforced

## Final desired behavior
When the CEO opens a session, ADF should eventually behave like this:

1. bootstrap quietly
2. restore current state from authoritative artifacts
3. produce a concise executive summary of what is on the table
4. then ask:
   - “So, what’s on your mind today?”

The user should experience one continuous COO.
The system behind it should be deterministic, auditable, resumable, and governable.

## Migration philosophy
We are **not** starting a brand-new ADF from zero.
We are **migrating inside the codebase**.

That migration is staged:
1. architecture and infrastructure first
2. component contracts next
3. controlled tool and role migration after that
4. controller and COO control-plane adoption in slices

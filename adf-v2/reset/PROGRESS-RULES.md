# Reset Progress Rules

Status: active reset discipline
Purpose: define how progress is recorded so truth does not drift or disappear between sessions

## Rule 1 — Repo truth first

If a session materially changes reset understanding, update repo truth in the same session.
Do not leave the new truth only in chat.

## Rule 2 — Frozen decisions go to `DECISIONS.md`

A decision is only considered frozen once it is written into `DECISIONS.md`.
Until then, it remains provisional.

## Rule 3 — `STATE.md` tracks operational truth

Update `STATE.md` whenever any of these changes:
- current stage
- current objective
- current blocker
- current next step
- active reset direction

## Rule 4 — `OPEN-ITEMS.md` contains unresolved items only

When something is resolved:
- remove or close it in `OPEN-ITEMS.md`
- record the frozen result in `DECISIONS.md`

## Rule 5 — Commit on meaning

Create a commit when any of these happen:
- top truth changes
- a reset decision is frozen
- carry-over classification changes materially
- archive/delete policy changes
- handoff/state/context changes materially enough that a new session would benefit

## Rule 6 — No destructive reset without prior truth freeze

Do not archive/delete/retire legacy code or project-brain surfaces unless:
- top truth is written
- carry-over classification exists
- the destructive move is justified by a frozen decision

## Rule 7 — Handoff is mandatory at session boundary

If work is unfinished and non-trivial, update before stopping:
- `STATE.md`
- `OPEN-ITEMS.md`
- `HANDOFF.md`
- `NEXT-STEP-HANDOFF.md`

## Rule 8 — New agents/sessions must enter through the reset pack

Until `AGENTS.md` is patched, new sessions must manually start at:
- `adf-v2/README.md`
- `adf-v2/reset/README.md`
- `adf-v2/reset/STATE.md`
- `adf-v2/reset/DECISIONS.md`

## Rule 9 — Legacy must stay labeled

If a legacy/v1 surface is referenced during reset work, it must be treated as:
- reference-only, or
- explicitly classified otherwise

No silent promotion from legacy reference to active v2 truth.

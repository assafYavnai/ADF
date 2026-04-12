# $CTO Implementation Plan

Status: active implementation plan
Scope: `skills/cto/`
Purpose: turn the `$CTO` design into a bounded implementation slice in this branch

---

## Objective

Implement the first governed `$CTO` reference product under ADF so it has:

- durable product docs
- a strict tagged role contract
- deterministic context gathering
- a governor that can return either direct answers or packet-mode guidance
- verification steps that can be rerun after changes

---

## Step 1 - Product documentation

Deliver:

- `references/requirements.md`
- `references/design.md`
- `references/implementation-plan.md`

Acceptance:

- the product chain exists in repo truth
- requirements, design, and plan are distinguishable
- the 4-layer context groundwork is explicitly represented

---

## Step 2 - Strict role contract

Deliver:

- `references/role-contract.xml`

Acceptance:

- contract uses structured tags
- rules are explicit
- every rule has definition, expected outcome, example, do-not, and avoid

---

## Step 3 - Deterministic helper expansion

Deliver:

- extend `scripts/cto-helper.mjs`

Acceptance:

- helper still supports `status`, `readiness`, and `gaps`
- helper also supports a general `context` route for packet-mode answers
- helper exposes the 4 context layers, with explicit stubs where needed
- helper reconciles promoted canon vs checkpoint handoff instead of assuming they always match
- helper emits an explicit fundamental next question plus recommendation

---

## Step 4 - Governor packet mode

Deliver:

- extend `scripts/cto-governor.mjs`
- add `scripts/cto-launcher.mjs`

Acceptance:

- governor still supports direct route handling
- governor now returns `answer_mode=packet` for governed non-direct prompts
- packet contains role contract, response contract, and layered context
- packet enforces same-pass truth propagation and explicit next-step output
- launcher and governor support file-based request/response transport

---

## Step 5 - Skill wiring

Deliver:

- update `SKILL.md`
- update `agents/openai.yaml`
- update `references/usage.md`
- update `skills/manifest.json` if required runtime files changed

Acceptance:

- skill instructions clearly require governor-first behavior
- skill instructions explicitly forbid recap-without-next-step behavior
- skill instructions require file transport by default
- skill instructions enforce the CEO-high-level / CTO-derivation boundary
- the live runtime has the files it needs after install

---

## Step 6 - Verification loop

Run:

1. `node --check skills/cto/scripts/cto-helper.mjs`
2. `node --check skills/cto/scripts/cto-governor.mjs`
3. `node --check skills/cto/scripts/cto-launcher.mjs`
4. `node skills/cto/scripts/cto-self-check.mjs`
5. `node skills/cto/scripts/cto-helper.mjs status`
6. `node skills/cto/scripts/cto-helper.mjs readiness`
7. `node skills/cto/scripts/cto-helper.mjs gaps --limit 3`
8. `node skills/cto/scripts/cto-helper.mjs context`
9. write `$CTO what is the current status of v2?` into an input file and run `node skills/cto/scripts/cto-launcher.mjs --input-file ... --output-file ...`
10. write `$CTO define what is still missing before implementation starts` into an input file and run `node skills/cto/scripts/cto-launcher.mjs --input-file ... --output-file ...`
11. install the skill into Codex
12. rerun `node skills/cto/scripts/cto-self-check.mjs`
13. run at least one live `$CTO` smoke prompt through native invocation
14. verify that the live answer names the fundamental next step explicitly instead of stopping at status recap
15. verify the output keeps the CEO at the governing-object level instead of asking for lower-layer design

Acceptance:

- scripts remain valid
- packet mode works
- install succeeds
- live output is closer to the governed contract than the prior ungoverned behavior

---

## Known Risk To Watch

The native runtime may still freewheel past the governed path even when the local scripts and skill docs are correct.

If that happens:

- do not hide it
- record it as a remaining gap in the implementation result
- preserve the deterministic packet route anyway, because it is still the right product foundation

---

## Done Condition

This slice is done when:

- the product docs exist
- the role contract exists
- helper and governor support the new architecture
- skill wiring is updated
- validation loop passes for local script surfaces
- native live smoke is rerun and assessed truthfully

---

## One-Sentence Plan Summary

Build the `$CTO` reference implementation in one bounded slice: document the product, define the tagged role contract, extend helper and governor for layered packets, wire the skill to use them, and verify the result through repeatable local and live checks.

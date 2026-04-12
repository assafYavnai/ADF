# $CTO Design

Status: working design
Scope: `skills/cto/`
Purpose: translate the `$CTO` requirements into a concrete script-governed skill design

---

## Design Summary

The `$CTO` skill is designed as a split system:

- deterministic scripts derive authoritative CTO context
- the LLM reasons and speaks only from the derived packet

This mirrors an already-proven repo pattern:

- derive state first
- render natural language second

The design intentionally avoids a prompt-only role surface.

It is also designed to preserve same-pass source truth:

- one deterministic helper pass derives the executive state packet
- that same packet drives broader work, current task, and explicit next step
- if canonical promotion and checkpoint handoff disagree, the packet surfaces the mismatch instead of hiding it
- the packet keeps the CEO/CTO boundary explicit so governing-object decisions stay above lower-layer derivation
- the launcher keeps long CEO requests and governed outputs in files rather than fragile inline prompt strings

---

## Component Model

### 1. Skill surface

Files:

- `SKILL.md`
- `agents/openai.yaml`
- `references/usage.md`

Responsibility:

- tell the runtime how `$CTO` should behave
- force governor-first routing
- forbid raw-repo improvisation by default
- keep the CEO-facing surface on high-level governing objects rather than lower-layer decomposition

### 2. Role contract artifact

File:

- `references/role-contract.xml`

Responsibility:

- define the strict tagged role prompt
- provide explicit rule entries with examples and anti-patterns
- act as the LLM-side contract source

### 3. Deterministic helper

File:

- `scripts/cto-helper.mjs`

Responsibility:

- load authoritative docs
- derive current-state facts
- reconcile handoff truth with promoted-canon truth
- keep current task and next-step routing at the governing-object level
- produce context layers
- emit stable JSON for known actions

### 4. Governor

File:

- `scripts/cto-governor.mjs`

Responsibility:

- detect route from the user prompt
- decide between direct-answer mode and packet mode
- build the bounded LLM packet
- force an explicit next-step question plus recommendation into the response basis
- support file-based input and output
- carry the CEO-decides-high-level / CTO-derives-lower-layers rule into the response contract

### 4a. Launcher

File:

- `scripts/cto-launcher.mjs`

Responsibility:

- provide the stable file-based CTO entrypoint
- accept `--input-file` and `--output-file`
- call the governor with file transport instead of long inline prompt strings

### 5. Product docs

Files:

- `references/requirements.md`
- `references/design.md`
- `references/implementation-plan.md`

Responsibility:

- preserve the product chain inside ADF
- keep future implementation work auditable

---

## Response Modes

### Direct mode

Use when:

- the prompt matches a deterministic governed route

Examples:

- current status
- implementation readiness
- unresolved gaps

Behavior:

- helper derives the answer pack
- governor returns `answer_mode=direct`
- skill should output `final_answer` exactly unless the user asked for proof

Constraint:

- direct mode is not allowed to stop at recap
- the final line must carry the actionable next step in question-plus-recommendation form

### Packet mode

Use when:

- the prompt still needs LLM reasoning but should remain governed

Examples:

- define what is still missing before a freeze
- check whether the current task is ready to move forward
- turn current context into a CEO-facing next-step discussion

Behavior:

- helper derives the context layers
- governor returns `answer_mode=packet`
- LLM answers only from the packet and role contract

---

## Prompt Contract Shape

The role contract is carried in XML-like structure so it can later map more cleanly into a component or external worker prompt.

Top-level shape:

```xml
<cto_operating_contract>
  <identity />
  <mission />
  <operating_split />
  <source_priority />
  <response_contract />
  <context_frame />
  <rules>
    <rule />
  </rules>
</cto_operating_contract>
```

This gives the LLM one explicit governing surface instead of scattered prose instructions.

---

## Rule Schema

Each rule uses the same internal structure:

```xml
<rule id="R-001" name="Meaning First">
  <definition>...</definition>
  <expected_outcome>...</expected_outcome>
  <example>...</example>
  <do_not>...</do_not>
  <avoid>...</avoid>
</rule>
```

Design reason:

- keeps the behavior contract uniform
- makes the future component easier to validate mechanically
- reduces ambiguity about what each rule really means

---

## Context Packet Shape

The governor emits a bounded packet for packet-mode prompts.

Target JSON shape:

```json
{
  "command": "govern",
  "supported": true,
  "route": "guided-cto",
  "answer_mode": "packet",
  "prompt_packet": {
    "contract_version": 1,
    "user_request": "...",
    "role_contract": "...xml text...",
    "response_contract": {
      "audience": "CEO",
      "style": ["meaning-first", "decision-shaped", "minimal"],
      "must_do": ["answer from packet", "push next move"],
      "must_not_do": ["dump repo proof unasked"]
    },
    "context_layers": {
      "layer_0": {},
      "layer_1": {},
      "layer_2": {},
      "layer_3": {}
    }
  }
}
```

---

## Layer Realization

### Layer 0

Source:

- `role-contract.xml`
- v2 role/protocol docs

Design choice:

- store as explicit contract text plus compact structured summary

### Layer 1

Source:

- mission statement
- operating model docs
- current layer checkpoint docs

Design choice:

- helper derives the current system frame and major remaining work

### Layer 2

Source:

- next-step handoff
- open-items register
- active draft purpose

Design choice:

- helper derives the current task in meaning language plus the open-item picture
- helper also identifies the fundamental next question and the default recommendation for closing it

### Layer 3

Source:

- currently no authoritative durable issue-stack implementation

Design choice:

- expose a stub explicitly
- include defined pop behavior and current limitation

---

## Working-Mode Alignment

The design aligns to the newer CTO/CEO working-mode direction:

- short executive answers by default
- fundamental-question discipline instead of broad recap
- same-pass source-of-truth propagation
- default requirements-discussion mode unless explicit approval to draft is present
- explicit approval gate plus post-draft review or freeze-read gate
- explicit state clarity when draft/frozen/open/stubbed distinctions matter
- checkpoint hygiene after meaningful CRUD, while still keeping git proof below the CEO boundary unless asked
- file-based transport for long CTO inputs and outputs

---

## Deterministic vs LLM Boundary

### Deterministic side

The deterministic side should answer:

- what the current checkpoint is
- what the current task means
- how many open items remain
- what categories those items fall into
- what the next unresolved question is

### LLM side

The LLM side should answer:

- what those facts mean to the CEO
- what the next recommendation should be
- how to explain the current state naturally
- how to run a one-gap clarification move
- how to hold filename or packaging questions as later/open items instead of letting them replace the real task

---

## Design Constraints

### Constraint 1 - ADF ownership

The code must live under ADF and remain auditable in ADF git.

### Constraint 2 - Not Codex-only

The governed logic should not depend on Codex-specific hidden behavior.
The skill wrapper may be Codex-facing, but the contract and scripts should be reusable.

### Constraint 3 - Do not overwrite v2 canon casually

The product should read v2 truth and use it.
It should not silently rewrite role/source docs just to make the skill look cleaner.

### Constraint 4 - Explicit stubs are acceptable

If a future boundary is undefined, surface it as a stub instead of inventing fake completeness.

---

## Verification Design

Verification happens at 3 levels.

### Level 1 - Script validity

- `node --check` on helper and governor
- helper routes return valid JSON

### Level 2 - Skill packaging

- manifest remains valid
- skill install succeeds

### Level 3 - Live smoke

- invoke `$CTO` through the native skill path after install
- compare live behavior to the governed intent

If the live runtime still drifts, record that as an implementation gap rather than hiding it.

---

## Current Design Stubs

The following are intentionally stubbed in this design:

- durable Layer 3 storage implementation
- automatic decision persistence wiring for future broader CTO routes
- broader route library beyond the initial governed route set
- future component packaging outside the skill layer

---

## One-Sentence Design Summary

The `$CTO` design uses a governor-first architecture: scripts derive authoritative layered CTO context and produce either a direct answer or a bounded prompt packet, while the LLM is constrained by a strict tagged role contract to translate that packet into CEO-facing CTO reasoning.

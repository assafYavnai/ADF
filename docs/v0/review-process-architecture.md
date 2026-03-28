# ADF Review Process Architecture

Status: approved direction
Last updated: 2026-03-28

---

## Context: Why This Exists

ADF is a self-learning, self-healing development framework where the CEO (user) provides vision and the COO (AI system) executes. The system is built from governed components — each component that uses LLMs must have a defined role created through a multi-LLM review board.

During the first attempt to create the agent-role-builder's own role (the bootstrap proof that the tool works), we discovered that the review process itself had fundamental gaps. Across 6 runs and 20+ review rounds, the board couldn't converge — reviewers kept finding new issues at the same rate old ones were fixed.

Root cause analysis revealed five problems:
1. Reviewer feedback was flat text lists with no severity or structure — the implementer couldn't tell what was critical vs cosmetic
2. The implementer received raw JSON blobs instead of actionable fix instructions — it had to re-parse and interpret feedback each round
3. No institutional memory existed — the same types of issues kept appearing because there was no accumulation of "don't do this" rules
4. Both reviewers ran every round even when one already approved — wasting time and creating noise
5. No defined process for what happens when reviewers disagree or when the review budget runs out

This architecture solves all five problems and creates a self-improving system that gets better with every review cycle it runs.

---

## Core Principle: Everything Is Boxed

Every component in ADF is self-contained in its own directory. All files related to that component live inside its directory — not scattered across the project.

A component may contain multiple LLM agents. Each LLM agent gets its own subfolder with its own rulebook and review prompt. For example, the COO component has controller/, classifier/, intelligence/, and context-engineer/ — each LLM-powered layer (classifier, intelligence) has its own subfolder with its own governance artifacts.

This means any agent can understand a component by reading its directory. No hunting across the project for related files.

Per-component (or per-LLM-agent subfolder):
- **Source code** — the implementation
- **Rulebook** (`rulebook.json`) — accumulated rules from past review failures
- **Review prompt** (`review-prompt.json`) — defines what reviewers should focus on for this component
- **Run artifacts** — permanent evidence of every review cycle
- **Role definition** — if the component uses LLMs, its governed role lives here too

---

## The Rulebook

Every component that goes through governed review must have a `rulebook.json` in its own directory. This is the component's institutional memory.

**What rules are:**
Rules are high-level, generalized core essence directives distilled from real review failures. They capture the principle behind the failure, not the specific incident. Examples:
- "Define authority precedence explicitly when multiple governance layers exist"
- "Never reference the same concept with different phrasings across sections without a canonical definition"
- "Completion criteria must be testable against every terminal state, not just the happy path"
- "Always do null checks on scope resolution results"
- "Don't swallow errors — surface them with source and context"

**What rules are NOT:**
- Not copies of reviewer feedback ("round 2 said authority chain is ambiguous")
- Not implementation details ("add a null check on line 47")
- Not temporary fixes ("workaround for the encoding bug")

**Rule structure (JSON):**
Each rule has an ID, the generalized principle, the source review cycle that produced it, and a version. Rules can be superseded but never silently deleted — history is preserved in git.

**Who creates rules:**
The learning engine (described below) extracts rules from review feedback. The implementer doesn't write rules — they follow them.

---

## The Learning Engine

A shared generic service that lives in `shared/learning-engine/`. Its job is to analyze review feedback and extract generalizable rules that prevent the same failures from recurring.

**How it works:**
After each review round and before any fix attempt, the learning engine receives the reviewer feedback and asks: "What generalizable principle does this failure reveal?" It produces new rulebook entries (or identifies that existing rules already cover the issue). It updates the specific component's `rulebook.json` — the file in that component's directory, not a generic global file.

**Why it's generic:**
The extraction logic is the same regardless of what's being reviewed. "What pattern does this failure reveal?" works for role definitions, TypeScript code, system prompts, and architecture documents. The only thing that changes is the prompt context.

**How prompts are used:**
Each component holds a `review-prompt.json` in its own directory. This prompt tells the learning engine what domain it's operating in (design review, code review, prompt review, architecture review) and what kinds of rules are relevant. The learning engine loads this prompt to contextualize its analysis. Without it, the engine doesn't know what domain patterns to look for.

**Why it runs between review and fix:**
If the implementer fixes issues without first extracting the rule, the same class of issue will appear in future runs. The learning step ensures the rulebook grows before the fix is attempted. The implementer then reads the updated rulebook before fixing, which means the fix addresses the root pattern, not just the specific symptom.

---

## The Review Process (Per Round)

Each review round follows this sequence:

### Step 1: Implementer produces or revises artifacts
The implementer (an LLM) creates or revises the component artifact (role definition, code, prompt, etc.). On the first round, this is generated from the request. On subsequent rounds, it's revised based on prior feedback.

### Step 2: Implementer produces delta compliance map
The implementer checks its work against the rulebook and produces a JSON compliance map showing:
- Which rules were checked
- Where in the artifact each rule is satisfied
- Only for sections that changed (delta) — not the entire artifact on middle rounds
- References the git commit or artifact version being checked

This gives the reviewer a head start — they can verify the implementer's claims instead of rediscovering known issues from scratch.

**Full sweep rule:**
- First round: full compliance map (all rules against entire artifact)
- Middle rounds: delta compliance map (only changed sections)
- Final round (when reviewer finds no pushbacks): full sweep to catch cross-cutting issues
- This balances thoroughness with efficiency

### Step 3: Implementer produces fix items map (rounds 2+)
On subsequent rounds (after a review rejection), the implementer produces a fix items map showing for each reviewer finding:
- `accepted`: what was changed, where, and a summary of the fix
- `rejected`: why the finding is invalid (missing context, contradicts another requirement, etc.)

This serves as both proof of fix AND reviewer context for the next round. The reviewer doesn't have to guess what changed — the map tells them.

### Step 4: Review
Reviewers (Codex + Claude pair minimum) independently review the artifact. Their feedback uses a structured contract (JSON):
- **Verdict**: `approved` (ready to freeze), `conditional` (minor fixes only), or `reject` (blocking/major issues)
- **Conceptual groups**: findings grouped by root cause, not flat lists. Each group has:
  - Severity: `blocking`, `major`, `minor`, or `suggestion`
  - Specific findings with source section references
  - Redesign guidance: what to do about it
- **Residual risks**: things that aren't blocking but need tracking
- **Strengths**: what's good (not just criticism)
- **Fix items decision map** (rounds 2+): for each item in the implementer's fix map:
  - `accept_fix`: the fix resolves the finding
  - `reject_fix`: the fix is insufficient (with reason why)
  - `accept_rejection`: the implementer was right to reject the finding
  - `reject_rejection`: the implementer's rejection is invalid (with reason why)

This creates a proper negotiation protocol between implementer and reviewer, not a one-way broadcast. The implementer has freedom to push back on findings that lack context or contradict other requirements, and the reviewer must explicitly respond to each pushback.

### Step 5: On review failure (reject verdict)
When a reviewer rejects:
1. Learning engine digests the feedback and updates the component's `rulebook.json`
2. A fresh implementer receives: current artifact + updated rulebook + actionable fix checklist + prior compliance map
3. The implementer first mechanically walks every rule in the rulebook against the artifact, then addresses the specific feedback items
4. The implementer produces both a new compliance map (delta) and a fix items map
5. The round proceeds to the next review cycle

### Step 6: On review pass (approved/conditional)
When all reviewers approve or go conditional:
- Conditional items are fixed (specific minor changes only)
- Leader confirms freeze
- Artifacts promoted to canonical location
- Decision log and board summary written

---

## Split Verdict Handling

When one reviewer approves and another rejects:

1. Fix only the rejecting reviewer's findings
2. Re-run only the rejecting reviewer in the next round — don't waste the approving reviewer's time
3. When the rejecting reviewer approves or goes conditional, run one final sanity check with the previously-approving reviewer to catch any regressions the fixes may have introduced
4. Both must approve/conditional before the artifact can freeze

This cuts review cycles significantly — prior runs re-ran both reviewers every round even when one was satisfied.

---

## Arbitration (Minor Items Only)

Arbitration is strictly limited to prevent swallowing real issues:

**When arbitration is allowed:**
- Only on `minor` and `suggestion` severity items where reviewers disagree on whether something needs fixing
- The leader can decide "this is acceptable as-is" for these items only
- The decision is logged with full rationale

**When arbitration is NOT allowed:**
- Never on `blocking` or `major` severity items
- Never to override a `reject` verdict
- Never to force a freeze when material pushback remains

**Budget exhaustion protocol (final round):**
When the review budget is about to run out and blocking/major items remain:
- The artifact does NOT freeze. Blocking issues cannot be swallowed.
- Each reviewer picks their single most important remaining fix (ultimatum)
- The implementer fixes those specific items only
- The decision is logged with full audit trail: what was fixed, what was deferred, and why
- The run exits as `resume_required` with deferred items documented
- The cycle post-mortem (described below) analyzes why the budget wasn't sufficient

**Arbitration result:**
When arbitration is used, the result must reflect it as partial acceptance — `frozen_with_conditions` (distinct from clean `frozen`). The result lists all deferred minor items. The invoking component (the caller that requested the role/review) can then:
- Accept the conditional result
- Request more rounds to achieve full acceptance

The invoker has authority, not the tool.

---

## All Contracts Are JSON

Every input and output in this architecture is strict JSON with defined schemas. No markdown for machine interfaces. Markdown is for human-readable documentation only.

This includes:
- Rulebook entries
- Compliance maps
- Fix items maps
- Review results
- Learning engine outputs
- Post-mortem reports
- Run artifacts

Why: JSON is parseable, validatable, and unambiguous. Markdown is prose — it can't be mechanically verified. When the compliance map says "rule R-003 satisfied at <authority> line 12", that's a verifiable claim. When a markdown file says "authority is defined", that's an opinion.

---

## Permanent Audit Trail

All run artifacts are committed to git. Nothing is volatile. The structure:

```
<component>/
  rulebook.json
  review-prompt.json
  runs/
    <job-id>/
      rounds/
        round-0/
          review.json          # reviewer verdicts (structured)
          learning.json        # learning engine output (new rules)
          compliance-map.json  # implementer's delta compliance check
          fix-items-map.json   # implementer's fix/reject map (round 1+)
          diff-summary.json    # what changed from prior round
        round-1/
          ...
      result.json              # terminal result
      run-postmortem.json      # tier 1 KPI
      cycle-postmortem.json    # tier 2 summary (when job completes)
```

**Commit timing:**
- **Commit**: at the end of every round (all round artifacts). Preserves evidence atomically per round.
- **Push**: at the end of every cycle (when job reaches terminal state). Rounds accumulate locally, push happens once when done.
- Exception: if a round takes unusually long (watchdog timeout), commit before the next round starts so evidence isn't lost if the process crashes.

---

## Three-Tier Post-Mortem

The system learns at three different scopes. Each tier has its own trigger, focus, and output. They are NOT nested supersets — each has a distinct scope.

### Tier 1: Run Post-Mortem (run-specific)

- **Scope**: single run (the rounds within one attempt)
- **Trigger**: after every round completes
- **Focus**: what happened in this specific run
- **Does**: captures KPI snapshot (time per round, reviewer verdicts, issue counts, convergence rate) and updates the component's rulebook if the learning engine found new rules
- **Does NOT**: fix anything or perform self-healing. Run post-mortem is an observer, not an actor. It must be fast and cheap because it runs after every round.
- **Output**: `run-postmortem.json` in the run directory

### Tier 2: Cycle Post-Mortem (job-specific)

- **Scope**: single job (all runs/attempts for one job)
- **Trigger**: when the job reaches a terminal verdict (frozen, blocked, resume_required)
- **Focus**: what happened across all attempts for this specific job
- **Does**: produces a job summary covering all runs, performs deeper learning analysis (why did it take N runs? what patterns emerged?), and performs self-healing (if the tool itself had a gap, identifies it and feeds a fix request before resuming)
- **Lightweight case**: if the job froze within budget on the first run, this is just summarizing the single run's findings into a job summary. Very lightweight execution.
- **Heavy case**: if the job took 4 runs to freeze, this has real work — analyzing WHY it took 4 runs, what broke, what was learned, what was fixed, and whether the fixes actually helped
- **Output**: `cycle-postmortem.json` — job summary + learning findings + self-improvement recommendations

### Tier 3: Jobs Post-Mortem (component-specific)

- **Scope**: all jobs for a component (across all time)
- **Trigger**: every N cycles (e.g., 3) or manually triggered. **Runs in a background process** — does not block work.
- **Focus**: how is the component performing overall
- **Does**: deepest analysis across all jobs — component-level KPIs (average rounds to freeze, most common failure categories, rule effectiveness scores), generic issue patterns across all jobs, systemic blind spots, and deep self-improvement recommendations that affect the component's architecture or review process itself
- **Output**: component KPI baseline + generic issue summary + systemic improvement plan
- **Cleanup**: after analysis, deletes the raw run/round data for analyzed jobs to prevent bloating. The summary must include the deleted jobs' last commit IDs so there is an audit trail back to the git history if deep-dive is ever needed.

**Key distinction:**
- **Run** captures (specific to rounds within one attempt)
- **Cycle** fixes (specific to one job across attempts)
- **Jobs** improves systemically (specific to the component across all jobs)

---

## System-Wide Application

Everything described above applies to every governed component in ADF, not just the agent-role-builder. Any component that uses LLMs and goes through review gets:

- A rulebook in its directory (per LLM agent if multiple agents)
- A review prompt in its directory (per LLM agent)
- The learning engine between review and fix
- Delta compliance maps from the implementer
- Fix items maps with implementer accept/reject freedom
- Structured reviewer feedback with fix decision maps
- Three-tier post-mortem (run/cycle/jobs)
- Permanent audit trail with defined commit/push points
- Split-verdict handling
- Budget exhaustion protocol (no swallowing of blocking issues)
- Arbitration only on minor items, result reflects partial acceptance

The shared infrastructure (`shared/learning-engine/`, `shared/llm-invoker/`, `shared/telemetry/`) serves all components equally. The per-component artifacts (rulebook, review prompt, runs) live in each component's directory.

---

## Empirical Evidence: First Review Cycle (Step 2f, 2026-03-28)

The first application of this review process was a 3-round code review of the ADF shared infrastructure (34 files). Results:

### Timing Baseline

| Round | Duration | Tool Calls | Tokens | Scope |
|---|---|---|---|---|
| 1 (cold start) | ~3.5 min | 52 | 95K | Full review of 34 files |
| 2 (verify fixes) | ~3.5 min | 33 | 50K | Changed files + fix items map |
| 3 (final sweep) | ~2.5 min | 25 | 64K | Full sweep on clean state |
| **Total** | **~9.5 min** | **110** | **~210K** | 3 blocking + 5 major resolved |

### Key Finding: Compliance Map Prevents Missed Fixes

Round 2 found a major security issue (R2-1): the Gemini shell injection fix was applied to the canonical invoker but NOT to the copy in shared-imports.ts. A compliance map that listed all locations where each fix applies would have caught this before the reviewer did. This is now system rule SYS-001 in the rule-book-guide.

### Convergence Pattern

- Round 1: 3 blocking, 5 major, 7 minor, 5 suggestions (cold start)
- Round 2: 9 fixes accepted, 1 rejection accepted, 1 new major (missed copy)
- Round 3: all fixes verified, 3 rejections accepted, 0 violations on full sweep — **APPROVED**

### Cost Observation

Round 1 (cold start) is the most expensive — reviewer reads everything. Rounds 2-3 are cheaper because the fix items map tells the reviewer exactly what changed. The delta compliance approach is validated: incremental rounds cost ~50-65% of the initial round.

### Evidence

- Round 1: `docs/v0/reviews/step2f-implementation-review.md`
- Round 2: `docs/v0/reviews/step2f-round2-review.json`
- Round 3: `docs/v0/reviews/step2f-round3-review.json`

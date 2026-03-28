# Step 2f: Review Infrastructure — Learning Engine, Compliance Maps, Fix Integration

Status: **planned**
Last updated: 2026-03-28

---

## Context

The review process architecture is defined (docs/v0/review-process-architecture.md). The agent-role-builder has 14 rules in its rulebook from 6 runs / 20+ review rounds. Now we implement the generic infrastructure and integrate it.

## Three Parallel Tracks

### Track 1: Generic Shared Components (no dependencies between these)
Build shared infrastructure that both tools will consume:

**1a. Learning Engine** (`shared/learning-engine/`)
- `types.ts` — Zod schemas:
  - LearningInput: review feedback (conceptual groups with severity), current rulebook, component review-prompt
  - LearningOutput: new/updated rules to add to rulebook, rule IDs that already cover the feedback
- `engine.ts` — core function:
  - Takes reviewer feedback + current rulebook + review-prompt.json
  - Calls LLM (generic, uses shared/llm-invoker) to extract generalizable rules
  - Returns proposed rulebook additions (conforming to rule-book-guide.json)
  - Does NOT write to rulebook directly — returns proposals for the caller to apply
- Uses `shared/llm-invoker/` for LLM calls
- Domain prompt loaded from component's `review-prompt.json`

**1b. Compliance Map Schema** (`shared/learning-engine/compliance-map.ts`)
- Zod schema for compliance map JSON:
  - Array of { rule_id, status: "compliant" | "not_applicable", evidence_location: string, evidence_summary: string }
  - Delta mode: only changed sections. Field: `scope: "full" | "delta"`
  - Git commit reference field
- Used by implementer before submitting for review

**1c. Fix Items Map Schema** (`shared/learning-engine/fix-items-map.ts`)
- Zod schema for fix items map JSON:
  - Array of { finding_group_id, action: "accepted" | "rejected", summary: string, evidence_location?: string, rejection_reason?: string }
- Used by implementer when fixing review feedback
- Reviewer responds with decision map: { finding_group_id, decision: "accept_fix" | "reject_fix" | "accept_rejection" | "reject_rejection", reason: string }

**1d. Review Prompt Template** (`shared/learning-engine/review-prompt-template.json`)
- Template that components copy and customize for their review-prompt.json
- Fields: domain (design | code | prompt | architecture), focus_areas, severity_definitions, compliance_map_required: true

### Track 2: Integrate into agent-role-builder + test
Depends on Track 1 completion.

**2a. Create agent-role-builder review-prompt.json**
- Domain: "design" (role definition is a design artifact)
- Focus areas: authority model, scope boundaries, artifact lifecycle, terminal state triggers, self-check credibility
- Based on the 14 rules — the review prompt tells reviewers what to focus on

**2b. Update board.ts with learning engine integration**
- After each review round (before fix):
  1. Call learning engine with reviewer feedback + current rulebook
  2. Apply any new rules to rulebook.json
  3. Pass updated rulebook to implementer
- Implementer produces compliance map (full on round 0, delta on subsequent)
- Implementer produces fix items map (round 1+)
- Reviewer receives compliance map + fix items map for verification
- Reviewer produces fix decision map in response

**2c. Update reviewer prompt**
- Include compliance map in reviewer brief
- Include fix items map in reviewer brief (round 1+)
- Reviewer must produce fix decision map (accept/reject each fix)

**2d. Update implementer (reviseRoleMarkdown)**
- Load rulebook before revision
- Mechanically walk every rule against the draft (produce compliance map)
- Address specific feedback items (produce fix items map)
- Convergence tracking: if not improving, flag which rules are being violated repeatedly

**2e. Test run**
- Run agent-role-builder self-role-008 with all infrastructure active
- 3 rounds budget
- Compare against run 006 (last run without infrastructure):
  - Round 0 unresolved count (should be lower — rulebook prevents known issues)
  - Improvements per round (should be higher — actionable fix checklist + compliance map)
  - Overall convergence (should reach fewer unresolved in fewer rounds)

### Track 3: Apply to llm-tool-builder via Codex agent (background)
Depends on Track 1 completion. Runs in parallel with Track 2.

**3a. Create llm-tool-builder review-prompt.json and initial rulebook.json**
- Spin up Codex gpt-5.4 agent with:
  - docs/v0/review-process-architecture.md
  - shared/learning-engine/rule-book-guide.json
  - tools/agent-role-builder/rulebook.json (as example)
  - tools/llm-tool-builder/src/ (current implementation)
  - C:\ProjectBrain\ADF\COO\tools\tool-builder\ (reference)
- Task: create review-prompt.json and initial rulebook.json for llm-tool-builder
- No permissions needed — read-only analysis + file creation

---

## Files to Create

| File | Track | Dependencies |
|---|---|---|
| `shared/learning-engine/types.ts` | 1a | none |
| `shared/learning-engine/engine.ts` | 1a | types.ts, shared/llm-invoker |
| `shared/learning-engine/compliance-map.ts` | 1b | none |
| `shared/learning-engine/fix-items-map.ts` | 1c | none |
| `shared/learning-engine/review-prompt-template.json` | 1d | none |
| `tools/agent-role-builder/review-prompt.json` | 2a | 1d |
| `tools/agent-role-builder/src/services/board.ts` | 2b | 1a, 1b, 1c |
| `tools/agent-role-builder/src/services/role-generator.ts` | 2d | 1b, 1c |
| `tools/llm-tool-builder/review-prompt.json` | 3a | 1d |
| `tools/llm-tool-builder/rulebook.json` | 3a | rule-book-guide |

## Parallelization

- **1a, 1b, 1c, 1d**: all independent, can be built in parallel
- **2a**: depends on 1d (template)
- **2b, 2c, 2d**: depend on 1a-1c
- **2e**: depends on 2a-2d
- **3a**: depends on 1d, runs in parallel with Track 2

## Success Criteria

- Run 008 reaches fewer unresolved issues than run 006 (4) in same round budget (3)
- Compliance map produced on every round
- Learning engine extracts at least 1 rule or confirms existing rules cover the feedback
- Fix items map produced on rounds 1+
- Reviewer fix decision map produced on rounds 1+
- All artifacts committed to git per round

## Commit/Push Plan

- Commit after each track milestone (1a done, 1b done, etc.)
- Push after Track 1 complete and after Track 2 test run complete

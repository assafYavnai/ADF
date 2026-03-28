# Step 2f Checkpoint — Track 1 Complete, Track 2 Integration Next

Status: **in progress**
Last updated: 2026-03-28

## What's Done

### Track 1: Generic Shared Components (COMPLETE)
- `shared/learning-engine/types.ts` — LearningInput/Output, ReviewFinding, ProposedRule
- `shared/learning-engine/engine.ts` — extractRules() + applyProposedRules()
- `shared/learning-engine/compliance-map.ts` — ComplianceMap schema (full/delta)
- `shared/learning-engine/fix-items-map.ts` — FixItemsMap + FixDecisionMap
- `shared/learning-engine/review-prompt-template.json` — template for components
- `shared/learning-engine/rule-book-guide.json` — system-level meta-guide
- `tools/agent-role-builder/review-prompt.json` — design domain, 14 focus areas
- `tools/agent-role-builder/rulebook.json` — 14 rules with DO/DONT examples
- All compiles clean

### Track 3: Codex Agent (RUNNING in background)
- Creating llm-tool-builder review-prompt.json and rulebook.json
- Running in isolated worktree

## What's Next

### Track 2: Integrate into agent-role-builder
- **2b**: Update board.ts — add learning engine call between review and fix, pass rulebook to implementer, collect compliance map and fix items map
- **2c**: Update reviewer prompt — include compliance map and fix items map, produce fix decision map
- **2d**: Update reviseRoleMarkdown — load rulebook, produce compliance map, produce fix items map
- **2e**: Test run (self-role-008) — compare against run 006 baseline

### Key Integration Points
- board.ts executeBoard(): after each review round, before revision:
  1. Call learning engine (extractRules)
  2. Apply new rules to rulebook
  3. Pass rulebook + compliance map schema to implementer
  4. Implementer produces compliance map + fix items map
  5. Pass both to reviewer in next round
  6. Reviewer produces fix decision map

### To Resume
1. Read this checkpoint
2. Read `docs/v0/context/step2f-review-infra-plan.md` for full plan
3. Read `shared/learning-engine/` for the generic components
4. Read `tools/agent-role-builder/src/services/board.ts` for current state
5. Implement Track 2b-2d, then run test (2e)

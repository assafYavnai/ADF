# Ad-Hoc Code Review Package

Round: 2
Mode: delta

Read the manifest first. Then read only the files copied into this bundle.

Manifest: C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source-manifest.json

Target source files:
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/review-engine/config.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/review-engine/engine.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/review-engine/types.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/component-repair-engine/engine.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/component-repair-engine/types.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/learning-engine/engine.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/learning-engine/types.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/learning-engine/review-contract.json
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/learning-engine/code-review-contract.json
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/shared/learning-engine/implementor-rulebook.json
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/review-prompt.json
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/review-contract.json
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/rulebook.json
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/src/index.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/src/schemas/result.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/src/shared-imports.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/src/services/board.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/src/services/role-generator.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/src/services/shared-module-loader.ts
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/source/tools/agent-role-builder/src/services/validator.ts

Authority files:
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/authority/docs/v0/review-process-architecture.md
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/authority/docs/v0/architecture.md
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/authority/docs/v0/context/step2g-efficiency-plan.md
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/authority/shared/learning-engine/review-contract.json
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/authority/shared/learning-engine/code-review-contract.json
- C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/authority/shared/learning-engine/implementor-rulebook.json

Prior findings: C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/findings.json
Prior fix items map: C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/fix-items-map.json
Prior diff summary: C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/diff-summary.json
Prior learning: C:/ADF/shared/review-engine/runs/agent-role-builder-implementation-adhoc-001/rounds/round-2/bundle/learning.json

Instructions:
- Review the shared review/runtime modules and the agent-role-builder implementation together as one governed implementation surface.
- Stay boxed to this bundle.
- Focus on correctness, review-cycle sequencing, schema/runtime alignment, audit/KPI integrity, and mirrored-module drift.
- Return JSON only, matching the shared review contract.
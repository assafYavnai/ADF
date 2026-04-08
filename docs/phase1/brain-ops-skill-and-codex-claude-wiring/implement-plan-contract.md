1. Implementation Objective

Create a production-grade repo-owned `brain-ops` skill under `skills/`, wire it into the ADF CLI bootstrap for Codex and Claude, and refresh generated Codex and Claude installs so future ADF work can read, write, verify, and promote Brain entries without rediscovering the operational route.

2. Slice Scope

- add one installable repo-owned `brain-ops` skill package under `skills/brain-ops/`
- expose a supported Brain fallback route for CLI agents using the built Brain client and doctor-path authorities already present in ADF
- register the new skill in `skills/manifest.json`
- update ADF CLI bootstrap guidance so agents working on ADF are pointed at the skill for Brain operations
- refresh and verify generated Codex and Claude skill installs through `skills/manage-skills.mjs`
- keep the slice bounded to Brain operations, skill packaging, install wiring, and minimal truthful bootstrap guidance

3. Required Deliverables

- `skills/brain-ops/SKILL.md`
- a repo-owned helper script surface under `skills/brain-ops/scripts/` that supports at minimum:
  - help
  - connect smoke
  - context search/read
  - durable capture
  - trust management for promotion or cleanup
- repo-owned references for the skill so contextless agents do not need to rediscover the Brain route
- manifest registration for the new skill
- bootstrap guidance that points ADF CLI agents at the skill for Brain operations
- generated install proof for Codex and Claude through `manage-skills install/check`
- verification evidence that the new skill can perform a controlled Brain write and round-trip verification truthfully

4. Allowed Edits

- `C:/ADF/skills/brain-ops/**`
- `C:/ADF/skills/manifest.json`
- `C:/ADF/skills/manage-skills.mjs` only if a minimal manifest/install path adjustment is strictly required
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/AGENTS.md` only if a minimal routing line is strictly required to keep bootstrap truthful
- `C:/ADF/docs/phase1/brain-ops-skill-and-codex-claude-wiring/**`

5. Forbidden Edits

- no Brain server redesign under `components/memory-engine/**`
- no raw DB access route
- no direct hand edits under `C:/Users/sufin/.codex/skills/**`
- no direct hand edits under `C:/Users/sufin/.claude/skills/**`
- no new standalone Brain guide doc outside the existing bootstrap surfaces
- no COO product-surface changes
- no Gemini-specific install or bootstrap work unless the existing generated-install contract forces a minimal aligned change
- no repo-wide documentation cleanup beyond the minimum truthful bootstrap update needed for this slice

6. Acceptance Gates

1. A new repo-owned `brain-ops` skill exists and is installable through the existing repo skill installer route.
2. The skill gives contextless agents one clear Brain operations path instead of requiring repo archaeology.
3. The fallback path uses the supported built Brain client route and does not introduce raw DB access or a new unsupported integration.
4. ADF CLI bootstrap guidance points agents to the skill for Brain operations when working on ADF.
5. `manage-skills install --target codex` and `manage-skills check --target codex` pass after the skill is added.
6. `manage-skills install --target claude` and `manage-skills check --target claude` pass after the skill is added.
7. Machine proof demonstrates Brain connectivity, Brain read/search, and a controlled write plus truthful trust management or cleanup.
8. Installed target copies remain generated output, not edited sources.

KPI Applicability:
not required

KPI Route / Touched Path:
None.

KPI Raw-Truth Source:
None.

KPI Coverage / Proof:
None.

KPI Production / Proof Partition:
None.

KPI Non-Applicability Rationale:
This slice adds a repo-owned operational skill and bootstrap/install wiring. It does not ship a new product KPI route.

KPI Exception Owner:
None.

KPI Exception Expiry:
None.

KPI Exception Production Status:
None.

KPI Compensating Control:
None.

Vision Compatibility:
compatible. The slice strengthens ADF agent execution discipline by making the durable Brain route usable without repeated exploratory work.

Phase 1 Compatibility:
compatible. Phase 1 depends on Brain-backed durable knowledge, and this slice makes that path more reliable for contextless CLI agents.

Master-Plan Compatibility:
compatible. This is a bounded operational hardening slice that improves execution quality without widening into a new product area.

Current Gap-Closure Compatibility:
compatible. The slice removes a real operational gap where agents can verify that Brain exists but still lose time rediscovering the exact supported read/write path.

Later-Company Check:
no

Compatibility Decision:
compatible

Compatibility Evidence:
Brain is already a required authority in ADF bootstrap, doctor already proves the direct connect/write path, and recent MCP-boxing work showed that the missing piece is a short operational route for future contextless agents rather than a new Brain architecture.

post_send_to_review: true

review_until_complete: true

review_max_cycles: 5

Machine Verification Plan:
- `node --check C:/ADF/skills/brain-ops/scripts/brain-ops-helper.mjs`
- `node C:/ADF/tools/doctor-brain-connect-smoke.mjs C:/ADF`
- read/search smoke through the new helper against scope `assafyavnai/adf`
- one controlled proof write through the new helper into Brain, followed by verification read/search and truthful trust management or cleanup
- `node C:/ADF/skills/manage-skills.mjs install --target codex --project-root C:/ADF`
- `node C:/ADF/skills/manage-skills.mjs check --target codex --project-root C:/ADF`
- `node C:/ADF/skills/manage-skills.mjs install --target claude --project-root C:/ADF`
- `node C:/ADF/skills/manage-skills.mjs check --target claude --project-root C:/ADF`
- `git -C C:/ADF diff --check`

Human Verification Plan:
Required: false

Reason:
This slice is a repo-owned operational skill plus bootstrap/install wiring. The proof surface is deterministic helper behavior, Brain route verification, and generated skill install validation rather than a user-facing product route.

7. Observability / Audit

- helper output must stay structured enough for contextless agents to read
- write actions must return durable receipt identifiers when available
- proof writes must be tagged or scoped clearly enough to distinguish them from normal business memory
- install verification must use `manage-skills` instead of unsupported direct edits to installed targets

8. Dependencies / Constraints

- preserve the preferred bootstrap rule that assistant-side `project-brain` MCP remains the first choice when actually exposed
- preserve the supported repo fallback route through the built Brain client and doctor-path authorities
- do not require a new always-on Brain daemon model
- keep generated install behavior aligned with `skills/manage-skills.mjs`
- keep the skill usable by both Codex and Claude when working on ADF

9. Non-Goals

- no generic Brain docs overhaul
- no generic Phase 1 process cleanup
- no Memory Engine schema or service redesign
- no boxed Brain binary work
- no COO `/status` or onion-route product changes

10. Source Authorities

- `C:/ADF/AGENTS.md`
- `C:/ADF/docs/bootstrap/cli-agent.md`
- `C:/ADF/docs/VISION.md`
- `C:/ADF/docs/PHASE1_VISION.md`
- `C:/ADF/docs/PHASE1_MASTER_PLAN.md`
- `C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md`
- `C:/ADF/docs/v0/memory_stack_strategy.md`
- `C:/ADF/docs/cli-agents-guide.md`
- `C:/ADF/COO/controller/memory-engine-client.ts`
- `C:/ADF/components/memory-engine/src/server.ts`
- `C:/ADF/tools/doctor-brain-connect-smoke.mjs`
- `C:/ADF/tools/doctor-brain-audit.mjs`
- `C:/ADF/skills/manage-skills.mjs`
- `C:/ADF/skills/manifest.json`
- `C:/ADF/docs/phase1/llm-skills-repo-migration/context.md`
- `C:/ADF/docs/phase1/governed-approval-gates-and-local-sync-hardening/lessons-for-mcp-boxing.md`

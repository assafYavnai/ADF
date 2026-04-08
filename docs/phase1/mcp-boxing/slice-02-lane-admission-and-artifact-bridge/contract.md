1. Implementation Objective

Implement Slice 02 for MCP boxing by defining the ADF-facing feature package contract surface under `features_root`, creating the first real lane-admission route for `dev_team`, making MCP dev verify that ADF-side input artifacts are committed and pushed before lane start, keeping deep operational artifacts in the private MCP dev lane store, and publishing a governed machine-facing `implementation-summary.json` back to the ADF feature package.

2. Slice Scope

- Add the ADF-facing feature package contract surface under a configured `features_root`.
- Enforce the feature package path shape:
  - `<features_root>/<scope>/<feature-slug>/`
- Treat `scope` as optional and one segment only in this slice.
- Add the first real lane-admission route for `dev_team` under `VPRND` ownership.
- Activate the design team as the first real internal working team responsible for lane admission and preparation.
- Make MCP dev verify that the ADF-side feature package is committed and pushed before lane admission begins.
- Keep deep operational artifacts in the private MCP dev lane store under `implementation_lanes_root`.
- Publish a governed `implementation-summary.json` back to the ADF feature package after the admitted lane reaches its summary-ready point for this slice.
- Add the preflight / preparation API and the static guidance document that ADF-facing agents must read before preparing a feature package.
- Keep this slice focused on feature package validation, lane admission, artifact separation, and summary publication.

3. Required Deliverables

- A configured ADF-facing feature package contract surface.
- The first `dev_team` lane-admission route.
- Design-team participation in lane admission and preparation.
- Verification that ADF-side input artifacts are committed and pushed before lane admission.
- Private-lane artifact separation under `implementation_lanes_root`.
- A preflight / preparation API for ADF-facing agents.
- A static preparation guide with:
  - required files
  - template links
  - at least one example feature package
  - validation rules
- A governed machine-facing `implementation-summary.json` written back to the ADF feature package.
- Stable references in that summary to private-lane truth, at minimum:
  - `lane_id`
  - `artifact_snapshot_id`
  - `worktree_ref`
  - `related_commit_shas`

4. Allowed Edits

- New `dev_team` department files and helpers required for lane admission
- New API or guidance files required for the preflight / preparation surface
- New state or helper files required to validate and admit a lane
- New summary-generation files required to produce `implementation-summary.json`
- Minimal aligned documentation updates needed to introduce the ADF feature package contract and lane-admission behavior
- This feature root under `C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge`

5. Forbidden Edits

- Do not yet wire full downstream development execution.
- Do not yet wire live review-cycle execution under the new lane model.
- Do not yet wire live merge execution under the new lane model.
- Do not broaden the slice into legacy skill retirement.
- Do not treat missing Brain as acceptable fallback behavior.
- Do not make `decisions.md` the normal intake substitute for Brain-backed context.
- Do not pollute the main repo feature package with deep operational lane artifacts that belong in the private MCP dev lane store.

6. Acceptance Gates

1. MCP dev accepts a configured `features_root` and enforces the feature package path shape under that root.
2. The feature package path shape is `<features_root>/<scope>/<feature-slug>/`, with optional one-segment `scope`.
3. MCP dev exposes the first real lane-admission route under `VPRND` ownership.
4. The minimum required ADF intake artifacts are `contract.md` and `context.md`.
5. ADF-facing preparation guidance is available through the preflight / preparation API and its static guidance document.
6. MCP dev verifies that ADF-side feature package artifacts are committed and pushed before lane admission.
7. Lane admission uses the private MCP dev lane store for deep operational artifacts instead of storing those artifacts in the main repo feature package.
8. MCP dev writes `implementation-summary.json` back to the ADF feature package.
9. `implementation-summary.json` contains stable references to the corresponding private-lane truth.
10. Brain connectivity remains a hard requirement on the ADF side.

Machine Verification Plan
- Verify that setup accepts and persists `features_root` alongside the other department roots required for this slice.
- Verify that the feature package path is resolved correctly from `features_root`, `scope`, and `feature_slug`.
- Verify that the preflight / preparation API can return the static guidance document and template/example references.
- Verify that MCP dev rejects lane admission when the required ADF-side artifacts are not committed and pushed.
- Verify that MCP dev admits a lane when the ADF-side package is valid, committed, and pushed.
- Verify that deep operational artifacts remain in the private lane store rather than being written into the main repo feature package.
- Verify that `implementation-summary.json` is published to the ADF feature package and contains the required reference fields.

Human Verification Plan
- Required: false
- Reason: this slice is still infrastructure and contract-surface work. It is machine-facing only.

7. Observability / Audit

- MCP dev must make it obvious which ADF feature package a lane was admitted from.
- The admitted lane must have a stable lane identity.
- The published summary must reference private-lane truth rather than copy all private execution artifacts into the repo.
- The system must surface commit/push verification truth for ADF-side package admission.

8. Dependencies / Constraints

- Stay aligned with `docs/phase1/mcp-boxing/scope.md`, `step1.md`, `step2.md`, and `requirements.md`.
- Preserve compatibility with the later full downstream `dev_team` route.
- Preserve the later ability for ADF/COO to query lane performance and audit data through MCP dev APIs.
- Keep the slice bootstrap-to-admission focused rather than drifting into full execution routing.

9. Non-Goals

- No full development execution.
- No live review-cycle execution under the new lane model.
- No live merge execution under the new lane model.
- No Brain boxing.
- No final CTO-managed orchestration.

10. Source Authorities

- [README.md](/C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/README.md)
- [context.md](/C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/context.md)
- [decisions.md](/C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/decisions.md)
- [requirements.md](/C:/ADF/docs/phase1/mcp-boxing/slice-02-lane-admission-and-artifact-bridge/requirements.md)
- [scope.md](/C:/ADF/docs/phase1/mcp-boxing/scope.md)
- [step1.md](/C:/ADF/docs/phase1/mcp-boxing/step1.md)
- [step2.md](/C:/ADF/docs/phase1/mcp-boxing/step2.md)
- [requirements.md](/C:/ADF/docs/phase1/mcp-boxing/requirements.md)
- [PHASE1_MASTER_PLAN.md](/C:/ADF/docs/PHASE1_MASTER_PLAN.md)
- [adf-phase1-current-gap-closure-plan.md](/C:/ADF/docs/phase1/adf-phase1-current-gap-closure-plan.md)
- [AGENTS.md](/C:/ADF/AGENTS.md)
- [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
- [SKILL.md](/C:/ADF/skills/implement-plan/SKILL.md)
- [workflow-contract.md](/C:/ADF/skills/implement-plan/references/workflow-contract.md)
- [SKILL.md](/C:/ADF/skills/review-cycle/SKILL.md)
- [SKILL.md](/C:/ADF/skills/merge-queue/SKILL.md)

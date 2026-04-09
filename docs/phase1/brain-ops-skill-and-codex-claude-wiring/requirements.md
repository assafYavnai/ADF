# Requirements

## Skill Surface

1. The slice must add one repo-owned skill named `brain-ops` under `skills/brain-ops/`.
2. The skill must give contextless agents one canonical operational route for Brain work inside ADF:
   - verify connectivity
   - read/search context
   - capture durable knowledge
   - manage trust or cleanup when a proof write is needed
3. The skill must be explicit that assistant-side `project-brain` MCP tools remain preferred when they are actually exposed, but the repo fallback path must be first-class and supported when that namespace is absent.

## Supported Brain Route

4. The fallback operational route must use the supported built Brain client path, not raw DB access and not a new ad-hoc integration.
5. The skill helper must rely on the same Brain route family already proved by:
   - `COO/controller/memory-engine-client.ts`
   - `tools/doctor-brain-connect-smoke.mjs`
   - `tools/doctor-brain-audit.mjs`
6. The route must remain on-demand stdio MCP, not a newly required always-on daemon contract.

## Wiring

7. The repo skill manifest must register the new skill so generated installs can include it.
8. ADF CLI bootstrap guidance must point agents to the new skill for Brain operations instead of forcing fresh route discovery.
9. Codex and Claude installs must be refreshed through `skills/manage-skills.mjs`, not by editing user install roots directly.

## Verification

10. Proof must show a successful Brain connectivity check.
11. Proof must show a successful Brain read/search operation.
12. Proof must show at least one controlled write path plus truthful trust management or cleanup.
13. Proof must show `manage-skills install/check` passing for Codex and Claude after the new skill is added.

## Boundaries

14. The slice must not widen into general Brain architecture redesign, COO product changes, or generic documentation cleanup.
15. The slice must not create another long standalone guide when the existing problem is operational discoverability.

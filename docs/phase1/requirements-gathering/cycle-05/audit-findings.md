1. Findings

1. failure class: shared workflow-status lifecycle regression

broken route invariant in one sentence: workflow-truth visibility changes must stay confined to the explicit onion provisional-finalization route and the dedicated `archive`/`supersede` retirement routes; shared create and trust-update surfaces must not move rows in or out of default-reader truth.

exact route: controller helper or direct MCP caller -> `requirements_manage create` / `memory_manage update_trust_level` with `workflow_status` -> the memory engine writes `memory_items.workflow_metadata.status` -> default readers (`requirements_manage` list/search, `search_memory`, `get_context_summary`) hide or republish the row as if a governed lifecycle transition occurred.

exact file/line references: the intended narrow onion use is [onion-live.ts#L539](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L539) and [onion-live.ts#L589](/C:/ADF/COO/requirements-gathering/live/onion-live.ts#L589); the widened shared surfaces are [memory-engine-client.ts#L145](/C:/ADF/COO/controller/memory-engine-client.ts#L145), [memory-engine-client.ts#L181](/C:/ADF/COO/controller/memory-engine-client.ts#L181), [governance.ts#L25](/C:/ADF/components/memory-engine/src/schemas/governance.ts#L25), [memory-item.ts#L122](/C:/ADF/components/memory-engine/src/schemas/memory-item.ts#L122), [governance-tools.ts#L100](/C:/ADF/components/memory-engine/src/tools/governance-tools.ts#L100), [governance-tools.ts#L176](/C:/ADF/components/memory-engine/src/tools/governance-tools.ts#L176), [memory-tools.ts#L156](/C:/ADF/components/memory-engine/src/tools/memory-tools.ts#L156), [server.ts#L372](/C:/ADF/components/memory-engine/src/server.ts#L372), [server.ts#L374](/C:/ADF/components/memory-engine/src/server.ts#L374), [server.ts#L375](/C:/ADF/components/memory-engine/src/server.ts#L375), [evidence-policy.ts#L16](/C:/ADF/components/memory-engine/src/evidence-policy.ts#L16), [governance-tools.ts#L39](/C:/ADF/components/memory-engine/src/tools/governance-tools.ts#L39), [search.ts#L202](/C:/ADF/components/memory-engine/src/services/search.ts#L202), and [context.ts#L55](/C:/ADF/components/memory-engine/src/services/context.ts#L55).

concrete operational impact: the cycle-04 atomic publish defect itself is closed, but the same fix now lets non-onion callers create hidden governance rows or hide/re-publish existing rows without the dedicated `archive`/`supersede` policy, tags, or retirement metadata, so durable DB truth and default-reader truth can diverge outside the intended finalized-requirement contract.

sweep scope: `requirements_manage` plus the sibling governance families sharing `governanceSchema` (`rules_manage`, `roles_manage`, `settings_manage`, `findings_manage`, `open_loops_manage`), every controller caller of `brainCreateRequirement` / `brainManageMemory`, direct MCP consumers, and all reader paths gated by `modernMemoryEvidenceClause`.

closure proof: add negative integration coverage proving generic governance `create` rejects or ignores `workflow_status`, and generic `memory_manage update_trust_level` cannot set `pending_finalization`/`archived`/`superseded` or clear them back to `current` outside the narrow finalized-requirement publish path; add DB proof that archive/supersede metadata only appears through their dedicated actions; then regenerate [report.json](/C:/ADF/tests/integration/artifacts/onion-route-proof/report.json) and [onion-live-integration-report.md](/C:/ADF/docs/phase1/onion-live-integration-report.md) against that narrowed contract.

status: regression

2. Conceptual Root Cause

1. missing lifecycle-status scoping contract

cycle-04 fixed the rejected freeze->create->lock route by introducing `workflow_status`, but the capability was added as a shared schema/tool field instead of a constrained route-only policy. The missing invariant was that reader-visibility state changes are governed lifecycle transitions, not general-purpose options on shared governance create and `update_trust_level` surfaces.

3. High-Level View Of System Routes That Still Need Work

1. shared governance create / trust-update -> workflow-status mutation -> default-reader truth

why endpoint-only fixes will fail: narrowing only [onion-live.ts](/C:/ADF/COO/requirements-gathering/live/onion-live.ts) leaves the shared memory-engine schemas and server path able to hide or republish rows; narrowing only the reader filter would re-expose provisional finalized rows and reopen the cycle-04 failure class.

the minimal layers that must change to close the route: memory-engine schema/tool validation, server-side mutation guards, controller helper/type forwarding, negative integration coverage for sibling governance families, and the proof/report wording that currently treats the boundary as narrow without enforcing it.

explicit non-goals, so scope does not widen into general refactoring: no onion workflow redesign, no change to the closed happy-path freeze->create->lock behavior, no telemetry schema redesign, and no broad evidence-lifecycle overhaul beyond scoping this lifecycle-control capability.

what done looks like operationally: only the live finalized-requirement route can create `pending_finalization` rows and publish them back to `current` on lock success, `archive`/`supersede` remain the only ways to retire rows from default truth, generic trust updates cannot silently hide or republish governed artifacts, and the proof suite covers both the positive onion path and rejected sibling-route calls.

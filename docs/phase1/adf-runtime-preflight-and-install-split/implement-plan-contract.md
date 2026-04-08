1. Implementation Objective

Implement a production-grade ADF launcher/bootstrap split that makes runtime detection explicit and fast, keeps bash as the enforced workflow shell, separates install/bootstrap repair from normal runtime preflight, and provides enough machine-readable environment truth for agents to stop guessing about Windows host behavior, bash availability, command construction style, and launcher entrypoints.

2. Slice Scope

- Add a fast runtime-preflight route to the ADF launcher layer, with JSON-capable output for agent/bootstrap use.
- Add an explicit install/bootstrap route for slower dependency/build/setup repair work that does not run on every normal launch.
- Keep doctor as a bounded repair plus fail-closed verification path.
- Update bootstrap and architecture docs so CLI and VS Code agents must run runtime preflight first and use its output as authority.
- Add targeted tests or proof scripts for runtime-preflight output, install/runtime split behavior, and Windows-host bash enforcement.

3. Required Deliverables

- Launcher changes in [adf.sh](/C:/ADF/adf.sh), [adf.cmd](/C:/ADF/adf.cmd), and wrapper/helpers as needed.
- One machine-readable runtime-preflight output route, preferably `--json` capable.
- One explicit install/bootstrap route for dependency/build/setup repair.
- Updated bootstrap docs in [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md), and [AGENTS.md](/C:/ADF/AGENTS.md).
- Updated architecture truth in [architecture.md](/C:/ADF/docs/v0/architecture.md) if the launcher contract changes materially.
- Proof-bearing tests or runnable proof artifacts that show the supported route and the split behavior.
- Route-level KPI instrumentation plus proof-query support for explicit runtime-preflight, explicit install, bounded normal launch preflight, and their bounded repair substeps, unless a valid temporary exception keeps the route explicitly non-production.
- Closeout with review-cycle handoff using `until_complete=true`.

4. Allowed Edits

- [adf.sh](/C:/ADF/adf.sh)
- [adf.cmd](/C:/ADF/adf.cmd)
- [adf-launcher.ps1](/C:/ADF/tools/adf-launcher.ps1) and [adf-launcher.mjs](/C:/ADF/tools/adf-launcher.mjs) if they remain trampolines or probe helpers
- New helper scripts under [tools](/C:/ADF/tools) for runtime preflight, install-state, or proof support
- [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
- [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md)
- [AGENTS.md](/C:/ADF/AGENTS.md)
- [architecture.md](/C:/ADF/docs/v0/architecture.md)
- Targeted tests/proof assets under [tests](/C:/ADF/tests) or this feature root

5. Forbidden Edits

- Do not redesign Brain transport or MCP transport architecture.
- Do not add silent fallback away from required bash or required MCP contracts.
- Do not add package auto-upgrade or version drift on startup.
- Do not replace bash with PowerShell or Python as the ADF workflow shell.
- Do not widen the slice into generic package-management refactoring or unrelated COO behavior work.
- Do not weaken the existing fail-closed bash policy established by the bash-execution-enforcement stream.

6. Acceptance Gates

1. Normal launch has a distinct fast runtime-preflight path and no longer performs deep install/build freshness scans on every invocation.
2. ADF exposes a distinct explicit install/bootstrap path for repo dependency/build/setup repair work.
3. Runtime preflight emits structured truth for host OS, execution shell, bash health, approved bash runtime, command construction mode, path style, launcher guidance, and Brain MCP availability or health.
4. Windows host behavior remains explicit while bash stays the required ADF workflow shell.
5. Missing or broken bash still blocks launch and preflight truthfully.
6. Doctor remains bounded repair plus fail-closed verification and does not become a hidden fallback route.
7. CLI and VS Code bootstrap docs require the runtime preflight route before workflow execution.
8. Tests or proof artifacts cover the supported route and the install/runtime split.
9. Live launcher-route KPI instrumentation and proof exist for explicit runtime-preflight, explicit install, bounded normal launch preflight, and their bounded repair substeps, with production and proof partitions kept durably separate.
10. Any KPI exception carries explicit approval, owner, expiry, compensating control, and explicit non-production status; otherwise the route is not eligible for truthful closeout.
11. The implementation is committed, pushed, and handed to review-cycle with `until_complete=true`.

7. Observability / Audit

- Runtime preflight must truthfully report the detected environment and the reason for any block.
- Install/bootstrap, runtime-preflight, doctor, and normal launch routes must stay distinguishable in behavior and proof.
- Claimed route, route mutated, and route proved must match in review-cycle artifacts.
- Any runtime preflight JSON route must be stable enough for bootstrap consumption and test assertions.
- Launcher-route KPI truth must come from durable route telemetry on the real launcher entrypoints, not from narrative-only closeout claims.
- Production and proof telemetry partitions must remain separately queryable so proof rows never silently count as production truth.
- Proof bundles for this slice must include both direct route logs and a proof-partition query keyed to the proof-run identifier.

8. Dependencies / Constraints

- ADF shell contract remains bash-first on every host OS.
- On Windows, supported bash runtimes remain approved MSYS2 or Git Bash paths only.
- Existing package roots remain [COO](/C:/ADF/COO) and [components/memory-engine](/C:/ADF/components/memory-engine); this slice does not require a root package manager redesign.
- Runtime preflight must stay cheap enough for every launch.
- Install/bootstrap repair may be slower and can inspect or rebuild dependencies/artifacts, but only on explicit route entry or doctor repair.
- The missing direct `project-brain` MCP surface in this Codex runtime remains a known runtime defect and must not be papered over by this slice.

9. Non-Goals

- No Brain transport redesign.
- No automatic package version upgrades on load.
- No replacement of bash with PowerShell or Python as the ADF workflow shell.
- No unrelated COO product or conversation behavior changes.
- No generic package-management or dependency-topology cleanup outside the explicit launcher/bootstrap split.

10. Source Authorities

- [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md)
- [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md)
- [AGENTS.md](/C:/ADF/AGENTS.md)
- [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
- [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md)
- [architecture.md](/C:/ADF/docs/v0/architecture.md)
- [context.md](/C:/ADF/docs/phase1/bash-execution-enforcement/context.md)
- [fix-plan.md](/C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/fix-plan.md)
- [fix-report.md](/C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/fix-report.md)

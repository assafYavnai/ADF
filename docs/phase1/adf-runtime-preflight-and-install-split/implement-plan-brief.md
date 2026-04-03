1. Implementation Objective

Implement a bounded ADF launcher/bootstrap slice that adds a mandatory runtime-preflight route for agents, separates explicit install/bootstrap repair from normal runtime startup, and preserves the fail-closed bash plus Brain MCP contract.

2. Exact Slice Scope

- Launcher entrypoints: [adf.sh](/C:/ADF/adf.sh), [adf.cmd](/C:/ADF/adf.cmd), and trampoline helpers only as needed.
- Bootstrap docs: [AGENTS.md](/C:/ADF/AGENTS.md), [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md), [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md).
- Architecture truth if materially affected: [architecture.md](/C:/ADF/docs/v0/architecture.md).
- Runtime preflight/install helper code under [tools](/C:/ADF/tools).
- Targeted proof/tests under [tests](/C:/ADF/tests) or [adf-runtime-preflight-and-install-split](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split).

3. Inputs / Authorities Read

- [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md)
- [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md)
- [AGENTS.md](/C:/ADF/AGENTS.md)
- [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
- [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md)
- [architecture.md](/C:/ADF/docs/v0/architecture.md)
- [context.md](/C:/ADF/docs/phase1/bash-execution-enforcement/context.md)
- [fix-plan.md](/C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/fix-plan.md)
- [fix-report.md](/C:/ADF/docs/phase1/bash-execution-enforcement/cycle-02/fix-report.md)

4. Required Deliverables

- A fast runtime-preflight route with structured output for bootstrap use.
- An explicit install/bootstrap route for dependency/build/setup repair.
- Updated launcher behavior so normal startup does not rerun deep install/build freshness scans.
- Updated CLI and VS Code bootstrap docs that make runtime preflight mandatory.
- Proof-bearing tests or runnable proof scripts for the supported route and split behavior.
- Review-cycle handoff with `until_complete=true`.

5. Forbidden Edits

- Do not redesign Brain transport.
- Do not add hidden fallback away from bash or MCP.
- Do not add package auto-upgrade on load.
- Do not widen into generic dependency-management or unrelated COO work.
- Do not weaken the bash-only ADF shell contract.

6. Integrity-Verified Assumptions Only

- [adf.sh](/C:/ADF/adf.sh) currently mixes normal launch preflight with dependency/build repair work.
- [adf.cmd](/C:/ADF/adf.cmd) is already a bash trampoline on Windows and must stay that way.
- CLI bootstrap already states bash is canonical on Windows, but VS Code bootstrap does not yet carry the same shell guidance.
- The current implement-plan runtime setup is `codex_cli_exec` with `codex_cli_full_auto_bypass`, so this feature may use the strongest truthful CLI-backed worker mode.
- Bash-execution-enforcement already proved the supported bash route and fail-closed doctor behavior, so this slice must extend that truth rather than replace it.

7. Explicit Non-Goals

- No Brain transport redesign.
- No auto-update of package versions at startup.
- No PowerShell or Python replacement for bash as the workflow shell.
- No unrelated COO behavior changes.

8. Proof / Verification Expectations

- Runtime-preflight proof covering healthy and blocked environments.
- Proof that normal launch no longer performs deep install/build freshness checks on every run.
- Proof that explicit install/bootstrap route performs the slower dependency/build/setup work.
- Proof that Windows host plus bash-shell guidance remains truthful.
- Proof that doctor still repairs bounded prerequisites and fails closed when health does not recover.
- Review-cycle route proof with claimed route matching proved route.

9. Required Artifact Updates

- [README.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/README.md)
- [context.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/context.md)
- [implement-plan-contract.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-contract.md)
- [implement-plan-brief.md](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split/implement-plan-brief.md)
- [AGENTS.md](/C:/ADF/AGENTS.md)
- [cli-agent.md](/C:/ADF/docs/bootstrap/cli-agent.md)
- [vscode-agent.md](/C:/ADF/docs/bootstrap/vscode-agent.md)
- [architecture.md](/C:/ADF/docs/v0/architecture.md) if launcher/runtime contract changes materially
- Review-cycle artifacts under [adf-runtime-preflight-and-install-split](/C:/ADF/docs/phase1/adf-runtime-preflight-and-install-split)

10. Closeout Rules

- Keep the route contract frozen before broad code edits.
- Use only bounded mutation surfaces listed in the contract.
- Update materially affected authoritative docs in the same slice.
- Produce proof-bearing closure, not narrative-only closure.
- Commit and push code plus feature artifacts.
- Send the same feature stream to review-cycle with `until_complete=true` and do not mark it complete until review closes cleanly.

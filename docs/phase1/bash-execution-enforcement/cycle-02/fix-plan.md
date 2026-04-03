1. Failure Classes

- None. Cycle 02 is a proof-only closeout pass for the remaining bash-route evidence gap from cycle 01.

2. Route Contracts

- Claimed supported route: `real VS Code bash terminal -> adf.sh / adf.cmd -> approved bash runtime -> doctor/help/live launcher path`.
- End-to-end invariants:
  - a real bash terminal proves the supported route directly
  - `adf.cmd` remains a Windows trampoline into approved bash only
  - fake `SHELL` values do not become workflow authority
  - doctor succeeds only with working bash, working Brain MCP, and a Brain audit write
- Allowed mutation surfaces:
  - review-cycle artifacts only
  - proof bundle capture under `cycle-01/proof-runs/20260403T100811Z`
- Forbidden shared-surface expansion:
  - no code changes in cycle 02
  - no launcher redesign
  - no fallback transport or alternate shell route
- Docs to update:
  - `docs/phase1/bash-execution-enforcement/cycle-02/fix-report.md`

3. Sweep Scope

- `cycle-01/fix-report.md`
- `cycle-01/proof-runs/20260403T100811Z/*`
- `adf.sh`
- `adf.cmd`
- `tools/adf-launcher.ps1`
- `tools/adf-launcher.mjs`

4. Planned Changes

- Persist the new proof bundle as repo truth.
- Record cycle-02 review closure with no additional implementation changes.

5. Closure Proof

- `cycle-01/proof-runs/20260403T100811Z/proof-summary.md`
- `cycle-01/proof-runs/20260403T100811Z/01-shell-identity.log`
- `cycle-01/proof-runs/20260403T100811Z/03-adf-help.log`
- `cycle-01/proof-runs/20260403T100811Z/04-cmd-wrapper-help.log`
- `cycle-01/proof-runs/20260403T100811Z/05-negative-cmd-shell.log`
- `cycle-01/proof-runs/20260403T100811Z/06-negative-ps-shell.log`
- `cycle-01/proof-runs/20260403T100811Z/07-negative-node-shell.log`
- `cycle-01/proof-runs/20260403T100811Z/09-doctor.log`
- Negative proof required: the fake-`SHELL` runs must continue to route through approved bash rather than becoming authority.
- Live/proof isolation check: the positive route was exercised from a real VS Code bash terminal, not from the previously blocked Codex host bridge.

6. Non-Goals

- Any further code changes.
- Host-bridge debugging outside the supported VS Code bash route.
- Brain transport redesign.

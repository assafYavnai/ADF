# Bash Enforcement Proof Run

- Started at: 2026-04-03T10:08:11Z
- Completed at: 2026-04-03T10:08:28Z
- Repo root: `/c/ADF`
- Host uname: `MINGW64_NT-10.0-26200`
- Branch: `main`
- HEAD: `8f46e15cc1914f36d2a4e47902d7298d74238974`
- Script: `/c/ADF/docs/phase1/bash-execution-enforcement/cycle-01/run-proof-sequence.sh`
- Overall result: `PASS`
- Fail fast: `true`
- Step timeout seconds: `600`

## Steps

| Step | Status | Exit | Log | Description |
| --- | --- | ---: | --- | --- |
| `01-shell-identity` | `PASS` | `0` | [`01-shell-identity.log`](./01-shell-identity.log) | Prove the current terminal is a real bash runtime. |
| `02-windows-package-managers` | `PASS` | `0` | [`02-windows-package-managers.log`](./02-windows-package-managers.log) | Prove Windows-safe package-manager shims are available. |
| `03-adf-help` | `PASS` | `0` | [`03-adf-help.log`](./03-adf-help.log) | Run the authoritative bash launcher help route. |
| `04-cmd-wrapper-help` | `PASS` | `0` | [`04-cmd-wrapper-help.log`](./04-cmd-wrapper-help.log) | Run the Windows trampoline help route. |
| `05-negative-cmd-shell` | `PASS` | `0` | [`05-negative-cmd-shell.log`](./05-negative-cmd-shell.log) | Force SHELL to PowerShell and prove adf.cmd rejects it as authority. |
| `06-negative-ps-shell` | `PASS` | `0` | [`06-negative-ps-shell.log`](./06-negative-ps-shell.log) | Force SHELL to PowerShell and prove the PowerShell trampoline still selects approved bash only. |
| `07-negative-node-shell` | `PASS` | `0` | [`07-negative-node-shell.log`](./07-negative-node-shell.log) | Force SHELL to PowerShell and prove the Node trampoline still selects approved bash only. |
| `08-node-check` | `PASS` | `0` | [`08-node-check.log`](./08-node-check.log) | Run syntax validation for the Node trampoline. |
| `09-doctor` | `PASS` | `0` | [`09-doctor.log`](./09-doctor.log) | Run the fail-closed doctor route and capture Brain audit or incident output. |

## Notes

- Run this proof bundle from a real VS Code bash terminal when you need the supported positive route.
- If doctor fails, inspect the generated incident report path in the doctor log.
- This runner streams step output live to the terminal and log files.
- By default the runner is fail-fast. Use `--continue-on-error` if you need a full proof sweep after a failure.

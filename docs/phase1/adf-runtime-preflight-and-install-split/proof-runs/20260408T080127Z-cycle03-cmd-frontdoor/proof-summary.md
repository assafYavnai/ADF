# Runtime Preflight Proof Summary

- Feature: `adf-runtime-preflight-and-install-split`
- Run directory: `/c/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor`
- Repository root: `/c/ADF`
- Telemetry partition: `proof`
- Proof run id: `20260408T080127Z-cycle03-cmd-frontdoor`

| Step | Status | Log | Description |
| --- | --- | --- | --- |
| `01-runtime-preflight` | `PASS` | [`01-runtime-preflight.log`](./01-runtime-preflight.log) | Run runtime-preflight on the authoritative bash route. |
| `02-cmd-runtime-preflight` | `PASS` | [`02-cmd-runtime-preflight.log`](./02-cmd-runtime-preflight.log) | Run runtime-preflight through the Windows trampoline route and fail closed unless the saved log is valid JSON. |
| `03-install` | `PASS` | [`03-install.log`](./03-install.log) | Make existing artifacts stale, then run the explicit install/bootstrap route and prove it rebuilds them. |
| `04-cmd-install` | `PASS` | [`04-cmd-install.log`](./04-cmd-install.log) | Make existing artifacts stale, then run the explicit install route through the Windows cmd trampoline. |
| `05-runtime-preflight-post-install` | `PASS` | [`05-runtime-preflight-post-install.log`](./05-runtime-preflight-post-install.log) | Run runtime-preflight again after install/bootstrap. |
| `06-launch-preflight-scripted` | `PASS` | [`06-launch-preflight-scripted.log`](./06-launch-preflight-scripted.log) | Make artifacts stale again, then run a scripted normal launch to prove bounded launch repair plus preflight truth. |
| `07-cmd-launch-preflight-scripted` | `PASS` | [`07-cmd-launch-preflight-scripted.log`](./07-cmd-launch-preflight-scripted.log) | Make artifacts stale again, then run a scripted normal launch through the Windows cmd trampoline. |
| `08-kpi-proof` | `PASS` | [`08-kpi-proof.log`](./08-kpi-proof.log) | Query proof-partition launcher telemetry for the exercised launcher routes in this bundle. |
| `09-help` | `PASS` | [`09-help.log`](./09-help.log) | Run launcher help after the split routes are in place. |

Useful commands:
- `cat /c/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor/proof-summary.md`
- `ls /c/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T080127Z-cycle03-cmd-frontdoor`

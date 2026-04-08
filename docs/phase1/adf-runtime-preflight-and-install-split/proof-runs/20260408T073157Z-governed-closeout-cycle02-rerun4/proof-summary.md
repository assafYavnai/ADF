# Runtime Preflight Proof Summary

- Feature: `adf-runtime-preflight-and-install-split`
- Run directory: `/c/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4`
- Repository root: `/c/ADF`
- Telemetry partition: `proof`
- Proof run id: `20260408T073157Z-governed-closeout-cycle02-rerun4`

| Step | Status | Log | Description |
| --- | --- | --- | --- |
| `01-runtime-preflight` | `PASS` | [`01-runtime-preflight.log`](./01-runtime-preflight.log) | Run runtime-preflight on the authoritative bash route. |
| `02-cmd-runtime-preflight` | `PASS` | [`02-cmd-runtime-preflight.log`](./02-cmd-runtime-preflight.log) | Run runtime-preflight through the Windows trampoline route and fail closed unless the saved log is valid JSON. |
| `03-install` | `PASS` | [`03-install.log`](./03-install.log) | Make existing artifacts stale, then run the explicit install/bootstrap route and prove it rebuilds them. |
| `04-runtime-preflight-post-install` | `PASS` | [`04-runtime-preflight-post-install.log`](./04-runtime-preflight-post-install.log) | Run runtime-preflight again after install/bootstrap. |
| `05-launch-preflight-scripted` | `PASS` | [`05-launch-preflight-scripted.log`](./05-launch-preflight-scripted.log) | Make artifacts stale again, then run a scripted normal launch to prove bounded launch repair plus preflight truth. |
| `06-kpi-proof` | `PASS` | [`06-kpi-proof.log`](./06-kpi-proof.log) | Query proof-partition launcher telemetry for the exercised launcher routes in this bundle. |
| `07-help` | `PASS` | [`07-help.log`](./07-help.log) | Run launcher help after the split routes are in place. |

Useful commands:
- `cat /c/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4/proof-summary.md`
- `ls /c/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T073157Z-governed-closeout-cycle02-rerun4`

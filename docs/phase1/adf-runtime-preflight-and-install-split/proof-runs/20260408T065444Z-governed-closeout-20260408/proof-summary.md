# Runtime Preflight Proof Summary

- Feature: `adf-runtime-preflight-and-install-split`
- Run directory: `/c/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408`
- Repository root: `/c/ADF`

| Step | Status | Log | Description |
| --- | --- | --- | --- |
| `01-runtime-preflight` | `PASS` | [`01-runtime-preflight.log`](./01-runtime-preflight.log) | Run runtime-preflight on the authoritative bash route. |
| `02-cmd-runtime-preflight` | `PASS` | [`02-cmd-runtime-preflight.log`](./02-cmd-runtime-preflight.log) | Run runtime-preflight through the Windows trampoline route. |
| `03-install` | `PASS` | [`03-install.log`](./03-install.log) | Run the explicit install/bootstrap route. |
| `04-runtime-preflight-post-install` | `PASS` | [`04-runtime-preflight-post-install.log`](./04-runtime-preflight-post-install.log) | Run runtime-preflight again after install/bootstrap. |
| `05-help` | `PASS` | [`05-help.log`](./05-help.log) | Run launcher help after the split routes are in place. |

Useful commands:
- `cat /c/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408/proof-summary.md`
- `ls /c/ADF/docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/20260408T065444Z-governed-closeout-20260408`

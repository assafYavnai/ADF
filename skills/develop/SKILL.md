---
name: develop
description: Use the public governed development front door for help, status, settings, and guarded Slice A implement/fix stubs.
---

# Develop

`develop` is the only public governed implementation skill for ADF.

Public v1 commands:

- `help`
- `settings [json]`
- `status <slice>`
- `implement <slice>`
- `fix <slice>`

Rules:

- route all commands through `scripts/develop-helper.mjs`
- keep lifecycle truth in governed feature artifacts, receipts, merge truth, and bounded operational projections
- keep prerequisite and integrity validation in `scripts/develop-governor.mjs`
- keep Slice A bounded: no worker spawning, no review-cycle delegation, no merge-queue delegation, no MCP bridge

Examples:

- `node skills/develop/scripts/develop-helper.mjs help`
- `node skills/develop/scripts/develop-helper.mjs settings`
- `node skills/develop/scripts/develop-helper.mjs settings '{"implementor_model":"gpt-5.3-codex-spark"}'`
- `node skills/develop/scripts/develop-helper.mjs status --phase-number 1 --feature-slug develop-shell-help-settings-status-governor`
- `node skills/develop/scripts/develop-helper.mjs implement --phase-number 1 --feature-slug example-slice --task-summary "Bounded Slice A request"`
- `node skills/develop/scripts/develop-helper.mjs fix --phase-number 1 --feature-slug example-slice --fix-instruction "Bounded Slice A fix request"`

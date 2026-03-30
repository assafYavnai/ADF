# BOM Question Follow-Up

Date: 2026-03-30
Status: recorded and reverted

## Context

The user asked whether the active governed tooling could be made BOM-resistant.
The implementation path was taken without an explicit instruction to make the change.
Per later user direction, the code changes were documented and then reverted.

## Findings

Yes, BOM resistance is straightforward for the active pilot path.

Important follow-up decision:

- BOM support should not be landed in the same commit as the current live runtime bug fixes.
- The agreed sequence is:
  1. record BOM findings and runtime review findings in context
  2. fix the live runtime bugs first
  3. land BOM support as a separate deterministic-healing change
  4. run tests after both commits

Reason:

- the runtime bugs are current correctness defects in the governed path
- BOM support is a resilience and auditability change
- combining them would make review and blame assignment noisier

The BOM-sensitive parse points were:

- `tools/agent-role-builder/src/index.ts`
  - request file parsing
- `tools/agent-role-builder/src/services/board.ts`
  - reviewer/leader auto-fix JSON validation
  - snapshot rulebook parsing
- `tools/llm-tool-builder/src/index.ts`
  - request file parsing
  - baseline contract parsing
- `shared/governance-runtime/engine.ts`
  - governed JSON loading
  - snapshot JSON rewrite path
- `shared/review-engine/config.ts`
  - governed review config loading
- `shared/review-engine/engine.ts`
  - model JSON response cleanup/parsing
- `shared/learning-engine/engine.ts`
  - review prompt / contract context parsing
  - learning JSON response parsing
- `shared/component-repair-engine/engine.ts`
  - tagged `compliance_map` JSON parsing
  - tagged `fix_items_map` JSON parsing

The implementation approach used a small helper:

```ts
function stripUtf8Bom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
```

and applied it immediately before `JSON.parse(...)` or before JSON cleanup in the shared review parser.

That earlier list was directionally correct, but it was not a complete patch inventory. The additional parse points above need to be treated as part of the real BOM surface if support is implemented later.

## Diff Summary

The unrequested BOM-resistance patch changed these files:

- `shared/governance-runtime/engine.ts`
  - stripped BOM before JSON parse in `copyRequiredFile(...)`
  - stripped BOM before JSON parse in `readJsonRequired(...)`
- `shared/review-engine/config.ts`
  - stripped BOM before `loadJsonRequired(...)` parse
- `shared/review-engine/engine.ts`
  - stripped BOM in `cleanJsonResponse(...)`
  - stripped BOM in `extractFencedJson(...)`
- `shared/learning-engine/engine.ts`
  - stripped BOM before learning response parse
  - stripped BOM before review prompt / contract context parse
- `shared/component-repair-engine/engine.ts`
  - would also need BOM stripping if tagged JSON sections are expected to be BOM-tolerant in practice
- `tools/agent-role-builder/src/index.ts`
  - stripped BOM before request parse
- `tools/agent-role-builder/src/services/board.ts`
  - would also need BOM stripping before validating auto-fix JSON and before parsing the snapshot rulebook
- `tools/llm-tool-builder/src/index.ts`
  - stripped BOM before request parse
  - stripped BOM before baseline contract parse

No schema changes were required.

## Tests Required

If BOM resistance is implemented later by explicit request, the minimum test set should be:

1. BOM-prefixed `agent-role-builder` request file parses and executes normally.
2. BOM-prefixed `llm-tool-builder` request file parses normally.
3. BOM-prefixed `baseline_contract_path` for `llm-tool-builder` parses normally.
4. BOM-prefixed shared/component governance files load through `shared/governance-runtime/engine.ts`.
5. Snapshot rewrite succeeds when BOM is present in copied `review-prompt.json` and `review-contract.json`.
6. BOM-prefixed reviewer JSON output parses through `shared/review-engine/engine.ts`.
7. BOM-prefixed leader JSON output parses through `shared/review-engine/engine.ts`.
8. BOM-prefixed learning-engine response parses through `shared/learning-engine/engine.ts`.
9. BOM-prefixed board auto-fix JSON parses through `tools/agent-role-builder/src/services/board.ts`.
10. BOM-prefixed snapshot rulebook parses through `tools/agent-role-builder/src/services/board.ts`.
11. BOM-prefixed tagged repair-engine JSON sections parse through `shared/component-repair-engine/engine.ts`.

## Validation Performed Before Revert

These checks were run on the temporary patch before revert:

- `tsc -p shared/tsconfig.json --noEmit`
- `tsc -p tools/agent-role-builder/tsconfig.json --noEmit`
- BOM-prefixed invalid-roster request run for `agent-role-builder`
- BOM-prefixed temporary governance snapshot creation through `shared/governance-runtime/engine.ts`
- BOM-prefixed reviewer/leader JSON parsing through `shared/review-engine/engine.ts`

## Outcome

The BOM-resistance patch was viable, but it was not explicitly requested.
The code changes were reverted after this note was recorded.

Additional audit conclusion:

- the BOM failure on request-file parsing was not captured by the governed audit path because it occurred before a run-scoped governance context existed
- if BOM support is implemented later, it should be paired with a bootstrap audit/healing record so deterministic ingress normalization is visible rather than silent

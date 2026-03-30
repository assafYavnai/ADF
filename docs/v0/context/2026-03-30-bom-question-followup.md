# BOM Question Follow-Up

Date: 2026-03-30
Status: implemented later by explicit follow-up after the runtime bug-fix split

## Context

The user asked whether the active governed tooling could be made BOM-resistant.
The implementation path was taken without an explicit instruction to make the change.
Per later user direction, the code changes were documented and then reverted.

Later in the same day, the work was explicitly approved as a separate second phase after the live runtime bug fixes were landed first.

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

## Implemented Patch Surface

The explicit BOM-support pass changed these files:

- `shared/json-ingress.ts`
  - added shared BOM-tolerant JSON normalization/parsing helpers for shared runtime modules
- `tools/agent-role-builder/src/services/json-ingress.ts`
  - added tool-local request-ingress normalization helpers plus bootstrap/runtime audit writers

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
  - strips BOM before parsing tagged `compliance_map` and `fix_items_map` JSON
- `tools/agent-role-builder/src/index.ts`
  - strips BOM before request parse
  - writes a bootstrap incident artifact when request JSON still fails before a run can start
  - writes `runtime/ingress-normalization.jsonl` when request parsing continued after BOM stripping
- `tools/agent-role-builder/src/services/board.ts`
  - strips BOM before validating auto-fix JSON
  - strips BOM before parsing the snapshot rulebook
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

## Audit Behavior

The most important change was auditability for pre-run request ingress.

Current implemented behavior:

- if `agent-role-builder` strips a UTF-8 BOM from the request and parsing succeeds, it records a normalization event in `runtime/ingress-normalization.jsonl`
- if request parsing still fails before the governed run context exists, it writes a bootstrap incident artifact under `tools/agent-role-builder/runs/_bootstrap/`

This closes the specific audit gap that caused the original BOM failure to appear only as a CLI fatal error.

## Validation Before Full Runtime Test Pass

These checks were run immediately after implementation:

- `tsc -p shared/tsconfig.json --noEmit`
- `tsc -p tools/agent-role-builder/tsconfig.json --noEmit`
- `tsc -p tools/llm-tool-builder/tsconfig.json --noEmit`

The broader runtime tests remain a separate final step after both the runtime bug-fix commit and the BOM-support commit are in place.

## Follow-Up Fix After Runtime Validation

Runtime validation exposed one small bootstrap-audit defect:

- bootstrap incident files were named with a doubled `.json.json` suffix when the incoming request file already ended in `.json`

That defect has now been corrected in `tools/agent-role-builder/src/services/json-ingress.ts` by normalizing the request stem before appending the incident extension.

Focused regression coverage was added for:

1. request names ending in `.json`
2. request names without an extension
3. multi-dot request names such as `request.payload.json`

## Outcome

The BOM-resistance change is now explicitly implemented as a separate phase after the runtime bug fixes.

Additional audit conclusion:

- the BOM failure on request-file parsing was not captured by the governed audit path because it occurred before a run-scoped governance context existed
- the implemented fix now pairs BOM tolerance with a bootstrap audit/healing record so deterministic ingress normalization is visible rather than silent

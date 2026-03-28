# Implementation Review -- Step 2f

## Summary

**CONDITIONAL PASS** -- The shared infrastructure and tool governance system is architecturally sound, with consistent provenance threading, well-structured Zod schemas, and graceful error handling. However, there are 3 blocking issues (Gemini prompt injection, duplicated invoker code, governance actions not implemented), 5 major gaps, and several minor findings that should be resolved before production use.

---

## Findings by Severity

### Blocking

**B-1. Gemini CLI prompt injection via positional argument**
- File: `shared/llm-invoker/invoker.ts` line 196, `tools/agent-role-builder/src/shared-imports.ts` line 185
- Both `callGemini` implementations pass the full prompt as a positional CLI argument: `args.push(params.prompt)`. Combined with `shell: true` on `execFile`, this is a shell injection vector. A prompt containing backticks, `$(...)`, or semicolons will execute arbitrary commands. Codex and Claude correctly pipe via stdin; Gemini does not.
- **Fix**: Pipe prompt to Gemini via stdin, the same way Codex and Claude do, and remove `shell: true` from `execFile` if possible.

**B-2. Full invoker + provenance + telemetry duplicated as inline code in shared-imports.ts**
- File: `tools/agent-role-builder/src/shared-imports.ts` (224 lines)
- This file is a copy-paste of the entire `shared/llm-invoker/invoker.ts`, `shared/provenance/types.ts`, and a simplified telemetry implementation. It will silently diverge from the canonical shared modules as either side evolves. The telemetry `emit()` in shared-imports.ts is a no-op buffer with no sink -- metrics from agent-role-builder standalone runs are silently lost.
- **Fix**: Either configure TypeScript path aliases / npm workspace references so the tool can import from `shared/` directly, or create a build step that copies the shared modules rather than manually duplicating them.

**B-3. Governance actions `update` and `transition` advertised but not implemented**
- File: `components/memory-engine/src/tools/governance-tools.ts` lines 44-48
- The `GovernanceManageInput` schema and tool definitions advertise `update` and `transition` actions (line 186), but the `handleGovernance` switch only handles `list`, `get`, `create`, and `search`. Calls with `update` or `transition` fall through to the default returning a "not yet implemented" string -- but this is not an error response (`isError` is not set), so the caller cannot distinguish success from a stub.
- **Fix**: Either implement the actions or remove them from the schema/tool definition enum. If they remain stubs, set `isError: true` in the response.

### Major

**M-1. `as Provider` casts bypass type safety in the invoker**
- Files: `shared/llm-invoker/invoker.ts` lines 31, 64; `shared-imports.ts` lines 89, 107
- `params.cli as Provider` casts an `LLMProvider` (3 values: codex/claude/gemini) to `Provider` (4 values: codex/claude/gemini/system). The cast is safe today because LLMProvider is a subset, but the cast suppresses the compiler check. If `Provider` ever adds a value that LLMProvider doesn't have, or vice versa, the cast silently succeeds.
- **Fix**: Use `Provider.parse(params.cli)` for runtime validation, or widen `createLLMProvenance` to accept `LLMProvider` directly.

**M-2. Memory-engine provenance re-export (`provenance.ts`) is missing factory functions**
- File: `components/memory-engine/src/provenance.ts`
- This file re-exports `Provider`, `ProvenanceSchema`, `Provenance`, and `LEGACY_PROVENANCE` but does NOT re-export `createSystemProvenance` or `createLLMProvenance`. This means memory-engine code that needs to create fresh provenance objects must do so manually (as seen in `decision-tools.ts` extractProvenance function building the object field-by-field), which is error-prone and inconsistent with the shared canonical factories.
- **Fix**: Add `createSystemProvenance` and `createLLMProvenance` to the re-export, or import them directly from the shared module.

**M-3. COO controller loop has `tool_path` and `specialist_path` workflows classified but not handled**
- File: `COO/controller/loop.ts` lines 122-142
- The `ClassifierResultEvent` schema declares 6 workflows including `tool_path` and `specialist_path`, but the switch statement in `handleTurn` only explicitly handles `memory_operation`, `direct_coo_response`, `pushback`, and `clarification`. The `tool_path` and `specialist_path` cases silently fall through to the `default` case which treats them as a direct COO response. This means tool invocations and specialist delegation are not actually dispatched -- they are answered by the LLM directly.
- **Fix**: Add explicit `case "tool_path"` and `case "specialist_path"` handlers, even if they are initially stubs that return a "not yet implemented" message. The current silent fallthrough misroutes classified intents.

**M-4. `delete` in memory_manage does not record provenance for the deletion**
- File: `components/memory-engine/src/server.ts` lines 84-88
- The `delete` action calls three DELETE SQL statements but does not record any provenance about who deleted the item or why. The `archive` and `update_*` actions all write provenance columns, but delete just removes the rows with no audit trail.
- **Fix**: Either add a `deleted_items` audit table with provenance, or soft-delete by marking items as deleted with provenance (similar to `archive`).

**M-5. `createPgSink` in telemetry collector inserts one row at a time in a loop**
- File: `shared/telemetry/collector.ts` lines 77-104
- The PostgreSQL sink iterates over events and issues individual INSERT statements. For a buffer of 100 events (the max batch size), this means 100 sequential round-trips. Since telemetry is meant to be fire-and-forget and non-blocking, this sequential insert pattern can cause significant latency when the buffer fills up.
- **Fix**: Use a single multi-row INSERT or `COPY` command, or use `Promise.all` for concurrent inserts (with a connection pool).

### Minor

**m-1. Telemetry timestamp column mismatch**
- The `createPgSink` INSERT uses `NOW()` for `created_at` (line 85), but the `ProvenanceSchema` has its own `timestamp` field. The telemetry table stores the DB insertion time, not the event generation time. For async fire-and-forget with a 1-second buffer, these can differ by seconds.
- **Fix**: Store `event.provenance.timestamp` in a separate column or use it instead of `NOW()`.

**m-2. `callClaude` uses `require()` instead of dynamic `import()`**
- File: `shared/llm-invoker/invoker.ts` line 160
- `callClaude` uses `const { spawn } = require("node:child_process")` while `callCodex` uses `const { spawn } = await import("node:child_process")`. Both work, but mixing `require` and `import` in an ESM module is inconsistent and may cause issues with strict ESM configurations.
- **Fix**: Use `await import("node:child_process")` consistently (as `callCodex` does).

**m-3. `shell: true` used universally on all CLI spawns**
- Files: `shared/llm-invoker/invoker.ts`, `shared-imports.ts`
- All three CLI handlers use `shell: true` when spawning processes. This increases attack surface and is unnecessary when using `execFile` or `spawn` with an explicit args array. The `shell: true` is why B-1 is a real injection vector.
- **Fix**: Remove `shell: true` from all spawn/execFile calls. If the CLI tools are on PATH, they will be found without shell expansion.

**m-4. JSON parsing from LLM responses lacks Zod validation**
- Files: `shared/learning-engine/engine.ts` line 79, `tools/agent-role-builder/src/services/board.ts` lines 199, 479, 500
- LLM responses are parsed with `JSON.parse` and then consumed directly (or with only Array.isArray checks), but never validated against the expected Zod schemas (`LearningOutput`, `ReviewerVerdict`, `LeaderVerdict`). This means malformed LLM output could produce runtime errors downstream.
- **Fix**: Add `LearningOutput.safeParse()`, `ReviewerVerdict.safeParse()` etc. to the parsing paths.

**m-5. Compliance map and fix-items map schemas defined but never used in code**
- Files: `shared/learning-engine/compliance-map.ts`, `shared/learning-engine/fix-items-map.ts`
- These schemas are well-defined but no code in the reviewed files imports or uses them. The board service builds ad-hoc `fixChecklist` objects that resemble `FixItem` but don't use the schema.
- **Fix**: Wire the schemas into the board service and learning engine pipeline, or document them as "planned for Phase 2b."

**m-6. `boardResult.status` does not include `resume_required` in the `generateBoardSummary` type**
- File: `tools/agent-role-builder/src/index.ts` line 263
- The `generateBoardSummary` parameter types `status` as `string`, not `RoleBuilderStatus`. This loses the narrowing. Minor because it works at runtime.

**m-7. Thread serialization does not include provenance**
- File: `COO/controller/thread.ts` line 177, `serializeForLLM` function
- The text serialization for LLM context strips provenance from events, showing only type and data. This is probably intentional (provenance is noisy for LLM context), but it means the LLM has no visibility into which prior events were produced by which provider/model.
- **Fix**: Consider including a minimal provenance summary (provider/model) in the serialized output if this matters for multi-provider reasoning.

### Suggestions

**S-1. Add `process.on('exit')` flush for telemetry buffer**
- File: `shared/telemetry/collector.ts`
- If the process exits before the 1-second flush timer fires, buffered metrics are lost. Adding a synchronous `process.on('exit')` handler (or `process.on('beforeExit')`) would ensure the buffer is flushed on graceful shutdown.

**S-2. Add rule `severity` field to existing rulebook rules**
- Files: `tools/agent-role-builder/rulebook.json`, `tools/llm-tool-builder/rulebook.json`
- The `rule-book-guide.json` documents an optional `severity` field (critical/important/advisory) but none of the 24 existing rules use it. Adding severity would help prioritize compliance checking.

**S-3. `LLMProvider` vs `Provider` enum consolidation**
- Files: `shared/provenance/types.ts`, `shared/llm-invoker/types.ts`
- `Provider` adds "system" to the LLM providers. Consider using `Provider` everywhere and letting the invoker narrow it, rather than having two overlapping enums.

**S-4. Board review `reviewerStatus` key collision**
- File: `tools/agent-role-builder/src/services/board.ts` lines 78-80
- Reviewer status keys are generated as `reviewer-${r.provider}`, but if two reviewers share the same provider (e.g., two Claude reviewers), their status keys collide. The current validator prevents this (enforcing Codex+Claude pairs), but the key generation is fragile.

**S-5. Consider adding a `--stdin` flag for Gemini CLI**
- File: `shared/llm-invoker/invoker.ts`
- Once B-1 is fixed by piping via stdin, consider whether Gemini CLI supports a `--stdin` or `-` flag to explicitly read from stdin, for clarity.

---

## Provenance Completeness Audit

| Operation | Location | Provenance Present? | Notes |
|---|---|---|---|
| **Shared Infrastructure** | | | |
| LLM invocation | `shared/llm-invoker/invoker.ts` | YES | `createLLMProvenance` on every return path |
| Telemetry emit | `shared/telemetry/collector.ts` | YES | Every MetricEvent requires provenance in schema |
| Learning engine extraction | `shared/learning-engine/engine.ts` | PARTIAL | Source path passed to invoker, but output not provenance-tagged |
| **Memory Engine DB Writes** | | | |
| memory_items INSERT (capture) | `services/capture.ts` | YES | Provenance columns from input or LEGACY fallback |
| memory_embeddings INSERT (capture) | `services/capture.ts` | YES | invocation_id + source_path |
| memory_items INSERT (decision) | `tools/decision-tools.ts` | YES | Full provenance extracted from args |
| decisions INSERT | `tools/decision-tools.ts` | YES | invocation_id, provider, model, source_path |
| memory_embeddings INSERT (decision) | `tools/decision-tools.ts` | YES | invocation_id + source_path |
| memory_items INSERT (governance create) | `tools/governance-tools.ts` | YES | Full provenance from extractProvenance |
| memory_items UPDATE (archive) | `server.ts` memory_manage | YES | All 6 provenance columns updated |
| memory_items UPDATE (update_tags) | `server.ts` memory_manage | YES | All 6 provenance columns updated |
| memory_items UPDATE (update_trust_level) | `server.ts` memory_manage | YES | All 6 provenance columns updated |
| memory_items DELETE | `server.ts` memory_manage | **NO** | Delete has no audit trail (see M-4) |
| telemetry INSERT (emit_metric) | `tools/telemetry-tools.ts` | YES | Provenance required, validated at entry |
| telemetry INSERT (PG sink) | `shared/telemetry/collector.ts` | YES | Provenance flattened into columns |
| **COO Controller** | | | |
| user_input event | `COO/controller/loop.ts` | YES | System provenance |
| classifier_result event | `COO/controller/loop.ts` | YES | LLM invocation provenance |
| coo_response event | `COO/controller/loop.ts` | YES | Intelligence provenance |
| error event | `COO/controller/loop.ts` | YES | System provenance |
| memory_operation event | `COO/controller/loop.ts` | YES | Classifier provenance |
| human_request event | `COO/controller/loop.ts` | YES | Controller provenance |
| Turn telemetry emit | `COO/controller/loop.ts` | YES | Controller provenance, both success and failure paths |
| Thread file write | `COO/controller/thread.ts` | N/A | File system writes; provenance is on the events inside the thread |
| **Agent-Role-Builder** | | | |
| Board participant invoke | `services/board.ts` | YES | LLM provenance on success, system provenance on error |
| Telemetry emit per participant | `services/board.ts` | YES | Both success and failure paths |
| Overall tool telemetry emit | `index.ts` | YES | System provenance |
| Learning engine invoke | `services/board.ts` | PARTIAL | LLM invoke has provenance, but learning output written to disk without separate provenance |
| Run artifact writes (result.json etc.) | `index.ts` | N/A | File writes; provenance is in the result JSON structure |
| **LLM-Tool-Builder** | | | |
| Tool contract write | `index.ts` | **NO** | No provenance on the tool contract JSON or result. No telemetry emit at all. |

---

## Cross-Package Consistency Audit

### `tools/agent-role-builder/src/shared-imports.ts` vs canonical shared modules

| Element | Source | Re-export | Match? |
|---|---|---|---|
| `ProvenanceSchema` | `shared/provenance/types.ts` | `shared-imports.ts` | YES -- field-for-field match |
| `Provider` enum | `shared/provenance/types.ts` | `shared-imports.ts` | YES |
| `createSystemProvenance` | `shared/provenance/types.ts` | `shared-imports.ts` | YES |
| `createLLMProvenance` | `shared/provenance/types.ts` | `shared-imports.ts` | YES |
| `LEGACY_PROVENANCE` | `shared/provenance/types.ts` | `shared-imports.ts` | **MISSING** -- not re-exported |
| `InvocationParams` | `shared/llm-invoker/types.ts` (Zod) | `shared-imports.ts` (interface) | DIVERGED -- shared uses Zod schema, re-export uses plain TS interface. Fields match but no runtime validation on re-export. |
| `InvocationResult` | `shared/llm-invoker/types.ts` (Zod) | `shared-imports.ts` (interface) | DIVERGED -- same as above |
| `invoke()` | `shared/llm-invoker/invoker.ts` | `shared-imports.ts` | DIVERGED -- full copy with subtle differences (e.g., fallback error message is shorter in re-export) |
| `callCodex/Claude/Gemini` | `shared/llm-invoker/invoker.ts` | `shared-imports.ts` | DIVERGED -- same logic but diverged formatting |
| Telemetry emit | `shared/telemetry/collector.ts` | `shared-imports.ts` | **SEMANTICALLY DIFFERENT** -- canonical uses configurable sink + buffer flushing; re-export uses a dead buffer that never flushes |

### `components/memory-engine/src/provenance.ts` vs canonical shared module

| Element | Source | Re-export | Match? |
|---|---|---|---|
| `Provider` enum | `shared/provenance/types.ts` | `provenance.ts` | YES |
| `ProvenanceSchema` | `shared/provenance/types.ts` | `provenance.ts` | YES |
| `Provenance` type | `shared/provenance/types.ts` | `provenance.ts` | YES |
| `LEGACY_PROVENANCE` | `shared/provenance/types.ts` | `provenance.ts` | YES |
| `createSystemProvenance` | `shared/provenance/types.ts` | `provenance.ts` | **MISSING** |
| `createLLMProvenance` | `shared/provenance/types.ts` | `provenance.ts` | **MISSING** |

### `COO/controller/thread.ts` and `COO/controller/loop.ts`

These import directly from `../../shared/provenance/types.js` and `../../shared/llm-invoker/invoker.js` -- no re-export layer. This is the cleanest pattern and works correctly.

---

## Missing Pieces

1. **Compliance map integration** -- `shared/learning-engine/compliance-map.ts` schema exists but is never imported or used by any tool. The board service generates compliance evidence informally but does not produce a `ComplianceMap` object.

2. **Fix items map integration** -- `shared/learning-engine/fix-items-map.ts` schema exists but the board service uses ad-hoc `fixChecklist` arrays instead.

3. **Governance `update` and `transition` actions** -- Advertised in the schema and tool definitions but return "not yet implemented."

4. **LLM-tool-builder telemetry** -- No `emit()` call anywhere in `tools/llm-tool-builder/src/index.ts`. The agent-role-builder emits telemetry; the llm-tool-builder does not.

5. **LLM-tool-builder provenance** -- No provenance object created or attached to any result or artifact in llm-tool-builder.

6. **`tool_path` and `specialist_path` workflow handlers** -- Classified by the COO classifier but silently fall through to direct COO response in the controller loop.

7. **Review-prompt template usage** -- `shared/learning-engine/review-prompt-template.json` is a template, but neither the learning engine `extractRules()` function nor the board service loads or references it. The component-specific `review-prompt.json` files are also not loaded by any code -- they appear to be documentation/configuration files read by humans or future automation.

8. **Rule-book-guide.json usage** -- `shared/learning-engine/rule-book-guide.json` is referenced conceptually but not loaded or validated against by any code. The learning engine hardcodes its own prompt rather than deriving it from the guide.

9. **`memory_embeddings` provenance columns** -- Migration 008 adds `invocation_id` and `source_path` to `memory_embeddings`, but does NOT add `provider`, `model`, `reasoning`, or `was_fallback`. The INSERT statements in `capture.ts` and `decision-tools.ts` only write `invocation_id` and `source_path` to embeddings, which is consistent with the migration, but means embeddings have less provenance than memory_items and decisions.

---

## Architecture Notes

- The boxed hierarchy is respected: tools import from shared, not from each other. The llm-tool-builder imports agent-role-builder via dynamic `import()` for the governed role build path, which is the correct delegation pattern.
- The COO controller imports from shared directly (not through a re-export), which is the cleanest pattern. The memory-engine and agent-role-builder use local re-exports, which work but introduce drift risk (B-2).
- Zod schemas are consistently used for input validation at package boundaries. Internal data structures use TypeScript interfaces, which is a reasonable pattern.
- Error handling is generally graceful: the telemetry collector swallows failures, the learning engine returns degraded output on parse errors, the board service catches revision failures and falls back to the prior markdown. The memory engine MCP server wraps all tool calls in try/catch with `isError: true` responses.

---

*Reviewed: 2026-03-28*
*Reviewer: Claude Opus 4.6 (independent review, no prior involvement in implementation)*

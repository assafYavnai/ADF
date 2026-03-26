# Step 2: Intelligence — Wire Up LLM Calls

Status: **planned**
Last updated: 2026-03-27

---

## CEO Directives

- Use CLI (codex/claude) not API SDKs — leverages existing auth and token pools
- Codex is primary, Claude is fallback
- Classifier uses medium reasoning (cheap model, no need to overthink)
- COO uses strongest models with highest reasoning and full bypass permissions
- Classifier has no action permissions (read-only sandbox or no sandbox)

## LLM Configuration

| Role | Primary (Codex) | Flags | Fallback (Claude) | Flags |
|---|---|---|---|---|
| **Classifier** | `gpt-5.3-codex-spark` | `medium` reasoning, `--sandbox read-only` | `claude --model haiku` | `--effort medium` |
| **COO** | `gpt-5.4` | `xhigh` reasoning, `--dangerously-bypass-approvals-and-sandbox` | `claude --model opus` | `--effort max`, `--dangerously-skip-permissions` |

## Implementation Plan

### 1. Create `COO/src/llm.ts` — CLI-based LLM caller
- `classifierCall(prompt)` — spawns Codex spark, falls back to Claude haiku
- `cooCall(prompt)` — spawns Codex gpt-5.4, falls back to Claude opus
- Uses `node:child_process.execFile` for both CLIs
- Codex: `codex exec -m <model> -c model_reasoning_effort="<level>" -o <tmpfile> --ephemeral --skip-git-repo-check "<prompt>"`
- Claude: `claude --print --model <model> --effort <level> --prompt "<prompt>"`
- Configurable timeouts (classifier: 60s, COO: 120s)
- Shared `execPromise()` helper wrapping execFile
- Temp file for Codex output (`-o`), cleaned up after read

### 2. Wire `llm.ts` into `loop.ts`
- Import `classifierCall` and `cooCall` from llm.ts
- Create a default `ControllerConfig` that uses these functions
- Export a convenience `handleTurnWithDefaults(threadId, userMessage)` that wires everything together

### 3. Create `COO/src/cli.ts` — CLI entry point for testing
- Simple stdin/stdout REPL for end-to-end testing
- Creates a thread, loops: read user input → handleTurn → print response
- Demonstrates full flow: input → classify → context assembly → COO response → thread commit

### 4. Verify end-to-end
- Run `npx tsx COO/src/cli.ts`
- Send a test message, verify classifier routes correctly
- Send "save this decision: we use Codex as primary LLM" — verify memory_operation route
- Send "what did we decide?" — verify search route
- Verify thread JSON persisted in `threads/`

## Dependencies
- Codex CLI installed and authenticated (verified: v0.116.0)
- Claude CLI installed and authenticated (verified: v2.1.84)
- PostgreSQL running for memory engine (verified: port 5432)
- Ollama running for embeddings (verified: port 11434)

## Open Questions
- Should the COO CLI entry point also start the memory engine server, or assume it's running separately?
- Do we need a `--no-color` or similar flag for clean stdout parsing from Claude?
- Max buffer size for LLM responses — 10MB enough?

## Files to Create/Modify
| File | Action |
|---|---|
| `COO/src/llm.ts` | create — CLI-based LLM caller |
| `COO/src/loop.ts` | modify — wire in default LLM config |
| `COO/src/cli.ts` | create — REPL entry point for testing |

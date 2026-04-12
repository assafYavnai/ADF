# CLI Agent Bootstrap

You are operating inside the ADF (Adaptive Development Framework) project.

## Identity
ADF's user-facing identity is the **COO**. The user is the **CEO**.
The CEO provides vision, goals, and decisions. The COO translates that into execution.

For CEO-facing shaping or freeze work in `adf-v2/`, the explicit repo skill entrypoint is `$CTO`.
When the runtime supports skill invocation, use `$CTO` for CTO-role behavior instead of inventing an ad-hoc protocol.
Authoritative repo source: `C:/ADF/skills/cto/SKILL.md`.

## Key directories
- `COO/` — controller + reasoning layer (TypeScript)
- `components/memory-engine/` — Brain MCP server, semantic search, durable knowledge
- `threads/` — persisted thread state (JSON)
- `memory/` — daily residue (YYYY-MM-DD.md)
- `prompts/` — owned prompt templates
- `decisions/` — locked decisions
- `docs/v0/context/` — implementation context trail

## Architecture
- Read [docs/v0/architecture.md](../v0/architecture.md) for technical architecture
- Read [docs/PHASE1_MASTER_PLAN.md](../PHASE1_MASTER_PLAN.md) for Phase 1 operating alignment

## Mandatory Runtime Preflight

Before substantive work, run the ADF runtime preflight and use its output as the authoritative runtime contract.

- POSIX or real bash terminal: `./adf.sh --runtime-preflight --json`
- Windows non-bash control plane: `adf.cmd --runtime-preflight --json`

Treat these output fields as authority:

- `host_os`
- `workflow_shell`
- `execution_shell`
- `terminal_shell_hint`
- `control_plane.kind`
- `control_plane.entrypoint`
- `shell_contract.command_construction_mode`
- `shell_contract.bash_write_style`
- `shell_contract.path_style`
- `brain_mcp.availability_status`
- `brain_mcp.verification_status`
- `brain_mcp.verification_command`
- `commands.npm.command_name`
- `commands.npx.command_name`
- `recommended_commands.runtime_preflight`
- `recommended_commands.install`
- `recommended_commands.doctor`
- `recommended_commands.launch`
- `llm_tools.<name>.available`
- `llm_tools.<name>.version`
- `llm_tools.<name>.autonomous_invoke`

The `llm_tools` section reports which sibling LLM CLI tools are installed on this host and how to invoke them for autonomous worker execution. Before claiming a sibling CLI tool is unavailable, check this section. When a skill or user requests a specific LLM tool as a worker (e.g., "reviewers must be codex"), use the `autonomous_invoke` command from preflight to spawn it via Bash.

### Sibling-worker invocation examples (Windows host + bash workflow)

When spawning a sibling CLI tool as an autonomous worker on a Windows host with bash as the workflow shell, use the `autonomous_invoke` command from preflight output:

```bash
# Claude Code as autonomous implementor worker
bash -c 'claude --dangerously-skip-permissions "Implement the bounded slice described in docs/phase1/feature-slug/implement-plan-brief.md"'

# Codex CLI as autonomous reviewer worker
bash -c 'codex exec --full-auto --dangerously-auto-approve "Review the feature changes on branch implement-plan/phase1/feature-slug"'

# Gemini CLI as autonomous auditor worker (when available)
bash -c 'gemini "Audit the route changes in skills/review-cycle/"'
```

For multiline or quote-heavy prompts, write the prompt to a temporary file and invoke from file:

```bash
# Write the prompt to a temp file, then invoke the worker
cat > /tmp/worker-prompt.txt << 'PROMPT'
Implement the bounded product slice exactly as described.
Read the brief at docs/phase1/feature-slug/implement-plan-brief.md.
PROMPT
bash -c 'claude --dangerously-skip-permissions "$(cat /tmp/worker-prompt.txt)"'
```

Rules:

- always use the `autonomous_invoke` string from preflight `llm_tools`; do not construct invocation strings manually
- on Windows, wrap all worker invocations in `bash -c '...'` to stay inside the ADF workflow shell
- check `llm_tools.<name>.available` before attempting to spawn a worker
- prefer writing a temp `.sh` or `.txt` prompt file when the prompt is multiline or contains special characters

If runtime preflight fails:

- use `--install` for bounded dependency/build/bootstrap repair
- use `--doctor` when you need full bash + Brain MCP verification
- do not continue with ad-hoc workflow commands until the blocking issue is understood

Important distinction:

- runtime-preflight reports workflow-shell truth, control-plane entrypoint truth, and Brain route availability or blocked state
- runtime-preflight does not claim full Brain health
- `--doctor` is still the only supported route for full bash + Brain verification

## Shell Guidance
- ADF's canonical shell is `bash` on every host OS.
- On Windows, the host OS is still Windows, but the ADF shell remains `bash`. Agents must stay aware of Windows path and process behavior without treating PowerShell as an equivalent workflow shell.
- Approved Windows bash runtimes for ADF launch are `MSYS2` and `Git Bash`. `SHELL` is only a candidate hint; wrappers must reject non-bash executables and unapproved bash paths.
- Prefer the repo launcher entrypoints over ad-hoc shell assumptions:
  - POSIX: `./adf.sh`
  - Windows: `adf.cmd`
- `adf.cmd` is a trampoline into `bash adf.sh ...` only. If bash is missing or broken, it must hard-stop.
- Use PowerShell only for Windows-native leaf tasks that are outside the ADF workflow shell contract.
- On Windows bash runtimes, `adf.sh` requires `npm.cmd` / `npx.cmd`. Generic `npm` / `npx` fallback is non-compliant. Prefer local `.cmd` shims under `node_modules/.bin/` when the native command resolution requires them.
- For multiline execution, write a temporary bash script and run it through `bash`.
- On Windows, if the control plane is not a real bash terminal or the command is quote-heavy, regex-heavy, or multiline, write a temporary `.sh` file and run it through bash instead of nesting fragile `bash -lc "..."` quoting.
- After editing JavaScript helpers or workflow scripts, run `node --check` and a small smoke test.

## Context Loading

The preferred Brain path is the `project-brain` MCP tool surface when the runtime exposes it.
Do NOT invent a fake MCP path. If `project-brain` is missing in the current runtime, treat that as a runtime defect, persist required authority in repo-backed truth, flag the missing MCP surface to the CEO, and use runtime preflight first, `--install` for bounded repair when needed, and `./adf.sh --doctor` or `adf.cmd --doctor` only when full bash + Brain verification is required.
Doctor is fail-closed: it may repair install/build preconditions, but it must end with a working bash runtime, a working Brain MCP connection, and a Brain audit write or it blocks with a durable local incident report.
Do NOT import or require memory-engine TypeScript code just to work around a missing MCP surface.

After reading this file, call the MCP tool `mcp__project-brain__get_context_summary` with:
```json
{ "scope": "assafyavnai/adf", "trust_level_min": "reviewed" }
```

For deeper context on a specific topic, call `mcp__project-brain__search_memory` with:
```json
{ "query": "<your topic>", "scope": "assafyavnai/adf", "semantic_weight": 0 }
```
Use `semantic_weight: 0` (keyword-only) unless Ollama is running for embeddings.

Do not ask the CEO to restate context that the Brain already holds.

## Brain Fallback Route

- Preferred path is always MCP calls to `project-brain` in the assistant/runtime layer.
- When the current runtime does not expose a working `project-brain` MCP surface, use the repo-backed fallback route through `brain-ops` instead of skipping Brain work.
- For shell automation, smoke checks, or MCP-unavailable fallback capture/read/search/trust proof, use:
  - `node skills/brain-ops/scripts/brain-ops-helper.mjs`
  - `node skills/brain-ops/scripts/brain-ops-helper.mjs connect-smoke --project-root C:/ADF`
  - `node skills/brain-ops/scripts/brain-ops-helper.mjs search --project-root C:/ADF --scope assafyavnai/adf --query "..."`
  - `node skills/brain-ops/scripts/brain-ops-helper.mjs capture --project-root C:/ADF --scope assafyavnai/adf --content-type finding --title "..." --summary "..."`
  - `node skills/brain-ops/scripts/brain-ops-helper.mjs trust --project-root C:/ADF --scope assafyavnai/adf --memory-id <id> --action promote|cleanup`
- Do not import or call memory-engine internals directly. Route all fallback writes through this helper.

## Brain Capture Discipline

The Brain is the company's durable memory. Capture knowledge as you work, without being asked.

### When to capture

Preferred capture route is MCP tools (prefix `mcp__project-brain__`) when the current runtime exposes them.
If the current runtime does not expose a working `project-brain` MCP surface, use the repo-backed `brain-ops` fallback route instead of skipping capture.
Do NOT import code.

1. **Decision made**
   - preferred: `mcp__project-brain__log_decision`
   - fallback when MCP is unavailable: `brain-ops-helper.mjs capture` with a decision-shaped summary, then promote trust if appropriate
2. **Convention or rule established**
   - preferred: `mcp__project-brain__capture_memory` with `content_type=convention`
   - fallback when MCP is unavailable: `brain-ops-helper.mjs capture --content-type convention`
3. **Lesson learned**
   - preferred: `mcp__project-brain__capture_memory` with `content_type=lesson`
   - fallback when MCP is unavailable: `brain-ops-helper.mjs capture --content-type lesson`
4. **Discussion with substance**
   - preferred: `mcp__project-brain__discussion_append`
   - fallback when MCP write surfaces are blocked: persist the summary in repo-backed truth and flag the MCP failure
5. **Requirements shaped or frozen**
   - preferred: `mcp__project-brain__requirements_manage` with `action=create`
   - fallback when MCP is unavailable: persist the requirement truth in repo-backed governed artifacts, then capture a requirement summary through `brain-ops` when possible

**Known issue:** The project-brain MCP wrapper has a provenance bug that blocks some write operations (discussion_append, discussion_import_from_text). If a write fails with "legacy sentinel provenance" error, log what you would have captured in a `docs/v0/context/` markdown file as a fallback, and flag the failure to the CEO.

### When NOT to capture

- Ephemeral debugging (fix a typo, resolve a merge conflict)
- Information already in the Brain (check first with `mcp__project-brain__search_memory`)
- Raw conversation transcript
- Implementation details derivable from code + git history

### Scope and trust

- Project scope: `assafyavnai/adf`
- Phase-specific: `assafyavnai/adf/phase1`
- Trust levels: `working` (draft), `reviewed` (CEO approved), `locked` (frozen governance)

### Session end discipline

Before a substantial session ends, self-check: did this session produce any decisions, conventions, or lessons? If yes, capture them.

## Context Hygiene

- Before acting on Brain context older than 7 days or trust_level=working, verify against current code/files/git.
- If Brain context conflicts with what you observe now, flag to the CEO and update or archive the stale item.
- After loading Brain context, scan for obvious conflicts (convention contradicts code, decision references removed file).

## When in doubt
- Read `docs/PHASE1_MASTER_PLAN.md` to check current mission alignment
- Use `search_memory` for Phase 1 design questions before asking the CEO
- Ask the CEO (user) for direction

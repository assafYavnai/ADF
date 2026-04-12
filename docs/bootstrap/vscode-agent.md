# VS Code Agent Bootstrap

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
- `prompts/` — owned prompt templates
- `docs/v0/context/` — implementation context trail

## Scope
As a VS Code agent you are typically scoped to file editing and code tasks.
For architectural decisions or memory engine operations, defer to the CLI COO session.

## Architecture
- Read [docs/v0/architecture.md](../v0/architecture.md) for technical architecture
- Read [docs/PHASE1_MASTER_PLAN.md](../PHASE1_MASTER_PLAN.md) for Phase 1 operating alignment

## Mandatory Runtime Preflight

Before substantive work, run the ADF runtime preflight and use its output as the authoritative runtime contract.

- If you are in a real bash terminal: `./adf.sh --runtime-preflight --json`
- If your execution bridge is Windows-native or not clearly bash-backed: `adf.cmd --runtime-preflight --json`

Use the runtime-preflight output as authority for:

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
- `recommended_commands.install`
- `recommended_commands.doctor`
- `recommended_commands.launch`

Do not assume the visible VS Code terminal profile is the same thing as the agent execution shell.
If runtime preflight says Windows host plus bash workflow shell, stay Windows-aware but issue ADF workflow commands as bash commands.
If quoting is complex, regex-heavy, or multiline, write a temporary `.sh` file and run it through bash instead of nesting fragile `bash -lc "..."` command strings through a non-bash control plane.
Treat `brain_mcp.availability_status` as startup truth about whether the Brain route is materially available, but use `brain_mcp.verification_command` when you need full verification instead of assuming runtime-preflight proved Brain health.

## Shell Guidance

- ADF's canonical workflow shell is `bash` on every host OS.
- On Windows, the host OS is still Windows, but the ADF workflow shell remains `bash`.
- `adf.cmd` is only a trampoline into `bash adf.sh ...`.
- Use PowerShell or cmd only for Windows-native leaf tasks outside the ADF workflow shell contract.

## When in doubt
- Ask the CEO (user) for direction

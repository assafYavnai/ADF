# Headless CLI Agents Guide

How to execute headless (non-interactive) CLI commands for AI agents in ADF.
Cherry-picked from ProjectBrain operational evidence (2026-03-12 to 2026-03-18).

---

## Codex CLI

Subcommand `exec` for non-interactive execution.

### Basic Usage
```bash
codex exec -m gpt-5.4 --dangerously-bypass-approvals-and-sandbox -o output.txt "short prompt here"
```

### Key Options
- `exec` — run non-interactively
- `-m, --model <MODEL>` — model to use
- `-o, --output-last-message <FILE>` — capture last assistant message to file (cleanest for automation)
- `-C, --cd <DIR>` — working root directory
- `--sandbox <MODE>` — read-only, workspace-write, danger-full-access
- `--full-auto` — automatic tool execution
- `--dangerously-bypass-approvals-and-sandbox` — skip all confirmations (trusted envs only)
- `--ephemeral` — no session persistence
- `--skip-git-repo-check` — run outside git repos
- `--json` — structured JSON output
- `-c model_reasoning_effort="<level>"` — set reasoning: medium, high, xhigh

### Prompt Size Limitation (CRITICAL — verified 2026-03-18)
- Windows command-line length capped (~8191 chars cmd, ~32767 CreateProcess)
- **Piping via stdin does NOT reliably deliver full prompt** — Codex may receive only partial content
- **Working pattern for long prompts:** write to temp file, load into shell variable, pass as argument:
```bash
PROMPT=$(<path/to/prompt.txt)
codex exec -m gpt-5.4 --dangerously-bypass-approvals-and-sandbox -o output.txt "$PROMPT"
```
- **Keep prompts under 4KB.** For larger context, tell the agent to read specific files from disk rather than embedding content in the prompt.

### Session Resume
```bash
codex exec resume <session-id> -m gpt-5.4 --dangerously-bypass-approvals-and-sandbox -o output.txt "updated prompt"
```

### Nested Workers
- Use workspace-writable `CODEX_HOME` and `--ephemeral` so controller runs don't depend on global `~/.codex/`

---

## Claude CLI

Use `-p` / `--print` for headless mode.

### Basic Usage
```bash
claude -p --model opus "short prompt here"
```

### Key Options
- `-p, --print` — print response and exit (headless mode)
- `--model <model>` — sonnet, opus, haiku
- `--effort <level>` — low, medium, high, max
- `--output-format <format>` — text (default), json, stream-json
- `--dangerously-skip-permissions` — bypass all permission checks
- `--no-session-persistence` — don't save session state
- `--session-id <id>` — explicit session for persistence
- `--resume <id>` — resume a prior session

### Automation Note
- In some harnesses, stdout capture appears empty despite exit 0
- Prefer file redirection: `claude -p --model opus "prompt" 1> out.txt 2> err.txt`
- Stdin piping works reliably for Claude

### Session Resume
```bash
claude -p --resume <session-id> --model opus "updated prompt"
```

---

## Gemini CLI

Use `-p` / `--prompt` for headless mode.

### Basic Usage
```bash
gemini --model gemini-3.1-pro-preview --approval-mode yolo --output-format json -p "prompt"
```

### Key Options
- `-p, --prompt <string>` — headless mode
- `-m, --model <string>` — model name
- `--approval-mode <string>` — default, auto_edit, yolo, plan
- `-o, --output-format <string>` — text, json, stream-json
- `--resume <session-id>` — resume session

### Model Availability (verified 2026-03-13)
- `gemini-3.1-pro-preview` — verified working
- `gemini-3-flash-preview` — verified lower-tier fallback
- `gemini-3.1-pro` — NOT verified (ModelNotFoundError observed)
- Gemini emits approval/status noise to stderr in yolo mode even on success

### Transient Errors
- Transient `499 CANCELLED` and `429 RESOURCE_EXHAUSTED` may occur but CLI retries internally
- For orchestration: treat non-zero `429` exits as retryable up to 2 times

---

## Model Selection Matrix

### Coding
| Tier | Claude | Codex | Gemini |
|---|---|---|---|
| Fast/cheap | haiku | gpt-5.1-codex-mini | gemini-3-flash |
| Standard | sonnet | gpt-5.3-codex | gemini-3.1-pro |
| Strongest | opus | gpt-5.4 | gemini-3.1-pro |

### Review / QA
| Tier | Claude | Codex | Gemini |
|---|---|---|---|
| Quick | haiku | gpt-5.1-codex-mini | gemini-3-flash-preview |
| Standard | sonnet | gpt-5.3-codex | gemini-3.1-pro |
| Deep | opus | gpt-5.4 | gemini-3.1-pro-preview |

### Planning
| Tier | Claude | Codex |
|---|---|---|
| Standard | sonnet | gpt-5.2 |
| Complex | opus | gpt-5.1-codex-max |

### Postmortem / Summarization
| Tier | Claude | Codex | Gemini |
|---|---|---|---|
| Fast | haiku | gpt-5.1-codex-mini | gemini-3-flash |
| Standard | sonnet | gpt-5.2 | — |

---

## Persistent Review Sessions

For multi-round review cycles, persist session IDs instead of cold-starting every round.

1. Create one session per reviewer per artifact
2. Save session IDs under the run directory
3. Run round 1 cold
4. Resume later rounds by explicit session ID
5. Send only: artifact change, accepted/rejected findings, updated prompt

Measured benefit (Gemini): cold run ~50s, resumed follow-up ~16s (~70% faster warm).

---

## Bounded Worker Rules

- Bounded workers should NOT perform full ADF bootstrap
- Workers read ONLY: AGENTS.md, their worker brief, and artifacts named in the brief
- Workers must NOT load broader docs, task state, or indexes unless the brief requires them
- This minimizes context pollution and keeps workers focused

---

## Process Lifetime

- Default to one-shot execution
- Do not leave helper/background processes running after completion
- Avoid duplicate launches for the same subject
- Protect resource-heavy scripts against concurrent same-subject runs

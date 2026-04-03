#!/usr/bin/env bash

set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
PROOF_ROOT="$SCRIPT_DIR/proof-runs"
FIELD_SEP=$'\x1f'
FAKE_SHELL='C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe'

RUN_DOCTOR=true
RUN_NEGATIVE=true
FAIL_FAST=true
LABEL=""
CUSTOM_OUTPUT_DIR=""
STEP_TIMEOUT_SECONDS=600
ANY_FAIL=0
OVERALL_EXIT_CODE=0

declare -a STEP_RECORDS=()

usage() {
  cat <<'EOF'
run-proof-sequence.sh - capture bash enforcement proof artifacts

Run this script from a real VS Code bash terminal. It writes a timestamped proof
folder with one log per step plus a markdown summary. The script exits non-zero
if any required step fails, but it still writes the proof bundle.

Usage:
  bash docs/phase1/bash-execution-enforcement/cycle-01/run-proof-sequence.sh [options]

Options:
  --skip-doctor         Skip the doctor proof step.
  --skip-negative       Skip the negative forced-SHELL checks.
  --continue-on-error   Keep collecting proof after a failing step.
  --label <name>        Add a short suffix to the proof-run folder name.
  --output-dir <path>   Write the proof bundle to an explicit directory.
  --step-timeout <sec>  Watchdog timeout per step. Default: 600.
  --help                Show this help.
EOF
}

is_windows_host() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

slugify() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//'
}

now_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

timestamp_slug() {
  date -u +"%Y%m%dT%H%M%SZ"
}

print_progress() {
  printf '==> %s\n' "$*"
}

windows_path() {
  local target="$1"

  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$target"
    return 0
  fi

  printf '%s' "$target"
}

terminate_pid_tree() {
  local pid="$1"

  kill -TERM "$pid" 2>/dev/null || true
  kill -TERM -- "-$pid" 2>/dev/null || true

  if is_windows_host && command -v taskkill.exe >/dev/null 2>&1; then
    taskkill.exe //PID "$pid" //T //F >/dev/null 2>&1 || true
  fi

  sleep 1

  kill -KILL "$pid" 2>/dev/null || true
  kill -KILL -- "-$pid" 2>/dev/null || true
}

record_step() {
  local key="$1"
  local status="$2"
  local exit_code="$3"
  local log_file="$4"
  local description="$5"
  STEP_RECORDS+=("${key}${FIELD_SEP}${status}${FIELD_SEP}${exit_code}${FIELD_SEP}${log_file}${FIELD_SEP}${description}")
}

finalize_and_exit() {
  local exit_code="${1:-0}"
  write_summary
  echo
  echo "Proof bundle written to: $RUN_DIR"
  echo "Summary: $RUN_DIR/proof-summary.md"
  exit "$exit_code"
}

run_step() {
  local key="$1"
  local description="$2"
  local function_name="$3"
  local log_file="$RUN_DIR/${key}.log"
  local started_at
  local completed_at
  local exit_code=0
  local status="PASS"
  local cmd_pid=""
  local watchdog_pid=""

  print_progress "[$key] $description"
  started_at="$(now_iso)"
  {
    echo "# Step: $key"
    echo "# Description: $description"
    echo "# StartedAt: $started_at"
    echo "# RepoRoot: $REPO_ROOT"
    echo "# TimeoutSeconds: $STEP_TIMEOUT_SECONDS"
    echo
  } | tee "$log_file" >/dev/null

  (
    cd "$REPO_ROOT"
    "$function_name"
  ) > >(tee -a "$log_file") 2> >(tee -a "$log_file" >&2) &
  cmd_pid=$!

  if [[ $STEP_TIMEOUT_SECONDS -gt 0 ]]; then
    (
      sleep "$STEP_TIMEOUT_SECONDS"
      if kill -0 "$cmd_pid" 2>/dev/null; then
        {
          echo
          echo "# Watchdog: step exceeded ${STEP_TIMEOUT_SECONDS}s and will be terminated."
        } >>"$log_file"
        echo "WATCHDOG: [$key] exceeded ${STEP_TIMEOUT_SECONDS}s and will be terminated." | tee -a "$log_file" >&2
        terminate_pid_tree "$cmd_pid"
      fi
    ) &
    watchdog_pid=$!
  fi

  if ! wait "$cmd_pid"; then
    exit_code=$?
  fi

  if [[ -n "$watchdog_pid" ]]; then
    kill "$watchdog_pid" 2>/dev/null || true
    wait "$watchdog_pid" 2>/dev/null || true
  fi

  completed_at="$(now_iso)"

  {
    echo
    echo "# CompletedAt: $completed_at"
    echo "# ExitCode: $exit_code"
  } | tee -a "$log_file" >/dev/null

  if [[ $exit_code -ne 0 ]]; then
    status="FAIL"
    ANY_FAIL=1
    if [[ $OVERALL_EXIT_CODE -eq 0 ]]; then
      OVERALL_EXIT_CODE=$exit_code
    fi
  fi

  record_step "$key" "$status" "$exit_code" "$(basename "$log_file")" "$description"

  if [[ "$status" == "PASS" ]]; then
    print_progress "[$key] PASS -> $(basename "$log_file")"
  else
    print_progress "[$key] FAIL (exit $exit_code) -> $(basename "$log_file")"
    if $FAIL_FAST; then
      print_progress "Stopping after failing step $key because fail-fast mode is enabled."
      finalize_and_exit "$OVERALL_EXIT_CODE"
    fi
  fi
}

record_skip() {
  local key="$1"
  local description="$2"
  local log_file="$RUN_DIR/${key}.log"

  {
    echo "# Step: $key"
    echo "# Description: $description"
    echo "# Status: SKIP"
    echo "# Reason: Not applicable in this host mode or explicitly skipped."
  } >"$log_file"

  record_step "$key" "SKIP" "0" "$(basename "$log_file")" "$description"
}

write_summary() {
  local summary_file="$RUN_DIR/proof-summary.md"
  local branch=""
  local head_sha=""
  local record
  local key
  local status
  local exit_code
  local log_file
  local description

  branch="$(git -c safe.directory="$REPO_ROOT" branch --show-current 2>/dev/null || true)"
  head_sha="$(git -c safe.directory="$REPO_ROOT" rev-parse HEAD 2>/dev/null || true)"

  {
    echo "# Bash Enforcement Proof Run"
    echo
    echo "- Started at: $RUN_STARTED_AT"
    echo "- Completed at: $(now_iso)"
    echo "- Repo root: \`$REPO_ROOT\`"
    echo "- Host uname: \`$(uname -s)\`"
    echo "- Branch: \`${branch:-unknown}\`"
    echo "- HEAD: \`${head_sha:-unknown}\`"
    echo "- Script: \`$SCRIPT_DIR/run-proof-sequence.sh\`"
    echo "- Overall result: \`$([[ $ANY_FAIL -eq 0 ]] && echo PASS || echo FAIL)\`"
    echo "- Fail fast: \`$FAIL_FAST\`"
    echo "- Step timeout seconds: \`$STEP_TIMEOUT_SECONDS\`"
    echo
    echo "## Steps"
    echo
    echo "| Step | Status | Exit | Log | Description |"
    echo "| --- | --- | ---: | --- | --- |"

    for record in "${STEP_RECORDS[@]}"; do
      IFS="$FIELD_SEP" read -r key status exit_code log_file description <<<"$record"
      echo "| \`$key\` | \`$status\` | \`$exit_code\` | [\`$log_file\`](./$log_file) | $description |"
    done

    echo
    echo "## Notes"
    echo
    echo "- Run this proof bundle from a real VS Code bash terminal when you need the supported positive route."
    echo "- If doctor fails, inspect the generated incident report path in the doctor log."
    echo "- This runner streams step output live to the terminal and log files."
    echo "- By default the runner is fail-fast. Use \`--continue-on-error\` if you need a full proof sweep after a failure."
  } >"$summary_file"
}

step_shell_identity() {
  printf 'process_comm=%s\n' "$(ps -p $$ -o comm= 2>/dev/null | tr -d ' ' || true)"
  printf 'shell_argv0=%s\n' "$0"
  printf 'BASH=%s\n' "${BASH:-}"
  printf 'BASH_VERSION=%s\n' "${BASH_VERSION:-}"
  printf 'SHELL=%s\n' "${SHELL:-}"
  uname -s
  which bash
  bash --version
  pwd
  git -c safe.directory="$REPO_ROOT" status --short
}

step_windows_package_managers() {
  command -v npm.cmd
  command -v npx.cmd
}

step_adf_help() {
  ./adf.sh --help
}

step_cmd_wrapper_help() {
  local adf_cmd_win
  adf_cmd_win="$(windows_path "$REPO_ROOT/adf.cmd")"
  powershell.exe -ExecutionPolicy Bypass -Command "& '$adf_cmd_win' --help"
}

step_negative_cmd_wrapper() {
  local adf_cmd_win
  adf_cmd_win="$(windows_path "$REPO_ROOT/adf.cmd")"
  env SHELL="$FAKE_SHELL" powershell.exe -ExecutionPolicy Bypass -Command "& '$adf_cmd_win' --help"
}

step_negative_ps_wrapper() {
  env SHELL="$FAKE_SHELL" powershell.exe -ExecutionPolicy Bypass -File ./tools/adf-launcher.ps1 --help
}

step_negative_node_wrapper() {
  env SHELL="$FAKE_SHELL" node ./tools/adf-launcher.mjs --help
}

step_node_check() {
  node --check ./tools/adf-launcher.mjs
}

step_doctor() {
  ./adf.sh --doctor
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-doctor)
      RUN_DOCTOR=false
      shift
      ;;
    --skip-negative)
      RUN_NEGATIVE=false
      shift
      ;;
    --continue-on-error)
      FAIL_FAST=false
      shift
      ;;
    --label)
      LABEL="${2:?--label requires a value}"
      shift 2
      ;;
    --output-dir)
      CUSTOM_OUTPUT_DIR="${2:?--output-dir requires a value}"
      shift 2
      ;;
    --step-timeout)
      STEP_TIMEOUT_SECONDS="${2:?--step-timeout requires a value}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown flag: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

RUN_STARTED_AT="$(now_iso)"

if [[ -n "$CUSTOM_OUTPUT_DIR" ]]; then
  RUN_DIR="$CUSTOM_OUTPUT_DIR"
else
  RUN_DIR="$PROOF_ROOT/$(timestamp_slug)"
  if [[ -n "$LABEL" ]]; then
    RUN_DIR="${RUN_DIR}-$(slugify "$LABEL")"
  fi
fi

mkdir -p "$RUN_DIR"

run_step "01-shell-identity" "Prove the current terminal is a real bash runtime." step_shell_identity

if is_windows_host; then
  run_step "02-windows-package-managers" "Prove Windows-safe package-manager shims are available." step_windows_package_managers
else
  record_skip "02-windows-package-managers" "Windows-only package-manager shim proof."
fi

run_step "03-adf-help" "Run the authoritative bash launcher help route." step_adf_help

if is_windows_host; then
  run_step "04-cmd-wrapper-help" "Run the Windows trampoline help route." step_cmd_wrapper_help
else
  record_skip "04-cmd-wrapper-help" "Windows-only cmd trampoline proof."
fi

if $RUN_NEGATIVE; then
  if is_windows_host; then
    run_step "05-negative-cmd-shell" "Force SHELL to PowerShell and prove adf.cmd rejects it as authority." step_negative_cmd_wrapper
    run_step "06-negative-ps-shell" "Force SHELL to PowerShell and prove the PowerShell trampoline still selects approved bash only." step_negative_ps_wrapper
    run_step "07-negative-node-shell" "Force SHELL to PowerShell and prove the Node trampoline still selects approved bash only." step_negative_node_wrapper
  else
    record_skip "05-negative-cmd-shell" "Windows-only negative shell-authority proof."
    record_skip "06-negative-ps-shell" "Windows-only negative shell-authority proof."
    record_skip "07-negative-node-shell" "Windows-only negative shell-authority proof."
  fi
else
  record_skip "05-negative-cmd-shell" "Negative shell-authority proof was skipped."
  record_skip "06-negative-ps-shell" "Negative shell-authority proof was skipped."
  record_skip "07-negative-node-shell" "Negative shell-authority proof was skipped."
fi

run_step "08-node-check" "Run syntax validation for the Node trampoline." step_node_check

if $RUN_DOCTOR; then
  run_step "09-doctor" "Run the fail-closed doctor route and capture Brain audit or incident output." step_doctor
else
  record_skip "09-doctor" "Doctor proof was skipped."
fi

finalize_and_exit "$OVERALL_EXIT_CODE"

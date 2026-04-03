#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FEATURE_ROOT="$SCRIPT_DIR"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUTPUT_BASE="$FEATURE_ROOT/proof-runs"
RUN_DOCTOR=false
LABEL=""

usage() {
  cat <<'EOF'
Usage:
  bash docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh [--with-doctor] [--label <name>]

What it does:
  - runs runtime-preflight on the authoritative bash route
  - runs the Windows trampoline preflight route when available
  - runs the explicit install/bootstrap route
  - reruns runtime-preflight after install
  - captures strengthened JSON proof for control-plane and Brain-route fields
  - records logs and a proof summary under docs/phase1/adf-runtime-preflight-and-install-split/proof-runs/
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --with-doctor)
      RUN_DOCTOR=true
      shift
      ;;
    --label)
      LABEL="${2:?--label requires a value}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

timestamp="$(date -u +"%Y%m%dT%H%M%SZ")"
run_name="$timestamp"
if [[ -n "$LABEL" ]]; then
  run_name="${run_name}-${LABEL}"
fi

run_dir="$OUTPUT_BASE/$run_name"
mkdir -p "$run_dir"

summary_path="$run_dir/proof-summary.md"
step_results=()

record_step() {
  local step_name="$1"
  local status="$2"
  local log_name="$3"
  local description="$4"
  step_results+=("| \`$step_name\` | \`$status\` | [\`$log_name\`](./$log_name) | $description |")
}

run_step() {
  local step_name="$1"
  local description="$2"
  local log_name="$3"
  shift 3

  echo "==> [$step_name] $description"
  if "$@" >"$run_dir/$log_name" 2>&1; then
    echo "==> [$step_name] PASS -> $log_name"
    record_step "$step_name" "PASS" "$log_name" "$description"
    return 0
  fi

  echo "==> [$step_name] FAIL -> $log_name"
  record_step "$step_name" "FAIL" "$log_name" "$description"
  write_summary
  return 1
}

write_summary() {
  {
    echo "# Runtime Preflight Proof Summary"
    echo
    echo "- Feature: \`adf-runtime-preflight-and-install-split\`"
    echo "- Run directory: \`$run_dir\`"
    echo "- Repository root: \`$REPO_ROOT\`"
    echo
    echo "| Step | Status | Log | Description |"
    echo "| --- | --- | --- | --- |"
    printf '%s\n' "${step_results[@]}"
    echo
    echo "Useful commands:"
    echo "- \`cat $summary_path\`"
    echo "- \`ls $run_dir\`"
  } >"$summary_path"
}

step_runtime_preflight() {
  cd "$REPO_ROOT"
  ./adf.sh --runtime-preflight --json
}

step_cmd_runtime_preflight() {
  cd "$REPO_ROOT"
  local adf_cmd_win
  adf_cmd_win="$(pwd -W 2>/dev/null)/adf.cmd"
  cat >"$run_dir/_cmd-runtime-preflight.cmd" <<EOF
@echo off
call "$adf_cmd_win" --runtime-preflight --json
EOF
  cmd.exe /c "$run_dir/_cmd-runtime-preflight.cmd"
}

step_install() {
  cd "$REPO_ROOT"
  ./adf.sh --install
}

step_help() {
  cd "$REPO_ROOT"
  ./adf.sh --help
}

step_doctor() {
  cd "$REPO_ROOT"
  ./adf.sh --doctor
}

run_step "01-runtime-preflight" "Run runtime-preflight on the authoritative bash route." "01-runtime-preflight.log" step_runtime_preflight

if [[ "$(uname -s)" == MINGW* || "$(uname -s)" == MSYS* || "$(uname -s)" == CYGWIN* ]]; then
  run_step "02-cmd-runtime-preflight" "Run runtime-preflight through the Windows trampoline route." "02-cmd-runtime-preflight.log" step_cmd_runtime_preflight
else
  record_step "02-cmd-runtime-preflight" "SKIP" "02-cmd-runtime-preflight.log" "Windows trampoline route not applicable on this host."
fi

run_step "03-install" "Run the explicit install/bootstrap route." "03-install.log" step_install
run_step "04-runtime-preflight-post-install" "Run runtime-preflight again after install/bootstrap." "04-runtime-preflight-post-install.log" step_runtime_preflight
run_step "05-help" "Run launcher help after the split routes are in place." "05-help.log" step_help

if $RUN_DOCTOR; then
  run_step "06-doctor" "Run doctor to prove full repair plus Brain verification still works." "06-doctor.log" step_doctor
fi

write_summary

echo ""
echo "Proof bundle written to: $run_dir"
echo "Summary: $summary_path"

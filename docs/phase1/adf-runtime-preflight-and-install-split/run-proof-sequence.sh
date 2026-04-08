#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FEATURE_ROOT="$SCRIPT_DIR"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUTPUT_BASE="$FEATURE_ROOT/proof-runs"
RUN_DOCTOR=false
LABEL=""
COO_CLI_ARTIFACT="$REPO_ROOT/COO/dist/COO/controller/cli.js"
COO_MEMORY_ENGINE_CLIENT_ARTIFACT="$REPO_ROOT/COO/dist/COO/controller/memory-engine-client.js"
MEMORY_ENGINE_ARTIFACT="$REPO_ROOT/components/memory-engine/dist/server.js"

usage() {
  cat <<'EOF'
Usage:
  bash docs/phase1/adf-runtime-preflight-and-install-split/run-proof-sequence.sh [--with-doctor] [--label <name>]

What it does:
  - runs runtime-preflight on the authoritative bash route
  - runs the Windows trampoline preflight route when available
  - deliberately makes existing launcher artifacts stale before install proof
  - reruns runtime-preflight after install
  - deliberately makes artifacts stale again before normal launch preflight proof
  - captures proof-partition launcher KPI evidence for the exercised routes
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
empty_parser_updates_path="$run_dir/_empty-parser-updates.json"

export ADF_TELEMETRY_PARTITION="proof"
export ADF_TELEMETRY_PROOF_RUN_ID="$run_name"

printf '{}\n' >"$empty_parser_updates_path"

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
    echo "- Telemetry partition: \`$ADF_TELEMETRY_PARTITION\`"
    echo "- Proof run id: \`$ADF_TELEMETRY_PROOF_RUN_ID\`"
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

to_windows_path() {
  local target_path="$1"

  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$target_path"
    return 0
  fi

  local target_dir
  local target_name
  target_dir="$(cd "$(dirname "$target_path")" && pwd -W 2>/dev/null || true)"
  target_name="$(basename "$target_path")"
  [[ -n "$target_dir" ]] || return 1
  printf '%s\\%s' "$target_dir" "$target_name"
}

validate_runtime_preflight_log() {
  local log_path="$1"
  local expected_control_plane_kind="$2"
  local expected_entrypoint="$3"

  node - "$log_path" "$expected_control_plane_kind" "$expected_entrypoint" <<'NODE'
const fs = require("node:fs");

const logPath = process.argv[2];
const expectedControlPlaneKind = process.argv[3];
const expectedEntrypoint = process.argv[4];
const raw = fs.readFileSync(logPath, "utf8").trim();

if (!raw) {
  throw new Error(`Runtime-preflight log ${logPath} is empty.`);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (error) {
  throw new Error(`Runtime-preflight log ${logPath} is not parseable JSON: ${error.message}`);
}

if (parsed?.control_plane?.kind !== expectedControlPlaneKind) {
  throw new Error(`Expected control_plane.kind=${expectedControlPlaneKind} in ${logPath}, got ${parsed?.control_plane?.kind ?? "missing"}.`);
}

if (parsed?.control_plane?.entrypoint !== expectedEntrypoint) {
  throw new Error(`Expected control_plane.entrypoint=${expectedEntrypoint} in ${logPath}, got ${parsed?.control_plane?.entrypoint ?? "missing"}.`);
}

if (typeof parsed?.execution_shell !== "string" || parsed.execution_shell.length === 0) {
  throw new Error(`Runtime-preflight log ${logPath} is missing execution_shell.`);
}

if (typeof parsed?.brain_mcp?.availability_status !== "string" || parsed.brain_mcp.availability_status.length === 0) {
  throw new Error(`Runtime-preflight log ${logPath} is missing brain_mcp.availability_status.`);
}
NODE
}

require_log_contains() {
  local log_path="$1"
  local pattern="$2"
  local message="$3"

  if ! grep -Fq -- "$pattern" "$log_path"; then
    echo "$message" >&2
    return 1
  fi
}

require_log_not_contains() {
  local log_path="$1"
  local pattern="$2"
  local message="$3"

  if grep -Fq -- "$pattern" "$log_path"; then
    echo "$message" >&2
    return 1
  fi
}

ensure_launcher_artifacts_exist() {
  [[ -f "$COO_CLI_ARTIFACT" ]] || { echo "Missing launcher artifact: $COO_CLI_ARTIFACT" >&2; return 1; }
  [[ -f "$COO_MEMORY_ENGINE_CLIENT_ARTIFACT" ]] || { echo "Missing launcher artifact: $COO_MEMORY_ENGINE_CLIENT_ARTIFACT" >&2; return 1; }
  [[ -f "$MEMORY_ENGINE_ARTIFACT" ]] || { echo "Missing launcher artifact: $MEMORY_ENGINE_ARTIFACT" >&2; return 1; }
}

mark_launcher_artifacts_stale() {
  ensure_launcher_artifacts_exist
  touch -c -t 200001010000 "$COO_CLI_ARTIFACT" "$COO_MEMORY_ENGINE_CLIENT_ARTIFACT" "$MEMORY_ENGINE_ARTIFACT"
  echo "Marked launcher artifacts stale:"
  echo "- $COO_CLI_ARTIFACT"
  echo "- $COO_MEMORY_ENGINE_CLIENT_ARTIFACT"
  echo "- $MEMORY_ENGINE_ARTIFACT"
}

step_runtime_preflight() {
  cd "$REPO_ROOT"
  local tmp_log="$run_dir/_runtime-preflight.tmp.log"
  if ! ./adf.sh --runtime-preflight --json >"$tmp_log" 2>&1; then
    cat "$tmp_log"
    return 1
  fi
  if ! validate_runtime_preflight_log "$tmp_log" "direct-bash" "adf.sh"; then
    cat "$tmp_log"
    return 1
  fi
  cat "$tmp_log"
}

step_cmd_runtime_preflight() {
  cd "$REPO_ROOT"
  local adf_cmd_win
  local tmp_log="$run_dir/_cmd-runtime-preflight.tmp.log"

  adf_cmd_win="$(to_windows_path "$REPO_ROOT/adf.cmd")"

  if ! cmd.exe //c "$adf_cmd_win --runtime-preflight --json" >"$tmp_log" 2>&1; then
    cat "$tmp_log"
    return 1
  fi
  if ! validate_runtime_preflight_log "$tmp_log" "windows-cmd-trampoline" "adf.cmd"; then
    cat "$tmp_log"
    return 1
  fi
  cat "$tmp_log"
}

step_install() {
  cd "$REPO_ROOT"
  local tmp_log="$run_dir/_install.tmp.log"

  mark_launcher_artifacts_stale
  if ! ./adf.sh --install >"$tmp_log" 2>&1; then
    cat "$tmp_log"
    return 1
  fi
  if ! require_log_contains "$tmp_log" "build artifacts" "Install proof did not rebuild stale existing artifacts."; then
    cat "$tmp_log"
    return 1
  fi
  if ! require_log_not_contains "$tmp_log" "command not found" "Install proof still emitted a shell command failure."; then
    cat "$tmp_log"
    return 1
  fi
  if ! require_log_contains "$tmp_log" "ADF install/bootstrap OK" "Install proof did not complete successfully."; then
    cat "$tmp_log"
    return 1
  fi
  cat "$tmp_log"
}

step_launch_preflight_scripted() {
  cd "$REPO_ROOT"
  local tmp_log="$run_dir/_launch-preflight-scripted.tmp.log"

  mark_launcher_artifacts_stale
  if ! printf 'exit\n' | ADF_COO_TEST_PARSER_UPDATES_FILE="$empty_parser_updates_path" ./adf.sh --built -- --test-proof-mode >"$tmp_log" 2>&1; then
    cat "$tmp_log"
    return 1
  fi
  if ! require_log_contains "$tmp_log" "build artifacts" "Normal launch proof did not rebuild stale existing artifacts."; then
    cat "$tmp_log"
    return 1
  fi
  if ! require_log_not_contains "$tmp_log" "command not found" "Normal launch proof still emitted a shell command failure."; then
    cat "$tmp_log"
    return 1
  fi
  if ! require_log_contains "$tmp_log" "ADF preflight OK" "Normal launch preflight did not pass."; then
    cat "$tmp_log"
    return 1
  fi
  if ! require_log_contains "$tmp_log" "Session ended." "Normal launch proof did not exit cleanly."; then
    cat "$tmp_log"
    return 1
  fi
  cat "$tmp_log"
}

step_kpi_proof() {
  cd "$REPO_ROOT"
  node "$REPO_ROOT/tools/launcher-route-telemetry-proof.mjs" --repo-root "$REPO_ROOT" --proof-run-id "$run_name"
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
  run_step "02-cmd-runtime-preflight" "Run runtime-preflight through the Windows trampoline route and fail closed unless the saved log is valid JSON." "02-cmd-runtime-preflight.log" step_cmd_runtime_preflight
else
  record_step "02-cmd-runtime-preflight" "SKIP" "02-cmd-runtime-preflight.log" "Windows trampoline route not applicable on this host."
fi

run_step "03-install" "Make existing artifacts stale, then run the explicit install/bootstrap route and prove it rebuilds them." "03-install.log" step_install
run_step "04-runtime-preflight-post-install" "Run runtime-preflight again after install/bootstrap." "04-runtime-preflight-post-install.log" step_runtime_preflight
run_step "05-launch-preflight-scripted" "Make artifacts stale again, then run a scripted normal launch to prove bounded launch repair plus preflight truth." "05-launch-preflight-scripted.log" step_launch_preflight_scripted
run_step "06-kpi-proof" "Query proof-partition launcher telemetry for the exercised launcher routes in this bundle." "06-kpi-proof.log" step_kpi_proof
run_step "07-help" "Run launcher help after the split routes are in place." "07-help.log" step_help

if $RUN_DOCTOR; then
  run_step "08-doctor" "Run doctor to prove full repair plus Brain verification still works." "08-doctor.log" step_doctor
fi

write_summary

echo ""
echo "Proof bundle written to: $run_dir"
echo "Summary: $summary_path"

#!/usr/bin/env bash
# adf.sh - Authoritative bash launcher for ADF COO.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
MEMORY_ENGINE_DIR="$REPO_ROOT/components/memory-engine"
COO_DIR="$REPO_ROOT/COO"
DOCTOR_AUDIT_SCRIPT="$REPO_ROOT/tools/doctor-brain-audit.mjs"
DOCTOR_SMOKE_SCRIPT="$REPO_ROOT/tools/doctor-brain-connect-smoke.mjs"
RUNTIME_PREFLIGHT_SCRIPT="$REPO_ROOT/tools/agent-runtime-preflight.mjs"
LAUNCHER_TELEMETRY_SCRIPT="$REPO_ROOT/tools/launcher-route-telemetry.mjs"
DOCTOR_INCIDENT_DIR="$REPO_ROOT/memory/doctor-incidents"
INSTALL_STATE_PATH="$REPO_ROOT/.codex/runtime/install-state.json"
TMP_DIR="$REPO_ROOT/tmp"
DEFAULT_SCOPE="assafyavnai/adf"
DOCTOR_AUDIT_SCOPE="assafyavnai/adf"
FIELD_SEP=$'\x1f'
ACTIVE_LAUNCHER_TRACE_ID=""
ACTIVE_LAUNCHER_ROUTE_NAME=""
ACTIVE_LAUNCHER_ENTRY_SURFACE=""
ACTIVE_LAUNCHER_ENTRYPOINT=""
ACTIVE_LAUNCHER_CONTROL_PLANE_KIND=""

if [[ ! -f "$MEMORY_ENGINE_DIR/package.json" ]]; then
  echo "FATAL: Cannot find components/memory-engine/package.json under $REPO_ROOT"
  echo "       This script must live at the ADF repo root."
  exit 1
fi

info() { echo "  [ok]  $*"; }
warn() { echo "  [!!]  $*"; }
step() { echo ""; echo "--- $* ---"; }
die() { echo ""; echo "FATAL: $*" >&2; exit 1; }

is_windows_host() {
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) return 0 ;;
    *) return 1 ;;
  esac
}

choose_command() {
  local preferred="$1"
  local fallback="$2"

  if command -v "$preferred" >/dev/null 2>&1; then
    printf '%s' "$preferred"
    return 0
  fi

  printf '%s' "$fallback"
}

require_windows_command() {
  local cmd="$1"

  if ! command -v "$cmd" >/dev/null 2>&1; then
    die "Windows bash hosts require $cmd on PATH. Generic fallback to ${cmd%%.*} is not allowed."
  fi

  printf '%s' "$cmd"
}

if is_windows_host; then
  NPM_CMD="$(require_windows_command "npm.cmd")"
  NPX_CMD="$(require_windows_command "npx.cmd")"
else
  NPM_CMD="npm"
  NPX_CMD="npx"
fi

SHOW_HELP=false
RUN_DOCTOR=false
RUN_RUNTIME_PREFLIGHT=false
RUN_INSTALL=false
OUTPUT_JSON=false
SCOPE="$DEFAULT_SCOPE"
ONION_ENABLED=true
MODE="tsx-direct"
COO_EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      SHOW_HELP=true
      shift
      ;;
    --doctor)
      RUN_DOCTOR=true
      shift
      ;;
    --runtime-preflight)
      RUN_RUNTIME_PREFLIGHT=true
      shift
      ;;
    --install)
      RUN_INSTALL=true
      shift
      ;;
    --json)
      OUTPUT_JSON=true
      shift
      ;;
    --scope)
      SCOPE="${2:?--scope requires a value}"
      shift 2
      ;;
    --no-onion)
      ONION_ENABLED=false
      shift
      ;;
    --watch)
      MODE="watch"
      shift
      ;;
    --built)
      MODE="built"
      shift
      ;;
    --tsx-direct)
      MODE="tsx-direct"
      shift
      ;;
    --)
      shift
      COO_EXTRA_ARGS+=("$@")
      break
      ;;
    *)
      die "Unknown flag: $1 (use -- to pass flags directly to COO)"
      ;;
  esac
done

print_help() {
  cat <<EOF
adf.sh - Authoritative bash launcher for ADF COO

USAGE
  ./adf.sh [flags] [-- <COO args>]
  adf.cmd [flags] [-- <COO args>]    # Windows trampoline into bash

FLAGS
  --help, -h     Show this help text
  --runtime-preflight
                  Run the fast runtime gate and emit environment truth for agents
  --install       Run explicit install/bootstrap repair for repo dependencies and builds
  --doctor       Repair bounded prerequisites, require working bash + Brain MCP, and log success to Brain
  --json         Emit JSON when used with --runtime-preflight
  --scope <id>   Override Brain scope (default: $DEFAULT_SCOPE)
  --no-onion     Disable onion requirements lane
  --tsx-direct   Run COO through the local tsx shim (default)
  --watch        Run COO through tsx watch
  --built        Run compiled COO JavaScript
  --             Pass remaining args directly to COO

EXAMPLES
  ./adf.sh --help
  ./adf.sh --runtime-preflight --json
  ./adf.sh --install
  ./adf.sh --doctor
  ./adf.sh --built -- --resume-last
  ./adf.sh --scope assafyavnai/adf -- --thread-id <uuid>
EOF
}

if $SHOW_HELP; then
  print_help
  exit 0
fi

if $OUTPUT_JSON && ! $RUN_RUNTIME_PREFLIGHT; then
  die "--json is only supported with --runtime-preflight"
fi

primary_mode_count=0
$RUN_DOCTOR && primary_mode_count=$((primary_mode_count + 1))
$RUN_RUNTIME_PREFLIGHT && primary_mode_count=$((primary_mode_count + 1))
$RUN_INSTALL && primary_mode_count=$((primary_mode_count + 1))
if (( primary_mode_count > 1 )); then
  die "--install, --runtime-preflight, and --doctor are mutually exclusive"
fi

needs_npm_install() {
  local pkg_dir="$1"
  local node_modules_dir="$pkg_dir/node_modules"
  local marker="$node_modules_dir/.package-lock.json"
  local package_lock="$pkg_dir/package-lock.json"

  [[ ! -d "$node_modules_dir" ]] && return 0
  [[ ! -f "$marker" ]] && return 0
  [[ ! -f "$package_lock" ]] && return 0
  [[ "$package_lock" -nt "$marker" ]] && return 0
  return 1
}

needs_memory_engine_build() {
  local artifact="$MEMORY_ENGINE_DIR/dist/server.js"
  [[ ! -f "$artifact" ]] && return 0

  local newer
  newer="$(find "$MEMORY_ENGINE_DIR/src" -name '*.ts' -newer "$artifact" 2>/dev/null | head -1 || true)"
  [[ -n "$newer" ]] && return 0
  return 1
}

needs_coo_build() {
  local artifact="$COO_DIR/dist/COO/controller/cli.js"
  [[ ! -f "$artifact" ]] && return 0

  local newer
  newer="$(find "$COO_DIR" -maxdepth 3 -name '*.ts' -newer "$artifact" 2>/dev/null | head -1 || true)"
  [[ -n "$newer" ]] && return 0
  return 1
}

coo_needs_build() {
  needs_coo_build
}

memory_engine_needs_build() {
  needs_memory_engine_build
}

coo_memory_engine_client_artifact() {
  printf '%s' "$COO_DIR/dist/COO/controller/memory-engine-client.js"
}

memory_engine_mcp_sdk_client_artifact() {
  printf '%s' "$MEMORY_ENGINE_DIR/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js"
}

coo_needs_install() {
  needs_npm_install "$COO_DIR" && return 0
  [[ -z "$(local_tsx_shim "$COO_DIR" || true)" ]] && return 0
  return 1
}

memory_engine_needs_install() {
  needs_npm_install "$MEMORY_ENGINE_DIR" && return 0
  [[ -z "$(local_tsx_shim "$MEMORY_ENGINE_DIR" || true)" ]] && return 0
  [[ ! -f "$(memory_engine_mcp_sdk_client_artifact)" ]] && return 0
  return 1
}

coo_needs_repair() {
  coo_needs_install && return 0
  [[ ! -f "$(coo_memory_engine_client_artifact)" ]] && return 0
  needs_coo_build && return 0
  return 1
}

memory_engine_needs_repair() {
  memory_engine_needs_install && return 0
  [[ ! -f "$MEMORY_ENGINE_DIR/dist/server.js" ]] && return 0
  needs_memory_engine_build && return 0
  return 1
}

needs_install_state_recording() {
  [[ ! -f "$INSTALL_STATE_PATH" ]]
}

local_tsx_shim() {
  local package_dir="$1"

  if is_windows_host; then
    if [[ -f "$package_dir/node_modules/.bin/tsx.cmd" ]]; then
      printf '%s' "$package_dir/node_modules/.bin/tsx.cmd"
      return 0
    fi
  fi

  if [[ -f "$package_dir/node_modules/.bin/tsx" ]]; then
    printf '%s' "$package_dir/node_modules/.bin/tsx"
    return 0
  fi

  return 1
}

command_location() {
  command -v "$1" 2>/dev/null || true
}

capture_command() {
  CAPTURE_OUTPUT=""
  CAPTURE_STATUS=0

  set +e
  CAPTURE_OUTPUT="$("$@" 2>&1)"
  CAPTURE_STATUS=$?
  set -e
}

run_checked() {
  local working_dir="$1"
  shift
  (
    cd "$working_dir"
    "$@"
  )
}

iso_now() {
  node -e "console.log(new Date().toISOString())"
}

epoch_ms_now() {
  node -e "process.stdout.write(String(Date.now()))"
}

elapsed_ms_between() {
  node -e "const start = Number(process.argv[1]); const end = Number(process.argv[2]); const diff = Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, end - start) : 0; process.stdout.write(String(diff));" "$1" "$2"
}

new_uuid() {
  node -e "console.log(require('node:crypto').randomUUID())"
}

json_string() {
  node -e "process.stdout.write(JSON.stringify(process.argv[1] ?? ''))" "$1"
}

set_active_launcher_repair_context() {
  ACTIVE_LAUNCHER_TRACE_ID="$1"
  ACTIVE_LAUNCHER_ROUTE_NAME="$2"
  ACTIVE_LAUNCHER_ENTRY_SURFACE="$3"
  ACTIVE_LAUNCHER_ENTRYPOINT="$4"
  ACTIVE_LAUNCHER_CONTROL_PLANE_KIND="$5"
}

clear_active_launcher_repair_context() {
  ACTIVE_LAUNCHER_TRACE_ID=""
  ACTIVE_LAUNCHER_ROUTE_NAME=""
  ACTIVE_LAUNCHER_ENTRY_SURFACE=""
  ACTIVE_LAUNCHER_ENTRYPOINT=""
  ACTIVE_LAUNCHER_CONTROL_PLANE_KIND=""
}

emit_launcher_route_metric() {
  local trace_id="$1"
  local route_name="$2"
  local entry_surface="$3"
  local entrypoint="$4"
  local control_plane_kind="$5"
  local operation="$6"
  local success="$7"
  local latency_ms="$8"
  local route_stage="$9"
  local step_name="${10:-}"
  local result_status="${11:-}"
  local error_class="${12:-}"
  local error_message="${13:-}"

  if [[ ! -f "$LAUNCHER_TELEMETRY_SCRIPT" ]]; then
    return 0
  fi

  if ! command -v node >/dev/null 2>&1; then
    return 0
  fi

  local -a telemetry_args
  telemetry_args=(
    "$LAUNCHER_TELEMETRY_SCRIPT"
    --repo-root "$REPO_ROOT"
    --operation "$operation"
    --success "$success"
    --latency-ms "$latency_ms"
    --trace-id "$trace_id"
    --route-name "$route_name"
    --entry-surface "$entry_surface"
    --entrypoint "$entrypoint"
    --control-plane-kind "$control_plane_kind"
    --route-stage "$route_stage"
    --step-name "$step_name"
    --result-status "$result_status"
  )

  if [[ -n "$error_class" ]]; then
    telemetry_args+=(--error-class "$error_class")
  fi

  if [[ -n "$error_message" ]]; then
    telemetry_args+=(--error-message "$error_message")
  fi

  node "${telemetry_args[@]}" >/dev/null 2>&1 || true
}

emit_active_launcher_repair_metric() {
  local status="$1"
  local name="$2"
  local detail="$3"
  local started_at_ms="$4"
  local completed_at_ms="$5"

  if [[ -z "$ACTIVE_LAUNCHER_TRACE_ID" || -z "$ACTIVE_LAUNCHER_ROUTE_NAME" ]]; then
    return 0
  fi

  local success="false"
  local result_status="failed"
  local error_class="repair_failed"

  if [[ "$status" == "applied" ]]; then
    success="true"
    result_status="applied"
    error_class=""
  fi

  emit_launcher_route_metric \
    "$ACTIVE_LAUNCHER_TRACE_ID" \
    "$ACTIVE_LAUNCHER_ROUTE_NAME" \
    "$ACTIVE_LAUNCHER_ENTRY_SURFACE" \
    "$ACTIVE_LAUNCHER_ENTRYPOINT" \
    "$ACTIVE_LAUNCHER_CONTROL_PLANE_KIND" \
    "launcher_repair_step" \
    "$success" \
    "$(elapsed_ms_between "$started_at_ms" "$completed_at_ms")" \
    "repair" \
    "$name" \
    "$result_status" \
    "$error_class" \
    "$detail"
}

write_install_state() {
  local completed_at="$1"
  local host_os="linux"
  local node_version
  local bash_path
  local repairs_json

  if is_windows_host; then
    host_os="windows"
  elif [[ "$(uname -s)" == "Darwin" ]]; then
    host_os="macos"
  fi

  node_version="$(node --version 2>/dev/null || true)"
  bash_path="$(command_location bash)"
  repairs_json="$(json_array_from_name DOCTOR_REPAIRS_JSON)"

  mkdir -p "$(dirname "$INSTALL_STATE_PATH")"
  cat >"$INSTALL_STATE_PATH" <<EOF
{
  "schema_version": 1,
  "repo_root": $(json_string "$REPO_ROOT"),
  "host_os": $(json_string "$host_os"),
  "npm_command": $(json_string "$NPM_CMD"),
  "npx_command": $(json_string "$NPX_CMD"),
  "node_version": $(json_string "$node_version"),
  "bash_path": $(json_string "$bash_path"),
  "completed_at": $(json_string "$completed_at"),
  "repairs": $repairs_json
}
EOF
}

declare -a DOCTOR_CHECK_LINES=()
declare -a DOCTOR_CHECKS_JSON=()
declare -a DOCTOR_REPAIR_LINES=()
declare -a DOCTOR_REPAIRS_JSON=()

reset_doctor_state() {
  DOCTOR_CHECK_LINES=()
  DOCTOR_CHECKS_JSON=()
  DOCTOR_REPAIR_LINES=()
  DOCTOR_REPAIRS_JSON=()
}

add_check() {
  local name="$1"
  local status="$2"
  local detail="$3"
  local fix="${4:-}"

  DOCTOR_CHECK_LINES+=("${status}${FIELD_SEP}${name}${FIELD_SEP}${detail}${FIELD_SEP}${fix}")
  DOCTOR_CHECKS_JSON+=("{\"Name\":$(json_string "$name"),\"Status\":$(json_string "$status"),\"Detail\":$(json_string "$detail"),\"Fix\":$(json_string "$fix")}")
}

add_repair() {
  local name="$1"
  local status="$2"
  local detail="$3"
  local started_at="$4"
  local completed_at="$5"
  local started_at_ms
  local completed_at_ms

  started_at_ms="$(epoch_ms_now)"
  completed_at_ms="$started_at_ms"

  DOCTOR_REPAIR_LINES+=("${status}${FIELD_SEP}${name}${FIELD_SEP}${detail}${FIELD_SEP}${started_at}${FIELD_SEP}${completed_at}")
  DOCTOR_REPAIRS_JSON+=("{\"Name\":$(json_string "$name"),\"Status\":$(json_string "$status"),\"Detail\":$(json_string "$detail"),\"StartedAt\":$(json_string "$started_at"),\"CompletedAt\":$(json_string "$completed_at")}")

  if [[ -n "$started_at" && -n "$completed_at" ]]; then
    started_at_ms="$(node -e "const value = Date.parse(process.argv[1]); process.stdout.write(String(Number.isFinite(value) ? value : Date.now()));" "$started_at")"
    completed_at_ms="$(node -e "const value = Date.parse(process.argv[1]); process.stdout.write(String(Number.isFinite(value) ? value : Date.now()));" "$completed_at")"
  fi

  emit_active_launcher_repair_metric "$status" "$name" "$detail" "$started_at_ms" "$completed_at_ms"
}

json_array_from_name() {
  local array_name="$1"
  declare -n array_ref="$array_name"
  local joined=""
  local item

  for item in "${array_ref[@]}"; do
    if [[ -n "$joined" ]]; then
      joined+=","
    fi
    joined+="$item"
  done

  printf '[%s]' "$joined"
}

SPINNER_FRAMES=('-' '\' '|' '/')
SPINNER_CAPTURE_STATUS=0
SPINNER_CAPTURE_OUTPUT=""
STATUS_RENDERED=false
declare -a STATUS_TASK_LABELS=()
declare -a STATUS_TASK_PIDS=()
declare -a STATUS_TASK_LOGS=()
declare -a STATUS_TASK_STARTED_AT=()
declare -a STATUS_TASK_COMPLETED_AT=()
declare -a STATUS_TASK_RESULTS=()
declare -a STATUS_TASK_NAMES=()
declare -a STATUS_TASK_DETAILS=()

is_interactive_terminal() {
  [[ -t 1 ]]
}

join_with_and() {
  local out=""
  local item

  for item in "$@"; do
    if [[ -z "$out" ]]; then
      out="$item"
    else
      out="$out and $item"
    fi
  done

  printf '%s' "$out"
}

run_with_spinner() {
  local label="$1"
  shift

  local log_file="$TMP_DIR/spinner-$(date +%s)-$$-$RANDOM.log"
  mkdir -p "$TMP_DIR"

  ("$@" >"$log_file" 2>&1) &
  local pid=$!
  local frame_index=0

  if is_interactive_terminal; then
    while kill -0 "$pid" 2>/dev/null; do
      printf '\r%s %s\033[K' "${SPINNER_FRAMES[$frame_index]}" "$label"
      frame_index=$(((frame_index + 1) % ${#SPINNER_FRAMES[@]}))
      sleep 0.1
    done
  else
    printf '%s\n' "$label"
  fi

  set +e
  wait "$pid"
  SPINNER_CAPTURE_STATUS=$?
  set -e

  SPINNER_CAPTURE_OUTPUT="$(cat "$log_file" 2>/dev/null || true)"
  rm -f "$log_file"

  if is_interactive_terminal; then
    printf '\r%s %s\033[K\n' "$label" "$([[ $SPINNER_CAPTURE_STATUS -eq 0 ]] && printf 'PASSED' || printf 'FAILED')"
  else
    printf '%s %s\n' "$label" "$([[ $SPINNER_CAPTURE_STATUS -eq 0 ]] && printf 'PASSED' || printf 'FAILED')"
  fi

  return "$SPINNER_CAPTURE_STATUS"
}

reset_status_tasks() {
  STATUS_RENDERED=false
  STATUS_TASK_LABELS=()
  STATUS_TASK_PIDS=()
  STATUS_TASK_LOGS=()
  STATUS_TASK_STARTED_AT=()
  STATUS_TASK_COMPLETED_AT=()
  STATUS_TASK_RESULTS=()
  STATUS_TASK_NAMES=()
  STATUS_TASK_DETAILS=()
}

start_status_task() {
  local name="$1"
  local label="$2"
  local detail="$3"
  shift 3

  local log_file="$TMP_DIR/status-task-$(date +%s)-$$-$RANDOM.log"
  mkdir -p "$TMP_DIR"

  ("$@" >"$log_file" 2>&1) &
  STATUS_TASK_NAMES+=("$name")
  STATUS_TASK_LABELS+=("$label")
  STATUS_TASK_DETAILS+=("$detail")
  STATUS_TASK_PIDS+=("$!")
  STATUS_TASK_LOGS+=("$log_file")
  STATUS_TASK_STARTED_AT+=("$(iso_now)")
  STATUS_TASK_COMPLETED_AT+=("")
  STATUS_TASK_RESULTS+=("running")
}

render_status_tasks() {
  local frame_index="$1"
  local count="${#STATUS_TASK_LABELS[@]}"
  local idx

  if (( count == 0 )); then
    return 0
  fi

  if is_interactive_terminal; then
    if ! $STATUS_RENDERED; then
      for ((idx = 0; idx < count; idx += 1)); do
        printf '\n'
      done
      STATUS_RENDERED=true
    fi

    printf '\033[%dA' "$count"
    for ((idx = 0; idx < count; idx += 1)); do
      local indicator="${SPINNER_FRAMES[$frame_index]}"
      case "${STATUS_TASK_RESULTS[$idx]}" in
        ok) indicator="OK" ;;
        failed) indicator="FAILED" ;;
      esac
      printf '%-72s [%s]\033[K\n' "${STATUS_TASK_LABELS[$idx]}" "$indicator"
    done
  fi
}

monitor_status_tasks() {
  local frame_index=0
  local idx
  local still_running=true

  if ! is_interactive_terminal; then
    for ((idx = 0; idx < ${#STATUS_TASK_LABELS[@]}; idx += 1)); do
      printf '%s ...\n' "${STATUS_TASK_LABELS[$idx]}"
    done
  fi

  while $still_running; do
    still_running=false

    for ((idx = 0; idx < ${#STATUS_TASK_PIDS[@]}; idx += 1)); do
      if [[ "${STATUS_TASK_RESULTS[$idx]}" != "running" ]]; then
        continue
      fi

      if kill -0 "${STATUS_TASK_PIDS[$idx]}" 2>/dev/null; then
        still_running=true
        continue
      fi

      set +e
      wait "${STATUS_TASK_PIDS[$idx]}"
      local wait_status=$?
      set -e

      STATUS_TASK_COMPLETED_AT[$idx]="$(iso_now)"
      if [[ $wait_status -eq 0 ]]; then
        STATUS_TASK_RESULTS[$idx]="ok"
      else
        STATUS_TASK_RESULTS[$idx]="failed"
      fi

      if ! is_interactive_terminal; then
        printf '%s %s\n' "${STATUS_TASK_LABELS[$idx]}" "$([[ $wait_status -eq 0 ]] && printf 'OK' || printf 'FAILED')"
      fi
    done

    render_status_tasks "$frame_index"
    frame_index=$(((frame_index + 1) % ${#SPINNER_FRAMES[@]}))
    $still_running && sleep 0.1
  done

  render_status_tasks "$frame_index"

  local any_failed=0
  for ((idx = 0; idx < ${#STATUS_TASK_RESULTS[@]}; idx += 1)); do
    local task_status="${STATUS_TASK_RESULTS[$idx]}"
    local task_detail="${STATUS_TASK_DETAILS[$idx]}"
    local log_path="${STATUS_TASK_LOGS[$idx]}"
    if [[ "$task_status" == "ok" ]]; then
      add_repair "${STATUS_TASK_NAMES[$idx]}" "applied" "$task_detail" "${STATUS_TASK_STARTED_AT[$idx]}" "${STATUS_TASK_COMPLETED_AT[$idx]}"
    else
      add_repair "${STATUS_TASK_NAMES[$idx]}" "failed" "$task_detail Failed. See $log_path." "${STATUS_TASK_STARTED_AT[$idx]}" "${STATUS_TASK_COMPLETED_AT[$idx]}"
      any_failed=1
    fi
  done

  return "$any_failed"
}

capture_runtime_preflight_to_file() {
  local output_path="$1"

  ADF_ENTRYPOINT="${ADF_ENTRYPOINT:-adf.sh}" \
  ADF_CONTROL_PLANE_KIND="${ADF_CONTROL_PLANE_KIND:-direct-bash}" \
  node "$RUNTIME_PREFLIGHT_SCRIPT" --repo-root "$REPO_ROOT" --launch-mode "$MODE" --json >"$output_path"
}

runtime_preflight_status() {
  local report_path="$1"
  node - "$report_path" <<'NODE'
const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
process.stdout.write(String(report.overall_status ?? ""));
NODE
}

runtime_preflight_failures() {
  local report_path="$1"
  node - "$report_path" <<'NODE'
const fs = require("node:fs");
const report = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
for (const check of report.checks ?? []) {
  if (check.status === "fail") {
    console.log(`${check.name}\u001f${check.detail}`);
  }
}
NODE
}

print_launch_blockers() {
  local report_path="$1"
  local had_any=false
  local entry

  echo "Can't launch ADF because:"
  while IFS= read -r entry; do
    [[ -z "$entry" ]] && continue
    IFS="$FIELD_SEP" read -r name detail <<<"$entry"
    printf -- '- %s: %s\n' "$name" "$detail"
    had_any=true
  done < <(runtime_preflight_failures "$report_path")

  if ! $had_any; then
    echo "- Runtime preflight failed, but no concrete blocking checks were returned."
  fi
}

print_repair_failures() {
  local entry
  local had_any=false

  echo "Can't launch ADF because:"
  for entry in "${DOCTOR_REPAIR_LINES[@]}"; do
    IFS="$FIELD_SEP" read -r status name detail _started_at _completed_at <<<"$entry"
    [[ "$status" != "failed" ]] && continue
    printf -- '- %s: %s\n' "$name" "$detail"
    had_any=true
  done

  if ! $had_any; then
    echo "- Bounded repair failed, but no concrete repair failure was recorded."
  fi
}

coo_repair_label() {
  local actions=()
  coo_needs_install && actions+=("install dependencies")
  (needs_coo_build || [[ ! -f "$(coo_memory_engine_client_artifact)" ]]) && actions+=("build artifacts")
  printf 'COO: %s' "$(join_with_and "${actions[@]}")"
}

memory_engine_repair_label() {
  local actions=()
  memory_engine_needs_install && actions+=("install dependencies")
  (needs_memory_engine_build || [[ ! -f "$MEMORY_ENGINE_DIR/dist/server.js" ]]) && actions+=("build artifacts")
  printf 'memory-engine: %s' "$(join_with_and "${actions[@]}")"
}

run_coo_repair_lane() {
  if coo_needs_install; then
    run_checked "$COO_DIR" "$NPM_CMD" install --no-fund --no-audit
  fi

  if needs_coo_build || [[ ! -f "$(coo_memory_engine_client_artifact)" ]]; then
    run_checked "$COO_DIR" "$NPM_CMD" run build
  fi
}

run_memory_engine_repair_lane() {
  if memory_engine_needs_install; then
    run_checked "$MEMORY_ENGINE_DIR" "$NPM_CMD" install --no-fund --no-audit
  fi

  if needs_memory_engine_build || [[ ! -f "$MEMORY_ENGINE_DIR/dist/server.js" ]]; then
    run_checked "$MEMORY_ENGINE_DIR" "$NPM_CMD" run build
  fi
}

record_install_state_only() {
  write_install_state "$(iso_now)"
}

auto_repair_needed() {
  coo_needs_repair && return 0
  memory_engine_needs_repair && return 0
  needs_install_state_recording && return 0
  return 1
}

run_auto_repair_flow() {
  local repair_failed=0
  reset_doctor_state
  reset_status_tasks

  if memory_engine_needs_repair; then
    start_status_task \
      "memory-engine repair" \
      "$(memory_engine_repair_label)" \
      "Repaired missing or stale memory-engine dependencies or artifacts." \
      run_memory_engine_repair_lane
  fi

  if coo_needs_repair; then
    start_status_task \
      "COO repair" \
      "$(coo_repair_label)" \
      "Repaired missing or stale COO dependencies or artifacts." \
      run_coo_repair_lane
  fi

  if (( ${#STATUS_TASK_LABELS[@]} > 0 )); then
    echo "Repairing missing prerequisites..."
    if ! monitor_status_tasks; then
      repair_failed=1
    fi
  fi

  if [[ $repair_failed -ne 0 ]]; then
    return 1
  fi

  if needs_install_state_recording || (( ${#STATUS_TASK_LABELS[@]} > 0 )); then
    local install_state_started_at
    local install_state_completed_at
    install_state_started_at="$(iso_now)"
    if ! run_with_spinner "Recording install state..." record_install_state_only; then
      install_state_completed_at="$(iso_now)"
      add_repair "install state" "failed" "Failed to record successful install/bootstrap state." "$install_state_started_at" "$install_state_completed_at"
      return 1
    fi
    install_state_completed_at="$(iso_now)"
    add_repair "install state" "applied" "Recorded successful install/bootstrap state." "$install_state_started_at" "$install_state_completed_at"
  fi

  return 0
}

print_doctor_report() {
  local report_path="${1:-}"
  local brain_audit_result="${2:-}"
  local entry

  echo "ADF doctor"

  if [[ ${#DOCTOR_REPAIR_LINES[@]} -gt 0 ]]; then
    echo "Repairs attempted"
    for entry in "${DOCTOR_REPAIR_LINES[@]}"; do
      IFS="$FIELD_SEP" read -r status name detail started_at completed_at <<<"$entry"
      if [[ "$status" == "applied" ]]; then
        echo "[FIXED] $name"
      else
        echo "[FAILED] $name"
      fi
      echo "  $detail"
    done
  fi

  for entry in "${DOCTOR_CHECK_LINES[@]}"; do
    IFS="$FIELD_SEP" read -r status name detail fix <<<"$entry"
    case "$status" in
      pass) echo "[PASS] $name" ;;
      fail) echo "[FAIL] $name" ;;
      *) echo "[WARN] $name" ;;
    esac
    echo "  $detail"
    if [[ -n "$fix" ]]; then
      echo "  Fix: $fix"
    fi
  done

  if [[ -n "$brain_audit_result" ]]; then
    echo "[PASS] Brain audit"
    echo "  $brain_audit_result"
  fi

  if [[ -n "$report_path" ]]; then
    echo "[REPORT] Local incident"
    echo "  $report_path"
  fi
}

invoke_repair_step() {
  local name="$1"
  local detail="$2"
  shift 2

  local started_at
  local completed_at
  started_at="$(iso_now)"

  if "$@"; then
    completed_at="$(iso_now)"
    add_repair "$name" "applied" "$detail" "$started_at" "$completed_at"
    return 0
  fi

  local status=$?
  completed_at="$(iso_now)"
  add_repair "$name" "failed" "$detail Failed with exit code $status." "$started_at" "$completed_at"
  return $status
}

repair_doctor_prerequisites() {
  command -v node >/dev/null 2>&1 || die "node is not installed or not on PATH."
  command -v "$NPM_CMD" >/dev/null 2>&1 || die "$NPM_CMD is not installed or not on PATH."

  if needs_npm_install "$MEMORY_ENGINE_DIR"; then
    invoke_repair_step "memory-engine dependencies" "Installed missing or stale memory-engine dependencies." \
      run_checked "$MEMORY_ENGINE_DIR" "$NPM_CMD" install --no-fund --no-audit
  fi

  if needs_memory_engine_build; then
    invoke_repair_step "memory-engine build" "Built memory-engine artifacts required for MCP startup." \
      run_checked "$MEMORY_ENGINE_DIR" "$NPM_CMD" run build
  fi

  if needs_npm_install "$COO_DIR"; then
    invoke_repair_step "COO dependencies" "Installed missing or stale COO dependencies." \
      run_checked "$COO_DIR" "$NPM_CMD" install --no-fund --no-audit
  fi

  if needs_coo_build || [[ ! -f "$COO_DIR/dist/COO/controller/memory-engine-client.js" ]]; then
    invoke_repair_step "COO build" "Built COO artifacts required for Brain MCP connectivity checks." \
      run_checked "$COO_DIR" "$NPM_CMD" run build
  fi
}

get_doctor_checks() {
  local bash_path
  local git_path
  local pg_path
  local tsx_shim

  if command -v node >/dev/null 2>&1; then
    add_check "node" "pass" "node is available via $(command_location node)." ""
  else
    add_check "node" "fail" "node is not on PATH." "Install or expose node on PATH before using ADF."
  fi

  if command -v "$NPM_CMD" >/dev/null 2>&1; then
    add_check "npm" "pass" "$NPM_CMD is available via $(command_location "$NPM_CMD")." ""
  else
    add_check "npm" "fail" "$NPM_CMD is not on PATH." "Install or expose $NPM_CMD on PATH before using ADF."
  fi

  if command -v rg >/dev/null 2>&1; then
    add_check "rg" "pass" "rg is available via $(command_location rg)." ""
  else
    add_check "rg" "warn" "rg is not on PATH." "Install ripgrep if you want the documented fast-path search tooling."
  fi

  bash_path="$(command_location bash)"
  if [[ -z "$bash_path" ]]; then
    add_check "bash" "fail" "bash is not on PATH from the active bash session." "Install or expose a working bash runtime."
  else
    capture_command bash --version
    if [[ $CAPTURE_STATUS -eq 0 ]]; then
      add_check "bash" "pass" "bash starts successfully via $bash_path." ""
    else
      add_check "bash" "fail" "$CAPTURE_OUTPUT" "Fix the bash runtime. ADF is non-compliant until bash starts successfully."
    fi
  fi

  tsx_shim="$(local_tsx_shim "$COO_DIR" || true)"
  if [[ -n "$tsx_shim" ]]; then
    add_check "COO tsx shim" "pass" "Local COO tsx shim found at $tsx_shim." ""
  else
    add_check "COO tsx shim" "fail" "COO local tsx shim is missing." "Run $NPM_CMD install in COO."
  fi

  tsx_shim="$(local_tsx_shim "$MEMORY_ENGINE_DIR" || true)"
  if [[ -n "$tsx_shim" ]]; then
    add_check "memory-engine tsx shim" "pass" "Local memory-engine tsx shim found at $tsx_shim." ""
  else
    add_check "memory-engine tsx shim" "fail" "memory-engine local tsx shim is missing." "Run $NPM_CMD install in components/memory-engine."
  fi

  capture_command node --import tsx -e "console.log('ok')"
  if [[ $CAPTURE_STATUS -eq 0 ]]; then
    add_check "repo-root tsx import" "pass" "Repo-root node --import tsx works." ""
  else
    add_check "repo-root tsx import" "warn" "$CAPTURE_OUTPUT" "Use the package-local tsx shim or execute node --import tsx from COO or components/memory-engine."
  fi

  if command -v git >/dev/null 2>&1; then
    capture_command git status --short
    if [[ $CAPTURE_STATUS -eq 0 ]]; then
      add_check "git safe.directory" "pass" "git status works without extra safe.directory flags." ""
    elif [[ "$CAPTURE_OUTPUT" == *"dubious ownership"* || "$CAPTURE_OUTPUT" == *"safe.directory"* ]]; then
      add_check "git safe.directory" "warn" "$CAPTURE_OUTPUT" "Run git config --global --add safe.directory ${REPO_ROOT//\\//}."
    else
      add_check "git safe.directory" "warn" "$CAPTURE_OUTPUT" "Inspect git configuration for this workspace."
    fi
  else
    add_check "git" "warn" "git is not on PATH." "Install git and add it to PATH if you need repo status and version control operations."
  fi

  pg_path="$(command_location pg_isready)"
  if [[ -z "$pg_path" ]]; then
    add_check "pg_isready" "warn" "pg_isready is not on PATH. PostgreSQL reachability was not probed." "Install PostgreSQL client tools if you want preflight DB checks from the launcher."
  else
    capture_command pg_isready -h localhost -p 5432 -q
    if [[ $CAPTURE_STATUS -eq 0 ]]; then
      add_check "PostgreSQL reachability" "pass" "PostgreSQL is accepting connections on localhost:5432." ""
    else
      add_check "PostgreSQL reachability" "fail" "$CAPTURE_OUTPUT" "Start PostgreSQL before launching ADF."
    fi
  fi

  if [[ ! -f "$COO_DIR/dist/COO/controller/memory-engine-client.js" || ! -f "$MEMORY_ENGINE_DIR/dist/server.js" ]]; then
    add_check "memory-engine connect smoke" "fail" "Built artifacts for memory-engine connectivity smoke are missing." "Run $NPM_CMD run build in COO and components/memory-engine."
  elif [[ ! -f "$DOCTOR_SMOKE_SCRIPT" ]]; then
    add_check "memory-engine connect smoke" "fail" "Doctor Brain connectivity smoke script is missing: $DOCTOR_SMOKE_SCRIPT" "Restore tools/doctor-brain-connect-smoke.mjs."
  else
    capture_command node "$DOCTOR_SMOKE_SCRIPT" "$REPO_ROOT"
    if [[ $CAPTURE_STATUS -eq 0 ]]; then
      add_check "memory-engine connect smoke" "pass" "MemoryEngineClient.connect() succeeded from the current bash runtime." ""
    else
      add_check "memory-engine connect smoke" "fail" "$CAPTURE_OUTPUT" "Fix MCP startup or execution permissions; doctor must fail until the stdio Brain route works."
    fi
  fi
}

doctor_incident_path() {
  local run_id="$1"
  local timestamp
  timestamp="$(date +"%Y%m%d-%H%M%S")"
  printf '%s/%s-doctor-mcp-incident-%s.json' "$DOCTOR_INCIDENT_DIR" "$timestamp" "${run_id:0:8}"
}

write_doctor_incident_report() {
  local run_id="$1"
  local started_at="$2"
  local completed_at="$3"
  local stage="$4"
  local message="$5"
  local report_path
  local checks_json
  local repairs_json

  mkdir -p "$DOCTOR_INCIDENT_DIR"
  report_path="$(doctor_incident_path "$run_id")"
  checks_json="$(json_array_from_name DOCTOR_CHECKS_JSON)"
  repairs_json="$(json_array_from_name DOCTOR_REPAIRS_JSON)"

  cat >"$report_path" <<EOF
{
  "run_id": $(json_string "$run_id"),
  "scope": $(json_string "$DOCTOR_AUDIT_SCOPE"),
  "status": "blocked",
  "stage": $(json_string "$stage"),
  "started_at": $(json_string "$started_at"),
  "completed_at": $(json_string "$completed_at"),
  "message": $(json_string "$message"),
  "repairs_attempted": $repairs_json,
  "checks": $checks_json
}
EOF

  printf '%s' "$report_path"
}

invoke_brain_doctor_audit() {
  local run_id="$1"
  local started_at="$2"
  local completed_at="$3"
  local outcome
  local summary
  local payload_path
  local checks_json
  local repairs_json

  [[ -f "$DOCTOR_AUDIT_SCRIPT" ]] || die "Doctor Brain audit script is missing: $DOCTOR_AUDIT_SCRIPT"

  if [[ ${#DOCTOR_REPAIR_LINES[@]} -gt 0 ]]; then
    outcome="healed"
    summary="Doctor repaired Brain MCP prerequisites and verified working bash and Brain MCP connectivity."
  else
    outcome="verified"
    summary="Doctor verified working bash and Brain MCP connectivity without repairs."
  fi

  mkdir -p "$TMP_DIR"
  payload_path="$TMP_DIR/doctor-audit-$run_id.json"
  checks_json="$(json_array_from_name DOCTOR_CHECKS_JSON)"
  repairs_json="$(json_array_from_name DOCTOR_REPAIRS_JSON)"

  cat >"$payload_path" <<EOF
{
  "run_id": $(json_string "$run_id"),
  "scope": $(json_string "$DOCTOR_AUDIT_SCOPE"),
  "title": "ADF doctor Brain MCP health audit",
  "summary": $(json_string "$summary"),
  "outcome": $(json_string "$outcome"),
  "started_at": $(json_string "$started_at"),
  "completed_at": $(json_string "$completed_at"),
  "repairs_attempted": $repairs_json,
  "checks": $checks_json,
  "tags": ["doctor", "mcp-health", "audit", $(json_string "$outcome")]
}
EOF

  capture_command node "$DOCTOR_AUDIT_SCRIPT" "$payload_path"
  rm -f "$payload_path"

  if [[ $CAPTURE_STATUS -ne 0 ]]; then
    return 1
  fi

  printf '%s' "$CAPTURE_OUTPUT"
}

run_doctor() {
  local run_id
  local started_at
  local completed_at
  local stage="repair"
  local report_path=""
  local brain_audit_result=""
  local message=""
  local has_fail=0
  local entry

  reset_doctor_state
  run_id="$(new_uuid)"
  started_at="$(iso_now)"

  if ! repair_doctor_prerequisites; then
    completed_at="$(iso_now)"
    message="Doctor repair failed before verification completed."
    if [[ ${#DOCTOR_CHECK_LINES[@]} -eq 0 ]]; then
      add_check "doctor stage" "fail" "$message" "Inspect the blocking prerequisite and rerun doctor."
    fi
    report_path="$(write_doctor_incident_report "$run_id" "$started_at" "$completed_at" "$stage" "$message")"
    print_doctor_report "$report_path" ""
    return 1
  fi

  stage="verify"
  get_doctor_checks

  for entry in "${DOCTOR_CHECK_LINES[@]}"; do
    IFS="$FIELD_SEP" read -r status _ <<<"$entry"
    if [[ "$status" == "fail" ]]; then
      has_fail=1
      break
    fi
  done

  if [[ $has_fail -ne 0 ]]; then
    completed_at="$(iso_now)"
    message="Doctor verification failed. Bash and Brain MCP did not reach a healthy state."
    report_path="$(write_doctor_incident_report "$run_id" "$started_at" "$completed_at" "$stage" "$message")"
    print_doctor_report "$report_path" ""
    return 1
  fi

  stage="brain_audit"
  completed_at="$(iso_now)"
  if ! brain_audit_result="$(invoke_brain_doctor_audit "$run_id" "$started_at" "$completed_at")"; then
    completed_at="$(iso_now)"
    message="Doctor verified bash and Brain MCP but failed to write the required Brain audit."
    report_path="$(write_doctor_incident_report "$run_id" "$started_at" "$completed_at" "$stage" "$message")"
    print_doctor_report "$report_path" ""
    return 1
  fi

  print_doctor_report "" "$brain_audit_result"
}

run_runtime_preflight_route() {
  local entry_surface="${1:-explicit_runtime_preflight}"
  local route_name="${2:-runtime_preflight}"
  local trace_id
  local route_started_ms
  local route_entrypoint
  local control_plane_kind
  local status=0

  [[ -f "$RUNTIME_PREFLIGHT_SCRIPT" ]] || die "Runtime preflight script is missing: $RUNTIME_PREFLIGHT_SCRIPT"
  command -v node >/dev/null 2>&1 || die "node is not installed or not on PATH."

  local -a args
  args=("$RUNTIME_PREFLIGHT_SCRIPT" "--repo-root" "$REPO_ROOT" "--launch-mode" "$MODE")
  if $OUTPUT_JSON; then
    args+=("--json")
  fi

  trace_id="$(new_uuid)"
  route_started_ms="$(epoch_ms_now)"
  route_entrypoint="${ADF_ENTRYPOINT:-adf.sh}"
  control_plane_kind="${ADF_CONTROL_PLANE_KIND:-direct-bash}"

  set +e
  ADF_ENTRYPOINT="${ADF_ENTRYPOINT:-adf.sh}" \
  ADF_CONTROL_PLANE_KIND="${ADF_CONTROL_PLANE_KIND:-direct-bash}" \
  node "${args[@]}"
  status=$?
  set -e

  if [[ $status -ne 0 ]]; then
    emit_launcher_route_metric \
      "$trace_id" \
      "$route_name" \
      "$entry_surface" \
      "$route_entrypoint" \
      "$control_plane_kind" \
      "launcher_runtime_preflight" \
      "false" \
      "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
      "route" \
      "runtime-preflight" \
      "failed" \
      "runtime_preflight_failed" \
      "Runtime preflight exited with status $status."
    return $status
  fi

  emit_launcher_route_metric \
    "$trace_id" \
    "$route_name" \
    "$entry_surface" \
    "$route_entrypoint" \
    "$control_plane_kind" \
    "launcher_runtime_preflight" \
    "true" \
    "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
    "route" \
    "runtime-preflight" \
    "passed"
}

assert_runtime_preflight() {
  [[ -f "$RUNTIME_PREFLIGHT_SCRIPT" ]] || die "Runtime preflight script is missing: $RUNTIME_PREFLIGHT_SCRIPT"
  command -v node >/dev/null 2>&1 || die "node is not installed or not on PATH."
  ADF_ENTRYPOINT="${ADF_ENTRYPOINT:-adf.sh}" \
  ADF_CONTROL_PLANE_KIND="${ADF_CONTROL_PLANE_KIND:-direct-bash}" \
  node "$RUNTIME_PREFLIGHT_SCRIPT" --repo-root "$REPO_ROOT" --launch-mode "$MODE" --assert-only
}

print_install_report() {
  local entry

  echo "ADF install/bootstrap"
  if [[ ${#DOCTOR_REPAIR_LINES[@]} -eq 0 ]]; then
    echo "[PASS] No install/bootstrap repairs were needed."
    return
  fi

  for entry in "${DOCTOR_REPAIR_LINES[@]}"; do
    IFS="$FIELD_SEP" read -r status name detail started_at completed_at <<<"$entry"
    if [[ "$status" == "applied" ]]; then
      echo "[FIXED] $name"
    else
      echo "[FAILED] $name"
    fi
    echo "  $detail"
  done
}

run_install_route() {
  local trace_id
  local route_started_ms
  local route_entrypoint
  local control_plane_kind
  local post_install_status=0

  trace_id="$(new_uuid)"
  route_started_ms="$(epoch_ms_now)"
  route_entrypoint="${ADF_ENTRYPOINT:-adf.sh}"
  control_plane_kind="${ADF_CONTROL_PLANE_KIND:-direct-bash}"

  set_active_launcher_repair_context "$trace_id" "install" "explicit_install" "$route_entrypoint" "$control_plane_kind"
  if ! run_auto_repair_flow; then
    clear_active_launcher_repair_context
    emit_launcher_route_metric \
      "$trace_id" \
      "install" \
      "explicit_install" \
      "$route_entrypoint" \
      "$control_plane_kind" \
      "launcher_install" \
      "false" \
      "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
      "route" \
      "install" \
      "repair_failed" \
      "bounded_repair_failed" \
      "Install/bootstrap repair failed."
    die "Install/bootstrap repair failed."
  fi
  clear_active_launcher_repair_context

  echo "ADF install/bootstrap OK"
  echo ""
  run_runtime_preflight_route "install_post_repair_verify" "runtime_preflight" || post_install_status=$?
  if [[ $post_install_status -ne 0 ]]; then
    emit_launcher_route_metric \
      "$trace_id" \
      "install" \
      "explicit_install" \
      "$route_entrypoint" \
      "$control_plane_kind" \
      "launcher_install" \
      "false" \
      "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
      "route" \
      "install" \
      "post_repair_runtime_preflight_failed" \
      "post_install_runtime_preflight_failed" \
      "Install/bootstrap post-repair runtime preflight failed."
    return "$post_install_status"
  fi

  emit_launcher_route_metric \
    "$trace_id" \
    "install" \
    "explicit_install" \
    "$route_entrypoint" \
    "$control_plane_kind" \
    "launcher_install" \
    "true" \
    "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
    "route" \
    "install" \
    "repaired_and_verified"
}

run_launch_preflight() {
  local report_path="$TMP_DIR/launch-runtime-preflight-$$.json"
  local overall_status
  local trace_id
  local route_started_ms
  local route_entrypoint
  local control_plane_kind
  local repair_performed=false

  mkdir -p "$TMP_DIR"
  trace_id="$(new_uuid)"
  route_started_ms="$(epoch_ms_now)"
  route_entrypoint="${ADF_ENTRYPOINT:-adf.sh}"
  control_plane_kind="${ADF_CONTROL_PLANE_KIND:-direct-bash}"

  if ! run_with_spinner "Running preflight checks..." capture_runtime_preflight_to_file "$report_path"; then
    if [[ ! -s "$report_path" ]]; then
      emit_launcher_route_metric \
        "$trace_id" \
        "launch_preflight" \
        "normal_launch_preflight" \
        "$route_entrypoint" \
        "$control_plane_kind" \
        "launcher_launch_preflight" \
        "false" \
        "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
        "route" \
        "launch-preflight" \
        "runtime_preflight_crashed" \
        "runtime_preflight_crashed" \
        "Runtime preflight crashed before producing a report."
      die "Runtime preflight crashed before producing a report."
    fi
  fi

  overall_status="$(runtime_preflight_status "$report_path")"

  if [[ "$overall_status" != "fail" ]] && ! auto_repair_needed; then
    echo "ADF preflight OK"
    emit_launcher_route_metric \
      "$trace_id" \
      "launch_preflight" \
      "normal_launch_preflight" \
      "$route_entrypoint" \
      "$control_plane_kind" \
      "launcher_launch_preflight" \
      "true" \
      "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
      "route" \
      "launch-preflight" \
      "clean_pass"
    rm -f "$report_path"
    return 0
  fi

  if auto_repair_needed; then
    repair_performed=true
    set_active_launcher_repair_context "$trace_id" "launch_preflight" "normal_launch_preflight" "$route_entrypoint" "$control_plane_kind"
    if ! run_auto_repair_flow; then
      clear_active_launcher_repair_context
      echo ""
      print_repair_failures
      emit_launcher_route_metric \
        "$trace_id" \
        "launch_preflight" \
        "normal_launch_preflight" \
        "$route_entrypoint" \
        "$control_plane_kind" \
        "launcher_launch_preflight" \
        "false" \
        "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
        "route" \
        "launch-preflight" \
        "repair_failed" \
        "bounded_repair_failed" \
        "Bounded launch repair failed."
      rm -f "$report_path"
      return 1
    fi
    clear_active_launcher_repair_context

    if ! run_with_spinner "Running preflight checks..." capture_runtime_preflight_to_file "$report_path"; then
      if [[ ! -s "$report_path" ]]; then
        emit_launcher_route_metric \
          "$trace_id" \
          "launch_preflight" \
          "normal_launch_preflight" \
          "$route_entrypoint" \
          "$control_plane_kind" \
          "launcher_launch_preflight" \
          "false" \
          "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
          "route" \
          "launch-preflight" \
          "runtime_preflight_crashed_after_repair" \
          "runtime_preflight_crashed" \
          "Runtime preflight crashed after bounded repair."
        die "Runtime preflight crashed after bounded repair."
      fi
    fi

    overall_status="$(runtime_preflight_status "$report_path")"
  fi

  if [[ "$overall_status" == "fail" ]]; then
    echo ""
    print_launch_blockers "$report_path"
    emit_launcher_route_metric \
      "$trace_id" \
      "launch_preflight" \
      "normal_launch_preflight" \
      "$route_entrypoint" \
      "$control_plane_kind" \
      "launcher_launch_preflight" \
      "false" \
      "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
      "route" \
      "launch-preflight" \
      "$([[ "$repair_performed" == true ]] && printf 'blocked_after_repair' || printf 'blocked')" \
      "runtime_preflight_blocked" \
      "Launch preflight reported blocking failures."
    rm -f "$report_path"
    return 1
  fi

  echo "ADF preflight OK"
  emit_launcher_route_metric \
    "$trace_id" \
    "launch_preflight" \
    "normal_launch_preflight" \
    "$route_entrypoint" \
    "$control_plane_kind" \
    "launcher_launch_preflight" \
    "true" \
    "$(elapsed_ms_between "$route_started_ms" "$(epoch_ms_now)")" \
    "route" \
    "launch-preflight" \
    "$([[ "$repair_performed" == true ]] && printf 'repaired_pass' || printf 'clean_pass')"
  rm -f "$report_path"
}

launch_coo() {
  local onion_flag
  local command
  local -a command_args

  if $ONION_ENABLED; then
    onion_flag="--enable-onion"
  else
    onion_flag="--disable-onion"
  fi

  case "$MODE" in
    tsx-direct)
      command="$(local_tsx_shim "$COO_DIR")"
      command_args=("controller/cli.ts" "--scope" "$SCOPE" "$onion_flag")
      ;;
    built)
      command="node"
      command_args=("dist/COO/controller/cli.js" "--scope" "$SCOPE" "$onion_flag")
      ;;
    watch)
      command="$(local_tsx_shim "$COO_DIR")"
      command_args=("watch" "controller/cli.ts" "--scope" "$SCOPE" "$onion_flag")
      ;;
    *)
      die "Unknown mode: $MODE"
      ;;
  esac

  if [[ ${#COO_EXTRA_ARGS[@]} -gt 0 ]]; then
    command_args+=("${COO_EXTRA_ARGS[@]}")
  fi

  step "Launching COO"
  echo "  mode: $MODE"
  echo "  cwd:  $COO_DIR"
  echo "  cmd:  $command ${command_args[*]}"
  echo ""

  cd "$COO_DIR"
  exec "$command" "${command_args[@]}"
}

if $RUN_DOCTOR; then
  run_doctor
  exit $?
fi

if $RUN_INSTALL; then
  run_install_route
  exit $?
fi

if $RUN_RUNTIME_PREFLIGHT; then
  run_runtime_preflight_route
  exit $?
fi

run_launch_preflight
launch_coo

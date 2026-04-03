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
DOCTOR_INCIDENT_DIR="$REPO_ROOT/memory/doctor-incidents"
INSTALL_STATE_PATH="$REPO_ROOT/.codex/runtime/install-state.json"
TMP_DIR="$REPO_ROOT/tmp"
DEFAULT_SCOPE="assafyavnai/adf"
DOCTOR_AUDIT_SCOPE="assafyavnai/adf"
FIELD_SEP=$'\x1f'

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

new_uuid() {
  node -e "console.log(require('node:crypto').randomUUID())"
}

json_string() {
  node -e "process.stdout.write(JSON.stringify(process.argv[1] ?? ''))" "$1"
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

  DOCTOR_REPAIR_LINES+=("${status}${FIELD_SEP}${name}${FIELD_SEP}${detail}${FIELD_SEP}${started_at}${FIELD_SEP}${completed_at}")
  DOCTOR_REPAIRS_JSON+=("{\"Name\":$(json_string "$name"),\"Status\":$(json_string "$status"),\"Detail\":$(json_string "$detail"),\"StartedAt\":$(json_string "$started_at"),\"CompletedAt\":$(json_string "$completed_at")}")
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
  [[ -f "$RUNTIME_PREFLIGHT_SCRIPT" ]] || die "Runtime preflight script is missing: $RUNTIME_PREFLIGHT_SCRIPT"
  command -v node >/dev/null 2>&1 || die "node is not installed or not on PATH."

  local -a args
  args=("$RUNTIME_PREFLIGHT_SCRIPT" "--repo-root" "$REPO_ROOT" "--launch-mode" "$MODE")
  if $OUTPUT_JSON; then
    args+=("--json")
  fi

  ADF_ENTRYPOINT="${ADF_ENTRYPOINT:-adf.sh}" \
  ADF_CONTROL_PLANE_KIND="${ADF_CONTROL_PLANE_KIND:-direct-bash}" \
  node "${args[@]}"
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
  local completed_at

  reset_doctor_state
  repair_doctor_prerequisites || die "Install/bootstrap repair failed."
  completed_at="$(iso_now)"
  write_install_state "$completed_at"
  print_install_report
  echo ""
  run_runtime_preflight_route
}

run_launch_preflight() {
  step "Runtime preflight"
  if ! assert_runtime_preflight; then
    die "Runtime preflight failed. Run ./adf.sh --runtime-preflight for details or ./adf.sh --install for bounded repair."
  fi
  info "Runtime preflight passed"
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

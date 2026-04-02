#!/usr/bin/env bash
# adf.sh — Smart launcher for ADF COO interactive CLI.
# Resolves prerequisites, installs/builds only when needed, then execs COO.
#
# Usage:
#   ./adf.sh                                  Launch with defaults
#   ./adf.sh --scope org/proj                 Override Brain scope
#   ./adf.sh --no-onion                       Disable onion requirements lane
#   ./adf.sh -- --resume-last                 Pass extra flags to COO
#   ./adf.sh --scope org/proj -- --thread-id <id>
#   ./adf.sh --help
#
# Defaults:
#   scope:  assafyavnai/shippingagent
#   onion:  enabled
#
# COO is launched via `npm run dev` (tsx, no build required).
# Memory engine is auto-spawned by COO as an MCP stdio child process.
# PostgreSQL must be reachable on localhost:5432.

set -euo pipefail

# --------------------------------------------------------------------------- #
# Resolve repo root from the location of this script (not CWD).
# --------------------------------------------------------------------------- #
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

# Sanity: the repo root must contain the workspace marker.
if [[ ! -f "$REPO_ROOT/components/memory-engine/package.json" ]]; then
  echo "FATAL: Cannot find components/memory-engine/package.json under $REPO_ROOT"
  echo "       This script must live at the ADF repo root."
  exit 1
fi

# --------------------------------------------------------------------------- #
# Defaults and argument parsing.
# --------------------------------------------------------------------------- #
SCOPE="assafyavnai/shippingagent"
ONION="--enable-onion"
COO_EXTRA_ARGS=()
SHOW_HELP=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      SHOW_HELP=true
      shift
      ;;
    --scope)
      SCOPE="${2:?--scope requires a value}"
      shift 2
      ;;
    --no-onion)
      ONION="--disable-onion"
      shift
      ;;
    --)
      shift
      COO_EXTRA_ARGS+=("$@")
      break
      ;;
    *)
      echo "Unknown flag: $1  (use -- to pass flags directly to COO)"
      echo "Try: ./adf.sh --help"
      exit 1
      ;;
  esac
done

if $SHOW_HELP; then
  cat <<'EOF'
adf.sh — Smart launcher for ADF COO

WHAT IT DOES
  Checks prerequisites, installs/builds only when needed, then launches the
  COO interactive CLI in dev mode (tsx, no compile step for COO itself).

DEFAULTS
  Scope:  assafyavnai/shippingagent
  Onion:  enabled (requirements-gathering lane active)

USAGE
  ./adf.sh                                  Launch with defaults
  ./adf.sh --scope org/proj                 Override Brain scope
  ./adf.sh --no-onion                       Disable onion requirements lane
  ./adf.sh -- --resume-last                 Pass extra flags to COO CLI
  ./adf.sh --scope org/proj -- --thread-id <uuid>

COO CLI FLAGS (pass after --)
  --resume-last           Resume the most recently modified thread
  --thread-id <uuid>      Resume a specific thread
  --test-proof-mode       Use deterministic LLM stubs (requires env var)
  --disable-onion         Disable onion (same as --no-onion before --)

EXAMPLES
  ./adf.sh
  ./adf.sh --scope myorg/myproject
  ./adf.sh --no-onion -- --resume-last
  ./adf.sh -- --thread-id 82cd8901-61ab-451d-9b71-d1fa228def69

EOF
  exit 0
fi

# --------------------------------------------------------------------------- #
# Helpers.
# --------------------------------------------------------------------------- #
info()  { echo "  [ok]  $*"; }
warn()  { echo "  [!!]  $*"; }
step()  { echo ""; echo "--- $* ---"; }
die()   { echo ""; echo "FATAL: $*" >&2; exit 1; }

# Check whether npm install is needed for a given package directory.
# Returns 0 (true = needs install) when:
#   - node_modules/ does not exist, OR
#   - package-lock.json is newer than node_modules/.package-lock.json
#     (npm writes .package-lock.json inside node_modules on every install)
needs_npm_install() {
  local pkg_dir="$1"
  local nm="$pkg_dir/node_modules"
  local marker="$nm/.package-lock.json"

  if [[ ! -d "$nm" ]]; then
    return 0   # needs install
  fi
  if [[ ! -f "$marker" ]]; then
    return 0   # needs install
  fi
  if [[ "$pkg_dir/package-lock.json" -nt "$marker" ]]; then
    return 0   # lock file changed since last install
  fi
  return 1     # up to date
}

# Check whether the memory engine dist is stale or missing.
# Returns 0 (true = needs build) when:
#   - dist/server.js does not exist, OR
#   - any .ts source file under src/ is newer than dist/server.js
needs_me_build() {
  local me_dir="$1"
  local artifact="$me_dir/dist/server.js"

  if [[ ! -f "$artifact" ]]; then
    return 0   # needs build
  fi

  # If any src .ts file is newer than the build artifact, rebuild.
  local newer
  newer=$(find "$me_dir/src" -name '*.ts' -newer "$artifact" 2>/dev/null | head -1)
  if [[ -n "$newer" ]]; then
    return 0   # source changed
  fi
  return 1     # up to date
}

# --------------------------------------------------------------------------- #
# 1. Required commands.
# --------------------------------------------------------------------------- #
step "Checking required commands"

for cmd in node npm; do
  if ! command -v "$cmd" &>/dev/null; then
    die "$cmd is not installed or not on PATH."
  fi
  info "$cmd  $(command -v "$cmd")"
done

# --------------------------------------------------------------------------- #
# 2. Optional commands (useful warnings).
# --------------------------------------------------------------------------- #
step "Checking optional commands"

for cmd in codex claude pg_isready; do
  if command -v "$cmd" &>/dev/null; then
    info "$cmd  $(command -v "$cmd")"
  else
    warn "$cmd not found (optional but useful)"
  fi
done

# --------------------------------------------------------------------------- #
# 3. PostgreSQL reachability.
# --------------------------------------------------------------------------- #
step "Checking PostgreSQL"

if command -v pg_isready &>/dev/null; then
  if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
    info "PostgreSQL is accepting connections on localhost:5432"
  else
    die "PostgreSQL is NOT reachable on localhost:5432.
       Memory engine requires it. Start PostgreSQL and try again.
       (Connection string: \${DB_APP_URL:-postgresql://brain_user:***@localhost:5432/project_brain})"
  fi
else
  warn "pg_isready not found — cannot verify PostgreSQL before launch."
  warn "If DB is down, COO will start but memory operations will fail."
fi

# --------------------------------------------------------------------------- #
# 4. Memory engine: npm install if needed.
# --------------------------------------------------------------------------- #
ME_DIR="$REPO_ROOT/components/memory-engine"

step "Checking memory-engine dependencies"

if needs_npm_install "$ME_DIR"; then
  echo "  ...  Running npm install in components/memory-engine/"
  (cd "$ME_DIR" && npm install --no-fund --no-audit) || die "npm install failed in memory-engine"
  info "memory-engine dependencies installed"
else
  info "memory-engine node_modules up to date — skipped"
fi

# --------------------------------------------------------------------------- #
# 5. Memory engine: build if needed.
#    COO auto-spawns the memory engine as a child process, but it needs
#    components/memory-engine/dist/server.js to exist.
# --------------------------------------------------------------------------- #
step "Checking memory-engine build"

if needs_me_build "$ME_DIR"; then
  echo "  ...  Building memory-engine (tsc)"
  (cd "$ME_DIR" && npm run build) || die "memory-engine build failed"
  info "memory-engine built"
else
  info "memory-engine dist up to date — skipped"
fi

# --------------------------------------------------------------------------- #
# 6. COO: npm install if needed.
#    COO dev mode uses tsx (a devDependency), so node_modules must exist.
#    No separate build is needed — tsx runs TypeScript directly.
# --------------------------------------------------------------------------- #
COO_DIR="$REPO_ROOT/COO"

step "Checking COO dependencies"

if needs_npm_install "$COO_DIR"; then
  echo "  ...  Running npm install in COO/"
  (cd "$COO_DIR" && npm install --no-fund --no-audit) || die "npm install failed in COO"
  info "COO dependencies installed"
else
  info "COO node_modules up to date — skipped"
fi

# --------------------------------------------------------------------------- #
# 7. Verify critical artifacts exist before launch.
# --------------------------------------------------------------------------- #
step "Final preflight"

[[ -f "$ME_DIR/dist/server.js" ]] \
  || die "components/memory-engine/dist/server.js missing after build step"

[[ -d "$ME_DIR/node_modules/@modelcontextprotocol/sdk/dist/esm/client" ]] \
  || die "MCP SDK client not found in memory-engine node_modules"

[[ -d "$COO_DIR/node_modules/tsx" ]] \
  || die "tsx not found in COO node_modules"

info "All preflight checks passed"

# --------------------------------------------------------------------------- #
# 8. Launch COO.
# --------------------------------------------------------------------------- #
step "Launching COO"

COO_CMD=(npm run dev -- --scope "$SCOPE" "$ONION" "${COO_EXTRA_ARGS[@]+"${COO_EXTRA_ARGS[@]}"}")

echo "  cwd:  $COO_DIR"
echo "  cmd:  ${COO_CMD[*]}"
echo ""

# exec replaces this shell so ctrl+c goes straight to the COO process.
cd "$COO_DIR"
exec "${COO_CMD[@]}"

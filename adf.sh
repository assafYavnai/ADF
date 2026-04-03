#!/usr/bin/env bash
# adf.sh — Smart launcher for ADF COO.
# Default mode is a stable interactive REPL launch.
# Watch mode is available explicitly via --watch.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

if [[ ! -f "$REPO_ROOT/components/memory-engine/package.json" ]]; then
  echo "FATAL: Cannot find components/memory-engine/package.json under $REPO_ROOT"
  echo "       This script must live at the ADF repo root."
  exit 1
fi

SCOPE="assafyavnai/shippingagent"
ONION_ENABLED=true
MODE="tsx-direct"
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
  Checks prerequisites, installs/builds only when needed, then launches
  the COO CLI in a stable interactive mode by default.

DEFAULTS
  Scope:  assafyavnai/shippingagent
  Onion:  enabled
  Mode:   tsx-direct

MODES
  default / --tsx-direct
      Stable interactive launch:
      npx tsx controller/cli.ts ...

  --built
      Build COO if needed, then run compiled JS:
      node dist/COO/controller/cli.js ...

  --watch
      Development watch mode:
      npm run dev -- ...
      Note: this uses `tsx watch` and is not recommended for normal REPL use.

USAGE
  ./adf.sh
  ./adf.sh --scope org/proj
  ./adf.sh --no-onion
  ./adf.sh --watch
  ./adf.sh --built
  ./adf.sh -- --resume-last
  ./adf.sh --scope org/proj -- --thread-id <uuid>

COO CLI FLAGS (pass after --)
  --resume-last
  --thread-id <uuid>
  --test-proof-mode
  --enable-onion
  --disable-onion
EOF
  exit 0
fi

info()  { echo "  [ok]  $*"; }
warn()  { echo "  [!!]  $*"; }
step()  { echo ""; echo "--- $* ---"; }
die()   { echo ""; echo "FATAL: $*" >&2; exit 1; }

needs_npm_install() {
  local pkg_dir="$1"
  local nm="$pkg_dir/node_modules"
  local marker="$nm/.package-lock.json"
  [[ ! -d "$nm" ]] && return 0
  [[ ! -f "$marker" ]] && return 0
  [[ "$pkg_dir/package-lock.json" -nt "$marker" ]] && return 0
  return 1
}

needs_me_build() {
  local me_dir="$1"
  local artifact="$me_dir/dist/server.js"
  [[ ! -f "$artifact" ]] && return 0
  local newer
  newer=$(find "$me_dir/src" -name '*.ts' -newer "$artifact" 2>/dev/null | head -1 || true)
  [[ -n "$newer" ]] && return 0
  return 1
}

needs_coo_build() {
  local coo_dir="$1"
  local artifact="$coo_dir/dist/COO/controller/cli.js"
  [[ ! -f "$artifact" ]] && return 0
  local newer
  newer=$(find "$coo_dir" -maxdepth 3 -name '*.ts' -newer "$artifact" 2>/dev/null | head -1 || true)
  [[ -n "$newer" ]] && return 0
  return 1
}

step "Checking required commands"
for cmd in node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    die "$cmd is not installed or not on PATH."
  fi
  info "$cmd  $(command -v "$cmd")"
done

step "Checking optional commands"
for cmd in codex claude pg_isready; do
  if command -v "$cmd" >/dev/null 2>&1; then
    info "$cmd  $(command -v "$cmd")"
  else
    warn "$cmd not found (optional but useful)"
  fi
done

step "Checking PostgreSQL"
if command -v pg_isready >/dev/null 2>&1; then
  if pg_isready -h localhost -p 5432 -q 2>/dev/null; then
    info "PostgreSQL is accepting connections on localhost:5432"
  else
    die "PostgreSQL is NOT reachable on localhost:5432. Memory engine requires it. Start PostgreSQL and try again."
  fi
else
  warn "pg_isready not found — cannot verify PostgreSQL before launch."
  warn "If DB is down, COO will start but memory operations will fail."
fi

ME_DIR="$REPO_ROOT/components/memory-engine"
COO_DIR="$REPO_ROOT/COO"

step "Checking memory-engine dependencies"
if needs_npm_install "$ME_DIR"; then
  echo "  ...  Running npm install in components/memory-engine/"
  (cd "$ME_DIR" && npm install --no-fund --no-audit) || die "npm install failed in memory-engine"
  info "memory-engine dependencies installed"
else
  info "memory-engine node_modules up to date — skipped"
fi

step "Checking memory-engine build"
if needs_me_build "$ME_DIR"; then
  echo "  ...  Building memory-engine (tsc)"
  (cd "$ME_DIR" && npm run build) || die "memory-engine build failed"
  info "memory-engine built"
else
  info "memory-engine dist up to date — skipped"
fi

step "Checking COO dependencies"
if needs_npm_install "$COO_DIR"; then
  echo "  ...  Running npm install in COO/"
  (cd "$COO_DIR" && npm install --no-fund --no-audit) || die "npm install failed in COO"
  info "COO dependencies installed"
else
  info "COO node_modules up to date — skipped"
fi

step "Final preflight"
[[ -f "$ME_DIR/dist/server.js" ]] || die "components/memory-engine/dist/server.js missing after build step"
[[ -d "$ME_DIR/node_modules/@modelcontextprotocol/sdk/dist/esm/client" ]] || die "MCP SDK client not found in memory-engine node_modules"

if [[ "$MODE" == "tsx-direct" || "$MODE" == "watch" ]]; then
  [[ -d "$COO_DIR/node_modules/tsx" ]] || die "tsx not found in COO node_modules"
fi

if [[ "$MODE" == "built" ]]; then
  if needs_coo_build "$COO_DIR"; then
    step "Checking COO build"
    echo "  ...  Building COO (tsc)"
    (cd "$COO_DIR" && npm run build) || die "COO build failed"
    info "COO built"
  else
    info "COO dist up to date — skipped"
  fi
  [[ -f "$COO_DIR/dist/COO/controller/cli.js" ]] || die "COO built entrypoint missing: dist/COO/controller/cli.js"
fi

info "All preflight checks passed"

step "Launching COO"
if $ONION_ENABLED; then
  ONION_FLAG="--enable-onion"
else
  ONION_FLAG="--disable-onion"
fi

case "$MODE" in
  tsx-direct)
    COO_CMD=(npx tsx controller/cli.ts --scope "$SCOPE" "$ONION_FLAG")
    ;;
  built)
    COO_CMD=(node dist/COO/controller/cli.js --scope "$SCOPE" "$ONION_FLAG")
    ;;
  watch)
    COO_CMD=(npm run dev -- --scope "$SCOPE" "$ONION_FLAG")
    ;;
  *)
    die "Unknown mode: $MODE"
    ;;
esac

if [[ ${#COO_EXTRA_ARGS[@]} -gt 0 ]]; then
  COO_CMD+=("${COO_EXTRA_ARGS[@]}")
fi

echo "  mode: $MODE"
echo "  cwd:  $COO_DIR"
echo "  cmd:  ${COO_CMD[*]}"
echo ""

cd "$COO_DIR"
exec "${COO_CMD[@]}"

#!/usr/bin/env bash
# Development helper script for UGM-AICare
# Primary: ./run_dev.sh local  - Run backend + frontend locally (fast iteration)
# Docker:  ./run_dev.sh prod   - Simulate production Docker deployment

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ─────────────────────────────────────────────────────────────────────────────
# Global State
# ─────────────────────────────────────────────────────────────────────────────

BACKEND_PID=""
FRONTEND_PID=""
DOCS_PID=""
CLEANUP_DONE=false
PID_FILE="$PROJECT_DIR/.dev-pids"

# ─────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ─────────────────────────────────────────────────────────────────────────────

log_info()  { echo -e "\033[0;34m[INFO]\033[0m  $*"; }
log_ok()    { echo -e "\033[0;32m[OK]\033[0m    $*"; }
log_warn()  { echo -e "\033[0;33m[WARN]\033[0m  $*" >&2; }
log_error() { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; }

is_windows_shell() {
  [[ "${OSTYPE:-}" == "msys" || "${OSTYPE:-}" == "cygwin" || "${OSTYPE:-}" == "win32" ]]
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

trim_ws() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

parse_env_line() {
  local line
  line="$(trim_ws "$1")"
  [[ -z "$line" || "${line:0:1}" == "#" ]] && return 1

  if [[ "$line" == export* ]]; then
    line="$(trim_ws "${line#export}")"
  fi

  [[ "$line" != *"="* ]] && return 1

  local key="${line%%=*}"
  local value="${line#*=}"
  key="$(trim_ws "$key")"
  value="$(trim_ws "$value")"

  if [[ "$value" == "\""*"\"" || "$value" == "'"*"'" ]]; then
    value="${value:1:${#value}-2}"
  else
    value="${value%%#*}"
    value="$(trim_ws "$value")"
  fi

  [[ -z "$key" ]] && return 1
  printf '%s\n' "$key" "$value"
}

load_env_file() {
  local env_file="$1"
  if [[ -f "$env_file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      local parsed
      parsed="$(parse_env_line "$line")" || continue
      local key
      local value
      key="${parsed%%$'\n'*}"
      value="${parsed#*$'\n'}"
      export "$key=$value"
    done < "$env_file"
  else
    log_warn "Env file not found at $env_file"
  fi
}

read_env_var() {
  local env_file="$1"
  local var_name="$2"
  local default_value="$3"

  if [[ -f "$env_file" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      local parsed
      parsed="$(parse_env_line "$line")" || continue
      local key
      local value
      key="${parsed%%$'\n'*}"
      value="${parsed#*$'\n'}"
      if [[ "$key" == "$var_name" ]]; then
        printf '%s' "$value"
        return 0
      fi
    done < "$env_file"
  fi

  printf '%s' "$default_value"
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker not found. Install Docker Desktop."
    exit 1
  fi
  if ! docker info >/dev/null 2>&1; then
    log_error "Docker is not running. Start Docker Desktop."
    exit 1
  fi
}

resolve_python() {
  # Prioritize workspace root venv (where dependencies are installed)
  local candidates=(
    "$PROJECT_DIR/../.venv/Scripts/python.exe"
    "$PROJECT_DIR/.venv/Scripts/python.exe"
    "$PROJECT_DIR/backend/.venv/Scripts/python.exe"
  )
  for candidate in "${candidates[@]}"; do
    [[ -x "$candidate" ]] && echo "$candidate" && return 0
  done
  command -v python3 2>/dev/null || command -v python 2>/dev/null || return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Process Management
# ─────────────────────────────────────────────────────────────────────────────

save_pids() {
  echo "BACKEND_PID=$BACKEND_PID" > "$PID_FILE"
  echo "FRONTEND_PID=$FRONTEND_PID" >> "$PID_FILE"
  echo "DOCS_PID=$DOCS_PID" >> "$PID_FILE"
  echo "PARENT_PID=$$" >> "$PID_FILE"
}

kill_process_tree() {
  local pid="$1"
  local name="${2:-process}"

  if [[ -z "$pid" || "$pid" == "0" ]]; then
    return 0
  fi

  # Check if process exists
  if ! kill -0 "$pid" 2>/dev/null; then
    return 0
  fi

  log_info "Stopping $name (PID: $pid)..."

  # On Windows (Git Bash/MSYS), use taskkill for reliable termination
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # First try graceful termination
    taskkill //PID "$pid" //T 2>/dev/null || true
    sleep 1
    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
      taskkill //F //PID "$pid" //T 2>/dev/null || true
    fi
  else
    # Unix: Send SIGTERM to process group
    kill -TERM "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true

    # Wait briefly for graceful shutdown
    local timeout=5
    while kill -0 "$pid" 2>/dev/null && ((timeout-- > 0)); do
      sleep 1
    done

    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
      log_warn "$name didn't stop gracefully, force killing..."
      kill -KILL "-$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
  fi
}

kill_port_processes() {
  local port="$1"

  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows: Use netstat + taskkill
    local pids
    pids=$(netstat -ano 2>/dev/null | grep ":${port} " | grep "LISTENING" | awk '{print $5}' | sort -u | grep -v "^0$" || true)
    for pid in $pids; do
      if [[ -n "$pid" && "$pid" != "0" ]]; then
        log_info "Killing process $pid on port $port"
        taskkill //F //PID "$pid" 2>/dev/null || true
      fi
    done
  else
    # Unix: Use lsof or fuser
    if command -v lsof >/dev/null 2>&1; then
      lsof -ti ":$port" | xargs -r kill -9 2>/dev/null || true
    elif command -v fuser >/dev/null 2>&1; then
      fuser -k "$port/tcp" 2>/dev/null || true
    fi
  fi
}

cleanup_all() {
  # Prevent multiple cleanup runs
  if [[ "$CLEANUP_DONE" == "true" ]]; then
    return 0
  fi
  CLEANUP_DONE=true

  echo ""
  log_info "Shutting down development servers..."

  # Kill tracked processes
  if [[ -n "$BACKEND_PID" ]]; then
    kill_process_tree "$BACKEND_PID" "backend"
  fi

  if [[ -n "$FRONTEND_PID" ]]; then
    kill_process_tree "$FRONTEND_PID" "frontend"
  fi

  if [[ -n "$DOCS_PID" ]]; then
    kill_process_tree "$DOCS_PID" "docusaurus"
  fi

  # Clean up PID file
  rm -f "$PID_FILE" 2>/dev/null || true

  # Kill any orphaned processes on the ports (safety net)
  local backend_port="${BACKEND_EXTERNAL_PORT:-22001}"
  local frontend_port="${FRONTEND_EXTERNAL_PORT:-22000}"
  local docs_port="${DOCS_EXTERNAL_PORT:-22002}"
  kill_port_processes "$backend_port"
  kill_port_processes "$frontend_port"
  kill_port_processes "$docs_port"

  log_ok "Cleanup complete."
}

cleanup_stale_processes() {
  # Check for and clean up processes from previous runs
  if [[ -f "$PID_FILE" ]]; then
    log_info "Found PID file from previous run, cleaning up..."
    source "$PID_FILE" 2>/dev/null || true

    if [[ -n "${BACKEND_PID:-}" ]]; then
      kill_process_tree "$BACKEND_PID" "stale backend" 2>/dev/null || true
    fi
    if [[ -n "${FRONTEND_PID:-}" ]]; then
      kill_process_tree "$FRONTEND_PID" "stale frontend" 2>/dev/null || true
    fi
    if [[ -n "${DOCS_PID:-}" ]]; then
      kill_process_tree "$DOCS_PID" "stale docusaurus" 2>/dev/null || true
    fi

    rm -f "$PID_FILE"

    # Reset our tracking
    BACKEND_PID=""
    FRONTEND_PID=""
    DOCS_PID=""
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Signal Handlers
# ─────────────────────────────────────────────────────────────────────────────

setup_signal_handlers() {
  # Handle various termination signals
  trap 'cleanup_all; exit 0' EXIT
  trap 'cleanup_all; exit 130' INT      # Ctrl+C
  trap 'cleanup_all; exit 143' TERM     # kill command
  trap 'cleanup_all; exit 1' HUP        # Terminal closed
  trap 'cleanup_all; exit 1' PIPE       # Broken pipe

  # Handle errors
  trap 'log_error "Script error on line $LINENO"; cleanup_all; exit 1' ERR
}

# ─────────────────────────────────────────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────────────────────────────────────────

wait_for_server() {
  local url="$1"
  local name="$2"
  local max_attempts="${3:-30}"
  local attempt=0

  log_info "Waiting for $name to be ready..."

  while ((attempt < max_attempts)); do
    if curl -s -o /dev/null -w "" "$url" 2>/dev/null; then
      log_ok "$name is ready at $url"
      return 0
    fi
    ((attempt++))
    sleep 1
  done

  log_warn "$name health check timed out (may still be starting)"
  return 1
}

monitor_processes() {
  # Monitor child processes and exit if either dies unexpectedly
  while true; do
    sleep 2

    # Check if backend is still running
    if [[ -n "$BACKEND_PID" ]] && ! kill -0 "$BACKEND_PID" 2>/dev/null; then
      log_error "Backend process died unexpectedly!"
      cleanup_all
      exit 1
    fi

    # Check if frontend is still running
    if [[ -n "$FRONTEND_PID" ]] && ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
      log_error "Frontend process died unexpectedly!"
      cleanup_all
      exit 1
    fi

    # Check if docs is still running
    if [[ -n "$DOCS_PID" ]] && ! kill -0 "$DOCS_PID" 2>/dev/null; then
      log_error "Docusaurus process died unexpectedly!"
      cleanup_all
      exit 1
    fi
  done
}

# ─────────────────────────────────────────────────────────────────────────────
# LOCAL: Run backend + frontend + docs directly (no Docker)
# ─────────────────────────────────────────────────────────────────────────────

run_local() {
  # Set up signal handlers first
  setup_signal_handlers

  # Clean up any stale processes from previous runs
  cleanup_stale_processes

  local backend_env_file="$PROJECT_DIR/backend/.env"
  local frontend_env_file="$PROJECT_DIR/frontend/.env.local"
  local docs_env_file="$PROJECT_DIR/docs-site/.env"

  local backend_port
  local frontend_port
  local docs_port
  backend_port="$(read_env_var "$backend_env_file" "PORT" "${BACKEND_EXTERNAL_PORT:-22001}")"
  frontend_port="$(read_env_var "$frontend_env_file" "PORT" "${FRONTEND_EXTERNAL_PORT:-22000}")"
  docs_port="$(read_env_var "$docs_env_file" "PORT" "${DOCS_EXTERNAL_PORT:-22002}")"

  local backend_origin="http://localhost:${backend_port}"
  local frontend_origin="http://localhost:${frontend_port}"
  local docs_origin="http://localhost:${docs_port}"

  # Rewrite Docker URLs to localhost
  rewrite_url() {
    local val="${1:-}" fallback="${2:-}"
    [[ -z "$val" || "$val" == *"://backend"* || "$val" == *"://frontend"* ]] && echo "$fallback" || echo "$val"
  }

  # Validate Python
  local python_bin
  if ! python_bin="$(resolve_python)"; then
    log_error "Python not found. Install Python 3."
    exit 1
  fi

  if ! "$python_bin" -c "import uvicorn" >/dev/null 2>&1; then
    log_error "Backend dependencies missing. Run:"
    echo "   $python_bin -m pip install -r backend/requirements.txt"
    exit 1
  fi

  # Validate npm
  if ! command -v npm >/dev/null 2>&1; then
    log_error "npm not found. Install Node.js."
    exit 1
  fi

  if [[ ! -d "$PROJECT_DIR/docs-site" ]]; then
    log_error "docs-site directory not found at $PROJECT_DIR/docs-site"
    exit 1
  fi

  # Set Windows console to UTF-8 mode if on Windows (for emoji support in logs)
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
    chcp.com 65001 >/dev/null 2>&1 || true
  fi

  # Kill any existing processes on the ports
  log_info "Cleaning up any existing processes on ports ${backend_port}, ${frontend_port}, and ${docs_port}..."
  kill_port_processes "$backend_port"
  kill_port_processes "$frontend_port"
  kill_port_processes "$docs_port"

  # Brief pause to ensure ports are released
  sleep 1

  echo ""
  echo "┌─────────────────────────────────────────┐"
  echo "│  LOCAL Development Mode                 │"
  echo "├─────────────────────────────────────────┤"
  echo "│  Backend:  http://localhost:${backend_port}      │"
  echo "│  Frontend: http://localhost:${frontend_port}      │"
  echo "│  Docs:     http://localhost:${docs_port}      │"
  echo "├─────────────────────────────────────────┤"
  echo "│  Press Ctrl+C to stop all servers       │"
  echo "└─────────────────────────────────────────┘"
  echo ""

  # Check if --separate-terminals flag is passed
  local use_separate_terminals=false
  if [[ "${1:-}" == "--separate" ]]; then
    use_separate_terminals=true
  fi

  if [[ "$use_separate_terminals" == "true" ]]; then
    run_separate_terminals "$python_bin" "$backend_port" "$frontend_port" "$docs_port" "$backend_env_file" "$frontend_env_file" "$docs_env_file" "$backend_origin" "$frontend_origin" "$docs_origin"
  else
    run_inline "$python_bin" "$backend_port" "$frontend_port" "$docs_port" "$backend_env_file" "$frontend_env_file" "$docs_env_file" "$backend_origin" "$frontend_origin" "$docs_origin"
  fi
}

run_inline() {
  local python_bin="$1"
  local backend_port="$2"
  local frontend_port="$3"
  local docs_port="$4"
  local backend_env_file="$5"
  local frontend_env_file="$6"
  local docs_env_file="$7"
  local backend_origin="$8"
  local frontend_origin="$9"
  local docs_origin="${10}"

  log_info "Starting servers in current terminal..."
  echo ""

  # Start backend in background with process group
  (
    cd "$PROJECT_DIR/backend"
    load_env_file "$backend_env_file"
    export INTERNAL_API_URL="$(rewrite_url "${INTERNAL_API_URL:-}" "$backend_origin")"
    export NEXT_PUBLIC_API_URL="$(rewrite_url "${NEXT_PUBLIC_API_URL:-}" "$backend_origin")"
    export NEXT_PUBLIC_BACKEND_BASE="$(rewrite_url "${NEXT_PUBLIC_BACKEND_BASE:-}" "$backend_origin")"
    export BACKEND_URL="$(rewrite_url "${BACKEND_URL:-}" "$backend_origin")"
    export FRONTEND_URL="$(rewrite_url "${FRONTEND_URL:-}" "$frontend_origin")"
    export NEXTAUTH_URL="$(rewrite_url "${NEXTAUTH_URL:-}" "$frontend_origin")"
    export COOKIE_SECURE="${COOKIE_SECURE:-false}"
    export COOKIE_SAMESITE="${COOKIE_SAMESITE:-lax}"

    # Enable UTF-8 mode for Python (fixes emoji logging on Windows)
    export PYTHONUTF8=1
    export PYTHONIOENCODING=utf-8

    exec "$python_bin" -m uvicorn app.main:app --host 127.0.0.1 --port "$backend_port" --reload
  ) &
  BACKEND_PID=$!
  log_ok "Backend started (PID: $BACKEND_PID)"

  # Brief delay to let backend start binding
  sleep 2

  # Start frontend in background with process group
  (
    cd "$PROJECT_DIR/frontend"
    load_env_file "$frontend_env_file"
    export INTERNAL_API_URL="$(rewrite_url "${INTERNAL_API_URL:-}" "$backend_origin")"
    export NEXT_PUBLIC_API_URL="$(rewrite_url "${NEXT_PUBLIC_API_URL:-}" "$backend_origin")"
    export NEXT_PUBLIC_BACKEND_BASE="$(rewrite_url "${NEXT_PUBLIC_BACKEND_BASE:-}" "$backend_origin")"
    export BACKEND_URL="$(rewrite_url "${BACKEND_URL:-}" "$backend_origin")"
    export NEXTAUTH_URL="$(rewrite_url "${NEXTAUTH_URL:-}" "$frontend_origin")"

    exec npm run dev -- -p "$frontend_port"
  ) &
  FRONTEND_PID=$!
  log_ok "Frontend started (PID: $FRONTEND_PID)"

  # Brief delay to let frontend start binding
  sleep 2

  # Start docusaurus docs in background with process group
  (
    cd "$PROJECT_DIR/docs-site"
    load_env_file "$docs_env_file"
    export INTERNAL_API_URL="$(rewrite_url "${INTERNAL_API_URL:-}" "$backend_origin")"
    export NEXT_PUBLIC_API_URL="$(rewrite_url "${NEXT_PUBLIC_API_URL:-}" "$backend_origin")"
    export NEXT_PUBLIC_BACKEND_BASE="$(rewrite_url "${NEXT_PUBLIC_BACKEND_BASE:-}" "$backend_origin")"

    exec npm run start -- --port "$docs_port" --host 127.0.0.1
  ) &
  DOCS_PID=$!
  log_ok "Docusaurus started (PID: $DOCS_PID)"

  # Save PIDs for recovery
  save_pids

  echo ""
  log_info "All servers are starting..."
  log_info "Logs will appear below. Press Ctrl+C to stop."
  echo ""

  # Monitor processes - this blocks until something goes wrong or we're interrupted
  monitor_processes
}

run_separate_terminals() {
  local python_bin="$1"
  local backend_port="$2"
  local frontend_port="$3"
  local docs_port="$4"
  local backend_env_file="$5"
  local frontend_env_file="$6"
  local docs_env_file="$7"
  local backend_origin="$8"
  local frontend_origin="$9"
  local docs_origin="${10}"

  log_info "Starting servers in separate terminals..."

  # Prefer Windows Terminal (wt) when available.
  if is_windows_shell && (has_cmd wt.exe || has_cmd wt); then
    local backend_script
    local frontend_script
    local docs_script
    backend_script=$(mktemp --suffix=.sh)
    frontend_script=$(mktemp --suffix=.sh)
    docs_script=$(mktemp --suffix=.sh)

    local venv_activate=""
    if [[ -f "$PROJECT_DIR/../.venv/Scripts/activate" ]]; then
      venv_activate="$PROJECT_DIR/../.venv/Scripts/activate"
    elif [[ -f "$PROJECT_DIR/.venv/Scripts/activate" ]]; then
      venv_activate="$PROJECT_DIR/.venv/Scripts/activate"
    elif [[ -f "$PROJECT_DIR/backend/.venv/Scripts/activate" ]]; then
      venv_activate="$PROJECT_DIR/backend/.venv/Scripts/activate"
    fi

    cat > "$backend_script" <<EOF
#!/usr/bin/env bash
cd "$PROJECT_DIR/backend"
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8
chcp.com 65001 2>/dev/null || true

cleanup() {
  echo ""
  echo "Shutting down backend..."
  pkill -P \$\$ 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM HUP

if [[ -f "$backend_env_file" ]]; then
  set -a
  source "$backend_env_file"
  set +a
fi

rewrite_url() {
  local val="${1:-}" fallback="${2:-}"
  [[ -z "$val" || "$val" == *"://backend"* || "$val" == *"://frontend"* ]] && echo "$fallback" || echo "$val"
}

export INTERNAL_API_URL="$(rewrite_url "${INTERNAL_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_API_URL="$(rewrite_url "${NEXT_PUBLIC_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_BACKEND_BASE="$(rewrite_url "${NEXT_PUBLIC_BACKEND_BASE:-}" "$backend_origin")"
export BACKEND_URL="$(rewrite_url "${BACKEND_URL:-}" "$backend_origin")"
export FRONTEND_URL="$(rewrite_url "${FRONTEND_URL:-}" "$frontend_origin")"
export NEXTAUTH_URL="$(rewrite_url "${NEXTAUTH_URL:-}" "$frontend_origin")"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
export COOKIE_SAMESITE="${COOKIE_SAMESITE:-lax}"

if [[ -f "$venv_activate" ]]; then
  source "$venv_activate"
  echo "Virtual environment activated"
fi

echo ""
echo "UGM-AICare Backend Server"
echo "=============================="
echo "URL: http://localhost:${backend_port}"
echo ""
python -m uvicorn app.main:app --host 127.0.0.1 --port "$backend_port" --reload
EOF

    cat > "$frontend_script" <<EOF
#!/usr/bin/env bash
cd "$PROJECT_DIR/frontend"
chcp.com 65001 2>/dev/null || true

cleanup() {
  echo ""
  echo "Shutting down frontend..."
  pkill -P \$\$ 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM HUP

if [[ -f "$frontend_env_file" ]]; then
  set -a
  source "$frontend_env_file"
  set +a
fi

rewrite_url() {
  local val="${1:-}" fallback="${2:-}"
  [[ -z "$val" || "$val" == *"://backend"* || "$val" == *"://frontend"* ]] && echo "$fallback" || echo "$val"
}

export INTERNAL_API_URL="$(rewrite_url "${INTERNAL_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_API_URL="$(rewrite_url "${NEXT_PUBLIC_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_BACKEND_BASE="$(rewrite_url "${NEXT_PUBLIC_BACKEND_BASE:-}" "$backend_origin")"
export BACKEND_URL="$(rewrite_url "${BACKEND_URL:-}" "$backend_origin")"
export NEXTAUTH_URL="$(rewrite_url "${NEXTAUTH_URL:-}" "$frontend_origin")"

echo "UGM-AICare Frontend Server"
echo "=============================="
echo "URL: http://localhost:${frontend_port}"
echo ""
npm run dev -- -p "$frontend_port"
EOF

    cat > "$docs_script" <<EOF
#!/usr/bin/env bash
cd "$PROJECT_DIR/docs-site"
chcp.com 65001 2>/dev/null || true

cleanup() {
  echo ""
  echo "Shutting down docusaurus..."
  pkill -P \$\$ 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM HUP

if [[ -f "$docs_env_file" ]]; then
  set -a
  source "$docs_env_file"
  set +a
fi

rewrite_url() {
  local val="\${1:-}" fallback="\${2:-}"
  [[ -z "\$val" || "\$val" == *"://backend"* || "\$val" == *"://frontend"* ]] && echo "\$fallback" || echo "\$val"
}

export INTERNAL_API_URL="\$(rewrite_url "\${INTERNAL_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_API_URL="\$(rewrite_url "\${NEXT_PUBLIC_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_BACKEND_BASE="\$(rewrite_url "\${NEXT_PUBLIC_BACKEND_BASE:-}" "$backend_origin")"

echo "UGM-AICare Docusaurus Docs"
echo "=============================="
echo "URL: http://localhost:${docs_port}"
echo ""
npm run start -- --port "$docs_port" --host 127.0.0.1
EOF

    chmod +x "$backend_script" "$frontend_script" "$docs_script"

    # Best-effort: open in Windows Terminal. This assumes `bash` is available in PATH (Git Bash / MSYS).
    local wt_cmd=("wt.exe")
    has_cmd wt && wt_cmd=("wt")

    "${wt_cmd[@]}" -w 0 \
      new-tab --title "UGM-AICare Backend" bash "$backend_script" \; \
      new-tab --title "UGM-AICare Frontend" bash "$frontend_script" \; \
      new-tab --title "UGM-AICare Docs" bash "$docs_script" &

    BACKEND_PID=$!
    FRONTEND_PID=""
    DOCS_PID=""
    save_pids

    echo ""
    log_ok "Opened backend + frontend + docs in Windows Terminal tabs."
    log_info "To stop them: close the panes/windows, or run ./run_dev.sh stop"

    (sleep 10 && rm -f "$backend_script" "$frontend_script" "$docs_script") &
    return 0
  fi

  # On Windows (Git Bash/MSYS2), use mintty
  if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Create temporary scripts for each process
    local backend_script
    local frontend_script
    local docs_script
    backend_script=$(mktemp --suffix=.sh)
    frontend_script=$(mktemp --suffix=.sh)
    docs_script=$(mktemp --suffix=.sh)

    # Determine venv activation script path
    local venv_activate=""
    if [[ -f "$PROJECT_DIR/../.venv/Scripts/activate" ]]; then
      venv_activate="$PROJECT_DIR/../.venv/Scripts/activate"
    elif [[ -f "$PROJECT_DIR/.venv/Scripts/activate" ]]; then
      venv_activate="$PROJECT_DIR/.venv/Scripts/activate"
    elif [[ -f "$PROJECT_DIR/backend/.venv/Scripts/activate" ]]; then
      venv_activate="$PROJECT_DIR/backend/.venv/Scripts/activate"
    fi

    cat > "$backend_script" <<EOF
#!/usr/bin/env bash
cd "$PROJECT_DIR/backend"
export PYTHONUTF8=1
export PYTHONIOENCODING=utf-8
chcp.com 65001 2>/dev/null || true

cleanup() {
  echo ""
  echo "Shutting down backend..."
  pkill -P \$\$ 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM HUP

if [[ -f "$backend_env_file" ]]; then
  set -a
  source "$backend_env_file"
  set +a
fi

rewrite_url() {
  local val="${1:-}" fallback="${2:-}"
  [[ -z "$val" || "$val" == *"://backend"* || "$val" == *"://frontend"* ]] && echo "$fallback" || echo "$val"
}

export INTERNAL_API_URL="$(rewrite_url "${INTERNAL_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_API_URL="$(rewrite_url "${NEXT_PUBLIC_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_BACKEND_BASE="$(rewrite_url "${NEXT_PUBLIC_BACKEND_BASE:-}" "$backend_origin")"
export BACKEND_URL="$(rewrite_url "${BACKEND_URL:-}" "$backend_origin")"
export FRONTEND_URL="$(rewrite_url "${FRONTEND_URL:-}" "$frontend_origin")"
export NEXTAUTH_URL="$(rewrite_url "${NEXTAUTH_URL:-}" "$frontend_origin")"
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
export COOKIE_SAMESITE="${COOKIE_SAMESITE:-lax}"

if [[ -f "$venv_activate" ]]; then
  source "$venv_activate"
  echo "Virtual environment activated"
fi

echo ""
echo "UGM-AICare Backend Server"
echo "=============================="
echo "URL: http://localhost:${backend_port}"
echo ""
python -m uvicorn app.main:app --host 127.0.0.1 --port "$backend_port" --reload
EOF

    cat > "$frontend_script" <<EOF
#!/usr/bin/env bash
cd "$PROJECT_DIR/frontend"
chcp.com 65001 2>/dev/null || true

cleanup() {
  echo ""
  echo "Shutting down frontend..."
  pkill -P \$\$ 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM HUP

if [[ -f "$frontend_env_file" ]]; then
  set -a
  source "$frontend_env_file"
  set +a
fi

rewrite_url() {
  local val="${1:-}" fallback="${2:-}"
  [[ -z "$val" || "$val" == *"://backend"* || "$val" == *"://frontend"* ]] && echo "$fallback" || echo "$val"
}

export INTERNAL_API_URL="$(rewrite_url "${INTERNAL_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_API_URL="$(rewrite_url "${NEXT_PUBLIC_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_BACKEND_BASE="$(rewrite_url "${NEXT_PUBLIC_BACKEND_BASE:-}" "$backend_origin")"
export BACKEND_URL="$(rewrite_url "${BACKEND_URL:-}" "$backend_origin")"
export NEXTAUTH_URL="$(rewrite_url "${NEXTAUTH_URL:-}" "$frontend_origin")"

echo "UGM-AICare Frontend Server"
echo "=============================="
echo "URL: http://localhost:${frontend_port}"
echo ""
npm run dev -- -p "$frontend_port"
EOF

    cat > "$docs_script" <<EOF
#!/usr/bin/env bash
cd "$PROJECT_DIR/docs-site"
chcp.com 65001 2>/dev/null || true

cleanup() {
  echo ""
  echo "Shutting down docusaurus..."
  pkill -P \$\$ 2>/dev/null || true
  exit 0
}
trap cleanup EXIT INT TERM HUP

if [[ -f "$docs_env_file" ]]; then
  set -a
  source "$docs_env_file"
  set +a
fi

rewrite_url() {
  local val="\${1:-}" fallback="\${2:-}"
  [[ -z "\$val" || "\$val" == *"://backend"* || "\$val" == *"://frontend"* ]] && echo "\$fallback" || echo "\$val"
}

export INTERNAL_API_URL="\$(rewrite_url "\${INTERNAL_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_API_URL="\$(rewrite_url "\${NEXT_PUBLIC_API_URL:-}" "$backend_origin")"
export NEXT_PUBLIC_BACKEND_BASE="\$(rewrite_url "\${NEXT_PUBLIC_BACKEND_BASE:-}" "$backend_origin")"

echo "UGM-AICare Docusaurus Docs"
echo "=============================="
echo "URL: http://localhost:${docs_port}"
echo ""
npm run start -- --port "$docs_port" --host 127.0.0.1
EOF

    chmod +x "$backend_script" "$frontend_script" "$docs_script"

    # Launch in new mintty terminals
    mintty --title "UGM-AICare Backend" --exec bash "$backend_script" &
    BACKEND_PID=$!

    mintty --title "UGM-AICare Frontend" --exec bash "$frontend_script" &
    FRONTEND_PID=$!

    mintty --title "UGM-AICare Docs" --exec bash "$docs_script" &
    DOCS_PID=$!

    save_pids

    echo ""
    log_ok "Started backend, frontend, and docs in separate terminals."
    echo ""
    echo "   Backend:  http://localhost:${backend_port}"
    echo "   Frontend: http://localhost:${frontend_port}"
    echo "   Docs:     http://localhost:${docs_port}"
    echo ""
    log_info "Close the terminal windows to stop the servers."
    log_info "Or run: ./run_dev.sh stop"

    # Clean up temp scripts after a delay
    (sleep 10 && rm -f "$backend_script" "$frontend_script" "$docs_script") &

  else
    log_warn "Separate terminals not fully supported on this OS. Running inline."
    run_inline "$python_bin" "$backend_port" "$frontend_port" "$docs_port" "$backend_env_file" "$frontend_env_file" "$docs_env_file" "$backend_origin" "$frontend_origin" "$docs_origin"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# Stop Command
# ─────────────────────────────────────────────────────────────────────────────

stop_servers() {
  log_info "Stopping development servers..."

  # Load PIDs from file if exists
  if [[ -f "$PID_FILE" ]]; then
    source "$PID_FILE" 2>/dev/null || true
  fi

  local backend_env_file="$PROJECT_DIR/backend/.env"
  local frontend_env_file="$PROJECT_DIR/frontend/.env.local"
  local docs_env_file="$PROJECT_DIR/docs-site/.env"

  local backend_port
  local frontend_port
  local docs_port
  backend_port="$(read_env_var "$backend_env_file" "PORT" "${BACKEND_EXTERNAL_PORT:-22001}")"
  frontend_port="$(read_env_var "$frontend_env_file" "PORT" "${FRONTEND_EXTERNAL_PORT:-22000}")"
  docs_port="$(read_env_var "$docs_env_file" "PORT" "${DOCS_EXTERNAL_PORT:-22002}")"

  # Kill by PID first
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill_process_tree "$BACKEND_PID" "backend"
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill_process_tree "$FRONTEND_PID" "frontend"
  fi
  if [[ -n "${DOCS_PID:-}" ]]; then
    kill_process_tree "$DOCS_PID" "docusaurus"
  fi

  # Then kill by port as safety net
  kill_port_processes "$backend_port"
  kill_port_processes "$frontend_port"
  kill_port_processes "$docs_port"

  # Clean up PID file
  rm -f "$PID_FILE" 2>/dev/null || true

  log_ok "All servers stopped."
}

# ─────────────────────────────────────────────────────────────────────────────
# Docker Compose Helpers
# ─────────────────────────────────────────────────────────────────────────────

dc() {
  (cd "$PROJECT_DIR" && docker compose --env-file .env -f docker-compose.base.yml "$@")
}

dc_dev()  { dc -f docker-compose.dev.yml "$@"; }
dc_prod() { dc -f docker-compose.prod.yml "$@"; }

# ─────────────────────────────────────────────────────────────────────────────
# Commands
# ─────────────────────────────────────────────────────────────────────────────

show_help() {
  cat << 'EOF'
UGM-AICare Development Script

Usage: ./run_dev.sh <command> [args]

Main Commands:
  local                    Start backend + frontend + docs locally (unified terminal)
  local --separate         Start backend + frontend + docs in separate terminals (Windows Terminal if available)
  stop                     Stop all local dev servers started by this script

  docker dev <action>       Manage Docker development environment
  docker prod <action>      Manage Docker production environment

Docker Actions (for both dev/prod):
  up [--build] [svc...]     Start containers
  down [args...]            Stop containers
  restart [svc...]          Restart containers
  pause [svc...]            Pause containers
  unpause [svc...]          Unpause containers
  rebuild [svc...]          Rebuild images and recreate containers
  logs [svc]                Follow logs
  ps                        Show container status
  clean                     Down + remove volumes/orphans

Features:
  ✓ Automatic cleanup on Ctrl+C
  ✓ Cleanup on terminal close (SIGHUP)
  ✓ Stale process detection and cleanup
  ✓ Port conflict resolution
  ✓ Process health monitoring
  ✓ Graceful shutdown with timeout

Examples:
  ./run_dev.sh local          # Start local dev servers (backend/frontend/docs)
  ./run_dev.sh local --separate  # Separate terminals (Windows)
  ./run_dev.sh stop           # Stop all servers
  ./run_dev.sh docker dev up  # Start Docker dev
  ./run_dev.sh docker prod up --build  # Start Docker prod
  ./run_dev.sh docker dev pause backend
EOF
}

docker_env_action() {
  local env_name="$1"; shift
  local action="${1:-}"; shift || true

  ensure_docker

  local dc_fn=""
  case "$env_name" in
    dev)  dc_fn="dc_dev" ;;
    prod) dc_fn="dc_prod" ;;
    *)
      log_error "Unknown docker environment: $env_name (expected dev|prod)"
      exit 2
      ;;
  esac

  case "$action" in
    up)
      "$dc_fn" up -d "$@"
      ;;
    down)
      "$dc_fn" down "$@"
      ;;
    restart)
      "$dc_fn" restart "$@"
      ;;
    pause)
      "$dc_fn" pause "$@"
      ;;
    unpause)
      "$dc_fn" unpause "$@"
      ;;
    rebuild)
      # Force recreate to ensure the new image is used.
      "$dc_fn" up -d --build --force-recreate "$@"
      ;;
    logs)
      "$dc_fn" logs -f "$@"
      ;;
    ps|status)
      "$dc_fn" ps "$@"
      ;;
    clean)
      "$dc_fn" down -v --remove-orphans
      ;;
    help|--help|-h|"")
      show_help
      ;;
    *)
      log_error "Unknown docker action: $action"
      echo "Run: ./run_dev.sh help" >&2
      exit 2
      ;;
  esac
}

cmd="${1:-help}"
shift || true

case "$cmd" in
  # Primary commands
  local)
    run_local "$@"
    ;;
  stop)
    stop_servers
    ;;
  docker)
    docker_env_action "${1:-}" "${2:-}" "${@:3}"
    ;;

  # Convenience aliases
  dev)
    docker_env_action dev "${1:-up}" "${@:2}"
    ;;
  prod)
    docker_env_action prod "${1:-up}" "${@:2}"
    ;;

  # Docker dev commands
  up)
    docker_env_action dev up "$@"
    ;;
  down)
    docker_env_action dev down "$@"
    ;;
  logs)
    # Backward-compatible: prefer dev logs; fall back to prod.
    ensure_docker
    dc_dev logs -f "$@" 2>/dev/null || dc_prod logs -f "$@"
    ;;
  build)
    ensure_docker
    dc_dev build "$@"
    ;;
  restart)
    docker_env_action dev restart "$@"
    ;;
  status)
    ensure_docker
    echo "DEV containers:"
    dc_dev ps 2>/dev/null || true
    echo ""
    echo "PROD containers:"
    dc_prod ps 2>/dev/null || true
    ;;
  clean)
    # Backward-compatible: clean both envs.
    ensure_docker
    echo "Cleaning up all containers (dev + prod)..."
    dc_dev down -v --remove-orphans 2>/dev/null || true
    dc_prod down -v --remove-orphans 2>/dev/null || true
    ;;

  help|--help|-h|"")
    show_help
    ;;
  *)
    log_error "Unknown command: $cmd"
    echo "Run: ./run_dev.sh help" >&2
    exit 2
    ;;
esac

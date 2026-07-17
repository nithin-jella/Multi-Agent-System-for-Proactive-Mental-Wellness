#!/usr/bin/env bash
set -euo pipefail

backend_port="${BACKEND_PORT:-8000}"
frontend_port="${PORT:-3000}"

# Next.js rewrites uses INTERNAL_API_URL/BACKEND_URL when NEXT_PUBLIC_API_URL is not set.
export INTERNAL_API_URL="${INTERNAL_API_URL:-http://127.0.0.1:${backend_port}}"
export BACKEND_URL="${BACKEND_URL:-$INTERNAL_API_URL}"

# In single-container HTTP deployments (common for Coolify demos), Secure cookies would be dropped.
# You can override these in Coolify env vars for HTTPS deployments.
export COOKIE_SECURE="${COOKIE_SECURE:-false}"
export COOKIE_SAMESITE="${COOKIE_SAMESITE:-lax}"

backend_pid=""
frontend_pid=""

cleanup() {
  if [[ -n "$frontend_pid" ]]; then
    kill "$frontend_pid" 2>/dev/null || true
  fi
  if [[ -n "$backend_pid" ]]; then
    kill "$backend_pid" 2>/dev/null || true
  fi

  wait 2>/dev/null || true
}

trap cleanup INT TERM

echo "Starting backend on 0.0.0.0:${backend_port}..."
(
  cd backend
  gunicorn -k uvicorn.workers.UvicornWorker app.main:app \
    --bind "0.0.0.0:${backend_port}" \
    --workers "${WEB_CONCURRENCY:-2}" \
    --timeout "${GUNICORN_TIMEOUT:-120}"
) &
backend_pid=$!

echo "Starting frontend on 0.0.0.0:${frontend_port}..."
(
  cd frontend
  npm run start -- -H 0.0.0.0 -p "${frontend_port}"
) &
frontend_pid=$!

# Exit when either process exits
set +e
wait -n "$backend_pid" "$frontend_pid"
exit_code=$?
set -e

cleanup
exit "$exit_code"

#!/usr/bin/env bash
# deploy-prod.sh
# Minimal production deployment helper (app-only stack)
# Uses: docker-compose.base.yml + docker-compose.prod.yml

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

_dc() {
  (cd "$PROJECT_DIR" && docker compose --env-file .env "$@")
}

dc_prod() {
  _dc -f docker-compose.base.yml -f docker-compose.prod.yml "$@"
}

show_help() {
  echo "UGM-AICare Production Deployment Script (app-only)"
  echo ""
  echo "Usage: ./deploy-prod.sh [command]"
  echo ""
  echo "Commands:"
  echo "  deploy     Pull latest code, build and restart (default)"
  echo "  restart    Restart services without rebuilding"
  echo "  logs       Follow logs for backend + frontend"
  echo "  status     Show running containers"
  echo "  help       Show this help message"
  echo ""
  echo "Notes:"
  echo "  - The bundled monitoring stack has been removed from this repository."
  echo "  - Configure managed services via .env (DATABASE_URL, REDIS_URL, etc.)."
}

cmd="${1:-deploy}"

case "$cmd" in
  deploy)
    echo "Starting production deployment/restart..."
    echo "Pulling latest code from Git..."
    git -C "$PROJECT_DIR" pull

    if [ ! -f "$PROJECT_DIR/.env" ]; then
      echo "⚠ WARNING: .env not found in project root." >&2
    fi

    echo "Building and restarting Docker containers..."
    dc_prod up --build -d --remove-orphans

    echo "Showing backend/frontend logs (30s)..."
    timeout 30s dc_prod logs -f backend frontend || true
    ;;

  restart)
    echo "Restarting production services..."
    dc_prod restart
    ;;

  logs)
    dc_prod logs -f backend frontend
    ;;

  status)
    dc_prod ps
    ;;

  help|--help|-h)
    show_help
    ;;

  *)
    echo "❌ Unknown command: $cmd" >&2
    echo "Run: ./deploy-prod.sh help" >&2
    exit 2
    ;;
esac

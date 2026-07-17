#!/bin/sh
set -e # Exit immediately if a command exits with a non-zero status.

# The wait for the DB and migrations are handled by the 'migrate' service.
# We only need to wait for Redis here.
# echo "Waiting for Redis..."
# /app/scripts/wait-for-it.sh -t 60 redis:6379 -- echo "Redis is up."

# Start the FastAPI application with Gunicorn
echo "Starting FastAPI application with Gunicorn..."
exec gunicorn -k uvicorn.workers.UvicornWorker app.main:app --workers ${WORKERS_PER_CORE:-4} --worker-tmp-dir /dev/shm --bind 0.0.0.0:${PORT:-22001}
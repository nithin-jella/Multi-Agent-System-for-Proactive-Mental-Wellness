# syntax=docker/dockerfile:1.6

# backend/Dockerfile
# Multi-stage build for a more efficient and secure container

# ---- Build Stage (builder) ----
FROM python:3.11-slim-bookworm AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

ARG DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get -o Acquire::Retries=3 update && \
    apt-get install -y --no-install-recommends gcc python3-dev libpq-dev build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Build binary wheels so the runtime stage needs no compiler toolchain.
# --prefer-binary avoids source compiles for packages like cryptography.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip wheel --wheel-dir /app/wheels --prefer-binary -r requirements.txt


# ---- Final Stage (production) ----
FROM python:3.11-slim-bookworm

# tini is a minimal init that reaps zombie processes and forwards signals
# correctly to the gunicorn master — critical for graceful shutdowns.
RUN groupadd -r appgroup && useradd --no-log-init -r -g appgroup -m -s /bin/bash appuser

ARG DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get -o Acquire::Retries=3 update && \
    apt-get install -y --no-install-recommends \
        libpq5 \
        dos2unix \
        postgresql-client \
        curl \
        tini && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Sensible default — platforms like Coolify typically override this.
ENV PORT=22001

COPY --from=builder /app/wheels /wheels
COPY requirements.txt ./requirements.txt

# Install from the pre-built wheels only — no network access needed.
RUN pip install --no-cache-dir --no-index --find-links=/wheels -r requirements.txt \
    && rm -rf /wheels

# Optional: download SpaCy models at build time (requires network access)
ARG DOWNLOAD_SPACY_MODELS=0
RUN if [ "$DOWNLOAD_SPACY_MODELS" = "1" ]; then \
        python -m spacy download xx_ent_wiki_sm || true; \
        python -m spacy download en_core_web_sm || true; \
    fi

COPY --chown=appuser:appgroup . .

RUN if [ -d /app/scripts ]; then \
        find /app/scripts -name "*.sh" -exec dos2unix {} + -exec chmod +x {} +; \
    fi

RUN mkdir -p /app/logs && \
    chown -R appuser:appgroup /app/logs && \
    chmod -R 750 /app/logs

RUN if [ -d /app/alembic ]; then \
        mkdir -p /app/alembic/versions && \
        chown -R appuser:appgroup /app/alembic/versions && \
        chmod -R 750 /app/alembic/versions; \
    fi

USER appuser

EXPOSE 22001

# curl-based healthcheck — simpler and more reliable than inline Python.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -fs http://127.0.0.1:${PORT:-22001}/health || exit 1

# tini as PID 1 ensures SIGTERM is forwarded to gunicorn and zombie worker
# processes are reaped between graceful restarts.
#
# Gunicorn knobs:
#   --timeout 120        : Allow up to 120s for LLM / long-running requests
#                          before the worker is killed and restarted.
#   --graceful-timeout 30: Give in-flight requests 30s to finish on SIGTERM.
#   --keep-alive 5       : Reuse connections for up to 5s (behind a load balancer).
#   --forwarded-allow-ips: Trust X-Forwarded-For from any upstream proxy so
#                          real client IPs are logged and rate-limiting works.
#   --access-logfile -   : Write access logs to stdout for platform log aggregation.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD exec gunicorn \
    -k uvicorn.workers.UvicornWorker \
    app.main:app \
    --workers ${WORKERS:-4} \
    --worker-tmp-dir /dev/shm \
    --timeout ${GUNICORN_TIMEOUT:-120} \
    --graceful-timeout 30 \
    --keep-alive 5 \
    --forwarded-allow-ips='*' \
    --access-logfile - \
    --bind 0.0.0.0:${PORT:-22001}

# syntax=docker/dockerfile:1.6

# frontend/Dockerfile

# Pin Node major version for reproducible builds across stages.
ARG NODE_IMAGE=node:20-bookworm-slim

# 1. Development Stage ('development')
FROM ${NODE_IMAGE} AS development

WORKDIR /app

# Disable Next telemetry
ENV NEXT_TELEMETRY_DISABLED=1

# Copy package manifests first to maximise layer cache hits.
COPY package.json package-lock.json .npmrc* ./

# Strict clean install — fail loudly on lock file drift so drift is caught in
# development before it reaches production.  --legacy-peer-deps is required
# because valtio@1.13.2 ships use-sync-external-store@1.2.0, which declares a
# peer dep on React ≤18, conflicting with the React 19 root install.
RUN --mount=type=cache,target=/root/.npm \
	npm ci --legacy-peer-deps --no-audit --no-fund

COPY . .

EXPOSE 22000
CMD ["npm", "run", "dev:docker"]


# ---


# 2. Production Build Stage ('builder')
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json .npmrc* ./

# Strict clean install — same flag rationale as the development stage above.
RUN --mount=type=cache,target=/root/.npm \
	npm ci --legacy-peer-deps --prefer-offline --no-audit --no-fund

COPY . .

# Build-time env vars baked into the static bundle by Next.js.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Scope NODE_OPTIONS to this RUN step only — do not leak into the runtime
# image.  3 GiB heap prevents OOM kills on large Next.js builds.
RUN NODE_OPTIONS="--max-old-space-size=3072" npm run build


# ---


# 3. Production Runtime Stage ('production')
FROM ${NODE_IMAGE} AS production

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Sensible defaults — Coolify / the platform will override PORT at runtime.
ENV HOSTNAME=0.0.0.0
ENV PORT=22000

# Install curl for the HEALTHCHECK.  Use a cache mount so repeated builds
# don't re-download the package index.
ARG DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get -o Acquire::Retries=3 update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

EXPOSE 22000

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD curl -fs http://127.0.0.1:${PORT:-22000}/api/health || exit 1

# Note: requires `output: "standalone"` in next.config.ts.
CMD ["node", "server.js"]
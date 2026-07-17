---
sidebar_position: 1
id: infrastructure-map
title: VM Deployment Checklist - Required Files
---

# VM Deployment Checklist - Required Files

**Last Updated:** October 26, 2025

This document lists all files that are `.gitignore`d but **required** on the production VM for the application to run properly.

---

## Critical Files (Required)

### 1. `.env` (Project Root)
**Location:** `UGM-AICare/.env` 
**Source:** GitHub Secret `ENV_FILE_PRODUCTION` 
**Auto-created by:** `deploy.sh` script 

**Contains:**
```bash
# Database (Required for docker compose)
DATABASE_URL=postgresql+asyncpg://user:password@host:port/dbname

# Optional: managed Postgres providers may require SSL
# DB_SSL=true

# Security
JWT_SECRET_KEY=your-secret-key-here
EMAIL_ENCRYPTION_KEY=your-encryption-key-here
INTERNAL_API_KEY=your-internal-api-key
NEXTAUTH_SECRET=your-nextauth-secret

# LLM API
GOOGLE_GENAI_API_KEY=your-gemini-api-key

# Redis
REDIS_URL=redis://default:password@host:port/0

# Google OAuth (Required for authentication)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# MinIO (Optional - has defaults)
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=content-resources
MINIO_SECURE=false

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_CHAT_PER_MINUTE_STUDENT=10
RATE_LIMIT_CHAT_PER_HOUR_STUDENT=100
RATE_LIMIT_CHAT_PER_DAY_STUDENT=500

# Caching
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=3600

# URLs (adjust for your domain)
FRONTEND_URL=https://your-domain.com
BACKEND_URL=https://your-domain.com/api
ALLOWED_ORIGINS=https://your-domain.com

# Other required variables...
```

**How to create manually:**
```bash
cd /path/to/UGM-AICare
cp env.example.env
nano.env # Edit with your actual values
```

---

### 2. `alembic.ini` (Backend)
**Location:** `UGM-AICare/backend/alembic.ini` 
**Why gitignored:** Can contain sensitive database URLs 
**Required for:** Database migrations via Alembic 

**How to create:**
```bash
cd /path/to/UGM-AICare/backend

# Copy from example or create new
cat > alembic.ini << 'EOF'
# A generic, single database configuration.

[alembic]
# path to migration scripts
script_location = alembic

# template used to generate migration file names
# file_template = %%(year)d_%%(month).2d_%%(day).2d_%%(hour).2d%%(minute).2d-%%(rev)s_%%(slug)s

# sys.path path, will be prepended to sys.path if present.
prepend_sys_path =.

# timezone =
# truncate_slug_length = 40
# revision_environment = false
# sourceless = false
# version_path_separator = os # Use os.pathsep. Default configuration used for new projects.
# version_path_separator =:
# version_path_separator =;

# output_encoding = utf-8

# Alembic will use the DATABASE_URL environment variable
# Do not hardcode database URL here!
sqlalchemy.url = 

[post_write_hooks]
# Format with black
hooks = black
black.type = console_scripts
black.entrypoint = black
black.options = -l 100 REVISION_SCRIPT_FILENAME

# Logging configuration
[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
EOF
```

**Alternative:** Copy from local development:
```bash
# On your local machine
scp backend/alembic.ini deployuser@your_vm:/path/to/UGM-AICare/backend/
```

---

### 3. `alembic_supa.ini` (Backend - Optional)
**Location:** `UGM-AICare/backend/alembic_supa.ini` 
**Purpose:** Alternative Alembic config for Supabase 
**Required if:** Using Supabase as database 

**How to create:** Same as `alembic.ini` but update script_location if needed

---

## Optional Files (May Be Needed)

### 4. `logs/` Directory (Backend)
**Location:** `UGM-AICare/backend/logs/` 
**Purpose:** Application logs 
**Auto-created:** Yes, but ensure write permissions 

**How to create:**
```bash
mkdir -p /path/to/UGM-AICare/backend/logs
chmod 755 /path/to/UGM-AICare/backend/logs
```

---

### 5. ONNX Models (Backend)
**Location:** `UGM-AICare/backend/models/onnx/` 
**Purpose:** ML models for emotion detection 
**Auto-downloaded:** Yes, during Docker build from HuggingFace 
**Size:** ~502 MB 

**Note:** This is handled automatically by `backend/scripts/ensure_onnx_model.py` during Docker build. You don't need to manually copy these.

---

## [Done] Quick Setup Script

Run this on your VM after cloning/pulling the repository:

```bash
#!/usr/bin/env bash
# VM Setup Script - Run after git pull

set -euo pipefail

PROJECT_ROOT="/path/to/UGM-AICare" # UPDATE THIS!
cd "$PROJECT_ROOT"

echo "[Setup] Setting up required files..."

# 1. Create.env if not exists
if [[! -f.env ]]; then
 echo "[Warning].env not found! Copy from env.example and edit:"
 cp env.example.env
 echo " nano.env"
 echo " (Update DATABASE_URL, JWT_SECRET_KEY, GEMINI_API_KEY, etc.)"
fi

# 2. Create backend/alembic.ini
if [[! -f backend/alembic.ini ]]; then
 echo "[Note] Creating backend/alembic.ini..."
 cat > backend/alembic.ini << 'EOF'
[alembic]
script_location = alembic
prepend_sys_path =.
sqlalchemy.url = 

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
EOF
 echo "[Done] Created backend/alembic.ini"
fi

# 3. Create logs directory
mkdir -p backend/logs
chmod 755 backend/logs
echo "[Done] Created backend/logs/"

# 4. Verify permissions
echo "🔐 Verifying permissions..."
chmod +x scripts/*.sh
chmod +x deploy-prod.sh

echo ""
echo "[Done] Setup complete!"
echo ""
echo "[Warning] IMPORTANT: Edit.env file with your actual credentials:"
echo " nano.env"
echo ""
echo "Then you can run deployment:"
echo "./deploy-prod.sh deploy"
```

---

## CI/CD Integration

The GitHub Actions workflow should automatically handle `.env` creation via the `ENV_FILE_PRODUCTION` secret:

```yaml
# In.github/workflows/ci.yml (deploy job)
- name: Deploy to VM
 script: |
 #.env is auto-created from secret
 if [ -n "${{ secrets.ENV_FILE_PRODUCTION }}" ]; then
 echo "${{ secrets.ENV_FILE_PRODUCTION }}" >.env
 fi
```

**But `alembic.ini` is NOT auto-created!** You must manually create it on the VM.

---

## One-Time VM Setup Commands

Run these commands **once** when setting up a new VM:

```bash
# 1. SSH into VM
ssh deployuser@your_vm_ip

# 2. Navigate to project
cd /path/to/UGM-AICare

# 3. Create alembic.ini (REQUIRED FOR MIGRATIONS)
cat > backend/alembic.ini << 'EOF'
[alembic]
script_location = alembic
prepend_sys_path =.
sqlalchemy.url = 

[loggers]
keys = root,sqlalchemy,alembic
[handlers]
keys = console
[formatters]
keys = generic
[logger_root]
level = WARN
handlers = console
[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine
[logger_alembic]
level = INFO
handlers =
[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic
[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
EOF

# 4. Create.env (or it will be created by the CI/CD workflow from GitHub secret)
# If you want to create manually:
cp env.example.env
nano.env # Edit with actual values

# 5. Create logs directory
mkdir -p backend/logs

# 6. Make scripts executable
chmod +x scripts/*.sh
chmod +x deploy-prod.sh

# 7. Verify setup
echo "[Done] Checking required files..."
[[ -f.env ]] && echo "[Done].env exists" || echo "[Missing].env missing"
[[ -f backend/alembic.ini ]] && echo "[Done] alembic.ini exists" || echo "[Missing] alembic.ini missing"
[[ -d backend/logs ]] && echo "[Done] logs/ directory exists" || echo "[Missing] logs/ directory missing"

echo ""
echo "[Start] VM is ready for deployment!"
```

---

## Quick Reference

| File | Location | Required? | Auto-created? | How to create |
|------|----------|-----------|---------------|---------------|
| `.env` | `UGM-AICare/.env` | [Done] Yes | [Done] Yes (by CI/CD) | From `ENV_FILE_PRODUCTION` secret |
| `alembic.ini` | `backend/alembic.ini` | [Done] Yes | [Missing] No | **Manually create** (see above) |
| `alembic_supa.ini` | `backend/alembic_supa.ini` | [Optional] Optional | [Missing] No | Copy from local if needed |
| `logs/` | `backend/logs/` | [Optional] Optional | [Done] Yes (by app) | `mkdir -p backend/logs` |
| `docker-compose.override.yml` | Project root | [Optional] Optional | [Missing] No | Create if custom config needed |

---

## Common Errors

### Error: "Alembic configuration not found: backend/alembic.ini"
**Cause:** `alembic.ini` is gitignored and not on VM 
**Fix:** Create `backend/alembic.ini` using the commands above

### Error: "alembic: command not found"
**Cause:** Migrations being run before Docker containers are started 
**Fix:** This has been fixed in the deployment script - migrations now run inside the Docker container after services start. Update your deployment scripts by pulling latest changes.

### Error: "DATABASE_URL is not set"
**Cause:** Required environment variables missing from `.env` file 
**Fix:** Ensure your `.env` file contains all required variables:
- `DATABASE_URL` (for database)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (for OAuth)
- `GIT_SHA` is auto-set by deployment script

### Error: "SOME_VAR: command not found" during.env loading
**Cause:** Malformed `.env` file with lines missing `=` sign or values 
**Fix:** Check your `.env` file for:
- Lines without equals sign: `SOME_VAR` (should be `SOME_VAR=value` or remove)
- Empty variable declarations: `SOME_VAR=` (add a value or comment out)
- Special characters not properly quoted
- Update deployment scripts by pulling latest changes (now handles this gracefully)

### Error: "DATABASE_URL not set"
**Cause:** `.env` file missing or incomplete 
**Fix:** Ensure `.env` exists with valid `DATABASE_URL`

### Error: "Permission denied: backend/logs/"
**Cause:** Logs directory doesn't exist or wrong permissions 
**Fix:** `mkdir -p backend/logs && chmod 755 backend/logs`

### Error: "JWT_SECRET_KEY environment variable is not set!"
**Cause:** Critical environment variables not passed to backend container 
**Fix:** Ensure `.env` contains:
- `JWT_SECRET_KEY` (generate with: `openssl rand -hex 32`)
- `GOOGLE_GENAI_API_KEY`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

These variables MUST be in the `.env` file for docker compose to substitute them into the container.

### Error: "EMAIL_ENCRYPTION_KEY: Field required [type=missing]"
**Cause:** Pydantic Settings validation error - EMAIL_ENCRYPTION_KEY is required 
**Fix:** Add to `.env`:
```bash
EMAIL_ENCRYPTION_KEY=$(openssl rand -hex 32)
```

This key is used to encrypt user email addresses in the database for privacy compliance.

### Error: "No 'script_location' key found in configuration" (Alembic)
**Cause:** alembic.ini missing or malformed in Docker container 
**Fix:** The Dockerfile now auto-generates alembic.ini if missing. Rebuild images:
```bash
git pull origin main # Get latest Dockerfile
# CI will rebuild images automatically
```

### Error: "connection to server at localhost, port 5432 failed" (Alembic)
**Cause:** Migration script overriding container's DATABASE_URL with host's DATABASE_URL 
**Fix:** Ensure your `.env` `DATABASE_URL` points to the correct database host for the VM (managed DB hostname, not localhost).
```bash
git pull origin main./deploy-prod.sh deploy
```

**Why this happens:** 
- Inside Docker: DATABASE_URL = `postgresql+asyncpg://user:pass@db:5432/dbname` [Done]
- On host: DATABASE_URL = `postgresql+asyncpg://user:pass@localhost:5432/dbname` [Missing]
- Old migrate.sh was passing host's DATABASE_URL to container, breaking migrations

---

## Related Documentation

- Environment Variables Reference: `env.example`
- Migration Scripts: `scripts/run_migrations.sh`
- CI/CD Pipeline: `.github/workflows/ci.yml`

---

**Note:** Always ensure `.env` and `alembic.ini` are properly secured and never committed to version control!
## Split-Subdomain Traffic Flow

The production environment isolates the presentation layer from the API and data layer using distinct subdomains, managed through a reverse proxy.

```mermaid
graph TD
 Client[Client Device / Browser] -->|HTTPS| Cloudflare[Cloudflare WAF / DNS]
 
 Cloudflare -->|aicare.sumbu.xyz| FrontendProxy[Frontend Reverse Proxy]
 Cloudflare -->|api.aicare.sumbu.xyz| BackendProxy[Backend Reverse Proxy]
 
 subgraph "Presentation Layer (Next.js)"
 FrontendProxy --> UIContainer[UI Service]
 end
 
 subgraph "API Layer (FastAPI)"
 BackendProxy --> APIContainer[API Service]
 BackendProxy --> WSContainer[WebSocket Service]
 end
 
 UIContainer -.->|Client-side fetches| Cloudflare
 APIContainer --> PG[(PostgreSQL)]
 APIContainer --> RD[(Redis)]
 WSContainer --> RD
 
 classDef external fill:#f9f9f9,stroke:#333,stroke-width:2px;
 class Cloudflare,Client external;
```

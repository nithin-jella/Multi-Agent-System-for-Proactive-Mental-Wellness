#!/bin/bash

# ============================================
# Environment Variable Validation Script
# ============================================
# Usage: ./scripts/validate-env.sh [path/to/.env]
# Default: validates .env in project root
#
# This script checks if all required environment variables
# are properly set and don't contain default/example values.
# ============================================

set -e

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Determine .env file path
ENV_FILE="${1:-.env}"

echo -e "${BLUE}=== Environment Variable Validation ===${NC}"
echo "Validating: $ENV_FILE"
echo ""

# Check if .env file exists
if [ ! -f "$ENV_FILE" ]; then
  echo -e "${RED}❌ ERROR: $ENV_FILE not found!${NC}"
  echo "Please create a .env file based on env.example"
  exit 1
fi

# Critical variables that MUST be set
CRITICAL_VARS=(
  "DATABASE_URL"
  "JWT_SECRET_KEY"
  "EMAIL_ENCRYPTION_KEY"
  "INTERNAL_API_KEY"
  "NEXTAUTH_SECRET"
  "GOOGLE_GENAI_API_KEY"
  "ADMIN_PASSWORD"
)

# Important variables that should be set (warnings only)
IMPORTANT_VARS=(
  "GOOGLE_CLIENT_ID"
  "GOOGLE_CLIENT_SECRET"
  "BACKEND_MINTER_PRIVATE_KEY"
  "GRAFANA_ADMIN_PASSWORD"
  "LANGFUSE_SECRET"
  "LANGFUSE_SALT"
  "NEXTAUTH_URL"
  "NEXT_PUBLIC_API_URL"
  "REDIS_URL"
  "REDIS_HOST"
  "REDIS_PORT"
  "MINIO_ENDPOINT"
  "MINIO_ACCESS_KEY"
  "MINIO_SECRET_KEY"
)

# Variables that should NOT contain default/example values
FORBIDDEN_VALUES=(
  "CHANGE_THIS"
  "YOUR_"
  "example"
  "yourdomain.com"
)

# Allow test values in development
DEV_ALLOWED=(
  "test123"
  "admin123"
  "localhost"
)

ERRORS=0
WARNINGS=0

echo -e "${BLUE}=== Checking Critical Variables ===${NC}"
for var in "${CRITICAL_VARS[@]}"; do
  if ! grep -q "^${var}=" "$ENV_FILE"; then
    echo -e "${RED}❌ CRITICAL: ${var} is missing!${NC}"
    ERRORS=$((ERRORS + 1))
  else
    VALUE=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2-)
    if [ -z "$VALUE" ]; then
      echo -e "${RED}❌ CRITICAL: ${var} is empty!${NC}"
      ERRORS=$((ERRORS + 1))
    else
      HAS_FORBIDDEN=0
      # Check for forbidden values
      for forbidden in "${FORBIDDEN_VALUES[@]}"; do
        if echo "$VALUE" | grep -qi "$forbidden"; then
          echo -e "${RED}❌ CRITICAL: ${var} contains default/example value: '$forbidden'${NC}"
          ERRORS=$((ERRORS + 1))
          HAS_FORBIDDEN=1
          break
        fi
      done
      
      # Check length for secrets (should be at least 16 chars)
      if [ $HAS_FORBIDDEN -eq 0 ] && [[ "$var" == *"SECRET"* || "$var" == *"KEY"* || "$var" == *"PASSWORD"* ]]; then
        if [ ${#VALUE} -lt 16 ]; then
          echo -e "${YELLOW}⚠ WARNING: ${var} is too short (${#VALUE} chars, recommended: 32+)${NC}"
          WARNINGS=$((WARNINGS + 1))
        else
          echo -e "${GREEN}✓ ${var} is set (${#VALUE} chars)${NC}"
        fi
      elif [ $HAS_FORBIDDEN -eq 0 ]; then
        echo -e "${GREEN}✓ ${var} is set${NC}"
      fi
    fi
  fi
done

echo ""
echo -e "${BLUE}=== Checking Important Variables ===${NC}"
for var in "${IMPORTANT_VARS[@]}"; do
  if ! grep -q "^${var}=" "$ENV_FILE"; then
    echo -e "${YELLOW}⚠ WARNING: ${var} is missing (optional but recommended)${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    VALUE=$(grep "^${var}=" "$ENV_FILE" | cut -d'=' -f2-)
    if [ -z "$VALUE" ]; then
      echo -e "${YELLOW}⚠ WARNING: ${var} is empty${NC}"
      WARNINGS=$((WARNINGS + 1))
    else
      HAS_FORBIDDEN=0
      # Check for forbidden values
      for forbidden in "${FORBIDDEN_VALUES[@]}"; do
        if echo "$VALUE" | grep -qi "$forbidden"; then
          echo -e "${YELLOW}⚠ WARNING: ${var} contains default/example value: '$forbidden'${NC}"
          WARNINGS=$((WARNINGS + 1))
          HAS_FORBIDDEN=1
          break
        fi
      done
      
      if [ $HAS_FORBIDDEN -eq 0 ]; then
        echo -e "${GREEN}✓ ${var} is set${NC}"
      fi
    fi
  fi
done

echo ""
echo -e "${BLUE}=== Special Checks ===${NC}"

# Check if DATABASE_URL is properly formatted
if grep -q "^DATABASE_URL=" "$ENV_FILE"; then
  DB_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | cut -d'=' -f2-)
  if [ -n "$DB_URL" ] && ! echo "$DB_URL" | grep -q "postgresql"; then
    echo -e "${YELLOW}⚠ WARNING: DATABASE_URL doesn't appear to be a PostgreSQL URL${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${GREEN}✓ DATABASE_URL format looks correct${NC}"
  fi
fi

# Check if NEXTAUTH_URL matches environment
if grep -q "^NEXTAUTH_URL=" "$ENV_FILE"; then
  NEXTAUTH_URL=$(grep "^NEXTAUTH_URL=" "$ENV_FILE" | cut -d'=' -f2-)
  if grep -q "^APP_ENV=production" "$ENV_FILE"; then
    if echo "$NEXTAUTH_URL" | grep -q "localhost"; then
      echo -e "${RED}❌ ERROR: NEXTAUTH_URL points to localhost in production environment!${NC}"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "${GREEN}✓ NEXTAUTH_URL is production-ready${NC}"
    fi
  fi
fi

# Check Redis configuration
REDIS_URL_VALUE=$(grep -E "^REDIS_URL=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || true)
REDIS_HOST_VALUE=$(grep -E "^REDIS_HOST=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || true)
REDIS_PORT_VALUE=$(grep -E "^REDIS_PORT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || true)

if [ -n "$REDIS_URL_VALUE" ]; then
  if echo "$REDIS_URL_VALUE" | grep -Eq '^rediss?://'; then
    echo -e "${GREEN}✓ REDIS_URL format looks correct${NC}"
  else
    echo -e "${YELLOW}⚠ WARNING: REDIS_URL should start with redis:// or rediss://${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  # Fallback to host/port config
  if [ -z "$REDIS_HOST_VALUE" ] || [ -z "$REDIS_PORT_VALUE" ]; then
    echo -e "${YELLOW}⚠ WARNING: Redis is not configured (set REDIS_URL or REDIS_HOST/REDIS_PORT)${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    if echo "$REDIS_HOST_VALUE" | grep -q ':'; then
      echo -e "${RED}❌ ERROR: REDIS_HOST must not include a port (no ':port')${NC}"
      ERRORS=$((ERRORS + 1))
    else
      echo -e "${GREEN}✓ REDIS_HOST/REDIS_PORT are set${NC}"
    fi
  fi
fi

# Check MinIO configuration (optional): if endpoint is set, keys should be set.
MINIO_ENDPOINT_VALUE=$(grep -E "^MINIO_ENDPOINT=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || true)
MINIO_ACCESS_KEY_VALUE=$(grep -E "^MINIO_ACCESS_KEY=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || true)
MINIO_SECRET_KEY_VALUE=$(grep -E "^MINIO_SECRET_KEY=" "$ENV_FILE" 2>/dev/null | cut -d'=' -f2- || true)

if [ -n "$MINIO_ENDPOINT_VALUE" ]; then
  if [ -z "$MINIO_ACCESS_KEY_VALUE" ] || [ -z "$MINIO_SECRET_KEY_VALUE" ]; then
    echo -e "${YELLOW}⚠ WARNING: MINIO_ENDPOINT is set but MINIO_ACCESS_KEY/MINIO_SECRET_KEY are missing${NC}"
    WARNINGS=$((WARNINGS + 1))
  else
    echo -e "${GREEN}✓ MinIO credentials are set${NC}"
  fi
fi

# Check if monitoring is enabled and configured
if grep -q "^MONITORING_ENABLED=true" "$ENV_FILE"; then
  echo -e "${GREEN}✓ Monitoring is enabled${NC}"
  
  # Check Grafana password
  if ! grep -q "^GRAFANA_ADMIN_PASSWORD=" "$ENV_FILE" || \
     grep "^GRAFANA_ADMIN_PASSWORD=" "$ENV_FILE" | grep -q "CHANGE_THIS"; then
    echo -e "${YELLOW}⚠ WARNING: GRAFANA_ADMIN_PASSWORD is not properly configured${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
  
  # Check Langfuse secrets
  if ! grep -q "^LANGFUSE_SECRET=" "$ENV_FILE" || \
     grep "^LANGFUSE_SECRET=" "$ENV_FILE" | grep -q "CHANGE_THIS"; then
    echo -e "${YELLOW}⚠ WARNING: LANGFUSE_SECRET is not properly configured${NC}"
    WARNINGS=$((WARNINGS + 1))
  fi
fi

echo ""
echo -e "${BLUE}=== Validation Summary ===${NC}"
echo -e "Critical errors: ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}❌ Environment validation FAILED!${NC}"
  echo "Please fix the critical errors above."
  echo "Refer to env.example for required variables."
  echo ""
  echo "Quick fixes:"
  echo "  1. Generate secrets:"
  echo "     openssl rand -base64 32"
  echo "  2. Copy env.example to .env:"
  echo "     cp env.example .env"
  echo "  3. Fill in all required values"
  exit 1
fi

if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}⚠ Environment validation passed with $WARNINGS warning(s).${NC}"
  echo "Consider fixing the warnings for full functionality."
  echo ""
  exit 0
fi

echo -e "${GREEN}✅ Environment validation PASSED!${NC}"
echo "All required variables are properly configured."
echo ""
exit 0

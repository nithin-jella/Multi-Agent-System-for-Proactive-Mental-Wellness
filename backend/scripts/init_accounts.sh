#!/bin/bash

# Production Accounts Initialization Script
# This script initializes admin and counselor accounts for production deployment

set -e  # Exit on error

echo "========================================"
echo "Production Accounts Initialization"
echo "========================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found in backend directory"
    echo "Please create a .env file with the required variables:"
    echo "  - DATABASE_URL"
    echo "  - ENCRYPTION_KEY"
    echo "  - ADMIN_EMAIL"
    echo "  - ADMIN_PASSWORD"
    echo "  - COUNSELOR_EMAIL"
    echo "  - COUNSELOR_PASSWORD"
    exit 1
fi

# Load environment variables
echo "Loading environment variables from .env..."
export $(cat .env | grep -v '^#' | xargs)

# Check if required variables are set
REQUIRED_VARS=("DATABASE_URL" "ENCRYPTION_KEY" "ADMIN_EMAIL" "ADMIN_PASSWORD" "COUNSELOR_EMAIL" "COUNSELOR_PASSWORD")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "❌ Error: Missing required environment variables:"
    printf '  - %s\n' "${MISSING_VARS[@]}"
    exit 1
fi

echo "✅ All required environment variables are set"
echo ""

# Run the Python script
echo "Running account initialization script..."
echo ""
python scripts/init_production_accounts.py

echo ""
echo "Done!"

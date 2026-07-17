#!/bin/bash
# Start UGM-AICare monitoring stack

set -e

echo "🚀 Starting UGM-AICare Monitoring Stack..."
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

echo "Delegating to ./dev.sh (profiles: monitoring + elk)..."
echo ""
./dev.sh monitoring start

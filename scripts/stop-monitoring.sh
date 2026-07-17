#!/bin/bash
# Stop UGM-AICare monitoring stack

set -e

echo "🛑 Stopping UGM-AICare Monitoring Stack..."
echo ""

echo "Delegating to ./dev.sh (profiles-based monitoring stop)..."
echo ""

./dev.sh monitoring stop

echo ""
echo "🎉 Monitoring services stopped!"

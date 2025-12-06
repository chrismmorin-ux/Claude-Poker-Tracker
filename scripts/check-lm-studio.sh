#!/bin/bash
# check-lm-studio.sh - Health check for LM Studio server

LM_STUDIO_URL="http://10.0.0.230:1234"

# Try to connect to the server
if curl -s -f "${LM_STUDIO_URL}/v1/models" -m 5 > /dev/null 2>&1; then
    echo "✓ LM Studio server is running"
    exit 0
else
    echo "✗ ERROR: LM Studio server is not responding at ${LM_STUDIO_URL}"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Open LM Studio"
    echo "2. Load a model (Qwen or DeepSeek)"
    echo "3. Go to Developer tab → Start Server"
    echo "4. Verify it's running on ${LM_STUDIO_URL}"
    exit 1
fi

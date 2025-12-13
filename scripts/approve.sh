#!/bin/bash
# Quick permission approval commands
# Part of Multi-Agent Compliance Architecture
#
# Usage:
#   ./scripts/approve.sh                    - View pending requests
#   ./scripts/approve.sh approve <id>       - Approve request
#   ./scripts/approve.sh deny <id> [reason] - Deny request
#   ./scripts/approve.sh menu               - Open interactive menu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

case "${1:-}" in
    approve)
        if [ -z "${2:-}" ]; then
            echo "Usage: $0 approve <request-id>"
            exit 1
        fi
        node scripts/dispatcher.cjs approve-permission "$2"
        ;;
    deny)
        if [ -z "${2:-}" ]; then
            echo "Usage: $0 deny <request-id> [reason]"
            exit 1
        fi
        node scripts/dispatcher.cjs reject-permission "$2" "${3:-}"
        ;;
    menu)
        bash scripts/approve-menu.sh
        ;;
    status)
        node scripts/dispatcher.cjs status
        ;;
    *)
        # Default: show pending requests
        echo ""
        echo "=== PENDING PERMISSION REQUESTS ==="
        echo ""
        node scripts/dispatcher.cjs list-permissions --status=pending
        echo ""
        echo "Quick commands:"
        echo "  ./scripts/approve.sh approve <id>       - Approve request"
        echo "  ./scripts/approve.sh deny <id> [reason] - Deny request"
        echo "  ./scripts/approve.sh menu               - Interactive menu"
        echo "  ./scripts/approve.sh status             - Backlog status"
        ;;
esac

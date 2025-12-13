#!/bin/bash
# Human-friendly permission approval tool
# Part of Multi-Agent Compliance Architecture

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

show_menu() {
    clear
    echo "==============================================================="
    echo "  PERMISSION APPROVAL MENU"
    echo "==============================================================="
    echo ""
    echo "  [1] View pending requests"
    echo "  [2] Approve a request"
    echo "  [3] Deny a request"
    echo "  [4] View task backlog status"
    echo "  [5] View recent decisions"
    echo "  [6] Exit"
    echo ""
    echo "---------------------------------------------------------------"
}

view_pending() {
    echo ""
    echo "=== PENDING PERMISSION REQUESTS ==="
    echo ""
    node scripts/dispatcher.cjs list-permissions --status=pending
    echo ""
    read -p "Press Enter to continue..."
}

approve_request() {
    echo ""
    read -p "  Request ID (e.g., PR-2025-12-13-001): " id
    if [ -n "$id" ]; then
        node scripts/dispatcher.cjs approve-permission "$id"
    else
        echo "  No ID provided."
    fi
    echo ""
    read -p "Press Enter to continue..."
}

deny_request() {
    echo ""
    read -p "  Request ID: " id
    if [ -n "$id" ]; then
        read -p "  Reason for denial (optional): " reason
        if [ -n "$reason" ]; then
            node scripts/dispatcher.cjs reject-permission "$id" "$reason"
        else
            node scripts/dispatcher.cjs reject-permission "$id"
        fi
    else
        echo "  No ID provided."
    fi
    echo ""
    read -p "Press Enter to continue..."
}

view_status() {
    echo ""
    echo "=== BACKLOG STATUS ==="
    echo ""
    node scripts/dispatcher.cjs status
    echo ""
    read -p "Press Enter to continue..."
}

view_decisions() {
    echo ""
    echo "=== RECENT DECISIONS (last 20) ==="
    echo ""
    if [ -f ".claude/dispatcher-state.json" ]; then
        node -e "
            const fs = require('fs');
            const state = JSON.parse(fs.readFileSync('.claude/dispatcher-state.json', 'utf8'));
            const decisions = state.decisions || [];
            const recent = decisions.slice(-20);
            if (recent.length === 0) {
                console.log('  No decisions recorded yet.');
            } else {
                recent.forEach(d => {
                    console.log(\`  [\${d.timestamp}] \${d.action}: \${d.decision} - \${d.reason || 'N/A'}\`);
                });
            }
        "
    else
        echo "  No dispatcher state file found."
    fi
    echo ""
    read -p "Press Enter to continue..."
}

# Main loop
while true; do
    show_menu
    read -p "  Choose (1-6): " choice

    case $choice in
        1) view_pending ;;
        2) approve_request ;;
        3) deny_request ;;
        4) view_status ;;
        5) view_decisions ;;
        6)
            echo ""
            echo "  Goodbye!"
            exit 0
            ;;
        *)
            echo "  Invalid choice."
            sleep 1
            ;;
    esac
done

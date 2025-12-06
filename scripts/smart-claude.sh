#!/bin/bash
# smart-claude.sh - Intelligent wrapper for automatic Claude/Local routing
# Usage: ./smart-claude.sh [task description]
#    or: ./smart-claude.sh (interactive mode)

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SCRIPT_DIR/smart-claude-config.json"
LOG_FILE="$HOME/.claude/routing-log.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Initialize log file if it doesn't exist
mkdir -p "$(dirname "$LOG_FILE")"
if [ ! -f "$LOG_FILE" ]; then
    echo "[]" > "$LOG_FILE"
fi

# Function to log routing decisions
log_decision() {
    local task="$1"
    local decision="$2"
    local confidence="$3"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Simple JSON append (not perfect but works)
    echo "  {" >> "$LOG_FILE.tmp"
    echo "    \"timestamp\": \"$timestamp\"," >> "$LOG_FILE.tmp"
    echo "    \"task\": \"$task\"," >> "$LOG_FILE.tmp"
    echo "    \"decision\": \"$decision\"," >> "$LOG_FILE.tmp"
    echo "    \"confidence\": \"$confidence\"" >> "$LOG_FILE.tmp"
    echo "  }," >> "$LOG_FILE.tmp"
}

# Function to display banner
show_banner() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}🧠 Smart Claude - Automatic AI Routing${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Function to route to local model
route_to_local() {
    local task="$1"
    local model="$2"

    echo -e "${GREEN}📍 Routing to LOCAL MODEL${NC}"
    echo -e "${BLUE}Model: $model${NC}"
    echo ""

    # Call the local model
    cd "$PROJECT_ROOT"
    bash ./scripts/call-local-model.sh "$model" "$task"
    local exit_code=$?

    # Ask for feedback
    echo ""
    echo -e -n "${YELLOW}Was this result helpful? (y/n): ${NC}"
    read -r feedback

    if [ "$feedback" = "n" ] || [ "$feedback" = "N" ]; then
        echo ""
        echo -e "${YELLOW}💡 Tip: For better results on this type of task, try using Claude directly.${NC}"
        echo -e "${YELLOW}   Run: claude-code${NC}"
    else
        echo ""
        echo -e "${GREEN}✅ Great! You saved Claude tokens on this task.${NC}"
    fi

    return $exit_code
}

# Function to route to Claude
route_to_claude() {
    local task="$1"

    echo -e "${MAGENTA}📍 Routing to CLAUDE${NC}"
    echo -e "${BLUE}This task requires Claude's advanced capabilities${NC}"
    echo ""

    # Check if claude-code is available
    if command -v claude-code &> /dev/null; then
        echo "Launching Claude Code..."
        echo ""
        claude-code
    else
        echo -e "${RED}Error: claude-code command not found${NC}"
        echo "Please run Claude Code normally from your terminal"
        return 1
    fi
}

# Function to handle uncertain tasks
handle_uncertain() {
    local task="$1"

    echo -e "${YELLOW}⚠️  UNCERTAIN CLASSIFICATION${NC}"
    echo ""
    echo "This task could work with either local models or Claude."
    echo ""
    echo "Options:"
    echo "  1) Try LOCAL MODEL first (fast, saves tokens)"
    echo "  2) Use CLAUDE (reliable, guaranteed quality)"
    echo "  3) Cancel"
    echo ""
    echo -e -n "${YELLOW}Your choice (1/2/3): ${NC}"
    read -r choice

    case $choice in
        1)
            echo ""
            route_to_local "$task" "auto"
            ;;
        2)
            echo ""
            route_to_claude "$task"
            ;;
        3)
            echo ""
            echo "Cancelled."
            return 0
            ;;
        *)
            echo ""
            echo "Invalid choice. Defaulting to Claude."
            route_to_claude "$task"
            ;;
    esac
}

# Main routing function
route_task() {
    local task="$1"

    # Get classification
    CLASSIFICATION=$("$SCRIPT_DIR/task-classifier.sh" "$task")
    DECISION=$(echo "$CLASSIFICATION" | cut -d: -f1)
    CONFIDENCE=$(echo "$CLASSIFICATION" | cut -d: -f2)

    # Log the decision
    log_decision "$task" "$DECISION" "$CONFIDENCE"

    # Display classification
    echo -e "${CYAN}🔍 Task Classification: $DECISION ($CONFIDENCE confidence)${NC}"
    echo ""

    # Route based on decision
    case "$DECISION" in
        "local")
            if [ "$CONFIDENCE" = "high" ] || [ "$CONFIDENCE" = "medium" ]; then
                # Auto-route to local with high/medium confidence
                route_to_local "$task" "auto"
            else
                # Ask user for low confidence
                handle_uncertain "$task"
            fi
            ;;
        "claude")
            if [ "$CONFIDENCE" = "high" ] || [ "$CONFIDENCE" = "medium" ]; then
                # Auto-route to Claude with high/medium confidence
                route_to_claude "$task"
            else
                # Ask user for low confidence
                handle_uncertain "$task"
            fi
            ;;
        "unsure")
            # Always ask for unsure classification
            handle_uncertain "$task"
            ;;
        *)
            echo -e "${RED}Error: Unknown classification: $DECISION${NC}"
            route_to_claude "$task"
            ;;
    esac
}

# Main script logic
main() {
    show_banner

    # Check if task was provided as argument
    if [ $# -gt 0 ]; then
        # Task provided as command line argument
        TASK="$*"
        route_task "$TASK"
    else
        # Interactive mode
        echo "Enter your task (or 'quit' to exit):"
        echo ""
        echo -e -n "${GREEN}> ${NC}"
        read -r TASK

        if [ "$TASK" = "quit" ] || [ "$TASK" = "exit" ] || [ -z "$TASK" ]; then
            echo "Goodbye!"
            exit 0
        fi

        echo ""
        route_task "$TASK"
    fi
}

# Run main function
main "$@"

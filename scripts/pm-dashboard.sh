#!/bin/bash
# PM Dashboard - Display real-time session status
# Usage: bash scripts/pm-dashboard.sh

STATE_FILE=".claude/.pm-state.json"
TEMPLATE_FILE=".claude/.pm-state-template.json"

# Initialize state from template if not exists
if [ ! -f "$STATE_FILE" ]; then
  if [ -f "$TEMPLATE_FILE" ]; then
    # Generate session ID and start time
    SESSION_ID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "session-$(date +%s)")
    START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Create state file from template
    sed -e "s/\"sessionId\": \"\"/\"sessionId\": \"$SESSION_ID\"/" \
        -e "s/\"startTime\": \"\"/\"startTime\": \"$START_TIME\"/" \
        "$TEMPLATE_FILE" > "$STATE_FILE"
  else
    echo "Error: Template file not found: $TEMPLATE_FILE"
    exit 1
  fi
fi

# Read state values (with defaults)
get_json_value() {
  local key=$1
  local default=$2
  local value=$(grep -o "\"$key\": [^,}]*" "$STATE_FILE" 2>/dev/null | head -1 | sed 's/.*: //' | tr -d '"')
  echo "${value:-$default}"
}

get_json_number() {
  local key=$1
  local default=$2
  local value=$(grep -o "\"$key\": [0-9.]*" "$STATE_FILE" 2>/dev/null | head -1 | sed 's/.*: //')
  echo "${value:-$default}"
}

# Parse state
TOKENS_USED=$(get_json_number "used" "0")
TOKENS_TOTAL=$(get_json_number "total" "30000")
TOKENS_REMAINING=$((TOKENS_TOTAL - TOKENS_USED))
PERCENT_USED=$(get_json_number "percentUsed" "0")
TOKEN_STATUS=$(get_json_value "status" "normal")

TASKS_SEEN=$(get_json_number "tasksSeen" "0")
TASKS_DELEGATED=$(get_json_number "tasksDelegated" "0")
TASKS_BLOCKED=$(get_json_number "tasksBlocked" "0")
TASKS_BYPASSED=$(get_json_number "tasksBypassedWithTag" "0")
COMPLIANCE_RATE=$(get_json_number "complianceRate" "0")

CURRENT_PROJECT=$(get_json_value "currentProject" "none")
CURRENT_PHASE=$(get_json_value "currentPhase" "none")
ENTER_PLAN_USED=$(get_json_value "enterPlanModeUsed" "false")

# Count files modified
FILES_COUNT=$(grep -c "filesModified" "$STATE_FILE" 2>/dev/null || echo "0")
if [ "$FILES_COUNT" = "0" ]; then
  FILES_COUNT=$(grep -o '"filesModified": \[' "$STATE_FILE" | wc -l)
fi

# Count warnings and blocks
WARNINGS_COUNT=$(grep -o '"warnings": \[' "$STATE_FILE" | head -1)
BLOCKS_COUNT=$(grep -o '"blocks": \[' "$STATE_FILE" | head -1)

# Build progress bar (30 chars)
build_bar() {
  local percent=$1
  local filled=$((percent * 30 / 100))
  local empty=$((30 - filled))
  printf "%${filled}s" | tr ' ' '#'
  printf "%${empty}s" | tr ' ' '-'
}

# Determine status indicator
get_status_emoji() {
  case $TOKEN_STATUS in
    "normal") echo "OK" ;;
    "warning") echo "WARN" ;;
    "critical") echo "CRIT" ;;
    *) echo "OK" ;;
  esac
}

# Output dashboard
echo ""
echo "================================================================"
echo "           PROGRAM MANAGER - SESSION STATUS                     "
echo "================================================================"
echo ""
echo "TOKEN BUDGET"
BAR=$(build_bar $PERCENT_USED)
printf "[%s] %s / %s (%s%%)\n" "$BAR" "$TOKENS_USED" "$TOKENS_TOTAL" "$PERCENT_USED"
echo "  Remaining: $TOKENS_REMAINING tokens"
echo "  Warning at 24,000 | Block at 28,000"
echo "  Status: $(get_status_emoji)"
echo ""
echo "DELEGATION COMPLIANCE"
if [ "$TASKS_SEEN" -gt 0 ]; then
  DEL_PERCENT=$((TASKS_DELEGATED * 100 / TASKS_SEEN))
  DEL_BAR=$(build_bar $DEL_PERCENT)
  printf "[%s] %s / %s tasks (%s%%)\n" "$DEL_BAR" "$TASKS_DELEGATED" "$TASKS_SEEN" "$DEL_PERCENT"
else
  echo "[------------------------------] 0 / 0 tasks (N/A)"
fi
echo "  Delegated: $TASKS_DELEGATED tasks"
echo "  Blocked: $TASKS_BLOCKED tasks"
echo "  Bypassed ([CLAUDE]): $TASKS_BYPASSED tasks"
echo ""
echo "FILES MODIFIED"
# Count actual files in array
FILES_LIST=$(grep -o '"filesModified": \[[^]]*\]' "$STATE_FILE" 2>/dev/null | grep -o '"[^"]*\..*"' | wc -l)
echo "  Total: $FILES_LIST files"
echo ""
echo "CURRENT CONTEXT"
echo "  Project: $CURRENT_PROJECT"
echo "  Phase: $CURRENT_PHASE"
echo "  EnterPlanMode: $ENTER_PLAN_USED"
echo ""

# Count actual warnings/blocks in arrays
WARN_COUNT=$(grep -o '"warnings": \[[^]]*\]' "$STATE_FILE" 2>/dev/null | grep -o '"[^"]*"' | grep -v "warnings" | wc -l)
BLOCK_COUNT=$(grep -o '"blocks": \[[^]]*\]' "$STATE_FILE" 2>/dev/null | grep -o '"[^"]*"' | grep -v "blocks" | wc -l)

echo "WARNINGS: $WARN_COUNT | BLOCKS: $BLOCK_COUNT"
echo ""

# Determine overall status
if [ "$PERCENT_USED" -gt 93 ]; then
  echo "SESSION STATUS: CRITICAL - Budget nearly exhausted"
elif [ "$PERCENT_USED" -gt 80 ]; then
  echo "SESSION STATUS: Warning - Consider wrapping up"
elif [ "$TASKS_SEEN" -gt 0 ] && [ "$DEL_PERCENT" -lt 50 ]; then
  echo "SESSION STATUS: Warning - Low delegation rate"
else
  echo "SESSION STATUS: Good"
fi
echo ""

# Proactive suggestions
echo "RECOMMENDATIONS:"
SUGGESTIONS=0

# Token-based suggestions
if [ "$PERCENT_USED" -ge 80 ]; then
  echo "  Token budget at $PERCENT_USED%: Consider wrapping up or delegating remaining tasks"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

if [ "$PERCENT_USED" -ge 60 ] && [ "$PERCENT_USED" -lt 80 ]; then
  echo "  Token budget at $PERCENT_USED%: Delegate simple tasks to conserve tokens"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

# Delegation suggestions
if [ "$TASKS_SEEN" -ge 3 ] && [ "$TASKS_DELEGATED" -eq 0 ]; then
  echo "  0% delegation rate: Review if any tasks could use local models"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

if [ "$TASKS_SEEN" -gt 0 ] && [ "$TASKS_DELEGATED" -gt 0 ]; then
  DEL_PERCENT_CALC=$((TASKS_DELEGATED * 100 / TASKS_SEEN))
  if [ "$DEL_PERCENT_CALC" -ge 70 ]; then
    echo "  Excellent delegation: ${DEL_PERCENT_CALC}% of tasks delegated (saving ~$((TASKS_DELEGATED * 1500)) tokens)"
    SUGGESTIONS=$((SUGGESTIONS + 1))
  fi
fi

# File modification suggestions
if [ "$FILES_LIST" -ge 3 ] && [ "$ENTER_PLAN_USED" = "false" ]; then
  echo "  $FILES_LIST files modified: Consider using EnterPlanMode for better organization"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

if [ "$FILES_LIST" -ge 6 ]; then
  echo "  Large change set ($FILES_LIST files): Run tests and use /gen-tests for coverage"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

# Project suggestions
if [ "$CURRENT_PROJECT" = "none" ] && [ "$FILES_LIST" -ge 5 ]; then
  echo "  Multi-file work without project: Use /project start for tracking"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

# Session duration (if start time available)
START_TIME=$(get_json_value "startTime" "")
if [ -n "$START_TIME" ]; then
  # Try to calculate duration (Unix systems)
  if command -v date >/dev/null 2>&1; then
    NOW_EPOCH=$(date +%s 2>/dev/null || echo "0")
    START_EPOCH=$(date -d "$START_TIME" +%s 2>/dev/null || echo "0")
    if [ "$NOW_EPOCH" -gt 0 ] && [ "$START_EPOCH" -gt 0 ]; then
      DURATION_MIN=$(( (NOW_EPOCH - START_EPOCH) / 60 ))
      if [ "$DURATION_MIN" -gt 90 ]; then
        echo "  Session running ${DURATION_MIN}min: Use /session-advisor for guidance"
        SUGGESTIONS=$((SUGGESTIONS + 1))
      fi
    fi
  fi
fi

# No suggestions
if [ "$SUGGESTIONS" -eq 0 ]; then
  echo "  No recommendations - session looks good!"
fi

echo ""
echo "================================================================"
echo ""
echo "Commands: /pm-override [type] | /session-advisor | /process-audit"
echo "================================================================"

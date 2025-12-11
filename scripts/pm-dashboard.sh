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

# Count files modified (count entries in filesModified array)
FILES_COUNT=$(awk '/"filesModified": \[/,/\]/ {if (/\./) count++} END {print count+0}' "$STATE_FILE")

# Count warnings and blocks (count entries in arrays)
WARNINGS_COUNT=$(awk '/"warnings": \[/,/\]/ {if (/"timestamp":/) count++} END {print count+0}' "$STATE_FILE")
BLOCKS_COUNT=$(awk '/"blocks": \[/,/\]/ {if (/"rule":/) count++} END {print count+0}' "$STATE_FILE")

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

# Parse phase token data
get_phase_tokens() {
  local phase=$1
  # Extract estimatedTokens for the phase
  awk -v phase="$phase" '
    /"'$phase'"/ {found=1}
    found && /"estimatedTokens":/ {
      match($0, /[0-9]+/)
      print substr($0, RSTART, RLENGTH)
      exit
    }
  ' "$STATE_FILE" 2>/dev/null || echo "0"
}

get_phase_calls() {
  local phase=$1
  # Extract toolCalls for the phase
  awk -v phase="$phase" '
    /"'$phase'"/ {found=1}
    found && /"toolCalls":/ {
      match($0, /[0-9]+/)
      print substr($0, RSTART, RLENGTH)
      exit
    }
  ' "$STATE_FILE" 2>/dev/null || echo "0"
}

# Read phase data
PREP_TOKENS=$(get_phase_tokens "preparation")
PREP_CALLS=$(get_phase_calls "preparation")
EXPLORE_TOKENS=$(get_phase_tokens "exploration")
EXPLORE_CALLS=$(get_phase_calls "exploration")
PLAN_TOKENS=$(get_phase_tokens "planning")
PLAN_CALLS=$(get_phase_calls "planning")
RESEARCH_TOKENS=$(get_phase_tokens "research")
RESEARCH_CALLS=$(get_phase_calls "research")
FILEREAD_TOKENS=$(get_phase_tokens "file_reading")
FILEREAD_CALLS=$(get_phase_calls "file_reading")
EXEC_TOKENS=$(get_phase_tokens "execution")
EXEC_CALLS=$(get_phase_calls "execution")
TEST_TOKENS=$(get_phase_tokens "testing")
TEST_CALLS=$(get_phase_calls "testing")
COMMIT_TOKENS=$(get_phase_tokens "commits")
COMMIT_CALLS=$(get_phase_calls "commits")
OTHER_TOKENS=$(get_phase_tokens "other")
OTHER_CALLS=$(get_phase_calls "other")

# Calculate total estimated tokens from phases
TOTAL_PHASE_TOKENS=$((PREP_TOKENS + EXPLORE_TOKENS + PLAN_TOKENS + RESEARCH_TOKENS + FILEREAD_TOKENS + EXEC_TOKENS + TEST_TOKENS + COMMIT_TOKENS + OTHER_TOKENS))

# Build phase bar (16 chars max)
build_phase_bar() {
  local tokens=$1
  local total=$2
  if [ "$total" -eq 0 ]; then
    printf "----------------"
    return
  fi
  local percent=$((tokens * 100 / total))
  local filled=$((percent * 16 / 100))
  local empty=$((16 - filled))
  printf "%${filled}s" | tr ' ' '#'
  printf "%${empty}s" | tr ' ' '-'
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

# Phase breakdown section
echo "TOKEN USAGE BY PHASE"
if [ "$TOTAL_PHASE_TOKENS" -gt 0 ]; then
  # Calculate percentages
  calc_pct() {
    local val=$1
    local total=$2
    if [ "$total" -gt 0 ]; then
      echo $((val * 100 / total))
    else
      echo "0"
    fi
  }

  PREP_PCT=$(calc_pct $PREP_TOKENS $TOTAL_PHASE_TOKENS)
  EXPLORE_PCT=$(calc_pct $EXPLORE_TOKENS $TOTAL_PHASE_TOKENS)
  PLAN_PCT=$(calc_pct $PLAN_TOKENS $TOTAL_PHASE_TOKENS)
  RESEARCH_PCT=$(calc_pct $RESEARCH_TOKENS $TOTAL_PHASE_TOKENS)
  FILEREAD_PCT=$(calc_pct $FILEREAD_TOKENS $TOTAL_PHASE_TOKENS)
  EXEC_PCT=$(calc_pct $EXEC_TOKENS $TOTAL_PHASE_TOKENS)
  TEST_PCT=$(calc_pct $TEST_TOKENS $TOTAL_PHASE_TOKENS)
  COMMIT_PCT=$(calc_pct $COMMIT_TOKENS $TOTAL_PHASE_TOKENS)
  OTHER_PCT=$(calc_pct $OTHER_TOKENS $TOTAL_PHASE_TOKENS)

  # Display phases with activity
  printf "  %-14s [%s] %6d tokens (%2d%%) - %d calls\n" "preparation:" "$(build_phase_bar $PREP_TOKENS $TOTAL_PHASE_TOKENS)" "$PREP_TOKENS" "$PREP_PCT" "$PREP_CALLS"
  printf "  %-14s [%s] %6d tokens (%2d%%) - %d calls\n" "exploration:" "$(build_phase_bar $EXPLORE_TOKENS $TOTAL_PHASE_TOKENS)" "$EXPLORE_TOKENS" "$EXPLORE_PCT" "$EXPLORE_CALLS"
  printf "  %-14s [%s] %6d tokens (%2d%%) - %d calls\n" "planning:" "$(build_phase_bar $PLAN_TOKENS $TOTAL_PHASE_TOKENS)" "$PLAN_TOKENS" "$PLAN_PCT" "$PLAN_CALLS"
  printf "  %-14s [%s] %6d tokens (%2d%%) - %d calls\n" "research:" "$(build_phase_bar $RESEARCH_TOKENS $TOTAL_PHASE_TOKENS)" "$RESEARCH_TOKENS" "$RESEARCH_PCT" "$RESEARCH_CALLS"
  printf "  %-14s [%s] %6d tokens (%2d%%) - %d calls\n" "file_reading:" "$(build_phase_bar $FILEREAD_TOKENS $TOTAL_PHASE_TOKENS)" "$FILEREAD_TOKENS" "$FILEREAD_PCT" "$FILEREAD_CALLS"
  printf "  %-14s [%s] %6d tokens (%2d%%) - %d calls\n" "execution:" "$(build_phase_bar $EXEC_TOKENS $TOTAL_PHASE_TOKENS)" "$EXEC_TOKENS" "$EXEC_PCT" "$EXEC_CALLS"
  printf "  %-14s [%s] %6d tokens (%2d%%) - %d calls\n" "testing:" "$(build_phase_bar $TEST_TOKENS $TOTAL_PHASE_TOKENS)" "$TEST_TOKENS" "$TEST_PCT" "$TEST_CALLS"
  printf "  %-14s [%s] %6d tokens (%2d%%) - %d calls\n" "commits:" "$(build_phase_bar $COMMIT_TOKENS $TOTAL_PHASE_TOKENS)" "$COMMIT_TOKENS" "$COMMIT_PCT" "$COMMIT_CALLS"
  printf "  %-14s [%s] %6d tokens (%2d%%) - %d calls\n" "other:" "$(build_phase_bar $OTHER_TOKENS $TOTAL_PHASE_TOKENS)" "$OTHER_TOKENS" "$OTHER_PCT" "$OTHER_CALLS"
  echo ""
  echo "  Total estimated: $TOTAL_PHASE_TOKENS tokens"
else
  echo "  No phase data recorded yet"
fi
echo ""
# Efficiency Metrics Section
echo "EFFICIENCY METRICS"
ITER_COUNT=$(get_json_number "iterationCount" "0")
TOKENS_PER_FILE=$(get_json_number "tokensPerFileModified" "0")
PREP_RATIO=$(get_json_number "preparationRatio" "0")
PLANNING_ROI=$(get_json_number "planningROI" "0")
DEGRADATION=$(get_json_value "degradationRisk" "low")

printf "  Iterations:        %d" "$ITER_COUNT"
if [ "$ITER_COUNT" -ge 20 ]; then
  printf " [WARN: Consider /clear]"
elif [ "$ITER_COUNT" -ge 15 ]; then
  printf " [approaching limit]"
fi
echo ""
printf "  Tokens/file:       %d\n" "$TOKENS_PER_FILE"
printf "  Preparation ratio: %.2f\n" "$PREP_RATIO"
printf "  Planning ROI:      %.2f\n" "$PLANNING_ROI"
printf "  Quality risk:      %s\n" "$DEGRADATION"
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
echo "  Total: $FILES_COUNT files"
echo ""
echo "CURRENT CONTEXT"
echo "  Project: $CURRENT_PROJECT"
echo "  Phase: $CURRENT_PHASE"
echo "  EnterPlanMode: $ENTER_PLAN_USED"
echo ""

echo "WARNINGS: $WARNINGS_COUNT | BLOCKS: $BLOCKS_COUNT"
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

# Iteration-based suggestions (research-backed 20-iteration rule)
if [ "$ITER_COUNT" -ge 20 ]; then
  echo "  20+ iterations: Quality degrades after 20 - use /clear for fresh context"
  SUGGESTIONS=$((SUGGESTIONS + 1))
elif [ "$ITER_COUNT" -ge 15 ]; then
  echo "  Approaching iteration limit ($ITER_COUNT/20): Plan for context reset soon"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

# Efficiency ratio suggestions
if [ "$TOKENS_PER_FILE" -gt 3000 ] 2>/dev/null; then
  echo "  High tokens/file ($TOKENS_PER_FILE): Use grep to narrow before reading full files"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

# Token-based suggestions
if [ "$PERCENT_USED" -ge 80 ]; then
  echo "  Token budget at $PERCENT_USED%: Consider wrapping up or delegating remaining tasks"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

if [ "$PERCENT_USED" -ge 60 ] && [ "$PERCENT_USED" -lt 80 ]; then
  echo "  Token budget at $PERCENT_USED%: Delegate simple tasks to conserve tokens"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

# Phase-based suggestions
if [ "$TOTAL_PHASE_TOKENS" -gt 0 ]; then
  # High file_reading warning
  if [ "$FILEREAD_PCT" -gt 40 ]; then
    echo "  High file_reading ($FILEREAD_PCT%): Use index files (.claude/index/) before source files"
    SUGGESTIONS=$((SUGGESTIONS + 1))
  fi

  # Low preparation warning
  if [ "$PREP_PCT" -lt 5 ] && [ "$FILEREAD_PCT" -gt 20 ]; then
    echo "  Low preparation ($PREP_PCT%): Read context files first to reduce exploration"
    SUGGESTIONS=$((SUGGESTIONS + 1))
  fi

  # High exploration warning
  if [ "$EXPLORE_PCT" -gt 30 ]; then
    echo "  High exploration ($EXPLORE_PCT%): Consider creating better index files"
    SUGGESTIONS=$((SUGGESTIONS + 1))
  fi

  # Good planning feedback
  if [ "$PLAN_PCT" -ge 10 ] && [ "$PLAN_PCT" -le 25 ]; then
    echo "  Good planning investment ($PLAN_PCT%): Helps reduce execution rework"
    SUGGESTIONS=$((SUGGESTIONS + 1))
  fi

  # Low testing warning
  if [ "$EXEC_PCT" -gt 30 ] && [ "$TEST_PCT" -lt 5 ]; then
    echo "  Low testing ($TEST_PCT%) with high execution ($EXEC_PCT%): Consider adding tests"
    SUGGESTIONS=$((SUGGESTIONS + 1))
  fi
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
if [ "$FILES_COUNT" -ge 3 ] && [ "$ENTER_PLAN_USED" = "false" ]; then
  echo "  $FILES_COUNT files modified: Consider using EnterPlanMode for better organization"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

if [ "$FILES_COUNT" -ge 6 ]; then
  echo "  Large change set ($FILES_COUNT files): Run tests and use /gen-tests for coverage"
  SUGGESTIONS=$((SUGGESTIONS + 1))
fi

# Project suggestions
if [ "$CURRENT_PROJECT" = "none" ] && [ "$FILES_COUNT" -ge 5 ]; then
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

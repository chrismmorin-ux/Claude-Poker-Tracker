#!/bin/bash
# PM Audit Capture - Generate audit report from PM session state
# Usage: bash scripts/pm-audit-capture.sh [session-end|manual]

STATE_FILE=".claude/.pm-state.json"
TEMPLATE_FILE=".claude/templates/pm-audit-report.md"
AUDIT_DIR=".claude/audits/pending"
REGISTRY_FILE=".claude/audits/registry.json"

# Ensure audit directory exists
mkdir -p "$AUDIT_DIR"

# Check if state file exists
if [ ! -f "$STATE_FILE" ]; then
  echo "Error: PM state file not found: $STATE_FILE"
  exit 1
fi

# Parse JSON values
get_json_value() {
  local key=$1
  local default=$2
  grep -o "\"$key\": \"[^\"]*\"" "$STATE_FILE" 2>/dev/null | head -1 | sed 's/.*: "\(.*\)"/\1/' || echo "$default"
}

get_json_number() {
  local key=$1
  local default=$2
  grep -o "\"$key\": [0-9.]*" "$STATE_FILE" 2>/dev/null | head -1 | sed 's/.*: //' || echo "$default"
}

# Parse phase token data
get_phase_tokens() {
  local phase=$1
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
  awk -v phase="$phase" '
    /"'$phase'"/ {found=1}
    found && /"toolCalls":/ {
      match($0, /[0-9]+/)
      print substr($0, RSTART, RLENGTH)
      exit
    }
  ' "$STATE_FILE" 2>/dev/null || echo "0"
}

# Extract session data
SESSION_ID=$(get_json_value "sessionId" "unknown")
START_TIME=$(get_json_value "startTime" "")
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

CURRENT_PROJECT=$(get_json_value "currentProject" "null")
CURRENT_PHASE=$(get_json_value "currentPhase" "null")
ENTER_PLAN_USED=$(get_json_value "enterPlanModeUsed" "false")

# Count files in array (properly) - count entries between filesModified and next key
FILES_COUNT=$(awk '/"filesModified": \[/,/\]/ {if (/\./) count++} END {print count+0}' "$STATE_FILE")

# Count blocks and warnings
BLOCKS_COUNT=$(grep -o '"rule":' "$STATE_FILE" | wc -l | tr -d ' ')
WARNINGS_COUNT=$(grep -o '"warnings": \[' "$STATE_FILE" -A 100 | grep -c '"timestamp":' || echo "0")

# Calculate duration
if [ -n "$START_TIME" ]; then
  START_EPOCH=$(date -d "$START_TIME" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$START_TIME" +%s 2>/dev/null || echo "0")
  NOW_EPOCH=$(date +%s)
  DURATION=$(( (NOW_EPOCH - START_EPOCH) / 60 ))
else
  DURATION="unknown"
fi

# Calculate rates
if [ "$TASKS_SEEN" -gt 0 ]; then
  DELEGATION_RATE=$((TASKS_DELEGATED * 100 / TASKS_SEEN))
  BLOCKED_RATE=$((TASKS_BLOCKED * 100 / TASKS_SEEN))
  BYPASSED_RATE=$((TASKS_BYPASSED * 100 / TASKS_SEEN))
else
  DELEGATION_RATE=0
  BLOCKED_RATE=0
  BYPASSED_RATE=0
fi

# Extract phase data
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

# Calculate total and percentages
TOTAL_PHASE_TOKENS=$((PREP_TOKENS + EXPLORE_TOKENS + PLAN_TOKENS + RESEARCH_TOKENS + FILEREAD_TOKENS + EXEC_TOKENS + TEST_TOKENS + COMMIT_TOKENS + OTHER_TOKENS))

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

# Find highest consumption phase
HIGHEST_PHASE="other"
HIGHEST_PCT=0
for phase_check in "preparation:$PREP_PCT" "exploration:$EXPLORE_PCT" "planning:$PLAN_PCT" "research:$RESEARCH_PCT" "file_reading:$FILEREAD_PCT" "execution:$EXEC_PCT" "testing:$TEST_PCT" "commits:$COMMIT_PCT" "other:$OTHER_PCT"; do
  phase_name="${phase_check%%:*}"
  phase_pct="${phase_check##*:}"
  if [ "$phase_pct" -gt "$HIGHEST_PCT" ]; then
    HIGHEST_PCT=$phase_pct
    HIGHEST_PHASE=$phase_name
  fi
done

# Generate phase recommendations
PHASE_RECOMMENDATIONS=""
if [ "$FILEREAD_PCT" -gt 40 ]; then
  PHASE_RECOMMENDATIONS="$PHASE_RECOMMENDATIONS| R-PHZ-001 | High file_reading (${FILEREAD_PCT}%) - Use index files first | P1 | efficiency |\n"
fi
if [ "$PREP_PCT" -lt 5 ] && [ "$FILEREAD_PCT" -gt 20 ]; then
  PHASE_RECOMMENDATIONS="$PHASE_RECOMMENDATIONS| R-PHZ-002 | Low preparation (${PREP_PCT}%) - Read context files first | P2 | efficiency |\n"
fi
if [ "$EXPLORE_PCT" -gt 30 ]; then
  PHASE_RECOMMENDATIONS="$PHASE_RECOMMENDATIONS| R-PHZ-003 | High exploration (${EXPLORE_PCT}%) - Create better index files | P2 | efficiency |\n"
fi
if [ "$EXEC_PCT" -gt 30 ] && [ "$TEST_PCT" -lt 5 ]; then
  PHASE_RECOMMENDATIONS="$PHASE_RECOMMENDATIONS| R-PHZ-004 | Low testing (${TEST_PCT}%) with high execution (${EXEC_PCT}%) - Add tests | P2 | quality |\n"
fi

# Determine severity
SEVERITY="info"
if [ "$BLOCKS_COUNT" -gt 5 ] || [ "$DELEGATION_RATE" -lt 30 ] || [ "$PERCENT_USED" -gt 90 ]; then
  SEVERITY="high"
elif [ "$BLOCKS_COUNT" -gt 2 ] || [ "$DELEGATION_RATE" -lt 50 ] || [ "$PERCENT_USED" -gt 80 ]; then
  SEVERITY="medium"
fi

# Determine budget compliance
if [ "$PERCENT_USED" -le 100 ]; then
  BUDGET_COMPLIANCE="✅ Within budget"
elif [ "$PERCENT_USED" -le 150 ]; then
  BUDGET_COMPLIANCE="⚠️ Over budget (${PERCENT_USED}%)"
else
  BUDGET_COMPLIANCE="❌ Severely over budget (${PERCENT_USED}%)"
fi

# Generate token efficiency notes
TOKEN_EFFICIENCY="Session used $TOKENS_USED tokens over $DURATION minutes"
if [ "$PERCENT_USED" -gt 100 ]; then
  TOKEN_EFFICIENCY="$TOKEN_EFFICIENCY|BREAK|Exceeded budget by $((PERCENT_USED - 100))%"
fi
if [ "$DELEGATION_RATE" -lt 50 ] && [ "$TASKS_SEEN" -gt 0 ]; then
  SAVED_TOKENS=$((TASKS_SEEN * 2500))
  TOKEN_EFFICIENCY="$TOKEN_EFFICIENCY|BREAK|Low delegation rate ($DELEGATION_RATE%) - could have saved ~${SAVED_TOKENS} tokens"
fi

# Generate delegation analysis
DELEGATION_ANALYSIS=""
if [ "$DELEGATION_RATE" -ge 70 ]; then
  DELEGATION_ANALYSIS="✅ Excellent delegation rate - system working as intended"
elif [ "$DELEGATION_RATE" -ge 50 ]; then
  DELEGATION_ANALYSIS="⚠️ Moderate delegation - review [CLAUDE] tag usage"
else
  DELEGATION_ANALYSIS="❌ Poor delegation rate - investigate barriers to delegation"
fi

# Extract blocks details
BLOCKS_DETAILS="No enforcement blocks recorded."
if [ "$BLOCKS_COUNT" -gt 0 ]; then
  BLOCKS_DETAILS=$(grep -o '"blocks": \[' "$STATE_FILE" -A 9999 | grep -A 5 '"rule":' | sed 's/^/  /')
fi

# Extract warnings
WARNINGS_DETAILS="No warnings recorded."

# Extract files list (first 20)
FILES_LIST=$(awk '/"filesModified": \[/,/\]/ {if (match($0, /"([^"]+\.(js|md|json|sh|cjs))"/)) print "- " substr($0, RSTART+1, RLENGTH-2)}' "$STATE_FILE" | head -20 | tr '\n' '|')
if [ "$FILES_COUNT" -gt 20 ]; then
  FILES_LIST="$FILES_LIST|BREAK||BREAK|... and $((FILES_COUNT - 20)) more files"
fi
FILES_LIST=$(echo "$FILES_LIST" | tr '|' '\n')

# Generate recommendations
RECOMMENDATIONS=""
if [ "$DELEGATION_RATE" -lt 50 ]; then
  RECOMMENDATIONS="$RECOMMENDATIONS| R-001 | Investigate delegation barriers - rate below 50% | P1 | investigation |\n"
fi
if [ "$PERCENT_USED" -gt 100 ]; then
  RECOMMENDATIONS="$RECOMMENDATIONS| R-002 | Review token usage patterns - exceeded budget | P1 | process-improvement |\n"
fi
if [ "$BLOCKS_COUNT" -gt 3 ]; then
  RECOMMENDATIONS="$RECOMMENDATIONS| R-003 | Review enforcement violations - $BLOCKS_COUNT blocks | P2 | compliance |\n"
fi
if [ -z "$RECOMMENDATIONS" ]; then
  RECOMMENDATIONS="| R-000 | No issues found - session compliant | P3 | acknowledgment |"
fi

# Generate actionable items
ACTIONABLE_ITEMS=""
if [ "$DELEGATION_RATE" -lt 50 ]; then
  ACTIONABLE_ITEMS="$ACTIONABLE_ITEMS- [ ] Review why $((TASKS_SEEN - TASKS_DELEGATED)) tasks were not delegated → Investigation\n"
fi
if [ "$BLOCKS_COUNT" -gt 0 ]; then
  ACTIONABLE_ITEMS="$ACTIONABLE_ITEMS- [ ] Review $BLOCKS_COUNT enforcement violations → Process improvement\n"
fi
if [ -z "$ACTIONABLE_ITEMS" ]; then
  ACTIONABLE_ITEMS="- [x] Session completed successfully with no issues"
fi

# Generate audit ID
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
AUDIT_ID="pm-session-$TIMESTAMP"
AUDIT_FILE="$AUDIT_DIR/pm-session.001.$(date +%m%d)-$SESSION_ID.md"

# Create audit report directly (simpler than template)
cat > "$AUDIT_FILE" <<EOF
# PM Session Audit: $AUDIT_ID

**Type**: pm-session
**Status**: pending
**Created**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
**Severity**: $SEVERITY
**Session Duration**: $DURATION minutes

---

## Session Summary

**Session ID**: $SESSION_ID
**Token Budget**: $TOKENS_USED / $TOKENS_TOTAL ($PERCENT_USED%)
**Delegation Rate**: $DELEGATION_RATE% ($TASKS_DELEGATED/$TASKS_SEEN tasks)
**Files Modified**: $FILES_COUNT
**Enforcement Blocks**: $BLOCKS_COUNT
**Warnings**: $WARNINGS_COUNT

## Token Budget Analysis

- **Used**: $TOKENS_USED tokens
- **Remaining**: $TOKENS_REMAINING tokens
- **Status**: $TOKEN_STATUS
- **Budget Compliance**: $BUDGET_COMPLIANCE

### Token Efficiency
$(echo "$TOKEN_EFFICIENCY" | tr '|' '\n' | sed 's/BREAK//')

## Token Usage by Phase

| Phase | Tool Calls | Est. Tokens | % of Total |
|-------|------------|-------------|------------|
| preparation | $PREP_CALLS | $PREP_TOKENS | $PREP_PCT% |
| exploration | $EXPLORE_CALLS | $EXPLORE_TOKENS | $EXPLORE_PCT% |
| planning | $PLAN_CALLS | $PLAN_TOKENS | $PLAN_PCT% |
| research | $RESEARCH_CALLS | $RESEARCH_TOKENS | $RESEARCH_PCT% |
| file_reading | $FILEREAD_CALLS | $FILEREAD_TOKENS | $FILEREAD_PCT% |
| execution | $EXEC_CALLS | $EXEC_TOKENS | $EXEC_PCT% |
| testing | $TEST_CALLS | $TEST_TOKENS | $TEST_PCT% |
| commits | $COMMIT_CALLS | $COMMIT_TOKENS | $COMMIT_PCT% |
| other | $OTHER_CALLS | $OTHER_TOKENS | $OTHER_PCT% |
| **Total** | | **$TOTAL_PHASE_TOKENS** | **100%** |

### Phase Analysis

**Highest consumption**: $HIGHEST_PHASE ($HIGHEST_PCT%)

$(if [ -n "$PHASE_RECOMMENDATIONS" ]; then echo "### Phase-Based Recommendations

| ID | Recommendation | Priority | Type |
|----|----------------|----------|------|
$(echo -e "$PHASE_RECOMMENDATIONS")"; fi)

## Delegation Compliance

| Metric | Count | Rate |
|--------|-------|------|
| Tasks Seen | $TASKS_SEEN | 100% |
| Delegated | $TASKS_DELEGATED | $DELEGATION_RATE% |
| Blocked | $TASKS_BLOCKED | $BLOCKED_RATE% |
| Bypassed ([CLAUDE]) | $TASKS_BYPASSED | $BYPASSED_RATE% |

### Delegation Analysis
$DELEGATION_ANALYSIS

## Enforcement Violations

### Blocks ($BLOCKS_COUNT total)
$BLOCKS_DETAILS

### Warnings ($WARNINGS_COUNT total)
$WARNINGS_DETAILS

## Files Modified ($FILES_COUNT total)

$FILES_LIST

## Recommendations

| ID | Recommendation | Priority | Type |
|----|----------------|----------|------|
$(echo -e "$RECOMMENDATIONS")

## Session Context

- **Project**: $CURRENT_PROJECT
- **Phase**: $CURRENT_PHASE
- **EnterPlanMode Used**: $ENTER_PLAN_USED

## Actionable Items

$(echo -e "$ACTIONABLE_ITEMS")

---

**Generated by**: PM Session Tracker
**Review with**: \`/audit-review $AUDIT_ID\`
**Dashboard**: \`/pm-status\`
EOF

  echo "✅ PM audit captured: $AUDIT_FILE"
  echo ""
  echo "Session Summary:"
  echo "  - Token Usage: $TOKENS_USED / $TOKENS_TOTAL ($PERCENT_USED%)"
  echo "  - Delegation: $DELEGATION_RATE% ($TASKS_DELEGATED/$TASKS_SEEN tasks)"
  echo "  - Files: $FILES_COUNT modified"
  echo "  - Blocks: $BLOCKS_COUNT violations"
  echo "  - Severity: $SEVERITY"
  echo ""
  echo "Review with: /audit-review $AUDIT_ID"

# Archive session to history for trend analysis
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/archive-session.sh" ]; then
  echo ""
  echo "Archiving session to history..."
  bash "$SCRIPT_DIR/archive-session.sh"
fi

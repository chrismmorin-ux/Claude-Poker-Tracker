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

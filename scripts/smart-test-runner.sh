#!/bin/bash
# Smart Test Runner - Minimal output on success, detailed on failure
# Designed to minimize Claude token usage while maintaining debuggability
# Compatible with Vitest

set -o pipefail

# Run tests and capture output
npm test 2>&1 | tee .test-output.tmp

TEST_EXIT=${PIPESTATUS[0]}

if [ $TEST_EXIT -eq 0 ]; then
  # Success - show compact summary only
  # Extract test counts from Vitest output
  SUMMARY_LINE=$(grep -E "Test Files|passed|failed" .test-output.tmp | tail -3)
  # Portable regex pattern (works on Windows Git Bash without -P flag)
  TEST_COUNT=$(grep -E 'Tests\s+[0-9]+\s+passed' .test-output.tmp | tail -1 | grep -oE '[0-9]+' | head -1)

  echo ""
  echo "✅ TEST SUMMARY"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "All tests passed"
  echo "$SUMMARY_LINE" | head -3
  echo ""
  echo "Token-optimized output - full logs not needed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # ROBUSTNESS FIX: Directly update test state (backup to hook)
  # This ensures timestamp is always updated even if PostToolUse hook fails
  mkdir -p .claude
  cat > .claude/.test-state.json <<EOF
{
  "lastRun": $(node -e "console.log(Date.now())"),
  "passed": true,
  "testCount": ${TEST_COUNT:-0},
  "command": "bash scripts/smart-test-runner.sh",
  "directUpdate": true
}
EOF

  # Clear edit state since tests passed
  cat > .claude/.last-edit.json <<EOF
{
  "lastEdit": 0,
  "editCount": 0,
  "files": [],
  "clearedAfterTests": $(node -e "console.log(Date.now())")
}
EOF

  # Cleanup
  rm -f .test-output.tmp
  exit 0
else
  # Failure - parse and show compact failure summary
  # Portable regex pattern (works on Windows Git Bash without -P flag)
  FAILED_COUNT=$(grep -E 'Tests\s+[0-9]+\s+failed' .test-output.tmp | tail -1 | grep -oE '[0-9]+' | head -1)

  echo ""
  echo "❌ TESTS FAILED - Compact Summary"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Use the Vitest output parser
  node scripts/format-test-failures.js .test-output.tmp

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # ROBUSTNESS FIX: Update test state even on failure (prevents stale timestamp)
  mkdir -p .claude
  cat > .claude/.test-state.json <<EOF
{
  "lastRun": $(node -e "console.log(Date.now())"),
  "passed": false,
  "failedCount": ${FAILED_COUNT:-0},
  "command": "bash scripts/smart-test-runner.sh",
  "directUpdate": true
}
EOF

  # Cleanup
  rm -f .test-output.tmp
  exit 1
fi

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

  echo ""
  echo "✅ TEST SUMMARY"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "All tests passed"
  echo "$SUMMARY_LINE" | head -3
  echo ""
  echo "Token-optimized output - full logs not needed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Cleanup
  rm -f .test-output.tmp
  exit 0
else
  # Failure - parse and show compact failure summary
  echo ""
  echo "❌ TESTS FAILED - Compact Summary"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Use the Vitest output parser
  node scripts/format-test-failures.js .test-output.tmp

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Cleanup
  rm -f .test-output.tmp
  exit 1
fi

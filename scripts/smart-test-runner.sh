#!/bin/bash
# Smart Test Runner - Minimal output on success, detailed on failure
# Designed to minimize Claude token usage while maintaining debuggability
# Compatible with Vitest

set -o pipefail

# Optional workspace project filter (e.g., "unit", "component", "hooks")
PROJECT="${1:-}"

# ─── Pre-test gates ──────────────────────────────────────────────────────
# Source-level invariant checks that must pass before tests run. Each gate
# is an independent script that exits non-zero on violation. Failed gates
# block the test run entirely — the gate's own output explains the fix.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if ! bash "$SCRIPT_DIR/check-idb-additive.sh"; then
  echo ""
  echo "❌ Pre-test gate failed: check-idb-additive.sh"
  echo "   Tests skipped — fix the violation above and re-run."
  exit 1
fi
# FIND-086 / WS-431: the SoR additive gate existed since WS-329 but was wired NOWHERE —
# registering a schema bought nothing. It gates here beside its IDB sibling, and in CI.
if ! bash "$SCRIPT_DIR/check-sor-additive.sh"; then
  echo ""
  echo "❌ Pre-test gate failed: check-sor-additive.sh"
  echo "   Tests skipped — fix the violation above and re-run."
  echo "   (Legitimate additive change? node scripts/standardOfRecord/check-additive.mjs --update)"
  exit 1
fi
# WS-450 / FIND-112: inline pot-odds re-derivation shipped the bluffer's s/(1+s) as a
# caller's price five times before this gate existed. One seam: villainRequiredEquity.
if ! node "$SCRIPT_DIR/check-required-equity-seam.mjs"; then
  echo ""
  echo "❌ Pre-test gate failed: check-required-equity-seam.mjs"
  echo "   Tests skipped — route the threshold through villainRequiredEquity, or annotate"
  echo "   a genuine bluffer-breakeven / pot-includes-bet use."
  exit 1
fi
# WS-466 / FIND-127: ENGINE_VERSION sat unbumped through three algorithm changes, making
# every predictionAudit record's engine era unattributable. Engine sources may not change
# without a bump — the constant is what lets a record say WHICH engine produced it.
if ! node "$SCRIPT_DIR/check-engine-version-bump.mjs"; then
  echo ""
  echo "❌ Pre-test gate failed: check-engine-version-bump.mjs"
  echo "   Tests skipped — bump ENGINE_VERSION in src/constants/runtimeVersions.js."
  exit 1
fi
# WS-445: a label-shaped input — any discrete key standing between game state and a numeric
# engine parameter — must appear in the Label & Foundation Ledger. exploitEngine/CLAUDE.md
# forbade these in four documented forms and 49 families exist anyway, so prose was tried and
# it did not work. Wired here on day one BECAUSE of FIND-086 above: a gate in no pipeline is a
# comment with extra steps.
if ! bash "$SCRIPT_DIR/check-label-ledger.sh"; then
  echo ""
  echo "❌ Pre-test gate failed: check-label-ledger.sh"
  echo "   Tests skipped — fix the violation above and re-run."
  echo "   (What needs a decision?  node scripts/standardOfRecord/check-label-ledger.mjs --unledgered)"
  echo "   (Legitimate new construct? node scripts/standardOfRecord/check-label-ledger.mjs --update —"
  echo "    note it records the construct, it does NOT decide anything about it.)"
  exit 1
fi
# WS-519 / prog-guide-authority: the guide form's observance monitor. Measures INERTNESS as
# well as conformance — a standard with zero instances passes every conformance check and
# prints a green tick, which is exactly prog-strategy-of-record's own baseline finding (7 of
# 13 modules, 1,679 lines, zero non-test consumers, under 304 passing tests). Wired here on
# day one for the same FIND-086 reason as the gates above.
if ! bash "$SCRIPT_DIR/check-guide-ledger.sh"; then
  echo ""
  echo "❌ Pre-test gate failed: check-guide-ledger.sh"
  echo "   Tests skipped — fix the violation above and re-run."
  echo "   (What needs a decision?  node scripts/standardOfRecord/check-guide-ledger.mjs --undecided)"
  echo "   (Legitimate new document? node scripts/standardOfRecord/check-guide-ledger.mjs --update —"
  echo "    note it records the document, it does NOT decide anything about it.)"
  exit 1
fi

# Run tests and capture output
if [ -n "$PROJECT" ]; then
  npm test -- --project "$PROJECT" 2>&1 | tee .test-output.tmp
else
  npm test 2>&1 | tee .test-output.tmp
fi

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

  # Use the Vitest output parser. Note vitest exits non-zero for flake-retries
  # too; the parser reports whatever the Tests summary line says.
  node scripts/format-test-failures.cjs .test-output.tmp

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

  # NO cleanup on failure — the compact summary's whole bargain is that the
  # full transcript stays available in .test-output.tmp for debugging. The
  # next run's tee overwrites it; the success path deletes it.
  exit 1
fi

# Quality Gate & Test Tracker Robustness Fixes

## Problem Statement

The quality gate would frequently block commits with "Tests ran X minutes ago" even after running tests, causing workflow friction.

## Root Causes Identified

1. **test-tracker.cjs parsing failures**: If stdout was truncated or didn't match the regex pattern, the hook wouldn't update the timestamp
2. **No redundancy**: The system relied solely on the PostToolUse hook, which could fail silently
3. **Windows compatibility**: Perl regex patterns (`grep -oP`) don't work on Windows Git Bash

## Solutions Implemented

### 1. test-tracker.cjs Fallback Logic (`.claude/hooks/test-tracker.cjs`)

**Before:** Only updated timestamp if it could parse "Tests X passed" from stdout
**After:** ALWAYS updates timestamp when test command runs, using exit code as fallback if parsing fails

```javascript
// ROBUSTNESS FIX: Always update timestamp when test command runs
const now = Date.now();

if (testsPassed) {
  // Normal path
} else if (failedMatch) {
  // Failed tests path
} else {
  // FALLBACK: Test command ran but couldn't parse results
  // Use exit code as proxy for pass/fail
  const likelyPassed = exitCode === 0;
  saveTestState({
    lastRun: now,
    passed: likelyPassed,
    testCount: 0,
    command: command,
    parseFailure: true
  });
}
```

### 2. Direct Timestamp Update in smart-test-runner.sh (Redundancy)

**Before:** Relied entirely on PostToolUse hook to update timestamp
**After:** Script directly writes `.claude/.test-state.json` after tests complete

```bash
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
```

### 3. Windows-Compatible Regex Patterns

**Before:** Used Perl regex with `-oP` flag (not available on Windows Git Bash)
```bash
TEST_COUNT=$(grep -oP 'Tests\s+\K\d+(?=\s+passed)' .test-output.tmp | tail -1)
```

**After:** Uses portable POSIX regex patterns
```bash
TEST_COUNT=$(grep -E 'Tests\s+[0-9]+\s+passed' .test-output.tmp | tail -1 | grep -oE '[0-9]+' | head -1)
```

## Benefits

1. **Reliability**: Two independent mechanisms (hook + direct update) ensure timestamp is always updated
2. **Resilience**: System degrades gracefully when parsing fails (uses exit code instead)
3. **Cross-platform**: Works on Windows Git Bash, Linux, and macOS
4. **Debuggability**: Adds `parseFailure: true` flag when fallback is used

## Testing

Run tests and verify timestamp update:
```bash
bash scripts/smart-test-runner.sh
cat .claude/.test-state.json  # Should show current timestamp
```

Commit should now work immediately after tests pass:
```bash
git commit -m "test: Verify quality gate"
# Should succeed without "Tests ran X minutes ago" error
```

## Future Improvements

Consider adding:
- Notification when parseFailure occurs (for debugging)
- Health check to verify both mechanisms are working
- Automatic repair if timestamp gets corrupted

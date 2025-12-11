# Token-Optimized Testing

## Overview

This project uses a **smart test runner** that minimizes Claude token usage during development by showing:
- **Compact summaries** when tests pass (~100 tokens vs ~5000+ tokens)
- **Detailed failure info** when tests fail (only what's needed to debug)

## Usage

### Running Tests with Token Optimization

```bash
# Instead of:
npm test

# Use:
bash scripts/smart-test-runner.sh
```

### Output Examples

**When tests pass:**
```
✅ TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
All tests passed
 Test Files  52 passed (52)
      Tests  2310 passed (2310)
   Duration  15.16s

Token-optimized output - full logs not needed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**When tests fail:**
```
❌ TESTS FAILED - Compact Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Failed: 2 tests (2308 passed)

📍 src/reducers/gameReducer.test.js
   ✗ should handle FOLD action correctly
   Expected: SEAT_STATUS.FOLDED
   Received: SEAT_STATUS.ACTIVE
   📄 src/reducers/gameReducer.test.js:145

💡 Tip: Use Read tool with file paths above to debug
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## How It Works

1. **Success Path**: Runs tests, parses summary, shows minimal output
2. **Failure Path**: Extracts failing test details, shows only essential debugging info
3. **Parser**: `scripts/format-test-failures.js` intelligently extracts error context

## Token Savings

- **Passing tests**: 98% reduction (5000+ tokens → 100 tokens)
- **Failing tests**: 70-80% reduction (shows only relevant errors)
- **Session budget impact**: Allows 5-10x more test runs per session

## Best Practices

### For Claude Code Sessions

1. **Always use smart runner** for commits and development
2. **Standard runner** (`npm test`) only for detailed debugging or CI
3. **Trust the summary** - full logs available if needed in `.test-output.tmp` (auto-cleaned)

### For Pre-Commit Hooks

Update `.husky/pre-commit` or similar to use:
```bash
bash scripts/smart-test-runner.sh || exit 1
```

## Technical Details

### Scripts

- `scripts/smart-test-runner.sh` - Main orchestrator
- `scripts/format-test-failures.js` - Vitest output parser

### Compatibility

- Works with **Vitest** (current test framework)
- Parses standard Vitest text output
- No special Vitest configuration required

## When to Use Standard Runner

Use `npm test` directly when:
- You need full stack traces for complex debugging
- CI/CD pipelines (they don't care about tokens)
- Generating coverage reports
- Initial investigation of mysterious failures

## Troubleshooting

**Q: Tests fail but I need more context?**
- Check `.test-output.tmp` (if it still exists) for full output
- Or run `npm test` directly for one-time detailed view

**Q: Script not working?**
- Ensure bash is available (Windows: Git Bash, WSL)
- Check script permissions: `chmod +x scripts/smart-test-runner.sh`

**Q: Want to customize summary?**
- Edit `scripts/format-test-failures.js` to adjust what's extracted
- Edit `scripts/smart-test-runner.sh` to modify summary format

---
description: Generate unit tests for hooks, utils, or reducers
argument-hint: [target: file path or module name]
---

Use the **test-gen** subagent to generate unit tests.

## Target

$ARGUMENTS

If no target specified, analyze test coverage gaps and suggest priorities.

## Process

1. Read the target source file
2. Identify all exported functions/values
3. Generate comprehensive tests covering:
   - Happy path scenarios
   - Edge cases (empty, null, boundary values)
   - Error conditions
   - Poker-specific logic (seat wrapping, absent seats, etc.)

4. Write test file to `src/__tests__/` mirroring source structure

## Examples

```bash
# Generate tests for a utility file
/gen-tests src/utils/actionUtils.js

# Generate tests for a hook
/gen-tests src/hooks/useSeatUtils.js

# Generate tests for a reducer
/gen-tests src/reducers/gameReducer.js

# Analyze coverage gaps
/gen-tests
```

## Expected Output

- Complete test file ready to run
- Test commands to execute
- Notes on any edge cases needing review

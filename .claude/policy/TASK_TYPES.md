# Task Complexity Types

This document defines task complexity classifications for local model delegation.

## Type Definitions

### Type A: Mechanical Edits

**Characteristics:**
- Single file modification
- Pattern-based changes (find/replace, rename)
- No logic changes required
- Examples: rename variable, update import path, fix typo

**Local Model Success Rate:** ~95%

**Approach:**
```json
{
  "task_complexity_type": "A",
  "edit_strategy": "find_replace",
  "constraints": ["Use exact string matching", "Preserve indentation"]
}
```

### Type B: Template Fill

**Characteristics:**
- Creating new file from template/pattern
- Clear structure, predictable output
- No existing code to preserve
- Examples: new component, new test file, new config

**Local Model Success Rate:** ~85%

**Approach:**
```json
{
  "task_complexity_type": "B",
  "edit_strategy": "create_new",
  "constraints": ["Follow template structure", "Include all required sections"]
}
```

### Type C: Bounded Generation

**Characteristics:**
- New code generation with clear constraints
- Single function or small module
- Well-defined inputs/outputs
- Examples: utility function, helper method, simple algorithm

**Local Model Success Rate:** ~70%

**Approach:**
```json
{
  "task_complexity_type": "C",
  "edit_strategy": "create_new",
  "test_first": {
    "test_file": "tests/unit/feature.test.js",
    "assertions": ["specific behavior 1", "specific behavior 2"]
  }
}
```

### Type D: Complex Modification (TDD Required)

**Characteristics:**
- Modifying existing complex code
- Multiple interdependent changes
- Risk of breaking existing functionality
- Examples: refactor function, add feature to existing component

**Old Approach:** Escalate to Claude (failed ~60% of time)

**New Approach:** Decompose to TDD tasks

**Local Model Success Rate with TDD:** ~50-60%

**TDD Decomposition Strategy:**
1. Extract the modification as a new function/module
2. Write tests that define expected behavior
3. Local model implements against tests
4. Integrate result back (can be Type A task)

```json
{
  "task_complexity_type": "D",
  "decompose_to_tdd": true,
  "tdd_strategy": "extract_and_test"
}
```

## Decision Tree

```
Is this task modifying existing code?
├─ NO → Is it pattern-based?
│       ├─ YES → Type A (mechanical edit)
│       └─ NO → Is output structure clear?
│               ├─ YES → Type B (template fill)
│               └─ NO → Type C (bounded generation)
└─ YES → Can we extract a testable unit?
        ├─ YES → Type D with TDD decomposition
        └─ NO → Requires further decomposition
```

## TDD-First Workflow

**Core Insight:** Tests define success, not file preservation.

When a Type D task is identified:

### Step 1: Identify Testable Behavior

What should the modified code DO? Express as test assertions:
- "should return X when given Y"
- "should throw error when Z is invalid"
- "should update state correctly"

### Step 2: Extract to New Unit

Instead of modifying existing code, create a new function/module:
- Original: `updateUser(data)` needs new validation
- Extract: Create `validateUserData(data)` with tests

### Step 3: Write Failing Tests First

```javascript
describe('validateUserData', () => {
  it('should reject empty email', () => {
    expect(() => validateUserData({ email: '' })).toThrow();
  });
  // More assertions...
});
```

### Step 4: Local Model Implements

- Model can replace entire file (we don't care)
- Only criterion: tests pass

### Step 5: Integrate

After tests pass, integrate with Type A task:
```javascript
// Simple find/replace to add import and call
import { validateUserData } from './validateUserData';
// Add: validateUserData(data);
```

## Success Metrics by Type

| Type | Target Success Rate | Retry Allowed | Escalation Trigger |
|------|---------------------|---------------|-------------------|
| A | 95% | 1 retry | 2 failures |
| B | 85% | 2 retries | 3 failures |
| C | 70% | 2 retries | 3 failures |
| D (TDD) | 50% | 3 retries | 4 failures |

## Anti-Patterns

### DON'T: Assign Type D Without TDD

```json
// BAD - will likely fail
{
  "task_complexity_type": "D",
  "description": "Modify the login function to add 2FA"
}
```

### DO: Decompose Type D to TDD

```json
// GOOD - testable extraction
{
  "task_complexity_type": "C",
  "description": "Create verify2FAToken function with tests",
  "test_first": {
    "test_file": "tests/unit/verify2FAToken.test.js",
    "assertions": ["should return true for valid token", "should return false for expired token"]
  }
}
```

### DON'T: Skip Tests for Type C

```json
// BAD - no verification mechanism
{
  "task_complexity_type": "C",
  "test_command": "echo 'skipped'"
}
```

### DO: Require Meaningful Tests

```json
// GOOD - verifiable success
{
  "task_complexity_type": "C",
  "test_command": "npm test -- --grep 'featureName'",
  "test_first": { ... }
}
```

## References

- Template: `.claude/templates/tdd-task.template.md`
- Schema: `.claude/schemas/local-task.schema.json`
- Policy: `.claude/DECOMPOSITION_POLICY.md`

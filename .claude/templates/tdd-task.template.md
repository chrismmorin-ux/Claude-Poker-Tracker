# TDD Task Template

Use this template for Test-Driven Development task decomposition.

## Task Structure

```json
///LOCAL_TASKS
[
  {
    "id": "T-XXX-001",
    "title": "Short descriptive title",
    "description": "What this task accomplishes",
    "files_touched": ["path/to/implementation.js"],
    "est_lines_changed": 50,
    "est_local_effort_mins": 20,
    "test_command": "npm test -- --grep 'test name'",
    "assigned_to": "local:deepseek",
    "priority": "P0",
    "status": "open",
    "task_complexity_type": "C",
    "test_first": {
      "test_file": "tests/unit/feature.test.js",
      "assertions": [
        "should return expected output for valid input",
        "should throw error for invalid input",
        "should handle edge case X"
      ],
      "setup_command": "npm run test:watch"
    },
    "constraints": [
      "Implement ONLY the function specified",
      "Do not modify other files",
      "Follow existing code patterns"
    ]
  }
]
```

## TDD Workflow

### Step 1: Write Failing Test First

Before implementation, the test file must exist with assertions that FAIL:

```javascript
// tests/unit/feature.test.js
describe('featureName', () => {
  it('should return expected output for valid input', () => {
    const result = featureName('input');
    expect(result).toBe('expected');
  });

  it('should throw error for invalid input', () => {
    expect(() => featureName(null)).toThrow('Invalid input');
  });
});
```

Run test to verify it fails:
```bash
npm test -- --grep "featureName"
# Expected: FAIL (function doesn't exist yet)
```

### Step 2: Implement Minimum Code

Local model implements just enough to pass tests:

```javascript
// src/utils/feature.js
export function featureName(input) {
  if (!input) throw new Error('Invalid input');
  return 'expected';
}
```

### Step 3: Verify Tests Pass

```bash
npm test -- --grep "featureName"
# Expected: PASS
```

### Step 4: Accept or Iterate

- **Tests pass** -> Mark task as done
- **Tests fail** -> Local model iterates (up to 3 attempts)
- **Max attempts exceeded** -> Escalate with permission request

## Atomic Criteria Reminder

| Criterion | Limit | Description |
|-----------|-------|-------------|
| files_touched | <= 3 | Maximum files modified |
| est_lines_changed | <= 300 | Maximum lines changed |
| est_local_effort_mins | <= 60 | Maximum effort estimate |

## Example: Adding a Utility Function

### Task Spec

```json
{
  "id": "T-UTIL-001",
  "title": "Create formatCurrency utility",
  "description": "Create a function to format numbers as currency strings",
  "files_touched": ["src/utils/formatCurrency.js"],
  "est_lines_changed": 25,
  "test_command": "npm test -- --grep 'formatCurrency'",
  "assigned_to": "local:deepseek",
  "priority": "P1",
  "status": "open",
  "test_first": {
    "test_file": "tests/unit/formatCurrency.test.js",
    "assertions": [
      "should format 1000 as $1,000.00",
      "should format negative numbers with minus sign",
      "should handle zero",
      "should round to 2 decimal places"
    ]
  }
}
```

### Test File (Written First)

```javascript
// tests/unit/formatCurrency.test.js
import { formatCurrency } from '../../src/utils/formatCurrency';

describe('formatCurrency', () => {
  it('should format 1000 as $1,000.00', () => {
    expect(formatCurrency(1000)).toBe('$1,000.00');
  });

  it('should format negative numbers with minus sign', () => {
    expect(formatCurrency(-500)).toBe('-$500.00');
  });

  it('should handle zero', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('should round to 2 decimal places', () => {
    expect(formatCurrency(99.999)).toBe('$100.00');
  });
});
```

### Implementation (Local Model Writes)

```javascript
// src/utils/formatCurrency.js
export function formatCurrency(amount) {
  const isNegative = amount < 0;
  const absolute = Math.abs(amount);
  const formatted = absolute.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return isNegative ? `-$${formatted}` : `$${formatted}`;
}
```

## Key Principle

**Tests define success, not file preservation.**

If the local model replaces the entire file but tests pass, the task is successful. The TDD approach eliminates Type D failures by reframing the problem.

## References

- Policy: `.claude/DECOMPOSITION_POLICY.md`
- Task Types: `.claude/policy/TASK_TYPES.md`
- Schema: `.claude/schemas/local-task.schema.json`

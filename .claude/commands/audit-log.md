# /audit-log - Capture Audit Report

Manually capture an audit report for later review.

## Usage
```
/audit-log <type> "<title>" [--severity high|medium|low]
```

## Types
- `token-optimization` - Token usage analysis
- `process-specialist` - Workflow/process review
- `cto-review` - Architecture/code review
- `component-audit` - React component audit
- `refactoring` - Refactoring opportunities
- `efficiency` - Session efficiency analysis

## Examples
```
/audit-log token-optimization "Session exceeded budget 2x"
/audit-log cto-review "Architecture concerns in auth flow" --severity high
/audit-log refactoring "Duplicate code in reducers"
```

## What Happens
1. Creates new audit ID (AUD-XXX)
2. Prompts Claude to capture findings from recent output
3. Saves report to `.claude/audits/pending/`
4. Updates registry.json
5. Returns audit ID for tracking

## Note
Most audits are auto-captured from commands like `/cto-review`, `/process-audit`, etc.
Use this command when you want to manually log findings.

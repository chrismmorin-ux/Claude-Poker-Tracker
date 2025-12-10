---
description: Analyze a specific error or problem and create preventive measures
argument-hint: [error description or "last" for most recent error]
---

Use the **process-specialist** subagent to analyze a specific error and create preventive measures.

## Error to Analyze: $ARGUMENTS

If "$ARGUMENTS" is "last", analyze the most recent error from:
1. Git log (most recent "fix:" commit)
2. Error log in localStorage (if accessible)
3. Most recent test failure

Otherwise, analyze the described error.

## Analysis Requirements

1. **Root Cause Analysis**
   - What caused this error?
   - Was there missing context?
   - Was there unclear documentation?
   - Was this a pattern that's happened before?

2. **Prevention Strategy**
   - What documentation update would prevent this?
   - What template or prompt improvement would help?
   - What hook or check could catch this earlier?
   - What test would detect this?

3. **Implementation**
   - Provide specific file changes
   - Include before/after for documentation updates
   - Provide hook code if recommending new hook
   - Estimate tokens saved by prevention

## Output Format

```markdown
## Error Analysis: [Brief Description]

### What Happened
[Concise description of the error]

### Root Cause
[Why it happened - missing context, unclear docs, etc.]

### Has This Happened Before?
[Check git log for similar fixes]

### Prevention Measures

#### Documentation Update
File: [path]
Change: [specific change]

#### Template/Prompt Update (if applicable)
File: [path]
Change: [specific change]

#### Hook/Check Addition (if applicable)
[Code or configuration]

#### Test Addition (if applicable)
[Test code or description]

### Estimated Impact
- Tokens saved per occurrence: ~X
- Likelihood of recurrence without fix: X%
- Implementation effort: X minutes
```

Focus on preventing this specific error from recurring. Be concrete and actionable.

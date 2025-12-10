---
description: Review work just completed for process compliance and suggest improvements
argument-hint: ["session" | "commit" | "last-N-commits"]
---

Use the **process-specialist** subagent to review recent work for process compliance.

## Review Scope: $ARGUMENTS

- **session** (default): Review all work done this session (uncommitted + recent commits)
- **commit**: Review the last commit only
- **last-N-commits**: Review the last N commits (e.g., "last-5-commits")

## Compliance Checks

### 1. Delegation Compliance
- Were tasks that should have been delegated actually delegated?
- Could any of the work have used /local-* commands?
- Was decomposition done before implementation?

### 2. Context Efficiency
- Were parallel reads used where possible?
- Was the Explore agent used for open-ended searches?
- Were context summary files read before full files?

### 3. Error Prevention
- Did any errors occur that could have been prevented?
- Were tests run appropriately?
- Was /review run after significant changes?

### 4. Documentation Compliance
- Were docs updated alongside code changes?
- Are there any version/changelog updates needed?
- Is BACKLOG.md current?

## Output Format

```markdown
## Session Review: [Date/Time Range]

### Compliance Scorecard
| Area | Score | Notes |
|------|-------|-------|
| Delegation | X/10 | [brief note] |
| Context Efficiency | X/10 | [brief note] |
| Error Prevention | X/10 | [brief note] |
| Documentation | X/10 | [brief note] |
| **Overall** | **X/10** | |

### What Went Well
- [Specific positive pattern]
- ...

### Improvement Opportunities
| Issue | What Happened | Better Approach |
|-------|---------------|-----------------|
| ... | ... | ... |

### Specific Recommendations
1. [Actionable improvement for next session]
2. ...

### Process Updates Needed
[If patterns suggest process/doc updates]
```

This review helps identify patterns for continuous improvement.

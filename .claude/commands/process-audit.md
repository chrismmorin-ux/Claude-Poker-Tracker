---
description: Run a full process audit analyzing errors, compliance, context efficiency, and workflow patterns
argument-hint: ["quick" | "full" | "errors" | "context" | "delegation"]
---

Use the **process-specialist** subagent to perform a process audit.

## Audit Scope: $ARGUMENTS

Based on the argument, focus the audit:

- **quick** (default): High-level check of errors, compliance, and obvious issues. Fast turnaround.
- **full**: Comprehensive audit of all areas. Takes longer but thorough.
- **errors**: Focus only on error patterns, recurring bugs, and prevention strategies.
- **context**: Focus only on context file sizes, redundancy, and efficiency.
- **delegation**: Focus only on local model delegation compliance.

## Required Analysis

1. **Error Pattern Analysis** (always included)
   - Check git log for "fix:" commits to identify recurring issues
   - Analyze what types of errors are happening
   - Recommend specific preventions

2. **Context Efficiency** (unless errors-only)
   - Measure CLAUDE.md size
   - Check for redundancy across documentation
   - Recommend consolidation

3. **Delegation Compliance** (unless errors-only)
   - Check .claude/.delegation-violations.json
   - Review project files for delegation analysis
   - Calculate compliance rate

4. **Workflow Patterns** (full audit only)
   - Analyze git commit patterns
   - Check hook effectiveness
   - Review agent utilization

## Output Requirements

Provide a structured report with:
1. Executive summary with scores
2. Error analysis with specific recurring patterns
3. Prioritized recommendations (error prevention first)
4. Specific file changes (paths and content)
5. Token savings estimates

Focus on actionable, implementable recommendations that can be done this session.

---
description: Run a full process audit analyzing errors, compliance, context efficiency, and workflow patterns
argument-hint: ["quick" | "full" | "errors" | "context" | "delegation" | "decomposition"]
---

Use the **process-specialist** subagent to perform a process audit.

## Audit Scope: $ARGUMENTS

Based on the argument, focus the audit:

- **quick** (default): High-level check of errors, compliance, and obvious issues. Fast turnaround.
- **full**: Comprehensive audit of all areas. Takes longer but thorough.
- **errors**: Focus only on error patterns, recurring bugs, and prevention strategies.
- **context**: Focus only on context file sizes, redundancy, and efficiency.
- **delegation**: Focus only on local model delegation compliance.
- **decomposition**: Focus only on atomic task decomposition health and compliance.

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

4. **Decomposition Health** (decomposition scope or full audit)
   - Run `node scripts/decomposition-health.cjs` for automated health check
   - Review `.claude/backlog.json` for atomic criteria violations
   - Check `.claude/audits/atomicity_report.json` for detailed violations
   - Analyze decomposition depth trends (target: <1.5 average)
   - Review permission request patterns (target: <5% of tasks)
   - Calculate atomic compliance rate (target: ≥95%)
   - Check test pass rates for local model tasks
   - Identify tasks exceeding max decomposition depth (3)
   - Provide specific remediation for violations

5. **Workflow Patterns** (full audit only)
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

---
description: CTO-level architecture and design review
argument-hint: [area to review or "full"]
---

Use the **cto-agent** subagent to perform an architecture review.

## Review Scope

$ARGUMENTS

## Review Process

1. Read `CLAUDE.md` for current architecture documentation
2. Read `engineering_practices.md` for standards compliance
3. Analyze the specified area (or full codebase if "full")

## Review Checklist

Evaluate against these criteria:

### Architecture Quality
- [ ] Component boundaries are well-defined
- [ ] State management is appropriate for complexity
- [ ] Dependencies flow in correct direction
- [ ] No circular dependencies
- [ ] Separation of concerns maintained

### Scalability
- [ ] Can handle 10x current load
- [ ] No obvious bottlenecks
- [ ] Caching strategy appropriate
- [ ] Database queries optimized

### Maintainability
- [ ] Code follows established patterns
- [ ] Documentation is current
- [ ] Tests provide adequate coverage
- [ ] Technical debt is manageable

### Security
- [ ] Input validation in place
- [ ] No hardcoded secrets
- [ ] OWASP top 10 addressed
- [ ] Dependencies audited

## Expected Output

Provide:
1. **Executive Summary**: One paragraph assessment
2. **Findings Table**: Issue | Severity | Recommendation
3. **Top 3 Priority Actions**: With task JSON for each
4. **ADR Recommendations**: If architectural changes needed

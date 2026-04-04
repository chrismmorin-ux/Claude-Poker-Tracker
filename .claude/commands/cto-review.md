---
description: CTO-level architecture and design review
argument-hint: [area to review or "full"]
---

Use the **cto-agent** subagent to perform an architecture review.

## Review Scope

$ARGUMENTS

## Review Process

1. Read `.claude/context/SYSTEM_MODEL.md` for invariants, failure surfaces, and architectural decisions
2. Read `CLAUDE.md` for rules and patterns
3. Analyze the specified area (or full codebase if "full")
4. Read relevant source files before making findings
5. Verify proposed changes against §4 invariants and §4.2 anti-invariants

## Review Checklist

Evaluate against these criteria:

### Component Architecture
- [ ] Component boundaries are well-defined
- [ ] No god-components doing too much
- [ ] Hook responsibilities are clear and scoped
- [ ] Reducer scope matches domain boundaries

### Engine Integration
- [ ] Range engine connected to UI properly
- [ ] Exploit engine consuming range data correctly
- [ ] No orphaned engine code or dead integrations

### Persistence Fit
- [ ] IndexedDB schema matches data model needs
- [ ] No unnecessary stores or missing indexes

### Simplification Opportunities
- [ ] No over-abstraction for project scale
- [ ] Dead code identified for removal
- [ ] Unnecessary complexity flagged

## Expected Output

Provide:
1. **Executive Summary**: One paragraph assessment
2. **Findings Table**: Area | Severity | Finding | Recommendation
3. **Backlog Items**: Formatted for direct insertion into `.claude/BACKLOG.md`

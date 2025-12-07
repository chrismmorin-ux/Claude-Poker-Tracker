---
description: Technical debt triage and refactor planning
argument-hint: [specific area or "inventory"]
---

Use the **cto-agent** subagent to assess and prioritize technical debt.

## Scope

$ARGUMENTS

## Analysis Process

1. Read `CLAUDE.md` for architecture context and version history
2. Read `engineering_practices.md` Section 10 (Refactor Sprints)
3. Analyze codebase for debt indicators

## Debt Indicators to Identify

### Code Smells
- Large files (>500 lines)
- Long functions (>50 lines)
- Deep nesting (>3 levels)
- Duplicate code patterns
- Magic numbers/strings
- Dead code

### Architecture Debt
- Circular dependencies
- God components
- Leaky abstractions
- Missing abstraction layers
- Tight coupling

### Process Debt
- Missing tests
- Outdated documentation
- Inconsistent patterns
- Deprecated dependencies
- Security vulnerabilities

## Expected Output

### 1. Debt Inventory Table

| ID | Location | Type | Severity | Effort | Risk if Ignored |
|----|----------|------|----------|--------|-----------------|
| D1 | file:line | code/arch/process | high/med/low | S/M/L | description |

### 2. Prioritization Matrix

Plot items on Impact vs Effort grid:
- **Quick Wins**: High impact, low effort (do first)
- **Strategic**: High impact, high effort (plan carefully)
- **Fill-ins**: Low impact, low effort (when time permits)
- **Avoid**: Low impact, high effort (deprioritize)

### 3. Recommended Refactor Sprint

If debt threshold exceeded (>20 items or critical items present):
- Propose sprint scope
- List specific tasks with JSON format
- Estimate duration
- Define success metrics

### 4. Debt Prevention Recommendations

- Process improvements to prevent recurrence
- Automated checks to add
- Standards to clarify

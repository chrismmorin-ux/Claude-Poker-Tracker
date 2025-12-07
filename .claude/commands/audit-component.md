---
description: Audit React components for performance and patterns
argument-hint: [scope: "full" | "views" | "ui" | file path]
---

Use the **component-auditor** subagent to audit React components.

## Audit Scope

$ARGUMENTS

If no scope specified, provide a summary of all components with quick health check.

## Process

1. Identify components based on scope:
   - `full` - All components (`src/components/**/*.jsx`)
   - `views` - View components (`src/components/views/*.jsx`)
   - `ui` - UI components (`src/components/ui/*.jsx`)
   - `[filepath]` - Specific component file

2. Read `CLAUDE.md` for project patterns

3. Apply audit checklist for each component:
   - Structure and size
   - Props design
   - Performance (useCallback, useMemo, React.memo)
   - State management
   - Effects usage
   - Accessibility

4. Output structured audit report with prioritized issues

## Examples

```bash
# Audit all components
/audit-component full

# Audit only view components
/audit-component views

# Audit specific component
/audit-component src/components/views/TableView.jsx

# Quick health check
/audit-component
```

## Expected Output

- Component summary with risk levels
- Detailed findings per component
- Prioritized issues (critical > important > minor)
- Actionable recommendations

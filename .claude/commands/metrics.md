# Token Usage Metrics

Show current session token usage metrics and comparison to budget.

## Instructions

Read the session metrics file and display a dashboard:

1. Read `.claude/metrics/session-YYYY-MM-DD.json` (today's date)
2. Read `.claude/.session-budget.json` for budget state
3. Display:
   - Current session token usage vs 30K budget
   - Breakdown by tool type (sorted by tokens consumed)
   - Top 5 most expensive operations
   - Budget status (OK / Warning / Exceeded)
   - Comparison to previous sessions if available

## Output Format

```
TOKEN METRICS - Session [session-id]
=====================================

Budget Status: [OK|WARNING|EXCEEDED]
Used: X,XXX / 30,000 tokens (XX.X%)
[████████████░░░░░░░░]

BY TOOL TYPE:
  Read:    X,XXX tokens (XX calls)
  Task:    X,XXX tokens (XX calls)
  Edit:    X,XXX tokens (XX calls)
  Grep:    X,XXX tokens (XX calls)
  ...

TOP 5 OPERATIONS:
  1. Read: [filename] - XXX tokens
  2. Task: [agent] - XXX tokens
  ...

DAILY TOTAL: X,XXX tokens across X sessions
```

If no metrics file exists, display: "No metrics recorded yet. Metrics will appear after tool usage."

Generate and display the system health dashboard.

First run:
```bash
node scripts/generate-dashboard.cjs
```

Then read and display the contents of `.claude/DASHBOARD.md`.

The dashboard shows:
- Health Score (0-100) with success rate, compliance, and pattern mitigation
- Task execution status (completed, in progress, open, failed)
- Tracked failure patterns (FP-001, FP-002, etc.)
- Active and recently completed projects
- Delegation compliance metrics

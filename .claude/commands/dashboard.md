Generate and display the system health dashboard.

First run:
```bash
node scripts/generate-dashboard.cjs
```

Then read and display the contents of `.claude/DASHBOARD.md`.

The dashboard shows:
- **Health Score** (0-100) - Overall system health with color indicators
- **Session & Token Efficiency** - API usage tracking for cost control
- **Local Model Delegation** - Tasks delegated to DeepSeek/Qwen
- **Git Status** - Branch, uncommitted changes, push/pull status
- **Test Status** - Last run, passed/failed counts
- **Dependencies** - Security issues, outdated packages
- **Technical Debt** - TODOs, FIXMEs, large files
- **Task Queue** - Open, in progress, completed, failed tasks
- **Known Issues** - Tracked failure patterns (FP-001, etc.)
- **Projects** - Active and completed projects with progress
- **Audits** - Pending code audits and reviews

Color coding: 🟢 Good | 🟡 Attention | 🔴 Action needed

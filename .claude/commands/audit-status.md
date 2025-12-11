# /audit-status - View Audit Queue

Display all audits and their current status.

## Usage
```
/audit-status              # Show summary
/audit-status --pending    # Show only pending
/audit-status --all        # Show all including actioned
/audit-status --stats      # Show statistics only
```

## Output
```
╔═══════════════════════════════════════════════════════════╗
║                    AUDIT QUEUE STATUS                      ║
╠═══════════════════════════════════════════════════════════╣
║ PENDING (4):                                               ║
║  ├─ cto-review.001.1211-architecture-concerns [HIGH]      ║
║  ├─ cto-review.002.1212-auth-flow-issues [MED]            ║
║  ├─ process-specialist.001.1210-delegation-gaps [HIGH]    ║
║  └─ token-optimization.001.1211-budget-exceeded [MED]     ║
║                                                            ║
║ RECENTLY ACTIONED (2):                                     ║
║  ├─ cto-review.003 → Created ARCH-001, ARCH-002           ║
║  └─ component-audit.001 → Created PERF-001                ║
║                                                            ║
║ STATS:                                                     ║
║  ├─ Pending: 4                                             ║
║  ├─ Actioned this week: 2                                  ║
║  ├─ Dismissed: 0                                           ║
║  └─ By type: cto-review(2), process-specialist(1), token(1)║
╚═══════════════════════════════════════════════════════════╝

Commands: /audit-review cto-review.001 | /audit-review --type cto-review
```

## File Naming
Format: `{type}.{sequence}.{MMDD}-{title}.md`
- Groups by type for easy review: `ls cto-review.*`
- Sequence per type: cto-review.001, cto-review.002, ...
- Date for context: 1211 = Dec 11
- Title for quick identification

**Examples:**
```
cto-review.001.1211-architecture-concerns.md
cto-review.002.1212-auth-flow-issues.md
process-specialist.001.1210-delegation-compliance.md
token-optimization.001.1211-session-exceeded-budget.md
```

## Integration
- Startup menu shows pending count
- Process Specialist includes audit queue in reviews
- Audits older than 7 days flagged as stale

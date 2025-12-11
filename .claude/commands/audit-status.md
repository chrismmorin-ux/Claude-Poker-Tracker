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
║ PENDING (3):                                               ║
║  ├─ 1211.015 [HIGH] Token optimization (2 days old)       ║
║  ├─ 1211.016 [MED]  Process specialist review (1 day)     ║
║  └─ 1212.001 [LOW]  Component audit (today)               ║
║                                                            ║
║ RECENTLY ACTIONED (2):                                     ║
║  ├─ 1210.014 [HIGH] CTO review → TOK-003, TOK-004         ║
║  └─ 1210.013 [MED]  Refactoring → REFACT-001              ║
║                                                            ║
║ STATS:                                                     ║
║  ├─ Pending: 3                                             ║
║  ├─ Actioned this week: 5                                  ║
║  ├─ Dismissed: 2                                           ║
║  └─ Avg time to action: 1.8 days                           ║
╚═══════════════════════════════════════════════════════════╝

Commands: /audit-review --next | /audit-review 1211.015
```

## File Naming
Format: `{MMDD}.{sequence}-{type}.md`
- `1211.001-cto-review.md` = Dec 11, 1st audit, CTO review
- `1212.003-token-optimization.md` = Dec 12, 3rd audit, token optimization

## Integration
- Startup menu shows pending count
- Process Specialist includes audit queue in reviews
- Audits older than 7 days flagged as stale

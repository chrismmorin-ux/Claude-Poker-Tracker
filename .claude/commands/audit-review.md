# /audit-review - Process Pending Audit

Review an audit and create actionable items.

## Usage
```
/audit-review [audit-id]
/audit-review --next         # Review oldest pending
/audit-review --list         # List all pending
/audit-review AUD-001 --dismiss  # Dismiss without action
```

## What Happens
1. Displays the audit report
2. Asks which recommendations to action:
   - Add to BACKLOG.md
   - Create project task
   - Dismiss (no action needed)
3. Creates linked backlog items or tasks
4. Updates audit status to "actioned" or "dismissed"
5. Moves audit file to appropriate folder

## Example Flow
```
> /audit-review AUD-003

╔═══════════════════════════════════════════════════════════╗
║  AUDIT: AUD-003 - Token optimization (HIGH)               ║
╠═══════════════════════════════════════════════════════════╣
║  Created: 2025-12-11                                      ║
║  Type: token-optimization                                 ║
║                                                           ║
║  Summary: Session used 86k tokens vs 30k budget           ║
║                                                           ║
║  Recommendations:                                         ║
║  [1] R-001: Add context file caching (P1)                 ║
║  [2] R-002: Reduce Explore agent scope (P2)               ║
║  [3] R-003: Batch file reads (P2)                         ║
╚═══════════════════════════════════════════════════════════╝

Which recommendations to action? (1,2,3 or 'all' or 'dismiss')
> 1,2

Created:
- BACKLOG: TOK-004 "Add context file caching"
- BACKLOG: TOK-005 "Reduce Explore agent scope"

Audit AUD-003 marked as actioned.
```

## Linking
Actioned audits are linked to their created tasks in registry.json.
This creates an audit trail from finding → action → completion.

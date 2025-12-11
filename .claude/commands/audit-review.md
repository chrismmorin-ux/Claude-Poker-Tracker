# /audit-review - Process Pending Audit

Review an audit and create actionable items.

## Usage
```
/audit-review [audit-id]              # Review specific audit
/audit-review --next                  # Review oldest pending
/audit-review --type cto-review       # Review all CTO audits
/audit-review --list                  # List all pending
/audit-review <id> --dismiss          # Dismiss without action
/audit-review <id> --archive          # Archive after actioning
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
> /audit-review cto-review.002

╔═══════════════════════════════════════════════════════════╗
║  AUDIT: cto-review.002.1212-auth-flow-issues              ║
╠═══════════════════════════════════════════════════════════╣
║  Created: 2025-12-12                                      ║
║  Type: cto-review                                         ║
║  Severity: HIGH                                           ║
║                                                           ║
║  Summary: Auth flow has several architectural concerns    ║
║                                                           ║
║  Recommendations:                                         ║
║  [1] R-001: Extract auth logic to dedicated hook (P1)     ║
║  [2] R-002: Add token refresh handling (P1)               ║
║  [3] R-003: Improve error recovery flow (P2)              ║
╚═══════════════════════════════════════════════════════════╝

Which recommendations to action? (1,2,3 or 'all' or 'dismiss')
> 1,2

Created:
- BACKLOG: AUTH-005 "Extract auth logic to dedicated hook"
- BACKLOG: AUTH-006 "Add token refresh handling"

Audit cto-review.002 marked as actioned.
File moved to: .claude/audits/actioned/
```

## Review All of Type
```
> /audit-review --type cto-review

Found 3 cto-review audits:
1. cto-review.001.1211-architecture-concerns (pending)
2. cto-review.002.1212-auth-flow-issues (pending)
3. cto-review.003.1212-reducer-patterns (actioned)

Review which? (1, 2, or 'all pending')
```

## Archive Workflow
- **Actioned**: Reviewed, tasks created → moved to `.claude/audits/actioned/`
- **Dismissed**: Reviewed, no action needed → moved to `.claude/audits/dismissed/`
- **Files stay** in archive folders for audit trail (searchable)
- **Registry** tracks status and linked tasks

## Linking
Actioned audits are linked to their created tasks in registry.json.
This creates an audit trail from finding → action → completion.

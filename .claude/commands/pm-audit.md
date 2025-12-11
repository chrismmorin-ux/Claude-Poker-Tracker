# PM Session Audit

Capture current PM session state as an audit report for review.

## Instructions

Run the PM audit capture script to generate a reviewable audit:

```bash
bash scripts/pm-audit-capture.sh
```

This will:
1. Read current `.pm-state.json`
2. Analyze session metrics (tokens, delegation, violations)
3. Generate severity-rated audit report
4. Save to `.claude/audits/pending/pm-session.*.md`

The audit includes:
- **Token Budget Analysis** - Usage vs budget, efficiency notes
- **Delegation Compliance** - Rate, blockers, bypasses
- **Enforcement Violations** - All blocks and warnings
- **Recommendations** - Prioritized improvements
- **Actionable Items** - Specific follow-up tasks

## Severity Levels

- **High**: >5 blocks OR <30% delegation OR >90% tokens
- **Medium**: >2 blocks OR <50% delegation OR >80% tokens
- **Info**: Everything else

## When to Use

- End of coding session (before closing)
- After completing a project phase
- When `/pm-status` shows concerning metrics
- Before starting new major work

## Review Output

After capture, review with:
```bash
/audit-review pm-session-<id>
```

## Related Commands

- `/pm-status` - Live dashboard (current state)
- `/process-audit` - Full workflow analysis (post-session)
- `/audit-status` - View all pending audits

# PM Enforcement System

## Overview

The Program Manager enforces workflow compliance through configurable rules. Enforcement levels can be adjusted per-rule.

## Enforcement Config

File: `.claude/.pm-enforcement-config.json`

### Enforcement Modes

- **off**: Rule disabled, no checking
- **warn**: Log violations, allow operation (metrics only)
- **block**: Prevent operation, require override

### Current Rules

| Rule | Default | Description |
|------|---------|-------------|
| `delegation` | warn | Suggests delegating tasks to local models |
| `multiFileGate` | block | Requires EnterPlanMode for 4+ files |
| `timeEstimates` | warn | Detects time estimates in plans |
| `tokenBudget` | block | Enforces 28k token threshold |

## Changing Enforcement Levels

### Enable Blocking for Delegation

Edit `.pm-enforcement-config.json`:
```json
{
  "rules": {
    "delegation": {
      "enabled": true,
      "mode": "block"  // Changed from "warn"
    }
  }
}
```

### Disable a Rule

```json
{
  "rules": {
    "timeEstimates": {
      "enabled": false,
      "mode": "off"
    }
  }
}
```

## Override Commands

When blocked by enforcement:

```bash
# Override delegation for current task
/pm-override delegation

# Override multi-file gate
/pm-override multifile

# Override token budget
/pm-override budget
```

## Viewing Enforcement Results

### Real-time Dashboard
```bash
/pm-status
```

Shows:
- Token budget usage
- Delegation compliance rate
- Files modified count
- Active warnings and blocks

### Session Audit
```bash
/pm-audit
```

Generates detailed audit report in `.claude/audits/pending/` with:
- Token efficiency analysis
- Delegation breakdown
- Enforcement violation details
- Recommendations

### Review Audit
```bash
/audit-review pm-session-<id>
```

## Enforcement Flow

```
1. Tool called (Write/Edit) →
2. PreToolUse hooks fire →
   - pm-multi-file-gate checks file count
   - delegation-enforcer classifies task
3. Check enforcement config →
   - "warn": Log + allow
   - "block": Show message + prevent
4. PostToolUse hooks fire →
   - pm-session-tracker updates state
   - pm-time-estimate-detector scans content
5. State saved to .pm-state.json →
6. Dashboard/audit access results
```

## Best Practices

1. **Start with "warn"** - Observe patterns before blocking
2. **Review audits regularly** - Use `/pm-audit` at session end
3. **Use [CLAUDE] tag** - Bypass delegation for complex tasks
4. **Check `/pm-status`** - Monitor compliance during work
5. **Adjust thresholds** - Tune rules to your workflow

## Troubleshooting

### Hook Interruptions
If hooks pause conversation:
- Add `[CLAUDE]` tag to bypass enforcement
- Or temporarily set mode to "off"

### Token Tracking Shows 0
Known limitation: Token usage estimates are not accumulated.
Actual usage shown in Claude Code system messages only.

### Files Not Counted
Fixed in latest version. If issue persists:
```bash
bash scripts/pm-dashboard.sh
```
Should show correct file count from PM state.

## Related Files

- `.claude/.pm-state.json` - Current session state
- `.claude/.pm-enforcement-config.json` - Enforcement rules
- `.claude/audits/pending/pm-session-*.md` - Audit reports
- `scripts/pm-dashboard.sh` - Dashboard generator
- `scripts/pm-audit-capture.sh` - Audit generator

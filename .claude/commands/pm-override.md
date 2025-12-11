---
description: Override Program Manager enforcement rules (logged for review)
argument-hint: [rule-type]
---

# PM Override Command

Temporarily override Program Manager enforcement rules for specific scenarios.

**IMPORTANT**: All overrides are logged and included in Process Specialist reviews.

## Usage

```bash
/pm-override delegation   # Allow Claude to write without delegation
/pm-override budget       # Allow exceeding token budget (this session)
/pm-override multifile    # Allow 4+ files without EnterPlanMode
/pm-override all          # Override all rules (use sparingly!)
```

## Override Types

### Delegation Override
**When to use**: Task requires Claude's full context/reasoning despite being simple.

```bash
/pm-override delegation
```

**Effect**: Next Write/Edit will bypass delegation enforcer
**Duration**: Single operation
**Logged as**: `delegation_override` with reason

**Example scenarios**:
- Debugging requires full project context
- Security-sensitive code review
- Architecture decision needs human reasoning

---

### Budget Override
**When to use**: Critical work must continue despite token limit.

```bash
/pm-override budget
```

**Effect**: Allows tools to run beyond 28k token threshold
**Duration**: Remainder of session
**Logged as**: `budget_override` with token count

**Warning**: May lead to context truncation beyond 200k tokens.

**Example scenarios**:
- Finishing critical bug fix
- Completing atomic feature (can't pause mid-work)
- Emergency production issue

---

### Multi-File Override
**When to use**: Need to modify 4+ files without formal plan.

```bash
/pm-override multifile
```

**Effect**: Disables 4+ file gate for this session
**Duration**: Remainder of session
**Logged as**: `multifile_override` with file count

**Warning**: Increases risk of incomplete/inconsistent changes.

**Example scenarios**:
- Simple refactor across many files (e.g., rename constant)
- Batch documentation updates
- Urgent hotfix affecting multiple files

---

### All Rules Override
**When to use**: Experimental work, rapid prototyping, emergency situations.

```bash
/pm-override all
```

**Effect**: Disables ALL Program Manager enforcement
**Duration**: Remainder of session
**Logged as**: `all_override` with timestamp

**⚠️ WARNING**: Use only when absolutely necessary. Defeats purpose of PM agent.

**Example scenarios**:
- Rapid prototyping session
- Experimental feature exploration
- True emergency (production down)

---

## How Overrides Work

1. **Create override file**: `.claude/.pm-override.json` with rule type and timestamp
2. **Hooks check override**: Before enforcing, hooks read override file
3. **Log the bypass**: All overrides logged to `.claude/metrics/pm-overrides.log`
4. **Process Specialist review**: Overrides analyzed in efficiency audits

## Override File Format

```json
{
  "delegation": false,
  "budget": false,
  "multifile": false,
  "all": false,
  "timestamp": "2025-12-11T18:30:00Z",
  "reason": "User requested via /pm-override"
}
```

## Clearing Overrides

Overrides automatically clear when:
- Session ends (state reset)
- New session starts
- Manual clear: `rm .claude/.pm-override.json`

Or use:
```bash
/pm-override clear
```

---

## Best Practices

### DO Use Overrides When:
✅ Rules block legitimate edge cases
✅ Emergency situations require fast action
✅ Experimental work needs freedom
✅ You understand the tradeoffs

### DON'T Use Overrides When:
❌ Too lazy to delegate properly
❌ Don't want to use EnterPlanMode
❌ Trying to "game" the system
❌ Could solve by better task decomposition

---

## Metrics & Review

All overrides are tracked in:

**Override Log** (`.claude/metrics/pm-overrides.log`):
```
[2025-12-11T18:30:00Z] OVERRIDE | Type: budget | Reason: Critical bug fix | Tokens: 29500
[2025-12-11T18:45:00Z] OVERRIDE | Type: multifile | Reason: Rename constant across 8 files | Files: 8
```

**Process Specialist Analysis**:
- Override frequency patterns
- Legitimate vs. convenience overrides
- Rule adjustment recommendations
- Training opportunities

---

## Examples

### Example 1: Delegation Override
```bash
# Task: Debug complex state issue requiring full context
/pm-override delegation

# Now can write directly without delegation warning
# (but still good practice to try delegation first!)
```

### Example 2: Budget Override
```bash
# Situation: At 28,500 tokens, need to finish feature
/pm-override budget

# Continue working despite exceeding threshold
# (but plan to wrap up soon!)
```

### Example 3: Clear All Overrides
```bash
# Reset to normal enforcement
/pm-override clear

# Or manually
rm .claude/.pm-override.json
```

---

## Related Commands

- `/pm-status` - Check current override status
- `/session-advisor` - Get guidance on session continuation
- `/process-audit` - Review override patterns

---

## Implementation Notes

The override system is implemented via:
1. **Command creates file**: `/pm-override <type>` writes `.pm-override.json`
2. **Hooks read file**: Each enforcement hook checks for overrides
3. **Metrics logged**: Overrides recorded in metrics files
4. **Auto-cleanup**: File cleared on session reset

**File location**: `.claude/.pm-override.json` (gitignored)

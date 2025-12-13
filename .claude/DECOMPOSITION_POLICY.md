# Decomposition Policy - Index

The delegation system is documented across modular policy files. This index guides you to the right resource.

## Quick Navigation

**New to the system?** Read in this order:
1. `.claude/policy/PRINCIPLES.md` - Understand the core philosophy (5 min read)
2. `.claude/policy/TASK_TYPES.md` - Learn task classifications (5 min read)
3. `.claude/policy/TASK_FORMAT.md` - Study the JSON schema (10 min read)
4. `.claude/policy/ESCALATION.md` - Understand permission workflow (5 min read)

## Policy Modules

| File | Purpose | Audience |
|------|---------|----------|
| `.claude/policy/PRINCIPLES.md` | Core philosophy & Claude's four roles | Everyone |
| `.claude/policy/TASK_TYPES.md` | Task complexity types (A/B/C/D) | Task decomposers |
| `.claude/policy/TASK_FORMAT.md` | `///LOCAL_TASKS` JSON schema | Task creators |
| `.claude/policy/ESCALATION.md` | Permission request protocol | Escalation scenarios |

## Configuration Files

| File | Purpose |
|------|---------|
| `.claude/config/atomic-limits.json` | Tunable atomic task limits (files, lines, effort) |
| `.claude/config/prompts/type-a.md` | Mechanical edit prompt template |
| `.claude/config/prompts/type-b.md` | Template fill prompt template |
| `.claude/config/prompts/type-c.md` | Creative generation prompt template |

## Atomic Task Limits

**A task is atomic if ALL criteria are met:**

| Criterion | Limit |
|-----------|-------|
| files_touched | <= 3 |
| est_lines_changed | <= 300 |
| est_local_effort_mins | <= 60 |
| test_command | Required |

If any criterion fails, decompose immediately.

See `.claude/config/atomic-limits.json` for configuration.

## Task JSON Schema

Tasks use the `///LOCAL_TASKS` JSON format with fields:
- `id`, `title`, `description` - Task identity
- `files_touched`, `est_lines_changed`, `est_local_effort_mins` - Atomic criteria
- `test_command` - Verification command
- `assigned_to` - Target local model (e.g., `local:qwen`)
- `inputs`, `outputs`, `constraints` - Specifications
- `needs_context` - Exact line ranges from other files

See `.claude/policy/TASK_FORMAT.md` for complete schema.

## Quick Reference

| Command | Purpose |
|---------|---------|
| `node scripts/dispatcher.cjs add-tasks < tasks.json` | Add tasks to backlog |
| `node scripts/dispatcher.cjs assign-next` | Assign next open task |
| `node scripts/dispatcher.cjs status` | View backlog status |
| `node scripts/dispatcher.cjs audit` | Validate all tasks |

| File | Purpose |
|------|---------|
| `.claude/backlog.json` | Machine-readable task queue |
| `.claude/schemas/local-task.schema.json` | Task validation schema |
| `scripts/dispatcher.cjs` | Task assignment CLI |

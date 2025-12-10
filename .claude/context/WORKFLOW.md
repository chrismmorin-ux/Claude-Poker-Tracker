# Workflow Reference
**For**: Project continuity, local model delegation, documentation sync

## Starting New Work Checklist
1. **Read BACKLOG.md** - Single source of truth for work tracking
2. **Create project file** - `/project start <name>` for multi-file tasks
3. **Check delegation** - Project file's Task Delegation table determines who implements
4. **Read before write** - Read all affected files in parallel first
5. **Plan if complex** - 4+ files or cross-cutting concerns → `EnterPlanMode`

## Planning Mode Guidelines
When using `EnterPlanMode`:
1. **Single source of truth** - Project file (`docs/projects/*.project.md`) is authoritative
2. **Plan file purpose** - Only for local model execution prompts (~100 lines max)
3. **No duplication** - Don't repeat task tables, checklists, or execution orders in plan file
4. **Agent parallelization** - Launch independent agents in single parallel batch
5. **Trim after planning** - Delete redundant plan file content once project file is finalized

## Project Commands
```bash
/project status       # View all projects
/project start <name> # Create new project
/project resume <id>  # Load project context
/project complete <id># Mark complete
/project archive <id> # Move to archive
```

**Files**: `docs/projects/*.project.md` (active), `docs/archive/` (completed)

## Local Model Delegation (MANDATORY)

**User Mandate**: Local models do 80%+ of implementation. Claude plans, decomposes, and reviews.

### Claude's Role
1. **Decompose** user requests into atomic tasks (≤50 lines each)
2. **Create task specs** for each delegable task
3. **Execute** via `./scripts/execute-local-task.sh`
4. **Review** output quality
5. **Only implement directly** if task is non-delegable

### Atomic Task Criteria
A task is delegable to local model if ALL:
- ≤50 lines of code
- ≤2 external imports
- Affects 1 file only
- Stateless or simple logic
- Has clear constraints

### Task Spec Format
```json
{
  "task_id": "T-XXX",
  "model": "deepseek",
  "description": "Specific, clear description",
  "output_file": "src/path/to/file.js",
  "context_files": ["relevant/file.js"],
  "constraints": ["Export named function", "Include JSDoc"],
  "test_command": "npx vitest run path/to/test",
  "language": "javascript"
}
```

### Execution Flow
```bash
# 1. Create task spec
# 2. Execute
./scripts/execute-local-task.sh .claude/task-specs/T-XXX.json
# 3. Review output
# 4. If quality issues: revise spec and retry (1x) or implement directly
```

### Non-Delegable (Claude implements)
- Reducers, custom hooks, state management
- Multi-file changes, integration code
- Bug fixes (need root cause analysis)
- Tasks requiring deep context understanding

### Model Selection
| Model | Best For |
|-------|----------|
| `deepseek` | New code generation, utilities |
| `qwen` | Refactoring, documentation, tests |

## Documentation Sync

### Update Requirements
| Source Change | Update |
|---------------|--------|
| `src/constants/` | CLAUDE.md, QUICK_REF.md |
| `src/hooks/` | CLAUDE.md, QUICK_REF.md |
| `src/reducers/` | STATE_SCHEMAS.md |
| New features | CHANGELOG.md |

### Version Bump Checklist
- [ ] CLAUDE.md header + Architecture section
- [ ] docs/QUICK_REF.md header
- [ ] docs/CHANGELOG.md entry

## Post-Edit Workflow
1. **3+ files modified** → `/review staged`
2. **Reducer changed** → `npm test`
3. **State shape changed** → Update STATE_SCHEMAS.md
4. **New constants** → Update QUICK_REF.md

## Hooks Reference
| Hook | Purpose |
|------|---------|
| `backlog-check` | Session start reminder |
| `delegation-check` | Warns on policy violations |
| `docs-sync` | Tracks source→doc staleness |
| `efficiency-tracker` | Session metrics |
| `project-status` | Shows active projects |

## Process Learnings (Updated 2025-12-10)

### PROC-001: Single Source of Truth
- Project file is authoritative; plan file is execution notes only
- Avoid duplicating task tables, phase lists, verification checklists

### PROC-002: Agent Parallelization
- Before launching agents, list dependencies explicitly
- Independent agents → single parallel batch
- Dependent agents → wait for prerequisites

### PROC-003: Backlog Consistency
- Phase counts in BACKLOG.md must match project file
- Verify after any project file update

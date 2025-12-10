# Workflow Reference
**For**: Project continuity, local model delegation, documentation sync

## Starting New Work Checklist
1. **Read BACKLOG.md** - Single source of truth for work tracking
2. **Create project file** - `/project start <name>` for multi-file tasks
3. **Check delegation** - Project file's Task Delegation table determines who implements
4. **Read before write** - Read all affected files in parallel first
5. **Plan if complex** - 4+ files or cross-cutting concerns → `EnterPlanMode`

## Project Commands
```bash
/project status       # View all projects
/project start <name> # Create new project
/project resume <id>  # Load project context
/project complete <id># Mark complete
/project archive <id> # Move to archive
```

**Files**: `docs/projects/*.project.md` (active), `docs/archive/` (completed)

## Local Model Delegation

### When to Delegate (Use `/local-*`)
| Task | Command |
|------|---------|
| Utility function (<80 lines) | `/local-code` |
| Simple UI component (<100 lines) | `/local-code` |
| Refactoring/renaming | `/local-refactor` |
| JSDoc/comments | `/local-doc` |
| Unit tests | `/local-test` |

### When Claude Implements
- Reducer logic, custom hooks, state management
- Multi-file changes, integration code
- Core persistence/hydration (needs permission)

### Commands
```bash
/route <task>         # Get recommendation
/local <task>         # Auto-route
/local-code <task>    # DeepSeek: new code
/local-refactor <task># Qwen: refactoring
/local-doc <task>     # Qwen: docs
/local-test <task>    # Qwen: tests
```

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

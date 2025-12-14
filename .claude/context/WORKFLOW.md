# Workflow Reference
**For**: Project continuity, local model delegation, documentation sync

## Starting New Work Checklist
1. **Session startup** - Review menu or run `/start` to see options
2. **Check audits** - `/audit-status` for pending reviews
3. **Read BACKLOG.md** - Single source of truth for work tracking
4. **Check project queue** - `/project-queue` for priority order
5. **Create project file** - `/project start <name>` for multi-file tasks
6. **Check delegation** - Project file's Task Delegation table determines who implements
7. **Read before write** - Read all affected files in parallel first
8. **Plan if complex** - 4+ files or cross-cutting concerns → `EnterPlanMode`

## Planning Mode Guidelines
When using `EnterPlanMode`:
1. **Single source of truth** - Project file (`docs/projects/*.project.md`) is authoritative
2. **Plan file purpose** - Only for local model execution prompts (~100 lines max)
3. **No duplication** - Don't repeat task tables, checklists, or execution orders in plan file
4. **Agent parallelization** - Launch independent agents in single parallel batch
5. **Trim after planning** - Delete redundant plan file content once project file is finalized

## Project Commands
```bash
/project-queue        # View project queue (new!)
/project status       # View all projects
/project start <name> # Create new project
/project resume <id>  # Load project context
/project complete <id># Mark complete
/project archive <id> # Move to archive
```

**Files**: `docs/projects/{priority}.{sequence}.{MMDD}-{name}.project.md` (active), `docs/archive/` (completed)

**Format**: `1.001.1211-program-manager.project.md` = P1, 1st P1 project, Dec 11

## Audit System (NEW)

**Purpose**: Persistent tracking of audit reports (token optimization, CTO reviews, process audits, etc.)

### Audit Commands
```bash
/audit-status         # View pending audits
/audit-review [id]    # Process/action an audit
/audit-log <type> "title"  # Manual audit capture (usually auto-captured)
```

### How It Works
1. **Auto-capture**: Audits from `/cto-review`, `/process-audit`, etc. saved automatically
2. **Queue**: Pending audits tracked in `.claude/audits/registry.json`
3. **Review**: Use `/audit-review` to create backlog items or dismiss
4. **Tracking**: Audits linked to tasks for full audit trail

**Files**: `.claude/audits/{pending,actioned,dismissed}/`, `registry.json`

**File Naming**: `{type}.{sequence}.{MMDD}-{title}.md`
- Groups by type: `ls cto-review.*` shows all CTO audits
- Example: `cto-review.001.1211-architecture-concerns.md`
- Sequence per type: cto-review.001, cto-review.002, ...

**Archive**: Actioned/dismissed audits move to respective folders but stay searchable

## Multi-Agent Architecture (MANDATORY)

Claude Primary (this session) has **NO file write permissions**. All modifications must route through the Dispatcher agent.

### Agent Roles

| Agent | Model | Purpose | Permissions |
|-------|-------|---------|-------------|
| Primary | opus | Plan, decompose, request | Read, Search, TodoWrite |
| Dispatcher | haiku | Evaluate, execute, escalate | Read, Write, Edit, Bash |
| Worker | sonnet | Execute approved escalations | Task-specific files only |

### Workflow

1. Claude Primary decomposes task into atomic pieces
2. Claude Primary calls `Task(subagent_type="dispatcher")`
3. Dispatcher evaluates: Is task in backlog? Assigned? Policy-compliant?
4. Dispatcher executes via local model OR creates permission request
5. If human approves, Dispatcher spawns Worker agent
6. Worker executes single task and terminates

### Local Model Limitations (Phase 3 Learnings)

**FP-001: Size Guard Limitation**

Local models cannot reliably make incremental edits to files exceeding 200 lines. When a file is too large, the model tends to output a complete rewrite instead of targeted edits.

| Limitation | Threshold | Recovery |
|------------|-----------|----------|
| Incremental file edits | >200 lines | Escalate to Claude or split into smaller changes |
| FP-001 triggering | File size guard activates | Use edit_strategy='create_new' or escalate |
| Catastrophic rewrite risk | Large files with complex logic | Human review of changes recommended |

**Escalation Path for Size Guard:** Files >200 lines → dispatcher detects → creates permission request → human reviews → escalates to Claude Primary or Worker agent with full-file write capability.

### Permission Structure

**Claude Primary CAN:**
- Read any file
- Search (Glob, Grep)
- Web search/fetch
- Create todos
- Call Dispatcher agent
- Write to `.claude/plans/**` and `docs/projects/*.project.md`

**Claude Primary CANNOT:**
- Write/Edit source files (`src/**`, `scripts/**`)
- Write/Edit hooks (`.claude/hooks/**`)
- Write/Edit config files (`.claude/settings*.json`, etc.)
- Use file-modifying Bash commands
- Spawn Worker agent directly

### Human Approval CLI

```bash
./scripts/approve.sh              # View pending requests
./scripts/approve.sh approve ID   # Approve request
./scripts/approve.sh deny ID      # Deny request
./scripts/approve-menu.sh         # Interactive menu
```

### Key Files

| File | Purpose |
|------|---------|
| `.claude/agents/dispatcher.md` | Dispatcher agent definition |
| `.claude/agents/worker.md` | Worker agent definition |
| `.claude/dispatcher-state.json` | Request log and audit trail |
| `.claude/permission-requests.json` | Escalation queue |
| `scripts/approve.sh` | Human approval CLI |

## Local Model Delegation (Via Dispatcher)

> **Full Policy**: See `.claude/DECOMPOSITION_POLICY.md` Section 10 for authoritative rules

**CRITICAL**: Local models are the DEFAULT. Auto-execution is MANDATORY.
**Mindset**: "How do I break this down so local models can do it?" NOT "Can local models do this?"

### Auto-Execution Workflow (NEW)

**When you encounter ANY task:**
1. Decompose into atomic tasks (if not already decomposed)
2. Create ///LOCAL_TASKS JSON specs
3. **Execute automatically via local models** - NO asking, NO confirmation
4. Report progress only: "Task T-001 completed"
5. On failure: recursive decomposition per policy
6. Continue to next task

**DO NOT ask:** "Should I execute these tasks?"
**DO NOT explain:** "I'm going to execute 6 tasks..."
**JUST DO IT:** Silent execution with progress reports only

### The Decomposition Imperative
EVERY task MUST be decomposed into atomic sub-tasks. No exceptions.
- A "big" task is just many small tasks
- If a task seems too complex, decompose further
- Keep decomposing until each piece is ≤30 lines of focused code
- ALL tasks (project, backlog, ad-hoc) must be decomposed

### Claude's Role (STRICTLY LIMITED)
1. **DECOMPOSE** - Break ANY task into atomic pieces (≤30 lines each)
2. **AUTO-EXECUTE** - Create specs and execute via local models automatically
3. **REVIEW** - Check output quality, integrate pieces
4. **ESCALATE ONLY IF**: Task fails twice with good specs, OR requires real-time debugging

**NEVER bypass delegation with "velocity" arguments** - see DECOMPOSITION_POLICY.md Section 10

### What Local Models CAN Do (EXPANDED)
Local models handle ALL of these:
- **Components**: Any React component, any size (decompose into render sections)
- **Hooks**: Custom hooks (decompose: state logic, effect logic, return value)
- **Reducers**: Action handlers (one action = one task)
- **Utils**: Any utility function
- **Tests**: Unit tests, integration tests
- **Refactoring**: Rename, extract, restructure
- **State logic**: Context providers, state updates
- **UI changes**: Styling, layout, conditional rendering
- **Documentation**: JSDoc, comments, README updates

### Decomposition Examples

**"Update ActionPanel with new buttons"** decomposes to:
1. T-001: Create `getValidActions(street, hasBet, isMultiSeat)` helper (15 lines)
2. T-002: Create `PrimitiveActionButton` component (20 lines)
3. T-003: Create `hasBetOnStreet(seatActions, street)` detection function (10 lines)
4. T-004: Update ActionPanel render to use new components (25 lines)
5. T-005: Update button click handlers to record primitives only (15 lines)
6. T-006: Write tests for getValidActions (20 lines)

**"Add dark mode"** decomposes to:
1. T-001: Create ThemeContext with light/dark state (20 lines)
2. T-002: Create useTheme hook (10 lines)
3. T-003: Create ThemeToggle component (15 lines)
4. T-004: Update App.jsx to wrap with ThemeProvider (10 lines)
5. T-005: Create dark mode CSS variables (25 lines)
6. T-006-N: Update each component's styles (one task per component)

### ///LOCAL_TASKS Format

> **Schema**: `.claude/schemas/local-task.schema.json`
> **Full spec**: `.claude/DECOMPOSITION_POLICY.md` Section 3

**Atomic Criteria** (ALL must pass):
| Criterion | Limit |
|-----------|-------|
| `files_touched` | ≤ 3 |
| `est_lines_changed` | ≤ 300 |
| `test_command` | Required |
| `est_local_effort_mins` | ≤ 60 |

```json
///LOCAL_TASKS
[{
  "id": "T-001",
  "title": "Create getValidActions helper",
  "description": "Returns array of valid primitive actions",
  "files_touched": ["src/utils/actionUtils.js"],
  "est_lines_changed": 25,
  "test_command": "npm test src/utils/__tests__/actionUtils.test.js",
  "assigned_to": "local:deepseek",
  "priority": "P1",
  "status": "open"
}]
```

### Execution Flow (Via Dispatcher)
```bash
# All tasks route through Dispatcher agent:
# 1. Claude Primary: Decompose into atomic tasks (≤30 lines each)
# 2. Claude Primary: Call Task(subagent_type="dispatcher", prompt="Execute T-XXX")
# 3. Dispatcher: Validates task is in backlog, assigned, policy-compliant
# 4. Dispatcher: Check file sizes - if any file >200 lines, create permission request
#    (FP-001 size guard: local models cannot reliably edit large files)
# 5. Dispatcher: Executes via local model OR creates permission request
# 6. On failure: Dispatcher retries with auto-recovery (max 3 attempts)
# 7. If max attempts OR size guard triggered: Permission request → human approval → Worker agent
# 8. Report: "Task T-XXX completed" or "Task T-XXX failed"
```

### Claude Implements Directly ONLY When
- Task has failed twice with well-written specs
- Real-time interactive debugging needed
- Cross-cutting concern spanning 5+ tightly-coupled files
- Security-critical code requiring careful review

**If you find yourself implementing directly, ASK: "Could I have decomposed this better?"**

### Model Selection
| Model | Best For |
|-------|----------|
| `deepseek` | New code, components, complex logic |
| `qwen` | Refactoring, tests, documentation, simple modifications |

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
2. **Before commit** → `bash scripts/smart-test-runner.sh` (token-optimized)
3. **Reducer changed** → Run tests (see #2)
4. **State shape changed** → Update STATE_SCHEMAS.md
5. **New constants** → Update QUICK_REF.md

**Note**: Use `npm test` only for detailed debugging. Smart runner is mandatory for commits.

## Hooks Reference
| Hook | Purpose |
|------|---------|
| `write-gate.cjs` | Blocks unauthorized writes (exempts plan/project files) |
| `backlog-check` | Session start reminder |
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

## Token Optimization Practices (Project 0.007 Learnings)

### Phase 1: Token Tracking Foundation
- `~/.claude/stats-cache.json` contains actual API token data
- Session finalization via `scripts/finalize-session.cjs` captures historical trends
- Dashboard shows 7-day/30-day trends from `.claude/data/token-history.json`

### Phase 2: Backlog Optimization
- Archive completed tasks to `.claude/backlog-archive.json` (3500+ lines archived)
- `write-gate.cjs` uses O(1) file-to-task index (was O(n) scan)
- Archive utility: `node scripts/archive-backlog-tasks.cjs`

### Phase 3: Dispatcher Context Optimization
- Backlog loaded once per session (caching added)
- All tasks use `needs_context` protocol (minimal context injection)
- Execution format stripped of unused fields (test_first removed)
- Local models escalate files >200 lines to Claude (FP-001 guard)

### Smart Test Runner
Always use `bash scripts/smart-test-runner.sh` before commits:
- Passing tests: ~100 tokens (compact summary)
- Failing tests: Full error context with file locations
- 98% token reduction on typical test runs

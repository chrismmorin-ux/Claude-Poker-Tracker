# CLAUDE.md - Project Context for Claude Code

## TOKEN OPTIMIZATION RULES (MANDATORY)

### Session Budget
- **Budget**: 30,000 tokens/session (aggressive)
- **Warning**: 24,000 tokens (80%)
- **Block**: 30,000 tokens (requires permission)

### Before ANY Code Task
1. **Check Index First**: Read `.claude/index/SYMBOLS.md` before searching
2. **Scan Before Drill**: Use Grep/Glob BEFORE Read tool
3. **Auto-Execute Tasks (MANDATORY)**: For ANY task:
   - Decompose into atomic tasks (if not already)
   - Create ///LOCAL_TASKS JSON specs
   - **Execute automatically via local models** - NO asking
   - Report progress only: "Task T-001 completed"
   - On failure: recursive decomposition per policy
   - **NEVER ask "should I execute?"** - just execute
   - **NEVER justify bypassing with "velocity" arguments**
   - **Full policy**: `.claude/DECOMPOSITION_POLICY.md` Section 10

### Context Hierarchy (Use in Order)
1. `.claude/index/*.md` - File/symbol lookups (~800 tokens total)
2. `.claude/context/*.md` - Domain summaries (~2000 tokens total)
3. Source files - Only after above exhausted

### Exploration Protocol: Scan Then Drill
```
SCAN FIRST: Grep/Glob to find files (no Read)
THEN DRILL: Read only matched files, only relevant sections
NEVER: Read full large files without scanning first
```

### Pre-Search Index Check
Before launching Explore agent or searching:
1. Is answer in `.claude/index/SYMBOLS.md`? → Return directly
2. Is answer in `.claude/context/*.md`? → Return directly
3. Is this a "where is X" question? → Grep/Glob only, no agent
4. Only launch Explore agent if above fail

### Explore Agent Budget Tiers
| Mode | Max Files | Max Lines/File | Use Case |
|------|-----------|----------------|----------|
| quick | 3 | 50 | Simple lookups, "where is X" |
| medium | 8 | 100 | Feature understanding |
| thorough | 15 | 200 | Architecture analysis |

**Default**: `quick` - Specify in agent prompt: `Explore (medium): ...`

See `.claude/agents/explore-agent-rules.md` for full guidelines.

### Batch Operations
- Group similar tasks before decomposition
- Use parallel tool calls for independent operations
- Prefer one agent with multiple questions over multiple agents

### Smart Test Runner (Token Optimization)
**ALWAYS use token-optimized test runner before commits:**
```bash
bash scripts/smart-test-runner.sh  # 98% token reduction on passing tests
```
- **Passing tests**: Compact summary only (~100 tokens vs ~5000 tokens)
- **Failing tests**: Detailed error context with file locations
- See `docs/TOKEN_OPTIMIZED_TESTING.md` for details

---

## ⚠️ LOCAL MODEL DELEGATION - MANDATORY ENFORCEMENT ⚠️

**CRITICAL:** All code generation tasks MUST be delegated to local models. Direct file creation/editing by Claude is **BLOCKED** by PreToolUse hooks.

### Mandatory Rules

1. **NEVER bypass delegation** - Hooks will block Write/Edit operations for files assigned to local models
2. **ALWAYS use dispatcher workflow** - See `.claude/DECOMPOSITION_POLICY.md` Section 10
3. **NO "velocity" justifications** - Delegation INCREASES velocity (6x capacity improvement)

### Forbidden Justifications

❌ "To maintain velocity" - BLOCKED (delegation is faster)
❌ "Local model failed" - FIX the issue, don't bypass
❌ "Simple task" - ALL tasks must be delegated per atomic criteria

### Correct Workflow

1. **Decompose** task into atomic units (see `.claude/DECOMPOSITION_POLICY.md`)
2. **Create** ///LOCAL_TASKS JSON specification
3. **Execute** via dispatcher:
   ```bash
   cat tasks.json | node scripts/dispatcher.cjs add-tasks
   node scripts/dispatcher.cjs assign-next
   ```
4. **Integrate** output and test

### Enforcement Mechanisms

- ✅ **PreToolUse hooks** - Block Write/Edit before execution
- ✅ **PostToolUse hooks** - Detect violations and create locks
- ✅ **Violation locks** - Require dispatcher redo to clear
- ✅ **Token tracking** - Log efficiency violations

### Quick Commands

```bash
# Add tasks to dispatcher
cat tasks.json | node scripts/dispatcher.cjs add-tasks

# Execute next task
node scripts/dispatcher.cjs assign-next

# Check status
node scripts/dispatcher.cjs status
```

**Policy Reference:** `.claude/DECOMPOSITION_POLICY.md` Section 10
**Quickstart Guide:** `.claude/DISPATCHER_QUICKSTART.md` (if exists)

---

## Project Overview
Poker Tracker - A React-based hand tracker for live 9-handed poker games.

## Quick Start

### Context Files (Read First!)
**Prefer `.claude/context/*.md` files** over raw source files:
```
.claude/context/
├── CONTEXT_SUMMARY.md      # Project overview (~400 tokens)
├── STATE_SCHEMA.md         # All 5 reducer shapes (~500 tokens)
├── PERSISTENCE_OVERVIEW.md # IndexedDB API summary (~400 tokens)
├── RECENT_CHANGES.md       # Last 4 version changes (~350 tokens)
├── HOTSPOTS.md             # Critical/fragile files (~400 tokens)
└── WORKFLOW.md             # Project continuity, delegation, docs sync (~500 tokens)
```

### Full Documentation
- `docs/SPEC.md` - Complete specification
- `docs/QUICK_REF.md` - Fast lookups (constants, hooks, utils)
- `docs/DEBUGGING.md` - Error codes
- `docs/STATE_SCHEMAS.md` - State shapes

## Starting New Work
> **Full workflow details:** `.claude/context/WORKFLOW.md`

**Quick checklist:**
1. Read `.claude/BACKLOG.md` (single source of truth)
2. `/project start <name>` for multi-file tasks
3. **Auto-execute pre-decomposed tasks** - if project has tasks with model assignments, execute automatically (no asking)
4. **Decompose new tasks** - if task not decomposed, decompose into atomic tasks then auto-execute
5. Read all affected files first (use index/context files)
6. 4+ files → `EnterPlanMode`

**When you select a project from menu:**
- Project has pre-decomposed tasks → Execute automatically
- Show progress: "Task T-001 completed", "Task T-002 failed"
- NO asking "should I proceed?" - policy mandates auto-execution

## Key Commands
```bash
npm install                          # Install dependencies
npm run dev                          # Start dev server (localhost:5173)
npm run build                        # Production build
bash scripts/smart-test-runner.sh    # Run tests (token-optimized, use for commits)
npm test                             # Run tests (verbose, use for detailed debugging)
```

## Architecture (v117)
> **Detailed info:** `.claude/context/CONTEXT_SUMMARY.md`

**Main Structure:**
- `src/PokerTracker.jsx` (~620 lines) - Main component
- `src/contexts/` - 5 context providers (Game, UI, Session, Player, Settings)
- `src/reducers/` - 6 reducers (game, ui, card, session, player, settings)
- `src/hooks/` - 12 custom hooks
- `src/components/views/` - 8 view components
- `src/components/ui/` - 16 UI components
- `src/utils/` - Utility functions + persistence layer (IndexedDB v8)

**Key Constants:** `ACTIONS.*`, `SEAT_ARRAY`, `SCREEN.*`

## Common Tasks

### Adding a New Action
1. Add to `ACTIONS` in `src/constants/gameConstants.js`
2. Add to `getActionDisplayName()` in `src/utils/actionUtils.js`
3. Add to `getActionColor()` and `getSeatActionStyle()` in `src/utils/actionUtils.js`

### Modifying Card Display
```javascript
import { CardSlot } from './components/ui/CardSlot';
<CardSlot card="A♠" variant="table" SEAT_STATUS={SEAT_STATUS} />
```

### Debug Mode
Set `DEBUG = false` at line 8 to disable console logging.

## Important Rules
- ALL action recordings use `ACTIONS.*` constants
- Use `SEAT_ARRAY` for seat iteration (not hardcoded arrays)
- Use `CONSTANTS.NUM_SEATS` for seat limits (not hardcoded 9)
- Import UI components from `src/components/ui/`
- **State updates**: Use reducer dispatch functions, never direct setters
- **Handlers**: Wrap in `useCallback` with correct dependencies
- **Function order**: Define helpers BEFORE dependent callbacks

## Important Patterns
**useCallback Pattern:**
1. Use `useCallback` for functions passed as props
2. Include all external dependencies in the array
3. Define helper functions BEFORE dependent callbacks

**Import Pattern:** Utils use dependency injection (constants passed as parameters)

## Responsive Design
- Design dimensions: 1600x720 (Samsung Galaxy A22 landscape)
- Scale: `min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`

## Testing Changes
Test all 7 views: Table, Card Selector, Showdown, Stats, Sessions, Players, Settings

## Version History
> **Full history:** `docs/CHANGELOG.md` | **Recent:** `.claude/context/RECENT_CHANGES.md`

**v117** (current): Architecture Health Phase 5 - action sequence migration, IndexedDB v8

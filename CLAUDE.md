# CLAUDE.md - Project Context for Claude Code

## Project Overview
Poker Tracker - A React-based hand tracker for live 9-handed poker games.

## Quick Start

### Context Files (Read First!)
**Prefer `.claude/context/*.md` files** over raw source files for initial context:
```
.claude/context/
├── CONTEXT_SUMMARY.md      # Project overview (~400 tokens)
├── STATE_SCHEMA.md         # All 5 reducer shapes (~500 tokens)
├── PERSISTENCE_OVERVIEW.md # IndexedDB API summary (~400 tokens)
├── RECENT_CHANGES.md       # Last 4 version changes (~350 tokens)
└── HOTSPOTS.md            # Critical/fragile files (~400 tokens)
```
Only request full file contents when context summaries are insufficient.

### Full Documentation
1. Read `docs/SPEC.md` first (complete specification)
2. Main code is in `src/PokerTracker.jsx` (~620 lines)
3. View components in `src/components/views/`
4. UI components in `src/components/ui/`
5. Custom hooks in `src/hooks/`
6. Utility functions in `src/utils/`
7. Game constants in `src/constants/`
8. Use `docs/QUICK_REF.md` for fast lookups
9. See `docs/DEBUGGING.md` for error codes and debugging
10. See `docs/STATE_SCHEMAS.md` for state shape reference

## Starting New Work (MANDATORY)

Before writing any code for a multi-file task, follow this checklist:

### 0. Read BACKLOG.md First (CRITICAL)
```bash
Read: .claude/BACKLOG.md
```
**The backlog is the SINGLE SOURCE OF TRUTH** for all work tracking.
- Check "Active Work" for current session tasks
- Check "Active Projects" for ongoing project status
- Update backlog as you work, not just at the end

### 1. Create Project File
```bash
/project start <project-name>
```
This creates a tracking file in `docs/projects/` for progress continuity.

### 2. Check Task Delegation (MANDATORY)
Before writing ANY file, check the project file's **Task Delegation Analysis** table:
- Tasks marked **"Local Model"** or **"Yes"** → Use `/local-*` commands
- Tasks marked **"Claude"** or **"No"** → Claude implements directly
- **NEVER write files marked for local model delegation**

The `delegation-check` hook will warn you if you violate this policy.

### 3. Read Before Write
- Read ALL potentially affected files in parallel at session start
- Use `Task` tool with `Explore` agent for unfamiliar areas
- Never edit a file you haven't read

### 4. Plan Complex Changes
- **4+ files affected?** Use `EnterPlanMode` to map all touch points
- **Cross-cutting concerns?** (reducer + hook + UI) Plan first
- **Data flow changes?** Diagram the flow before coding

### 5. Track Progress
- Update backlog "Current Session Tasks" as you work
- Update project file as phases complete
- Run `/review staged` after 3+ files modified
- Update documentation DURING work, not after

**Hooks enforce these rules:**
- `backlog-check` - Reminds to read BACKLOG.md at session start
- `delegation-check` - Warns when writing files marked for local models
- `new-work-check` - Suggests project creation for multi-file work

---

## Project Continuity System

This codebase uses a project tracking system to maintain continuity across chat sessions.

### On Chat Start
A startup hook checks for active/pending projects and displays status. If you see a project status banner, consider resuming that work.

### Project Commands
```bash
/project status              # Show all projects
/project start <name>        # Create new project
/project resume <id>         # Load project context
/project complete <id>       # Mark complete
/project archive <id>        # Move to archive
```

### Project Files
- **Active projects**: `docs/projects/*.project.md`
- **Archived projects**: `docs/archive/*.project.md`
- **Registry**: `.claude/projects.json`
- **Template**: `docs/projects/TEMPLATE.project.md`

### Workflow
1. Start new work with `/project start <name>`
2. Update project file as phases complete
3. When done, use `/project complete <id>`
4. Archive with `/project archive <id>`

The system will remind you to update project files during significant work sessions.

## Key Commands
```bash
npm install    # Install dependencies
npm run dev    # Start dev server (localhost:5173)
npm run build  # Production build
npm test       # Run test suite (1,617 tests)
```

## Local Model Workflow & Delegation Policy

This project uses local LLM models (via LM Studio) to save Claude tokens on routine tasks. **Claude must delegate by default** and only perform high-level reasoning, decomposition, review, or final sign-off directly.

### Delegation Rules (Enforced)

| Rule | Threshold | Action |
|------|-----------|--------|
| **Default behavior** | All tasks | Decompose and delegate to local models |
| **File complexity** | >3 files touched | Mark `human-review-required`, still delegate |
| **Token cost** | >8k estimated tokens | Must delegate |
| **Deep cross-file reasoning** | Core persistence/reducer/hydration | May require Claude, needs permission |
| **Testing requirement** | All delegated tasks | Must include test command |
| **PR merging** | Never | Agents open PRs, humans merge |

### Decision Flow
Before implementing any task:
1. Run `/route <task description>` to get a recommendation
2. Or use the decision tree:
   - **Simple utility function** (<80 lines, no state) → `/local-code`
   - **Simple React component** (<100 lines, <5 props) → `/local-code`
   - **Refactoring/renaming** → `/local-refactor`
   - **Documentation/comments** → `/local-doc`
   - **Unit tests** → `/local-test`
   - **State/reducers/hooks/integration** → Claude (with permission if complex)

### Local Model Commands
```bash
/route <task>        # Get recommendation on which model to use
/local <task>        # Auto-route to best local model
/local-code <task>   # DeepSeek: new code/boilerplate
/local-refactor <task>  # Qwen: refactoring tasks
/local-doc <task>    # Qwen: documentation/comments
/local-test <task>   # Qwen: unit tests
```

### When to Use Local Models
| Task Type | Use Local? | Command |
|-----------|------------|---------|
| Pure utility function | ✅ Yes | `/local-code` |
| Simple UI component | ✅ Yes | `/local-code` |
| Rename/extract/move | ✅ Yes | `/local-refactor` |
| Add JSDoc comments | ✅ Yes | `/local-doc` |
| Generate test cases | ✅ Yes | `/local-test` |
| Reducer logic | ❌ No | Claude |
| Custom hooks | ❌ No | Claude |
| Multi-file changes | ❌ No | Claude |
| State management | ❌ No | Claude |
| Integration code | ❌ No | Claude |

### Task Output Format (for delegation)
When delegating, Claude outputs tasks in this format:
```
///LOCAL_TASKS
[
  {
    "id": "T-001",
    "title": "Add formatCurrency utility function",
    "inputs": ["src/utils/displayUtils.js"],
    "constraints": ["pure function", "no external deps"],
    "tests": ["npm test src/test/displayUtils.test.js"],
    "priority": "P1",
    "assigned_to": "local:deepseek-coder",
    "expected_patch_format": "unified-diff"
  }
]
```

### Request-for-Permission Flow
If Claude must implement directly (rare), it will output:
```
///CLAUDE_REQUEST_FOR_PERMISSION
{
  "summary": "Implement cross-reducer hydration fix",
  "reason": "Requires understanding of 5 reducer interactions",
  "est_tokens": 4500,
  "acceptance_criteria": ["All 1617 tests pass", "No hydration errors"],
  "mitigation": "Will output tests + diff for human review"
}
```
Respond with `approve` or `deny`.

### After Local Model Generation
1. **Review the output** for correctness
2. **Fix import paths** (local models often get these wrong)
3. **Verify export style** matches project (named exports)
4. **Run tests** to validate functionality
5. **Use Claude to fix** any issues (still saves tokens overall)

### Integration with CTO-Decompose
When `/cto-decompose` assigns `owner: "ai:less-capable"`:
- Map to appropriate `/local-*` command
- These are candidates for local model delegation
- `ai:less-capable` = simple, well-defined tasks

## Documentation Maintenance

Documentation must stay in sync with code changes. A `docs-sync` hook tracks this automatically.

### Doc Update Requirements
When you edit source files, update the corresponding docs:

| Source Change | Docs to Update |
|---------------|----------------|
| `src/constants/` | CLAUDE.md, docs/QUICK_REF.md |
| `src/hooks/` | CLAUDE.md, docs/QUICK_REF.md |
| `src/reducers/` | CLAUDE.md, docs/STATE_SCHEMAS.md |
| `src/utils/` | CLAUDE.md, docs/QUICK_REF.md |
| `src/components/views/` | CLAUDE.md |
| `src/components/ui/` | CLAUDE.md, docs/QUICK_REF.md |
| `.claude/commands/` | CLAUDE.md |
| New features | docs/CHANGELOG.md |
| Version bump | CLAUDE.md, docs/QUICK_REF.md, docs/CHANGELOG.md |

### Documentation Workflow
1. **During work**: The `docs-sync` hook tracks source file edits
2. **Periodic reminder**: After 5+ source edits, you'll see which docs need updating
3. **Before commit**: Hook warns if docs are stale
4. **Update docs**: Update relevant docs before committing

### Key Documentation Files
| File | Purpose | Update When |
|------|---------|-------------|
| `CLAUDE.md` | Architecture overview | Any structural change |
| `docs/QUICK_REF.md` | Quick lookup reference | New constants/hooks/utils |
| `docs/CHANGELOG.md` | Version history | Each version bump |
| `docs/STATE_SCHEMAS.md` | State shapes | Reducer changes |
| `docs/SPEC.md` | Full specification | Major feature changes |
| `engineering_practices.md` | Standards | Process changes |

### Version Bumping Checklist
When incrementing version (e.g., v113 → v114):
- [ ] Update version in CLAUDE.md header and Architecture section
- [ ] Update version in docs/QUICK_REF.md header
- [ ] Add entry to docs/CHANGELOG.md
- [ ] Update `engineering_practices.md` version footer if changed

## Architecture (v116)

> **For detailed architecture information, see:** `.claude/context/CONTEXT_SUMMARY.md`
> **For state shapes, see:** `.claude/context/STATE_SCHEMA.md`
> **For persistence API, see:** `.claude/context/PERSISTENCE_OVERVIEW.md`

### Quick Reference

**Main Structure:**
- `src/PokerTracker.jsx` (~620 lines) - Main component
- `src/contexts/` - 5 context providers (Game, UI, Session, Player, Settings)
- `src/reducers/` - 6 reducers (game, ui, card, session, player, settings)
- `src/hooks/` - 12 custom hooks
- `src/components/views/` - 8 view components
- `src/components/ui/` - 16 UI components
- `src/utils/` - Utility functions + persistence layer (IndexedDB v6)

**Key Constants:**
- `ACTIONS.*` - Poker actions (FOLD, CALL, OPEN, etc.)
- `SEAT_ARRAY` - [1-9] for iteration
- `SCREEN.*` - View identifiers (TABLE, STATS, HISTORY, SESSIONS, PLAYERS, SETTINGS)

### Important Patterns

**useCallback Pattern** - All handlers wrapped with proper dependencies:
1. Use `useCallback` for functions passed as props
2. Include all external dependencies in the array
3. Define helper functions BEFORE dependent callbacks

**Import Pattern** - Utils use dependency injection (constants passed as parameters)

## Common Tasks

### Adding a New Action
1. Add to `ACTIONS` constant in `src/constants/gameConstants.js`
2. Add case to `getActionDisplayName()` in `src/utils/actionUtils.js`
3. Add color to `getActionColor()` and `getSeatActionStyle()` in `src/utils/actionUtils.js`

### Modifying Card Display
Import and use `CardSlot` from `'./components/ui/CardSlot'`:
```javascript
import { CardSlot } from './components/ui/CardSlot';

<CardSlot
  card="A♠"
  variant="table"  // or 'hole-table', 'showdown', 'selector'
  SEAT_STATUS={SEAT_STATUS}  // Pass if using status prop
/>
```

### Debug Mode
Set `DEBUG = false` at line 8 to disable all console logging.

## Important Rules
- ALL action recordings use `ACTIONS.*` constants
- Use `SEAT_ARRAY` for seat iteration (not hardcoded arrays)
- Use `CONSTANTS.NUM_SEATS` for seat limits (not hardcoded 9)
- Import UI components from `src/components/ui/` (don't define inline)
- View components import their own UI components (don't pass as props)
- Pass SEAT_STATUS to CardSlot and DiagonalOverlay when using status
- **State updates**: Use reducer dispatch functions (`dispatchGame`, `dispatchUi`, `dispatchCard`), never direct state setters
- **Handlers**: Wrap all handler functions in `useCallback` with correct dependencies
- **Function order**: Define helper functions BEFORE callbacks that depend on them

## Pre-Implementation Checklist

Before starting implementation, evaluate the task scope:

### Planning Gate
- [ ] **4+ files affected?** → Use `EnterPlanMode` to map all touch points
- [ ] **Cross-cutting concerns?** (reducer + hook + UI) → Plan first to identify dependencies
- [ ] **Data flow changes?** → Diagram the flow before coding to avoid rework

### Local Model Delegation
Identify subtasks that can be delegated to save tokens:
- [ ] **Adding constants** (e.g., `SESSION_ACTIONS.NEW_ACTION`) → `/local-code`
- [ ] **Simple reducer cases** with clear input/output → `/local-code`
- [ ] **Pure utility functions** (<80 lines, no state) → `/local-code`
- [ ] **Timestamp/formatting changes** → `/local-refactor`
- [ ] **JSX templates** with clear spec → `/local-code`

### File Reading Strategy
- [ ] Read all potentially-affected files in parallel at session start
- [ ] Use Explore agent for unknown codebases or unfamiliar patterns

## Post-Edit Workflow

After completing multi-file changes or significant edits:

1. **Code Review**: Run `/review staged` to catch bugs, pattern violations, and style issues
2. **Component Audit**: If you modified React components significantly, run `/audit-component <filepath>`
3. **Documentation**: Check if documentation needs updating (docs-sync hook will remind you)
4. **Tests**: If reducer or hook modified, run `npm test`

### Mandatory Review Triggers
| Trigger | Action |
|---------|--------|
| 3+ files modified | Run `/review staged` |
| Reducer changed | Run `npm test` |
| State shape changed | Update `docs/STATE_SCHEMAS.md` |
| New constants added | Update `docs/QUICK_REF.md` |

### Automatic Reminders
- The `edit-review-suggest` hook suggests `/review staged` after 5+ edits or 200+ lines changed
- The `efficiency-tracker` hook tracks session metrics for workflow analysis

### Efficiency Analysis
Use CTO agent to review work session efficiency:
- Agent usage patterns (did we use appropriate agents?)
- Local model opportunities (could tasks have been delegated?)
- Token efficiency (parallel reads, Explore agent usage)
- Code review gaps

## Responsive Design
The app uses dynamic scaling to fit any browser window size:
- Design dimensions: 1600x720 (Samsung Galaxy A22 landscape)
- Scale calculated on mount and window resize: `min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`
- Mobile-optimized component sizes: badges (16px/28px), seats (40px), cards scaled down
- Card selectors maximized: 90px height cards with large text, no scrolling required

## Testing Changes
Test all 7 views at various browser sizes:
1. Table View (default) - includes player assignment via right-click, collapsible sidebar (NEW in v113)
2. Card Selector (click community/hole cards) - shows current street in header
3. Showdown View (click "showdown" street) - auto-advances to next empty card slot
4. Stats View (click "Stats" button)
5. Sessions View (click "Sessions" button) - manage poker sessions (NEW in v110)
6. Players View (click "Players" button) - manage players, portrait-mode optimized (NEW in v111)
7. Settings View (click "Settings" in sidebar) - app preferences, custom venues (NEW in v115)

## Version History

> **For complete version history, see:** `docs/CHANGELOG.md`
> **For recent changes, see:** `.claude/context/RECENT_CHANGES.md`

### Recent Versions

- **v116** (current): Error Reporting System
  - Error logging to localStorage, error log viewer in Settings
  - Report Bug feature with privacy-safe exports
  - 2310 tests passing

- **v115**: Settings System
  - Full settings persistence (theme, defaults, custom venues)
  - SettingsContext provider, IndexedDB v6

- **v114**: Context Providers
  - 5 contexts to reduce prop drilling (Game, UI, Session, Player, Settings)

- **v113**: UI Polish
  - Collapsible sidebar, dynamic hand count, session timer

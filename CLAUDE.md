# CLAUDE.md - Project Context for Claude Code

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
3. Check Task Delegation table before writing
4. Read all affected files first
5. 4+ files → `EnterPlanMode`

## Key Commands
```bash
npm install    # Install dependencies
npm run dev    # Start dev server (localhost:5173)
npm run build  # Production build
npm test       # Run test suite (2,310 tests)
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

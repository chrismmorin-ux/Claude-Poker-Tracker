# CLAUDE.md - Project Context for Claude Code

## Project Overview
Poker Tracker - A React-based hand tracker for live 9-handed poker games.

## Quick Start
1. Read `docs/SPEC.md` first (complete specification)
2. Main code is in `src/PokerTracker.jsx` (~1957 lines)
3. Use `docs/QUICK_REF.md` for fast lookups

## Key Commands
```bash
npm install    # Install dependencies
npm run dev    # Start dev server (localhost:5173)
npm run build  # Production build
```

## Architecture (v103)

### File Structure
```
src/PokerTracker.jsx
├── Lines 1-10:      Imports + Debug setup
├── Lines 11-107:    Constants (CONSTANTS, ACTIONS, etc.)
├── Lines 109-242:   Helper Functions (11 pure functions)
├── Lines 244-408:   UI Components (CardSlot, PositionBadge, etc.)
└── Lines 410+:      Main Component
```

### Key Constants
- `ACTIONS.*` - All action types (FOLD, CALL, OPEN, etc.)
- `SEAT_ARRAY` - [1,2,3,4,5,6,7,8,9] for iteration
- `CONSTANTS.NUM_SEATS` - Use instead of hardcoded 9
- `SCREEN.TABLE` / `SCREEN.STATS` - View identifiers

### Extracted Components
| Component | Uses | Purpose |
|-----------|------|---------|
| CardSlot | 23 | All card displays |
| PositionBadge | 11 | D, SB, BB, ME badges |
| VisibilityToggle | 4 | Show/hide buttons |
| DiagonalOverlay | 2 | FOLD/ABSENT/MUCK/WON |

### Helper Functions (Outside Component)
- `isFoldAction(action)` - Check if action is fold type
- `getActionColor(action)` - Action → Tailwind classes
- `getSeatActionStyle(action)` - Action → {bg, ring}
- `getOverlayStatus(...)` - Determine overlay status
- `log(...)` - Debug logging (controlled by DEBUG flag)

## Common Tasks

### Adding a New Action
1. Add to `ACTIONS` constant
2. Add case to `getActionDisplayName()`
3. Add color to `getActionColor()` and `getSeatActionStyle()`

### Modifying Card Display
Use `CardSlot` component with variants: `table`, `hole-table`, `showdown`, `selector`

### Debug Mode
Set `DEBUG = false` at line 8 to disable all console logging.

## Important Rules
- ALL action recordings use `ACTIONS.*` constants
- Use `SEAT_ARRAY` for seat iteration (not hardcoded arrays)
- Use `CONSTANTS.NUM_SEATS` for seat limits (not hardcoded 9)
- Use extracted UI components for consistency

## Testing Changes
The app renders at 50% scale in a 1600x720 container. Test all 4 views:
1. Table View (default)
2. Card Selector (click community/hole cards)
3. Showdown View (click "showdown" street)
4. Stats View (click "Stats" button)

## Version History
- v101: Baseline features
- v102: Constants extraction
- v103: Full refactoring (current)

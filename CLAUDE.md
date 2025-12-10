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

### 1. Create Project File
```bash
/project start <project-name>
```
This creates a tracking file in `docs/projects/` for progress continuity.

### 2. Read Before Write
- Read ALL potentially affected files in parallel at session start
- Use `Task` tool with `Explore` agent for unfamiliar areas
- Never edit a file you haven't read

### 3. Plan Complex Changes
- **4+ files affected?** Use `EnterPlanMode` to map all touch points
- **Cross-cutting concerns?** (reducer + hook + UI) Plan first
- **Data flow changes?** Diagram the flow before coding

### 4. Track Progress
- Update project file as phases complete
- Run `/review staged` after 3+ files modified
- Update documentation DURING work, not after

**The `new-work-check` hook will remind you if you forget.**

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

## Architecture (v115)

### File Structure
```
src/
├── PokerTracker.jsx (~620 lines)
│   ├── Lines 1-63:      Imports (React, icons, components, reducers, utils, hooks, constants, contexts)
│   ├── Lines 65-112:    Constants (CONSTANTS, SEAT_POSITIONS, SCREEN - UI-specific only)
│   ├── Lines 114+:      Main Component (reducers, hooks, handlers, context providers, view rendering)
│   └── Note: All game constants extracted to hooks; contexts wrap view components
│
├── contexts/                    (React Context providers - NEW in v114)
│   ├── GameContext.jsx          (Game state + derived: getSmallBlindSeat, getBigBlindSeat, hasSeatFolded)
│   ├── UIContext.jsx            (UI state + handlers: setCurrentScreen, togglePlayerSelection, etc.)
│   ├── SessionContext.jsx       (Session state + handlers: hasActiveSession, updateSessionField)
│   ├── PlayerContext.jsx        (Player state + handlers: getSeatPlayerName, assignPlayerToSeat)
│   ├── SettingsContext.jsx      (Settings state + handlers: updateSetting, allVenues, allGameTypes - NEW in v115)
│   └── index.js                 (Central export)
│
├── constants/                   (Game configuration - NEW in v108)
│   ├── gameConstants.js         (ACTIONS, FOLD_ACTIONS, SEAT_STATUS, STREETS, etc.)
│   ├── sessionConstants.js      (SESSION_ACTIONS, VENUES, GAME_TYPES, SESSION_GOALS - NEW in v110)
│   ├── playerConstants.js       (PLAYER_ACTIONS, ETHNICITY_OPTIONS, BUILD_OPTIONS, STYLE_TAGS - NEW in v111)
│   └── settingsConstants.js     (SETTINGS_ACTIONS, DEFAULT_SETTINGS, THEMES, CARD_SIZES - NEW in v115)
│
├── hooks/                       (Custom hooks - NEW in v108)
│   ├── useActionUtils.js        (Action utility wrappers)
│   ├── useStateSetters.js       (State dispatcher wrappers)
│   ├── useSeatUtils.js          (Seat logic utilities)
│   ├── useSeatColor.js          (Seat color styling)
│   ├── useShowdownHandlers.js   (Showdown handlers)
│   ├── useCardSelection.js      (Card selection logic)
│   ├── useShowdownCardSelection.js (Showdown card selection)
│   ├── usePersistence.js        (IndexedDB auto-save/restore - NEW in v109)
│   ├── useSessionPersistence.js (Session persistence and lifecycle - NEW in v110)
│   ├── usePlayerPersistence.js  (Player persistence and seat assignment - NEW in v111)
│   ├── useToast.js              (Toast notification state management - NEW in v112)
│   └── useSettingsPersistence.js (Settings persistence and handlers - NEW in v115)
│
├── reducers/                    (State management)
│   ├── gameReducer.js           (Game state: street, dealer, actions)
│   ├── uiReducer.js             (UI state: view, selection, context menu)
│   ├── cardReducer.js           (Card state: community, hole, showdown)
│   ├── sessionReducer.js        (Session state: current session, all sessions - NEW in v110)
│   ├── playerReducer.js         (Player state: all players, seat assignments - NEW in v111)
│   └── settingsReducer.js       (Settings state: theme, defaults, custom venues - NEW in v115)
│
├── utils/                       (Utility functions)
│   ├── actionUtils.js           (Action styling, display, overlays)
│   ├── actionValidation.js      (Action sequence validation)
│   ├── cardUtils.js             (Card assignment and manipulation)
│   ├── seatUtils.js             (Seat navigation and positioning)
│   ├── displayUtils.js          (Display formatting, time formatting - UPDATED in v110)
│   ├── validation.js            (Input validation)
│   ├── exportUtils.js           (Data export/import functionality - NEW in v112)
│   └── persistence/             (IndexedDB persistence layer - UPDATED in v115)
│       ├── database.js          (DB connection, migrations - v6 adds settings store)
│       ├── handsStorage.js      (Hand CRUD operations)
│       ├── sessionsStorage.js   (Session CRUD operations)
│       ├── playersStorage.js    (Player CRUD operations)
│       ├── settingsStorage.js   (Settings CRUD operations - NEW in v115)
│       └── index.js             (Central export)
│
└── components/
    ├── ui/                      (Reusable UI components)
    │   ├── CardSlot.jsx         (Card display with 4 variants)
    │   ├── VisibilityToggle.jsx (Show/hide button)
    │   ├── PositionBadge.jsx    (D, SB, BB, ME indicators)
    │   ├── DiagonalOverlay.jsx  (FOLD/ABSENT/MUCK/WON overlays)
    │   ├── ScaledContainer.jsx  (Responsive scaling wrapper)
    │   ├── ActionBadge.jsx      (Single action badge display)
    │   ├── ActionSequence.jsx   (Multiple action badges with overflow)
    │   ├── SessionForm.jsx      (New session creation form - NEW in v110)
    │   ├── PlayerForm.jsx       (Player creation/editing form - NEW in v111)
    │   ├── Toast.jsx            (Toast notifications with 4 variants - NEW in v112)
    │   ├── ViewErrorBoundary.jsx (Per-view error boundary with retry - NEW in v112)
    │   ├── PlayerFilters.jsx    (Player search/sort/filter controls - NEW in v112)
    │   ├── PlayerRow.jsx        (Single player table row - NEW in v112)
    │   ├── SeatGrid.jsx         (9-seat assignment grid - NEW in v112)
    │   ├── SessionCard.jsx      (Past session display card - NEW in v112)
    │   └── CollapsibleSidebar.jsx (Collapsible navigation sidebar - NEW in v113)
    │
    └── views/                   (Full-screen view components)
        ├── TableView.jsx        (Main poker table, ~400 lines - UPDATED in v113)
        ├── StatsView.jsx        (Statistics display, ~264 lines)
        ├── CardSelectorView.jsx (Card selection, ~178 lines)
        ├── ShowdownView.jsx     (Showdown interface, ~485 lines)
        ├── HistoryView.jsx      (Hand history browser, ~300 lines - NEW in v109)
        ├── SessionsView.jsx     (Session management, ~715 lines - UPDATED in v112)
        ├── PlayersView.jsx      (Player management, ~587 lines - UPDATED in v112)
        └── SettingsView.jsx     (Settings configuration, ~320 lines - NEW in v115)
```

### State Management (useReducer)
The app uses six reducers for clean state management:

**gameReducer** (`src/reducers/gameReducer.js`):
- State: `currentStreet`, `dealerButtonSeat`, `mySeat`, `seatActions`, `absentSeats`
- Actions: `SET_STREET`, `ADVANCE_DEALER`, `RECORD_ACTION`, `CLEAR_STREET_ACTIONS`, etc.

**uiReducer** (`src/reducers/uiReducer.js` - UPDATED in v114):
- State: `currentView`, `selectedPlayers`, `contextMenu`, `isDraggingDealer`, `isSidebarCollapsed`
- View state (moved from cardReducer): `showCardSelector`, `cardSelectorType`, `highlightedBoardIndex`, `isShowdownViewOpen`, `highlightedSeat`, `highlightedHoleSlot`
- Actions: `SET_SCREEN`, `TOGGLE_PLAYER_SELECTION`, `SET_CONTEXT_MENU`, `TOGGLE_SIDEBAR`, `OPEN_CARD_SELECTOR`, `CLOSE_CARD_SELECTOR`, `OPEN_SHOWDOWN_VIEW`, `CLOSE_SHOWDOWN_VIEW`, etc.

**cardReducer** (`src/reducers/cardReducer.js` - UPDATED in v114):
- State: `communityCards`, `holeCards`, `holeCardsVisible`, `allPlayerCards` (card data only, view state moved to uiReducer)
- Actions: `SET_COMMUNITY_CARD`, `SET_HOLE_CARD`, `SET_PLAYER_CARD`, `RESET_CARDS`, etc.

**sessionReducer** (`src/reducers/sessionReducer.js` - NEW in v110):
- State: `currentSession` (sessionId, startTime, venue, gameType, buyIn, rebuyTransactions, cashOut, etc.), `allSessions`, `isLoading`
- Actions: `START_SESSION`, `END_SESSION`, `UPDATE_SESSION_FIELD`, `ADD_REBUY`, `LOAD_SESSIONS`, `HYDRATE_SESSION`, etc.

**playerReducer** (`src/reducers/playerReducer.js` - NEW in v111):
- State: `allPlayers` (player database), `seatPlayers` (ephemeral seat assignments), `isLoading`
- Actions: `LOAD_PLAYERS`, `SET_SEAT_PLAYER`, `CLEAR_SEAT_PLAYER`, `CLEAR_ALL_SEAT_PLAYERS`, `HYDRATE_PLAYERS`, etc.

**settingsReducer** (`src/reducers/settingsReducer.js` - NEW in v115):
- State: `settings` (theme, cardSize, defaultVenue, defaultGameType, customVenues, customGameTypes, etc.), `isLoading`, `isInitialized`
- Actions: `LOAD_SETTINGS`, `UPDATE_SETTING`, `RESET_SETTINGS`, `HYDRATE_SETTINGS`, `ADD_CUSTOM_VENUE`, `REMOVE_CUSTOM_VENUE`, `ADD_CUSTOM_GAME_TYPE`, `REMOVE_CUSTOM_GAME_TYPE`

### Context Providers (NEW in v114)
Contexts reduce prop drilling by providing state and handlers to nested components:

**GameContext** - `useGame()`:
- Provides: `currentStreet`, `mySeat`, `dealerButtonSeat`, `seatActions`, `absentSeats`, `dispatchGame`
- Derived: `getSmallBlindSeat()`, `getBigBlindSeat()`, `hasSeatFolded()`, `isSeatInactive()`, `getSeatAllActions()`

**UIContext** - `useUI()`:
- Provides: `selectedPlayers`, `contextMenu`, `isDraggingDealer`, `isSidebarCollapsed`, `showCardSelector`, `isShowdownViewOpen`, `SCREEN`, `dispatchUi`
- Handlers: `setCurrentScreen()`, `togglePlayerSelection()`, `setSelectedPlayers()`, `setContextMenu()`, `toggleSidebar()`, `openCardSelector()`

**SessionContext** - `useSession()`:
- Provides: `currentSession`, `allSessions`, `isLoading`, `dispatchSession`
- Derived: `hasActiveSession`, `totalInvestment`
- Handlers: `updateSessionField()`, `addRebuy()`, `incrementHandCount()`

**PlayerContext** - `usePlayer()`:
- Provides: `allPlayers`, `seatPlayers`, `isLoading`, `dispatchPlayer`
- Utilities: `getPlayerById()`, `getSeatPlayerName()`, `getSeatPlayer()`
- Handlers: `assignPlayerToSeat()`, `clearSeatPlayer()`, `clearAllSeatPlayers()`

**SettingsContext** - `useSettings()` (NEW in v115):
- Provides: `settings`, `isLoading`, `isInitialized`, `dispatchSettings`
- Derived: `allVenues` (defaults + custom), `allGameTypes` (defaults + custom), `allGameTypeKeys`
- Handlers: `updateSetting()`, `resetSettings()`, `addCustomVenue()`, `removeCustomVenue()`, `addCustomGameType()`, `removeCustomGameType()`
- Utilities: `isCustomVenue()`, `isCustomGameType()`

### Key Constants
- `ACTIONS.*` - All action types (FOLD, CALL, OPEN, etc.)
- `SEAT_ARRAY` - [1,2,3,4,5,6,7,8,9] for iteration
- `CONSTANTS.NUM_SEATS` - Use instead of hardcoded 9
- `SCREEN.TABLE` / `SCREEN.STATS` / `SCREEN.HISTORY` / `SCREEN.SESSIONS` / `SCREEN.PLAYERS` / `SCREEN.SETTINGS` - View identifiers
- `VENUES` - ['Online', 'Horseshoe Casino', 'Wind Creek Casino'] (NEW in v110)
- `GAME_TYPES` - {TOURNAMENT, ONE_TWO, ONE_THREE, TWO_FIVE} with buy-in defaults (NEW in v110)
- `PLAYER_ACTIONS.*` - Player state action types (NEW in v111)
- `ETHNICITY_OPTIONS`, `BUILD_OPTIONS`, `GENDER_OPTIONS`, `STYLE_TAGS` - Player attribute options (NEW in v111)
- `SETTINGS_ACTIONS.*` - Settings state action types (NEW in v115)
- `DEFAULT_SETTINGS` - Default values for all settings (NEW in v115)
- `THEMES`, `CARD_SIZES`, `BACKUP_FREQUENCIES` - Settings option arrays (NEW in v115)

### Component Architecture
View and UI components are modular:

**View Components** (in `src/components/views/`):
- Import from `'../ui/...'` for UI components
- Receive state and handlers as props from PokerTracker.jsx
- Examples: `TableView`, `StatsView`, `CardSelectorView`, `ShowdownView`

**UI Components** (in `src/components/ui/`):
- Self-contained, reusable across views
- `CardSlot` - 4 variants: `table`, `hole-table`, `showdown`, `selector`
- `PositionBadge` - 2 sizes: `small` (16px), `large` (28px)
- `VisibilityToggle` - 2 sizes: `small` (24px), `large` (40px)
- `DiagonalOverlay` - Status overlays (requires SEAT_STATUS prop)
- `ScaledContainer` - Responsive scaling wrapper

### Utility Functions (src/utils/)
Helper functions are centralized in the utils/ directory:

**actionUtils.js**: Action-related utilities
- `getActionDisplayName(action, isFoldAction, ACTIONS)` - Get display name for action
- `getActionColor(action, isFoldAction, ACTIONS)` - Get Tailwind classes for action color
- `getSeatActionStyle(action, isFoldAction, ACTIONS)` - Get seat background/ring colors
- `getOverlayStatus(inactiveStatus, isMucked, hasWon, SEAT_STATUS)` - Determine overlay status

**displayUtils.js**: Display formatting utilities (NEW in v107, UPDATED in v110)
- `isRedCard(card)` - Check if card is red (♥ or ♦)
- `isRedSuit(suit)` - Check if suit is red
- `getCardAbbreviation(card, SUIT_ABBREV)` - Convert "A♥" → "Ah"
- `getHandAbbreviation(cards, SUIT_ABBREV)` - Convert ["A♥", "K♠"] → "AhKs"
- `formatTime12Hour(timestamp)` - Format timestamp to "2:30 PM" (NEW in v110)
- `calculateTotalRebuy(rebuyTransactions)` - Sum rebuy amounts (NEW in v110)

**cardUtils.js**: Card manipulation utilities
- `assignCardToSlot(cards, card, targetSlot)` - Assign card and remove from other slots
- `findNextEmptySlot(...)` - Find next empty card slot in showdown
- `shouldAutoCloseCardSelector(currentStreet, highlightedIndex)` - Auto-close logic

**seatUtils.js**: Seat navigation utilities
- `getSmallBlindSeat(dealerSeat, absentSeats, numSeats)` - Calculate SB seat
- `getBigBlindSeat(dealerSeat, absentSeats, numSeats)` - Calculate BB seat
- `getFirstActionSeat(...)` - Get first seat to act on current street
- `getNextActionSeat(...)` - Get next seat to act

**validation.js**: Input validation utilities
- `isValidCard(card)` - Validate card string
- `isValidSeat(seat, numSeats)` - Validate seat number
- `isValidAction(action, ACTIONS)` - Validate action

**Import pattern**: Utils use dependency injection - constants are passed as parameters.

### Custom Hooks (src/hooks/)
Encapsulated component logic extracted from PokerTracker.jsx for better organization and testability:

**useActionUtils.js**: Action utility wrappers (~58 lines)
- Returns 6 functions with constants injected: `getActionDisplayName`, `getActionColor`, `getSeatActionStyle`, `getOverlayStatus`, `getCardAbbreviation`, `getHandAbbreviation`
- Consolidates utility wrapper functions into a single hook

**useStateSetters.js**: State dispatcher wrappers (~72 lines)
- Returns 10 setter functions: `setCurrentScreen`, `setContextMenu`, `setSelectedPlayers`, `setHoleCardsVisible`, `setCurrentStreet`, `setDealerSeat`, `setCardSelectorType`, `setHighlightedCardIndex`, `setHighlightedSeat`, `setHighlightedCardSlot`
- Takes `(dispatchGame, dispatchUi, dispatchCard)` as parameters

**useSeatUtils.js**: Seat logic utilities (~57 lines)
- Returns 5 functions: `getSmallBlindSeat`, `getBigBlindSeat`, `hasSeatFolded`, `getFirstActionSeat`, `getNextActionSeat`
- Wraps seatUtils functions with proper dependencies and constant injection
- Takes `(currentStreet, dealerButtonSeat, absentSeats, seatActions, numSeats)` as parameters

**useSeatColor.js**: Seat color styling (~60 lines)
- Returns `getSeatColor` function
- Complex logic for determining seat colors based on status, selection, and actions
- Takes `(hasSeatFolded, selectedPlayers, mySeat, absentSeats, seatActions, currentStreet, getSeatActionStyle)` as parameters

**useShowdownHandlers.js**: Showdown handlers (~99 lines)
- Returns 6 handlers: `handleClearShowdownCards`, `handleMuckSeat`, `handleWonSeat`, `handleNextHandFromShowdown`, `handleCloseShowdown`, `handleCloseCardSelector`
- Encapsulates all showdown-specific handler logic
- Takes `(dispatchCard, dispatchGame, isSeatInactive, seatActions, recordSeatAction, nextHand, numSeats, log)` as parameters

**useCardSelection.js**: Card selection logic (~72 lines)
- Returns `selectCard` function
- Handles community and hole card selection with auto-advance and auto-close
- Takes `(highlightedBoardIndex, cardSelectorType, communityCards, holeCards, currentStreet, dispatchCard)` as parameters

**useShowdownCardSelection.js**: Showdown card selection (~109 lines)
- Returns `selectCardForShowdown` function
- Complex auto-advance logic for multi-player card assignment
- Takes `(highlightedSeat, highlightedHoleSlot, mySeat, holeCards, allPlayerCards, communityCards, seatActions, isSeatInactive, dispatchCard, numSeats)` as parameters

**Hook pattern**: All hooks use `useCallback` and `useMemo` with proper dependency arrays. They encapsulate complex logic and return functions ready to use.

### Important: useCallback Pattern
All handler functions are wrapped in `useCallback` with proper dependencies to prevent unnecessary re-renders and enable use in dependency arrays. When adding new handlers:
1. Use `useCallback` for functions passed as props
2. Include all external dependencies in the dependency array
3. Helper functions used as dependencies must also be `useCallback`
4. Define helper functions BEFORE functions that depend on them

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
- v101: Baseline features
- v102: Constants extraction
- v103: Full refactoring
- v104: Mobile landscape optimization, responsive scaling, card selector improvements
- v105: Component extraction - views and UI components modularized
  - Reduced main file from 1957 to 1088 lines (44% smaller)
  - 4 view components extracted to `src/components/views/`
  - 5 UI components extracted to `src/components/ui/`
  - Eliminated ~164 lines of duplicate UI component code
- v106: State management refactoring with useReducer
  - Migrated from useState to three useReducer hooks (gameReducer, uiReducer, cardReducer)
  - All handlers converted to useCallback with proper dependencies
  - Improved code organization: helper functions defined before dependent callbacks
  - Fixed circular dependency issues and initialization bugs
  - Main file reduced to ~1000 lines
- v107: Utils integration
  - Created `src/utils/displayUtils.js` for display formatting utilities
  - Connected existing utils (actionUtils, cardUtils, seatUtils) to PokerTracker.jsx
  - Removed 134 lines of duplicate helper functions
  - Added useCallback wrappers to inject constants into utils
  - Updated 4 components to import from utils (ShowdownView, CardSelectorView, CardSlot, PokerTracker)
  - Main file reduced from 1056 to ~920 lines (13% reduction)
  - Net codebase reduction: ~51 lines
- v108: Custom hooks extraction
  - Created `src/constants/gameConstants.js` - Centralized game configuration
  - Created 7 custom hooks in `src/hooks/`:
    - `useActionUtils.js` - Action utility wrappers
    - `useStateSetters.js` - State dispatcher wrappers
    - `useSeatUtils.js` - Seat logic utilities
    - `useSeatColor.js` - Seat color styling
    - `useShowdownHandlers.js` - Showdown handlers
    - `useCardSelection.js` - Card selection logic
    - `useShowdownCardSelection.js` - Showdown card selection
  - Eliminated all duplicate code and improved testability
  - Main file reduced from 967 to 620 lines (36% reduction)
  - Phased implementation (v108a → v108d) for safety
  - Highly modular architecture with clear separation of concerns
- v109: Hand history and persistence system
  - Created `src/utils/persistence.js` - IndexedDB CRUD operations (saveHand, loadHandById, getAllHands, deleteHand, clearAllHands, getHandCount)
  - Created `src/hooks/usePersistence.js` - Auto-save/restore hook with debouncing (1.5s delay)
  - Created `src/components/views/HistoryView.jsx` - Hand history browser UI (~300 lines)
  - Created `src/components/ui/ActionBadge.jsx` - Single action badge component
  - Created `src/components/ui/ActionSequence.jsx` - Multiple action badges with overflow (+N display)
  - Created `src/utils/actionValidation.js` - Validates poker action sequences (prevents illegal actions)
  - Added SCREEN.HISTORY view identifier
  - Features: Load any saved hand, delete individual hands, clear all history, relative timestamps
  - Multiple actions per street now fully supported with visual action sequences
  - Database schema: PokerTrackerDB v1 with 'hands' object store (handId, timestamp, sessionId indexes)
- v110: Session management system
  - Created `src/constants/sessionConstants.js` - Session configuration (VENUES, GAME_TYPES, SESSION_GOALS, SESSION_ACTIONS)
  - Created `src/reducers/sessionReducer.js` - Session state management
  - Created `src/hooks/useSessionPersistence.js` - Session persistence and lifecycle (~327 lines)
  - Created `src/components/views/SessionsView.jsx` - Session management UI (~656 lines)
  - Created `src/components/ui/SessionForm.jsx` - New session creation form
  - Updated `src/utils/persistence.js` - Added session CRUD operations, database v3→v4 migration (cashOut field)
  - Updated `src/utils/displayUtils.js` - Added formatTime12Hour and calculateTotalRebuy utilities
  - Added SCREEN.SESSIONS view identifier
  - Features: Start/end sessions, venue selection, game type selection, buy-in tracking, rebuy transactions, cash-out workflow, running total bankroll, session history, inline editing
  - Database schema: PokerTrackerDB v4 with 'sessions' object store (sessionId, startTime, endTime indexes, activeSession metadata)
- v111: Player management system
  - Created `src/constants/playerConstants.js` - Player configuration (PLAYER_ACTIONS, physical attributes, style tags)
  - Created `src/reducers/playerReducer.js` - Player state management with seat assignments
  - Created `src/hooks/usePlayerPersistence.js` - Player CRUD and seat assignment logic (~320 lines)
  - Created `src/components/views/PlayersView.jsx` - Player management UI (~860 lines, portrait-mode optimized)
  - Created `src/components/ui/PlayerForm.jsx` - Player creation/editing form with physical descriptions
  - Updated `src/components/views/TableView.jsx` - Added player assignment via right-click context menu, player management button
  - Updated `src/utils/persistence.js` - Added player CRUD operations, database v4→v5 migration (players store)
  - Added SCREEN.PLAYERS view identifier
  - Features: Player profiles with physical descriptions (ethnicity, build, gender, facial hair, hat, sunglasses), playing style tags, notes, avatar upload, quick seat assignment (right-click + drag-and-drop), seat management with click-to-select workflow, auto-highlight seat from context menu, duplicate player prevention, replacement prompts, portrait mode support
  - Database schema: PokerTrackerDB v5 with 'players' object store (playerId, name, createdAt, lastSeenAt indexes)
  - Responsive design: PlayersView uses viewport-based widths for portrait phone screens while other views remain landscape
- v112: CTO review improvements
  - Created `src/components/ui/Toast.jsx` - Toast notification with 4 variants (error, success, warning, info)
  - Created `src/hooks/useToast.js` - Toast state management hook with auto-dismiss
  - Created `src/components/ui/ViewErrorBoundary.jsx` - Per-view error boundary with retry/return options
  - Created `src/utils/exportUtils.js` - Data export/import functionality for backup/restore
  - Extracted `src/components/ui/PlayerFilters.jsx` - Search, sort, filter controls from PlayersView
  - Extracted `src/components/ui/PlayerRow.jsx` - Single player table row from PlayersView
  - Extracted `src/components/ui/SeatGrid.jsx` - 9-seat assignment grid from PlayersView
  - Extracted `src/components/ui/SessionCard.jsx` - Past session display card from SessionsView
  - Replaced all 7 `alert()` calls with toast notifications
  - Wrapped all 7 views with ViewErrorBoundary for graceful error recovery
  - PlayersView.jsx reduced from ~869 to ~587 lines (32% reduction)
  - SessionsView.jsx reduced from ~800 to ~715 lines (~11% reduction)
  - DEBUG flag now respects environment (import.meta.env.DEV)
  - All layout values centralized in LAYOUT constants
  - 272 tests passing across 8 test files
- v113: Collapsible sidebar, dynamic hand tracking, session integration, and bankroll display
  - Created `src/components/ui/CollapsibleSidebar.jsx` - Collapsible navigation sidebar component
  - Updated `src/reducers/uiReducer.js` - Added `isSidebarCollapsed` state and `TOGGLE_SIDEBAR` action
  - Updated `src/components/views/TableView.jsx` - Integrated CollapsibleSidebar, moved nav buttons from header
  - Features: Sidebar with Stats, History, Sessions, Players navigation; expand/collapse toggle; icons-only when collapsed
  - Header simplified: only Hand #, session time, Next Hand, and Reset buttons remain
  - Dynamic hand count: displays actual hand number from session (replacing hardcoded #47)
  - Live session timer: shows elapsed time since session start, updates every minute
  - Added `getHandsBySessionId()` function to persistence.js for session-based queries
  - Updated HistoryView.jsx: session filter dropdown, hands show linked session badge, filter by session
  - Bankroll display: TableView header shows current session investment (buy-in + rebuys), SessionsView shows running total
- v115: Settings system with persistence (current)
  - Created `src/constants/settingsConstants.js` - SETTINGS_ACTIONS, DEFAULT_SETTINGS, THEMES, CARD_SIZES, BACKUP_FREQUENCIES
  - Created `src/reducers/settingsReducer.js` - Settings state management with validation
  - Created `src/contexts/SettingsContext.jsx` - Provider with derived allVenues, allGameTypes
  - Created `src/hooks/useSettingsPersistence.js` - Init on mount, auto-save on change
  - Created `src/utils/persistence/settingsStorage.js` - Settings CRUD (singleton pattern)
  - Created `src/components/views/SettingsView.jsx` - Full settings UI (~320 lines)
  - Updated `src/utils/persistence/database.js` - DB v5→v6 migration, added settings store
  - Features: Theme toggle (placeholder), card size selector, default venue/game type, custom venues, error reporting toggle, reset to defaults
  - Settings persist to IndexedDB on every change (immediate save)
  - All 2282 tests passing

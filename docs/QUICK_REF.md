# ⚡ QUICK REFERENCE CARD - Poker Tracker v114

## 🎯 ESSENTIAL INFO
- **Version**: v114 (Context API + State Consolidation)
- **Main File**: src/PokerTracker.jsx (~620 lines)
- **Contexts**: src/contexts/ (4 providers: Game, UI, Session, Player) - NEW in v114
- **Constants**: src/constants/ (gameConstants.js, sessionConstants.js, playerConstants.js)
- **Hooks**: src/hooks/ (11 custom hooks)
- **Utils**: src/utils/ (7 files: actionUtils, cardUtils, seatUtils, displayUtils, validation, persistence, exportUtils)

## 📖 MUST-READ DOCS
1. **POKER_TRACKER_SPEC_V103.md** ⭐ (3k tokens) - READ FIRST
2. **CHANGELOG.md** (Latest changes)
3. **CLAUDE.md** (Complete architecture documentation)

## 🤖 LOCAL MODEL COMMANDS
Before starting work, check if task can be delegated:
```bash
/route <task>           # Get recommendation
/local <task>           # Auto-route to best local model
/local-code <task>      # DeepSeek: new code (<80 lines)
/local-refactor <task>  # Qwen: refactoring tasks
/local-doc <task>       # Qwen: documentation
/local-test <task>      # Qwen: unit tests
```

| Task Type | Use Local? | Command |
|-----------|------------|---------|
| Utility function | ✅ Yes | `/local-code` |
| Simple component | ✅ Yes | `/local-code` |
| Refactoring | ✅ Yes | `/local-refactor` |
| JSDoc comments | ✅ Yes | `/local-doc` |
| Test generation | ✅ Yes | `/local-test` |
| Reducer/hooks | ❌ No | Claude |
| Multi-file | ❌ No | Claude |

## 🏗️ CODE ORGANIZATION (v114)
```
src/PokerTracker.jsx (~620 lines):
  Lines 1-63:      Imports (React, icons, components, reducers, utils, hooks, constants, contexts)
  Lines 65-112:    Constants (CONSTANTS, SEAT_POSITIONS, SCREEN - UI-specific only)
  Lines 114+:      Main Component (reducers, hooks, handlers, context providers, view rendering)
  Note: All game constants and complex logic extracted to hooks; contexts wrap view components

src/contexts/ (5 files) - NEW in v114:
  GameContext.jsx      Game state + derived (getSmallBlindSeat, getBigBlindSeat, hasSeatFolded)
  UIContext.jsx        UI state + handlers (setCurrentScreen, togglePlayerSelection, etc.)
  SessionContext.jsx   Session state + handlers (hasActiveSession, updateSessionField)
  PlayerContext.jsx    Player state + handlers (getSeatPlayerName, assignPlayerToSeat)
  index.js             Central export

src/constants/ (3 files):
  gameConstants.js     ACTIONS, FOLD_ACTIONS, SEAT_STATUS, STREETS, LAYOUT, LIMITS, etc.
  sessionConstants.js  SESSION_ACTIONS, VENUES, GAME_TYPES, SESSION_GOALS
  playerConstants.js   PLAYER_ACTIONS, ETHNICITY_OPTIONS, BUILD_OPTIONS, STYLE_TAGS

src/hooks/ (11 files):
  useActionUtils.js        Action utility wrappers (6 functions)
  useStateSetters.js       State dispatcher wrappers (10 functions)
  useSeatUtils.js          Seat logic utilities (5 functions)
  useSeatColor.js          Seat color styling
  useShowdownHandlers.js   Showdown handlers (6 handlers)
  useCardSelection.js      Card selection logic
  useShowdownCardSelection.js Showdown card selection
  usePersistence.js        IndexedDB auto-save/restore
  useSessionPersistence.js Session lifecycle
  usePlayerPersistence.js  Player CRUD + seat assignment
  useToast.js              Toast notification state

src/utils/ (7 files):
  actionUtils.js       Action styling, display, overlays
  actionValidation.js  Action sequence validation
  cardUtils.js         Card assignment and manipulation
  seatUtils.js         Seat navigation and positioning
  displayUtils.js      Display formatting
  validation.js        Input validation
  persistence.js       IndexedDB CRUD operations
  exportUtils.js       Data export/import

src/reducers/ (5 files):
  gameReducer.js       Game state (street, dealer, actions)
  uiReducer.js         UI state (view, selection, context menu, card selector, showdown view)
  cardReducer.js       Card data only (community, hole, player cards)
  sessionReducer.js    Session state (current, all sessions)
  playerReducer.js     Player state (all players, seat assignments)

src/components/views/ (7 files):
  TableView.jsx        Main poker table (~550 lines) - uses contexts
  StatsView.jsx        Statistics display (~78 lines) - uses contexts
  CardSelectorView.jsx Card selection (~178 lines)
  ShowdownView.jsx     Showdown interface (~485 lines)
  HistoryView.jsx      Hand history browser (~300 lines)
  SessionsView.jsx     Session management (~715 lines)
  PlayersView.jsx      Player management (~587 lines)

src/components/ui/ (12 files):
  CardSlot.jsx         Card display with 4 variants
  VisibilityToggle.jsx Show/hide button
  PositionBadge.jsx    D, SB, BB, ME indicators
  DiagonalOverlay.jsx  FOLD/ABSENT/MUCK/WON overlays
  ScaledContainer.jsx  Responsive scaling wrapper
  ActionBadge.jsx      Single action badge
  ActionSequence.jsx   Multiple action badges
  SessionForm.jsx      New session form
  PlayerForm.jsx       Player creation/editing
  Toast.jsx            Toast notifications
  ViewErrorBoundary.jsx Per-view error boundary
  CollapsibleSidebar.jsx Navigation sidebar
```

## 🔌 CONTEXT API (v114)

### Import Pattern
```javascript
// In view components:
import { useGame, useUI, useSession, usePlayer } from '../../contexts';

// Usage in component:
const { currentStreet, mySeat, seatActions } = useGame();
const { selectedPlayers, setCurrentScreen, SCREEN } = useUI();
const { currentSession, hasActiveSession } = useSession();
const { getSeatPlayerName, assignPlayerToSeat } = usePlayer();
```

### Context Providers
| Context | State | Key Handlers/Derived |
|---------|-------|---------------------|
| `useGame()` | currentStreet, mySeat, dealerButtonSeat, seatActions, absentSeats | getSmallBlindSeat, getBigBlindSeat, hasSeatFolded, isSeatInactive |
| `useUI()` | selectedPlayers, contextMenu, isDraggingDealer, isSidebarCollapsed, showCardSelector, isShowdownViewOpen | setCurrentScreen, togglePlayerSelection, setContextMenu, openCardSelector, SCREEN |
| `useSession()` | currentSession, allSessions, isLoading | hasActiveSession, totalInvestment, updateSessionField, incrementHandCount |
| `usePlayer()` | allPlayers, seatPlayers, isLoading | getSeatPlayerName, assignPlayerToSeat, clearSeatPlayer |

## 📱 RESPONSIVE DESIGN (v104)
- **Target**: Samsung Galaxy A22 landscape (1600x720)
- **Scaling**: Dynamic - `min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`
- **Mobile sizes**: Badges (16px/28px), Seats (40px), Cards scaled down
- **Card Selectors**: 90px height, large text (rank: text-lg, suit: text-3xl), no scrolling

## 🔧 VARIABLE NAMES (v104)
| Variable | Purpose |
|----------|---------|
| `currentView` | SCREEN.TABLE or SCREEN.STATS |
| `isShowdownViewOpen` | Showdown view open |
| `dealerButtonSeat` | Seat with dealer button |
| `highlightedBoardIndex` | Community card 0-4 |
| `highlightedHoleSlot` | Hole card 0-1 |
| `highlightedSeat` | Selected seat in showdown |
| `scale` | Dynamic viewport scale (v104) |

## 🧩 COMPONENT PROPS

### CardSlot
```jsx
<CardSlot
  card={string|null}
  variant="table|hole-table|showdown|selector"
  isHighlighted={boolean}
  isHidden={boolean}
  status={null|'folded'|'absent'|'mucked'|'won'}
  onClick={function}
  canInteract={boolean}
/>
```

### PositionBadge
```jsx
<PositionBadge
  type="dealer|sb|bb|me"
  size="small|large"
  draggable={boolean}
  onDragStart={function}
/>
```

### VisibilityToggle
```jsx
<VisibilityToggle
  visible={boolean}
  onToggle={function}
  size="small|large"
/>
```

### DiagonalOverlay
```jsx
<DiagonalOverlay status={SEAT_STATUS.FOLDED|SEAT_STATUS.ABSENT|'mucked'|'won'|null} />
```

## 🎨 COLORS
| Action | Color |
|--------|-------|
| Fold | Red |
| Call/Check | Blue |
| Open/Cbet/Won | Green |
| 3bet/Stab | Yellow |
| 4bet/Donk/CR | Orange |
| Limp/Muck | Gray |

## 🔧 UTILS REFERENCE (v107)

### Import Patterns
```javascript
// From PokerTracker.jsx:
import { funcName } from './utils/fileName';

// From views/ or ui/:
import { funcName } from '../../utils/fileName';
```

### Common Utils
**actionUtils**: `getActionDisplayName`, `getActionColor`, `getSeatActionStyle`, `getOverlayStatus`
**displayUtils**: `isRedCard`, `isRedSuit`, `getCardAbbreviation`, `getHandAbbreviation`
**cardUtils**: `assignCardToSlot`, `findNextEmptySlot`, `shouldAutoCloseCardSelector`
**seatUtils**: `getSmallBlindSeat`, `getBigBlindSeat`, `getFirstActionSeat`, `getNextActionSeat`
**validation**: `isValidSeat`, `isValidCard`, `isValidStreet`, `isValidAction`

### Helper Functions (PokerTracker.jsx only)
| Function | Purpose |
|----------|---------|
| `log()` | Debug logging with prefix |
| `isFoldAction(action)` | Check if fold (used by utils) |

### Wrapped Utils (with constants injected)
| Wrapper | Original Utils Function |
|---------|------------------------|
| `wrappedGetActionDisplayName` | `getActionDisplayName(action, isFoldAction, ACTIONS)` |
| `wrappedGetActionColor` | `getActionColor(action, isFoldAction, ACTIONS)` |
| `wrappedGetSeatActionStyle` | `getSeatActionStyle(action, isFoldAction, ACTIONS)` |
| `wrappedGetOverlayStatus` | `getOverlayStatus(inactiveStatus, isMucked, hasWon, SEAT_STATUS)` |
| `wrappedGetCardAbbreviation` | `getCardAbbreviation(card, SUIT_ABBREV)` |
| `wrappedGetHandAbbreviation` | `getHandAbbreviation(cards, SUIT_ABBREV)` |

## 🎬 EVENT HANDLERS
| Handler | Purpose |
|---------|---------|
| `handleNextHandFromShowdown` | Close + next hand |
| `handleClearShowdownCards` | Clear showdown cards |
| `handleCloseShowdown` | Close showdown |
| `handleCloseCardSelector` | Close card selector |
| `handleMuckSeat(seat)` | Mark mucked |
| `handleWonSeat(seat)` | Mark winner |
| `handleSetMySeat(seat)` | Set my seat |

## ✅ VERSION HISTORY
- ✅ v101: Baseline features
- ✅ v102: Constants extraction
- ✅ v103: Full refactoring (12.1% reduction)
- ✅ v104: Mobile landscape optimization, responsive scaling, card selector improvements
- ✅ v105: Component extraction (views and UI components modularized)
- ✅ v106: State management refactoring with useReducer
- ✅ v107: Utils integration - connected existing utils, removed duplicates

## 📊 FILE STATS
| Version | Main File Lines | Change |
|---------|----------------|--------|
| v101 | ~2063 | baseline |
| v102 | 2228 | +165 |
| v103 | 1958 | -270 (12.1%) |
| v104 | ~2000 | +42 (responsive features) |
| v105 | 1088 | -912 (45.6%, extracted components) |
| v106 | 1056 | -32 (3.0%, useReducer) |
| v107 | ~920 | -136 (12.9%, utils integration) |

## 🐛 DEBUG
- Set `DEBUG = false` at line 8 to disable logging
- All logs prefixed with `[PokerTracker]`

| Problem | Solution |
|---------|----------|
| White screen | Syntax error |
| Action not recording | Check ACTIONS.* |
| Colors wrong | Check getActionColor/getSeatActionStyle |
| Card not showing | Check CardSlot props |

## 🚫 DON'T
- Read full .tsx unnecessarily (50k+ tokens!)
- Use hardcoded action strings (use ACTIONS.*)
- Create inline card/badge rendering (use components)
- Use hardcoded [1,2,3,4,5,6,7,8,9] (use SEAT_ARRAY)
- Use hardcoded `<= 9` (use CONSTANTS.NUM_SEATS)

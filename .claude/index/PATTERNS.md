# Code Patterns Index
**Generated**: 2025-12-10

## Where to Find Things

| Looking For | Location |
|-------------|----------|
| State management | `src/reducers/*.js` |
| Action types | `src/constants/gameConstants.js` → `ACTIONS` |
| Screen/View names | `src/constants/gameConstants.js` → `SCREEN` |
| Seat iteration | `src/constants/gameConstants.js` → `SEAT_ARRAY` |
| Database access | `src/utils/persistence.js` |
| Event handlers | `src/PokerTracker.jsx` lines 150-600 |
| View routing | `src/ViewRouter.jsx` |
| Toast notifications | `src/hooks/useToast.js` |
| Error logging | `src/utils/errorLog.js` |

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Reducer | `*Reducer.js` | `gameReducer.js` |
| Hook | `use*.js` | `useSessionPersistence.js` |
| Context | `*Context.jsx` | `GameContext.jsx` |
| View | `*View.jsx` | `TableView.jsx` |
| UI Component | PascalCase.jsx | `ActionBadge.jsx` |
| Constants | SCREAMING_SNAKE | `ACTIONS`, `SEAT_ARRAY` |
| Utility | camelCase.js | `actionUtils.js` |

## State Update Patterns

### Correct: Use Dispatch
```javascript
// In component
const { dispatch } = useContext(GameContext);
dispatch({ type: 'RECORD_ACTION', payload: { seat, action } });
```

### Incorrect: Direct Mutation
```javascript
// NEVER do this
state.seats[seat].actions.push(action); // BAD
```

## Import Patterns

### Constants (Dependency Injection)
```javascript
// Utils receive constants as parameters
const displayName = getActionDisplayName(action, isFold, ACTIONS);
```

### Components
```javascript
// Named exports from ui/
import { CardSlot } from '../ui/CardSlot';
import { ActionBadge } from '../ui/ActionBadge';
```

### Hooks
```javascript
// Default exports from hooks/
import useSessionPersistence from '../hooks/useSessionPersistence';
```

## Handler Patterns

### useCallback Requirement
All handlers passed as props must use useCallback:
```javascript
const handleAction = useCallback((seat, action) => {
  dispatch({ type: 'RECORD_ACTION', payload: { seat, action } });
}, [dispatch]); // Include all dependencies
```

### Handler Naming
- `handle*` - for event handlers
- `on*` - for prop callbacks

## Testing Patterns

### File Location
Tests live adjacent to source:
```
src/utils/actionUtils.js
src/utils/__tests__/actionUtils.test.js
```

### Test Naming
```javascript
describe('getActionDisplayName', () => {
  it('returns correct name for open action', () => {});
  it('handles fold action specially', () => {});
});
```

## Critical Path Analysis

### Hand Recording Flow
1. User taps seat → `SeatGrid` → `handleSeatClick`
2. Action modal → `handleActionSelect`
3. `dispatch({ type: 'RECORD_ACTION' })` → `gameReducer`
4. Auto-save → `usePersistence` → `persistence.js`

### Session Flow
1. Start session → `SessionsView` → `handleStartSession`
2. `dispatch({ type: 'START_SESSION' })` → `sessionReducer`
3. Active session card displays
4. End → `handleEndSession` → `saveSession()`

### Card Selection Flow
1. Tap card slot → `CardSelectorView` opens
2. Select card → `handleCardSelect`
3. `dispatch({ type: 'SET_PLAYER_CARDS' })` → `cardReducer`
4. Card removed from deck, shown in slot

## Anti-Patterns (Avoid)

| Don't | Do Instead |
|-------|------------|
| `state.x = y` | `dispatch({ type, payload })` |
| Hardcoded seat array | Use `SEAT_ARRAY` |
| Magic strings for actions | Use `ACTIONS.OPEN`, etc. |
| Inline styles | Use Tailwind classes |
| Template literal Tailwind | Static class names |
| Default exports for utils | Named exports |
| Direct DB calls in components | Use hooks |

## File Relationships

```
PokerTracker.jsx
├── uses: GameContext, UIContext, SessionContext, PlayerContext
├── calls: useSessionPersistence, usePlayerPersistence
├── renders: ViewRouter
└── manages: All game state initialization

ViewRouter.jsx
├── reads: uiState.currentScreen
├── renders: One of 8+ view components
└── passes: handlers from PokerTracker

View Components
├── read: Context state via useContext
├── call: Handlers passed as props
└── render: UI components from /ui
```

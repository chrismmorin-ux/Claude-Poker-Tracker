# Symbol Index
**Generated**: 2025-12-10 | **Exports**: 100+

## Constants

| Constant | File | Description |
|----------|------|-------------|
| `ACTIONS` | src/constants/gameConstants.js | All action types (open, call, fold, etc) |
| `SCREEN` | src/constants/gameConstants.js | View/screen identifiers |
| `SEAT_ARRAY` | src/constants/gameConstants.js | Array [0-8] for seat iteration |
| `SEAT_STATUS` | src/constants/gameConstants.js | Seat status values |
| `PRIMITIVE_ACTIONS` | src/constants/primitiveActions.js | Base actions (check, bet, call, raise, fold) |
| `AUTH_STATUS` | src/constants/authConstants.js | Authentication states |
| `PLAYER_STYLE_TAGS` | src/constants/playerConstants.js | Player classification tags |
| `DEFAULT_SETTINGS` | src/constants/settingsConstants.js | Settings defaults |
| `SESSION_TYPES` | src/constants/sessionConstants.js | Session type options |

## Utility Functions

### actionUtils.js
| Function | Signature | Purpose |
|----------|-----------|---------|
| `getActionDisplayName` | (action, isFoldAction, ACTIONS) → string | Display name for action |
| `getActionColor` | (action, isFoldAction, ACTIONS) → string | Tailwind color class |
| `getSeatActionStyle` | (action, isFoldAction, ACTIONS) → string | Combined seat styling |
| `getActionAbbreviation` | (action, ACTION_ABBREV) → string | Short form (e.g., "3b") |
| `getLastAction` | (actions) → action | Most recent action |
| `normalizeActionData` | (action) → object | Standardize action format |

### actionValidation.js
| Function | Signature | Purpose |
|----------|-----------|---------|
| `validateActionSequence` | (current, new, street, ACTIONS) → result | Validate action is legal |
| `getValidNextActions` | (current, street, ACTIONS) → array | Get legal next actions |
| `isTerminalAction` | (action) → boolean | Check if action ends street |
| `hasOpeningBet` | (actions, ACTIONS) → boolean | Check for bet in sequence |

### cardUtils.js
| Function | Signature | Purpose |
|----------|-----------|---------|
| `assignCardToSlot` | (cards, card, slot) → array | Assign card to position |
| `removeCardFromArray` | (cards, card) → array | Remove card |
| `isRedCard` | (card) → boolean | Check if red suit |
| `getCardAbbreviation` | (card, suitAbbrev) → string | Short card form |
| `getHandAbbreviation` | (cards, suitAbbrev) → string | Short hand form |

### displayUtils.js
| Function | Signature | Purpose |
|----------|-----------|---------|
| `formatTime12Hour` | (timestamp) → string | "3:45 PM" format |
| `formatDateTime` | (timestamp) → string | Full date/time |
| `calculateTotalRebuy` | (transactions) → number | Sum rebuy amounts |

### persistence.js
| Function | Signature | Purpose |
|----------|-----------|---------|
| `initDB` | () → Promise<IDBDatabase> | Initialize IndexedDB |
| `saveHand` | (hand) → Promise | Save hand to DB |
| `loadHands` | () → Promise<array> | Load all hands |
| `saveSession` | (session) → Promise | Save session |
| `loadSessions` | () → Promise<array> | Load all sessions |
| `clearAll` | () → Promise | Clear all data |

### exportUtils.js
| Function | Signature | Purpose |
|----------|-----------|---------|
| `exportAllData` | () → Promise<object> | Export all data |
| `importAllData` | (data) → Promise | Import data |
| `downloadBackup` | () → Promise | Download JSON backup |
| `validateImportData` | (data) → result | Validate import format |

### errorLog.js
| Function | Signature | Purpose |
|----------|-----------|---------|
| `logError` | (details) → void | Log error to storage |
| `getErrorLog` | () → array | Get all errors |
| `clearErrorLog` | () → void | Clear error history |
| `exportErrorLog` | () → string | Export as text |

## React Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useActionUtils` | src/hooks/useActionUtils.js | Action helper functions |
| `useAppState` | src/hooks/useAppState.js | Aggregated app state |
| `useAuthPersistence` | src/hooks/useAuthPersistence.js | Auth state persistence |
| `useCardSelection` | src/hooks/useCardSelection.js | Card selector logic |
| `usePersistence` | src/hooks/usePersistence.js | Generic persistence |
| `usePlayerFiltering` | src/hooks/usePlayerFiltering.js | Player list filtering |
| `usePlayerPersistence` | src/hooks/usePlayerPersistence.js | Player CRUD |
| `useSeatColor` | src/hooks/useSeatColor.js | Seat color assignment |
| `useSeatUtils` | src/hooks/useSeatUtils.js | Seat helper functions |
| `useSessionPersistence` | src/hooks/useSessionPersistence.js | Session CRUD |
| `useSettingsPersistence` | src/hooks/useSettingsPersistence.js | Settings save/load |
| `useShowdownCardSelection` | src/hooks/useShowdownCardSelection.js | Showdown card logic |
| `useShowdownHandlers` | src/hooks/useShowdownHandlers.js | Showdown event handlers |
| `useStateSetters` | src/hooks/useStateSetters.js | State update helpers |
| `useToast` | src/hooks/useToast.js | Toast notification system |

## Context Providers

| Context | File | Provides |
|---------|------|----------|
| `GameContext` | src/contexts/GameContext.jsx | gameState, gameDispatch |
| `UIContext` | src/contexts/UIContext.jsx | uiState, uiDispatch |
| `CardContext` | src/contexts/CardContext.jsx | cardState, cardDispatch |
| `SessionContext` | src/contexts/SessionContext.jsx | sessionState, sessionDispatch |
| `PlayerContext` | src/contexts/PlayerContext.jsx | playerState, playerDispatch |
| `SettingsContext` | src/contexts/SettingsContext.jsx | settingsState, settingsDispatch |
| `AuthContext` | src/contexts/AuthContext.jsx | authState, authDispatch |

## Reducer Actions

### gameReducer.js
- `SET_SEAT`, `SET_POSITION`, `SET_HERO_SEAT`
- `RECORD_ACTION`, `RECORD_PRIMITIVE_ACTION`
- `UPDATE_POT`, `ADVANCE_STREET`
- `RESET_HAND`, `COMPLETE_HAND`

### uiReducer.js
- `SET_SCREEN`, `SET_CARD_SELECTOR_TARGET`
- `SHOW_TOAST`, `HIDE_TOAST`
- `SET_SIDEBAR_COLLAPSED`

### cardReducer.js
- `SET_TABLE_CARDS`, `SET_PLAYER_CARDS`
- `REMOVE_CARD`, `CLEAR_ALL_CARDS`

### sessionReducer.js
- `START_SESSION`, `END_SESSION`
- `UPDATE_SESSION`, `SET_RESULT`
- `ADD_REBUY`

### playerReducer.js
- `ADD_PLAYER`, `UPDATE_PLAYER`, `DELETE_PLAYER`
- `SET_PLAYERS`, `SET_SELECTED_PLAYER`

## Quick Lookups

**Find action handling**: `src/utils/actionUtils.js` + `src/reducers/gameReducer.js`
**Find card logic**: `src/utils/cardUtils.js` + `src/hooks/useCardSelection.js`
**Find persistence**: `src/utils/persistence.js` + `src/utils/persistence/*.js`
**Find state shapes**: `.claude/context/STATE_SCHEMA.md` or `docs/STATE_SCHEMAS.md`

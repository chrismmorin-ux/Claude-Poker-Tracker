# Project Context Summary
**Version**: 1.0.6 | **Updated**: 2025-12-09

React-based poker hand tracker for live 9-handed games.
Tracks actions, cards, sessions, and player profiles with IndexedDB persistence.
Mobile-optimized (1600x720 landscape), uses Vite + Tailwind.

## Architecture
- **Entry**: `src/PokerTracker.jsx` (~620 lines) - orchestrates state and views
- **State**: 5 reducers (game, ui, card, session, player) + 4 context providers
- **Views**: 7 screens (Table, Stats, History, Sessions, Players, CardSelector, Showdown)
- **Persistence**: IndexedDB v5 with 4 stores (hands, sessions, players, activeSession)

## Key Patterns
- useReducer for state, useContext for cross-component access
- useCallback for all handlers (prevent re-renders)
- Dependency injection for utils (constants passed as params)
- Constants in `src/constants/`, hooks in `src/hooks/`

## Critical Files
| Purpose | File |
|---------|------|
| Main component | `src/PokerTracker.jsx` |
| Game state | `src/reducers/gameReducer.js` |
| Persistence | `src/utils/persistence/index.js` |
| Session mgmt | `src/hooks/useSessionPersistence.js` |

## Where to Look
- State shapes: `docs/STATE_SCHEMAS.md` or `.claude/context/STATE_SCHEMA.md`
- Quick refs: `docs/QUICK_REF.md`
- Full spec: `docs/SPEC.md`

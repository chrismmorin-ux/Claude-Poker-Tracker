# Project Context Summary
**Version**: 1.3.0 | **Updated**: 2026-03-05

Live poker hand tracker and exploit engine for 9-handed games.
Records actions, builds Bayesian player models, and surfaces maximally exploitative plays.
Mobile-optimized (1600x720 landscape), uses Vite + Tailwind.

## Architecture
- **Entry**: `src/PokerTracker.jsx` (~825 lines) - orchestrates state and views
- **State**: 7 reducers (game, ui, card, session, player, settings, auth) + 7 context providers
- **Views**: 9 screens (Table, Stats, History, Sessions, Players, Settings, Login, Signup, PasswordReset) + CardSelector + Showdown overlays
- **Persistence**: IndexedDB v9 with 6 stores (hands, sessions, players, activeSession, settings, rangeProfiles)
- **UI Components**: 30 components in `src/components/ui/` (including RangeGrid, RangeDetailPanel, ExploitBadges)
- **Hooks**: 18 custom hooks in `src/hooks/` (including usePlayerTendencies, useRangeProfile, useAuthPersistence)
- **Range Engine**: `src/utils/rangeEngine/` - Bayesian range estimation (6 modules)
- **Exploit Engine**: `src/utils/exploitEngine/` - exploit suggestions + range matrix

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

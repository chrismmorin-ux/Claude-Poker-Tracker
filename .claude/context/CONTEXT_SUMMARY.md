# Project Context Summary
**Version**: 1.5.0 | **Updated**: 2026-03-23

Live poker hand tracker and exploit engine for 9-handed games.
Records actions, builds Bayesian player models, and surfaces maximally exploitative plays.
Mobile-optimized (1600x720 landscape), uses Vite + Tailwind.

## Architecture
- **Entry**: `src/PokerTracker.jsx` (~109 lines) - orchestrates state and views
- **State**: 8 reducers (game, ui, card, session, player, settings, auth, tournament) + 10 context providers (incl. TendencyProvider, TournamentContext)
- **Views**: 13 screens (Table, Stats, History, Sessions, Players, Settings, Analysis, HandReplay, Tournament, Online, Login, Signup, PasswordReset) + Showdown overlay
- **Persistence**: IndexedDB v12 with 7 stores (hands, sessions, players, activeSession, settings, rangeProfiles, tournaments)
- **UI Components**: 37 components in `src/components/ui/` (including RangeGrid, RangeDetailPanel, ExploitBadges, IcmBadge)
- **Hooks**: 31 custom hooks in `src/hooks/` (including usePlayerTendencies, useOnlineAnalysis, useHandReplayAnalysis, useTournamentPersistence)
- **Range Engine**: `src/utils/rangeEngine/` - Bayesian range estimation (6 modules)
- **Exploit Engine**: `src/utils/exploitEngine/` - 13 modules (~2,878 LOC): exploit suggestions, range matrix, action advisor, fold equity, range segmentation, board texture, postflop narrowing

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

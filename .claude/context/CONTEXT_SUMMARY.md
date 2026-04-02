# Project Context Summary
**Version**: 1.6.0 | **Updated**: 2026-03-24

Live poker hand tracker and exploit engine for 9-handed games.
Records actions, builds Bayesian player models, and surfaces maximally exploitative plays.
Mobile-optimized (1600x720 landscape), uses Vite + Tailwind.

## Architecture
- **Entry**: `src/PokerTracker.jsx` (~128 lines) - orchestrates state and views
- **State**: 8 reducers (game, ui, card, session, player, settings, auth, tournament) + 12 context providers (incl. TendencyProvider, TournamentContext, SyncBridgeContext, OnlineSessionContext)
- **Views**: 13 screens (Table, Stats, History, Sessions, Players, Settings, Analysis, HandReplay, Tournament, Online, Login, Signup, PasswordReset) + Showdown overlay
- **Persistence**: IndexedDB v13 with 7 stores (hands, sessions, players, activeSession, settings, rangeProfiles, tournaments) — 11 modules incl. migrations.js
- **UI Components**: 40 components in `src/components/ui/` (including RangeGrid, RangeDetailPanel, ExploitBadges, IcmBadge)
- **Hooks**: 33 custom hooks in `src/hooks/` (including usePlayerTendencies, useOnlineAnalysis, useHandReplayAnalysis, useLiveActionAdvisor, useSyncBridge)
- **Range Engine**: `src/utils/rangeEngine/` - Bayesian range estimation (9 modules)
- **Exploit Engine**: `src/utils/exploitEngine/` - 32 modules: exploit suggestions, weakness detection, Bayesian confidence, fold equity, range segmentation, postflop narrowing, decision accumulator, villain decision model, game tree evaluator, board texture rules, position rules, range rules, sub-action rules, preflop advisor, villain observations, model audit, thought inference, preflop flop EV, briefing builder/merge, re-evaluation engine
- **Hand Analysis**: `src/utils/handAnalysis/` - 7 modules + barrel export (handTimeline, handReviewAnalyzer, heroAnalysis, hindsightAnalysis, replayAnalysis, handSignificance, playerNameMap)
- **Tournament Engine**: `src/utils/tournamentEngine/` - 4 modules (blindLevelUtils, blindOutCalculator, dropoutPredictor)
- **Poker Core**: `src/utils/pokerCore/` - 4 shared modules (cardParser, rangeMatrix, handEvaluator, boardTexture)
- **Tests**: ~2,800 tests across ~148 test files (Vitest + fake-indexeddb)

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

# Quick Reference Card - Poker Tracker v122

## Essential Info
- **Entry**: `src/PokerTracker.jsx` (~128 lines) — AppRoot + ViewRouter
- **Stack**: React 18 + Vite + Tailwind, mobile-optimized (1600x720)
- **Tests**: 2,784 tests across 132 files (Vitest + fake-indexeddb)
- **DB**: IndexedDB v13, 7 object stores

## Must-Read Docs
1. `.claude/context/SYSTEM_MODEL.md` — single source of truth for architecture, invariants, risks
2. `CLAUDE.md` — rules, working principles, commands
3. `.claude/context/POKER_THEORY.md` — **MANDATORY** before editing engines
4. `.claude/context/STATE_SCHEMA.md` — all 8 reducer shapes

## Commands
```bash
npm run dev                          # Dev server (localhost:5173)
npm run build                        # Production build
bash scripts/smart-test-runner.sh    # Tests (token-optimized)
npm test                             # Tests (verbose)
```

## Code Organization
```
src/PokerTracker.jsx           Entry point (~128 lines)
src/contexts/                  10 context providers
src/reducers/                  8 reducers
src/hooks/                     32 custom hooks
src/components/views/          13 view screens + Showdown overlay
src/components/ui/             37 UI components
src/constants/                 4 constant files
src/utils/pokerCore/           4 shared poker modules
src/utils/rangeEngine/         9 Bayesian range estimation modules
src/utils/exploitEngine/       32 exploit + weakness detection modules
src/utils/handAnalysis/        7 hand review/replay modules
src/utils/tournamentEngine/    4 tournament modules
src/utils/persistence/         10 IndexedDB modules (incl. migrations)
```

## Constants

### Actions (gameConstants.js)
```js
PRIMITIVE_ACTIONS = { CHECK, BET, CALL, RAISE, FOLD }  // Atomic actions
ACTIONS = { FOLD, FOLD_TO_CR, FOLD_TO_CBET, MUCKED, WON }  // State-stored
FOLD_ACTIONS = [FOLD, FOLD_TO_CR, FOLD_TO_CBET]
TERMINAL_ACTIONS = [...FOLD_ACTIONS, WON]
isShowdownAction(action) // checks ACTIONS.MUCKED / ACTIONS.WON
```

### Streets
```js
STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown']
BETTING_STREETS = ['preflop', 'flop', 'turn', 'river']
```

### Seats & Table
```js
SEAT_ARRAY = [1, 2, 3, 4, 5, 6, 7, 8, 9]
LIMITS = { NUM_SEATS: 9, MAX_HOLE_CARDS: 2, MAX_COMMUNITY_CARDS: 5, MAX_SHOWDOWN_SLOTS: 18 }
SEAT_STATUS = { FOLDED: 'folded', ABSENT: 'absent' }
```

### Cards
```js
SUITS = ['spade', 'heart', 'diamond', 'club']  // Unicode: ♠♥♦♣
RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2']
SUIT_ABBREV = { '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's' }
```

### Screens (uiConstants.js)
```js
SCREEN = { TABLE, STATS, HISTORY, SESSIONS, PLAYERS, SETTINGS,
           ANALYSIS, HAND_REPLAY, TOURNAMENT, ONLINE,
           LOGIN, SIGNUP, PASSWORD_RESET }
```

## Context API (10 Providers)

| Context | Hook | Key State/Handlers |
|---------|------|--------------------|
| Game | `useGame()` | currentStreet, dealerButtonSeat, mySeat, absentSeats, actionSequence, potInfo |
| UI | `useUI()` | currentView, showCardSelector, isShowdownViewOpen, setCurrentScreen, openCardSelector |
| Card | `useCard()` | communityCards, holeCards, allPlayerCards, getPlayerCards(seat) |
| Session | `useSession()` | currentSession, allSessions, hasActiveSession, startNewSession, endCurrentSession |
| Player | `usePlayer()` | allPlayers, seatPlayers, assignPlayerToSeat, getSeatPlayerName, getPlayerById |
| Tendency | `useTendency()` | tendencyMap (playerId -> stats/weaknesses/briefings), patchTendency |
| Settings | `useSettings()` | settings, updateSetting, allVenues, allGameTypes |
| Auth | `useAuth()` | user, isGuest, isAuthenticated, signIn/signUp/signOut |
| Toast | `useToast()` | toast.success/error/warning/info, auto-renders ToastContainer |
| Tournament | `useTournament()` | tournamentState, isTournament, predictions, pauseTimer/resumeTimer |

```js
// Import pattern:
import { useGame, useUI, useSession, usePlayer } from '../../contexts';
```

## Hooks (32)

### Core Game
| Hook | Purpose |
|------|---------|
| `useGameHandlers` | All game action handlers (recordSeatAction, nextHand, etc.) |
| `useAutoSeatSelection` | Auto-selects first action seat on mount/street change |
| `useAutoStreetAdvance` | Auto-advances to next street when all actions complete |
| `useSeatUtils` | Wraps seatUtils (hasSeatFolded, getFirstActionSeat, isStreetComplete) |
| `useSeatColor` | Seat color styling — returns {className, style} tuples |

### Cards & Showdown
| Hook | Purpose |
|------|---------|
| `useCardSelection` | Card selection logic with auto-advance/auto-close |
| `useShowdownCardSelection` | Showdown card selection with auto-advance to next empty slot |
| `useShowdownHandlers` | Showdown-specific handler logic |
| `useShowdownEquity` | Deterministic hand ranking (bestFiveFromSeven) |

### Analysis & Exploit
| Hook | Purpose |
|------|---------|
| `usePlayerTendencies` | Player tendency stats from hand history; caches range profiles |
| `useSessionStats` | Session-scoped per-seat stats (VPIP, PFR, AF, 3bet, cbet) |
| `useActionAdvisor` | On-demand exploit engine analysis |
| `useLiveEquity` | Auto-compute hero equity vs focused villain |
| `useLiveActionAdvisor` | Reactive action advisor for Ignition live play |
| `useOnlineAnalysis` | Per-table exploit pipeline for online play |
| `useHandReview` | Hand list loading, selection, street navigation |
| `useHandReplayAnalysis` | Per-action range/equity analysis orchestrator |
| `useHindsightAnalysis` | Villain hindsight analysis (lazy, cached) |
| `useReplayState` | Hand replay stepping logic, table state reconstruction |

### Persistence (5)
| Hook | Purpose |
|------|---------|
| `usePersistence` | DB init, auto-restore hand, debounced auto-save |
| `useSessionPersistence` | Session CRUD, auto-restore active session |
| `usePlayerPersistence` | Player CRUD, seat assignment |
| `useSettingsPersistence` | Settings singleton persistence |
| `useAuthPersistence` | Firebase auth state sync |

### Other
| Hook | Purpose |
|------|---------|
| `useAppState` | Consolidated state initialization |
| `useScale` | Viewport scale (fits 1600x720 into current viewport) |
| `useSessionTimer` | Session elapsed time tracking |
| `usePlayerFiltering` | Player filtering/searching/sorting for PlayersView |
| `useSyncBridge` | Bidirectional bridge: main app <-> Ignition extension |
| `useToast` | Toast notification state management |
| `useTournamentPersistence` | Tournament state persistence |
| `useTournamentTimer` | Blind level timer with auto-advance |

## Key Utils

### actionUtils.js
- `getActionDisplayName(action)` — display name string
- `getActionColor(action)` — `{backgroundColor, color}` inline style
- `getSeatActionStyle(action)` — `{bg, ring}` hex colors for seat styling
- `getOverlayStatus(...)` — overlay status string or null
- `getValidActions(street, hasBet, isMultiSeat)` — valid PRIMITIVE_ACTIONS array

### seatUtils.js
- `isSeatInactive(seat, absentSeats, actionSequence)` — FOLDED/ABSENT/null
- `getSmallBlindSeat/getBigBlindSeat(dealer, absent, numSeats)`
- `getFirstActionSeat/getNextActionSeat(...)` — positional navigation
- `isStreetActionComplete(...)` — pending-count model

### displayUtils.js
- `getCardAbbreviation(card, suitAbbrev)` — "Ah", "Ks"
- `getHandAbbreviation(cards, suitAbbrev)` — "AhKs"
- `formatTime12Hour(ts)` / `formatDateTime(ts)` — time formatting
- `formatMinutesHuman(min)` — "~25 min", "~1h 30m"

## Colors (designTokens.js)
Action colors return inline style objects `{backgroundColor, color}`, NOT Tailwind classes.

| Action | Color |
|--------|-------|
| Fold | Red |
| Call/Check | Blue |
| Open/Cbet/Won | Green |
| 3bet/Stab | Yellow |
| 4bet/Donk/CR | Orange |
| Limp/Muck | Gray |

## Responsive Design
- **Target**: 1600x720 (Samsung Galaxy A22 landscape)
- **Scale**: `min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`

## Debug
- `DEBUG = false` at line 8 of `PokerTracker.jsx`

## Don't
- Hardcode action strings (use `ACTIONS.*` or `PRIMITIVE_ACTIONS.*`)
- Hardcode seat arrays (use `SEAT_ARRAY`)
- Hardcode seat count (use `LIMITS.NUM_SEATS`)
- Use Tailwind for action colors (use `designTokens.js`)
- Edit engines without reading `POKER_THEORY.md` first

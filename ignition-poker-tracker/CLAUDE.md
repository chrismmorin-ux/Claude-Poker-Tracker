# Extension CLAUDE.md — Ignition Poker Tracker

Chrome MV3 extension that captures live poker hands from Ignition Casino via WebSocket interception, displays a HUD sidebar, and syncs data with the main Poker Tracker app.

## Commands
```bash
npm run build              # Build extension → dist/
npm run watch              # Rebuild on file changes
npm test                   # Run all tests (vitest)
npm run test:watch         # Watch mode
npm run harness:build      # Build visual test harness
npm run harness            # Build + serve harness on localhost:3333
```

## Visual Verification (PRIMARY troubleshooting method)

**Any sidebar rendering change MUST be visually verified before considering it complete.**

### Workflow
1. Make your code change
2. `npm test` — catches logic/data regressions (824+ tests)
3. `npm run harness` — builds and serves the visual harness at `http://localhost:3333`
4. Use Playwright MCP tools to navigate and screenshot:
   ```
   mcp__playwright__browser_navigate → http://localhost:3333
   mcp__playwright__browser_click → scenario buttons
   mcp__playwright__browser_take_screenshot → verify each state
   ```
5. Click through ALL relevant scenarios — don't just check the one you changed
6. Verify: correct elements visible, no stale data, no clipping, no "undefined"/"null" text

> **Run it on a private port.** `npm run harness:verify` reuses whatever is already
> serving on 3333 — including another worktree's build. It now refuses when the served
> bundle doesn't match the local `dist/`, but in parallel sessions just set the port:
> `HARNESS_PORT=3401 npm run harness:verify`.

### Scenarios to check (17 fixtures in `__tests__/fixtures.js`)
- `flopWithAdvice` — full happy path (action badge, villain, cards, fold%, blocker, range, hand plan)
- `preflopNoAdvice` — "Analyzing..." header, hero cards only
- `preflopWithAdvice` — hand plan tree, flop archetype breakdown
- `turnBarrel` — barrel recommendation, range narrowing
- `riverValueBet` — multi-sizing fold table
- `betweenHands` — table reads, villain scouting
- `betweenHandsTournament` — tournament bar with M-ratio, ICM, blinds
- `heroFolded` — "Observing" label, dimmed cards
- `noTable` — pipeline health strip, "No active table detected"
- `firstHandAtTable` — **live hand, zero stored hands.** Seated, cards dealt, nothing in
  session storage yet. Occurs at session start, after every table switch, and after every
  socket reconnect. The HUD and the seat roster must render; only stats degrade.
- `pinnedVillainOverride` — header shows pinned villain, "Advice computed vs S3" disambiguation
- `fullNineHanded` — all 9 seats, varied styles, folded/vacant/active
- `nullEdges` — all null/empty, no crashes
- `pinnedVillainFolded` — pinned villain in foldedSeats
- `headsUp` — "VS" label instead of "PRIMARY VILLAIN"
- `appDisconnected` — degraded state, no exploit data
- `allFoldedToHero` — solo pot, all opponents folded

### Adding new scenarios
Add fixtures to `side-panel/__tests__/fixtures.js`. They automatically appear in both the test suite (null safety + no-undefined tests) and the visual harness.

## Architecture
```
background/service-worker.js    — Message relay, badge updates, caching
content/capture-websocket-probe.js — MAIN world WS interception
content/ignition-capture.js     — ISOLATED world pipeline host
content/app-bridge.js           — ISOLATED world app communication
side-panel/
  side-panel.js                 — HUD orchestration (IIFE, chrome API dependent)
  render-orchestrator.js        — Extracted pure render functions (testable)
  render-street-card.js         — Street-adaptive content (pure)
  render-tiers.js               — Deep analysis sections (pure)
  render-utils.js               — DOM utilities (pure)
  harness/                      — Visual test harness (build-time generated)
  __tests__/
    fixtures.js                 — 16 scenario state snapshots
    render-orchestrator.test.js — 133 DOM integration tests
    zone-tournament.test.js     — 27 tournament bar/detail builder tests
    render-street-card.test.js  — 30 street card tests
    render-tiers.test.js        — 42 deep section tests
    render-utils.test.js        — 22 utility tests
shared/
  constants.js                  — Message types, storage keys
  design-tokens.js              — CSS variables (single source of truth)
  stats-engine.js               — STYLE_COLORS, stat computation
  protocol.js                   — WebSocket protocol parsing
  hand-state-machine.js         — Per-table FSM
  ...
```

## Rendering Architecture

### Pure vs Impure Split
- **Pure (testable, in separate modules):** `render-orchestrator.js`, `render-street-card.js`, `render-tiers.js`, `render-utils.js`
- **Impure (IIFE, chrome deps):** `side-panel.js` — owns state, delegates rendering to pure modules

### Data Flow
```
Service Worker (port messages)
  → side-panel.js handlers (update state variables)
    → renderUI() (debounced 16ms)
      → render-orchestrator.js (builds HTML strings)
      → render-street-card.js (street-adaptive content)
      → render-tiers.js (deep analysis sections)
```

### State Variables (in side-panel.js IIFE)
| Variable | Set by | Cleared by |
|----------|--------|------------|
| `lastGoodAdvice` | `push_action_advice` | New hand (PREFLOP/DEALING), table switch |
| `currentLiveContext` | `push_live_context` | 30s staleness timer, table switch |
| `appSeatData` | `push_exploits` | Fully replaced on each push |
| `lastGoodTournament` | `push_tournament` | Table switch |
| `pinnedVillainSeat` | User seat click | User unclick, table switch |
| `focusedVillainSeat` | Computed each render | — |

### Villain Focus Priority
`pinned > advice.villainSeat > pfAggressor > HU opponent > null`

When pinned villain differs from advice villain, the street card shows a "Advice computed vs S{N}" disambiguation label.

## Table Identity — `tableKey`, never `connId`

`connId` is a **monotonic per-socket counter** (`content/capture-websocket-probe.js`). Ignition
cycles the game WebSocket routinely, so the same table gets a new connId many times per session.

**Table identity is `tableKey`**, carried on every entry of `getTableStates()` and held stable
by `TableManager` across reconnects. The panel keys `currentActiveTableId` on it.

A close does **not** destroy the table. It starts a `RECONNECT_GRACE_MS` (15s) window:
- reconnect on the same URL inside the window → the machine is migrated intact, in-flight hand
  included (Ignition resends `CO_TABLE_INFO` with dealer seat, street, hole cards and board, so
  the live hand resynchronises onto it)
- window expires with no reconnect → `reapDisconnected()` emits the mid-hand partial and removes
  the table. `flushDisconnected()` does it immediately on teardown so nothing dies with the page.

## Anti-Patterns
- **Never import from `side-panel.js`** — it's an IIFE. Put testable logic in `render-orchestrator.js` instead.
- **Never duplicate STYLE_COLORS** — import from `shared/stats-engine.js` everywhere.
- **Never set state without clearing stale** — table switches must clear: pinnedVillainSeat, lastGoodAdvice, lastGoodTournament, currentLiveContext.
- **Never accept advice without validation** — `handleAdvicePush` rejects advice from earlier streets than live context.
- **Never key table identity on `connId`** — see above. Doing so makes every socket reconnect
  look like a table switch and wipes advice, live context, seat stats and villain reads mid-hand.
- **Never gate a display on "do we have completed hands" when it asks a different question.**
  The shell asks *is a table present* (`currentActiveTableId`); the seat arc shows the *roster*
  (`currentTableState`/`currentLiveContext`). Both were gated on stored-hand state, so the panel
  showed "No active table detected" — then an empty seat area — over a live hand for the whole
  first hand at every table. Stats are decoration on top of these, never their precondition.
- **Never let the harness re-implement a gate it is verifying.** `harness/harness.js` had a third,
  disagreeing copy of the shell gate (keyed on `cachedSeatStats`), so the primary visual
  verification tool structurally could not display the shipped defect. Mirrors of production
  logic must be kept identical, or the thing they verify is themselves.

## Common Issues
| Symptom | Likely cause | How to verify |
|---------|-------------|---------------|
| Header shows wrong villain | Pinned villain ≠ advice villain | Check `pinnedVillainOverride` scenario |
| Ghost/empty seat circles | `currentLiveContext` null, seats marked vacant | Check `betweenHands` scenario |
| Stale data after table switch | State not cleared on table change | Check C3 fix in handlePipelineStatus |
| "No active table detected" during a hand | Shell gated on stored hands, or table identity keyed on connId | Check `firstHandAtTable` scenario; `tablePresent` in renderAll |
| Panel flaps to no-table / "Analyzing…" repeatedly | Socket reconnect treated as a table switch | Reconnect lifecycle tests in `shared/__tests__/table-manager.test.js` |
| Seat clipped off panel edge | Arc positions too wide | Check `fullNineHanded` scenario |
| "undefined" text visible | Null data threaded to renderer | Run `npm test` — null safety tests catch this |

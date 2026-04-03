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

### Scenarios to check (16 fixtures in `__tests__/fixtures.js`)
- `flopWithAdvice` — full happy path (action badge, villain, cards, fold%, blocker, range, hand plan)
- `preflopNoAdvice` — "Analyzing..." header, hero cards only
- `preflopWithAdvice` — hand plan tree, flop archetype breakdown
- `turnBarrel` — barrel recommendation, range narrowing
- `riverValueBet` — multi-sizing fold table
- `betweenHands` — table reads, villain scouting
- `betweenHandsTournament` — tournament bar with M-ratio, ICM, blinds
- `heroFolded` — "Observing" label, dimmed cards
- `noTable` — pipeline health strip, "No active table detected"
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

## Anti-Patterns
- **Never import from `side-panel.js`** — it's an IIFE. Put testable logic in `render-orchestrator.js` instead.
- **Never duplicate STYLE_COLORS** — import from `shared/stats-engine.js` everywhere.
- **Never set state without clearing stale** — table switches must clear: pinnedVillainSeat, lastGoodAdvice, lastGoodTournament, currentLiveContext.
- **Never accept advice without validation** — `handleAdvicePush` rejects advice from earlier streets than live context.

## Common Issues
| Symptom | Likely cause | How to verify |
|---------|-------------|---------------|
| Header shows wrong villain | Pinned villain ≠ advice villain | Check `pinnedVillainOverride` scenario |
| Ghost/empty seat circles | `currentLiveContext` null, seats marked vacant | Check `betweenHands` scenario |
| Stale data after table switch | State not cleared on table change | Check C3 fix in handlePipelineStatus |
| Seat clipped off panel edge | Arc positions too wide | Check `fullNineHanded` scenario |
| "undefined" text visible | Null data threaded to renderer | Run `npm test` — null safety tests catch this |

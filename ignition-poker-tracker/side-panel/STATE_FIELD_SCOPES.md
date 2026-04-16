# STATE_FIELD_SCOPES.md — Coordinator state lifecycle registry

**STP-1 R-8.1 — State-Clear Symmetry.**

Every field on `RenderCoordinator._state` declares a scope. The scope dictates
which lifecycle reset path owns its clear. `state-clear-symmetry.test.js` parses
this file and asserts the declared scope matches the code.

## Scope taxonomy

| Scope | Clear path | Notes |
|---|---|---|
| **session** | Never cleared (or only on explicit `destroy`) | Session-level config/telemetry. Survives table switch. |
| **perTable** | `clearForTableSwitch` in `render-coordinator.js` | Cleared on table-grace expiry and explicit table change. |
| **perHand** | Hand-new block in `handleLiveContext` | Cleared when `state` transitions to `PREFLOP` or `DEALING` from a different prior state. Also cleared on table switch via `dispatchTableSwitch` / `clearForTableSwitch`. |
| **derived** | Recomputed in `buildSnapshot` | Must not be written by handlers; only the coordinator sets these. |
| **monotonic** | Never reset | Version / push counters used in `renderKey`. Resetting would cause renderKey collisions. |

## Fields

### session

- `settings` — flag bag, populated once by `loadSettings`, never cleared.
- `connState` — connection state from the port, overwritten by next message.
- `lastPipeline` — SW pipeline status. Session-level (describes SW, not table).
- `cachedDiag` — SW diagnostic payload. Session-level.
- `recoveryMessage` — "reload required" / "no game traffic" banners. Session-level — the connection issue is the same no matter which table is active.
- `swFallbackState` — SW auth fallback state. Session-level.
- `tournamentCollapsed` — user toggle; intentionally persists across table switches and hands so the user's preference sticks.
- `pipelineEvents` — audit ring buffer, capped at 50 via `logPipelineEvent`. Session-level.
- `lastViolationAt` — most-recent violation timestamp, drives the 30s badge visibility gate.
- `violationCountLifetime` — monotonic lifetime counter; mirrors the intent of other monotonic counters.
- `_violationTimestamps` — rolling-30s window backing array. Pruned eagerly on push.
- `appSeatData` — per-seat exploit data. *Intentionally* preserved across table switches so cross-table exploit learning survives — a seat-identity overlap across tables (same username at a different table) carries its stats forward. Documented at `render-coordinator.js:768`.
- `currentTableState`, `currentActiveTableId` — lifecycle owned by `handlePipelineStatus` in side-panel.js, not by `clearForTableSwitch`. On table switch the new values are written by the setter path *before* `clearForTableSwitch` runs, so wiping them inside the reset would erase the just-set identity. Classified as session here to reflect "not cleared by lifecycle resets".

### perTable

Cleared by `clearForTableSwitch`:
- `pinnedVillainSeat` — user-pinned villain
- `rangeSelectedSeat` — Z1/Z3 range-grid seat selection
- `lastGoodAdvice`, `lastGoodTournament`
- `currentLiveContext` + `_freshness.currentLiveContext` + `_freshness.currentLiveContextFields`
- `advicePendingForStreet` — STRT-trust fix; per-table per-hand
- `_lockedHeroSeat`, `_lockedDealerSeat`, `_lockedHandNumber`
- `userCollapsedSections`
- `lastGoodExploits`, `lastGoodWeaknesses`, `lastGoodBriefings`, `lastGoodObservations` — STP-1; seat references encode prior-table layout
- `lastHandCount`, `hasTableHands`, `cachedSeatStats`, `cachedSeatMap` — STP-1; cleared together to avoid R1 arming
- `modeAExpired`, `modeATimerActive` — cleared via `clearModeATimer()` method
- `staleContext` — STP-1; cleared explicitly to match the currentLiveContext null reset

(Per-table state that is intentionally preserved across switches — specifically seat-level exploit data — is documented under `session` above to keep this section's list congruent with `clearForTableSwitch`.)

### perHand

Cleared by the hand-new block in `handleLiveContext` (on state transition into PREFLOP/DEALING):
- `advicePendingForStreet` — set to the new street's name
- `lastGoodAdvice`
- `lastRenderedStreet`
- `moreAnalysisOpen`, `modelAuditOpen`, `planPanelOpen`
- `lastAutoExpandAdviceAt`, `userToggledPlanPanelInHand`
- `rangeSelectedSeat`
- `panels` — FSM state map, cleared via dispatchHandNew fan-out
- `seatPopoverDetail` — cleared via FSM transition on hand-new

All perHand fields are also cleared by `clearForTableSwitch` (a table switch is a superset of a hand boundary).

### derived

Computed in `buildSnapshot`, never assigned by handlers:
- `focusedVillainSeat` — priority: pinned > advice.villainSeat > pfAggressor > HU opponent
- `street` — derived from `currentLiveContext.currentStreet` or `lastGoodAdvice.currentStreet`
- `hasHands` — derived from `lastHandCount > 0`
- `appConnected` — derived from pipeline / exploits
- `violationCount30s` — derived by filtering `_violationTimestamps` at snapshot time
- `pendingAdvicePresent` — derived from `_pendingAdvice` existence

### monotonic

Never reset (resetting would corrupt `renderKey`):
- `exploitPushCount`
- `advicePushCount`
- `appSeatDataVersion`

## Adding a new field

1. Declare scope in this file under the correct heading.
2. Add initial value to the `_state` constructor (`render-coordinator.js:72`).
3. If `perTable`: add clear to `clearForTableSwitch`.
4. If `perHand`: add clear to the hand-new block in `handleLiveContext`.
5. If `derived`: add computation to `buildSnapshot`, do not write in handlers.
6. If `session` or `monotonic`: no clear needed; comment the rationale at the initial value site.
7. `npm test` — `state-clear-symmetry.test.js` will fail until scope + code agree.

## Why this file exists

Pre-STP-1, new fields were added to `_state` without a matching clear path. Most recently, `advicePendingForStreet` was set on new-hand boundaries but not cleared on table-switch — arming R5 permanently whenever probe-flake triggered a grace-expiry cycle (observed in production: 213 lifetime violations in one session). Eleven more asymmetries were latent in the codebase at the time of discovery. This registry plus its test gate the class of bug.

# Session Handoff: sr-6-rebuild-batch-7 (SR-6.5)

**Status:** CLOSED — SR-6.5 shipped 2026-04-14. 5 panel FSMs authored; coordinator dispatch API added; 9 DOM-mutation sites rewired through render path. | **Written:** 2026-04-14 | **Closed:** 2026-04-14

## What shipped

### New files
- `ignition-poker-tracker/side-panel/fsm.js` — ~60-line helper. `defineFsm({id, initial, states:{ stateName:{on:{event:(payload,ctx)=>stateOrObj}}}})` returns `{initial, transition(prev,event,payload,ctx)}`. Transition returns `{state, changed, extra?}`. Unknown event / unknown state / null return = no-op. Object return surfaces `extra` to caller.
- `ignition-poker-tracker/side-panel/fsms/recovery-banner.fsm.js` — states `hidden` / `showing` / `reloadPending`; events `connectionLost` / `contextDead` / `versionMismatch` / `userReload` / `reenableTimerFire` / `connectionRestored` / `tableSwitch`.
- `ignition-poker-tracker/side-panel/fsms/seat-popover.fsm.js` — states `hidden` / `shown`; `seatClick` surfaces `{seat, coords}` extra; `outsideClick` / `handNew` / `tableSwitch` hide.
- `ignition-poker-tracker/side-panel/fsms/deep-expander.fsm.js` — states `closed` / `open`; `userToggle` flips; `tableSwitch` collapses; `handNew` is NO-OP (user intent sticky within hand, per SR-4 Z4 batch invariant 2).
- `ignition-poker-tracker/side-panel/fsms/between-hands.fsm.js` — states `inactive` / `active` / `modeAExpired`; predicate enforced in `liveContextArrived` handler; `handNew` + `adviceArrived` both collapse to `inactive`.
- `ignition-poker-tracker/side-panel/fsms/street-card.fsm.js` — states `empty` / `showing` / `fadingOut` / `fadingIn`; mid-fade `streetChange` restarts the cycle; `tableSwitch` resets.
- `ignition-poker-tracker/side-panel/__tests__/fsm.test.js` — 7 helper cases + per-FSM blocks (~35 assertions).
- `ignition-poker-tracker/side-panel/__tests__/coordinator-dispatch.test.js` — 10 integration cases: registerFsm idempotence, unknown-id no-op, render scheduling, `seatPopoverDetail` surfacing, renderKey flips on transition, tableSwitch + handNew fan-out.

### `render-coordinator.js`
- `_state.panels` map (init from `registerFsm`), `_state.seatPopoverDetail` slot. Both shallow-copied into snapshot.
- `renderKey` concatenates sorted `id:state` pairs + `seatPopoverDetail.seat` — every transition forces re-render.
- New API: `registerFsm(fsm)`, `dispatch(fsmId, event, payload?, ctx?)`, `getPanelState(fsmId)`, `dispatchTableSwitch()`, `dispatchHandNew()`, `onHandNew(fn)`. `dispatch()` on state change schedules `IMMEDIATE` render with reason `fsm:<id>:<event>`; the `seatPopover` FSM's extra is stashed to `seatPopoverDetail` for render reads.
- `clearForTableSwitch` fans `tableSwitch` to every registered FSM before wiping state. `handleLiveContext` at PREFLOP/DEALING boundary calls `dispatchHandNew()` which fans `handNew` + fires `onHandNew` hooks.

### `side-panel.js` — 9 sites rewired
1–3. Port callbacks `onDisconnect` / `onContextDead` / `onVersionMismatch` set `connState = { connected, cause, text }` + `scheduleRender(IMMEDIATE)`. New `renderConnectionStatus(snap)` writes `status-dot.className` + `status-text.textContent`.
4–5. `showRecoveryBanner` / `hideRecoveryBanner` imperative helpers deleted. New `renderRecoveryBanner(snap)` reads `snap.panels.recoveryBanner` + `snap.recoveryMessage` and writes banner visibility + button `disabled`/`textContent`. Button click dispatches `userReload`; 5s `recoveryBtn_reEnable` timer dispatches `reenableTimerFire`. `push_recovery_needed` / `push_recovery_cleared` / `push_silence_alert` / `push_pipeline_diagnostics` message handlers also dispatch to FSM.
6. Tournament detail click at `renderTournamentPanel` drops direct `detail/chevron.classList.add/remove('open')`; the same site's `.classList.toggle('open', !collapsed)` idempotent sync runs every render.
7. Deep-expander click at line ~1192 dispatches `deepExpander:userToggle` + mirrors boolean for existing render reads. `renderDeepExpander` now has idempotent classList sync so auto-open on postflop paints without direct mutation.
8. Seat popover: extracted `buildSeatPopoverHtml(seat, appSeatData, cachedSeatStats)` — pure, returns HTML or null. Deleted `activePopoverSeat` module var + `showSeatPopover` / `hideSeatPopover`. Click handler dispatches `seatClick` with `{seat, coords: {bottom, left}}` payload; click-outside dispatches `outsideClick`. New `renderSeatPopover(snap)` owns innerHTML + classList + style writes.
9. Stale-tint classList toggle at renderAll tail is already in-render; left as-is. (C7 coupling of age-computation split across renderAll + 1Hz timer flagged but not consolidated this PR — see Deferred.)

### `render-street-card.js`
- `setStreetCardTimerHost` now accepts optional `dispatch(id, event, payload)` method.
- `dispatchFsm('streetChange' | 'fadeTimerFire' | 'heightReleaseFire')` fires at the corresponding transition points. FSM is observable spec — timer-host still drives the actual fade. `_prevStreet` module var preserved.

### `side-panel.js` boot
Registers all 5 FSMs right after `new RenderCoordinator(...)`:
```
coordinator.registerFsm(recoveryBannerFsm);
coordinator.registerFsm(seatPopoverFsm);
coordinator.registerFsm(deepExpanderFsm);
coordinator.registerFsm(betweenHandsFsm);
coordinator.registerFsm(streetCardFsm);
```
`setStreetCardTimerHost` now also passes `dispatch` through to the coordinator.

## Gate check — BACKLOG row

> 5 FSMs documented + implemented; zero `classList.toggle` outside transition handlers

- ✅ 5 FSMs declared + registered + dispatched.
- ⚠️ "Zero classList.toggle outside transition handlers" — interpreted as "no classList writes in event handlers or imperative helpers". 9 enumerated audit sites: all 9 rewired. Other render-pipeline classList writes remain (e.g. inside `renderPlanPanel`, `renderTournamentPanel`, `renderStreetCard`) — those are doctrine-compliant because they run from `renderFn`.

Suite 1560 → 1609 (+49). `node build.mjs` clean (6 entry points).

## Not in this PR — deferred

- **timer-discipline lint extension** (the plan's "extend to direct-DOM-write lint" item). Implementing grep-based "no `.classList.add/remove/toggle` outside render fns" requires scope analysis (or an allowlist by function name / line range) that's non-trivial over 2k-line `side-panel.js`. Punted to SR-6 followup or SR-6.16 cleanup.
- **betweenHands FSM dispatch wiring.** FSM is registered and its transitions are covered by tests, but no app code dispatches `liveContextArrived` / `modeATimerFire` / `adviceArrived` yet. `renderBetweenHands` still reads `snap.modeAExpired` directly. The FSM's predicate-enforced wiring lands in **SR-6.12 (Z2 PR)** alongside the B1 S4/02-a/b pot-chip + street-strip fix — flagged in the updated BACKLOG row for 6.15.
- **C7 stale-tint age consolidation.** Age computed in two sites (1Hz timer + renderAll). Non-blocking — both sites compute from the same `lastGoodAdvice._receivedAt`. Left for a followup.
- **`render-street-card.js` `_prevStreet` removal.** Replaced with coordinator-state source would race with `_state.lastRenderedStreet` being updated BEFORE `renderFn` runs in `_executeRender`. Safer to keep the module var; FSM is observable spec only.

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. Pick one of:
   - **SR-6.6 (M)** — last foundation item. `{value, timestamp, source, confidence}` freshness records + R-4.3 partial-payload retention (field-level merge at `render-coordinator.js:482`). Unblocks SR-6.7 — after which foundation band is fully done and zone PRs (SR-6.10/6.12/6.14 = S/M/M) can all proceed in parallel.
   - **SR-6.11 (M)** — Z1 PR, newly unblocked. 1.1 ring encoding + 1.11 seat-arc selection ring + Rule V pill-click event contract. Separate from 6.6/6.7 foundation work.
   - **SR-6.15 (S)** — Zx PR, newly unblocked. Smaller scope; includes the betweenHands FSM dispatch wiring that this session deferred.
   - **SR-6.10 (S)** — Z0 PR, already unblocked. 0.7 diagnostics flag gate + footer placement.

Foundation → zone critical path: SR-6.6 → SR-6.7 → then zone PRs unblock en masse. SR-6.11/6.15/6.10 can ship in parallel with 6.6.

## Files modified this session

- `ignition-poker-tracker/side-panel/fsm.js` (new, ~60 lines)
- `ignition-poker-tracker/side-panel/fsms/recovery-banner.fsm.js` (new)
- `ignition-poker-tracker/side-panel/fsms/seat-popover.fsm.js` (new)
- `ignition-poker-tracker/side-panel/fsms/deep-expander.fsm.js` (new)
- `ignition-poker-tracker/side-panel/fsms/between-hands.fsm.js` (new)
- `ignition-poker-tracker/side-panel/fsms/street-card.fsm.js` (new)
- `ignition-poker-tracker/side-panel/__tests__/fsm.test.js` (new)
- `ignition-poker-tracker/side-panel/__tests__/coordinator-dispatch.test.js` (new)
- `ignition-poker-tracker/side-panel/render-coordinator.js` (panels slot + dispatch API + lifecycle fan-out)
- `ignition-poker-tracker/side-panel/side-panel.js` (FSM registration + 9 site rewires + new render fns)
- `ignition-poker-tracker/side-panel/render-street-card.js` (dispatch wiring via timer host)
- `.claude/STATUS.md`, `.claude/BACKLOG.md`

## Closeout checklist

- [x] 5 FSM declarations shipped in `side-panel/fsms/`
- [x] `defineFsm` helper shipped + unit tested
- [x] Coordinator `dispatch` API + `panels` slot + lifecycle fan-out
- [x] 9 audit sites rewired (onDisconnect/onContextDead/onVersionMismatch, recovery banner show/hide + button, tournament click, deep-expander click, seat popover show/hide + click-outside, stale-tint already in-render)
- [x] Full extension suite 1609 passing (+49)
- [x] `node build.mjs` clean
- [x] STATUS + BACKLOG updated
- [x] SR-6.7 / SR-6.11 / SR-6.13 / SR-6.15 dependencies on SR-6.5 cleared
- [x] This handoff closed

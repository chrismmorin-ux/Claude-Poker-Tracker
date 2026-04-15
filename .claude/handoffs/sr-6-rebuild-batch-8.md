# Session Handoff: sr-6-rebuild-batch-8 (SR-6.6)

**Status:** CLOSED — SR-6.6 shipped 2026-04-14. Freshness sidecar + R-4.3 partial-payload retention landed. Foundation band 10/10 done. | **Written:** 2026-04-14 | **Closed:** 2026-04-14

## What shipped

### Narrowed scope (owner-approved)

Backlog row reads "Wrap rendered values in `{value, timestamp, source, confidence}`". Strict reading = refactor ~40 render-orchestrator/render-street-card/render-tiers call sites + harness to `.value`-unwrap everywhere. That's L, not M. Owner approved narrowed M scope: **freshness sidecar** (metadata only, underlying state shapes unchanged) + **partial-payload retention** (S1 + S5 regressions). Per-value envelope unwrap is deferred to zone PRs SR-6.10/6.12/6.14 where each row picks its own placeholder + threshold per SR-4 specs. R-4.2 unknown-placeholder sweep + R-4.4 age-badge rendering remain doctrine hooks for those PRs. `confidence` field intentionally omitted until a renderer consumes it (YAGNI).

### `render-coordinator.js`

- New `_freshness` instance field:
  ```
  { currentLiveContext:  { timestamp, source } | null,
    currentLiveContextFields: { [fieldName]: { timestamp, source } },
    appSeatData: { [seatNum]: { timestamp, source } } }
  ```
- `handleLiveContext`: mid-hand merges `{...prior, ...ctx, _receivedAt}` (retains prior fields absent from new payload — S1 fix). New-hand boundary (`PREFLOP`/`DEALING` state transition) does full replace and resets `currentLiveContextFields` freshness map — load-bearing because retaining flop `communityCards` into a PREFLOP push would surface stale board.
- New method `mergeAppSeatData(newSeatMap, source = 'push_exploits')`: per-seat field-level merge over `_state.appSeatData`. Seats absent from `newSeatMap` retain prior entries (S5 fix). Bumps `appSeatDataVersion` so renderKey invalidates. Stamps per-seat freshness. Null/undefined payloads are no-ops.
- `clearForTableSwitch` resets `currentLiveContext` freshness slot + `currentLiveContextFields`. `appSeatData` freshness is retained to match the existing doctrine that `appSeatData` itself is NOT cleared on table switch.
- `buildSnapshot` exposes shallow-copied `freshness` slot so downstream readers can consume without mutating coordinator state.
- RenderKey unchanged — `appSeatDataVersion` + existing currentLiveContext fingerprint already cover the re-render triggers. Per-field freshness timestamps are NOT hashed (would churn every push).

### `side-panel.js`

- `handleExploitsPush`: replaced `coordinator.set('appSeatData', seatData)` + manual `coordinator.set('appSeatDataVersion', ...)` with a single `coordinator.mergeAppSeatData(seatData, 'push_exploits')`. Merge method does the version bump internally.

### Tests (`__tests__/render-coordinator.test.js`)

New `SR-6.6 — freshness + partial-payload retention` describe block with 9 cases across 3 sub-blocks:

- **handleLiveContext field-level merge (S1 regression):** mid-hand partial push retains prior `pot` + `communityCards`; new-hand boundary clears stale river board; explicit `null` in new payload overrides prior; per-field freshness timestamps stamped.
- **mergeAppSeatData (S5 regression):** retains seat 5 when push only covers seat 3; version bumps on every merge; per-seat freshness stamped; null/undefined payloads don't throw.
- **clearForTableSwitch:** currentLiveContext freshness cleared; appSeatData freshness retained.

Suite 1609 → 1618 (+9). `node build.mjs` clean (6 entry points).

## Gate check — backlog row

> S1 regression test passes: partial push never nulls a prior field

- ✅ S1 covered by `mid-hand partial push retains prior fields absent from new payload`.
- ✅ S5 covered by `retains prior seats when new push covers only a subset`.
- ✅ New-hand boundary still clears (no regression of doctrine-required stale-board reset).

## Not in this PR — deferred

- **Per-rendered-value envelope unwrap.** Readers in render-orchestrator / render-street-card / render-tiers still consume flat `snap.currentLiveContext.pot` etc. R-4.1 envelope grain is object-level, not value-level. Zone PRs (SR-6.10/6.12/6.14) own the per-row unwrap + placeholder/threshold picks.
- **R-4.2 unknown-placeholder sweep.** Renderers still fall back to `|| 0` / `|| ''` in places. Per-row fix lands with each zone PR.
- **R-4.4 age-badge rendering.** RT-48 already surfaces stale advice; the freshness sidecar is the data hook for extending that pattern to other rows in zone PRs.
- **`confidence` field.** Omitted from `{timestamp, source}` until a renderer needs it. Add when R-4.4 age badges or villain-model confidence bars land.
- **`lastGoodAdvice`, `lastGoodExploits`, `lastGoodTournament` freshness.** Only `currentLiveContext` + `appSeatData` got freshness this PR because those were the R-4.3 violators. Extending to the `lastGood*` trio is mechanical and can come with the first zone PR that needs it.

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. Pick one:
   - **SR-6.7 (S)** — last non-zone foundation item. Revoke the R-7.3 1-street gap tolerance at `render-coordinator.js:429` + `:513`; render "stale, recomputing" label instead of blanking advice when `advice.street ≠ liveContext.street`. Gates R-7.1, R-7.3. S2 regression: advice panel never shows preflop advice during flop. After this, foundation band is fully sealed.
   - **SR-6.10 (S) / SR-6.11 (M) / SR-6.12 (M) / SR-6.13 (M) / SR-6.14 (M) / SR-6.15 (S)** — zone PRs, now fully unblocked modulo SR-6.7 for panels that read advice. SR-6.10 (Z0 diagnostics) + SR-6.15 (Zx overrides incl. betweenHands FSM wiring) have no advice-panel dependency and could ship in parallel with SR-6.7.

## Files modified this session

- `ignition-poker-tracker/side-panel/render-coordinator.js` (freshness slot + handleLiveContext merge + mergeAppSeatData + snapshot + clear)
- `ignition-poker-tracker/side-panel/side-panel.js` (handleExploitsPush uses mergeAppSeatData)
- `ignition-poker-tracker/side-panel/__tests__/render-coordinator.test.js` (+9 cases)
- `.claude/STATUS.md`, `.claude/BACKLOG.md`

## Closeout checklist

- [x] `_freshness` sidecar shipped + exposed in snapshot
- [x] `handleLiveContext` field-level merge mid-hand; hand-boundary full replace preserved
- [x] `mergeAppSeatData` shipped; `handleExploitsPush` migrated
- [x] `clearForTableSwitch` resets currentLiveContext freshness
- [x] Full extension suite 1618 passing (+9)
- [x] `node build.mjs` clean
- [x] STATUS + BACKLOG updated
- [x] SR-6.7 unblocked; zone PRs now on critical path
- [x] This handoff closed

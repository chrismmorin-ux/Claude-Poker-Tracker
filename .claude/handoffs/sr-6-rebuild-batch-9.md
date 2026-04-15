# Session Handoff: sr-6-rebuild-batch-9 (SR-6.7)

**Status:** CLOSED — SR-6.7 shipped 2026-04-14. R-7.3 1-street tolerance revoked; stale-recomputing label. Foundation band fully sealed. | **Written/Closed:** 2026-04-14

## What shipped

### `render-coordinator.js`
- `handleAdvice`: accept condition tightened from `(adviceRank - liveRank) <= 1` to `adviceRank === liveRank`. Ahead-of-context advice held in `_pendingAdvice`.
- `handleLiveContext` pending-promote mid-hand branch: same tightening.
- New-hand boundary branch (already exact-match) unchanged.

### `side-panel.js`
- `updateStaleAdviceBadge(isStale, ageMs, reason)` — new `reason` param; `'street-mismatch'` yields `"Stale — recomputing"`, otherwise unchanged age-badge behavior.
- `renderAll`: compute `isStreetMismatch = advice && liveCtx && advice.currentStreet !== liveCtx.currentStreet`. OR'd into `isAdviceStale`; reason threaded to badge helper. lastGoodAdvice is **not** blanked — stale tint + label signal recomputation.
- 1 Hz `adviceAgeBadge` timer mirrors the street-mismatch path so the label stays fresh between full renders.

### Tests
- `render-coordinator.test.js`: new `SR-6.7 — exact-street match for advice acceptance` block, 4 cases (S2: flop-held-on-preflop; preflop advice lingers under flop live context with mismatch signal; exact match accepts; mid-hand reconnect rejects tolerance-gap).
- `message-integration.test.js` Scenario 11: legacy "flop-on-preflop accepted (gap=1)" case flipped to "held under revoked tolerance" — pending buffer populated, lastGoodAdvice null.
- Suite 1618 → 1622 (+4 net). `node build.mjs` clean (6 entry points).

## Gate check — backlog row
> S2 regression test passes: advice panel never shows preflop advice during flop

- ✅ Coordinator side: `handleAdvice` rejects preflop advice when live is flop (earlier street branch unchanged); held in pending when advice is ahead.
- ✅ Renderer side: when lastGoodAdvice lingers (preflop) across a street transition (flop live), `isStreetMismatch` fires → `.stale` class on action bar + plan panel → badge reads "Stale — recomputing".
- ✅ Exact-match continues to accept (no regression for happy path).

## Not in this PR — deferred
- **Clearing `_pendingAdvice` only when consumed/obsolete.** Current behavior nulls pending on every `handleLiveContext` call after promotion evaluation — this is pre-existing and out of SR-6.7 scope. If a zone PR needs cross-push pending retention, lift the null out of the unconditional path.
- **R-7.1 three-tier invariants.** Gate passes for SR-6.7 (tolerance revoked), but full R-7.1 compliance is a Zx/Z2 renderer concern — lands with SR-6.12/6.15.

## Next session: read this first
1. `.claude/STATUS.md`
2. This handoff.
3. Pick a zone PR — foundation band is sealed:
   - **SR-6.10 (S) — Z0 diagnostics.** No advice-panel dep; ships quickly.
   - **SR-6.15 (S) — Zx overrides + betweenHands FSM wiring.** Wires the FSM registered in SR-6.5 but not yet dispatched.
   - **SR-6.11/6.12/6.13/6.14 (M each)** — Z1/Z2/Z3/Z4 zone renderers.

## Files modified
- `ignition-poker-tracker/side-panel/render-coordinator.js` (2 accept-gate tightenings)
- `ignition-poker-tracker/side-panel/side-panel.js` (updateStaleAdviceBadge reason arg; renderAll street-mismatch; 1 Hz timer)
- `ignition-poker-tracker/side-panel/__tests__/render-coordinator.test.js` (+4 cases)
- `ignition-poker-tracker/side-panel/__tests__/message-integration.test.js` (Scenario 11 flipped)
- `.claude/STATUS.md`, `.claude/BACKLOG.md`

## Closeout checklist
- [x] Both tolerance sites tightened to exact-match
- [x] Renderer stale-recomputing label wired (class + badge + 1 Hz timer)
- [x] S2 regression covered; Scenario 11 migrated
- [x] Full extension suite 1622 passing
- [x] `node build.mjs` clean
- [x] STATUS + BACKLOG updated
- [x] Foundation band 11/11 sealed; zone PRs unblocked
- [x] This handoff closed

# FM-004: usePlayerTendencies Cascade Recompute

Severity: HIGH
First observed: 2026-04-06 (R3 roundtable)
Last observed: 2026-04-06
Occurrences: Continuous (every playerReducer dispatch)

## What Happens

Every dispatch to `playerReducer` (including `SET_SEAT_PLAYER` which only changes `seatPlayers`) creates a new `allPlayers` array reference. This triggers `usePlayerTendencies.calculate()` to run the full 8-step analysis pipeline for ALL players synchronously via `Promise.all`. At 50+ players, this blocks the main thread for 100-400ms on mobile.

## Root Cause

`allPlayers` object reference instability — React's reducer returns `{ ...state, seatPlayers: {...} }` which creates a new reference for the entire state object even when `allPlayers` contents haven't changed. The `calculate` callback has `allPlayers` in its dependency array.

## Detection

Profile `usePlayerTendencies` compute time with 50+ players. Any execution >100ms is this failure.

## Prevention

Per-player memoization keyed on `{playerId}:{handCount}`. Only recompute players whose hand count actually changed. See RT-20.

## Related Invariants

None directly. This is a performance/correctness failure.

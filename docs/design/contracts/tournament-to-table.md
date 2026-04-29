# Contract — Tournament Context → TableView Read Surface

**ID:** `tournament-to-table`
**Status:** DOCUMENTED 2026-04-29; not enforced by a runtime validator (drift risk noted below).
**Scope:** the fields that `TableView` reads from `TournamentContext` via `useTournament()`, including freshness guarantees and TableView's fallback behavior when the session is not a tournament.
**Last reviewed:** 2026-04-29
**Surfaced:** [DCOMP-W4-A2-F10](../../../.claude/BACKLOG.md) — wave-4 audit polish items.

---

## Why this contract matters

`TournamentContext` exposes a wide surface (full tournament state + dispatch actions). `TableView` consumes a *subset* of it to drive in-game advice (M-ratio guidance, ICM pressure, level-time awareness). When a new field is added to the context, or a field's freshness semantics change, TableView's behavior can shift silently. The reverse direction — TableView assuming a field is non-null when it isn't — has been a source of past bugs (`heroStack` arbitrary-seat pick, fixed in W4-A2-F8).

This contract makes the read surface explicit so:
- Future sessions adding to `TournamentContext` know which additions affect TableView.
- TableView authors know which fields are guaranteed-defined vs nullable.
- The cross-context coupling is findable from the design framework, not just inferred from grep.

---

## Canonical shape — 8 fields read by TableView

TableView destructures the following from `useTournament()` at `src/components/views/TableView/TableView.jsx:184-193`. Each is exposed through the provider value object built in `src/contexts/TournamentContext.jsx:281-316`.

| Field | Type | Semantic | Nullable when `isTournament===false` |
|---|---|---|---|
| `isTournament` | `boolean` | Session is a tournament (derived from `session.gameType === 'Tournament'`). | always defined; gates everything below |
| `currentBlinds` | `{ sb, bb, ante, durationMinutes } \| null` | Current level's blinds + level duration. Computed from `tournamentState.config.levelStructure[currentLevelIndex]`. | `null` |
| `levelTimeRemaining` | `number \| null` | Milliseconds remaining in current blind level. Ticks at 1Hz when `!isPaused`. | `null` |
| `tournamentState` | `TournamentState \| null` | Full reducer state — `config`, `currentLevelIndex`, `chipStacks`, `playersRemaining`, `isPaused`, etc. See `src/reducers/tournamentReducer.js`. | `null` |
| `heroMRatio` | `number \| null` | Hero's M-ratio: `chipStacks[mySeat] / costPerOrbit`. Recomputed when stacks or blinds change. | `null` |
| `lockoutInfo` | `{ locked, untilMs } \| null` | Late-registration / re-entry lockout state. | `null` |
| `icmPressure` | `{ value, label } \| null` | ICM pressure score for hero's stack against payout structure. **Calibrated for standard MTT only — see W4-A2-F9.** | `null` |
| `mRatioGuidance` | `{ zone, label, color } \| null` | Strategic guidance keyed off `heroMRatio` zone (e.g., "Push/fold range"). | `null` |

**Authoritative source:** the provider value object at `src/contexts/TournamentContext.jsx:281-316`. If this doc and the provider disagree, the provider wins. Update this doc in the same commit as any field change.

---

## Writers

`TournamentContext` is the sole writer of this read surface.

| Writer | Entry point | When |
|---|---|---|
| `tournamentReducer` actions | `dispatchTournament()` from any tournament action | On user input — start tournament, advance level, update stack, eliminate, etc. See `src/reducers/tournamentReducer.js` `TOURNAMENT_ACTIONS`. |
| 1Hz interval ticker | `useEffect` in TournamentContext | Once per second when not paused — updates `levelTimeRemaining`. |
| Session hydration | `hydrateTournament()` | On session restore from IDB (`useTournamentPersistence`). |

No other surface writes to this read shape. Stack-update / level-skip / elimination actions all flow through the reducer.

---

## Readers

| Reader | Entry point | Fields consumed |
|---|---|---|
| `TableView` | `useTournament()` at `:184-193` | All 8 fields above. Drives LiveAdviceBar gating, M-ratio guidance display, ICM pressure annotation. |
| `TournamentView` | `useTournament()` | Full surface — every field plus the dispatch actions. The view that *renders* tournament state. |
| `useSessionPersistence` (indirect) | `tournamentState` | Persists the reducer state; consumes the shape but does not surface it to UI. |

`LiveAdviceBar` does **not** read `TournamentContext` directly today (verified by grep 2026-04-29). It receives M-ratio + ICM context via props passed down from TableView. If a future change makes LiveAdviceBar consume the context directly, append it here in the same commit.

---

## Invariants

1. **`isTournament` is the master gate.** When `false`, all other fields are `null`. TableView must check `isTournament` before reading any of the other 7 fields, or guard each read with `?? <fallback>`.
2. **`currentBlinds.bb > 0` when `isTournament===true`.** A tournament with zero big-blind makes no sense; the reducer guarantees `levelStructure` has at least one valid level on init.
3. **`levelTimeRemaining` ticks at 1Hz when `!tournamentState.isPaused`.** Updates pause when paused. Re-renders are coupled to the tick, so consumers should not assume sub-second precision.
4. **`heroMRatio` requires `mySeat` and `chipStacks[mySeat]`.** When either is null, the field is `null`. TableView must NOT compute its own fallback by picking an arbitrary seat — that bug is the W4-A2-F8 close-out.
5. **`icmPressure` and `mRatioGuidance` are advisory.** They can be `null` even when other fields are populated — typically when the payout structure is unknown or the hero stack is too deep to surface guidance.
6. **`tournamentState.config.format` ∈ `TOURNAMENT_FORMAT_KEYS`.** As of 2026-04-29: `FREEZEOUT`, `REBUY`, `BOUNTY`, `SATELLITE`. Adding a format requires updating the enum AND auditing this contract.

---

## Code enforcement

- **No runtime validator today.** `TournamentContext` types its provider value via JSDoc only. The shape is enforced by reducer invariants + manual review.
- **Test coverage:**
  - `src/contexts/__tests__/TournamentContext.test.jsx` — provider-shape sanity.
  - `src/reducers/__tests__/tournamentReducer.test.js` — action-side invariants (`UPDATE_CHIP_STACK`, `SET_PLAYERS_REMAINING`, etc.).
  - **No test asserts the TableView read surface specifically.** This is a drift risk; opening a follow-up to add one is reasonable backlog material.

---

## Known drift

- **W4-A2-F9 satellite-mode honesty gap (closed 2026-04-29):** `icmPressure` is calibrated for standard MTT payout structures. Satellite tournaments have flat payouts above the bubble, which inverts late-game push/fold decisions. The math has not been recalibrated. TournamentView now renders an honesty banner when `config.format === 'SATELLITE'` to flag the gap until the math is updated.
- **W4-A2-F8 hero-stack arbitrary-seat pick (closed earlier):** historical bug where TableView's `heroStack` derivation fell back to `Object.values(chipStacks)[0] || 0` when `mySeat` was null. Fix locked the read to `mySeat != null ? (chipStacks[mySeat] || 0) : 0`. Captured in `TournamentView.jsx:204-211` for cross-reference; TableView's own derivation must not regress.
- **No persistent contract drift detected as of 2026-04-29.** `TournamentContext`'s value object has been stable since the last full audit.

---

## Change protocol

To change this contract safely:

1. **Adding a field:** update the provider value object at `TournamentContext.jsx:281-316`, document the field in the *Canonical shape* table above, and audit every Reader entry to decide whether the new field affects them.
2. **Removing or renaming a field:** grep all readers (`useTournament` consumers — at minimum TableView, TournamentView). Update each in the same commit. Update this doc + the change log entry.
3. **Changing nullability semantics** (e.g., `currentBlinds` becomes never-null when `isTournament===true`): update the *Invariants* section, audit Reader code paths that branch on null.
4. **Changing freshness guarantees** (e.g., `levelTimeRemaining` ticks at higher resolution): update Invariant 3, audit consumers that assume 1Hz.
5. **Adding a new tournament format** (e.g., what W4-A2-F9 did with `SATELLITE`): update `TOURNAMENT_FORMATS` in `tournamentConstants.js`, audit `tournamentReducer` for format-conditional logic, audit ICM/M-ratio math for calibration assumptions, decide whether an honesty banner is needed.

---

## Relationship to `.claude/context/STATE_SCHEMA.md`

`STATE_SCHEMA.md §tournament` documents the **live reducer state** shape. This contract is about the **derived read surface** — what `TournamentContext` exposes to consumers. The reducer state is mostly a subset of what the context exposes (the context adds derivations like `heroMRatio`, `icmPressure`, `mRatioGuidance`).

- `STATE_SCHEMA.md` is for reducer / persistence developers.
- This contract is for view authors who need to know what `useTournament()` gives them and what they can rely on.

Cross-reference both when writing a feature that reads tournament state.

---

## Change log

- 2026-04-29 — Created per DCOMP-W4-A2-F10. 8 fields documented (originally framed as 4 in the audit; expanded to match TableView's actual read at `:184-193`). Known drift entries seeded with W4-A2-F8 + W4-A2-F9 close-outs.

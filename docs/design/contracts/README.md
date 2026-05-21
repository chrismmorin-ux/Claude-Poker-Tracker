# Contracts

Cross-surface / cross-module invariants that the framework must document explicitly, because leaving them implicit causes silent breakage.

A contract is a *shape + ownership + invariant* declaration that spans more than one surface. If the contract changes, every surface that reads or writes the shape must be audited. Contracts surface the kind of coupling that otherwise hides in fallback paths, dual-reads, and "works on my machine."

---

## Why contracts are in the design framework (not just code)

Code-level contracts (validators, type defs, tests) exist in `src/`. They enforce at runtime. But they do not:
- Link the contract to personas / JTBDs / surfaces.
- Make the contract findable when a future session is designing a new surface that will read the same shape.
- Tell you which surface is the **writer** and which are **readers**.

The contracts here are the design-framework's record: *what cross-surface invariants exist, and where are they enforced in code.*

---

## Contracts

- [persisted-hand-schema.md](./persisted-hand-schema.md) — shape of a hand record in the `hands` IDB store. Writer: `TableView` → `ShowdownView` commit. Readers: `HandReplayView`, `AnalysisView`, export pipeline.
- [tournament-to-table.md](./tournament-to-table.md) — fields exposed by `TournamentContext` and consumed by `TableView` via `useTournament()`. Writer: `tournamentReducer` + 1Hz ticker. Readers: `TableView` (8 fields), `TournamentView` (full surface).
- [sidebar-to-online-view.md](./sidebar-to-online-view.md) — `BRIDGE_MSG` protocol between the Ignition extension's sidebar HUD and the main app's `OnlineView`. 8 message types (3 ext→app, 5 app→ext); 8 state-ownership rows; explicit no-handoffs (selection state, mid-hand DOM, user input). Writers/Readers split across `useSyncBridgeImpl` (app) and `side-panel.js`+`service-worker.js` (ext).
- [shape-mastery.md](./shape-mastery.md) — Shape Language adaptive-layer user-skill state. Writer: 9 reducer actions (enrollment, drill outcomes, mute, skip-disambiguation, unmute, recalibrate, reset, disenroll, session-incognito toggle); reads via `useShapeMastery*` hooks. 9 binding invariants (separation of signals, read-time decay, mode-gated writes, no-fused-score, no-engagement-pressure). First user-skill contract; pattern for future Range Lab / Presession Drill mastery contracts. Bound to surfaces: shape-language-study-home + shape-skill-map + lesson-runner + shape-language-enrollment.

---

## Adding a new contract

Create a new file following the `persisted-hand-schema.md` pattern:

1. **Canonical shape** — what fields exist, under what keys.
2. **Writers** — which surfaces / code paths write the shape. Explicit list.
3. **Readers** — which surfaces / code paths read the shape. Explicit list.
4. **Invariants** — what must be true.
5. **Code enforcement** — pointer to the validator / type / test that enforces the contract at runtime.
6. **Known drift** — evidence of migration, fallback paths, inconsistency.
7. **Change protocol** — what must happen to change the contract safely.

---

## Change log

- 2026-05-11 — Amended `shape-mastery` contract per WS-180 (SLS Gate 4 close-out), ratified by SPR-074. New writer `TOGGLE_SESSION_INCOGNITO` (3 dispatching surfaces); `MUTE_DESCRIPTOR` triggering surfaces expanded to 3 (study-home Discover + lesson-runner Discover + skill-map "Mark as already known"); `RECORD_DRILL_OUTCOME` flagged as Reference-variant-structurally-impossible per I-SM-3. Bound to 4 surfaces with completed surface docs.
- 2026-05-11 — Added `shape-mastery` contract per WS-039 (SLS Gate 4 foundation), ratified by SPR-073. First user-skill contract; documents the `shapeMastery` state with 8 writer actions + 4 read hooks + 9 binding invariants (separation of signals, read-time decay, mode-gated writes, no-fused-score, no-engagement-pressure, posterior bounds, schema versioning).
- 2026-05-11 — Added `sidebar-to-online-view` contract per WS-079 (DCOMP-W4-A3-F10), ratified by SPR-072. Documents the 8-message `BRIDGE_MSG` protocol between the Ignition extension HUD and the main app's `OnlineView`, with 8 invariants + 4 deliberate no-handoffs.
- 2026-04-29 — Added `tournament-to-table` contract per DCOMP-W4-A2-F10. Documents 8 fields exposed by `TournamentContext` and consumed by `TableView`. Cross-references W4-A2-F8 (heroStack fix) + W4-A2-F9 (satellite honesty banner) as known drift entries.
- 2026-04-21 — Created. Seeded with persisted-hand-schema in response to blind-spot audit 2026-04-21 table-view §D1.

# JTBD Domain — Tournament-Specific

Jobs that only apply to tournament play — ICM, stack depth, pay structure, antes, re-entries, bounties, satellites.

**Primary personas:** [Circuit Grinder](../../personas/core/circuit-grinder.md), [Online MTT Shark](../../personas/core/online-mtt-shark.md), [Hybrid](../../personas/core/hybrid-semi-pro.md) (MTT), [Apprentice](../../personas/core/apprentice-student.md) (tournament-playing).

**Surfaces:** `TournamentView`, `TableView` (when in tournament mode), sidebar Zone 2 with ICM overlay.

---

## TS-35 — ICM-pressure indicator at bubble

> When approaching the money bubble, I want ICM pressure shown per seat (and for me), so I tighten / loosen correctly.

- See [bubble-decision situational](../../personas/situational/bubble-decision.md).

## TS-36 — BB-ante vs per-player antes handling

> When antes kick in, I want BB-ante vs per-player-ante handled natively, so pot / stack math stays right.

- Active; implemented in `potCalculator.js`.

## TS-37 — Stack-depth strategy zone updated live

> When effective stack shifts (through blinds or doubles), I want strategy zone (MICRO / LOW / MEDIUM / HIGH / DEEP) updated live, so my shoving / flatting range adapts.

- Active; 5-zone SPR system in place.

## TS-38 — Multi-day note persistence (Day 1 → Day 2)

> When I advance to Day 2 of a multi-day tournament, I want notes / reads from Day 1 surfaced on the new table draw, so prior work isn't lost.

- State: **Proposed** (DISC missing; candidate for later discovery).

## TS-39 — Rebuy cost tracking for ROI

> When I re-enter a tournament, I want rebuy cost tracked, so my ROI calculation stays honest.

- Active.

## TS-40 — Per-seat FT ICM payout delta

> When at the final table, I want per-seat $EV delta shown (how much each opponent has to lose), so I apply pressure right.

- State: **Proposed**.

## TS-41 — Satellite survival mode

> When playing a satellite, I want the app to switch to survival-mode strategy (survive > accumulate) near the bubble, so I make the seat.

- State: **Proposed** (DISC-06).

## TS-42 — Bounty-adjusted EV

> When in a bounty format, I want marginal calls recalculated with bounty value included, so I don't miss +EV spots or make -EV ones.

- State: **Proposed** (DISC-05).

## TS-43 — ICM-adjusted decision at bubble

> When action reaches me at the money bubble, I want an ICM-adjusted recommendation (call / fold / shove) with the $-delta to chip-EV visible, so I understand why ICM pressure shades the chip-EV-optimal play.

- State: **Active** (partially served — `icmPressure` + `mRatioGuidance` exist on `TournamentContext`; LiveAdviceBar surfaces chip-EV-derived advice, not ICM-corrected action).
- Distinguished from [TS-35](#ts-35--icm-pressure-indicator-at-bubble): TS-35 is a persistent **indicator** (how tight is pressure now?); TS-43 is a **per-decision recommendation** (what do I do on this hand?).
- See [bubble-decision situational](../../personas/situational/bubble-decision.md).
- Primary surfaces: `TableView` (LiveAdviceBar when `isTournament`), `sidebar/Z2` (online MTT bubble decisions — cross-product gap, see [blind-spot audit 2026-04-21 table-view §D4](../../audits/2026-04-21-blindspot-table-view.md)).

## TS-44 — Pay-jump proximity indicator

> When a pay-jump is imminent (final table bubble, four-to-three-handed, heads-up jump), I want the remaining distance to the jump shown in $ and chip-BBs, so the stakes of the next elimination are unambiguous.

- State: **Active** (partially served — `TournamentContext.predictions` + `lockoutInfo` carry the data; surface exposure is indirect).
- Distinguished from TS-43: TS-43 is about the *action*; TS-44 is about *situational awareness* independent of whose turn it is.
- See [bubble-decision situational](../../personas/situational/bubble-decision.md).
- Primary surfaces: `TableView` (tournament overlay), `TournamentView` (PredictionsPanel).

---

## Domain-wide constraints

- ICM calculations must be latency-safe (precomputed lookups, not solved live at decision time).
- Multi-day continuity implies cross-session persistence of tournament identity + player-table-draw association.

## Change log

- 2026-04-21 — Created Session 1b.

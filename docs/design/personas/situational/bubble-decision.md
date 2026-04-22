# Situational Sub-Persona — Bubble Decision

**Type:** Situational (cross-persona)
**Applies to:** Circuit Grinder, Online MTT Shark, Hybrid, Apprentice (tournament-playing)
**Evidence status:** PROTO
**Last reviewed:** 2026-04-21

---

## Snapshot

Tournament is approaching the money bubble (one to three eliminations from ITM). Every decision is ICM-pressured. A marginal call that's profitable in chip EV may be -$EV once payout structure is considered. The player needs ICM-aware action recommendations delivered in the time between dealer dealing and action.

---

## Situation trigger

- Live or online MTT approaching the in-the-money (ITM) payout line.
- Or: approaching a pay-jump (FT bubble, 4-handed to 3-handed, etc.).
- Exits when: bubble breaks OR player busts OR tournament is no longer ICM-sensitive (deep ITM well above the next pay jump).

## Context

- **Time pressure:** 15–60 seconds for live; 4–8s for online under multi-table load.
- **Attention:** Focused — often all attention is on the ICM-critical seat.
- **Cognitive load:** Full. ICM math is mentally expensive.
- **Emotional load:** High. A bubble bust is a bad beat amplified by payout structure.

## Primary need in this moment

- ICM-adjusted action recommendation (call / fold / shove) with *delta to chip-EV* visible so the player understands why ICM shades the decision.
- Payout structure at hand (remaining players + payout table).
- Opponent risk-aversion tag — "big stack opening wide because small stack is folding" must be surfaceable in 1 second.

## Secondary needs

- Per-seat stack sizes with pay-jump proximity visible.
- Recent history with the acting opponent specifically.

## What a surface must offer

1. **ICM-corrected action** ready in <5s from hand start on a common bubble stack depth.
2. **Delta to chip-EV** shown so the player trusts the correction (value must be visible, not hidden).
3. **Opponent risk-aversion tag** surfaced automatically.
4. **No modal interruption** — ICM data on the primary surface, not a dialog.

## What a surface must NOT do

- Require the user to enter ICM parameters at decision time (payout structure should be auto-captured or imported).
- Present GTO-mixed strategies at the bubble — user wants exploitative concrete action, not mixed.
- Lag — even a 2-second delay is unacceptable at online multi-table pace.

---

## Related JTBD

- `JTBD-TS-43` ICM-adjusted decision at bubble (Active; partially served — see [tournament-specific.md](../../jtbd/domains/tournament-specific.md#ts-43--icm-adjusted-decision-at-bubble))
- `JTBD-TS-44` pay-jump proximity indicator (Active; partially served — see [tournament-specific.md](../../jtbd/domains/tournament-specific.md#ts-44--pay-jump-proximity-indicator))
- `JTBD-TS-35` ICM-pressure indicator at bubble (Active; the *indicator* counterpart to TS-43's *action*)
- `JTBD-MH-07` short-stack push/fold (often intersects)

> **Note:** Prior drafts of this file referenced `JTBD-TS-01` and `JTBD-TS-03` — those IDs never existed in the atlas. They were resolved 2026-04-21 to TS-43 and TS-44 respectively via the Gate-2 blind-spot audit on TableView. See [EVID-2026-04-21-BUBBLE-PHANTOM-JTBD](../../evidence/LEDGER.md).

## Related core personas

- [Circuit Grinder](../core/circuit-grinder.md) — primary
- [Online MTT Shark](../core/online-mtt-shark.md) — primary
- [Hybrid](../core/hybrid-semi-pro.md) — secondary
- [Apprentice](../core/apprentice-student.md) — if tournament-playing

## Missing features to serve this situation

- [DISC] ICM payout structure import (cardroom-specific tournament payout tables).
- [DISC] Bounty-adjusted EV for KO tournaments.
- [DISC] Satellite / seat-bubble mode (survival > chips).

---

## Change log

- 2026-04-21 — Created Session 1b.

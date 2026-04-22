# Situational Sub-Persona — Push/Fold Short-Stack

**Type:** Situational (cross-persona)
**Applies to:** Circuit Grinder, Online MTT Shark, Hybrid, short-stacked Rounder
**Evidence status:** PROTO
**Last reviewed:** 2026-04-21

---

## Snapshot

Player is sitting on 5–15 big blinds. The decision space collapses to push-or-fold. Charts exist, but live ones must account for antes, ICM if at bubble/FT, and opponent fold frequency. Online, the decision must happen in 4–8 seconds or the player falls behind on other tables.

---

## Situation trigger

- Effective stack drops to ≤15bb (shove-or-fold territory begins).
- Action is on hero preflop.
- Exits when: stack grows back to non-shove range OR hero busts.

## Context

- **Time pressure:** 4–8s online multi-table; 15–30s live.
- **Attention:** Shared if online multi-tabling; focused if live.
- **Cognitive load:** Would be low (just push or fold) if not for ICM, bounty, and antes complicating things.

## Primary need

- Shove range by effective stack size, updated for antes and BB-ante.
- ICM-correction if bubble / FT / pay-jump applicable.
- Fold-equity estimate against likely caller.

## Secondary needs

- Table-wide fold propensity (the ahead/behind players matter).
- Hand history with known opponents (does the SB never call shoves from UTG?).

## What a surface must offer

1. **Push/fold verdict** visible within 1 second of hand start.
2. **Effective-stack ladder** — current stack + where the break point is to the next strategy zone.
3. **ICM modifier** applied automatically when at bubble / FT.
4. **Bounty-adjusted EV** when in bounty format.

## What a surface must NOT do

- Require hero to input effective stack (read from state).
- Show mixed strategies (push-or-fold is binary by choice).
- Delay with heavy computation — charts are precomputed, not solved live.

---

## Related JTBD

- `JTBD-MH-07` short-stack push/fold
- `JTBD-TS-01` ICM modifier at bubble
- `JTBD-TS-08` bounty-adjusted EV

## Related core personas

- [Online MTT Shark](../core/online-mtt-shark.md) — primary (multi-tabling pressure)
- [Circuit Grinder](../core/circuit-grinder.md) — primary (live ICM depth)
- [Hybrid](../core/hybrid-semi-pro.md) — secondary

## Missing features

- [DISC] Instant push/fold chart by effective stack + ante + ICM + bounty.
- [DISC] Effective-stack-zone indicator.

---

## Change log

- 2026-04-21 — Created Session 1b.

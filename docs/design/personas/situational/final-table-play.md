# Situational Sub-Persona — Final-Table Play

**Type:** Situational (cross-persona)
**Applies to:** Circuit Grinder, Online MTT Shark, Hybrid
**Evidence status:** PROTO
**Last reviewed:** 2026-04-21

---

## Snapshot

Player is at the final table of a tournament. Every hand shifts the per-seat $EV differently depending on payouts, stacks, and ICM. Chip-EV is frequently misleading — the correct play at 3-handed with laddered payouts can be the opposite of what a cash game suggests.

---

## Situation trigger

- Tournament reaches final-table seats (typically 6–9 handed, depending on structure).
- Exits when: player busts, tournament ends, or FT breaks to heads-up (situation shifts).

## Context

- **Time pressure:** 15–45s per decision live; 4–8s online.
- **Attention:** Focused, high.
- **Cognitive load:** Full — ICM, stack depth, opponent reads, payout math.
- **Session shape:** High-stakes outcome per hand relative to cumulative tournament buy-in.

## Primary need

- Per-seat ICM $EV awareness — know which opponents are risk-averse (pay-jump protectors) vs. chip leaders who can apply pressure cheaply.
- Stack-depth-aware strategy cues — 20bb play is not 50bb play, and the chart for 3-handed is not the chart for 9-handed.
- Chip leader exploit recognition — the big stack is a different opponent than everyone else.

## Secondary needs

- Opponent recent history at final table (the past 30 minutes matter more than the tournament's first 5 hours).
- Deal-making math support (if offered a chop at some point).

## What a surface must offer

1. **Per-seat $EV delta** visible at all times.
2. **Stack-depth strategy zone** indicator (MICRO / LOW / MEDIUM / HIGH / DEEP).
3. **Chip leader aggression tag** — surface whether the chip leader is exploiting their position.
4. **Recent-window reads** — last 30 minutes weighted heavier than full-tournament history.

## What a surface must NOT do

- Show chip-EV without acknowledging it's probably wrong at FT.
- Treat 3-handed FT like 9-handed (charts must switch).
- Force navigation to see ICM info — it must be primary.

---

## Related JTBD

- `JTBD-TS-05` FT per-seat ICM
- `JTBD-TS-03` pay-jump proximity
- `JTBD-MH-09` SPR-aware strategy (applicable)

## Related core personas

- [Circuit Grinder](../core/circuit-grinder.md)
- [Online MTT Shark](../core/online-mtt-shark.md)

## Missing features to serve this situation

- [DISC] Per-seat ICM $EV deltas updated each hand.
- [DISC] Stack-depth-adaptive strategy charts.
- [DISC] Deal-making calculator (chip-chop, ICM-chop, custom agreements).

---

## Change log

- 2026-04-21 — Created Session 1b.

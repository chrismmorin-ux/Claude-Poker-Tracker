# Persona — The Circuit Grinder

**Type:** Core (end-user archetype)
**Evidence status:** PROTO — unverified
**Last reviewed:** 2026-04-21

---

## Snapshot

Travels the WSOP Circuit, WPT, regional MTT tours; plays 40–80 tournaments per year. ICM-aware in every decision, deeply conscious of stack depth, pays outsized attention to bubble and final-table dynamics. Day 1 notes need to survive to Day 2. Multi-day continuity is their edge.

## Context

- **Venue:** Live, rotating venues; hotel rooms between flights.
- **Format:** MTT primarily; some cash to fill time.
- **Skill:** Advanced, pro-leaning.
- **Volume:** 15–25 days/month in tournaments; off-days are travel or review.
- **Device:** Phone at the table, laptop in hotel rooms.
- **Intent:** ICM-correct live play + deep off-table MTT review.
- **Role:** Solo (occasionally staked).

## Goals

- ICM-correct decisions at bubble and final table.
- Track opponents across multi-day events so Day 2 seat draw is informed.
- Adjust strategy to stage (early / mid / bubble / ITM / FT).
- Review deep runs to identify stage-specific leaks.
- Re-entry bookkeeping that doesn't corrupt ROI.

## Frustrations

- No tool handles Day 1 → Day 2 continuity cleanly.
- ICM, antes (BB-ante vs per-player), re-entries handled inconsistently across tools.
- Mid-hand ICM calc too slow to trust.
- Satellite / bounty / seat-bubble dynamics underserved across the market.

## Non-goals

- Cash-game optimization.
- Coaching others.

---

## Constraints

- **Time pressure:** Full mid-hand. Bubble/FT moments have most pressure + highest stakes.
- **Error tolerance:** Very low at critical stages (bubble, ICM-sensitive FT).
- **Visibility tolerance:** High — ICM reveals require density.
- **Complexity tolerance:** High for decision surfaces; low for config.

---

## Related situational sub-personas

- [Bubble decision](../situational/bubble-decision.md)
- [Final-table play](../situational/final-table-play.md)
- [Push/fold short-stack](../situational/push-fold-short-stack.md)
- [Day 2 table draw](../situational/day2-table-draw.md) (hypothetical, placeholder)

## Related JTBD

- `JTBD-TS-*` tournament-specific (ICM, bubble, FT, satellite, bounty)
- `JTBD-MH-07` short-stack push/fold
- `JTBD-PM-*` player management (cross-day carry-over)

## Product line

- **Main app primary.** Sidebar irrelevant (no Ignition MTT play typically).

## Tier fit

- **Pro (Grinder) ~$49/mo** or **Studio** if they need multi-coach collaboration.
- Upgrade trigger: bubble + FT decision quality delta measurable.

---

## Missing-feature needs

- [DISC] ICM payout-structure import.
- [DISC] Bounty-adjusted EV mode.
- [DISC] Satellite / seat-bubble strategy switch.
- [DISC] Multi-day tournament continuity (Day 1 → Day 2 note persistence).

## Proto caveats

- **[CG1]** $60–150 WTP. Basis: ICMIZER Coach + GTO Wizard MTT tier sum. Verify.

---

## Change log

- 2026-04-21 — Created Session 1b.

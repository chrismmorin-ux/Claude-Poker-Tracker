---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md
Source-Rubric: v2 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback-external.md
Authored: 2026-04-23
Word-count: ~240 (target ≤250)
---

# Drill Card — `btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback`

## Front (predict before flipping)

**Spot.** BTN (IP) vs BB (OOP), single-raised pot, 100bb. Cbet flop **Q♠7♥2♣** at 33% (1.8bb), called → checked back turn **3♦** → river **8♠**. BB bets **75% pot (6.8bb into 9.1bb)**. Hero **99**.

**Question.** Action with hero's hand?

---

## Back

### Action (per v2.1 D11 archetype-conditional form)

**Default: Call.** **Override: Fold if villain is confirmed nit.**

### Why (3 beats)

1. Hero 99 wins at showdown vs **21 of 60 combos** in BB's polar bet range = **35% equity** [§3, pure-bimodal river per v2.1 D12]. Required at 75% bet = **30%** pot odds [§10]. Margin is small but +EV.
2. Live pool **over-bluffs** the capped-IP-checked-turn → polar-OOP-river pattern [§5, GTO Wizard "Over-Bluffed Lines" — *Stage 4 B-finding: source-stake-mismatch; pattern still holds via Doug Polk live-cash content*]. Pool bluff fraction estimated 40-50% vs solver-balanced 30%.
3. **Hero's 99 is blocker-unfavorable** — removes ~1.2 of 16 bluff combos (A9s, K9s) without blocking value. Equity drops 35% → ~33.7% [§9]. Still +EV but margin tightens.

### Pivot (sensitivity)

**§12 Assumption A.** If villain's bluff fraction drops below **~22%**, hero's equity falls below 30% pot odds → fold correct. **§12 Assumption C** (archetype): confirmed nit (under-bluffer) triggers fold override per v2.1 D11.

### Falsification

**§14b headline falsifier 1.** 200+ showdown-reveal sample of BB polar-river-bets in this exact line shows bluff fraction at or below 22%.
**Headline falsifier 2.** Villain shows nit-profile signals (≥100 hand sample of tight + low aggression) → fold this exact spot.

### Where to dig deeper

§1 (setup) · §2 (3-street range filter) · §3 (river pure-bimodal equity) · §6 (archetype-conditional recommendation) · §9 (blocker-unfavorable) · §12 (Assumptions A & C) · §14b (two headline falsifiers)

---

### Faithfulness check (mechanical anchor map)

| Card claim | Source anchor |
|---|---|
| "21 of 60 combos = 35%" | §3 weighted average; §11 row 3.9 |
| "Required equity 30%" | §11 row 3.11 |
| "Pool over-bluffs 40-50%" | §11 row 5.1 (Stage 4 B caveat) |
| "Solver bluff fraction ~30%" | §11 row 4.2 |
| "Blockers: ~1.2 bluff / 0 value" | §11 rows 9.5, 9.6 |
| "Equity drops 35% → 33.7%" | §11 row 9.9 |
| "Assumption A flip at 22%" | §12 Assumption A |
| "Assumption C nit-override" | §12 Assumption C |
| "Falsifier 1: 200+ sample bluff ≤ 22%" | §14b headline falsifier 1 |
| "Falsifier 2: nit-profile ≥100 hands" | §14b headline falsifier 2 |
| "Archetype-conditional form" | v2.1 Delta D11; §6 |

All claims grep-traceable to source artifact section anchors.

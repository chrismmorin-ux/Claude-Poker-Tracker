---
conceptId: ip-cbet-defense-dry-LATE
title: IP Cbet Defense — Dry Boards vs LATE Position
tier: 3
leakTagIds:
  - hero-ip-cbet-overfold
frameworkIds: []
test_substrate: pending
citation:
  source: POKER_THEORY.md §6.2 (MDF) + §3.1 (Board Texture Classification)
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-05-05
  amended_at: null
  amendment_reason: null
---

## Exposition

This concept narrows the umbrella `cbet-defense-cluster` to one cell: defending IP from LATE-position cbettors (LP, HJ, CO) on dry boards. Reading the umbrella first is recommended — it covers MDF math + the population overfold pattern. This sub-lesson covers the texture-and-position-specific calibration.

A dry board has three properties: (1) uncoordinated ranks (no straight draws), (2) rainbow suits (no flush draws), (3) low or middling cards that miss most preflop continuing ranges. Examples: K♥7♣2♦, A♠8♣2♦, J♠6♥3♣. These are the textures where MDF math is cleanest because villain's bluff equity is lowest.

What that means in practice:

- **Villain's value combos are sparse.** A LATE cbettor on K72r has top-pair Kx (KQ-KT, AK = ~20 combos), some sets (KK/77/22 ~9 combos), and that's almost it. Most of villain's range either has air (overcards, suited connectors that didn't connect) or marginal showdown value (pocket pairs below K).
- **Villain's bluffs have low equity.** A bluff with 9♠8♠ on K72r has ~6% equity to improve by river. Compare to wet boards where the same hand might have 35% equity as a draw. Low villain bluff equity → MDF defends literally; hero doesn't need to over-defend to "deny" anything.
- **Solver baseline: 62-65% defend** (per cluster umbrella enumeration). Population observed defend rate sits below 50% on dry boards — the bigger the gap to solver, the more the leak rule fires.

The mechanical defense rule on dry-LATE: continue any holding with ≥1 overcard to the board, any pocket pair, any suited Ace. Fold genuinely-disconnected junk (T8o on K72r, J5o on A82r). The set of hands that profitably continue is wider than reflexive "I missed → fold" suggests.

## Worked example

**Spot 1 — call.** Hero BB holds A♣8♥ on K♥7♣2♦ vs CO ⅓-pot cbet. Pot odds: needs 20% equity. A8o on K72r has overcards (3 outs to top pair-second-kicker), backdoor flush via clubs (turn club opens 9 outs), backdoor straight (turn 5/6 opens 4-out gutshot). Total ≈ 6 effective outs ≈ 14% raw turn-river equity, plus 8% realization buffer for being IP. Above pot-odds floor + above solver continuing range floor → **call**.

The leak fires when hero folds A8o here. Population observed fold-to-flop-cbet on dry-LATE for unpaired overcards is ~58% on small samples; solver continues ~75% of the same set.

**Spot 2 — call (less obvious).** Hero BB holds 8♠8♣ on A♠5♣2♦ vs HJ ⅓-pot cbet. Pot odds: needs 20%. 88 on A52r has ~25% raw equity vs villain's combined value+bluff range (Ax has 2 pair outs, 88 has 2 set outs, but villain's bluffs all have ≥3 overcards so 88 is ahead of bluffs). Standard call.

Folding low pocket pairs on dry-Ace boards is one of the high-frequency ways the overfold leak surfaces.

## Success criteria

Internalized when the user, facing a small-to-medium IP cbet from LATE position on a dry rainbow flop, can within 5 seconds (a) name the bet-size MDF (75% for ⅓-pot, 67% for ½-pot), (b) classify their hand as overcard / backdoor / pocket-pair / disconnected, and (c) continue the first three categories without secondary deliberation. Folding the disconnected category is the only standard fold; everything else is a default-call.

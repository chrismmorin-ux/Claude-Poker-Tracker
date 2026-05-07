---
conceptId: oop-cbet-defense-cluster
title: OOP Cbet Defense — Calibrating Your Fold Rate from the Blinds
tier: 3
leakTagIds:
  - hero-oop-cbet-overfold
frameworkIds: []
test_substrate: pending
citation:
  source: POKER_THEORY.md §6.2 (MDF + auto-profit) §6.3 (equity realization OOP)
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-05-06
  amended_at: null
  amendment_reason: null
---

## Exposition

OOP cbet defense is the same MDF math as IP — but the equity-realization
penalty changes what's profitable to defend with. Out of position, hero
loses ~5-10% of raw equity due to the disadvantages of acting first on
later streets (can't apply pressure with checks; must commit to a line
before seeing villain's response). That means OOP can fold slightly more
than IP and still be profitable, but not nearly as much more as
recreational players assume.

The leak this rule detects is **over-folding from the blinds**. Hero
calls a preflop raise out of the SB or BB, then folds too often to
villain's flop cbet. Common reasons:

- "I'm OOP, just fold and minimize losses" — this ignores closing-action
  pot odds (BB) and the realized equity hero still has on most flops.
- "I missed the flop" — at MDF the question isn't whether you hit, it's
  whether your continuing range covers enough combos to deny villain
  auto-profit on bluffs.
- Mis-applied position discipline — "play tight from blinds" is correct
  preflop and turns into a leak when carried over to defending vs cbet.

The OOP solver baseline sits around 50-55% fold rate (vs IP's ~38%) —
significantly looser than IP because the equity-realization penalty
applies. But folding 75%+ from the BB on a wet board is still leaving
chips on the table, even with the OOP discount.

The bigger texture lever is **dry vs wet**: dry boards favor villain
slightly more OOP (fewer draws to peel with), wet boards favor hero
slightly more (draws give equity even from OOP). The SB-vs-BB split is
small but real: BB's pot-odds discount (already half-bet in) makes BB
defend slightly wider than SB on the same board.

This umbrella concept covers six baseline-distinct situation cells:

- **oop-cbet-defense-dry-SB** — defending OOP from SB on dry boards. Solver baseline ~50% fold.
- **oop-cbet-defense-medium-SB** — defending OOP from SB on medium boards. Baseline ~48%.
- **oop-cbet-defense-wet-SB** — defending OOP from SB on wet boards. Baseline ~45%.
- **oop-cbet-defense-dry-BB** — defending OOP from BB on dry boards. Baseline ~55% (BB caps wider preflop).
- **oop-cbet-defense-medium-BB** — defending OOP from BB on medium boards. Baseline ~50%.
- **oop-cbet-defense-wet-BB** — defending OOP from BB on wet boards. Baseline ~46%.

Per-cell lessons land in WS-149 ongoing.

## Worked example

**Spot 1 (BB-dry):** Hero in BB with T♣8♣. CO opens to 2.5bb, hero
calls, flop K♥7♦3♣ ($6 pot). CO cbets $2 (33% pot).

Pot odds: $2 to win $8 → need 20% equity. T8s on K73r has ~28% raw
equity vs CO's range (overcards + backdoor straight). Equity realization
is the worst it gets here (OOP, BB, no initiative), so realized equity
≈ 22-23%. Just above pot odds. **Call** is marginally +EV; folding
liberally over time leaks chips because the math sits right at the
margin. Folding hands like T8s here is the leak — solver continues with
~70% of BB's calling range vs this small sizing.

**Spot 2 (SB-wet):** Hero in SB with A♠4♠. BTN opens to 2.5bb, hero
3-bets to 9bb (light squeeze), BTN calls, flop 9♠8♠5♥ ($19 pot).
Hero cbets $9 (47% pot)... wait, this is hero AS aggressor, not
defending vs cbet. The OOP cbet defense rule doesn't apply here.

For the cbet-defense scenario: hero in SB calls a BTN open with
A♠4♠ (not 3-betting), flop 9♠8♠5♥, BTN cbets. Hero has nut flush
draw (~36% raw, ~33% realized OOP). **Call** wide here — the wet
texture means BTN's range is more polarized (sets/two-pair value, big
draws as bluffs), and hero's draw equity realizes well even OOP.

## Success criteria

Internalized when the user can call out OOP MDF differences vs IP at
the table (~10pp wider IP defense at the same texture/sizing) without
reaching for paper, and can articulate the SB-vs-BB delta (BB defends
~5pp wider on dry boards because of pot-odds discount + wider preflop
cap). For cluster mastery, the user can name which texture-position
cells skew tighter vs looser without consulting the baseline table.

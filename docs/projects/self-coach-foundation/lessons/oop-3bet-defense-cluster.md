---
conceptId: oop-3bet-defense-cluster
title: When Your Flat-Call Faces a 3bet — Folding the Trapped Range
tier: 4
leakTagIds:
  - hero-oop-3bet-underfold
frameworkIds: []
test_substrate: pending
citation:
  source: POKER_THEORY.md §5.2 (squeeze defense), §6.3 (equity realization OOP)
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-05-07
  amended_at: null
  amendment_reason: null
---

## Exposition

This is the first **under-fold** rule in the catalog. Most leak rules
detect over-folding (giving up auto-profit by folding too tight); this
one detects the opposite — calling too wide in a structurally bad spot.

The setup: hero is in SB or BB, an opener raises preflop, hero
flat-calls (instead of 3betting or folding). Then a third player
3bets, or the original opener re-isolates. Hero now faces a 3bet from
OOP, with a flat-calling range that's already capped (no big pairs or
strong aces — those would have 3bet or folded preflop instead of
flatting).

Continuing here is the worst structural spot in NLHE:

- **Out of position** — hero acts first on every postflop street.
  No way to apply pressure with checks; no way to control pot size on
  marginal hands.
- **No initiative** — the 3bettor is the aggressor; hero is the caller.
  The 3bettor sets the price on every street.
- **High SPR relative to a 3bet pot** — calling a 3bet from a flat-
  call leaves an SPR around 4-5, where hero's medium-strength hands
  have to commit to multi-street decisions without a clear plan.
- **Capped range** — hero's flat-call already removed the big pairs.
  Villain knows hero doesn't have AA/KK; barreling pressure works.

Solver target fold rate: ~72-75% across SB/BB. The continuing range
is small — pairs that set-mine well, suited connectors with strong
nut potential, suited aces for blocker + flush draws. Most of hero's
flat-calling range correctly folds.

The leak: hero continues "because I already put money in." Sunk cost.
The 1-3bb in the pot from the flat is gone regardless of the next
decision; what matters is whether the next call has positive expected
value.

This umbrella concept covers two sub-concepts:

- **oop-3bet-defense-SB** — hero in SB flat-called open, faces 3bet
  (typically from BB squeeze or original opener re-iso). Solver
  baseline ~72% fold rate.
- **oop-3bet-defense-BB** — hero in BB flat-called open, faces 3bet
  (typically from SB squeeze or original opener re-iso). Baseline
  ~75% fold. Slightly wider continuing range than SB because BB's
  flat-call range was wider preflop (pot-odds discount).

Per-cell lessons land in WS-149 ongoing.

## Worked example

**Spot 1 (BB):** Hero in BB with T♠9♠. CO opens to 2.5bb, BTN folds,
SB folds, hero (BB) calls. CO 3bets... wait, CO already opened. Let's
re-set: CO opens 2.5bb, hero in BB calls. SB squeezes to 11bb. Action
returns to hero.

Hero needs to call 8.5bb to win 14bb pot — needs ~38% equity. T9s vs
SB's squeezing range (TT+, AQ+, suited broadways, suited connectors)
has ~31% raw equity, ~28% realized OOP without initiative. Below the
threshold. **Fold** is the right decision; calling here loses ~0.5bb
on average and traps hero in 3bp OOP. The "I already put 2.5bb in"
framing is the leak.

**Spot 2 (SB):** Hero in SB with A♣Q♠. BTN opens to 2.5bb, hero (SB)
calls. BB squeezes to 12bb. Action returns to hero.

AQo is on the borderline. Vs BB squeeze range it has ~46% raw equity
(blocks AA/KK/AQ; dominates broadway calls). Realized equity OOP ≈
42%. Hero needs ~37% to call 9.5bb into 14.5bb. Above threshold.
**Call** is profitable here. AQ is one of the few flat-call hands that
DOES continue vs a 3bet — the leak isn't "fold AQo always," it's
"fold hands weaker than AQo." The continuing range is small.

## Success criteria

Internalized when the user can name the ~72-75% fold target across
SB/BB and articulate the four structural reasons (OOP / no initiative
/ medium SPR / capped range) why this spot demands tight defense.
For cluster mastery, the user can also identify which categories of
flat-call hands DO continue vs a 3bet (set-mining pairs, suited aces,
strong suited connectors, AQ+) without reciting the full range chart.

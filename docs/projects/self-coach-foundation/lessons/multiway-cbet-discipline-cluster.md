---
conceptId: multiway-cbet-discipline-cluster
title: Multiway Continuation — Why Your Cbet Frequency Has to Collapse
tier: 5
leakTagIds:
  - hero-multiway-bluff-frequency
frameworkIds: []
test_substrate: pending
citation:
  source: HERO_STATE_DESIGN.md §7.4 (multiway model — multiwayFoldPct = ∏ foldᵢ); POKER_THEORY.md §7 (first-principles fold equity)
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-06-06
  amended_at: null
  amendment_reason: null
---

## Exposition

Heads-up, continuation-betting the flop as the preflop raiser is one of
the highest-frequency plays in poker — solver cbets a large share of its
range because a single opponent folds often enough to make even pure
bluffs profitable.

Multiway, that math inverts. To take the pot down with a bluff, **every**
remaining opponent has to fold — so the chance everyone folds is the
*product* of each player's individual fold rate, not the average. If one
opponent folds 60% of the time, two independent opponents both fold only
about 0.6 × 0.6 = 36% of the time; three, about 22%. Fold equity collapses
multiplicatively as players are added (this is the same ∏-of-fold-rates
formula the engine uses in the multiway hero-state model, §7.4).

The consequence: the profitable flop cbet frequency drops from roughly
**70% heads-up to roughly 10-25% in a 3+ way pot**. The continuing range
narrows toward hands that want to bet for value or have strong equity —
not air. Checking back becomes the default with most of the range.

The leak this concept tracks is **over-continuing multiway** — firing the
flop at a heads-up-like frequency when three or four players saw the flop.
It bleeds chips because the bluffs almost never get through, and the bets
that do get called are facing a range that has connected with a board it's
seeing five-handed.

The detector measures one thing factually: across multiway flops where you
were the preflop aggressor and first to act, how often you bet versus
checked — compared to a solver reference near 25%. It is a frequency
observation over your own hands, not a judgment of any single hand.

This umbrella concept anticipates two sub-concepts (v2, once the detector
splits player counts):

- **multiway-cbet-discipline-3way** — exactly three players to the flop
  (you + two opponents). Cbet frequency target is already far below
  heads-up; value-heavy with selective range bets.
- **multiway-cbet-discipline-4way-plus** — four or more players. Frequency
  collapses further; pure bluffs are almost never correct, and even thin
  value tightens because "somebody has it" more often.

Per-cell lessons land in WS-149 ongoing.

## Worked example

**Spot:** Hero opens CO to 2.5bb with A♠5♠. BTN calls, BB calls. Three
players to the flop: Q♣8♦4♣. BB checks, action on hero.

Heads-up this is a routine cbet — ace-high with a backdoor flush and the
nut-flush blocker, against one capped caller. Fire, take it down often.

Three-way, the picture changes. To win the pot uncontested, **both** BB
and BTN must fold. Even if each folds ~55% to a cbet, both fold only
about 0.55 × 0.55 ≈ 30% of the time — and this board (queen-high, club
draw present) is one that multiway callers connect with frequently.
A♠5♠ has no made hand, no immediate draw, and is betting into two ranges
that have a club draw, queens, eights, and sets in them. The bluff gets
called or raised more than it folds out the field.

**Check back.** A♠5♠ keeps a backdoor flush + ace-high showdown value and
realizes equity for free. The hands that *do* bet here are value (sets,
two pair, top pair good kicker) and the occasional strong draw — a small,
disciplined fraction of the range. A hero who instead fires this flop
every time they hold the preflop initiative is the exact pattern this
concept flags.

## Success criteria

Internalized when the user can explain *why* multiway cbet frequency must
drop — that combined fold equity is the product of individual fold rates,
so it collapses as players are added — and can name the rough target
(continuation frequency falling from ~70% heads-up toward ~10-25%
multiway). For applied mastery, the user defaults to checking back air and
marginal hands in 3+ way pots, reserving flop bets multiway for value and
strong-equity hands rather than continuing on initiative alone.

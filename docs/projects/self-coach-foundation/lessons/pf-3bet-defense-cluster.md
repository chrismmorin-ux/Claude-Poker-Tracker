---
conceptId: pf-3bet-defense-cluster
title: Defending Your Open Against Preflop 3bets
tier: 4
leakTagIds:
  - hero-pf-3bet-overfold
frameworkIds: []
test_substrate: pending
citation:
  source: POKER_THEORY.md §5.1 (preflop 3bet defense), §3.2 (auto-profit threshold)
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-05-07
  amended_at: null
  amendment_reason: null
---

## Exposition

When hero opens preflop and a player behind 3bets, hero's continue range
sets the price villain pays to 3bet bluff. Fold too often and the
3bettor has auto-profit on every junk hand; fold too rarely and hero
pays it back postflop with dominated continues out of position. The
solver target sits around 50-55% fold rate across most opening
positions — meaningfully looser than the "default fold to 3bets"
heuristic recreational players carry over from beginner advice.

The leak this rule detects is **over-folding to 3bets after opening**.
Common reasons:

- **Carryover from defensive preflop heuristics** — "play tight from
  EP" is correct for opening RFI and turns into a leak when hero
  applies it again in the 3bet defense decision. Hero's range is
  already filtered by the open; folding 70%+ of THAT range is folding
  hands that opened for value.
- **Risk aversion at higher stakes** — calling 7-9bb to play out of
  position feels expensive when hero won't get to see all five streets.
  But the math is the same: hero's pot odds vs 3bet sizing dictate the
  required equity to continue, and most opening hands clear it.
- **Mis-applied "stay out of trouble" framing** — folding tight to
  3bets *feels* safe but caps hero's range visibly to villain (only
  AA/KK call/4bet) and gives 3bettors permanent license to bluff.

The dominant lever in this cluster is **opener position** — opens from
LATE/BUTTON have wider ranges with more "junk" (suited connectors,
small pairs, weak broadways) that profitably fold to a 3bet. Opens
from EARLY have tighter ranges where most hands continue.

This umbrella concept covers four baseline-distinct sub-concepts:

- **pf-3bet-defense-EARLY** — hero opens from EP/UTG, faces 3bet.
  Solver baseline ~50% fold. Tightest opening range; most hands
  continue.
- **pf-3bet-defense-MIDDLE** — hero opens from MP/HJ, faces 3bet.
  Baseline ~52%. Slightly wider range; slightly higher fold rate.
- **pf-3bet-defense-LATE** — hero opens from LJ/CO, faces 3bet.
  Baseline ~55%. Late-position open includes thinner value + bluffs;
  appropriate fold rate climbs.
- **pf-3bet-defense-BUTTON** — hero opens from BTN, faces 3bet.
  Baseline ~55%. Widest open; widest folding range to 3bets.

Per-cell lessons land in WS-149 ongoing.

## Worked example

**Spot 1 (LATE):** Hero opens CO with K♠T♣ to 2.5bb. BB 3bets to 9bb.
Action folds to hero.

KTo from CO is a borderline open — solidly in the open range but near
the bottom. Vs a BB 3bet at 9bb, hero needs to call 6.5bb to win 11.5bb
in the pot — needs ~36% equity. KTo has ~38-40% raw equity vs a typical
BB 3betting range, but realized equity OOP-but-IP-here drops it to
~36-38%. **Fold** is the small-loss decision here; calling is
marginally profitable but only if hero plays the postflop well. The
solver would mix at frequency. Folding 100% of KTo from CO vs a 3bet
is the leak — the hand belongs in the continuing range some of the
time.

**Spot 2 (BUTTON):** Hero opens BTN with 5♠5♦ to 2.5bb. SB 3bets to
12bb. Action folds to hero.

55 vs a 3bet to 12bb needs hero to call 9.5bb to win 14bb — ~40%
equity required. 55 has ~37% raw equity vs SB's tight 3bet range, but
realizes equity well IP postflop (set-mining + position). Realized
equity ≈ 39-40%. **Call** to set-mine + realize equity is the right
decision here. Folding all small pairs to BTN-vs-SB 3bets leaks ~1-2bb
per spot in the long run.

## Success criteria

Internalized when the user can name the appropriate fold-to-3bet rate
per opener position (~50% from EP, ~55% from BTN) and articulate why
late-position opens fold MORE to 3bets than early-position opens (wider
opening range = more junk that doesn't make the cut vs a 3bet).
For cluster mastery, the user can also name the position-and-stack
levers (deeper stacks justify wider continues; shorter stacks justify
tighter folds) without consulting the baseline table.

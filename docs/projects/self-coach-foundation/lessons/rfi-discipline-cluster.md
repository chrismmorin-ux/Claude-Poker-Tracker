---
conceptId: rfi-discipline-cluster
title: Opening First-In — Why Folding Too Tight Quietly Caps Your Win-Rate
tier: 2
leakTagIds:
  - hero-pf-open-overfold
frameworkIds: []
test_substrate: pending
citation:
  source: Standard 100bb 6/9-max solver RFI ranges (EP ~15% → BTN ~42%); POKER_THEORY.md §7 (first-principles fold equity)
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-06-06
  amended_at: null
  amendment_reason: null
---

## Exposition

When the pot is folded to you, you are first-in: every player who could
contest the pot still to act is just the blinds (and whoever is left behind
you). The decision is simple — open-raise or fold — and it is the single
most frequent decision in the game. How wide you open from each seat is
therefore one of the largest levers on your overall result.

Solver opening ranges widen sharply as you move toward the button, because
fewer players are left to wake up with a hand and the blinds are forced to
defend out of position. A rough reference at 100bb:

- **Early position** — about **15%** of hands. Most seats still to act, so
  the range is tight and value-leaning.
- **Middle position** — about **19%**.
- **Late position (CO)** — about **26%**. Fewer players behind; steals
  start to carry real weight.
- **Button** — about **42%**. Only two players left, both out of position;
  this is the widest, most profitable opening seat in the game.

The leak this concept tracks is **opening too tight** — folding hands
first-in that should raise. It is invisible because nothing bad *happens*
when you fold a hand you should have opened; you simply never collect the
fold equity, the dead blinds, or the post-flop edge in position. Hand after
hand, that forfeited EV is the difference between a small winner and a real
one. Under-opening is the quiet inverse of the more obvious "opening too
wide" leak, and it is at least as common among careful players who confuse
tightness with discipline.

The detector measures one thing factually: across hands where it was folded
to you from a given open position, how often you raised versus folded —
compared to that position's solver reference. It is a frequency observation
over your own first-in decisions, not a judgment of any single fold. Because
the right opening width differs so much by seat, the concept resolves to a
per-position sub-concept:

- **rfi-discipline-EARLY** — opening discipline from early position
  (tightest reference; under-opening here costs the least but is also the
  hardest to leak from).
- **rfi-discipline-MIDDLE** — middle position.
- **rfi-discipline-LATE** — cutoff; the first seat where stealing dominates
  the range, so under-opening starts to cost meaningfully.
- **rfi-discipline-BUTTON** — the button; the widest reference and the
  highest cost to under-opening, since folded buttons forfeit the best seat
  in poker.

Per-cell lessons land in WS-149 ongoing.

## Worked example

**Spot:** Folded to hero on the button with K♦7♦, 100bb effective. Small
blind and big blind to act behind.

A careful player folds this — offsuit-ish, not premium, "nothing special."
But on the button, against only two players who must both play out of
position, K♦7♦ is a clear open. It has a live high card, a suited-ish
connector profile for board coverage, and — most importantly — fold equity:
the blinds fold often enough that the raise prints on its own, and when
called, hero has position for the rest of the hand.

Solver opens roughly the top 42% of hands from the button. K♦7♦ is
comfortably inside that range. Folding it is not "disciplined" — it is
leaving a routinely profitable steal on the table. A hero who folds this
class of button hand at a high rate shows up as a low button open frequency,
which is the exact pattern this concept flags. The fix is not to raise
*everything* — it is to recognize that the button reference is wide for a
reason, and hands like K♦7♦ are inside it.

## Success criteria

Internalized when the user can explain *why* opening ranges widen toward the
button — fewer players left to act and forced blind defense out of position
both raise the value of stealing — and can name the rough per-seat reference
(EP ~15%, MP ~19%, CO ~26%, BTN ~42%). For applied mastery, the user opens
near the position-appropriate width first-in, treating the button and cutoff
as steal-heavy seats rather than folding marginal-but-profitable hands out of
misplaced tightness.

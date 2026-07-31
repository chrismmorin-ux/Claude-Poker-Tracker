---
conceptId: multiway-field-size-scaling
title: Field Size — What Your Hand Is Actually Worth
tier: 5
leakTagIds:
  - hero-multiway-bluff-frequency
frameworkIds:
  - hand_class_shift
  - fold_equity_compression
  - nut_necessity
test_substrate: drill
exposition_source:
  module: postflopDrillContent/lessons.js
  lesson_id: mw-field-size
citation:
  source: docs/research/multiway-flop-strategy-2026-07-31.md (engine-computed, this repo); POKER_THEORY.md §6.1-6.4 (N-player spine); HandHQ reference pool SRC-011
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-07-31
  amended_at: null
  amendment_reason: null
---

## Exposition

Heads-up on 9♥8♥2♠, top pair with a weak kicker is worth 73% and a bare nut
flush draw is worth 57%. Top pair is the better hand by sixteen points and it
is not close. Six-way on that same board, the nut flush draw is worth 37% and
top pair with a weak kicker is worth 31% — the draw is now the better hand.
Neither holding changed. The field changed, and the field is what decides
which one you would rather have.

That is the concept. Field size is not a modifier you apply after you have
evaluated your hand; it is part of what your hand is. Every other multiway
idea — why bluffs die, why thin value dies, why you check back air three-way —
is a consequence of this one relationship.

**The anchor.** Your fair share of the pot is one divided by the number of
players in it. Six-way that is 16.7%; five-way 20%, four-way 25%, three-way
33%. This is not the price of a call — pot odds routinely let you continue for
less. It is the reference line that says whether a holding is an asset or a
liability. Carry the number, express everything else as a multiple of it, and
the multiples stay stable even when the table is looser or tighter than you
assumed.

**Why the ordering moves.** A draw's equity is a count of cards: nine hearts
are nine hearts whether one opponent is looking at the board or five. A
one-pair hand's equity is the probability that nobody else connected, and that
probability decays geometrically with every player added. Measured as
retention — the fraction of heads-up equity a holding still has six-way —
nutted hands and nut-ish draws keep 64–84%, and one-pair hands keep 27–59%.
The nut flush draw passes top-pair-weak-kicker at four opponents and passes
second pair at only two.

**Three decisions, three different bars.**

*Continue or fold.* Six-way, continue at roughly 2× fair share and fold below
1×. That puts second pair (0.9×) and two overcards (0.6×) under the line,
which is what makes "hit or fold" a real strategy rather than a simplification.

*Bet or check.* With no fold equity — close to true multiway — betting beats
checking exactly when your equity exceeds your fair share. The bar falls as
the field grows, and it falls faster than a nut draw's equity does. That is
the arithmetic behind "more callers is better with a nutted draw." With fold
equity added back, the practical threshold settles near 28% once four or more
players are in.

*Believe them, or call.* Into five players, a half-pot bluff needs each
opponent to fold 80%. Population fold-to-c-bet is 55.5%, which compounds to
5.3% fold-through against a required 33.3% — short by more than six times. A
bet into four or five is representing value because value is the only thing
that profits there.

**The counterweight, which matters as much as the collapse.** Defense divides
across the field. Against a half-pot bet five-way you personally owe about 20%
continuation, not the 66.7% the heads-up rule demands. Learning "don't bluff
multiway" without this half produces a nitty over-folder. Both facts point the
same way in practice: fold the weak holdings, and defend with the top fifth of
your range — which multiway means nutted hands and strong draws, not one-pair
bluff-catchers.

## Worked example

**Spot:** Six players limp to a 9♥8♥2♠ flop. Hero holds A♥5♥ — the bare nut
flush draw, no pair, no straight draw. Two players check, a middle-position
limper bets half pot, one player calls. Action on hero.

The hand-centric read is "ace-high, no pair, five opponents, fold." The
field-relative read is different at every step.

*What is it worth?* 37% against this field. Fair share six-way is 16.7%, so
the holding is at 2.2× — firmly in continue territory, and worth more here
than top pair with a weak kicker would be.

*What does the price ask?* Half pot with one caller already in asks for 20%.
The hand has 37%. It is not close, and raising is live too: with no fold
equity assumed, betting or raising beats calling passively whenever equity
clears fair share, and 37% clears 16.7% by more than double.

*What does the bettor have?* They led into five players. For that bet to be a
bluff, all five would need to fold about 80% of the time each; they fold 55.5%.
So this is value — probably a nine, two pair, or a set. That does not make
hero's draw a fold. It makes hero's draw the correct hand to continue with,
precisely because it does not need to be ahead right now.

*The inversion in one spot:* if hero instead held K♠9♦ — top pair, weak kicker —
the same three questions give 31%, a thinner cushion over the price, and a
hand that is behind the bettor's value range with no outs to improve past it.
The pair feels like the stronger holding and is the weaker one.

**Contrast — the same draw heads-up.** One opponent, hero holds A♥5♥ on the
same board and faces a half-pot bet. Now fair share is 50%, the draw is worth
57% but the bettor's range is far wider and far weaker, and the bet-or-check
bar has risen to 50% rather than fallen to 16.7%. The draw is still fine; it
is simply no longer the standout holding it becomes multiway.

## Success criteria

Internalized when the user computes fair share as 1/(players in pot) without
prompting, and states their holding as a multiple of it rather than as a hand
name — "this is about 2× fair share" rather than "I have a flush draw." For
applied mastery: in pots of five or more, the user continues with nut and
nut-ish draws ahead of one-pair hands, bets draws whose equity clears roughly
28% against the field, does not bluff into four or more opponents, and does
*not* over-fold to multiway bets — recognizing that per-defender minimum
defense drops to roughly 20% five-way rather than staying at the heads-up
66.7%.

The user should also be able to state what these numbers are not: one-street
showdown equity with no equity realization, implied odds, position, or stack
depth modelled. That bias runs against draws and in favor of weak one-pair
hands, so the ordering is conservative — but the figures are continue/fold and
bet/check guides, not stack-off thresholds.

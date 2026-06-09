---
conceptId: turn-barrel-discipline-cluster
title: The Second Barrel — Why Firing Every Turn After a Cbet Loses Money
tier: 5
leakTagIds:
  - hero-turn-barrel-frequency
frameworkIds: []
test_substrate: pending
citation:
  source: HERO_STATE_DESIGN.md (range-vs-range continuation); POKER_THEORY.md §7 (first-principles fold equity); standard heads-up turn barrel frequencies
  source_line: null
versionLineage:
  version: 1
  authored_at: 2026-06-06
  amended_at: null
  amendment_reason: null
---

## Exposition

After you cbet the flop heads-up and get called, the turn is a second
decision, not a formality. The flop call has already filtered villain's
range: the air that would have folded is gone, and what remains is made
hands, pairs with showdown value, and draws. To barrel again profitably,
the turn bet has to fold out enough of *that* continuing range — and most
turn cards don't shift the picture enough to justify firing at a high
frequency.

Solver barrels the turn heads-up at roughly **half its continuing range** —
a reference near **50%** — and which half it fires depends almost entirely
on the turn card. Cards that improve hero's range or threaten villain's
(overcards to the flop, cards that complete hero's draws, scare cards that
hit hero's perceived range) justify continuing; bricks that change nothing
favor checking back, giving up the bluffs and pot-controlling the medium
made hands.

The leak this concept tracks is **over-barreling** — firing the turn at a
frequency well above that reference, typically because the second bullet has
become automatic after the cbet. It bleeds chips because the turn bets that
get called are facing a range that already proved it wanted to continue on
the flop, and the bluffs that are supposed to fold it out mostly don't. The
chips invested on a bricked turn against a sticky range are close to dead.

The detector measures one thing factually: across heads-up turns where you
cbet the flop, continued as the aggressor, and were first to act, how often
you fired again versus checked — compared to a solver reference near 50%. It
is a frequency observation over your own barrel decisions, not a judgment of
any single hand.

This umbrella concept anticipates two sub-concepts (v2, once the detector
classifies the turn card):

- **turn-barrel-discipline-good-runout** — turn cards that improve hero's
  range or threaten villain's (favorable equity shift); barreling frequency
  is correctly higher here.
- **turn-barrel-discipline-bad-runout** — bricks and cards that favor
  villain's continuing range; barreling should drop sharply, and over-firing
  these is where most of the leak lives.

Per-cell lessons land in WS-149 ongoing.

## Worked example

**Spot:** Hero opens CO with A♣Q♠, BB calls. Flop K♦8♥3♣. BB checks, hero
cbets, BB calls. Turn 4♠. BB checks, action on hero.

The reflex is to fire again — hero has two overcards, "still has equity,"
and already told the story with the flop bet. But look at what the flop call
kept in BB's range: king-x, eights, pocket pairs, gutshots and backdoor
draws that picked up nothing. The 4♠ brick changes none of that. It doesn't
improve hero's range (A♣Q♠ is still ace-high), and it doesn't threaten BB's
king-x or pairs at all.

A second barrel here is firing into a range that called once and has no
reason to fold to the same bet on a card that helped nobody. The bluff folds
out almost none of the value, and hero is putting in chips with a hand that
would rather realize its showdown equity. **Check back.** A♣Q♠ keeps ace-
high showdown value and the option to bluff a genuine scare card on the
river. A hero who instead barrels this class of bricked turn every time they
cbet the flop shows up as a turn barrel frequency well above ~50%, which is
the exact pattern this concept flags.

## Success criteria

Internalized when the user can explain *why* turn barrel frequency must sit
near half-range and hinge on the turn card — the flop call has already
removed the foldable air, so only cards that shift range advantage justify a
second bullet — and can name the rough reference (~50% heads-up, shading up
on favorable cards and down on bricks). For applied mastery, the user checks
back bricked turns with marginal made hands and give-up bluffs rather than
firing a second barrel on initiative alone.

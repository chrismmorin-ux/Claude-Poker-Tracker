---
conceptId:        pot-odds
title:            Pot Odds & Break-Even Equity
tier:             1
leakTagIds:       []
frameworkIds:     ['decomposition']
test_substrate:   drill
exposition_source:
  module:         drillContent/lessons.js
  lesson_id:      pot-odds
citation:
  source:         POKER_THEORY.md §3.2
  source_line:    null
successCriteria: |
  Internalized when the user can compute break-even equity for half-pot,
  pot-sized, 1.5×, and 2× bet sizes within 5 seconds without scratch paper.
  At the table, the user names the four threshold percentages of the bet-size
  ladder (¼-pot → 17%, ½-pot → 25%, pot → 33%, 2× pot → 40%) reflexively.
versionLineage:
  version:        1
  authored_at:    2026-05-02
  amended_at:     null
  amendment_reason: null
---

## Exposition

*Reused from `drillContent/lessons.js#pot-odds` — see exposition_source. The pedagogical core is already authored and owner-validated; this lesson card is the SCF schema overlay.*

Every bet facing you has a break-even equity — the percentage you need to win the hand to make the call a zero-EV decision. Above that threshold, calling is profitable; below it, folding. The formula is simple: the bet divided by the total pot after you call.

Break-even equity = bet / (pot + 2 × bet)

The bet-size → equity ladder:
- ¼-pot → need 17%
- ⅓-pot → need 20%
- ½-pot → need 25%
- ⅔-pot → need 29%
- pot → need 33%
- 1.5× pot → need 38%
- 2× pot → need 40%
- 3× pot → need 43%

Notice how quickly it plateaus past pot — doubling the bet from pot to 2× pot only adds 7pp to the required equity, not another 33pp. Overbets look scary but aren't as punishing as they feel.

The break-even formula ignores future action. When facing a bet with a draw and high implied odds (more money behind, fish villain, connector hand that makes disguised nuts) the true equity threshold is lower — you can profitably call below the raw number. Reverse-implied: dominated draws (the low card of a flush with villain holding the ace) have LESS equity than the raw formula suggests because your payoff is capped. Adjust raw pot odds by 2-5pp in each direction based on the texture.

## Worked example

AKs vs JTs scenario. AKs wins 62% across all-in equity. If villain (JTs) jams the pot all-in on a flush-draw flop and the math says break-even equity is 40%, hero is well above threshold — 62% > 40% is an easy call.

This is the core loop: estimate equity, compare to break-even, act.

## Success criteria

Internalized when the user can compute break-even equity for half-pot, pot-sized, 1.5×, and 2× bet sizes within 5 seconds without scratch paper. At the table, the user names the four threshold percentages of the bet-size ladder (¼-pot → 17%, ½-pot → 25%, pot → 33%, 2× pot → 40%) reflexively.

---

**Test myself on this concept** is enabled (`test_substrate: 'drill'`). Tapping invokes the drill engine in opt-in-test mode scoped to `frameworkIds: ['decomposition']`, with the matchup library filtered to pot-odds-relevant scenarios from the practical_math category.

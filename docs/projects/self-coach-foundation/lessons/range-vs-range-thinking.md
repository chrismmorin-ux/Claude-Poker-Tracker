---
conceptId:        range-vs-range-thinking
title:            Range vs Range Thinking
tier:             3
leakTagIds:       ['flop-cbet-defense-overfold', 'flop-cbet-frequency-tell']
frameworkIds:     ['range_decomposition']
test_substrate:   drill
exposition_source:
  module:         postflopDrillContent/lessons.js
  lesson_id:      range-decomposition
citation:
  source:         POKER_THEORY.md §5.5
  source_line:    null
successCriteria: |
  Internalized when the user can decompose a range on a flop into precise
  hand-type shares — flushes/straights/sets/two-pair/top-pair-tier/middle-pair/
  bottom-pair/underpair/strong-draws/weak-draws/air — within 15 seconds at the
  table for any combination of preflop range × flop the user encounters in
  their session pool. The user thinks in %s, not in fuzzy labels like
  "villain has a medium hand."
versionLineage:
  version:        1
  authored_at:    2026-05-02
  amended_at:     null
  amendment_reason: null
---

## Exposition

*Reused from `postflopDrillContent/lessons.js#range-decomposition` — see exposition_source.*

On any flop, a range decomposes into specific hand types: made flushes, made straights, sets, trips, two-pair, overpairs, TPTK+, TP-weak, middle pair, bottom pair, underpairs, combo draws, flush draws, OESDs, gutshots, overcards, and air. Every postflop decision starts from knowing the %s.

"Villain has a pair" is a fuzzy claim. "BB call range on K72r is 8% TPTK+, 15% TP-weak, 21% middle pair, 20% bottom pair, 10% underpair, 2% two-pair-or-better, and 24% air" is an actionable one.

Range on board = flush+ ∪ straight+ ∪ (set/trips/two-pair) ∪ top-pair tier ∪ mid/low pair ∪ strong draws ∪ weak draws ∪ air (sums to 100%)

Without decomposing, you bet "because villain folds a lot." With decomposing, you bet because villain's range is 45% air and 20% weak draws — 65% of combos whose continue-EV against your sizing is negative. The numbers dictate sizing: big bets make sense against polarized ranges (strong + air), small bets against condensed ones (mostly medium). Precision is what survives tight spots.

The most common beginner error is collapsing the distribution into fuzzy labels ("villain has a medium hand"). Engine-level precision costs nothing at the table if you've trained on it beforehand; all that's needed is knowing roughly what the %s are for each archetype/flop pair.

## Worked example

BTN open vs BB call. Two flops:

**Ks 7h 2d (dry).** BTN's range has the K in range 3× more often than BB can have AA — BTN holds a structural range advantage at top. BB's flat range is capped (no AA/KK; cold-4-bet range threw those into 3-bet preflop). TPTK+ shares are similar between the two, but BB has zero overpair+ combos. The asymmetry isn't visible in fuzzy labels — only decomposition shows it.

**6h 5d 4c (wet).** Contrast: BTN's range whiffs HARD here (few small pairs, lots of high-card offsuits). BB's flatting range connects with small pairs, suited connectors, and trap hands. Decomposition shows the nut region flipping — the image of "BTN dominates because BTN" is wrong on this texture.

## Success criteria

Internalized when the user can decompose a range on a flop into precise hand-type shares — flushes/straights/sets/two-pair/top-pair-tier/middle-pair/bottom-pair/underpair/strong-draws/weak-draws/air — within 15 seconds at the table for any combination of preflop range × flop the user encounters in their session pool. The user thinks in %s, not in fuzzy labels like "villain has a medium hand."

---

**Test myself on this concept** is enabled (`test_substrate: 'drill'`). Tapping invokes the postflop drill engine in opt-in-test mode scoped to `frameworkIds: ['range_decomposition']`, with the scenario library filtered to range-decomposition scenarios.

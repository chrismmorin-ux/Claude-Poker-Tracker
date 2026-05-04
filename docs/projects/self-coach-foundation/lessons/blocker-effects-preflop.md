---
conceptId:        blocker-effects-preflop
title:            Blocker Effects (Preflop)
tier:             4
leakTagIds:       ['preflop-3bet-bluff-frequency-tell']
frameworkIds:     ['straight_coverage', 'flush_contention', 'broadway_vs_connector']
test_substrate:   drill
exposition_source:
  module:         drillContent/lessons.js
  lesson_id_set:  ['straight-coverage', 'flush-contention', 'broadway-vs-middling']
citation:
  source:         POKER_THEORY.md §4.3
  source_line:    null
successCriteria: |
  Internalized when the user can count direct + single-card straight runs
  for a hand within 5 seconds (e.g., AQ has 4 direct + 0 single-card vs
  unblocked board), assess flush-contention asymmetries (one-suited vs both-
  suited-different scenarios) accurately, and predict broadway-vs-connector
  blocker damage by counting Broadway straight overlap. At the table, the
  user reads "AKo vs JTs" and knows AK blocks 2 of JT's 4 direct straight
  runs; reads "AKo vs 54s" and knows AK blocks only 1 of 4. Postflop
  blockers (e.g., nut-flush-blocker bluffs on 3-flush boards) are NOT
  covered in this lesson — see `006-blocker-effects-postflop.md` (Gate 5
  ongoing; coverage gap per Gate 4 audit).
versionLineage:
  version:        1
  authored_at:    2026-05-02
  amended_at:     null
  amendment_reason: null
---

## Exposition

*Reused from `drillContent/lessons.js#straight-coverage + #flush-contention + #broadway-vs-middling` — see exposition_source. Three drill lessons combine here as one Tier 4 SCF lesson covering the preflop scope of blocker effects.*

Every hand participates in some set of 5-card straight patterns. "Direct" runs use both hole cards. "Single-card" runs use one hole card plus four board cards. Direct runs are worth more equity because the board only needs 3 specific cards, not 4.

Coverage Score = 2.0 × direct runs (live) + 0.7 × single-card runs (live)

AK participates in 3 straight runs total: A2345 (A only), 9TJQK (K only), TJQKA (both). AQ participates in 4: A2345 (A only), 89TJQ (Q only), 9TJQK (Q only), TJQKA (both). The Q sits in one more 5-card run than the K does. AQ therefore carries slightly more straight-coverage equity than AK — a small but real edge that "just count direct runs" frameworks miss.

Suitedness is asymmetric. The blanket "+3% for suited" rule is misleading. Hero-suited vs pocket pair gives hero ~+3.0pp (opponent can't flush at all). Hero-suited vs offsuit unpaired gives hero only ~+1.6pp (opponent still has 1 backdoor route). When BOTH hands are suited (necessarily different suits — AhKh vs JhTh has a card conflict), flushes don't collide on the same board, so each side independently gains. But the gains are asymmetric: the LOWER-flush side gains more (its flush is its primary winning route); the HIGHER-flush side actually LOSES ~1pp net because its own flush gain is smaller than the damage from villain's flush.

Hands like AK, AQ, KQ, KJ sit at the top of every Broadway straight. There are only 10 five-card straights total, so blocking a few of them is a meaningful chunk of a connector's equity. Middle suited connectors (JTs, T9s) have the MOST direct straight runs of any hand shape (4 each), but the TOP two of their runs always contain a broadway rank — so broadway hands kill half their coverage.

Three takeaways:
1. AQ outperforms AK on straight-coverage in many matchups (4 single-card runs vs 3).
2. Suitedness asymmetry: when both hands suit up, the LOWER flush gains; the HIGHER flush loses net.
3. Broadway hands hurt middle connectors structurally; they don't hurt low connectors as much.

## Worked example

**AKo vs JTs (broadway vs middle connector).** JT has 4 direct runs (789TJ, 89TJQ, 9TJQK, TJQKA). AK blocks the top two (9TJQK has K; TJQKA has both A and K). JT keeps 2 of 4 live. AK's own Broadway is blocked because JT has the J and T. Heavy blocker matchup.

**AKo vs 54s (broadway vs low connector).** 54s has 4 direct runs (A2345, 23456, 34567, 45678). AK blocks only 1 (the wheel A2345 has the A). 54s keeps 3 of 4 live — far more than JT did vs AK. Broadway hurts middle connectors much more than low ones.

**AKs vs JTs (suitedness double-trap).** AKo vs JTo = 63.1% (offsuit baseline). AKs vs JTs = 62.0%. AKs LOSES 1.1pp when JTs also gets its flush, while JTs GAINS 1.1pp. The lower-flush side wins the suitedness exchange.

## Success criteria

Internalized when the user can count direct + single-card straight runs for a hand within 5 seconds (e.g., AQ has 4 direct + 0 single-card vs unblocked board), assess flush-contention asymmetries (one-suited vs both-suited-different scenarios) accurately, and predict broadway-vs-connector blocker damage by counting Broadway straight overlap. At the table, the user reads "AKo vs JTs" and knows AK blocks 2 of JT's 4 direct straight runs; reads "AKo vs 54s" and knows AK blocks only 1 of 4. Postflop blockers (e.g., nut-flush-blocker bluffs on 3-flush boards) are NOT covered in this lesson — see `006-blocker-effects-postflop.md` (Gate 5 ongoing; coverage gap per Gate 4 audit).

---

**Test myself on this concept** is enabled (`test_substrate: 'drill'`). Tapping invokes the preflop drill engine in opt-in-test mode scoped to `frameworkIds: ['straight_coverage', 'flush_contention', 'broadway_vs_connector']`, with the matchup library spanning all three frameworks.

**Note on scope.** This lesson covers PREFLOP blocker effects (hand-vs-hand equity decomposition) only. POSTFLOP blocker effects (e.g., the Ax in your hand on a 3-flush board blocks a chunk of villain's nut flushes, enabling a high-EV bluff) are a separate concept with NO existing drill substrate. They ship as `006-blocker-effects-postflop.md` in Gate 5 ongoing with `test_substrate: 'pending'` until Gate 4 v2 / Gate 5 research determines the right test substrate.

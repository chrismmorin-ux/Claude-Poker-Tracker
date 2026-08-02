# Board Convergence — Layer A design note

**WS-310, post-gate. 2026-08-01.** Written because the gate confirmed; see
`docs/research/board-convergence-gate-2026-08-01.md` for the measurement this rests on.

This note covers exactly what the ticket's accept criteria require after a confirming
gate: the Layer-A representation, where it attaches in the existing runout walk, what
replaces the hero-centric `isScary` test, and an explicit statement on WS-303. It is a
design note, not a charter — the build is not authorised by it.

---

## 1. What the gate changed about the design

The concept going in was "a runout is a collapsing window; measure the window, then measure
what players do while it is open." The gate confirmed the second half exists, and narrowed
what the first half must be:

**The effect is a SHAPE effect, and its sign depends on the mechanism.**

| turn card | deviation (linear / mixed) | direction |
|---|---|---|
| straight flush completes | +11.7pp / +5.5pp | sticky |
| flush completes | +7.9pp / +2.2pp | sticky |
| straight completes | +2.9pp / +2.8pp | sticky |
| board pairs | −4.1pp / −2.4pp | over-folds |

A flush-completing turn **polarises** the defender's equity distribution — you have it or
you do not — so fewer combos clear the price and justified continuation falls to 80.3%. A
paired turn **compresses** equity toward the middle, so more combos clear it and justified
rises to 92.0%. Observed continuation moves 0.4pp across that 11.7pp swing.

Three consequences bind the design:

1. **A representation that tracks only the LEVEL of range strength reproduces none of
   this.** Mean equity moves in the same direction for both cells; only the distribution's
   shape distinguishes them. Layer A must expose a distribution, not a summary.
2. **A single boolean cannot carry a sign that flips.** Whatever replaces `isScary` has to
   be signed and mechanism-aware.
3. **The control question is unresolved.** `overcard_blank` reads +7.2pp on one arm and
   +0.2pp on the other, so the gate does not establish that this is about the nut window
   rather than generic scare-card aversion. Any build must carry that as an open risk, not
   assume it away.

---

## 2. Layer-A representation

**The primitive already exists and should not be re-invented.** POKER_THEORY §15 makes the
board define the universe, and `pokerCore/handEvaluator.comboStrengthPercentile` returns a
combo's normalised rank within it. §15.4 binds percentile as the cross-board coordinate.

Layer A is the **pushforward of a declared range through that map, and its deformation
under each possible next card**:

```
windowBefore = { percentile(c) : c in range }          // distribution, on the current board
windowAfter(card) = { percentile(c) : c in range }     // same combos, board + card
```

What must be exposed, given the gate's shape result:

| quantity | why it is required |
|---|---|
| the **CDF** of range strength on the board | the whole result is polarisation vs compression; a mean cannot see it |
| `deltaCdf(card)` | how the card deforms it — the signed, per-card quantity |
| reachable **terminal classes** and their probabilities | the collapsing window itself; supplies the "what can still be made" question |
| mechanism label (`pairs_board` / `completes_flush` / …) | **reporting only** — see the guardrail below |

**Guardrail, and it is the one most likely to be violated in implementation.** The
mechanism label is an OUTPUT of the combinatorics, never an input to a decision. Adding
`if (mechanism === 'completes_flush') foldRate *= 1.1` would be exactly the position-label
and bucket-label anti-pattern in new costume (POKER_THEORY §7.1–7.3, `exploitEngine/CLAUDE.md`).
The decision input is `deltaCdf` — a computed quantity derived from board combinatorics.
The label exists so a human can read the output.

**Declared range, always.** Layer A is computed against a declared range, never the
engine's own narrowed estimate. Taking the base rate from the model makes the model
validate itself (FIND-038). Terminal-strength distributions stay pool/archetype level,
never per-villain (Finding 14). And nothing here may be persisted or boosted like a
showdown anchor — showdown evidence is per-villain observation; this is a projection.

---

## 3. Where it attaches

`gameTreeDepth2.computeCallDepth2EV` already walks the runout card by card
(`gameTreeDepth2.js:540`): it builds `newBoard`, recaches texture, evaluates bet vs check
per card, and weights the result. **The enumeration machinery is already there — Layer A
attaches inside that existing loop, and requires no new traversal.**

The attachment point is the per-card body at lines 569–586, where `isScary` is computed and
consumed. Three call sites consume it today, and the same expression is duplicated at
lines 688 and 879 (the bet-call and river branches):

- `scaryCardCount` / `scaryRankSet` → surfaced as `nextStreetPlan.scaryCards`
- `reverseImpliedOddsPenalty(heroScoreBefore, heroScore, isScary, spr, potAfterCall)`

**A constraint inherited from WS-303, and it is not optional.** Carrying a range to a new
board requires **no narrowing at all** — the grid is board-independent and equities are
recomputed downstream. Layer A must therefore be a *read* of the range against the new
board, never a re-weighting of it. Any implementation that narrows per runout card
re-commits the exact defect WS-303 measured (`narrowingCount.test.js` asserts the count and
will fail on it).

---

## 4. What replaces `isScary`

Today:

```js
const isScary = suitFreq[nextCard & 3] >= 2 || boardRanks.has(nextCard >> 2);
if (isScary && heroScore <= heroScoreBefore) scaryCardCount++;
```

Two defects, both confirmed by the gate:

- **Hero-centric.** Gated on `heroScore <= heroScoreBefore`, so it conflates "the board got
  more dangerous" with "hero fell behind". Both directions the gate found are properties of
  the space of hands **villain** can hold.
- **Binary and unsigned.** A boolean cannot express that board-pairing and
  flush-completion push in opposite directions. Worse, its two clauses map onto cells with
  *opposite* measured signs — `boardRanks.has(...)` is `pairs_board` (over-folds, −4.1pp)
  and `suitFreq[...] >= 2` is roughly `completes_flush` (sticky, +7.9pp) — so the current
  code sums two effects of opposite sign into one counter. It also scores a straight-
  completing card as nothing at all: a 9 on J-T-x moves the nuts from a set to a straight
  and neither clause fires.

Replacement shape:

```js
// Descriptive; derived from board combinatorics against a DECLARED range.
nutShift(boardBefore, card) -> { mechanism, categoryBefore, categoryAfter }
rangeShapeDelta(boardBefore, card, declaredRange) -> signed scalar
```

`rangeShapeDelta` is the decision input; `mechanism` is the label. `reverseImpliedOddsPenalty`
takes the signed scalar in place of the boolean, which lets a board-pairing card and a
flush-completing card price differently instead of identically. `nextStreetPlan` gains a
signed field rather than a count of "scary" cards.

**Do not ship the magnitudes from the gate as constants.** They move by up to 3.6x across
the live band (`completes_flush` +7.9pp → +2.2pp). The gate establishes signs and the
existence of a shape effect; it does not establish a coefficient. Anything that needs a
magnitude has to compute it per board, which is what Layer A is for.

---

## 5. Does this supersede WS-303, or sit beneath it?

**It sits beneath it. They are not the same root cause.** The ticket's hypothesis — that
WS-303's re-narrowing decay and this work share a root — does not survive contact with what
each one actually does.

WS-303's defect is **evidence double-counting**: applying an approximate likelihood to a
range that already conditioned on that same evidence, repeatedly, so the error compounds
(Δlog|cov +0.245 → +0.135 → −0.074 FTP; +0.159 → +0.010 → −0.239 PS). The mechanism is
multiplication of a likelihood into a posterior more times than there were actions.

Layer A does not multiply a likelihood into anything. It **reads** a declared range against
a board — exact combinatorics, applied once per card, with no accumulation across streets.
It also deliberately never consults the engine's narrowed estimate, so it cannot inherit or
amplify narrowing error. Structurally, the compounding failure mode has no analogue here.

**This is a reasoned claim, not a measured one, so the cheap test the ticket asked for is
stated rather than skipped:** score the runout walk with and without Layer-A conditioning
at depths 1–3 on the existing WS-273 / WS-293 harness, on the same decisions across arms.
If Layer A were the same error class, adding it would make depth-3 Δlog|cov worse. If the
depth curve is unchanged, the claim above holds. Run it before building, not after.

---

## 6. Open founder decision

**Does Layer A ship as a new primitive, or as a replacement for the nuts / strong /
marginal / draw / air taxonomy?**

Deferred to the founder — it is an architectural choice with reach well beyond this ticket,
since the bucket taxonomy is consumed across `rangeSegmenter`, `gameTreeConstants` and the
exploit rules.

The argument for replacement, now supported from two independent directions:

- The measured draw column runs 16.0% flop → 24.2% turn → **0.0% river by construction**.
  "Draw" is not a hand class; it is an **unresolved state**, and a bucket label cannot
  express "9 outs to the nuts, 38 outs to nothing".
- This gate's result is the same argument from the other side: the thing that predicts
  behaviour is the **shape** of the range's strength distribution, which a five-label
  partition discards by design.

The argument against is cost and blast radius, not correctness.

**Also still open, and not to be quietly absorbed:** WS-319 (EV-by-percentile curve) builds
the y-axis over the same board-conditional percentile x-axis Layer A uses. The two share a
primitive and should be sequenced deliberately.

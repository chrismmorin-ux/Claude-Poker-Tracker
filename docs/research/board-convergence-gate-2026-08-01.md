# Board convergence gate — do players respond to the card, or to the danger?

**WS-310 Stage 1+2 · run 2026-08-01 · HandHQ online cash, July 2009 (SRC-011)**
Scripts: `scripts/backtest/mine-runout-response.py` · `scripts/backtest/runoutBenchmark.mjs`
Data: `out/runout-response.json` · `out/runout-benchmark.json`

---

## Verdict: CONFIRMED, with the opposite sign to the stated prediction, and it depends on the mechanism

The ticket's stated prediction was:

> on nut-changing turns, continuation drops MORE than the combinatorial change in range
> strength justifies — villains over-fold to the scare card relative to what their own
> range supports.

That is **refuted for three of the four nut-changing mechanisms and confirmed for the
fourth.** The behavioural layer has a real effect with a sign, so the gate passes and
Layer A + B is worth designing — but the effect is not "villains over-fold to scare
cards". It is mechanism-dependent, and the two directions are opposite.

| turn card | deviation, linear arm | deviation, mixed arm | reading |
|---|---|---|---|
| `completes_sf` | **+11.7pp** (z=7.9) | **+5.5pp** (z=4.8) | sticky |
| `completes_flush` | **+7.9pp** (z=5.5) | **+2.2pp** (z=2.2) | sticky |
| `completes_straight` | **+2.9pp** (z=2.5) | **+2.8pp** (z=3.5) | sticky |
| `pairs_board` | **−4.1pp** (z=−3.7) | **−2.4pp** (z=−3.3) | over-folds |
| `overcard_blank` *(control)* | +7.2pp (z=5.3) | +0.2pp (z=0.2) | **not stable** |

Difference-in-differences against the `blank` cell. Positive = continues MORE than the
combinatorics justify (sticky). Negative = over-folds. The two arms are two assumptions
about what the bettor's barrelling range is made of; see *Bands* below.

**The sign is stable across both arms for every one of the four nut-changing cells.** The
magnitude is not — it moves by up to 3.6x between arms — and the control cell is not
stable at all. Both caveats are load-bearing and are treated below rather than buried.

---

## 1. What was measured

**Population.** A player called a flop bet, went to the turn heads-up, and faced a turn
bet. The measured decision is their answer: fold, call, or raise.

**113,163 decisions** out of 1,750,645 hands scanned. Excluded and counted, never silently
dropped: `multiway` 12,453 (a second live player changes both the price and the correct
fold rate), `no_clean_flop_bet` 358,667 (no flop bet, or the flop bet was raised — that
defender's range is "called a raise", a different population).

**This population is unusually clean for this repo.** Fold, call and raise are actions in
the hand log, so **neither the numerator nor the denominator is showdown-censored.** That
is a real departure from Findings 12/13 and from `mine-intent-splits.py`, which are
shown-hand conditionals censored on both sides. Here the censoring lives entirely in the
*holdings* — we never learn what a folder held — which is exactly the gap Layer A fills.

**Cells are nut identity, computed rather than heuristic.** For the 3-card board and again
for the 4-card board, compute the category of the best five-card hand available to *any*
two-card holding. Different → the card moved the nuts. The classifier was validated
against a brute-force oracle that enumerates all 1,081 holdings and evaluates all seven
cards: **400 random boards, 0 mismatches.**

The oracle earned its keep immediately by rejecting two of the fixtures written from
intuition — an ace on J‑T‑2 *does* move the nuts (KQ makes Broadway), and A‑K‑Q of hearts
already permits a straight flush on the flop, so a fourth heart changes nothing. Both
"obvious" expectations were wrong.

---

## 2. Raw continuation — necessary, and not yet a finding

```
cell                     n      folds   continues   cont k/n        avg price
completes_sf          3,284       868      2,416    2416/3284        0.2357
pairs_board          16,388     4,899     11,489   11489/16388       0.2367
completes_flush       7,642     2,255      5,387    5387/7642        0.2360
completes_straight   24,380     6,363     18,017   18017/24380       0.2433
overcard_blank       19,209     6,293     12,916   12916/19209       0.2434
blank                42,260    12,014     30,246   30246/42260       0.2416
```

Per the standing rule that numbers carry their conditional, **none of these is a finding on
its own.** "Villains continue 70.5% when the flush completes" is a large read if their range
holds the flush 12% of the time and is close to correct play if it holds it 40%. The whole
point of Layer A is to supply that denominator.

Two things are worth noting before it does:

- **Continuation is nearly flat.** The full spread across all six cells is 6.7pp
  (67.2%–73.9%). Whatever the runout does, the answer comes back at roughly seven-in-ten.
- **Price is not the confound.** Average required equity varies by 0.8pp across cells
  (0.2357–0.2434). Players are not sizing differently enough by card class for pot odds to
  explain anything. The benchmark uses each spot's *actual* price regardless.

### Which runouts kill the barrel

The same pass measured the bettor's own turn action. This is uncensored — betting is
always observed — and answers one of Layer B's three questions directly.

```
cell                   barrels    checks    barrel k/n     rate
completes_sf             3,284     2,617    3284/5901     55.7%
completes_flush          7,643     6,088    7643/13731    55.7%
pairs_board             16,388    10,844   16388/27232    60.2%
completes_straight      24,380    14,068   24380/38448    63.4%
overcard_blank          19,209    11,749   19209/30958    62.0%
blank                   42,263    26,675   42263/68938    61.3%
```

**A completed flush is the card that kills aggression** — 55.7% vs 61.3% on a blank, a
5.6pp drop. A completed straight does the opposite (63.4%). This feeds the benchmark: a
card the bettor barrels *less* often implies a narrower, stronger betting range, which is
why `completes_flush` earns a lower justified continuation.

---

## 3. Layer A — what the combinatorics justify

For each spot: what fraction of the declared flop-calling range still clears the actual
price offered, computed by exact 44-river enumeration on the turn board.

```
cell                  observed   just(linear)  just(mixed75)  just(polar50)
completes_sf            73.6%        79.6%         93.8%          99.7%
pairs_board             70.1%        92.0%         98.2%          99.4%
completes_flush         70.5%        80.3%         93.9%          99.6%
completes_straight      73.9%        88.8%         96.8%          99.6%
overcard_blank          67.2%        77.8%         92.8%          99.3%
blank                   71.6%        89.3%         97.3%          99.5%
```

**Measured, not assumed** (all uncensored, all from Stage 1): the flop-continue width
(394,936/835,799 = 47.25%), the per-cell barrel rate, and each spot's actual price.

**Declared, never model-derived:** ranges come from `PREFLOP_CHARTS` in
`pokerCore/rangeMatrix.js` — imported solver-approximate charts. Nothing in the benchmark
consults the narrower, the range profile, or any engine output. Taking the base rate from
the model would make the model validate itself; that is FIND-038, where sizing tells
measured self-consistency with the engine's own prior while the UI claimed showdown
confirmation.

**The flop filter uses flop-board equity only.** Ranking the defender's range by turn-board
equity would leak the very card whose effect is being measured into a range that is
supposed to predate it.

**Equity is blocker-exact.** A defender holding the A♥ blocks every villain combo
containing the A♥, and those combos leave both numerator and denominator. Verified against
a pairwise brute force on three boards including a four-flush and a trips board: 138
comparisons, max absolute difference **2.55e-15**.

### Why the levels are all biased the same way

Observed sits below justified in every single cell. That is expected and is not the
finding: "clears the pot odds" ignores implied odds, the option to raise, and the fact that
calling a turn bet commits you to a river decision. It is a declared reference quantity,
not a claim about optimal play. **This is exactly why the headline is the
difference-in-differences** — the bias is common to all cells and differences out.

### Bands, and one arm that is dead

Which combos a player barrels is not knowable from the data, so the betting range is built
under three compositions. `linear` takes the top *f* by equity (the strongest plausible
range); `mixed75` adds bluffs at 25% of the width; `polar50` splits 50/50.

**`polar50` is saturated and carries no information.** It pins justified continuation at
99.3–99.7% in *every* cell — spread 0.4pp. With no cell-to-cell variation left, its
difference-in-differences silently collapses into the raw observed contrast: it looks like
a Layer-A-corrected number while containing no Layer A at all. It is detected
automatically, excluded from the headline, and reported here because the failure is worth
recording. The cause is structural: a 50/50 split at the measured barrel widths (~0.56–0.63)
means betting the top 30% *and* the bottom 30% of a range — an object no player constructs,
and one so weak on average that essentially every defending combo beats the price.

The live band is therefore `linear` to `mixed75`, and truth is somewhere inside it.

---

## 4. Reading the result

**The robust finding is that the direction depends on the mechanism, and the two directions
are opposite.**

- **A card that creates a new nut CLASS — flush, straight, straight flush — produces
  stickiness.** Players continue more than their own range supports. This is Layer B's
  first question ("do they get sticky with a hand that was strong before the nuts
  changed?") answered yes, and it matches the founder doctrine that fear pushes MEDIUM
  hands into passive lines rather than out of the pot: the hand that was top pair is still
  top pair, and it calls.
- **A card that PAIRS the board produces over-folding.** The only cell matching the
  ticket's stated prediction, and the smallest effect (−4.1 / −2.4pp).

The mechanism behind the sign flip is visible in the justified column and is a **shape**
effect, not a level one. A flush-completing turn *polarises* the defender's equity
distribution — you have the flush or you do not — so fewer combos clear the bar and
justified drops to 80.3%. A paired turn *compresses* equity toward the middle, so more
combos clear it and justified rises to 92.0%. **Between those two cells justified moves
11.7pp while observed continuation moves 0.4pp** (70.5% vs 70.1%). Players are responding
to the card, but not to what it did to the shape of their own range.

That is a sharper statement than "villains over-fold to scare cards", and it is one the
current engine cannot express at all: `gameTreeDepth2.js:570` scores a runout card as
`suitFreq[nextCard & 3] >= 2 || boardRanks.has(nextCard >> 2)`, gated on whether *hero*
fell behind. Both directions found here are properties of the space of hands **villain**
can hold.

### What does NOT hold, stated plainly

- **The control does not cleanly separate on one arm.** `overcard_blank` — an overcard that
  raises hero-centric danger *without* moving the nuts — reads +7.2pp (z=5.3) on `linear`
  and +0.2pp (z=0.2) on `mixed75`. On the linear arm it is statistically indistinguishable
  from `completes_flush` (+7.9pp). So on that arm the data does **not** establish that the
  effect is specifically about the nut window rather than generic scare-card behaviour.
  Only on `mixed75` does the control fall away while the nut-changing cells survive. This
  is the single weakest point in the result and should not be papered over.
- **Magnitudes are assumption-sensitive.** `completes_flush` moves from +7.9pp to +2.2pp
  across the live band. Sign robust; size not. Any later build must not quote the linear
  number as *the* number.
- **The cell definition is category-level.** A turn moving the nuts from one straight to a
  higher straight scores as `blank`. This dilutes the blank cell with genuinely nut-moving
  cards, which *shrinks* measured contrasts rather than manufacturing them — a conservative
  direction, but it means these are lower bounds.
- **Era and pool.** 2009 online 50NLH, two sites. The live 9-handed pool this app targets is
  a different population. Layer A does not age; every number in §4 does.
- **Corpus scale.** The ticket cites 21.6M hands; 1,750,645 are materialised on disk
  (50NLH, FTP + PS). More is recoverable via `git sparse-checkout add`. Cell counts here are
  ample (smallest 3,284), so this was not a limiting factor, but the claim should be
  corrected wherever it is repeated.

---

## 5. What this earns

The gate confirms, so the ticket's follow-up is authorised: design Layer A and Layer B
together, with its own scope. Three things this run establishes that the design should
carry:

1. **Layer A must represent equity SHAPE, not just level.** The entire result is a shape
   effect — polarisation vs compression. A representation that only tracks "how strong is
   the range on average" would reproduce none of it.
2. **The replacement for `isScary` has to be mechanism-aware.** A single "the board got
   scarier" bit cannot carry a sign that flips between board-pairing and flush-completion.
3. **The control question is not settled and should be designed for.** Separating
   nut-window response from generic scare-card aversion needs either a betting-range
   composition pinned tighter than the current band, or a cell design that varies the nut
   window while holding perceived danger fixed.

Open decision flags, both explicitly post-gate per the ticket, both now live:
**(1)** does this supersede WS-303 or sit beneath it — noting WS-303 is `status: done`, so
the question reframes to whether conditioning *one* terminal window avoids the compounding
that street-by-street re-narrowing produced (Δlog|cov +0.245 → +0.135 → −0.074);
**(2)** does Layer A ship as a new primitive or replace the nuts/strong/marginal/draw/air
taxonomy — the draw column running 16.0% → 24.2% → 0.0% by construction says "draw" is an
unresolved state, not a hand class, and this run's shape result is the same argument from a
second direction.

**Sibling overlap, kept visible:** WS-319 (EV-by-percentile curve) builds the y-axis over
the same board-conditional percentile x-axis this work uses. It should not be quietly
absorbed into the Layer A/B design.

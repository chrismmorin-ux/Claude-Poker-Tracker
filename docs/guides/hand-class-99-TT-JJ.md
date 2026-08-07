# Hand-class study: 99, TT, JJ

**Status:** v1, 2026-08-02 · **Method:** `docs/guides/HAND_CLASS_STUDY_METHOD.md` · **Reproduce:** `scripts/research/hand-class-sweep.mjs`
**Doctrine dependencies:** POKER_THEORY §1.5, §2.1, §2.5, §3.4, §7.3, §11.6, §12, §14, §15

Every number below is computed from this repo's own engines. Nothing is quoted from an
outside chart or from memory. Where a number is sampled rather than enumerated, its error
is stated next to it; where a number rests on a modelling assumption, the assumption is
named.

---

## Bottom line

**These are not three hands. They are one hand with a fat left tail that shortens as the
rank rises.**

On every flop where none of them makes a set — 65.1% of flops live for all three — their
board-conditional strength percentiles are separated by **exactly 1.02 percentile points,
on every such board, regardless of the board's top card** (§5.4, exhaustive). Not "close on
average": constant, and constant at a value smaller than the width of a single hand class.
Against a premium-heavy range they are equally indistinguishable — versus QQ+/AK their
equities span 0.5pp, and versus KK+/AKs they span 0.1pp and QQ joins them. What makes a
range separate the class is not its width but whether it contains hands the class dominates
(§4.1).

What separates them is the **shape of the distribution, not its centre**. Mean flop
percentile moves only 84.0 → 86.3 → 88.7 from 99 to JJ. But the probability of landing
below the 75th percentile moves **26.1% → 3.5% → 2.1%** — a 12× spread. 99 is a hand that
is frequently in trouble; JJ is a hand that is rarely in trouble; and when neither is in
trouble they are, measurably, the same hand.

The practical consequence: **the class should be played as a class, and the board should be
doing nearly all of the discriminating.** How wide that indifferent region is turns out to be
a property of board texture rather than of street (§6.3) — and on a board the class beats,
the class prefers betting *more strongly than aces do* (§6.2), which is the least intuitive
thing this study found.

---

## 1. Method, scope, and what this study cannot say

### 1.1 What was computed

> **Revision note.** v1 of this document was reviewed adversarially before release
> (`research-scientist`, `cto-agent`, `failure-engineer`). The review falsified two of its
> headline claims by re-running the harness, and found six figures the harness did not
> produce. Both are recorded where they occurred rather than quietly corrected. What the
> review changed is summarised in §10.

| Stage | What it produces | Exact or sampled |
|---|---|---|
| `structure` | Flop/turn/river structure over all C(50,3) = 19,600 flops | **Exact** — exhaustive enumeration |
| `percentile` | Board-conditional strength percentile (§15) over all 19,600 flops | **Exact** — exhaustive, via the shipped `comboStrengthPercentile` |
| `parity` | Max pairwise percentile gap *within* the class, on a board set identical for all members | **Exact** — exhaustive over C(46,3) |
| `runout` | Percentile decay through a named flop → turn → river | **Exact** |
| `boost` | `applyShowdownAnchor`'s adjacent-pair boost traced through normalisation | **Exact** |
| `priors` | What `rangeEngine/populationPriors` says the pool does with each hand | Exact read of a committed prior |
| `equity` | Equity vs constructed ranges, and true N-way multiway equity | Sampled, 120,000 trials, ±0.7pp at 95% |
| `evcurve` | EV(bet) − EV(check) across the full percentile axis; measured neutral zone | **Flop: sampled** (~±1.5 chips, `miniRolloutEquity`). **River: exact** — no rollout runs |
| `pool` | HandHQ Reference-tier aggregates (SRC-011) | Exact read of mined counts |

Every percentile in this document comes from the shipped `comboStrengthPercentile`. An
earlier version of the harness carried a local "fast path" plus a run-time equivalence
assertion; adversarial review established that the assertion was a **tautology** —
`bestFiveFromSeven` delegates to `evaluate5` for 5-card inputs, so the two paths were the
same function, the check could not fail on any board, and the local copy was 25% slower and
missing the shipped collision guards. It has been deleted. A check that cannot fail is worse
than no check, because it reads as coverage.

### 1.2 What this study cannot say

These limits are stated here rather than discovered later.

- **No live-pool hand-level data exists in this repo.** The HandHQ corpus (SRC-011) is
  online, July 2009, Reference-class, and is *never* served to live segments — that
  separation is founder-ratified doctrine (`docs/domain-spec.md`, 2026-07-22). It gives an
  online backdrop for aggregate frequencies and nothing more. **Every claim below about
  "how the pool plays these hands" is a claim about the engine's population *prior*, not a
  measured live frequency.** The prior is a founder/doctrine estimate. It has never been
  measured against live hands, and this study does not measure it.
- **The opening charts are the unobserved-seat prior, not the answer.** POKER_THEORY §2.1
  is explicit: a chart cannot know who is sitting behind hero. Equities computed against
  chart ranges are therefore equities against a *typical unknown*, which is the weakest
  version of every question in this document.
- **The EV curve inherits every modelling assumption in the game tree**, including the
  §12 scope boundary: on flop and turn, future-street branches still let villain act as
  though hero's exact cards are known. River figures are the clean ones.
- **`computePerComboEV` / `computePerComboCheckEV` are node-level components of the
  depth-2 tree, not the recommendation path.** They are called here with a board cache and
  full combo enumeration (as production does), but with no villain model. They measure the
  shape of the engine's EV surface, not what the app would advise.
- **Two named asymmetries inside that subtraction.** The check branch multiplies by a
  realization factor that the bet branch has no counterpart for, and hero bets 0.66 pot
  while villain's modelled bet is 0.50 pot. Both were measured as second-order (≤0.44
  chips) relative to the sampling noise below. On the **river** the realization term
  short-circuits and the asymmetry vanishes entirely, which is one reason the river rows
  are the load-bearing ones.
- **Flop EV numbers are noisy; river EV numbers are exact.** `computeComboEquity` runs
  unseeded 32-sample rollouts (`miniRolloutEquity`) on flop and turn boards, giving ~±1.5
  chips of 95% run-to-run error per combo on a 100-chip pot — large next to the 2-chip
  neutral-zone threshold. On a river board no rollout runs and the output is bit-identical
  across runs. §6 reports per-holding means with measured error bars and withholds a
  decision label whenever the interval cannot separate the value from the threshold.

### 1.3 Reproduce

```bash
node --import ./scripts/utils/register-src-resolver.mjs \
     scripts/research/hand-class-sweep.mjs all
# or one stage: structure | percentile | parity | runout | priors | pool | boost | equity | evcurve
# study a different class: --hands 66,77,88
```

---

## 2. The structural spine (exact)

All 19,600 flops enumerated. Percentages are of flops, not of hands played.

| | 0 overcards | 1 | 2 | 3 | flops a set | board paired |
|---|---|---|---|---|---|---|
| **99** | **20.71%** | 44.39% | 29.08% | 5.82% | 11.76% | 17.39% |
| **TT** | **30.53%** | 45.80% | 20.82% | 2.86% | 11.76% | 17.39% |
| **JJ** | **43.04%** | 43.04% | 12.80% | 1.12% | 11.76% | 17.39% |
| *QQ* | *58.57%* | *35.14%* | *6.00%* | *0.29%* | *11.76%* | *17.39%* |

Carried through the runout — the probability that **no overcard has appeared yet**:

| | by flop | by turn | by river |
|---|---|---|---|
| **99** | 20.71% | 11.90% | **6.73%** |
| **TT** | 30.53% | 20.14% | **13.13%** |
| **JJ** | 43.04% | 32.05% | **23.69%** |

**Three facts do the work of this whole section.**

1. **The set branch is identical for all three: 11.76% on the flop, 19.18% by the river.**
   Whatever separates 99 from JJ, it is not set-mining. (This also confirms POKER_THEORY
   §1.5's "~1 in 8" — 11.76% is 1 in 8.5.)
2. **An overpair to the flop is not an overpair to the river.** 99 arrives at the river
   still clean **6.73%** of the time. Playing 99 as though its flop status persists is a
   bet that a 1-in-15 event has happened.
3. **The gap between the three is entirely in the tail.** JJ sees a clean flop 2.1× as
   often as 99 (43.0% vs 20.7%), and sees a *three*-overcard flop 5× less often (1.12% vs
   5.82%).

---

## 3. How the class is normally played — the engine's own prior

`getPopulationPrior(position, action)` returns a per-hand propensity, and its rank within
the 169-cell grid tells you where the pool ranks the hand for that action. Values below
are propensity `(rank of 169)`.

**Cold-call, facing a raise:**

| position | 99 | TT | JJ | QQ | AA |
|---|---|---|---|---|---|
| EARLY | 0.917 (#5) | 0.918 (#2) | 0.832 (#15) | 0.573 (#30) | 0.100 (#128) |
| LATE | 0.823 (#15) | 0.730 (#34) | 0.514 (#56) | 0.244 (#95) | 0.104 (#131) |
| BB | 0.851 (#7) | 0.800 (#18) | 0.570 (#44) | 0.304 (#70) | 0.113 (#128) |

**3-bet:**

| position | 99 | TT | JJ | QQ | AA |
|---|---|---|---|---|---|
| EARLY | 0.007 (#104) | 0.007 (#118) | **0.037 (#4)** | 0.094 (#3) | 0.391 (#1) |
| LATE | 0.011 (#109) | 0.044 (#6) | **0.086 (#4)** | 0.128 (#3) | 0.484 (#1) |

The prior encodes a clean, monotone doctrine: **99 is a call, JJ is a raise, TT is the
hinge and it moves with position.** From EARLY, TT 3-bets at 99's rate (0.007, #118). From
LATE, TT 3-bets at 6× that rate and jumps to #6 in the grid. That positional hinge is the
single most characteristic fact about this class in the model.

Note also what the prior does *not* do: it never assigns zero. Post-WS-302 every cell
carries support (§2.1, §11.6). 99 has a nonzero 3-bet propensity from every position — the
model can be moved off "99 never 3-bets" by evidence, which a zero could not be.

**Live-pool backdrop, and its caveat.** For an *online* July-2009 pool (SRC-011, 12.9M
hands), full-ring aggregate rates are VPIP 20.9% / PFR 9.0% / 3-bet 3.2% / c-bet 59.5% /
fold-to-c-bet 55.5% / fold-to-3-bet 85.8% (n = 39.3M preflop opportunities, 1.06M
c-bet-faced). A 3.2% 3-bet rate is roughly QQ+/AK and change — consistent with §2.3's
"a 3-bet from a typical live player is almost always a monster" — but **this is online
data and must not be read as a live measurement.**

---

## 4. What they run into — equity vs actual ranges

Monte Carlo, 120,000 trials, ±0.7pp at 95% confidence.

| Villain range | width | runs | 99 | TT | JJ | QQ | AA |
|---|---|---|---|---|---|---|---|
| UTG open (GTO chart) | 10% | 3 | 50.7 ±0.4 | 55.8 ±0.1 | 61.3 ±0.2 | 67.0 ±0.1 | 82.5 ±0.0 |
| CO open (GTO chart) | 23% | 1 | 60.8 | 64.8 | 67.5 | 71.0 | 83.3 |
| BTN open (GTO chart) | 51% | 1 | 65.3 | 69.6 | 72.0 | 75.3 | 84.6 |
| BB defend (GTO chart) | 37% | 1 | 63.0 | 66.6 | 71.0 | 74.2 | 83.9 |
| Live cold-caller of an open | 25% | 1 | 59.2 | 63.8 | 68.1 | 72.7 | 83.5 |
| Live limp/call (loose-passive) | 52% | 1 | 66.4 | 69.6 | 72.1 | 76.2 | 84.2 |
| **Narrow 3bet (QQ+, AK)** | **3%** | 3 | **35.6 ±0.3** | **36.5 ±0.2** | **36.1 ±0.5** | 40.1 ±0.1 | 84.1 ±0.2 |
| **Reg 3bet, linear** | 4% | 3 | **35.2 ±0.3** | **38.6 ±0.4** | **45.4 ±0.5** | 54.7 ±0.3 | 83.3 ±0.5 |
| **Reg 3bet, polar** | 4% | 3 | **47.5 ±0.4** | **48.3 ±0.3** | **47.9 ±0.5** | 51.6 ±0.3 | 82.9 ±0.2 |
| **4bet tight (KK+, AKs)** | **1%** | 3 | **27.5 ±0.4** | **27.8 ±0.1** | **27.6 ±0.2** | 27.2 ±0.2 | 79.5 ±0.6 |
| 4bet wide (JJ+, AQs+, AKo, A5s) | 4% | 3 | 37.7 ±0.4 | 38.2 ±0.1 | 40.8 ±0.2 | 50.1 ±0.3 | 84.1 ±0.4 |

*Each cell is 120,000 Monte Carlo trials. The `runs` column is how many independent runs
were averaged; `±` is the across-run half-range, not the within-run CI. Narrow ranges are
repeated because that is exactly where the class's members sit inside one interval of each
other and an ordering read off a single run is a coin flip — the first draft of this document
made that mistake, and §10 records it.*

### 4.1 The finding that matters most in this whole document

**The class separates against a range only when that range contains hands the class
dominates.** Range *width* is a proxy for this, and it is a leaky one.

Sorted by how far the class spreads:

| Range | 99 → JJ spread | separated? |
|---|---|---|
| Reg 3bet, **linear** (4% wide) | **10.2pp** | yes, decisively |
| UTG open (10%) | 10.6pp | yes |
| Live cold-caller (25%) | 8.9pp | yes |
| BTN open (51%) | 6.7pp | yes |
| 4bet wide (4%) | 3.1pp | yes |
| Reg 3bet, **polar** (4%) | **0.4pp** | **no** |
| Narrow 3bet QQ+/AK (3%) | **0.5pp** | **no** |
| 4bet tight KK+/AKs (1%) | **0.1pp** | **no** |

A 4%-wide *linear* 3-bet range (TT+, AQs+, AJs, AKo, KQs) spreads the class by **10.2pp** —
more than a 51%-wide button open does. A 4%-wide *polar* range of identical width spreads it
by **0.4pp**. Width is not the variable; **composition is.** A linear range contains AJs, KQs
and TT — hands JJ beats and 99 does not. A polar range is premiums plus suited junk, and
against premiums-plus-junk all three members win and lose in the same places.

Against the three premium-heavy ranges the class is not merely close, it is **at or below the
resolution of the measurement**:

- **QQ+/AK (3%):** 35.6 / 36.5 / 36.1. Only the 99↔TT gap resolves (0.9pp, non-overlapping
  intervals); JJ is separable from neither. The class spans 0.9pp.
- **KK+/AKs (1%):** 27.5 / 27.8 / 27.6 — and QQ is 27.2. Four hand classes, one number.
  There is no version of this spot where "but I have JJ, not 99" is an argument, and no
  version where "but I have QQ" is either.

The first draft of this document read a 0.5pp single-run spread as "JJ is the worst of the
three" and attached a blocker story to it. Five independent runs put JJ last once. **The
ordering was noise; the indistinguishability is the result** — and it is a stronger one.

**The exploitable consequence.** The entire value of holding JJ rather than 99 against a
3-bet is a bet on that 3-bettor's range being *linear*, not polar. That is a per-villain
property, it lives in the villain model, and no preflop chart can encode it.

### 4.2 Multiway — where a 9-handed game actually lives

True N-way Monte Carlo (`handVsRangesMW`), every opponent on the stated range.

Versus **live cold-callers** (25% range each):

| | HU | 3-way | 4-way | 5-way | fair share |
|---|---|---|---|---|---|
| **99** | 58.7 ±0.7 | 39.2 ±0.7 | 29.6 ±0.8 | 22.5 ±0.8 | 50 / 33 / 25 / 20 |
| **TT** | 64.1 ±0.7 | 43.7 ±0.7 | 32.2 ±0.8 | 24.5 ±0.8 | |
| **JJ** | 67.8 ±0.6 | 49.5 ±0.7 | 37.3 ±0.8 | 31.0 ±0.9 | |
| *QQ* | *72.7 ±0.6* | *55.7 ±0.7* | *43.9 ±0.8* | *36.1 ±0.9* | |
| *AA* | *83.6 ±0.5* | *70.9 ±0.7* | *60.7 ±0.8* | *51.4 ±1.0* | |

Unlike §4.1's premium-heavy rows, these gaps are **real**: 99 → JJ spans 9.1pp heads-up and
8.5pp five-way against a ±0.8pp interval, and both the values and the ordering held across
**three** independent runs. A 25%-wide range is exactly the kind that contains hands JJ
dominates and 99 does not, which is §4.1's rule applied multiway.

All three stay **above fair share at every table size** — 99 is at 22.5% five-way against a
20% fair share. The class does not lose its equity edge multiway; it loses its *realization*
of that edge, because 88.24% of the time it is a one-pair hand that cannot bet three streets
into four opponents (§1.4, equity realization). The number to hold in mind is that 99's
edge five-way is roughly +2.5pp of a pot it will usually not be able to contest.

*A comparison this study does not make: how the class fares against an unpaired hand like
AKs multiway. The committed harness carries only pair references, so any such claim would not
be reproducible from it (§9).*

---

## 5. Board-conditional percentile — the class on every possible flop

POKER_THEORY §15 makes *all possible hands on this board* the denominator for strength, and
notes that `comboStrengthPercentile` is the right primitive. This section runs it
exhaustively: every one of the 19,600 flops, percentile against all 1,176 legal combos on
that board.

| | mean | p10 | p25 | median | p90 | ≥95th | <85th | **<75th** |
|---|---|---|---|---|---|---|---|---|
| **99** | 84.0 | 74.8 | 74.8 | 84.5 | 97.2 | 11.6% | 67.1% | **26.1%** |
| **TT** | 86.3 | 75.3 | 83.6 | 85.0 | 97.2 | 11.6% | 58.9% | **3.5%** |
| **JJ** | 88.7 | 79.2 | 85.5 | 89.9 | 98.0 | 26.9% | 18.4% | **2.1%** |
| *QQ* | *91.0* | *84.6* | *86.0* | *91.6* | *98.3* | *36.2%* | *10.9%* | *0.8%* |
| *AA* | *95.6* | *91.4* | *94.0* | *96.7* | *98.6* | *70.7%* | *0.0%* | *0.0%* |

**Read the tail column, not the mean column.** The means are close together (84.0 → 88.7
across the class, a 4.7-point span). The `<75th` column spans **26.1% → 2.1%**. The mean says
these are similar hands; the tail says 99 is a structurally different object. Both are true,
and the tail is the one that costs money — it is where you are drawing dead-ish into a board
that hit somebody's range and not yours.

The 99 column has a signature worth naming: **its p10 and p25 are the same number, 74.8** —
so a quarter of all flops sit at or below a value that the hand also hits at its 10th
percentile. The percentile axis for a pocket pair is lumpy rather than smooth, because rank
against a fixed combo universe takes only a handful of distinct values: 99's modal
percentile is 84.47, hit on **5,700 flops (29.08%)**, and TT's and JJ's modes are the
adjacent values 84.98 (31.22%) and 85.49 (30.00%).

### 5.1 Decomposed by overcard count

| hand | overcards | share of flops | mean pctile | ≥95th | <85th |
|---|---|---|---|---|---|
| 99 | 0 | 20.7% | 92.85 | 19.0% | 0% |
| 99 | 1 | 44.4% | 85.48 | 13.0% | 86.9% |
| 99 | 2 | 29.1% | 78.21 | 6.5% | 78.6% |
| 99 | 3 | 5.8% | 70.02 | 0% | 98.2% |
| TT | 0 | 30.5% | 93.42 | 16.9% | 0% |
| TT | 1 | 45.8% | 85.77 | 11.5% | 88.4% |
| TT | 2 | 20.8% | 79.05 | 5.6% | 75.3% |
| JJ | 0 | **43.0%** | 93.99 | **50.8%** | 0% |
| JJ | 1 | 43.0% | 86.09 | 10.2% | 19.9% |
| JJ | 2 | 12.8% | 80.39 | 5.0% | 68.9% |

**Conditional on overcard count, the three hands are nearly the same hand.** At one
overcard: 85.48 / 85.77 / 86.09. At two: 78.21 / 79.05 / 80.39. The differences *within* a
column are under 2.2 points. Almost all of the aggregate difference between 99 and JJ comes
from the **share** column — how often each overcard count occurs — not from how the hand
performs once it does.

**Caution — this is a strength statement, not yet a play statement.** Percentile measures
rank against the board's combo universe. It does not measure blockers or range
interaction, and §4.1 shows those matter at narrow range widths (JJ blocks JJ/QJ/JT; 99
blocks 99/T9/98). "Same percentile ⇒ same play" is licensed only where the villain range is
wide enough that blocker effects are second-order. Blockers are **not measured anywhere in
this study** (§9).

### 5.2 The bimodality

| hand | branch | share | mean | median | p10 | p90 |
|---|---|---|---|---|---|---|
| 99 | set/quads | 11.76% | 98.92 | 99.7 | 96.7 | 99.9 |
| 99 | no set | 88.24% | 82.00 | 84.5 | 74.8 | 91.4 |
| TT | set/quads | 11.76% | 98.96 | 99.7 | 96.7 | 99.9 |
| TT | no set | 88.24% | 84.64 | 85.0 | 75.3 | 93.3 |
| JJ | set/quads | 11.76% | 99.11 | 99.7 | 96.9 | 99.9 |
| JJ | no set | 88.24% | 87.25 | 85.5 | 75.8 | 95.2 |

The set branch is **identical across the class** — same share, same 98.9–99.1 mean, same p10.
Every difference between 99 and JJ lives in the 88.24% no-set branch, and in that branch the
means differ by 5.25 points.

### 5.3 Percentile decays through the runout

Flop `9h 5s 2d`, turn `Qc`, river `Ks` — a clean low flop that runs out badly (`runout` stage):

| hand | flop | turn (Q) | river (K) | |
|---|---|---|---|---|
| 99 | 99.9 | 99.6 | 97.9 | flopped a set |
| TT | 94.7 | 82.7 | **69.7** | unimproved |
| JJ | 95.2 | 83.3 | **70.2** | unimproved |
| *QQ* | *95.7* | *99.9* | *98.1* | *turn gave it a set* |
| *AA* | *96.7* | *93.9* | *88.6* | *unimproved* |

Two overcards cost the overpair **25 percentile points**, and the set loses 2. This is the
mechanical picture behind §5's tail column: an overpair's percentile is a claim about the
board *so far*, and it depreciates on a schedule set by §2's runout table.

### 5.4 Same-board parity — the sharpest result in the study

The §5 and §5.1 sweeps each enumerate a *slightly different* board set, because each hand
removes its own two cards from the deck. They therefore support claims about distributions,
not about individual boards. The `parity` stage fixes that: it enumerates only the
**C(46,3) = 15,180 flops live for all three hands at once**, scores all three on each, and
reports the maximum pairwise percentile gap per board.

| slice | boards | share | mean gap | median | p95 | **max** |
|---|---|---|---|---|---|---|
| all boards | 15,180 | 100% | 6.81 | 1.02 | 24.89 | 34.60 |
| **no member makes a set** | **9,880** | **65.1%** | **1.02** | **1.02** | **1.02** | **1.02** |
| some member makes a set | 5,300 | 34.9% | 17.59 | 15.45 | 25.15 | 34.60 |

**When none of the three makes a set, the gap between the best and worst member of the class
is exactly 1.02 percentile points — on all 9,880 such boards, with zero variance.** Mean,
median, p95 and max are the same number. Broken out by the board's top card, every rank
gives 1.02: ace-high, king-high, queen-high, eight-high, deuce-high, identical.

(The by-top-card breakdown has no J, T or 9 row *by construction* — any board whose top card
is one of those pairs a member of the class, which puts the board in the set branch.)

This is the honest form of the "they are one hand" claim, and it is stronger than the version
this document originally asserted. It also localises the entire difference precisely: the
class separates **only** through the 34.9% of boards where one member pairs it and the others
do not, and there the gap runs to 34.6 points. There is no third mechanism.

---

## 6. The EV curve and the measured neutral zone

POKER_THEORY §15.2 defines the neutral zone as `{ p : |EV(bet|p) − EV(check|p)| < ε }` and
observes that the primitives to compute it already exist but "have simply never been
joined." This section joins them. Every legal holding on a board is swept, its percentile
plotted against `computePerComboEV − computePerComboCheckEV`; pot 100, bet 66, ε = 2 chips.
Named holdings are re-evaluated 25 times and carry a measured 95% interval.

**How to read the numbers.** Flop rows are sampled and carry real error (`miniRolloutEquity`
runs unseeded 32-sample rollouts). River rows are **exactly reproducible** — their measured
sd over 25 runs is 0.00, which is the self-check that this is measuring what it claims.
A holding is labelled `UNRESOLVED` when its interval cannot separate it from ±ε; that label
is a result, not a gap.

**The neutral zone is reported as the IQR of in-zone percentiles plus the in-zone density.**
The hull is a bad statistic — one tie-group of junk combos at the bottom of a board drags the
lower endpoint to near zero and inflates the width several-fold. v1 of this document compared
hulls and overstated its headline ~3×.

### 6.1 The class on eight board × range sweeps

Δ = EV(bet) − EV(check), in chips on a 100-chip pot, ±1.96 sd over 25 runs.

| board (vs live cold-caller) | 99 | TT | JJ | QQ | AA | AKo |
|---|---|---|---|---|---|---|
| FLOP `8h5s2d` — overpair, dry | **+12.91 ±1.25** | +12.42 ±1.32 | +12.07 ±1.01 | +11.54 ±0.96 | +7.97 ±0.65 | +2.21 ±1.67 |
| FLOP `Kd8s3c` — underpair, dry | −1.21 ±1.27 | −1.46 ±0.77 | −1.31 ±1.07 | −1.64 ±0.93 | +8.77 ±0.87 | +7.14 ±0.64 |
| FLOP `9h8h5s` — wet, two-tone | +12.37 ±0.82 | +12.18 ±1.58 | +12.97 ±1.42 | +13.68 ±1.16 | +11.71 ±1.35 | −2.19 ±2.68 |
| FLOP `8s8d3c` — paired | **+8.49 ±1.23** | +7.67 ±0.82 | +6.92 ±0.89 | +6.48 ±0.77 | +2.81 ±0.56 | +4.95 ±1.43 |
| FLOP `Jh9s4d` — straddling | +9.97 ±0.52 *(set)* | +1.85 ±1.14 | +10.26 ±0.62 *(set)* | +13.76 ±0.93 | +14.76 ±1.19 | −8.12 ±2.00 |
| RIVER `Kd8s3c 7h 2s` | −18.11 ±0.00 | −16.79 ±0.00 | −15.08 ±0.00 | −13.45 ±0.00 | +0.04 ±0.00 | +0.13 ±0.00 |
| RIVER `8h5s2d Qc 4h` | −19.65 ±0.00 | −18.33 ±0.00 | −16.62 ±0.00 | +3.37 ±0.00 *(set)* | −1.10 ±0.00 | −32.84 ±0.00 |
| RIVER `9h8h5s 2h Qd` — flush in | −4.70 ±0.00 | −22.81 ±0.00 | −21.03 ±0.00 | −3.34 ±0.00 | −8.36 ±0.00 | −43.30 ±0.00 |

On the underpair flop `Kd8s3c` all four of 99/TT/JJ/QQ come back **UNRESOLVED** against the
cold-caller and **NEUTRAL** against BB-defend: bet and check are within 2% of the pot and the
measurement cannot separate them. That is the corrected form of a claim v1 stated too
confidently — a reviewer flipped TT from NEUTRAL to CHECK by re-running the script, because
the old numbers had no error bar (§10).

### 6.2 The result that replaces v1's headline: **the curve is not monotone**

v1 claimed the neutral zone collapses by street. The corrected sweep does not support that,
and something more interesting is true instead.

**EV(bet) − EV(check) peaks below the top of the percentile axis.** On the overpair flop AA
sits at percentile 96.7 and prefers betting by **+7.97**, while 99 at 94.2 prefers it by
**+12.91** — a 4.9-chip gap against ±1.3 error bars. On the paired flop the effect is larger
and the top-of-range slope is outright **negative** (−0.270 chips per percentile point across
the 80th–90th): 99 at 88.9 is **+8.49**, AA at 91.4 is **+2.81**, and against BB-defend AA
falls to +0.91 — NEUTRAL, i.e. the strongest possible holding is indifferent to betting on a
board where a middling overpair is not.

This is POKER_THEORY §3.4's fifth, inverse motive — *inducing* — appearing as a measured
slope rather than a description. The nuts lose less by checking because checking is how they
get paid; a hand that is strong but beatable cannot afford that. §15.2 asked for the slope to
stop being a metaphor, and here it changes sign.

**The consequence for this class is direct and useful:** on a board it beats, a middling
overpair is **the most bet-preferring holding on the board — more so than aces.** It has no
inducing option worth taking and no way to improve.

### 6.3 Neutral-zone width tracks board texture, not street

| board | vs cold-caller: IQR | density | vs BB defend: IQR | density |
|---|---|---|---|---|
| FLOP `8h5s2d` overpair, dry | 51.7pp | 4.3% | 54.5pp | 7.1% |
| FLOP `9h8h5s` wet, two-tone | 42.6pp | 5.7% | 8.2pp | 8.1% |
| FLOP `Jh9s4d` straddling | 10.2pp | 10.0% | 8.2pp | 10.9% |
| FLOP `Kd8s3c` underpair, dry | 7.1pp | 11.4% | 11.2pp | 11.6% |
| **FLOP `8s8d3c` paired** | **1.4pp** | 2.6% | 2.7pp | 5.6% |
| RIVER `8h5s2d Qc 4h` | 4.2pp | 9.4% | 4.6pp | 6.7% |
| RIVER `Kd8s3c 7h 2s` | 1.5pp | 3.1% | 1.5pp | 4.7% |
| RIVER `9h8h5s 2h Qd` flush in | **0.0pp** | 1.5% | 1.4pp | 2.1% |

**A paired flop has a narrower neutral zone (1.4pp) than two of the three rivers.** The street
does not determine the width. What does is how *stretched* the board makes the strength
distribution: on a paired or flush-completed board a small change in holding moves you a long
way in EV, so almost nothing is indifferent; on a dry unpaired flop a large block of holdings
is genuinely interchangeable.

The honest summary is therefore narrower than v1's and better supported: **rivers are
consistently narrow (0.0–4.6pp), flops vary enormously with texture (1.4–54.5pp), and the
two ranges overlap.** Adding the wet and paired boards — which v1 did not sweep, a scope gap
the review caught — is what falsified the clean street story.

### 6.4 Where the class sits, and why it matters

On every flop where the class is at or near the top of its range it is **far above** the
neutral zone and clearly betting. On the underpair flop it is **inside** the zone and the
measurement says so by declining to resolve it. On every river unimproved it is **far below**
the zone: percentile ~74–80 against a zone sitting at ~89–95, preferring check by 12–20 chips
with zero sampling error.

**An unimproved 99/TT/JJ arrives at the river as a bluff-catcher, and the engine's EV surface
says so with no error bar at all.** That is the most reliable single result in this document —
it is the one place where the number is exact, the §12 perceived-range correction is complete,
and every board and range tested agrees.

## 7. Where the engine handles this class badly

The brief asked "what boosts they do poorly at." That phrase has two readings and both are
answered here, because both turned out to matter.

- **The literal mechanism.** `rangeEngine/bayesianUpdater` has a *boost*: revealing a pair at
  showdown boosts its rank-neighbours, and its source comment names this exact class ("if we
  see TT, boost 99 and JJ"). §7.1 and §7.2 show that boost is mis-shaped, and quantify it.
- **The poker reading — where the class's EV degrades.** That is answered across the study
  rather than in one place: against premium-heavy ranges it stops being three hands at all
  (§4.1); multiway it keeps its equity edge and loses its realization (§4.2); on 26.1% of
  flops 99 lands below the 75th percentile (§5); and unimproved on any river it is a
  bluff-catcher by 12–20 chips (§6.4). The single worst spot in the study is a river the
  class did not improve on — every board and range tested agrees, with no sampling error.

### 7.1 The adjacent-pair boost is symmetric, and the class is not — **CONFIRMED finding**

`rangeEngine/bayesianUpdater.applyShowdownAnchor` boosts rank-adjacent pairs when a pair is
revealed at showdown:

```js
// Boost adjacent pairs (if we see TT, boost 99 and JJ)
const adjPairBoost = outcome === 'won' ? 0.25 : outcome === 'lost' ? 0.10 : 0.20;
```

Seeing TT in some action range boosts **99 and JJ by the same amount, in both directions,
regardless of the action.** The engine's own prior disagrees with that symmetry, sharply:

| action | 99 | TT | JJ | ratio JJ:99 |
|---|---|---|---|---|
| 3-bet (EARLY) | 0.007 | 0.007 | 0.037 | **5.3×** |
| 3-bet (LATE) | 0.011 | 0.044 | 0.086 | 7.8× |
| cold-call (LATE) | 0.823 | 0.730 | 0.514 | 0.62× |

If TT turns up in a **3-bet** range, the prior says JJ was 5.3× likelier than 99 to be there
too — but the boost adds +0.20 to each. If TT turns up in a **cold-call** range the
asymmetry runs the other way (99 is 1.6× likelier than JJ), and the boost is again flat.

So the mechanism is **directionally wrong in both directions**, and the error is largest
exactly where this class lives — around the 3-bet/call threshold that §3 identified as the
hand class's defining hinge.

**It does not normalise away, and the reason is structural.** `crossRangeConstraints
.normalizeScenario` loops per grid cell and normalises *across actions at that cell*;
`constrainSubclassesToParent` compares a subclass to its parent *at the same cell*. Nothing
in the pipeline ever compares cell *i* to cell *j* — and `rangeEngine/CLAUDE.md` rejects
cross-hand normalisation deliberately, because it would penalise wide ranges. A distortion
that lives on the **rank axis** therefore has no path by which normalisation could remove it.

Traced end to end (`hand-class-sweep.mjs boost`), one unknown-outcome TT showdown in a 3-bet
range:

| position | | 99 3bet | JJ 3bet | **ratio JJ:99** | 99 coldCall |
|---|---|---|---|---|---|
| EARLY | before | 0.0075 | 0.0370 | **4.94×** | 0.9169 |
| EARLY | after boost + normalise | 0.1845 | 0.2218 | **1.20×** | **0.8155** |
| LATE | before | 0.0111 | 0.0861 | **7.74×** | 0.8226 |
| LATE | after boost + normalise | 0.2042 | 0.2861 | **1.40×** | 0.7958 |

**A single showdown destroys the asymmetry the prior spent its whole design expressing** —
4.94× collapses to 1.20×, and 99's 3-bet propensity rises 25-fold, to a value the model's own
doctrine says belongs to JJ. The flat +0.20 is 27× larger than the cell it is being added to.

**And there is a second-order effect neither the code comments nor the original write-up
anticipated.** `normalizeScenario` caps `coldCall[i] + threeBet[i] ≤ 1.0` per cell. Boosting
99's `threeBet` pushes that cell's sum past 1.0, so the rescale drags 99's **cold-call**
weight down with it: 0.9169 → 0.8155, an 11% reduction. An anchor on TT in the 3-bet tree
silently erodes 99's cold-call range — a distortion exported into a different action
entirely.

**Fix:** scale the boost by the prior ratio (`prior[neighbour] / prior[seen]`, capped) rather
than adding a constant. Cheap, local, and it makes the anchor agree with the model it is
updating.

**Scope note, so this isn't mistaken for a different argument.** Showdown anchoring is
deliberately MNAR-accepting under FM-SEL-01 (`RANGE_ENGINE_DESIGN.md` §4.5), and boost
*magnitudes* are documented as uncorrected today. This finding is about the boost's **shape
across neighbours**, a different axis from the selection-bias magnitude that disposition
covers. It should be filed via `/workstream` and fixed in its own sprint, not here — a study
that edits the engine it is measuring has destroyed its own baseline.

### 7.2 Rank adjacency is the wrong similarity metric for this class

The boost assumes "one rank apart ⇒ behaviourally similar." The percentile sweep says the
opposite of what that assumption needs: 99 and TT are one rank apart and differ by **22.6
percentage points** in P(flop percentile < 75) — 26.1% vs 3.5%. TT and JJ are also one rank
apart and differ by **1.4 points** on the same measure. **The similarity between adjacent
pairs is wildly non-uniform across the ladder, and it happens to break hardest inside this
class.** A constant `adjPairBoost` cannot express that.

### 7.3 Bucket collapse is mostly harmless for this class — except where it inverts

v1 of this document filed a clean "honest negative" here: because 99/TT/JJ sit within ~1
percentile point of each other on any no-set board (§5.4), a bucket-level treatment loses
almost nothing, so AP-RL-01's cost is low for this class. Adversarial review pointed out that
the claim rested on two hand-picked EV boards. Adding a wet board and a paired board
**partially falsified it**, which is the more useful outcome.

Within-class Δ spread, from §6.1 (vs BB defend, where the error bars are tightest):

| flop | 99 | JJ | spread | intervals overlap? |
|---|---|---|---|---|
| `8h5s2d` overpair, dry | +15.07 ±1.45 | +14.06 ±0.75 | 1.0 | yes — indistinguishable |
| `Kd8s3c` underpair, dry | +0.90 ±0.87 | +0.59 ±0.65 | 0.3 | yes — indistinguishable |
| `9h8h5s` wet, two-tone | +13.16 ±0.78 | +15.07 ±1.41 | 1.9 | barely — 0.3 chips of overlap |
| **`8s8d3c` paired** | **+7.18 ±0.73** | **+5.34 ±0.82** | **1.8** | **no — separated** |

On the two dry textures the class is unambiguously one object. On the wet board the intervals
only just touch (0.3 chips of overlap), so the class is *probably* one object there and the
sweep is not powerful enough to say more. On a **paired** board it separates — and it separates in the direction a
strength bucket would get backwards: **99 prefers betting more than JJ does**, because the
whole top of that board's curve slopes the wrong way (§6.2). A bucket keyed on strength would
rank JJ above 99 and push the recommendation the wrong way by ~1.8 chips per 100-chip pot.

So the corrected verdict: AP-RL-01's cost for this class is **low on most textures and
inverted on paired boards.** The anti-pattern is not merely defensible here, it is load-
bearing on exactly the texture where a strength-ordered shortcut is most tempting. That is a
better argument for the doctrine than the negative v1 filed, and it exists only because the
review forced the board list wider.

*One texture is still untested for this: monotone flops. Sweep one before treating the above
as complete.*

### 7.4 The river check-preference — **a question, not a finding**

On every river board swept, the node-level EV surface prefers checking at *every* percentile
band below the 90th, by large margins (−62 at the bottom band), and on the flush-completed
river it prefers checking at every band without exception. Taken at face value that is a
near-zero river bluff frequency for this configuration — and unlike the flop rows, these are
exactly reproducible, so it is not noise.

Against that, the mined pool over-folds rivers: fold rates versus big sizings run **12–16pp
past bluff-breakeven** (71.5% vs pot–1.5×, 76.0% vs overbet; `mass-pool-data-2026-07-25.md`).
If the population over-folds rivers, river bluffing should be *more* profitable than
equilibrium, not less.

*Denominator note (§14.4).* Those two river cells sit inside a fold-vs-size family mined over
**10.6M decisions**, but the source does not record the per-cell opportunity count for the
two cells quoted. They are therefore usable as an order-of-magnitude counterpoint and **not**
as a rate that can be compared against the engine's surface. That is precisely why this
subsection is a question rather than a finding.

These may not conflict at all — the sizing is 2/3 pot rather than an overbet, the villain
ranges here are wide chart ranges rather than a realistic river-arriving range, and no
villain model is attached. **This is flagged as a question for someone with the depth-2 call
path in front of them, not as a defect.** It is recorded because leaving an unexplained
surface out of the write-up is how a finding gets discovered twice.

---

## 8. Playbook

Derived from the sections above; each line names what it rests on.

> **Epistemic status, so it survives being read out of context.** Items 1–6 rest
> substantially on the engine's **population prior**, which is a founder/doctrine estimate
> that has never been measured against live hands (§1.2, §3). Items 7–11 rest on the
> engine's EV surface; the flop items carry ~±1.5 chips of sampling noise, the river items
> do not (§1.2, §6). Nothing here is a measurement of a real live pool.

**Preflop**

1. **Open all three, from everywhere.** The prior ranks them #10/#6/#4 and #6/#5/#4 by
   position; nothing in the data argues with opening.
2. **Facing a premium-heavy 3-bet, they are one hand — fold or call as a class, not as
   ranks.** Equity vs QQ+/AK: 35.6 / 36.5 / 36.1, a 0.9pp span (§4.1). "It's JJ not 99" is
   not an argument against a range made of hands none of them beats.
3. **Unless the 3-bettor's range is LINEAR.** Then JJ is 45.4 and 99 is 35.2 — a 10.2pp
   split out of a range only 4% wide (§4.1). Composition, not width, is the variable. It is
   a villain property, so it belongs in the villain model, not a chart.
4. **Facing a tight 4-bet, all three fold — and so does QQ.** 27.5 / 27.8 / 27.6, with QQ
   at 27.2, vs KK+/AKs (§4.1). Four classes, one number.
5. **TT is the positional hinge.** The prior moves TT's 3-bet propensity 6× from EARLY to
   LATE while 99 barely moves (§3). If a rule has to be memorised, memorise that one.
6. **Set-mining maths: 11.76% flop, 19.18% by the river, identical for all three** (§2).
   §1.5's ~15:1 implied-odds requirement stands unchanged.

**Postflop**

7. **On a board the class beats, bet — and bet it harder than you would bet aces.** On
   `8h5s2d` the class is +12 to +15 chips into a 100-chip pot, *above* AA's +8 (§6.1). A
   middling overpair has no inducing option and no way to improve, so betting is worth more
   to it than to the nuts (§6.2). This is the least intuitive result in the study.
8. **On a board the class is under, the measurement declines to resolve it.** On `Kd8s3c`
   all of 99/TT/JJ/QQ come back UNRESOLVED or NEUTRAL — bet and check are within 2% of pot
   (§6.1). Choose on villain-specific grounds: fold-to-c-bet, board coverage, whether they
   have a checking range at all. The hand is not telling you anything, and that is a
   measured statement rather than a shrug.
9. **Percentile depreciates on the schedule in §2, not on vibes.** 99 arrives at the river
   with no overcard **6.73%** of the time; TT 13.13%; JJ 23.69%. An overpair is a claim about
   the board so far.
10. **Unimproved on the river, this class is a bluff-catcher — and this is the one number
    with no error bar.** Check is preferred by 12–20 chips into 100 on every river board and
    range tested, at percentile ~74–80 against a neutral zone sitting at ~89–95 (§6.1, §6.4).
    River output is exactly reproducible. Value-betting here is betting into the part of
    villain's range that continues.
11. **On a paired board, prefer the LOWER member.** 99 out-bets JJ by 1.8 chips on
    `8s8d3c`, with non-overlapping intervals (§7.3) — the only texture tested where the class
    separates, and it separates opposite to strength order.
12. **Multiway, the edge survives and the realization does not.** Above fair share at every
    table size (§4.2), but 88.24% of the time it is one pair. Take the flop; do not build
    the pot.

---

## 9. What would falsify this

Listed so the guide can be checked rather than believed.

| Claim | How it dies |
|---|---|
| "The class separates only against ranges containing hands it dominates" (§4.1) | A premium-heavy range (no hand between 99 and JJ in it) that still spreads the class more than ~2pp across repeated runs. Or a linear range that fails to spread it. Eight ranges were tested; the rule is induced from eight points. |
| "Exactly 1.02 percentile points apart when no member sets" (§5.4) | It is exhaustive over C(46,3) flops, so it cannot die on flops. It says nothing about turns or rivers, where the universe changes — run `parity` on 4- and 5-card boards. |
| "Neutral-zone width tracks texture, not street" (§6.3) | Sixteen board × range pairs, one pot geometry (pot 100, bet 66), one epsilon (2 chips). Vary the sizing or epsilon and the widths will move; the question is whether the *ordering* across textures survives. A monotone flop is untested. |
| **"The bet-preference curve is non-monotone at the top" (§6.2)** | Measured on two textures with non-overlapping intervals (overpair flop: AA +7.97±0.65 vs 99 +12.91±1.25; paired flop: negative top-of-range slope). It dies if the effect disappears once a villain model is attached, or if it traces to the realization asymmetry named in §1.2 rather than to inducing. **Worth attacking — it is the study's most surprising claim.** |
| **"On an underpair board the class is indifferent" (§6.1)** | Already falsified once at the old, noisier settings, which flipped TT from NEUTRAL to CHECK. It now carries measured intervals and comes back UNRESOLVED/NEUTRAL — it dies again if a further repeat puts any member cleanly outside ±ε. |
| "Bucket collapse is harmless for this class" (§7.3) | **Already partially falsified** — the paired board separates 99 from JJ with non-overlapping intervals, in the direction opposite to strength order. A monotone flop is the remaining untested texture. |
| **"Unimproved on the river, the class is a bluff-catcher" (§6.4, §8.10)** | A river villain range built by actual narrowing rather than a chart — the chart ranges used here contain hands that would never arrive at the river. Also dies if the §7.4 pool contradiction resolves in the pool's favour. |
| "The adjacent-pair boost is mis-shaped" (§7.1) | **Settled, not open.** The trace is exhaustive and reproducible (`boost` stage); the distortion cannot normalise away because no normaliser compares one rank cell to another. It would die only if `applyShowdownAnchor` or `crossRangeConstraints` changed shape. |
| "99 and JJ play identically on identical boards" | Rests on percentile parity, which is a *strength* measure and ignores blockers and range interaction. JJ blocks JJ, QJ, JT; 99 blocks 99, T9, 98. Blocker effects are **not measured here.** |
| Anything about "the pool" | All of it is the engine's prior, never measured against live hands. A live-hand sample of preflop actions with these three classes would settle §3 in either direction. |

**Not covered at all, and worth saying explicitly:**

- **Blockers and range interaction.** Nothing in this study measures them. Every
  percentile-parity → play-parity inference (§5.4, §8.7, §8.8) is conditional on their being
  second-order, which §4.1 gives reason to doubt at narrow range widths.
- **Pair vs unpaired multiway.** §4.2 compares the class only against other pairs. Whether
  99 or JJ outperforms a hand like AKs at 4- and 5-way is not answered by the committed
  harness, which carries only pair references.
- **Turn play.** Stage 6 sweeps flops and rivers. The turn — where §2's depreciation
  schedule does most of its damage — is unswept.

**The largest single gap:** this study measures strength and EV surfaces, and does not
measure *realization*. Every conclusion about multiway play in §4.2 and §8.11 leans on
POKER_THEORY §1.4 qualitatively rather than on a computed realization factor. That is the
obvious next study.

---

## 10. What the adversarial review changed

Three independent reviewers (`research-scientist`, `cto-agent`, `failure-engineer`) received
this document, the harness, and POKER_THEORY.md, with instructions to attack. Recorded here
because a review that changed nothing was either unnecessary or not adversarial enough, and
both are worth knowing.

**Two headline claims were falsified, one by re-running the script.**

1. *"Within 1.1 percentile points of each other on any board whose top card is a queen or
   better."* No stage computed this. The per-hand sweeps each enumerate a different board
   set, so they could not support a per-board claim at all. **Fix:** a new exhaustive
   `parity` stage over the boards live for all three hands. The real answer — exactly 1.02
   points, on every no-set board, at every top card — is stronger than the claim it replaced
   (§5.4).
2. *"All three land inside the measured neutral zone"* on the underpair flop. A reviewer
   re-ran the unmodified harness and TT came back CHECK, not NEUTRAL. The per-holding numbers
   carried ~±1.5 chips of run-to-run error and were being reported to 0.01 chips and
   classified against a 2-chip threshold. **Fix:** §6 now measures its own error bar over 25
   repeats and withholds a decision label when the interval cannot separate the value from
   the threshold. The claim survives in corrected form (UNRESOLVED/NEUTRAL), but it is now a
   statement the measurement can defend.

**And re-deriving §6 against corrected settings overturned its headline outright.** v1 said
the neutral zone collapses by street, comparing hull widths. On the IQR — the statistic the
review argued for — and with wet and paired boards added, a *paired flop* has a narrower zone
(1.4pp) than two of the three rivers. Width tracks board texture, not street (§6.3). The
re-run also surfaced a result v1 had no way to see, because v1 omitted the AA row its own
harness printed: **the bet-preference curve is non-monotone at the top**, and on a paired
board its top-of-range slope is negative (§6.2). The strongest single claim in this document
now comes from a section the review forced to be rebuilt.

**A self-check that could not fail.** The percentile "fast path" was asserted equivalent to
`comboStrengthPercentile` at run time. `bestFiveFromSeven` delegates to `evaluate5` for
5-card inputs, so the two were the same function — the assertion was a tautology, and the
local copy was 25% slower and missing the shipped guards. Deleted.

**The determinism caveat named the wrong sampler, in both directions.** It blamed
`weightedSample`, which is deterministic by construction. The real source is
`miniRolloutEquity`, and it is flop/turn only — river output is bit-identical. The caveat now
splits by street rather than by stage, which is where the property actually splits.

**A finding was upgraded, not softened.** §7.1 was filed as a *candidate* because the boost
might normalise away. The failure review traced it: `crossRangeConstraints` normalises per
grid cell across actions, and nothing anywhere compares one rank cell to another, so a
rank-axis distortion has no path to be removed. It also found a second-order effect — the
per-cell `coldCall + threeBet ≤ 1` cap exports the distortion into a different action. §7.1
is now CONFIRMED, with a reproducible `boost` stage and measured numbers.

**Six figures had no producer** — the turn/river decay table, one river board, the slope
values, a p25 column, an AKs multiway row, and a scope count that said 5 where the sweep did
8. Four were added as stages, two were deleted along with the claims that rested on them.

**Scope was widened where it was quietly narrow.** All boards had been rainbow, unpaired and
disconnected, and both "river" boards were the same two flops run out. Wet, paired and
flush-completing boards are now in the sweep. The primitives are also now called the way
production calls them — with a board cache and full combo enumeration rather than the
150-combo default, which was truncating a ~290-combo range.

**Three criticisms were accepted without a code fix**, and are recorded rather than silently
absorbed: the check branch carries a realization factor the bet branch does not; hero's
0.66-pot bet is compared against villain's modelled 0.50-pot bet; and `comboRealization` has
a discontinuity at equity 0.25. The first two are named in §1.2 as biases in the subtraction.
The third is an engine defect outside this study's scope and belongs in its own ticket.

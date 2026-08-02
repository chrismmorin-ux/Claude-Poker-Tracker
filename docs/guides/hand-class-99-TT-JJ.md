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
Against a narrow range they are equally indistinguishable — versus a narrow 3-bet range
(QQ+, AK — the shape §2.3 attributes to a typical live player) their equities span 0.5pp
against a ±0.7pp error bar, and independent runs disagree on the ordering.

What separates them is the **shape of the distribution, not its centre**. Mean flop
percentile moves only 84.0 → 86.3 → 88.7 from 99 to JJ. But the probability of landing
below the 75th percentile moves **26.1% → 3.5% → 2.1%** — a 12× spread. 99 is a hand that
is frequently in trouble; JJ is a hand that is rarely in trouble; and when neither is in
trouble they are, measurably, the same hand.

The practical consequence: **the class should be played as a class, and the board should be
doing nearly all of the discriminating.** On the flop the decision is regional rather than
per-combo, and §6 measures how wide that region is.

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

| Villain range | width | 99 | TT | JJ | QQ |
|---|---|---|---|---|---|
| UTG open (GTO chart) | 10% | 50.1 | 56.3 | 61.4 | 67.0 |
| CO open (GTO chart) | 23% | 60.0 | 64.0 | 67.9 | 71.4 |
| BTN open (GTO chart) | 51% | 65.0 | 68.7 | 72.4 | 75.2 |
| Live cold-caller of an open | 25% | 59.2 | 63.4 | 67.7 | 71.7 |
| Live limp/call (loose-passive) | 52% | 66.2 | 70.4 | 72.6 | 75.8 |
| **Narrow 3bet (QQ+, AK)** | **3%** | **36.3** | **36.4** | **35.9** | 40.0 |
| Reg 3bet, linear | 4% | 35.4 | 38.8 | **46.0** | 54.1 |
| Reg 3bet, polar | 4% | 47.9 | 47.6 | 48.2 | 51.6 |
| **4bet tight (KK+, AKs)** | **1%** | **27.7** | **27.8** | **27.1** | 27.2 |
| 4bet wide (JJ+, AQs+, AKo, A5s) | 4% | 38.2 | 38.5 | 41.2 | 49.7 |

*Figures are run 1. The stage was run twice; a second independent run agreed on every value
within the stated ±0.7pp, and on every **ordering** for ranges wider than ~20%. It disagreed
on the ordering within 99/TT/JJ for every range narrower than ~5% — see §4.1.*

### 4.1 The finding that matters most in this whole document

**The distinction between 99, TT and JJ exists only against wide ranges. Against narrow
ranges it vanishes — and sometimes inverts.**

- Versus a **BTN open (51% wide)**: 65.0 / 68.7 / 72.4 — a 7.4pp spread, monotone, and far
  outside sampling error.
- Versus a **narrow 3-bet (3% wide)**: 36.3 / 36.4 / 35.9 — a 0.5pp spread against a ±0.7pp
  confidence interval. **The spread is smaller than the error bar: the ordering within the
  class is not resolvable at this sample size.** An independent re-run of the same stage
  returned 35.7 / 36.7 / 36.5 — same conclusion, different ordering. Do not read a ranking
  into either row.
- Versus a **4-bet (1% wide)**: 27.7 / 27.8 / 27.1 (re-run: 27.2 / 27.4 / 27.4). All three
  are the same hand, and so is QQ. There is no version of this spot where "but I have JJ,
  not 99" is an argument.

**The instability is itself the result.** Two runs at 120,000 trials disagreed on the
ordering of 99/TT/JJ against every range narrower than ~5%, and agreed on the ordering
against every range wider than ~20%. That is a sharper statement of the finding than any
single row: against a narrow range these hands are not merely close, they are
*indistinguishable to the measurement*, and any engine path that ranks them there is
ranking noise.

This is POKER_THEORY §7.3 stated in numbers: *bucket labels are relative to the range.* The
"medium pair" bucket is a real, useful partition against a 50%-wide range and a meaningless
one against a 3%-wide range. Any heuristic that ranks these three hands without conditioning
on villain's range width is answering a question it hasn't asked.

**The one exception, and it is the exploitable one.** Against a *reg's* linear 3-bet range
(TT+, AQs+, AJs, AKo, KQs) the spread explodes: 35.4 / 38.8 / **46.0**. A linear 3-betting
range contains hands JJ dominates. A polar range does not — versus the polar version, JJ's
equity falls back to 48.2 and is again level with 99's 47.9. **So the entire value of
holding JJ over 99 against a 3-bet is a bet on villain's range being linear rather than
polar.** That is a per-villain read, not a hand-class property, and it belongs in the
villain model rather than in a preflop chart.

### 4.2 Multiway — where a 9-handed game actually lives

True N-way Monte Carlo (`handVsRangesMW`), every opponent on the stated range.

Versus **live cold-callers** (25% range each):

| | HU | 3-way | 4-way | 5-way | fair share |
|---|---|---|---|---|---|
| **99** | 58.4 ±0.7 | 39.8 ±0.7 | 30.2 ±0.8 | 23.8 ±0.8 | 50 / 33 / 25 / 20 |
| **TT** | 63.0 ±0.7 | 44.1 ±0.7 | 32.4 ±0.8 | 25.2 ±0.8 | |
| **JJ** | 68.1 ±0.6 | 49.8 ±0.7 | 37.5 ±0.8 | 29.6 ±0.9 | |
| *QQ* | *72.1 ±0.6* | *54.5 ±0.7* | *44.1 ±0.8* | *36.8 ±0.9* | |
| *AA* | *83.2 ±0.5* | *70.9 ±0.7* | *60.1 ±0.8* | *52.0 ±1.0* | |

Unlike §4.1's narrow-range rows, these gaps are **real**: 99 → JJ spans 9.7pp heads-up and
5.8pp five-way against a ±0.8pp interval, and both the values and the ordering held across
two independent runs.

All three stay **above fair share at every table size** — 99 is at 23.8% five-way against a
20% fair share. The class does not lose its equity edge multiway; it loses its *realization*
of that edge, because 88.24% of the time it is a one-pair hand that cannot bet three streets
into four opponents (§1.4, equity realization). The number to hold in mind is that 99's
edge five-way is roughly +4pp of a pot it will usually not be able to contest.

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

> ⚠️ **THIS SECTION IS BEING RE-DERIVED.** Adversarial review falsified §6.2's headline by
> re-running the harness, and established that the per-holding figures below carry ~±1.5
> chips of run-to-run error while being reported to 0.01 chips and classified against a
> 2-chip threshold. The numbers in §6.1–§6.4 are from the **old, uncorrected** settings
> (150-combo truncation, no board cache, single run) and must not be relied on until this
> banner is removed. §6.3's river figures are the exception — river output is deterministic
> and reproduced exactly. See §10.


POKER_THEORY §15.2 defines the neutral zone as `{ p : |EV(bet|p) − EV(check|p)| < ε }` and
observes that the primitives to compute it already exist but "have simply never been
joined." This section joins them: every legal holding on a board is swept, its percentile
plotted against `computePerComboEV − computePerComboCheckEV`, pot 100, bet 66, ε = 2 chips.

**Method caveat (binding, see §1.2):** these are node-level components called directly with
population defaults and no villain model. Read them as the *shape of the engine's EV
surface*, not as advice the app would give.

**Reported honestly:** the "neutral zone" below is the **hull** of in-zone combos plus their
density — not a claim that the interval is contiguous. The decile table is where the actual
sign change is read.

### 6.1 Flop, class is an overpair — `8h 5s 2d` vs a live cold-caller

| percentile band | mean EV(bet) − EV(check) |
|---|---|
| 20–30 | −29.13 |
| 40–50 | −16.81 |
| 50–60 | −5.06 |
| **60–70** | **+4.92** |
| 80–90 | +10.13 |
| 90–100 | +11.02 |

Neutral-zone hull `[0.6, 71.7]`, 53/1176 combos. Sign change between the 50–60 and 60–70
bands.

| holding | pctile | Δ | prefers |
|---|---|---|---|
| 99 | 94.2 | +11.74 | BET |
| TT | 94.7 | +11.88 | BET |
| JJ | 95.2 | +13.23 | BET |
| QQ | 95.7 | +11.01 | BET |
| AKo | 60.6 | +3.59 | BET |

All three sit ~23 points clear of the crossing. **On a board they beat, the class is a
clear, unsubtle bet, and the three members are worth +11.7 / +11.9 / +13.2 — a 1.5-chip
spread on a 100-chip pot.** They are the same decision.

### 6.2 Flop, class is an underpair — `Kd 8s 3c` vs a live cold-caller

| percentile band | mean Δ |
|---|---|
| 40–50 | −28.83 |
| 60–70 | −4.32 |
| 70–80 | −1.70 |
| **80–90** | **+1.39** |
| 90–100 | +6.68 |

Neutral-zone hull `[62.3, 90.9]` — **28.6pp wide, 144/1176 combos in zone.**

| holding | pctile | Δ | prefers |
|---|---|---|---|
| **99** | **84.5** | −1.52 | **NEUTRAL** |
| **TT** | **85.0** | −1.89 | **NEUTRAL** |
| **JJ** | **85.5** | −1.77 | **NEUTRAL** |
| QQ | 86.0 | −2.92 | CHECK |
| AKo | 96.0 | +6.93 | BET |

**All three land inside the measured neutral zone, and they land within 1.0 percentile
point of one another.** This is the answer to "how should 99/TT/JJ be played on a K-high
board" in the form §15.2 asked for: the ground is flat there. The correct play is
*regional* — whatever you do with 99 you should do with JJ — and the region is 28.6
percentile points wide, which is a measured number rather than a rule of thumb.

Slope confirms it: **0.663 chips per percentile point between the 85th and 95th** on this
board, versus **0.074** on the overpair board — the underpair board is where the ground is
actually tilted, and the class is sitting on the flat part of it.

### 6.3 River, unimproved — `Kd 8s 3c 7h 2s` vs a live cold-caller

| percentile band | mean Δ |
|---|---|
| 40–50 | −29.30 |
| 60–70 | −22.21 |
| 80–90 | −7.19 |
| **90–100** | **+2.39** |

Neutral-zone hull `[89.2, 97.4]` — **8.2pp wide, 58/1081 combos.**

| holding | pctile | Δ | prefers |
|---|---|---|---|
| 99 | 78.9 | −16.77 | CHECK |
| TT | 79.5 | −16.31 | CHECK |
| JJ | 80.0 | −14.94 | CHECK |
| QQ | 80.6 | −13.18 | CHECK |
| AKo | 89.2 | +0.24 | NEUTRAL |

### 6.4 The street-by-street result, which is the real finding here

| board | neutral-zone hull | width | where the class sits |
|---|---|---|---|
| Flop, overpair (`8h5s2d`) | [0.6, 71.7] | 71.1pp | far above — clear bet |
| Flop, underpair (`Kd8s3c`) | [62.3, 90.9] | 28.6pp | **inside** |
| Flop, straddling (`Jh9s4d`) | [27.9, 85.0] | 57.1pp | JJ above (set), TT inside |
| River (`Kd8s3c7h2s`) | [89.2, 97.4] | **8.2pp** | far below — clear check |
| River (`8h5s2d Qc 4h`) | [85.6, 94.6] | 9.0pp | far below — clear check |

**The neutral zone collapses from 28–71pp on the flop to 6–9pp on the river.** That is a
measured statement of something the engine has always asserted in prose: decisions start
regional and become pointwise. On the flop, the class occupies a wide flat region and the
individual rank barely matters. By the river the flat region has shrunk to a sliver near the
90th percentile, the class has fallen to the ~79th, and all three are on the wrong side of
it — **an unimproved 99/TT/JJ arrives at the river as a bluff-catcher, and the engine's EV
surface says so by a margin of 15 chips into a 100-chip pot.**

That is the single most actionable output of this study. It is also the thing a percentile
axis makes visible and a "medium pocket pair" label cannot.

---

## 7. Where the engine handles this class badly

The brief asked "what boosts they do poorly at." That phrase has two readings and both turn
out to be worth answering; the first is a literal mechanism in this codebase.

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

### 7.3 Where bucket collapse is *not* a problem — an honest negative

POKER_THEORY §7.3 and AP-RL-01 forbid bucket-keyed shortcuts because combos within a bucket
have variance the bucket average hides. For this class, on boards where none makes a set,
that variance is measured and it is **tiny** — 84.5 / 85.0 / 85.5 on `Kd 8s 3c`, and
conditional-on-overcard-count means within 2.2 points of each other everywhere.

So this is a case where the anti-pattern's *cost* is low. That is worth recording precisely
because it argues against over-correcting: the doctrine is right in general, and this class
is a place where a range-level treatment loses almost nothing. It is not a reason to relax
AP-RL-01 — the rule earns its keep on classes where the within-bucket spread is large — but
a study that only ever confirms its own doctrine is not measuring anything.

### 7.4 The river check-preference — **a question, not a finding**

In §6.3 the node-level EV surface prefers checking at *every* percentile band below the 90th,
by large margins (−61 at the bottom band). Taken at face value that is a near-zero river bluff
frequency for this configuration.

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
2. **Facing a 3-bet, they are one hand — fold or call as a class, not as ranks.** Equity vs
   a narrow (QQ+/AK) 3-bet range: 36.3 / 36.4 / 35.9, a spread inside the ±0.7pp error bar, and two
   runs disagreed on the ordering (§4.1). "It's JJ not 99" is not an argument against a
   range this narrow.
3. **Unless you have a read that the 3-bettor is linear.** Then JJ jumps to 46.0 and 99 stays
   at 35.4 (§4.1). This is the one spot where the class genuinely splits, and it splits on a
   *villain* property, so it belongs in the villain model, not a chart.
4. **Facing a 4-bet, all three fold.** 27.7 / 27.8 / 27.1 vs KK+/AKs (§4).
5. **TT is the positional hinge.** The prior moves TT's 3-bet propensity 6× from EARLY to
   LATE while 99 barely moves (§3). If a rule has to be memorised, memorise that one.
6. **Set-mining maths: 11.76% flop, 19.18% by the river, identical for all three** (§2).
   §1.5's ~15:1 implied-odds requirement stands unchanged.

**Postflop**

7. **On a board the class beats, bet — and stop distinguishing.** +11.7 / +11.9 / +13.2 on
   `8h5s2d` (§6.1). A 1.5-chip spread on a 100-chip pot is not a decision.
8. **On a board the class is under, you are in a measured 28.6-point-wide neutral zone**
   (§6.2). Bet and check are within 2% of pot. Choose on villain-specific grounds — fold-to-
   c-bet, board coverage, whether they have a checking range at all — because the hand itself
   is not telling you anything.
9. **Percentile depreciates on the schedule in §2, not on vibes.** 99 arrives at the river
   with no overcard **6.73%** of the time; TT 13.13%; JJ 23.69%. An overpair is a claim about
   the board so far.
10. **Unimproved on the river, this class is a bluff-catcher.** The EV surface says check by
    ~15 chips into 100, at the ~79th percentile against a ~89th-percentile neutral zone
    (§6.3). Value-betting it is betting into the part of villain's range that continues.
11. **Multiway, the edge survives and the realization does not.** Above fair share at every
    table size (§4.2), but 88.24% of the time it is one pair. Take the flop; do not build
    the pot.

---

## 9. What would falsify this

Listed so the guide can be checked rather than believed.

| Claim | How it dies |
|---|---|
| "The class is one hand against narrow ranges" | Any range under ~5% wide where the three spread more than ~2pp *and the spread survives repeated runs*. The linear-3bet case (§4.1) already spreads 10.6pp — find the boundary, don't assume it. |
| "Exactly 1.02 percentile points apart when no member sets" (§5.4) | It is exhaustive over C(46,3) flops, so it cannot die on flops. It says nothing about turns or rivers, where the universe changes — run `parity` on 4- and 5-card boards. |
| "The neutral zone narrows by street" (§6.4) | Sixteen board × range pairs were swept, all at one pot geometry (pot 100, bet 66) and one epsilon (2 chips). Vary the sizing, vary epsilon, or use a polar villain range. A monotone/paired river is the most likely counterexample. |
| **"On an underpair board the class is inside the neutral zone" (§6.2)** | Already falsified once by a re-run at the old, noisier settings, which flipped TT from NEUTRAL to CHECK. It now carries measured error bars — it dies again if a further repeat moves any member outside its stated interval. |
| **"Bucket collapse is harmless for this class" (§7.3)** | An EV board where the within-class Δ spread exceeds the noise floor. Wet, paired and monotone boards are the candidates and are now in the sweep — this claim is the one most likely to be wrong. |
| **"Unimproved on the river, the class is a bluff-catcher" (§6.3, §8.10)** | A river villain range built by actual narrowing rather than a chart — the chart ranges used here contain hands that would never arrive at the river. Also dies if the §7.4 pool contradiction resolves in the pool's favour. |
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
   the threshold.

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

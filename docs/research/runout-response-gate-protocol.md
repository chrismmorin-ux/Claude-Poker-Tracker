# WS-310 gate — runout response: run protocol

**Status:** instrument built and verified; **gate not yet run** (needs the corpus).
**Instrument:** `scripts/backtest/mine-runout-response.py`
**Sprint:** SPR-167

---

## The question

WS-310 proposes modelling a runout as a collapsing window of makeable hands, split into
a deterministic Layer A (board combinatorics) and a measured Layer B (what players do
while the window is open). Before any of that gets designed, one falsifiable claim has
to be tested:

> **On nut-changing turns, continuation drops MORE than the combinatorial change in
> range strength justifies — villains over-fold to the scare card relative to what
> their own range supports.**

Both outcomes are acceptable, and that is the point of running it as a gate:

| outcome | reading | next step |
|---------|---------|-----------|
| **Confirmed** (`dev/strong < 0`, CIs separate) | Layer B has a measured effect with a sign | design Layer A + B together, in a follow-up with its own scope |
| **Flat** (`dev/strong ≈ 0`) | the behavioural layer is thinner than it looks | Layer A alone may carry the value — cheaper build, useful answer. Record and stop |

A flat result is a real result. Do not go looking for a slice that confirms.

## Running it

The corpus lives outside the repo and is not reachable from cloud sessions, so this
has to run on the machine that holds it.

```bash
# 1. verify the instrument (no corpus needed, ~1s)
python scripts/backtest/mine-runout-response.py --self-test

# 2. run the gate
python scripts/backtest/mine-runout-response.py \
    --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
    --out out/runout-response.json --workers 12
```

The self-test runs automatically before any corpus run and **refuses to mine if it
fails** — a gate that reports numbers from a broken classifier is worse than one that
fails to start.

**Runtime knobs.** Layer A costs ~17 ms per board × denominator, and that dominates.
`--board-cap` (default 4000/class) is the runtime dial; `--sample-mod` (default 97,
≈1% of boards) controls how densely boards are sampled for Layer A. Layer B always
runs over the full corpus — it is just counting, and it is cheap. If a reported `se`
is large next to the deviation, raise `--board-cap`; otherwise leave both alone.

## Reading the output

**Layer B** is the observed continuation rate per turn class, with k/n and a Wilson
interval. Unusually for this project these counts are **uncensored** — a fold is always
in the log, so unlike `mine-intent-splits.py` this is not a "given they showed"
conditional. What is unobservable is villain's *holding* when they fold, which is
exactly why Layer A's denominator has to be declared rather than measured.

**Layer A** is the combinatorial movement the turn card caused, over the same boards.

**Deviation** is the headline, and it is a deviation rather than a frequency on purpose:

```
deviation = (B_class - B_blank) - (A_class - A_blank)
```

Differencing against the blank cell is what makes it robust — any constant bias in the
strength proxy, the range assumption, or the spot filter cancels, and only the
class-relative movement survives. Negative means over-folding beyond what the card did
to the range.

**The gate is confirmed only where `dev/strong < 0` and the class's continuation CI
excludes the blank cell.** Both conditions, per class.

### Why three metrics, and why `strong` leads

Measured on real boards while building the instrument (universe denominator, Δ vs flop):

| turn class | d(continuing) | d(made) | **d(strong)** |
|---|---|---|---|
| blank | +0.1033 | +0.1016 | **+0.0279** |
| straight | +0.3480 | −0.0473 | **+0.0705** |
| flush | +0.3123 | +0.0064 | **+0.0678** |
| pairing | +0.5714 | +0.5697 | **+0.3311** |

`continuing` (1 − air) is **inflated by an artifact**: a 4-card board mechanically admits
more 4-in-a-five-window draws than a 3-card one, so most of its movement is combos being
relabelled `draw`, not strength arriving. `made` (pair+strong) is **corrupted by
classify()'s precedence** — `draw` outranks `pair`, so a flop pair can be relabelled a
draw on the turn, which is why the straight cell goes negative. That is not a real
weakening.

`strong` (two-pair-or-better) is evaluated first in `classify()`, so it escapes both, and
it orders as the combinatorics demand: pairing a board opens boats and quads; straight
and flush cards open one new nut category; a blank opens almost nothing. All three are
reported anyway — **if the deviation's sign holds across all three, it cannot be blamed
on the choice of scalar.** The `sign consistent` column reports exactly that.

## What the instrument will not do

- **It will not take the denominator from the engine.** Both declared ranges are frozen in
  the script. Deriving Layer A from the engine's own narrowed estimate would let the model
  validate itself — FIND-038, where sizing told measured self-consistency with the engine's
  prior while the UI claimed showdown confirmation.
- **It produces no per-villain numbers.** Terminal-strength distributions are pool-level
  (Finding 14). Nothing here is persisted or boosted like a showdown anchor: showdown
  evidence is per-villain observation, this is a projection, and conflating them
  manufactures reads the data says do not exist.

## Known weaknesses — read before trusting the number

1. **The denominators both understate villain's strength.** They called a preflop raise
   *and* a flop c-bet; neither the 1326-combo universe nor the frozen BB defend range
   reflects that. The blank-turn reference differences most of it away. The residual —
   whether that understatement *interacts* with turn class — is the main threat to
   validity and is not measured here.
2. **Spot selection conditions on reaching a turn bet**, which is downstream of flop play.
   Every rate is "given this spot", never unconditional.
3. **Heads-up only.** Multiway turn dynamics differ and are excluded rather than pooled.
4. **`--board-cap` truncates** via `most_common`. Specific 4-card boards recur at
   near-uniform low frequency, so this is close to arbitrary selection — but it is a
   truncation, and `distinct_boards` in the output makes it visible.
5. **Layer B is era-fragile by construction** (HandHQ online cash, 2009 — SRC-011). That is
   the whole point of the split: Layer A does not age, Layer B does.

## Open decisions — deliberately deferred to the gate result

Both `decision_flags` on WS-310 are post-gate and should be answered against numbers,
not in advance:

1. **Does this supersede WS-303 or sit beneath it?** The hypothesis — that WS-303's
   re-narrowing problem and this share a root cause, because street-by-street filters
   compound error where conditioning one terminal window does not — is *unmeasured*.
2. **Does Layer A ship as a new primitive, or replace the bucket taxonomy?** The draw
   column running 16.0% flop → 24.2% turn → 0.0% river by construction argues `draw` is
   an unresolved *state*, not a hand class. The metric artifact documented above is
   independent evidence for the same conclusion: `draw` behaves like a placeholder that
   absorbs combos as board cards arrive, which is not how a hand class behaves.

# Five pre-registered adaptation hypotheses — 2 confirmed, 3 refuted

**2026-08-20.** Directions and thresholds committed before any number was computed. Corpus:
HandHQ 50NL July 2009, all 1,756 files. FTP (525 files) was held out — every prior number in
this line of work came from PS.

## Scorecard against the pre-registration

| # | Extra argument the rule takes | Predicted | Measured | Verdict |
|---|---|---|---|---|
| **A1** | prior encounters with *this* opponent | −1 to −3pp | FTP **−2.17pp** [−2.78, −1.60]; PS −1.72pp | **CONFIRMED** — replicates on held-out FTP |
| **A2** | size discontinuity at a min-open | **≥+2pp** above the fitted curve | raw **−13.3pp**; controlled **−0.07pp** | **REFUTED** — sign opposite, then dissolves |
| **A3** | recent steal pressure from *anyone* | ≥−1pp | pooled **−2.23pp** [−3.12, −1.34] | **CONFIRMED** |
| **A4** | a recent large loss | ≥+2pp VPIP | pooled **+0.60pp** [+0.41, +0.79] | **REFUTED** — real, ~3× too small |
| **A5** | a showdown revealing a bluff | differential beyond A1 | pooled **+1.70pp** [+0.61, +2.79] | **REFUTED** — runs backwards |

## A1c — the finding that matters most, and it guts A1

A1 was the calibration anchor. It confirmed, on held-out data, at the predicted magnitude.

**Then a permutation null took most of it away.** Scramble *which opener* each row is attributed
to, within the same (defender, table) session, preserving every row's time, outcome and open
size. The null reproduces **−1.66pp of the −2.17pp** (FTP) and **−1.31pp of −1.72pp** (PS).

**A defender's fold rate falls over the course of a session against everybody.** The
opponent-specific residual is **−0.51pp (p=.040) / −0.42pp (p=.099)** — at the edge of detection.
An independent difference-in-differences agrees: FTP −0.77pp [−2.34, +0.80], PS −1.17pp
[−2.34, −0.06].

**Consequence:** any rule keyed on *"he has raised you N times before"* is currently keyed on a
**session clock**, not on opponent memory. The effect is real; the attribution was wrong.

## A2 — a 13-point effect that was entirely composition

Raw, the min-open point sits **13.3pp below** the curve fitted on ≥2.5bb opens — the field
*under*-folds to min-raises, opposite to the prediction, and it survives a within-defender
control (−13.4pp).

It does **not** survive an opener-position control. Min-opens come disproportionately from the
small blind (**24.3%** of min-open rows vs **17.2%** of fit-range rows), and the big blind
defends far wider against the SB (~50% fold) than against the button (~57%) or early position
(~69%). Fitting separately inside each opener position leaves residuals that disagree in sign
across positions *and* across sites.

**There is no min-open kink.** Controlled: −0.07pp [−2.26, +2.13], MDE 3.14pp.

## A3 — the one that survives everything

**Recent steal pressure from anyone.** State variable: *how many times has this seat been raised
while in the blinds over the previous 20 hands.*

- pooled **−2.23pp** [−3.12, −1.34], MDE 1.27pp
- monotone across all four buckets on **both** sites — FTP 81.4 → 80.7 → 78.8 → 77.1;
  PS 80.5 → 79.3 → 77.4 → 76.6
- **survives its own falsifier.** Substituting the *next* 20 hands for the previous 20, on the
  same rows with the same estimator, collapses it to **−0.42pp [−1.25, +0.42]**. Past pressure
  predicts; future pressure does not. That is a causal-direction test, and it passed.

A1 fails the analogous test (permutation reproduces three quarters). A4 fails on magnitude. A5
fails on sign. A3 is the only one of the five left standing after its own control.

It is also computable at the table from what the tracker already records — an integer, no hole
cards, no showdown, no opponent identity, no cross-session memory. That is precisely *why* it
dodged the confound that ate A1.

## A5 — runs backwards

In pairs where the opener showed a weak hand, same-opponent erosion **disappears** (treated
+0.55pp FTP / −0.69pp PS) while matched control pairs keep it (−2.33 / −1.77pp). Seeing an
opponent turn over a weak hand is followed by folding **no less**. Differential **+1.70pp**.

"He showed a bluff, so people call him more" is refuted in this population.

## Instrument validation, run before any hypothesis was scored

| Check | Result |
|---|---|
| preflop geometry vs `decisionLabeler.mjs` | **74,858 / 74,858 rows agree exactly** on all five fields |
| `handOutcome` net vs the dropped `winnings` field | non-winners **127,788 / 127,788 exact** |
| `winnings` decoding | = contested pot − rake(contested pot); **all-zero on ~49% of hands** — unpopulated, not zero, so unusable alone |
| table sequence density | median inter-hand gap 45s / 40s; 94–98% of gaps ≤180s — "previous 20 hands" is real |

Exclusion accounting balances at every stage (counted + excluded = examined).

## What this changes

- **The villain model's adaptation argument is A3, not A1.** The pooled-slope architecture
  stands; the slope belongs on *recent steal pressure*, which is a per-villain state, not on
  *prior encounters*, which is mostly a session clock.
- **A1 is not deleted — it is re-attributed.** A ~−1.7pp within-session drift against everybody
  is itself a usable rule; it is just a different rule than the one that was staked.
- Magnitude honesty: A3 is a ~2pp shift on a ~78% base rate, a 2.5% relative move. A refinement,
  not a new axis.

## Two underpowered tests, and exactly what would resolve them

- **A2 controlled** (MDE 3.14pp): the uncertainty is *functional form*, not sample — quadratic-logit,
  linear-logit and linear-probability extrapolations to the 2bb price disagree by 6.5pp on FTP
  alone. Either ~**9.9×** the min-open sample, or — better — a corpus where 2.0–2.75bb opens are
  common, which converts an extrapolation into an interpolation and removes form uncertainty
  entirely.
- **A5 strict** (MDE 3.69pp): needs ≈**62,000 treated rows** per site against 1,166 / 3,463 today
  — 18–53× more, i.e. a ~20-million-hand corpus, or a definition of "revealed bluff" that fires
  ~10× more often without losing its meaning.

## Transfer

Online 50NL, July 2009, 9- and 6-handed ring, 671,591 heads-up hands excluded. Applied to a live
1/2–1/3 game every figure here is **transferred, not measured** — the top-ranked entry in
`docs/standard-of-record/DISCLAIMER-AND-FAULT-REGISTER.md`.

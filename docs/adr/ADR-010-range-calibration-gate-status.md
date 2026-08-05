# ADR-010: Range calibration is a standing program metric, and is PROPOSED — not adopted — as gate criterion C7

**Date:** 2026-08-05
**Status:** Proposed — awaiting founder decision on §Decision 2
**Impact:** medium
**Program:** `domain-correctness`
**Work items:** WS-293 (implements), WS-291 / WS-302 / WS-303 (the measurements this rests on)
**Supersedes nothing.** Extends `docs/domain/MODEL_READINESS_GATE.md`.

---

## Context

WS-293 makes range calibration a **standing** metric rather than a one-off probe: a Layer Probe
of the `range` layer scored against its declared ground truth `revealedHolding`, emitting a
Result Card against a versioned Deal Book and appending to
`docs/domain/readiness/range-calibration-history.yaml`.

The ticket that commissioned it also asked a threshold question, and the gate doc is explicit
that a threshold question may not be answered silently:

> **Corollary — do not edit a threshold to open the gate.** Changing a bar is a founder
> decision recorded as a decision, with its reason. Moving one silently to clear it defeats the
> entire artifact.

The argument FOR making it a criterion is that **C3 (hero-EV validated) is only meaningful if
the ranges hero's advice is marginalized over are calibrated.** Hero-EV marginalizes advice over
an inferred villain range; if that range is wrong, C3 measures the quality of advice against a
fiction and can pass while the thing it is certifying is broken. That is not hypothetical — it
is exactly what WS-291 was.

The argument AGAINST is that the gate currently has six criteria that are all scored on the same
evidence file by one script, and a seventh whose evidence lives in a different file, on a
different cadence, with a different cluster unit, adds a coupling that has to be maintained.

---

## Decision 1 — ADOPTED: range calibration is a standing program metric

Recorded and in force as of this ADR. It runs as a normal harness command, produces a Result
Card, and appends to an append-only history file so drift is visible across runs. No founder
decision is required for this half: it adds an instrument, it does not move a bar.

**Reason.** The instrument is the durable asset; the numbers decay. WS-291 was found by a probe
that existed for one afternoon, and had it not been re-run, WS-302's fix would have been
asserted rather than measured.

---

## Decision 2 — PROPOSED, NOT ADOPTED: C7 range-layer calibration

**This ADR does NOT add C7.** `BAR` in `scripts/readiness/model-readiness.mjs` is unchanged and
the gate still has six criteria. What follows is the proposal a founder decision would accept or
reject.

### Proposed criterion

> **C7 — Range-layer calibration.** The latest admissible row in
> `range-calibration-history.yaml` must show `villainDeltaLog >= 0.20` nats per decision, with
> `villainN >= 2000` and `players >= 30`.

### Why the threshold is on Δlog and NOT on coverage

**Coverage is disqualified as a gate metric.** Since WS-291's probability floor and WS-302's
preflop support weight, every live combo carries positive weight *by construction*, so coverage
is 100% whatever the range model does. The first standing run measured exactly that:
`coverageSaturated: true`, coverage 1.000 on both arms.

A criterion on coverage would therefore be a criterion that **cannot fail** — which is
`FAULT-degenerate-signal` in the Suspected-Fault Register, promoted to a gate. Δlog has no
ceiling and goes negative when a range spends its mass in the wrong place, however complete its
support.

### Why 0.20, and the honest admission about it

The first standing run measured **+0.538** (villain arm, n=3,423, 400 player-clusters). 0.20 is
proposed as roughly a third of the observed value — low enough that ordinary run-to-run variation
does not trip it, high enough to catch a regression to the pre-WS-291 regime (which measured
**−5.272**) or to the information-free regime (0.0, "every live combo equally likely").

**It is a bar set after seeing the number, and the gate doc warns about exactly that:** *"A
readiness bar defined after the fact is the same failure."* This is stated rather than hidden.
The mitigation is that the direction is not in doubt — the gap between −5.272 and +0.538 is not a
threshold-placement question — but the founder should treat the specific value 0.20 as the weakest
part of this proposal, and the honest alternative is a bar at **0.0** (the range must beat a flat
range at all), which is falsifiable, unarguable, and set by theory rather than by the observation.

---

## What a reader must know before quoting any figure from this instrument

These are properties of the measurement, recorded here because a gate criterion built on it
inherits every one. All are emitted as DATA on the Result Card, not as prose here.

1. **Every number is showdown-conditional.** Coverage is `P(covered | revealed)`. The first
   standing run revealed only **27.0%** of scoreable villain decisions, so coverage over *all*
   scoreable decisions is bracketed only to **[0.270, 1.000]**. The bracket is the population
   claim; the point estimate is not. This is `FAULT-showdown-selection`, register entry #12.
2. **The selection is action-dependent, and worst exactly where it matters.** Folds reveal at
   **0.0%** — they are absent from the measured set entirely. Raises reveal at **46.1%** against a
   27.0% base, a selection ratio of **1.71**, making the raise branch the most
   selection-contaminated slice — and the raise branch is precisely where WS-291 located the
   expensive defect. A C7 built on a pooled number would be strongest where the evidence is
   weakest.
3. **The partition is asymmetric.** The acting arm is EVAL-only; the villain arm is keyed by
   seat, never resolved to a player id, and mixes POOL and EVAL. Benign only while the villain
   range is a population chart with no per-player fit.
4. **A corpus-mined prior is scored against the same corpus.** `populationPriors` feeds the
   villain baseline. That is `FAULT-leakage-unclosed-channel` by construction.
5. **Population mismatch.** The corpus is online 6-max/full-ring, July 2009; the founder's game
   is live 9-handed 1/2–1/3. Any live claim anchored here is **TRANSFERRED, not measured** — the
   top-ranked entry of the Suspected-Fault Register.

---

## Consequences if Decision 2 is accepted

- `MODEL_READINESS_GATE.md`'s "The six criteria" section becomes seven, and the threshold is
  mirrored into `BAR` in `scripts/readiness/model-readiness.mjs` — **both, in the same change**,
  per that script's own standing comment.
- The gate gains a dependency on a second evidence file with its own cadence.
- No automated test currently asserts the gate doc and `BAR` agree. Adding a seventh mirrored
  constant makes that missing guard more load-bearing, and it should be written in the same change.

## Consequences if Decision 2 is rejected

Range calibration stays a program metric under `domain-correctness`: measured every run, visible
in history, surfaced by `/pulse`, but not blocking. Given point 2 above — the selection effect
concentrating in the raise branch — this is a defensible position rather than a lesser one.

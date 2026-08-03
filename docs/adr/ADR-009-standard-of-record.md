# ADR-009: The Standard of Record — every comparative claim resolves to a replicable Result Card

**Date:** 2026-08-02
**Status:** Accepted
**Impact:** high
**Decision log entry:** DEC-033
**Program:** `prog-strategy-of-record`
**Work items:** WS-322 … WS-333

---

## Context

The project keeps discovering that deep faults went unmeasured for long periods. WS-291 — a
falsified range model sitting on the live recommendation path — survived for the life of the
project. The mechanism was not carelessness; it was that **nothing forced two numbers onto the
same axis.** Each session invented its own instrument, its own slice, its own horizon, and its
own units, so a wrong number never had to meet a right one.

Three separate founder threads converged on the same missing object:

1. A way to declare a strategy deliberately, run it over a statistically meaningful number of
   hands, and score it — including *why* each action was chosen (equity or read).
2. A way to see the reasoning layers behind a decision, so a fault two layers down is catchable
   rather than surfacing only as "the engine said so."
3. A trusted, boring statistical baseline to attribute how much EV comes from playing well
   against the pool at all.

Investigation established that this is **not a new project**. The Five-Surface Atlas already
defines a surface exactly as the founder does — a function from game state to action
distribution — and registers five of them. All five are *observed, fitted, or imported*. None can
be **declared**. That absence is the gap.

## Options considered

1. **Build a standalone strategy-tournament harness.**
   Fastest to a first result. Rejected: it would duplicate FSA's divergence instrument, creating
   a second definition of what it means for two strategies to differ — the exact failure
   `decisionGeometry.mjs` warns about ("deriving it three times would be three chances to
   disagree about what 'the pot' means at a node").

2. **Extend FSA with a Declared surface class and make the standard repo-wide.** *(chosen)*
   Reuses the divergence instrument, the leakage guard, the partition, and the mined behaviour
   policy. Costs more up front in schema and vocabulary work.

3. **Do nothing structural; keep measuring case by case with better discipline.**
   Rejected: this is the status quo that produced WS-291. Discipline that depends on remembering
   is the thing that failed.

## Decision

**Any artefact making a *comparative* claim about strategy, model quality, or EV must resolve to
a Result Card** — a registered Surface run against a versioned Deal Book and Field, carrying a
complete replication manifest (engine SHA, corpus hash, partition, every seed, every load-bearing
constant, treatment string, cluster unit, and the disclaimer-register version it ran under).

Five commitments follow:

- **`Declared` becomes a sixth surface class in FSA.** Strategy Cards are scored by the existing
  divergence instrument. No second comparison path is permitted.
- **Two instruments, neither authoritative.** Corpus substitution (real opponents, one-decision
  horizon) and the population simulator (modelled opponents, full hand). Their *agreement* is the
  evidence; a number from one alone is a hypothesis. The simulator may not emit a total-EV figure
  until it reproduces the corpus instrument at the one-decision horizon.
- **Shape first, then floor, then workshop.** The abstractions get described and installed
  correctly before anything is built on top of them — and **every shape ships with the measurement
  that would show it is the wrong shape.** A shape claim without a falsifier is the failure mode
  this repo has recorded three times: a label asserting something the values contradict, with
  nothing checking.
- **Over-capture, but every captured field ships with a reader.** Written at capture time, in a
  standing self-check. Capture with no consumer looks like coverage and rots silently — the
  `predictionAudit` pattern.
- **Enforcement is staged behind the instrument.** The invariant ships advisory and flips to
  enforcing only when WS-322 and WS-328 land. An invariant nothing can check is worse than none.

**Grandfathering:** existing published figures are not retroactively invalid. They are inventoried
and classified conforming / reconstructible / unreconstructible; only the third class becomes a
finding.

**Proportionality:** the standard binds *comparative claims*, not every number. A debug count or
exploratory check is not a claim. The trigger is a number someone could act on or cite.

## Load-Bearing Assumptions

```yaml
assumptions:
  - id: AS-710
    type: methodological
    claim: >
      Two instruments measuring the same estimand on the same Deal Book and Field agree within
      their stated confidence intervals. Corpus substitution (real opponents, one-decision horizon)
      and the population simulator (modelled opponents, full hand) are therefore mutually
      validating rather than two independent guesses, and their agreement is what licenses any
      total-EV claim.
    falsifies_if:
      control_case: >
        The simulator is restricted to a single-decision substitution on the same slice the corpus
        instrument scores, with the same Deal Book, Field, partition and seeds — the one
        configuration where the two instruments are measuring an identical quantity.
      pass_criterion: >
        The simulator's estimate falls inside the corpus instrument's confidence interval; if it
        falls outside and the gap survives recalibrating the population model to the corpus
        marginals, the assumption is falsified and no total-EV figure may be quoted.
    revisit: "2026-11-01"
    status: proposed
    severity: critical

  - id: AS-711
    type: methodological
    claim: >
      Decisions sharing pot-odds geometry — bet-to-pot ratio, SPR band, players remaining, and
      whether the action closes — are the same decision problem and may be pooled across streets
      and positions, materially raising decisions per cell and revealing deviations invisible in
      any single street-by-position cell.
    falsifies_if:
      control_case: >
        An ablation over well-sampled geometry cells that adds street back as a dimension and
        measures whether it improves prediction beyond geometry alone — the same ablation method
        that established HIERARCHY_ORDER, run on the same decisions with sample counts reported.
      pass_criterion: >
        Street adds no material signal beyond geometry across a majority of well-sampled cells. If
        it does, pooling bought statistical power with bias and the geometry key must be split.
    revisit: "2026-10-15"
    status: proposed
    severity: high

  - id: AS-712
    type: strategic
    claim: >
      The player pool stays stable enough over a measurement window that a mined population policy
      remains a valid opponent model for the life of an anchor generation, and a usable equilibrium
      artifact — solver output with stated solver identity, stack depth and rake model — becomes
      obtainable to occupy the lower pier post.
    falsifies_if:
      watch_surfaces:
        - "population marginals (vpip / pfr / 3bet / cbet) recomputed per anchor generation and compared against the generation that seeded it"
        - "availability and licence terms of solver outputs suitable for ingestion as SRC-013"
        - "founder's own live pool composition, tracked via observed-pool accumulation as real hands land"
      trigger_event: >
        Population marginals shift beyond stated tolerance between two anchor generations, or no
        ingestible equilibrium artifact is obtainable within two quarters — leaving the lower post
        permanently unavailable and the exploitation premium uncomputable rather than merely unmeasured.
    revisit: "2027-02-01"
    status: proposed
    severity: high

  - id: AS-713
    type: empirical
    claim: >
      The 2009 online corpus supports transfer to live nine-handed claims well enough that stamping
      a transferred claim is more useful than refusing to make one, provided every transfer is
      labelled rather than silent.
    falsifies_if:
      threshold: >
        Divergence between the three Field surfaces on shared axes exceeds the margin by which any
        live-facing claim was decided — i.e. the transfer gap is larger than the effect being claimed.
      window: >
        Measured once the FSA divergence instrument can put two pools on the same axes, and
        re-measured per anchor generation thereafter.
    revisit: "2026-12-01"
    status: proposed
    severity: critical
```

## Market Dynamics

```yaml
market_dynamics:
  subsumption_risk: medium
  self_preference: ours
  durable_ground: >
    What is durable is not the measurement code but the corpus-plus-engine-plus-founder combination
    it is anchored to: a declared, enclosed strategy scored against THIS pool, with divergence
    attributed to the reasoning layer that caused it, and a replication manifest that survives an
    engine upgrade. Commercial tools can and should subsume the equilibrium half; none of them can
    hold the founder's own pool, the engine's own stack, and the history of what this project
    believed and when.
  last_reviewed: "2026-08-02"
  watch_surfaces:
    - "commercial solver tooling adding population-anchored strategy scoring with per-layer attribution"
    - "open equilibrium artifacts becoming ingestible with stated solver identity, stack depth and rake model"
    - "hand-history corpora more recent than 2009 becoming available for live or current-online pools"
  trigger_event: >
    A commercial or open tool ships declared-strategy scoring against a user-supplied pool with
    layer-level attribution, at which point building Instrument II in-house stops being justified
    and effort should redirect to ingestion.
```

## Consequences

**Accepted costs**

- Twelve work items, four of them large. This is a multi-month body of work if built end to end.
- Every measurement gains manifest overhead. Mitigated by binding comparative claims only.
- A new program (`prog-strategy-of-record`) rather than a slot in `domain-correctness`, which is
  at 92 items against a cap of 60 — anything filed there would be priority-floored and never
  compose into a sprint.

**Naming resolved**

- `MDA` is retired for the mass-data pool: it already means Market Dynamics Analysis in the
  governance layer. Canonical is **Mass Data Field (MDF)**, SRC-012 raw / SRC-011 aggregates.
- `surface` keeps FSA's meaning in measurement code; the UX meaning stays scoped to
  `docs/design/surfaces/`. No third meaning is permitted.
- **Geometry cells may be named as vocabulary and never branched on as inputs.** A name for a
  geometry cell used as a decision input is `if (position === 'EP')` in new clothes.

**Follow-up**

- WS-333 (derived floor + geometry normalization) is upstream and has no blockers.
- WS-322 (vocabulary + schemas) blocks most of the rest.
- WS-329 flips the invariant from advisory to enforcing — a recorded decision, not a silent edit.
- The equilibrium pier post stays **unavailable**, not faked. Until a real solver artifact exists,
  the exploitation premium reports "lower post unavailable" rather than substituting published
  chart strings (FSA Finding F3).

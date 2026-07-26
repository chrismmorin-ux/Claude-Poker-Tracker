# Synthesis — what today's work produced, what it missed, what to do next

Date: 2026-07-26 · Companion to `engine-backtest-baseline-2026-07-26.md` (WS-273)
and `player-archetypes-empirical-2026-07-26.md` (Parts 1–9).

## There are two products here, and conflating them is the main risk

**1. An instrument.** The WS-273 harness replays held-out hands through the real
engine and scores its predictions. Baseline: **1.69% lift, 52.2% accuracy vs 43.1%**
over 10,147 decisions, leakage-guarded. This is **era-proof and reusable** — it
measures whatever the engine does today, and it is the only asset here that does not
decay.

**2. A pile of 2009 observations.** Bluff shares, line coverage, archetype centroids.
Part 9 ranks these fragile-vs-robust. Most of the *frequencies* are era-stamped; the
*structural constraints* are not.

Everything below keeps those separate.

## What is directly actionable

| # | Action | Evidence | Cost |
|---|---|---|---|
| 1 | **Test `DECAY_HALFLIFE = 50`** | 95% of players stationary (F7); decay discards their evidence and worsens starvation | one constant, one harness run |
| 2 | **Wire pool priors into the predictor** | Reference tier provably cannot reach it (F4) — the whole WS-262/263 mining currently moves only confidence bars | small; seam exists |
| 3 | **Track c-bet composition, not frequency** | 52% of c-bets are one pair (F13); frequency has near-zero individual variation (F11) | medium |
| 4 | **Line-presence reads** | presence informative / absence not (F15); bold lines predict bold lines 1.6× (F17) | small |
| 5 | **Re-weight Reference staleness per stat** | era drift is not uniform — VPIP stable, bluff rates not (P9) | small |

Item 1 is the cheapest real win available and has a prediction on record.

## The structural findings that survive era drift

Three independent methods — raw frequency (F5), across-player variance (F11), and
showdown availability (F14) — converged on one wall:

> **The most diagnostic behaviours are the rarest.** One player in 59,700 has 30+
> shown flop check-raises. Per-villain intent reads do not exist.

Two routes around it were proposed. One is **refuted**: inference does not jump
across skill families (F19, tested on the full population, not the restricted one).
One **survives**: pooling at archetype level, and inference *within* a family.

That is the single most important carry-forward, and it is era-independent.

## What we did NOT look at, ranked by how much it matters

**1. Hero's side. We never measured whether the ADVICE is good.**
Everything today measured villain *prediction*. The product's purpose is surfacing
exploitative plays. A perfectly calibrated villain model behind a broken game tree
still loses money. **We have no measurement of recommendation quality at all.**

**2. Money. The loop to EV is still open.**
The bb/100 bridge was withdrawn as unreliable. So we cannot answer "is 1.69% lift
worth anything?" — which means we cannot prioritise any of the five actions above
against each other. Everything is currently ranked by intuition.

**3. Live data. Zero hands scored.**
`predictionAudit` is wired end-to-end and has never run on a real session. Every
number in both documents is 2009 online. The 17-year gap (P9) means the whole study
could be inapplicable to a live 1/2 game and we would have no way to detect it.

**4. Board texture — barely touched.**
Texture is 3 buckets (dry/medium/wet) and we never asked whether that partition is
right. It is also the discriminator WS-278 depends on for protection-vs-value, and
F13 says half of all c-bets sit in that ambiguous class. Clustering boards
empirically is the obvious unrun experiment.

**5. Multiway.**
Equity denial is worth more multiway (POKER_THEORY §3.4.1) and the engine's
heads-up-derived formulas understate it. We sliced by players-in-pot but never
studied it. Founder has work in flight here.

**6. Position.**
The seat embedding and 5-category position model were used throughout and never
validated.

## How this collapses into learning and application

**The honest shape of it:**

- We built a **thermometer** and confirmed it works.
- We used it to find that the engine is **modestly better than guessing** (1.69%).
- We found the **binding constraint** (rarity/starvation) and confirmed it three ways.
- We refuted one proposed escape and kept one alive.
- We have **no idea what any of it is worth in bb/100**, and **no live data**.

**Therefore the next three moves, in order:**

1. **Close the money loop.** Until a prediction improvement converts to bb/100,
   every priority call here is guesswork. This unblocks all ranking.
2. **Get live hands scoring.** One session through the predictionAudit readback tells
   us whether the 2009 structure transfers at all. Cheapest possible answer to the
   largest open risk.
3. **Then** pick from the actionable list — starting with the decay constant, which
   is a one-line change with a recorded prediction.

**What NOT to do next:** more corpus archaeology. Today produced nine findings from
one dataset, and Part 9 says most of the interesting ones are era-stamped. The
marginal value of the tenth 2009 finding is low compared with the first live hand or
the first bb/100 number.

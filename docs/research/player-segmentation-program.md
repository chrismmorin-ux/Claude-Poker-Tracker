# Player Segmentation — where the EV actually comes from

**Status:** charter, 2026-08-16. Founder-originated.
**Program:** prog-domain-correctness / prog-strategy-of-record
**Corpus:** HandHQ PHH, online 2009, 50NLH (SRC-012). The founder's game is **live 9-handed
1/2–1/3** (SRC-014). Every figure here is *transferred, not measured*, for live play.

## The thesis, in the founder's words

> Poker is almost a zero sum game, so 9 players at a table and money flowing means it's coming
> from losing players, and we are not at a solver equilibrium. [...] Some portion of these
> players are negative EV in the long run, that's a steady stream of exploits and EV for a good
> player. [...] The winning strategy is going to be nuanced, and over aggregating things will
> make us miss things.

The engine currently reports one EV number against an undifferentiated pool. If the pool
contains a competent half and an exploitable half, that single number is an average over two
populations with different answers, and it hides both. This program segments the pool, then
re-reads every EV claim per segment.

## The methodological rule this program establishes

**An aggregate null does not disqualify a strategy.** A flat aggregate is consistent with
strong, opposite-signed sub-channels. Before any axis, strategy, or channel is abandoned on a
null result, its conditioned children must be tested and must also have failed.

Enforced in code rather than documented: `separabilityVerdict`'s `not-beyond-control` states in
its own reason string that it is a verdict about the *aggregate, unconditional* axis, is not
terminal, and that the axis may be abandoned only after its children fail
(`scripts/backtest/separability.mjs`). This is the reciprocal of the WS-320 defect — that one
let a claim through on a comparison never made; this one stops a *retraction* on a test never
run.

---

## §1. What the corpus actually supports — measured 2026-08-16, not assumed

Verified against `C:/Users/chris/data/phh-dataset/data/handhq` (1,756 files).

| Requirement | Status | Evidence |
|---|---|---|
| Stable player identity across hands/sessions | **YES** | `players = ['T/N22IhM3qrx…']` — obfuscated but stable hashes |
| Table identity | **YES** | `table = 'ZKLubky3hYGubv3nwzXIHA'` |
| Session boundaries | **YES** | `day` / `month` / `year` / `time` per hand |
| Per-hand player linkage | **YES — 96.3%** | 30,716 of 31,899 player-hand rows link to the next hand at the same table (155 tables, 5,976 hands) |
| Per-hand net won | **NO — must be derived** | see below |

### The two obvious instruments are both wrong

**`winnings` is unusable alone.** Populated on only 36.3% of hands (34,918 scanned), and the
absence is *structured*, not random — it rises monotonically with table size:

| Table size | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|
| % populated | 0.0 | 4.8 | 21.0 | 33.8 | 42.4 | 46.2 | 49.9 | 53.7 |

Filtering to populated hands is therefore a selection on table size, which correlates with
everything this program cares about. *A hypothesis that it tracked showdowns was tested and
**refuted**: zero-rates are 61% at showdown vs 63% without.*

**Cross-hand stack deltas are contaminated by rebuys.** The linkage works (96.3%), but the
deltas over the sample sum to **+$5,744.55**. In a rake-taking game the sum across all players
must be *negative*. Reloads read as wins, so this instrument would label reloading losers as
winners — inverting the exact classification the program exists to make.

### The instrument to build

Derive net won from **each hand's own accounting**: amount committed (already tracked in
`phhAdapter`) against pot collected, with the winner recovered from the action sequence
(uncontested pots are fully determined by the folds; showdowns by the `sm` show actions).

**Falsifier, and it is a known-answer anchor:** summed across all players in a hand, net won
must equal **−rake**. Any accounting error fails this check loudly. No downstream work proceeds
until it passes on a full corpus pass.

---

## §2. Selection — why the naive version measures nothing

Labeling a player a winner by stack delta and auditing their behavior **in the same hands** is
circular: with 9-handed variance, that label is mostly noise, so the audit returns "what do
players who ran hot do," and the answer is "they were dealt better cards." This is the founder's
own standing rule — a tail always exists; selecting it and reporting its mean looks convincing.

Two structural protections, in order:

**A. Reliability gate (must run first, and may kill the program).**
Split each player's hands in half. Does first-half win rate predict second-half win rate? The
split-half machinery already exists (`splitHalfReliability` in `separability.mjs`); this points
it at the win-rate label rather than at a behavioral axis.

*Pre-registered:* if reliability is **≈ 0** at the available hands-per-player, "winning player"
is not a measurable trait in this corpus, and every segmentation result downstream is noise. That
outcome is a real finding and gets recorded as one — it does not get worked around by picking a
looser label.

**B. Invert the question.** Rather than "what do winners do," ask **"which behaviors predict
winning, out of sample"** — behaviors measured on sample A, win rate scored on held-out sample B.
This removes the selection problem entirely and puts the noise on the *outcome* side where it
belongs, rather than on the *label* side where it propagates. It also produces the deliverable
directly: a ranked list of behaviors with EV attached.

---

## §3. Rake makes "loses money" and "plays badly" different populations

At 2009 50NL the rake is large enough that the median player loses without a single behavioral
defect. A winner/loser split that is not net of rake will classify competent break-even players
as fish and send the engine hunting for exploits that are not there.

The founder's framing — *"the only thing being for sure is the rake"* — understates it. Rake is
not merely the one certainty; it is the term that makes the naive split *wrong*.

---

## §4. Sequence

Each stage gates the next. Stage 1 can end the program, which is why it is first and standalone.

| # | Stage | Gate to proceed |
|---|---|---|
| 1 | Net-won accounting + reliability gate | per-hand net sums to −rake; split-half reliability of the win-rate label is distinguishable from 0 |
| 2 | Behavior → win-rate regression, out of sample | at least one behavior predicts held-out win rate |
| 3 | Segment the Deal Book by villain type; re-read engine EV per segment | per-segment EV differs from the pooled figure |
| 4 | Table composition (fish count, aggressor seating, position relative to them) | powered cells exist — measured, not assumed |

**Stage 4 is where the founder's question lives** — *"maybe the best results come from 2
aggressive players and it's best to be on their left"* — and it is the most power-hungry, since
it multiplies cells against a fixed corpus. Same discipline as everywhere else here: measure
observations-per-player per cell *before* running, carve subclass grids from the parent with
shrinkage toward it, never build a cell independently.

**No labels as inputs.** "Fish", "winner", "aggressive" are *outputs* of measured behavior
deviation, never categories fed into a decision. This program is a large new supply of
label-shaped inputs, and every one of them belongs in the WS-445 ledger with its data foundation
named.

## §5. What this is not

Not a claim that any segment is profitable to exploit. Every comparative figure produced here
resolves to a Result Card against a versioned Deal Book, or it is not a claim (ADR-009).

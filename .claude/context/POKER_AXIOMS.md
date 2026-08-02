# Poker Axioms — the forces, and what they predict

**Status:** live register · **Created:** 2026-08-01 · **Companion to:** `POKER_THEORY.md`

---

## Why this file exists

`POKER_THEORY.md` §7 tells the engine *not* to use labels as decision inputs — "a player in EP
doesn't fold more because they're in EP." It never enumerates the causes it is deferring to.
`system/constraints.md`, whose stated job is "assumptions that bound this project, periodically
re-verified," has been an untouched scaffold template since April.

So the repo has **modelling discipline without a stated foundation**. This file is the
foundation: the primitive forces of the game, each with the consequences it produces and the
predictions it makes.

## The contract — what makes an entry an axiom rather than an opinion

**Every axiom must make at least one prediction that can be scored against the corpus.** An
axiom that predicts nothing is prose and does not belong here. This is the same falsifiability
contract POKER_THEORY §11.9 applies to the teachable model: a claim that cannot be scored is
not knowledge, it is authority.

Corollary: **an axiom's failed prediction is more valuable than its confirmed one.** The
`Challenge` field stays open by default. The upper surface is meant to be exposed.

### Field schema

| Field | Meaning |
|---|---|
| **Mechanism** | The causal chain. Why the force exists, in game-state terms — never a label. |
| **Consequences** | What the mechanism produces, stated so a human can recognise it at the table. |
| **Predictions** | Numbered, each independently scoreable against the hand corpus. |
| **Falsifier** | The single prediction whose failure would break the *mechanism*, not just a downstream consequence. |
| **Scope / limits** | Where the axiom stops applying. |
| **Provenance** | Where the claim came from. See the provenance rule below — this is a gate, not a citation. |
| **Status** | `unverified` · `supported` · `partially refuted` · `refuted` |
| **Challenge** | `open` until someone has genuinely tried to break it. |

### The provenance rule (founder, 2026-08-01)

> "We haven't validated your advice as sound yet, so self-generated axioms are a bad idea."

Correct, and it applies to this file's own first draft. An axiom asserted by the assistant from
its own prior is an **unvalidated assertion wearing the costume of a foundation** — the exact
authority-not-knowledge failure this register exists to prevent.

| Provenance | May be registered? |
|---|---|
| `founder` | Yes — the practitioner's own reasoning is primary evidence about how the game is played. |
| `external-analyst` (named source) | Yes — an attributable third-party claim is a testable hypothesis with an owner. |
| `measured-here` | Yes — derived from a corpus measurement in this repo, with the run cited. |
| `derived` | Yes — an exact result from a solvable model, **with the derivation shown inline so a reader can check it**. Admissible without a corpus: the proof *is* the evidence. A conclusion quoted from memory without its derivation is `assistant-asserted`, not `derived`. |
| `assistant-asserted` | **No.** May be *nominated* to the candidate list, never registered. It must first acquire external provenance or a measurement. |

**Why `derived` matters more than it looks.** The corpus is stale *and* mixed-table-size (see
caveats below), so empirical scoring is compromised for 9-handed claims until re-stratified.
Toy-game derivations do not depend on the corpus at all. Right now they are the *more* reliable
channel, not the lesser one — and they also give ground truth for testing the engine itself: if
the engine cannot reproduce a game with an exact answer, that is a bug, with no sampling
argument available.

The assistant's role is to **formalise and test**, not to originate. Its useful contribution to
sourcing is vocabulary and framing coverage — the various ways a spot is discussed — not the
truth of the claim.

### The no-result protocol (founder, 2026-08-01)

> "We should be suspicious of no-result tests."

When a claim from a **well-researched source** tests null, the null is the *less* likely
explanation. Before recording `refuted`, rule out in order:

1. **Underpowered** — is n sufficient? State the median per-unit sample.
2. **Mis-specified** — does the test operationalise what the claim actually says?
3. **Instrument broken** — does the measurement *structurally* observe the thing?
4. **Dominated space** — is the model already capturing the effect by another route, so there is
   no incremental signal left to detect?
5. **Partial implementation** — the pool may implement the concept *imperfectly*, so the effect
   is present but attenuated. Attenuated ≠ absent.

Only after all five does `refuted` apply. Otherwise record `inconclusive` with the reason.

**Precedent, from this repo, 2026-07-31.** The A4 arm returned a result bit-identical to its
baseline — a textbook "no effect." It was an instrument defect: the probe observed villain
actions from inside a hero-decision callback, which structurally *cannot* see a street-closing
check, so `check-back` collected n=0. Had the null been accepted, we would have recorded "the
position split doesn't help" as a finding. It took an exact-float-equality guard to catch it.
**Reason 3 is not hypothetical.**

Outcomes are not binary. `supported` · `attenuated` · `residual effect only` · `correlated but
not causal` · `inconclusive` · `refuted` are all legitimate results.

### Corpus caveats that apply to every entry

**1. It is seventeen years stale.** July 2009, 50NL, two sites (`FTP` / `PS`). Structural
game-theoretic predictions are scoreable. Anything of the form "this is how the pool plays
*now*" is **not**. State which kind a prediction is before scoring it.

**2. IT POOLS 6-MAX AND 9-MAX (2026-08-01).**

*Corrected same day.* An earlier version of this caveat claimed the corpus was two-thirds
heads-up and that all measurements were contaminated. **Wrong** — it read the corpus directory
instead of the ingestion path. True 2-seat hands exist in the raw files but are skipped outright
at `phhAdapter.mjs:268` (`SKIP_REASONS.HEADS_UP`), and have been since WS-273. **No heads-up
hand has ever reached a measurement.**

The surviving confound: the ingestion path admits **3–9 players**, and §11.7–§11.9 never
separated 6-max from 9-max. This app targets 9-handed play; the two are not interchangeable.

**Standing requirement:** any run scoring an axiom must **stratify by table size and report per
stratum**, or filter to the target game and say which. A pooled 6-max/9-max number is not
admissible evidence for a 9-handed claim. Table size is recoverable per hand
(`hand._backtest.dealtIn`), so this is a filtering fix, not data loss.

**Lesson worth keeping, since it cost a false alarm:** *what is in the corpus* and *what reaches
the measurement* are different questions. Check the ingestion path, not the directory listing.

**Status (2026-08-01): §11.7 has now been re-run stratified and HOLDS in all four cells**
(2 sites × {6-max, 9-max}). Narrowing a check costs −0.16 to −0.18 everywhere; the shipped
`check = 1.0` recovers 61–75% of the available gain everywhere. §11.8 and §11.9 have **not**
been stratified — their magnitudes are still pooled-population numbers.

### One-site results are hypotheses, not findings

Three claims this session were asserted from a single site and then **contradicted by the
second**: the trap amplitude, the check-back medium-weighting, and a bet/table-size effect.
None were sloppy measurements — each was a real number on a real sample that simply did not
replicate.

**Rule for this register: a prediction scored on one site is `inconclusive`, never `supported`.**
Two independent sites agreeing is the minimum bar for `supported`. This is cheap to satisfy —
both sites are already in the corpus — and it would have caught all three.

**Terminology, fixed to prevent the confusion that surfaced this:** *heads-up game* = a
two-seat table. *Heads-up pot* = a pot contested by two players at a larger table. They are
not interchangeable, and a prediction must say which it means.

---

## AX-001 — Acting first is a structural disadvantage

**Source:** founder, 2026-07-31 (verbatim reasoning, transcribed and formalised)
**Provenance:** `founder`
**Status:** `unverified` · **Challenge:** `challenged — falsifier withdrawn, mechanism has an
unbounded-force gap (CH-001)`

> **Mechanism gap, unresolved (CH-001 A5).** The Mechanism below models the OOP player as a pure
> responder who "must resolve bluff-or-not with no further information." **That is false: the
> check-raise exists.** L3's own success creates its counterweight — the more the IP player
> bluffs after a check, the more profitable OOP's check-raise becomes, which bounds the
> asymmetry. As written, the axiom states a force with no equilibrium bound. It needs one before
> it can be called correct, not merely directionally right.

### Mechanism

The player who acts second observes the first player's action *before choosing their own*.
Inaction (a check) is weak evidence of weakness, so the second player's bluffing frequency
rises conditional on having seen it. The first player must then resolve bluff-or-not-bluff
with no further information available to them. Fold equity therefore accrues **asymmetrically**
to the player in position — not because of a seat label, but because information arrives in an
order, and the later arrival is strictly more informed.

This is a game-theoretic force with a magnitude, not a heuristic.

### Consequences

- The out-of-position player **realizes less than their raw equity share**; the in-position
  player realizes more.
- **Pot control is unavailable to the first actor** — they cannot size in response, only be
  responded to.
- Marginal hands lose disproportionately more value OOP than strong hands do, because their
  value depends on cheap showdowns, which the second actor can deny.

### Predictions (scoreable)

1. **P1 — Opening frequency rises monotonically with closeness to the button.** Measurable
   directly as open/VPIP rate by seat. *(structural)*
2. **P2 — The BB defends wider than any other out-of-position seat, and the driver is PRICE,
   not seat order.** Discriminating: BB defence should track the pot odds offered rather than
   position-in-order. If BB defence scales with position rather than price, the mechanism is
   mis-attributed. *(structural)*
3. **P3 — Offsuit broadways exit opening ranges faster than raw equity predicts as
   players-behind increases.** Domination risk compounds with OOP realization loss.
   *(structural)*
4. **P4 — Conditional on the OOP player checking, the IP player's bet frequency exceeds their
   unconditional bet frequency.** *(structural)* — **WITHDRAWN as falsifier by CH-001. Defective
   on two counts: the denominator pools nodes where betting is not even legal, so action
   legality alone can satisfy it; and it scores BET frequency where the mechanism claims BLUFF
   frequency, so pure value betting satisfies it. Compounded by the c-bet confound — IP is
   usually the preflop raiser, so "bet after a check" is largely range advantage, a different
   force.** Do not score P4.
5. **P5 — Equity realization for the OOP player falls below their raw equity share, and above
   it for the IP player, in otherwise-matched spots.** *(structural, hardest to measure)*

**CH-001 annotations — read before scoring anything above:**
- **P1 is over-determined and carries no evidential weight.** Preflop fold-through is `p^k` in
  players behind against fixed dead money; that alone produces range-widening toward the button
  with **no postflop information asymmetry whatsoever**. P1 confirming tells us nothing about
  this axiom.
- **P2 can never confirm this axiom** — the entry itself names *price* as its driver, which is a
  different force (candidate AX-006?). Keep P2 strictly as a discriminator; never score it as
  support.

### Falsifier — DISPUTED (CH-001)

**P4 is withdrawn.** See the annotation above.

**Proposed replacement — P4′ (`assistant-asserted`, PENDING FOUNDER RATIFICATION; do not score
until ratified):**

> Heads-up flop nodes where betting is legal for both players, stratified by the actor's own
> equity quintile against their opponent's range and by preflop role. **IP's bet rate in the
> bottom equity quintile (air) exceeds OOP's bet rate in the bottom quintile on the same board
> class, and the excess survives when IP is the preflop CALLER** (no range advantage).
> **Refuted if** the q1 excess is ≤ 0 on both sites, or exists only in the preflop-raiser
> stratum.

Why it is better: it isolates *bluffing* rather than betting, holds hand strength fixed via
quintile stratification, equalises action legality across both terms, and strips the c-bet /
range-advantage confound by requiring the effect to survive in the preflop-caller stratum.

**Pre-commit requirement (CH-001 A8):** the refutation threshold must be fixed in writing
*before* the run. The Scope note's "assumes opponents act on the information" is otherwise an
unfalsifiability leak — any failure could be re-described as pool passivity. Also report the
heads-up share of corpus flop decisions, since the multiway exemption may silently gut power.

### Scope / limits

- Stated for a two-player decision. **Multiway changes the force**: with several players
  behind, the last actor's advantage is diluted across more unknown hands, and equity denial
  becomes worth more than information (POKER_THEORY §3.4).
- Assumes opponents **act on the information** they receive. Against a player who bets a fixed
  frequency regardless of what they observed, the mechanism is inert — the asymmetry exists
  but nobody exploits it.
- Says nothing about magnitude. "OOP is worse" is the claim; *how much* worse is what P1–P5
  are for.

### Related

POKER_THEORY §1.4 (equity realization), §7.2 (position labels are proxies, not causes),
§11.8 (measured: check-back caps to 10.3% strong vs 34.3% for an OOP check — an empirical
footprint of this asymmetry).

---

## AX-D01 — The half-street AKQ game: exact bluffing, calling, and the price of the betting right

**Provenance:** `derived` — von Neumann's poker model, developed as the AKQ game in Chen &
Ankenman, *The Mathematics of Poker*. **Re-derived here rather than quoted**; the derivation is
below so it can be checked.
**Status:** `derived — exact` · **Challenge:** `open`

### Setup

Deck of three cards `A > K > Q`, one dealt to each player, six equally likely deals. Pot = 1.
**Only the in-position player may bet**, size `s` as a fraction of pot; the out-of-position
player may only call or fold. Best card wins at showdown.

### Solution (derived)

IP bets `A` always (betting weakly dominates), **checks `K` always** — betting `K` is called only
by `A`, which beats it, and folds out only `Q`, which it already beats — and bluffs `Q` at
frequency `b`. OOP calls `A` always, folds `Q` always, calls `K` at frequency `c`.

**IP indifferent with Q.** `EV(bet) = f·1 + (1−f)(−s) = 0 ⟹ f = s/(1+s)`, where `f` is the
probability OOP folds. Holding `Q`, IP faces `A` (½, always calls) or `K` (½, folds w.p. `1−c`),
so `f = ½(1−c)`:

    ½(1 − c) = s/(1+s)   ⟹   c = (1 − s)/(1 + s)

**OOP indifferent with K.** Calling costs `s` to win `1+s`: `q(1+s) = (1−q)s ⟹ q = s/(1+2s)`,
where `q = P(IP holds Q | IP bet) = b/(1+b)`:

    b/(1+b) = s/(1+2s)   ⟹   b = s/(1+s)

| quantity | exact value | at s = ½ | at s = 1 (pot) |
|---|---|---|---|
| IP bluff frequency with `Q` | `s/(1+s)` | 1/3 | 1/2 |
| OOP call frequency with `K` | `(1−s)/(1+s)` | 1/3 | **0** |
| bluff share of IP's betting range | `s/(1+2s)` | 1/4 | **1/3** |
| value : bluff ratio | `(1+s) : s` | 3 : 1 | **2 : 1** |

**Cross-check against existing doctrine.** `s/(1+s)` is POKER_THEORY §6.3 (bluffer's breakeven
fold frequency) and `s/(1+2s)` is §6.2 (caller's required equity). Both fall out of this
derivation independently — the repo's formulas are confirmed, not assumed.

### The price of the betting right

Check-down baseline: IP wins 3 of 6 deals ⟹ EV = ½ pot. With the betting right, gain over
baseline is

    (1/6)[ c·s − b·s + b(1−c) − b·c·s ]

| s | gain |
|---|---|
| ½ | **1/36 ≈ 0.028 pot** |
| 1 (pot) | **exactly 0** |

**Position's value is small, and non-monotonic in bet size.** At a pot-sized bet it is *exactly
zero*: `c = 0`, so value bets never get called and the bluffs break even by construction. This
is a derived, checkable fact, not an intuition.

### What this does to AX-001 — the reason it was derived

1. **CORRECTION (founder, 2026-08-01) — do not mistake AKQ for poker.** An earlier draft of this
   entry claimed "the half-street game IS AX-001's link L4." **That was wrong, and it
   over-mapped the toy game onto the axiom.** The half-street game strips the out-of-position
   player of **two** options, not one: they cannot check-raise (L4), *and they cannot bet first
   at all*. In real poker the first-to-act player chooses from `{bet, check}` — leading out is
   available, and this app's game is 9-handed where that matters.

   The consequence is sharper than the original claim. AX-001's mechanism reasons about the
   branch where OOP has checked — but in real poker **that check was selected from a menu, not
   forced**. A chosen check carries selection information that a forced check cannot, so the
   toy game cannot characterise AX-001's mechanism at all. It characterises a sub-branch with
   two of OOP's options deleted.

   This is plausibly related to §11.8's measured asymmetry between a check-back and an OOP
   check: they differ partly because the menus differ. **Treat any AKQ result as constraining
   structure within its own game, never as evidence about what a real OOP check means.**
2. **It bounds the axiom's magnitude claim.** Even with the betting right handed to IP *for
   free*, and OOP forbidden from raising, position is worth ≤ ~0.03 pot here and exactly 0 at
   pot-size. AX-001 asserts a force; this says the force is small in the model most favourable
   to it.
3. **It does NOT yet supply A5's equilibrium bound.** That needs the **full-street** game, where
   OOP may check-raise. **Not derived here — do not quote a full-street result from memory.**
   Next derivation.

### Engine conformance tests (ground truth, no corpus required)

The engine should reproduce this exactly. Failures are bugs, with no sampling defence available.

- **E1** — bluff frequency for the worst hand = `s/(1+s)`.
- **E2** — bluff share of the betting range = `s/(1+2s)`; **1/3 at a pot-sized bet**.
- **E3** — **the middle hand is never bet.** Cheapest test in the set; a single violation is a
  proof-level defect.
- **E4** — computed value of position = 0 at `s = 1`, positive for `s < 1`.

### Scope / limits

Three cards, one street, no draws, no card removal, fixed pot, betting right granted rather than
contested. It constrains *structure* — who bluffs, who calls, in what ratio — not magnitudes in a
9-handed game. Do not port the numeric frequencies to real play; port the **relationships**.

---

## Candidate axioms — named, NOT yet registered

Forces the codebase already leans on without ever stating. Listed so the register's own
coverage gap is visible. **None of these are doctrine until they are written out in full with
predictions and a falsifier.**

Split by provenance, because the two halves are not equally admissible.

**Measured here — eligible for registration once written out in full:**

| ID | Working title | Measurement |
|---|---|---|
| AX-004? | Evidence from one player about one hand is correlated, so reads do not multiply | §11.7 — chained narrowing decayed +0.52 → +0.18 |
| AX-005? | Aggression carries more information than passivity | §11.9 — raise swings ~12:1 strong-vs-weak, bet ~1.9:1, both sites |
| AX-007? | A player cannot be read faster than evidence accumulates | §11.8 — ~30 qualifying spots needed, ~2 available |

**Assistant-asserted — NOT eligible.** These are the assistant restating conventional theory
from its own prior. They are recorded only so the gap is visible, and must acquire founder or
named-external provenance, or a measurement, before they may be registered. Do not treat their
presence here as endorsement.

| ID | Working title | Gestured at in | Blocked on |
|---|---|---|---|
| AX-002? | Equity you cannot realize is not equity | §1.4 | provenance |
| AX-003? | A range is the unit of decision; a hand is a sample from it | §1.1 | provenance |
| AX-006? | Fold equity is a function of pot geometry, not fold frequency alone | exploitEngine/CLAUDE.md | provenance |

## Challenge log

Append refutations, partial refutations, and measured magnitudes here. An entry that has never
been challenged is not "settled" — it is untested.

| Date | Axiom | Attack | Result | Provenance |
|---|---|---|---|---|
| 2026-08-01 | AX-001 | **CH-001** — full mechanism challenge, `/axiom challenge` | **AX-001 is `challenged`, not `survived`.** Falsifier P4 withdrawn (over-determined twice); P1 shown over-determined; P2 demoted to discriminator-only; L4 of the mechanism shown false (check-raise); scope note identified as an unfalsifiability leak. Status stays `unverified` — nothing was run. | mixed, see below |

### CH-001 — detail (2026-08-01)

**The mechanism, decomposed into separable links** (so the weak one is visible):

| Link | Claim | State |
|---|---|---|
| L1 | Order exists — the second actor observes before choosing | definitional, carries no content |
| L2 | An OOP check is evidence of weakness | **measured** — §11.9 check-OOP LR 0.79/0.76 on strong, both sites |
| L3 | The second actor *conditions on it* — bluff frequency rises given a check | **load-bearing and UNMEASURED** |
| L4 | The first actor cannot resolve bluff-or-not; no counter-information arrives | **false as stated** — the check-raise exists |
| L5 | Fold equity and equity realization accrue asymmetrically to IP | asserted from L2+L3, no bridge |

**A6 — the only measurement-grounded attack, and it cuts against the axiom's magnitude.**
§11.8 / §11.9: a check-back caps strong hands to 10.3% (LR 0.60) while an OOP check leaves 34.3%
(LR 0.79) — replicating on both sites. **The more informative check is the IP player's.** So the
signal the IP player gets to condition on is the *weaker* of the two. L2 survives in sign; the
claimed advantage's size does not follow from it.

**A7 — unstated but load-bearing assumptions**, all four now on record:
1. Information has value only if a decision remains to apply it to.
2. Magnitude scales with SPR and streets remaining — at SPR ≈ 0 position is worth ≈ 0. Never stated.
3. Range advantage is assumed absent, yet the canonical test spot has IP as the preflop raiser.
4. Rake is ignored, and it taxes exactly the marginal pots L5 is about.

**Provenance discipline (the agent's own ledger).** Attacks A1–A5, A7, A8 and the P4′ design are
`assistant-asserted` — **hypotheses to test, not verdicts, and they carry no weight until
measured.** Only **A6** is `measured-here`. One attack was rejected as mis-specified: citing
§11.7 in either direction, since it measures the *engine's shape of read*, not the check's
information content.

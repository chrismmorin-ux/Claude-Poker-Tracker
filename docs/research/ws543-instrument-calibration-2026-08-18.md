# WS-543 — the instrument, calibrated. Two dominated arms came back positive.

**Date:** 2026-08-18 · **Ticket:** WS-543 · **Program:** `prog-methodology-integrity`
**Pre-registration:** `scripts/backtest/ladder/calibrationPrereg.json` · sha256 `9e2711c69848e1c5`
**Harness:** `scripts/backtest/ladder/calibrationArms.mjs` · `scripts/backtest/run-calibration.mjs`
**Output:** `out/calibration-v1.json` · n = 2,155 decisions, 500 players, 12.3 s

> **BINDING CAVEAT.** HandHQ online cash, July 2009, 50NL. These figures characterise the
> **instrument** on that corpus. They are not claims about poker.

---

## §1 Verdict

> ## INSTRUMENT_FALSIFIED — as pre-registered.

Two arms whose sign was fixed before the run by domination came back **positive and resolved**.

| Arm | ESS % | edge (bb) | 95% CI | pre-registered | verdict |
|---|---|---|---|---|---|
| `clone-the-pool` | **100%** | **+0.0000** | [0, 0] | exactly zero | **exact** |
| `fold-every-small-bet` | 87% | −0.4242 | [−0.842, −0.089] | negative | correct |
| `always-fold` | 74% | −1.1751 | [−2.074, −0.414] | negative | correct |
| `never-fold` | **37%** | **+2.8478** | [+1.207, +4.670] | negative | **CONTRADICTS** |
| `raise-everything` | **21%** | **+4.3176** | [+1.624, +7.243] | negative | **CONTRADICTS** |
| `call-every-large-bet` | — | — | — | negative | never fired |

---

## §2 The core estimator is exactly right

`clone-the-pool` abstains everywhere under `fallback: 'pool'`, so π_ours = π_pool, every weight
is 1, and `edge = wisValue − poolValue` must be **exactly** zero. It is: **+0.0000, ESS 2155 of
2155, mean weight 1.000000**.

That is an algebraic identity reproduced to the last digit through the whole pipeline — corpus
walk, policy resolution, weighting, self-normalisation, bootstrap. **Whatever is wrong is not in
the core path**, and knowing that narrows the search enormously.

---

## §3 What IS wrong: effective sample size predicts the failure perfectly

Sort the arms by ESS and the errors sort with it:

```
100%  clone-the-pool          exact
 87%  fold-every-small-bet    correct
 74%  always-fold             correct
─────────────────────────────────────  the results stop being trustworthy here
 37%  never-fold              WRONG (+2.85)
 21%  raise-everything        WRONG (+4.32)
```

**The mechanism.** `wisValue` is the weighted mean over the decisions the arm's support reaches;
`poolValue` is the plain mean over **every scored decision**. When an arm's support excludes a
commonly-observed action, those two averages are computed over **different populations of
hands**, and their difference is a selection artifact rather than a strategy comparison.

`never-fold` assigns zero probability to folding, so every hand where the villain folded gets
weight 0 and drops out. What survives is the continued hands — bigger pots, and in a
postflop-selected population, better outcomes. The arm looks brilliant because it is only ever
graded on the hands it agreed to play.

This is not a bug in the weighting. It is the estimand's stated limit — *"take our advice at
THIS ONE decision, then the hand plays on as it actually did"* — meeting a policy whose support
is narrow. `holeMap.mjs` already documents the same structural weakness from the other
direction: *"the lines he most wants priced are precisely where importance-weighted estimation
is structurally weakest."*

---

## §4 THIS BEARS DIRECTLY ON THE RULE LADDER

Ladder v1's rungs ran at **ESS 794–851 of 2,126 — 37% to 40%.**

That is **the same zone where `never-fold` returned a confidently wrong answer.** The ladder's
reported *levels* (R0 −0.31 … R4 +0.44) sit in the band this calibration says is unreliable, and
they must not be read as strategy quality until the support problem is addressed.

The **paired deltas** are a different construction — computed within shared decisions, so the
population term cancels by design — and may well survive. But that is a hypothesis this run did
not test, and it needs its own dominated-arm check before any rung delta is quoted again.

---

## §5 A correction to my own previous emphasis

Last turn I flagged the broken cluster assumption (2.91 EVAL players per hand) as the reason
ladder v1's "resolved" deltas were overstated, and treated it as the headline caveat.

**Measured here: hand-clustering widens the intervals by 1.013× at the median.** A 1%
correction. **I over-weighted it.** It does not overturn R2 or R3, and it was not where the
problem lived.

The real problem was the one I had not looked for. That is the whole argument for dominated
arms: they found a failure that reasoning about the estimator did not.

---

## §6 A finding about the pool, arriving free

`call-every-large-bet` **never fired** across 2,155 decisions — there were no decisions facing a
bet of 100%+ pot. In this pool, at this stake, overbetting essentially does not occur.

That is a **Hole** in the register's sense: a line the field leaves untaken, and therefore one
against which no defence has been constructed. It is exactly what `holeMap.mjs` exists to price,
and it arrived as a side effect of a calibration arm failing to have anything to score.

---

## §7 What this licenses

**Licensed:** the core estimator path, exactly, at ESS 100%. Dominated arms at high ESS behave
correctly and in the right direction, with `always-fold` reproducing its earlier −1.99 bb (n=45)
as −1.18 bb at n=2,155 with a tighter interval.

**Not licensed:** any edge figure at low ESS, including every ladder rung level. And no claim
about live 9-handed 1/2–1/3 — this is 2009 online 50NL throughout.

---

## §8 Provenance

Pre-registration written and hashed **before** the arms existed. Every figure read from
`out/calibration-v1.json`. The falsification was a pre-registered outcome, not a discovery made
after seeing results — `calibrationPrereg.json` names `INSTRUMENT_FALSIFIED` and its trigger
verbatim.

Throughput note: 2,155 decisions in **12.3 s** (5.7 ms/decision), against 4.9 s/decision before
WS-540 — these arms need no engine and no range marginalisation.

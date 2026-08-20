# WS-546 — the support bias was real, and it was not the cause

**Date:** 2026-08-20 · **Ticket:** WS-546 · **Program:** `prog-methodology-integrity`
**Pre-registration:** `scripts/backtest/ladder/calibrationPrereg.json` · `PREREG-WS-546-SUPPORT`
**Harness:** `scripts/backtest/ipsEstimator.mjs` · `scripts/backtest/ladder/calibrationArms.mjs`
**Output:** `out/calibration-ws546.json` · n = 2,155 decisions, 500 players, 11.1 s

> **BINDING CAVEAT.** HandHQ online cash, July 2009, 50NL. These figures characterise the
> **instrument** on that corpus. They are not claims about poker. Per
> `.claude/rules/corpus-transfer-is-earned.md` nothing here is transferred to a live table.

---

## §1 Verdict

> ## FIX_INSUFFICIENT — as pre-registered.

The narrow-support bias was real and is now removed. **The dominated arms still come back
positive.** Two candidates were implemented and measured; neither restores the sign.

| Arm | ESS% | supp% | cov% | all-rows | support-matched | delta | verdict |
|---|---|---|---|---|---|---|---|
| `clone-the-pool` | 100% | 100% | 0%¹ | **+0.0000** | **+0.0000** | +0.0000 | **exact** |
| `fold-every-small-bet` | 87% | 95% | 10% | −0.4242 | −0.2520 | +0.1721 | correct |
| `always-fold` | 74% | 85% | 31% | −1.1751 | −0.8217 | +0.3534 | correct |
| `never-fold-mixed-high` | 45% | **100%** | 100% | +2.2787 | **+2.2787** | **0.0000** | **CONTRADICTS** |
| `never-fold-mixed-low` | 39% | **100%** | 100% | +2.6652 | **+2.6652** | **0.0000** | **CONTRADICTS** |
| `never-fold` | 37% | 84% | 100% | +2.8478 | +1.9849 | −0.8629 | **CONTRADICTS** |
| `raise-everything-mixed-high` | 32% | **100%** | 31% | +3.2225 | **+3.2225** | **0.0000** | **CONTRADICTS** |
| `raise-everything-mixed-low` | 24% | **100%** | 31% | +3.9439 | **+3.9439** | **0.0000** | **CONTRADICTS** |
| `raise-everything` | 21% | 73% | 31% | +4.3176 | +3.2963 | −1.0213 | **CONTRADICTS** |
| `call-every-large-bet` | — | — | **0%** | — | — | — | **unexamined** |

¹ `clone-the-pool` covers nothing **by design** — that is its mechanism, not its failure.

---

## §2 The core path is still exactly right

`clone-the-pool` returns **+0.0000 under both estimands**, ESS 2155/2155, mean weight 1.000000.
The algebraic identity is reproduced to the last digit through corpus walk, policy resolution,
weighting, self-normalisation and bootstrap — now including the new support-matched path.

**No bias was traded.** `fold-every-small-bet` and `always-fold` were correct before and remain
correct. That is WS-546's second accept criterion, and it holds.

---

## §3 The support bias was real — a 30% bite that changed nothing

`weightFor` returns `{ok: true, w: 0}` when our policy assigns zero probability to the observed
action. Those rows vanish from `wisValue`'s weighted mean and count in `poolValue`'s plain mean,
so `edge` differenced two different populations. The contamination is exact:

```
edgeSupportMatched − edgeBB  =  (|E| / (|S|+|E|)) × (mean_E − mean_S)
```

verified in both directions in `scripts/__tests__/ipsSupportMatched.test.js`. Correcting it moved
`never-fold` from +2.8478 to +1.9849 and `raise-everything` from +4.3176 to +3.2963.

**A real defect, correctly removed, and the sign did not flip.**

> **A correction to my own reasoning, recorded.** The first draft of the implementation comment
> asserted that the excluded rows are "cheap" and therefore inflate the edge. That is backwards:
> cheap excluded rows pull the all-rows baseline **up** and make `edgeBB` too **low**. The
> direction is a property of the arm and the corpus, established by the identity above, never a
> general fact about narrow support. A fixture built on the wrong story is what caught it.

---

## §4 The decisive result: full support does not rescue the sign

The four mixed arms hold a probability floor on every legal response. Their support share is
**100%**, so the two estimands coincide and `edgeBBSupportDelta` is **exactly 0.0000**.

They are still **strongly positive**: `never-fold-mixed-low` at **+2.6652, CI [+1.11, +4.39]**.

**Narrow support is therefore not the cause.** The candidate did precisely what it was designed
to do — support went to 100%, ESS rose from 37% to 45% and from 21% to 32% — and the contradiction
survived it intact.

---

## §5 What is left: the bias is a function of ESS

| ESS% | support-matched edge |
|---|---|
| 87% | −0.2520 |
| 74% | −0.8217 |
| 45% | +2.2787 |
| 39% | +2.6652 |
| 37% | +1.9849 |
| 32% | +3.2225 |
| 24% | +3.9439 |
| 21% | +3.2963 |

> **Pearson r(ESS share, support-matched edge) = −0.9493**

Within each family the relation is monotone and in the same direction: raise the mixing floor,
ESS rises, the edge falls. Across families the ordering holds.

**Read this with the right n.** Eight arms, but only **four independent families** — the mixed
variants are not independent of their base. `raise-everything` at ESS 21% is off the trend
(+3.30 where the fit wants more). This is a strong signal, not a law.

Everything else is eliminated by measurement: `clippedShare` 0.0–0.4% (not the cap),
`meanWeight` 1.0076–1.0954 (not exploding weights), hand-clustering widens by a median 1.01x
(not the cluster unit), and the clone identity is exact (not the core path).

That leaves the **self-normalisation** itself. `wisValue` divides by the realised weight sum, so
the denominator correlates with the numerator and the finite-sample bias scales with weight
concentration — with 1/ESS. The arms are reporting their own weight distributions.

---

## §6 Accept criterion 5, answered in the negative

The paired-delta construction was **assumed** to survive the support problem. It does not.

Paired against `clone-the-pool` it reproduces `edgeBB` to four decimals on every arm —
`never-fold` +2.8478, `raise-everything` +4.3176, `always-fold` −1.1751. That is algebra: clone's
weights are all exactly 1, so `wis_arm − wis_clone` **is** `wis_arm − poolValue`.

> **A pre-registered expectation that failed, recorded unhedged.** The prereg predicted pairing
> would absorb much of the bias if the bias were a weight-concentration effect. It absorbed
> **none**. Pairing cancels only when both sides share a weight concentration, and against a
> unit-weight arm there is nothing to cancel.

---

## §7 A defect this run found in the reporting

`call-every-large-bet` never fired — again. Under `fallback: 'pool'` an arm that covers nothing
has the pool policy substituted verbatim, so it produces a full 2,155 rows, every weight exactly
1, ESS 100%, and an edge of exactly 0.0000. **It becomes `clone-the-pool` wearing a dominated
arm's name**, and printed as "sign not resolved" — which scans as a near-miss rather than as an
absence of evidence.

`n === 0` cannot detect this, because the fallback manufactures the rows. The pre-registration has
required "the share of decisions each arm actually covered" since WS-543 and the runner never
reported it. `run.strategyCoverage` was already being computed and simply not read. It is now
reported, and a zero-coverage arm is `unexamined` — with `clone-the-pool` exempted via its
declared `requiresFallback: 'pool'`, since covering nothing is its mechanism.

**`call-every-large-bet` has never had a verdict, in either run.**

---

## §8 Ladder v1 — WITHDRAWN, not re-reported

WS-546's fourth accept criterion offers two branches. The honest one is withdrawal.

Ladder v1's rung levels cannot be re-reported under an estimator still known to return the wrong
sign on dominated arms at the ESS the rungs themselves run at. Re-reporting them under
`edgeBBSupportMatched` would put a more defensible number on the same defect.

**The rung levels stay withdrawn until WS-596 closes.** Ladder v1's R2 delta had a lower bound of
+0.0048; the bias measured here is three orders of magnitude larger.

---

## §9 What ships from this item

- `poolValueOverSupport` / `supportCount`, and `edgeBBSupportMatched` / `edgeBBSupportDelta` /
  `supportN` / `supportShare` on every `estimateEdge` result, with the conditioning set carried
  as data (`ipsEstimator.mjs`).
- Four mixed calibration arms at two floors, shipping alongside the deterministic ones
  (`calibrationArms.mjs`). The floor is an unmeasured constant and both values ship, per
  `.claude/rules/unmeasured-constants.md`. **It is load-bearing**: `never-fold` moves 2.67 → 2.28
  between floors, so it is promoted to a measurement target in WS-596.
- Coverage reporting and the `unexamined` verdict (`run-calibration.mjs`).
- The paired-delta dominated check (`run-calibration.mjs`, criterion 5).
- 11 tests pinning the clone identity under both estimands and the contamination identity in both
  directions (`scripts/__tests__/ipsSupportMatched.test.js`).
- **WS-596**, carrying this localization as its brief.

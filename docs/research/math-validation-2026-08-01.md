# Math validation — WS-324 Phase 2

**Date:** 2026-08-01 · **Item:** `WS-324` Phase 2 · **Status:** partial — see §5 for what remains

Phase 2 is the half of the robustness protocol that needs **no behavioural data at all**. It asks whether the arithmetic the engine sits on is right, independently of whether the pool model is right. Per `DEC-027` (engine → EV → education), this is the foundation the other two must stand on.

> **Correction to WS-324 as filed.** That item asserted the math is "currently unmeasured". That is wrong, and the error was mine. Preflop hand-vs-hand equity *is* validated against published external values, and side-pot conservation *is* asserted on every example test. The genuine gaps were narrower and different from the ones the item predicted. They are recorded below.

---

## 1 — The register

| Corner | Ground truth | Status | Evidence |
|---|---|---|---|
| Preflop hand-vs-hand equity | **External** — published values | ✅ VALIDATED | 8 fixtures, ±0.001 |
| 7-card evaluator (`evaluate7`) | Internal — second implementation | ✅ CONSISTENT | 10,000 sampled hands, 0 mismatches |
| Exact enumeration vs Monte Carlo | Internal — second implementation | ✅ CONSISTENT | within MC confidence interval |
| Pot / contribution arithmetic | Example-based | ✅ COVERED | pre-existing |
| Side-pot layering | Example + **randomized properties** | ✅ VALIDATED (this pass) | 300 generated structures × 6 properties |
| **Min-raise ladder** | — | 🔴 **WAS UNTESTED, DEFECT FOUND & FIXED** | §2 |
| Side-pot conservation on malformed input | — | 🟡 **GUARD ADDED** | §3 |
| Postflop / multiway / hand-vs-range equity | — | ⬜ NOT EXTERNALLY VALIDATED | §5 |
| Rake, antes, starting pot | Example-based | ✅ COVERED | pre-existing |

Two defects found. One is real and was on a live path; one is unreachable in legal play and was fixed as a guard. Both are described honestly below, including the reachability difference — they should not be given equal weight.

---

## 2 — DEFECT (real): the min-raise ladder advanced off an incomplete raise

**Severity: real.** On a primary recording path, and it produced an illegal number the UI would have offered.

`getMinRaise` had **no test block at all**, despite feeding both the sizing UI (`CommandStrip.jsx:504`) and the action recorder (`recordSeatAction.js:178`).

In NLHE an all-in for less than a full raise moves the amount owed — you must call the larger number — but it does **not** advance the min-raise ladder. The old walk tracked only the last two bet levels, so it took the short increment as the new minimum:

| Sequence | Returned | Legal |
|---|---|---|
| flop bet 10, all-in to 14 | **18** | **24** |
| preflop open 6, shove to 9 | **12** | **13** |

Both offered a raise size below the legal minimum.

**Root cause, and the reason it is a clean fix:** `recordSeatAction.js:174-182` *already* implements the incomplete-raise rule and stamps `reopensAction: false` on a short shove. That flag was correct. But `getMinRaise` had no concept of an incomplete raise, so the ladder computed *after* one was wrong. The recorder knew; the calculator did not.

**Fix:** track the last *full* increment separately from the current bet. An increment below the standing one leaves the ladder where it was.

The increment is re-derived from the amounts rather than read off the `reopensAction` flag, so imported and hand-built sequences get the same answer as recorded ones. The two are answering different questions: `reopensAction` governs **who** may act again, `getMinRaise` governs **how much**.

Recorded as `INV-POT-INCOMPLETE-RAISE-LADDER`. 21 tests added, covering the baseline ladder, straddles, the sub-min family, and ladder reset after a subsequent full raise.

---

## 3 — DEFECT (unreachable): silent chip loss in side-pot layering

**Severity: robustness only.** Found by the randomized property test, on generated input that legal play cannot produce.

With contributions `{1:38, 2:22, 3:86, 4:156, 5:36}` and seats 3 **and** 4 both folded, the layering stranded 166 of 338 chips and `break`ed, returning pots that silently did not sum to the money committed.

**Reachability — and this is why it is not ranked with §2.** For both of the two largest contributors to fold, some live player must be betting them out. Every remaining live player in this shape is all-in and cannot bet. So the last of `{3,4}` can never be forced to fold: **the state is unreachable in legal play.** No real hand loses chips to this.

It was still worth fixing, for one reason: the failure was *silent*. A derived quantity that quietly disagrees with its own inputs is the worst available failure mode, and `calculateSidePots` also accepts imported and `isEstimated` sequences where malformed input is possible.

**Fix:** stranded dead money attaches to the highest pot rather than being dropped. Conservation now holds unconditionally.

The generator was then constrained to reachable states — generating the illegal shape as a *property* would be testing a fiction — and the degenerate case kept as one explicit characterization test.

---

## 4 — The properties now asserted

300 randomized all-in structures (2–6 seats, deterministic LCG, seed 20260801):

- **P1 Conservation** — `sum(pots) + returned === totalContributed`
- **P2** every pot amount is strictly positive
- **P3** returned chips are non-negative and attributed to a real contributor
- **P4** no folded seat is ever eligible to win a pot
- **P5 Nesting** — each side pot is contested by a strict subset of the pot beneath it
- **P6** every eligible seat actually contributed

P5 is the one worth keeping: it encodes that side pots are *layers*, and it would catch an eligibility bug that conservation alone cannot see.

---

## 5 — What Phase 2 has NOT established

Stated plainly so this document is not read as a clean bill of health.

1. **Postflop equity is not externally validated.** The published-value fixtures are preflop hand-vs-hand only. Postflop, hand-vs-range, and multiway equity are checked only for *internal* consistency — `evaluate7` against `bestFiveFromSeven`, enumeration against Monte Carlo. Both sides are ours. A shared bug in the evaluator would pass every one of those checks.
2. **Multiway equity has no ground truth at all.** `mwEquityValidation` lives in `src/__dev__/` and is excluded from the suite.
3. **The EV arithmetic itself is untouched here.** This pass validated pot, side-pot, equity and the raise ladder — the *inputs* to EV. `computeCallDepth2EV` and the game tree were out of scope, and they are where SYNTHESIS gap 1 ("we have no measurement of recommendation quality at all") actually bites.
4. **Rake is modelled, not verified against a real cardroom schedule.**

Item 1 is the highest-value next step and is cheap: a handful of postflop board-specific equities against an independent calculator would convert the largest internal-consistency block into external ground truth.

---

## 6 — Bearing on WS-323

The strategy explorer is blocked on three SYNTHESIS gaps. **Phase 2 closes none of them** — it is a precondition, not one of the conditions. What it does is remove a class of objection: when recommendation quality *is* eventually measured, a bad number can no longer be blamed on the pot or ladder arithmetic beneath it.

That is worth having before the measurement, not after. Debugging a bad EV figure is much harder when the arithmetic under it is unverified.

---

## Change log

- 2026-08-01 — Phase 2 first pass. Min-raise ladder defect found and fixed; side-pot conservation guard added; 6 properties asserted over 300 generated structures. Suite 13,124 → 13,143. Corrected WS-324's "currently unmeasured" premise.

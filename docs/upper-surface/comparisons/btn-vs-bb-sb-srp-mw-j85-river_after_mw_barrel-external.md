# Stage 4i — Leading-Theory Comparison

**Artifact:** `btn-vs-bb-sb-srp-mw-j85-river_after_mw_barrel.md`
**Rubric:** v2.3. **Date:** 2026-04-23.

---

## v2.2 D13 + v2.3 D16 reflexive checks

### Internal-arithmetic check

- §3 weighted equity 76%: per-class computation 66.4/87 = 76% ✓
- §8 Bet 33% total: 4.0 + 6.19 + 2.50 + 5.61 − 0.66 = **17.64** ✓
- §8 Check: 0.76 × 20 = 15.2 ✓
- §8 Overbet (corrected): 12.0 + 2.5 + 0.75 + 1.1 = **16.35** ✓
- §10.1 Joint MDF: 20/26.6 = 75.2% ✓
- §10.4 AP: 6.6/26.6 = 24.8% ✓

All checks pass (after mid-artifact correction on overbet equity assumption — captured in audit F-8a).

### Source-scope check

All sources stake-appropriate and MW-scope-appropriate. ✓

---

## Per-claim comparison (10 sources)

**9A + 1 A-minus + 0 B-wrong + 1 C-incomplete.**

### C-incomplete finding

**Source pattern:** Doug Polk + Upswing + Jonathan Little + Ed Miller all present MW overbet as "sizing leak" without quantifying the MW fold-equity rescue mechanic. Teaching simplification.

**What's omitted:** MW joint fold-equity at overbet sizing can be high enough (~60%+) to partially compensate for narrower call-range + lower hero-vs-call-equity. The overbet-EV-delta in MW is ~1-2bb vs bet-33%, not ~5-10bb as HU-analog teaching implies.

**Material at upper-surface level:** Yes — this is the kind of quantitative nuance the upper-surface rubric is designed to surface. A student internalizing "overbet is huge leak" from HU teaching will over-attach to the leak magnitude and may mis-calibrate exploit options (e.g., when facing station-pool where overbet could actually be optimal).

**Artifact response:** §8 includes the corrected EV computation showing the smaller delta; §13 explicitly classifies C-incomplete; §14c proposes a counter-artifact (overbet-variant) for deeper exploration.

### Source-list

| Source | Position | Category |
|---|---|---|
| GTO Wizard MW content | Thin-value 33% with TPTK | A |
| Upswing MW course | Thin-value 33% + "overbet is leak" | A + C-incomplete-contributor |
| Doug Polk MW content | "Bluff less, value more" | A + C-incomplete-contributor |
| Jonathan Little MW | Pool under-value-bets | A |
| Ed Miller live MW | Thin-value | A + C-incomplete-contributor |
| SplitSuit MW | Small MW value | A |
| Berkey MW nuance | Context-sizing (partial acknowledgment of MW rescue) | **A with nuance** |
| PIO/Snowie outputs | Solver-aligned on small | A |
| Brokos *Thinking Poker* MW | Wide MW value | A |
| Will Tipton *EHUNL* | HU focus | A-minus (MW not addressed) |

**Berkey's A-with-nuance is the closest-to-acknowledging the overbet-rescue mechanic.** Other sources simplify away the nuance.

---

## Active challenge (v2.3 D16) — not strictly required since C-incomplete found

D16 documentation not strictly required when a B or C surfaces. Documentation provided for completeness:

- Sources probed: 10+.
- Angles attempted: pre-solver, HU-online, live-cash, tournament, contrarian — all direction-aligned.
- Closest-to-disagreeing: Berkey MW sizing-context-nuance (A-with-nuance).

---

## POKER_THEORY.md §9 impact

**No new §9 D entry** from this artifact directly.

**Candidate for §9.X (MW-specific divergence):** "MW overbet-mechanics differ from HU — joint fold-equity in MW compensates partially for narrower call-range." Batch candidate if MW overbet appears in 2+ more artifacts.

---

## `lsw-impact` subsection

### Flag 1 — No LSW audit for line 3

Fourth line-3 artifact without LSW audit (#9, #13). LSW-coverage gap widening for line 3. Recommendation: schedule LSW-line-3 audit.

### Flag 2 — Line content ambiguity (pot value)

Artifact flagged pot ambiguity (20 vs 25). Could be a line-content-ship finding if LSW audits line 3. Suggests authored line needs either (a) pot value correction or (b) explicit path-conditional framing.

---

## Summary

Stage 4i: **9A + 1 A-minus + 1 C-incomplete.** D13 reflexive checks pass. D18 candidate reinforced at 3 data points.

**First C-incomplete since artifact #6.** The MW-vs-HU overbet-magnitude nuance is the specific pedagogical omission.

**Cumulative Stage 4 pattern:** 9 consensus-robust + 3 with B-findings + 1 with C-incomplete. Still "consensus dominates" but non-trivial non-A category count (4 artifacts with non-A findings).

**No rubric deltas from Stage 4i.** v2.3 remains mature. D18 candidate watching for 4th data point.

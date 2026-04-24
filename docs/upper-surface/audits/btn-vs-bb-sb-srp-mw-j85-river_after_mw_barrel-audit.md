# Self-Audit — `btn-vs-bb-sb-srp-mw-j85-river_after_mw_barrel`

**Rubric:** v2.3. **Date:** 2026-04-23. **Verdict: YELLOW (light).** 11 findings: 0 P1, 3 P2, 8 P3.

---

## Executive summary

**First MW river artifact in corpus.** First corpus C-incomplete since #6. Flags the MW-vs-HU structural contrast in sizing-leak magnitude. Pot-value ambiguity (20 authored vs 25 derived) logged.

**No new rubric candidates** but **D18 (order-of-action MW sequential-signaling) reinforced at 3 data points** (after #6, #9, #13). If artifact #14 or #15 reinforces, candidate crosses 4-point threshold for v2.4 batch.

**Headline findings.**
- **First C-incomplete since #6** — authored teaching's "overbet = big leak" is directionally-right-magnitude-overstated for MW. MW fold-equity mechanics partially rescue overbet (~1.3bb delta instead of HU's ~10bb). Captured in §8.15 and §13.
- **§1 pot ambiguity** — authored 20bb vs path-derivation 25bb (BB-fold-vs-call-turn ambiguity). Not a decision-level issue but logged for transparency.
- **D12 + D17 applied cleanly.** MW river with pure-bimodal equity + scenario-grouping works smoothly.

---

## Findings

### §1

- **F-1a** (P2): **Pot value 20 (authored) vs 25 (path derivation if BB called turn) ambiguity.** This is the most pedagogically-load-bearing issue — the artifact assumes scenario-B (3-way at river, both villains present) but uses pot 20bb which only reconciles if BB folded turn (HU-at-river). The §2 BB check-behind range (~80 combos) and §7 joint-synthesis assume BB still in pot; §1 pot matches BB-folded. This is an inherent line-authoring inconsistency that propagates.
  - Fix: Either (a) correct authored pot to 25 (scenario B preserved); or (b) revise §2/§7 to assume HU at river (scenario A); or (c) explicitly acknowledge the ambiguity and author scenario-conditional reasoning.
  - Severity 2 (P2), effort S. Backlog: `US-A13-F1a` OR line-content fix.

### §2

- **F-2a** (P3): SB turn-lead range ~30 combos and BB turn-call range ~80 combos are `population-consensus-observed` but not cited to specific sources. Could tighten.
  - Severity 1, P3.

- **F-2b** (P3): Hero A♠ + J♣ blocker arithmetic is directional. Per-Ax-class and per-Jx-class computation would sharpen.
  - Severity 1, P3.

### §3

- **F-3a** (P3): Equity 76% vs check-range is first-pass; Equilab per-class rigor would narrow CI.
  - Severity 1, P3.

### §4

- **F-4a** (P3): Solver claims are MW-analog/directional rather than solver-specific-output-for-this-exact-node. Acceptable given MW solver sparsity but note provenance.
  - Severity 1, P3.

### §5

- **F-5a** (P3): Row 5.3 MW "both check = weakness" correct reading rate labeled `population-observed` with n≈0. Wide CI.

- **F-5b** (P3): Row 5.4 MW "third-in-pot over-defense" is load-bearing for §8 joint-call-rates. `population-consensus-observed` from MW-specific content; could cite specific article.

### §6

- **Clean.** Archetype-conditional absorbed.

### §7

- **F-7a** (P3): Per-villain EV derivations (rows 7.3-7.4) are computed but per-class-combo breakdown not shown inline.
  - Severity 1, P3.

### §8

- **F-8a** (P2): **EV tree computation went through a mid-artifact correction** — initial overbet EV calc gave +19.65bb; correction gave +16.35bb. Authored teaching "overbet is sizing leak" depends on the corrected number.
  - The root cause: first pass assumed hero equity vs overbet call-range is 55% (same as HU analog); correction lowered to 45% (more specific MW overbet call-range composition).
  - Fix: Single-pass computation with explicit per-class equity table for overbet call-range.
  - Severity 2 (P2), effort S. Backlog: `US-A13-F8a`.

- **F-8b** (P2): **C-incomplete finding in §13** is the artifact's load-bearing rubric-pressure moment. Authored teaching and most sources pedagogically simplify MW overbet to "sizing leak" without quantifying the MW-specific fold-equity rescue. First corpus C-incomplete since #6.
  - Fix: Counter-artifact (§14c points to overbet-variant).
  - Severity 2 (P2), effort M. Backlog: `US-A13-F8b`.

- **F-8c** (P3): Scenario-correlation (BB and SB calling-behavior correlated) is hand-waved as "mild correlation." Could formalize.
  - Severity 1, P3.

### §9

- **Clean.** Blocker arithmetic correct; null decision-impact.

### §10

- **F-10a** (P3): D15 explicitly N/A; TPTK both range-top and individually-correct. Positive finding.

### §11

- **Completeness gate present** (53 claims).

### §12

- **F-12a** (P3): Assumption D (overbet-delta magnitude) is listed but doesn't fully explore the close-call nature. Could expand.
  - Severity 1, P3.

### §13

- **F-13a** (P2): **C-incomplete category applied** — first corpus C-incomplete since #6. Documentation explicit. Valid application of category.
  - Positive finding.

### §14a

- **Clean.** Mirror-node test 3 stay / 2 invert / 1 partial. Under D8 cap. Chose #12 as HU-analog mirror (cross-corpus mirror) which is informative.

### §14b

- **F-14b** (P3): Decision-level-robustness claim is appropriately qualified (bet vs check robust; 33% vs overbet close-call). Positive finding.

### §14c

- **Clean.** Counter-artifact pointer specific.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Backlog |
|---|---|---|---|---|---|
| 1 | F-1a — pot ambiguity (20 vs 25) | 2 | P2 | S | US-A13-F1a |
| 2 | F-8a — EV computation mid-correction | 2 | P2 | S | US-A13-F8a |
| 3 | F-8b — C-incomplete: overbet magnitude | 2 | P2 | M | US-A13-F8b |
| 4 | F-10a — D15 explicit N/A | — | Positive | — | — |
| 5 | F-13a — C-incomplete application | — | Positive | — | — |
| 6 | F-2a — range sources tightening | 1 | P3 | S | — |
| 7 | F-2b — blocker per-class | 1 | P3 | S | — |
| 8 | F-3a — Equilab tightening | 1 | P3 | S | — |
| 9 | F-4a — solver provenance | 1 | P3 | — | — |
| 10 | F-5a — MW pool reading rate | 1 | P3 | S | — |
| 11 | F-5b — MW third-in-pot source | 1 | P3 | S | — |
| 12 | F-7a — villain EV inline | 1 | P3 | S | — |
| 13 | F-8c — scenario correlation formalization | 1 | P3 | S | — |
| 14 | F-12a — overbet-delta expansion | 1 | P3 | S | — |

**Breakdown:** 0 P1, 3 P2, 8 P3 (+2 positive). YELLOW reflects 3 P2s.

---

## Rubric-candidate tally

**D18 (order-of-action MW sequential-signaling) reinforced at 3 data points** (after #6, #9, #13). If artifact #14 or #15 produces a 4th data point, D18 candidate becomes formalizable in v2.4.

No other new candidates.

---

## LSW-audit cross-reference

No LSW audit for line 3 yet (tracked as open gap in artifact #9 Stage 4i).

**Line 3 LSW-coverage gap widens:** artifacts #9 and #13 both from line 3 without LSW audit. Recommendation: schedule LSW-line-3 batch when corpus-scaling pauses at 15.

---

## Audit sign-off

**Verdict:** YELLOW (light). 3 P2s (pot ambiguity, EV mid-correction, C-incomplete). First MW river artifact successful despite complexity.

**Structural-diversity achievement:** First MW river. First C-incomplete since #6. Fourth corpus artifact with a non-consensus-robust Stage 4 finding.

**Recommendation:** Proceed to Stage 4i + 5i. Queue P2s for polish batch.

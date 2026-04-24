# Self-Audit — `btn-vs-bb-3bp-ip-wet-t96-turn_after_call`

**Rubric:** v2.3. **Date:** 2026-04-23. **Verdict: YELLOW (light).** 8 findings: 0 P1, 3 P2, 5 P3.

---

## Executive summary

**Program-closure artifact.** 15 artifacts complete. First range-level semi-bluff framework. Second corpus C-incomplete.

**No new rubric candidates.** v2.3 remains mature. D18 (MW order-of-action) candidate stays at 3 data points (not triggered to 4 by HU artifact).

**Headline.** Authored teaching "bet 66%" is directionally-correct at RANGE-LEVEL but individual-hand-level (JT specifically) is a close-call vs check-back (±2bb modeling). C-incomplete-flag surfaces the authored-pedagogical-simplification.

---

## Findings

### §1

- **Clean.** Pot 34bb derivation clean.

### §2

- **F-2a** (P3): BB turn-check range ~27 combos is derived from "60% of donk range checks" heuristic; could tighten with per-class donk-then-check filter.
- **F-2b** (P3): Hero's flop-call range ~105 combos has wide CI; load-bearing for §3.

### §3

- **F-3a** (P3): Per-class equity estimates (rows 3.1-3.6) are outs-based derivations; Equilab precise would sharpen.

### §4

- **F-4a** (P3): Solver claims are directional (3BP IP solver analog).

### §5

- **F-5a** (P3): Row 5.3 "semi-bluff freq with draws" is `population-consensus-observed` but is the closest-to-data-claim; tighter stake-conditioning preferable.

### §6

- **F-6a** (P2): **Delta-vs-population claim** depends on several estimated numbers (pool 66% sizing freq, pool semi-bluff freq). Load-bearing for the "exploit frame" argument.
  - Fix: Tighten with stake-labeled HUD data.
  - Severity 2 (P2), effort M. Backlog: `US-A15-F6a`.

### §7

- **Clean.** Villain perspective well-characterized.

### §8

- **F-8a** (P2): **EV-tree computation went through an explicit reconciliation**. Initial bet-66% vs check-back calculation had bet-66% winning; correction showed the two are approximately equal. **Transparency is good** (v2.1 D10 discipline) but the reconciliation structure creates reader-friction.
  - Fix: Single-pass clean EV presentation with sensitivity-analysis-framing.
  - Severity 2 (P2), effort S. Backlog: `US-A15-F8a`.

- **F-8b** (P2): **Close-call decision surfacing is the C-incomplete anchor**. Bet-66% vs check-back delta is ±2bb modeling-sensitive. Authored teaching simplifies; artifact flags. Valid surfacing but load-bearing for §13.
  - Severity 2 (P2), effort M. Backlog: `US-A15-F8b`.

### §9

- **Clean.**

### §10

- **F-10a** (P3): D15 "marginal" (close-call individual) — novel corpus category. Not strictly non-applicable (like prior instances) but not clear-applicable either. Formally logged as "marginal" in row 10.4.

### §11

- **Completeness gate present** (~40 claims — lower density). Reflects program-closure focus on range-level rather than individual-claim enumeration.

### §12 — Clean; explicit close-call acknowledgment on bet-vs-check.

### §13

- **F-13a** (P3): **Second corpus C-incomplete.** Similar pattern to #13 (authored-teaching-simplification masks individual-hand-quantitative-closeness). Explicit classification appropriate.

### §14a — Clean; mirror with artifact #1 (same line, upstream flop).

### §14b — Clean; "individual close-call, range-level robust" statement.

### §14c — Pointer to flush-draw-variant + overpair-variant.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Backlog |
|---|---|---|---|---|---|
| 1 | F-6a — Delta-vs-population tightening | 2 | P2 | M | US-A15-F6a |
| 2 | F-8a — EV reconciliation cleanup | 2 | P2 | S | US-A15-F8a |
| 3 | F-8b — C-incomplete close-call surfacing | 2 | P2 | M | US-A15-F8b |
| 4 | F-2a — BB turn-check range tighter | 1 | P3 | S | — |
| 5 | F-2b — Hero flop-call range | 1 | P3 | S | — |
| 6 | F-3a — Equilab per-class | 1 | P3 | S | — |
| 7 | F-4a — Solver provenance | 1 | P3 | — | — |
| 8 | F-5a — Semi-bluff source tighter | 1 | P3 | S | — |
| 9 | F-10a — D15 "marginal" category | 1 | P3 | — | — |
| 10 | F-13a — Second C-incomplete | — | Note | — | — |

**Breakdown:** 0 P1, 3 P2, 5 P3. YELLOW reflects 3 P2s (similar to #11 T98 and #13 MW river).

---

## Rubric-candidate tally

**No new candidates.** D18 at 3 data points. D15 novel "marginal" sub-category observed but not rubric-pressure (single-instance).

---

## LSW-audit cross-reference

LSW-A1 (T96) closed 2026-04-22 with F1 shipped. Artifact uses post-F1 line state. No new flag.

---

## Audit sign-off

**Verdict:** YELLOW (light). Program-closure artifact. Second C-incomplete. First range-level semi-bluff framework even if pinned hand is made-TP.

**Program summary:**
- 15 artifacts complete.
- 11 GREEN + 4 YELLOW audit verdicts across corpus.
- 10 consensus-robust + 3 B-findings + 2 C-incomplete Stage 4 outcomes.
- v2.3 remained mature (no v2.4 needed during US-1 corpus scaling).

**Program pause trigger reached.** Pre-Session Drill UX Gate 2 roundtable is now unblocked per `docs/design/audits/2026-04-23-entry-pre-session-drill.md`.

# Self-Audit — `btn-vs-bb-srp-ip-dry-q72r-turn_checked_back`

**Rubric:** v2.3. **Date:** 2026-04-23. **Verdict: GREEN (light).** 7 findings: 0 P1, 1 P2, 6 P3.

---

## Executive summary

First turn-defender-facing-probe artifact in corpus. First MDF-as-primary-driver artifact. Clean application of v2.3 — D14 applied; D15/D17/D12 all N/A (HU turn-decision-non-river, aligned-range-hand). Consensus-robust on Stage 4i (10A).

**No new rubric candidates.**

**Headline.** Direct upstream of artifact #4 (same line, river). Together they form a three-node teaching arc: check-back-flop → call-probe-turn → bluff-catch-river. Cleanest never-fold recommendation in corpus (equity:odds ratio 2.2x).

---

## Findings

### §1 — Clean

### §2

- **F-2a** (P3): BB probe composition (43/29/29 value/marginal/bluff) is auditor-estimated, not sourced to specific dataset. Tighten via HUD data if available.
- **F-2b** (P3): Hero's check-back range ~350 combos is rough; ±30 CI. Acceptable.

### §3

- **F-3a** (P3): Mid-pair 88-JJ mix gives "50% avg" which glosses over specific hand-vs-hand equity. Tighter per-sub-class derivation possible.

### §4

- **F-4a** (P3): Claim 4.1 solver cbet-freq 60-65% is directional from dry-board solver analog, not specific to Q72r.

### §5

- **F-5a** (P3): Row 5.5 pool 99 fold-rate vs probe (~25-40%) is `population-observed` n≈0. Wide CI. Load-bearing for §6 delta claim.

### §6

- **Clean.** Delta clear; archetype-robust.

### §7

- **F-7a** (P3): BB probe-bluff EV computation is formula-simplified; specific sizing-EV-per-class would sharpen.

### §8

- **F-8a** (P2): **Turn-forward-EV (+5-7bb)** is a rough aggregate. Depth-3 per-river-card computation would tighten. Similar pattern to #12 and #13 §8 findings.
  - Severity 2 (P2), effort S. Backlog: `US-A14-F8a`.

### §9 — Clean

### §10 — Clean; D15 explicit N/A. MDF + pot-odds + AP all formula-exact.

### §11 — Clean; completeness gate (51 claims).

### §12

- **Clean.** Cleanest never-fold in corpus.

### §13 — Clean; 10A consensus.

### §14 — Clean.

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort |
|---|---|---|---|---|
| 1 | F-8a — Turn-forward-EV per-river-card | 2 | P2 | S |
| 2 | F-2a — BB probe composition source | 1 | P3 | S |
| 3 | F-2b — Check-back range tightening | 1 | P3 | S |
| 4 | F-3a — mid-pair equity sub-class | 1 | P3 | S |
| 5 | F-4a — solver provenance | 1 | P3 | — |
| 6 | F-5a — Pool fold-rate CI | 1 | P3 | S |
| 7 | F-7a — BB probe EV per-class | 1 | P3 | S |

**Breakdown:** 0 P1, 1 P2, 6 P3. GREEN.

---

## Rubric-candidate tally

No new candidates. MDF-as-primary-driver pattern established (this artifact + #10 and #13 have MDF as supporting context). If MDF becomes central driver in a 4th+ artifact, potential §10 forcing-constraint upgrade candidate.

---

## LSW-audit cross-reference

LSW-A2 (Q72r) closed 2026-04-22. Artifact uses post-F2 line state (turn pot-odds corrected to 27% and other fixes).

---

## Audit sign-off

**Verdict:** GREEN (light). Cleanest never-fold recommendation in corpus. Direct upstream of artifact #4 creates a teaching-arc. Recommendation: Proceed to Stage 4i + 5i.

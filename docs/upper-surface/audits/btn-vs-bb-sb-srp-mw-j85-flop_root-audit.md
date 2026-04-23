# Self-Audit — `btn-vs-bb-sb-srp-mw-j85-flop_root`

**Rubric:** v2.3. **Date:** 2026-04-23. **Verdict: GREEN (light).** 7 findings: 0 P1, 2 P2, 5 P3.

---

## Executive summary

Second MW artifact authored v2.3-native (first was artifact #7 preflop-squeeze; this is MW-postflop). v2.3 D14 / D16 / D17 applied cleanly. **D15 explicitly marked non-applicable** — hero's TPTK is both range-top AND individual-hand-correct-to-bet. First corpus artifact where D15 is explicitly-non-applicable-with-rationale.

**No new rubric candidates.** v2.3 absorbs all observed patterns.

**Headline:** matching-teaching with artifact #6 despite different hero positional structure (CO-sandwiched vs BTN-IP-behind-both). Both converge on cbet-50% with joint-fold-equity ~30-36%. Validates MW theory is robust across positional configurations.

---

## Findings

### §1

- **F-1a** (P3): pot authored 10 vs derived 9. Minor rounding.

### §2

- **F-2a** (P2): **combined-range inclusion-exclusion estimate (-10-15%) is heuristic.** Artifact estimates "80+240 = 320 naive, ~280 after overlap." The exact inclusion-exclusion requires detailed hand-class overlap analysis that artifact approximates.
  - Fix: formalize inclusion-exclusion per hand-class rather than aggregate percentage.
  - Severity P2, effort M. Backlog: `US-A9-F2a`.

- **F-2b** (P3): BB cold-call range estimate ~240 combos wide; lacks specific source. Live-BB-defend-vs-BTN numbers vary by stake.
  - Fix: tighten source or widen CI.

### §3

- **F-3a** (P3): Bucket counts (~150 nuts + 60 strong + 14 medium + 9 air + 22 unclassified) are rough. Enumeration could be tighter.

### §4

- **F-4a** (P3): Solver claims directional (carry-over).

### §5

- **F-5a** (P3): `population-consensus-observed` (D14) applied correctly. Positive finding.

### §6

- **Clean.** Single-action per v2 §6 default; no archetype flip.

### §7

- **F-7a** (P3): Order-of-action correlation stated as "mild" without explicit quantification. D18 candidate (light) reinforced.

### §8

- **F-8a** (P2): Scenario E (raise ~5%) probability is asserted; no derivation.
  - Fix: justify with live-pool raise-freq on MW check-through flops.
  - Severity P2, effort S. Backlog: `US-A9-F8a`.

### §9

- **Clean.** Blocker arithmetic correct. +2pp shift favorable.

### §10

- **F-10a** (P3): D15 explicitly marked non-applicable with rationale. **First corpus instance of D15 explicit-non-applicability** — validates D15 as a section-trigger check, not always-required forcing constraint. Positive.

### §11-§14c

- **Clean.** 43 rows, falsifiers present. D17 extensions applied.

---

## Prioritized fix list

| # | Finding | Severity | Priority |
|---|---|---|---|
| 1 | F-2a — inclusion-exclusion formalization | 2 | P2 |
| 2 | F-8a — Scenario E probability derivation | 2 | P2 |
| 3 | F-1a — pot authored/derived gap | 1 | P3 |
| 4 | F-2b — BB range source | 1 | P3 |
| 5 | F-3a — bucket count refinement | 1 | P3 |
| 6 | F-4a — solver inferential carry | 1 | P3 |
| 7 | F-7a — order-of-action mild correlation | 1 | P3 |

**Breakdown:** 0 P1, 2 P2, 5 P3.

---

## Rubric-candidate tally

No new candidates. D18 (order-of-action) remains at 2 data points (reinforced here but still light).

---

## Audit sign-off

**Verdict:** GREEN (light). v2.3 mature for MW corpus scaling. Second MW artifact confirms D17 extensions work across positional structures.

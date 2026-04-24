# Self-Audit — `btn-vs-bb-srp-ip-dry-q72r-river_after_barrel`

**Rubric:** v2.3. **Date:** 2026-04-23. **Verdict: GREEN (light).** 8 findings: 0 P1, 2 P2, 6 P3.

---

## Executive summary

First thin-value-bet artifact in corpus. First artifact where sizing-leak-greater-than-check (bet-75% worse than check-back by ~7bb). v2.1 D12 pure-bimodal applied (second value-framing river instance; first bluff-catch was #4). v2.3 D14/D15/D16 all applied; D17 N/A.

**No new rubric candidates.** Value-bet framing absorbed into existing v2.3.

**Headline findings.**
- **Sizing-leak-greater-than-check** (§8 row 8.11) is the strongest teaching claim in the artifact. Bet-75% loses ~10bb relative to bet-33%; check-back is ~7bb worse than bet-33%. The "sizing folds out the target" principle is quantitatively demonstrated.
- **§8 EV derivation is computationally dense** — 9 absolute-EV calculations across 3 options × 3 branches. Internal-arithmetic all checks cleanly but per-step transparency could improve.
- **Value-betting threshold formalized** (§10) using POKER_THEORY.md §3.8. First artifact to explicitly invoke the 50%-equity-vs-call-range principle. Candidate for POKER_THEORY.md expansion if reinforced in 2+ more artifacts.

---

## Findings

### §1

- **Clean.** Pot derivation clean (18.1bb cascade from sizing).

### §2

- **F-2a** (P3): **BB range composition per-class fractions are estimated, not enumerated.** Rows 2.6-2.11 give specific combo counts but the upstream filter (fraction of each class that calls flop + turn + checks river) is narrative-derived, not combo-exact.
  - Fix: Per-class-fraction-exact table showing each hand class and its filter percentage at each street.
  - Severity 1, P3.

- **F-2b** (P3): Hero blocker effects on each range class stated as aggregate 8-10 combos removed; per-class breakdown omitted.
  - Severity 1, P3.

### §3

- **F-3a** (P3): D12 pure-bimodal applied correctly. Per-class win/chop/lose counts derived. Positive finding.

- **F-3b** (P3): Weighted equity 94% is close-enough-approximation; Equilab-specific run would sharpen CI.
  - Severity 1, P3.

### §4

- **F-4a** (P3): Solver frequencies (rows 4.1-4.4) are directional inferences from thin-value theory articles, not direct solver output for this specific node. 
  - Fix: Acknowledge `solver-analog` vs `solver` per established convention.
  - Severity 1, P3.

### §5

- **F-5a** (P3): Row 5.3 "BB call-rate vs 33%" ~75-80% is `population-observed` with n≈0. Wide CI documented.

- **F-5b** (P3): Row 5.5 check-back-leak rate ~35-45% is `population-consensus-observed` but wide CI (±10pp).
  - Severity 1, P3.

### §6

- **Clean.** Pre-drafting check performed. Archetype-conditional note applied; nit-override preserves single-exception legitimacy.

### §7

- **Clean.** BB model of hero range correctly asymmetric; villain-EV traces to §11.

### §8

- **F-8a** (P2): **EV computation structure in §8 went through an exposition of confusion** — the artifact includes an explicit "let me restart" passage before landing on clean absolute-EV framing.
  - v2.1 D10 transparency is useful but creates reader-friction. Could be cleaned up post-draft.
  - Severity 2 (P2), effort S. Fix: single-pass EV presentation.
  - Backlog: `US-A12-F8a`.

- **F-8b** (P2): **Bet-75% call-range hero equity estimate 50% is load-bearing.** The sizing-leak claim depends on this. Current derivation is qualitative ("narrower call-range, strong-Qx + sets → hero equity about 50%"). Quantitative per-class equity for the 23-combo 75%-call-range would tighten CI.
  - Severity 2 (P2), effort S.
  - Backlog: `US-A12-F8b`.

- **F-8c** (P3): Raise-branch EV calculations assume hero folds to check-raise without considering raise-size-specific minraise-call economics.
  - Severity 1, P3.

### §9

- **Clean.** Blocker arithmetic correct; "null decision-impact" conclusion justified.

### §10

- **F-10a** (P3): **Thin-value threshold formalized** (§10.5 invokes POKER_THEORY.md §3.8). First formal invocation in corpus. Positive finding.

- **F-10b** (P3): D12 non-applicable note for realization factor is brief; could expand to explicitly distinguish river-vs-flop/turn realization semantics.
  - Severity 1, P3.

### §11

- **Completeness gate present** (56 claims). Positive.

### §12

- **Clean.** Four assumptions + archetype sensitivity; nit-override legitimately captured.

### §13

- **Clean.** 10+ sources, 10A verdict, D16 documentation.

### §14a

- **F-14a** (P3): Mirror-node test result is 6 stays + 0 inverts + 0 partial. This is "very clean" per the artifact's own description, but ALSO indicative that the chosen mirror (K-high analog) is TOO similar — a meaningful mirror usually inverts at least one claim.
  - Fix: Choose role-inverted mirror (hero BB OOP defends multi-street, hero is the river-check-decider) for a sharper inversion test.
  - Severity 1, P3.

### §14b, §14c

- **Clean.**

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Backlog |
|---|---|---|---|---|---|
| 1 | F-8a — EV computation structure cleanup | 2 | P2 | S | US-A12-F8a |
| 2 | F-8b — Bet-75% call-range equity quantitative | 2 | P2 | S | US-A12-F8b |
| 3 | F-10a — Thin-value-threshold formalization | — | Positive | — | — |
| 4 | F-2a — BB range per-class fraction table | 1 | P3 | S | — |
| 5 | F-2b — Hero blocker per-class breakdown | 1 | P3 | S | — |
| 6 | F-3a — D12 positive application | — | Positive | — | — |
| 7 | F-3b — Equity Equilab-tightening | 1 | P3 | S | — |
| 8 | F-4a — Solver-analog labeling | 1 | P3 | — | — |
| 9 | F-5a — BB call-rate sample | 1 | P3 | S | — |
| 10 | F-5b — Check-back-leak CI | 1 | P3 | S | — |
| 11 | F-8c — Raise-branch minraise economics | 1 | P3 | S | — |
| 12 | F-14a — Mirror-node inversion quality | 1 | P3 | S | — |

**Breakdown:** 0 P1, 2 P2, 7 P3 (+2 positive). GREEN verdict (standard corpus-scaling P2 count).

---

## Rubric-candidate tally

**No new candidates.** D18 (order-of-action MW) not applicable (HU). v2.3 mature for value-betting framing.

**Proto-candidate noted:** first artifact to invoke POKER_THEORY.md §3.8 formally (value-betting threshold). If 2+ more artifacts reinforce, candidate for §10 forcing constraint upgrade: "thin-value decisions must compute per-sizing call-range hero equity explicitly."

---

## LSW-audit cross-reference

LSW-A2 audit closed 2026-04-22 with F2 shipped. Artifact uses post-fix line state (small-cbet 33%, turn 50%, river 33%).

LSW-A2 flagged `river_after_barrel` as HIGH LEVERAGE for bucket-teaching (thin-value archetype flip). This artifact captures the nit-override as the archetype flip, consistent with LSW-A2's identification.

No LSW-level content issues surface.

---

## Audit sign-off

**Verdict:** GREEN (light). First thin-value artifact successful. First "sizing-leak-greater-than-check" quantitative demonstration. v2.3 continues mature for value-framing river decisions.

**Structural-diversity achievement:** fourth Q72r-line artifact completes line coverage for value-framing (turn barrel in #5, river bluff-catch in #4, river thin-value now in #12). One Q72r node remains (`turn_checked_back`) as potential future structural candidate.

**Recommendation:** Proceed to Stage 4i + 5i.

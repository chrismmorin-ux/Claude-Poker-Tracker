# Self-Audit — `sb-vs-btn-3bp-oop-wet-t98-flop_root`

**Rubric:** v2.3. **Date:** 2026-04-23. **Verdict: YELLOW (light).** 10 findings: 0 P1, 4 P2, 6 P3.

---

## Executive summary

**Highest-rubric-pressure artifact yet in corpus (alongside #6 MW).** First corpus application of D15 (range-vs-hand MDF divergence). First "check correct" decision. First overpair-as-hero. Inherits Category-D divergence from POKER_THEORY §9.3 (SB flat-3bet live-pool pathway).

**No new rubric candidates surfaced.** v2.3 handles the new decision-class cleanly.

**Headline findings.**
- **D15 triggers for the first time** (§10.3–10.4 explicit). Validates D15 as behavior-changing constraint (not merely trigger-check like in artifacts #9 and #10 where D15 was non-applicable). D15 prevented "it's AA so bet big" reasoning.
- **§8 EV tree has several estimate-in-place-of-computation rows** (Bet 33% call-branch EV, check-check-then-turn EV). Similar F-pattern to J85 #9 and K77 #10.
- **Equity computations in §3 are bucket-weighted approximations.** Actual Equilab equity would tighten the 55-60% range. Load-bearing for §6 delta-vs-population claim.
- **Live-pool range construction heavily depends on POKER_THEORY §9.3 inheritance.** Well-framed but structurally fragile — if §9.3 assumptions shift (live pool tightens further, SB rarely flats), this artifact's entire construction shifts.

---

## Findings

### §1

- **Clean.** Pot derivation clean (21bb = 10+10+1). SPR 4.3 correctly placed in MEDIUM zone.

### §2

- **F-2a** (P2): **SB flat-3bet range estimate (~35 combos) is the single most load-bearing range claim in the artifact.** CI ±10 combos is wide relative to the central claim. The live-pool pathway is rare enough that reliable live-HUD data is scarce.
  - **Fix:** Tighten via pool-stake-conditioning (2/5 live likely 30-45 combos; 1/2 live lower; 5/10 live lower due to more solver-trained players).
  - **Severity 2 (P2), effort M.** Backlog: `US-A11-F2a`.

- **F-2b** (P3): BTN 3bet range composition per-class estimates (rows 2.7, 2.8) are roughly computed rather than full Equilab enumeration.
  - Fix: Per-class-exact enumeration.
  - Severity 1, P3.

### §3

- **F-3a** (P2): **Hero AA equity vs BTN range (55-60%) is bucket-weighted approximation, not Equilab-computed.**
  - v2 D2: "Per-class equity must be derived, not asserted." The per-class equities (rows 3.1-3.8) are derived from outs-logic (correct), but the weighted average is approximate.
  - **Fix:** Run Equilab equity calculation for hero's specific combo against per-class villain sub-ranges; sum with exact weights. Expected: landing in 55-62% range but with tighter CI.
  - **Severity 2 (P2), effort S.** Backlog: `US-A11-F3a`.

- **F-3b** (P3): Equity variance across turn cards (§3 "High variance is why pot-control matters" claim) is qualitative, not enumerated per-turn.
  - Fix: Per-turn-card equity table (49 unknowns × per-card equity).
  - Severity 1, P3.

### §4

- **F-4a** (P3): Solver claims are ANALOG-based, not direct solver citation. The SB flat-3bet range is off-solver-equilibrium; artifact uses "3BP-OOP solver analog" framing. Appropriate given the live-pool construction, but adds provenance-chain depth.
  - Fix: Acknowledge in §11 source-type as `solver-analog` rather than `solver`.
  - Severity 1, P3.

### §5

- **F-5a** (P3): Rows 5.3-5.4 `population-observed` with n≈0. Wide CI correctly labeled.

### §6

- **Clean.** Pre-drafting check performed. Archetype-conditional note applied; all archetypes converge on check.

- **F-6a** (P2): **Delta-vs-population is ~70-80 pp — largest delta in corpus.** Artifact notes this is the exploit frame. But a 70pp delta is a huge claim that deserves tighter support than `population-consensus-observed` can provide alone. Recommendation robustness is high; claim's magnitude is where the audit concern lies.
  - Fix: If stake-labeled HUD data becomes available for live-cash AA-on-wet betting frequencies, upgrade to `population-cited`.
  - **Severity 2 (P2), effort M** (deferred — depends on data access). Backlog: `US-A11-F6a`.

### §7

- **F-7a** (P3): Villain model of hero's range is described qualitatively (rows 7.1-7.2 give fractions). Could be tightened with specific combo-count-based derivation.
  - Fix: Per-class-exact derivation.
  - Severity 1, P3.

### §8

- **F-8a** (P2): **Turn-play EV contributions (rows 8.2, 8.6) are approximate weighted-average estimates, not per-turn-card computation.**
  - v2 D5: per-runout-class breakdown required for depth-2.
  - The check-branch EV of +2.7bb for "check-check-then-turn" is especially under-derived — it should show the ~33 brick-turn × equity × pot distribution.
  - **Severity 2 (P2), effort S.** Backlog: `US-A11-F8a`.

- **F-8b** (P3): Bet-33% raise-branch loss (row 8.9, −1.4bb) assumes hero folds to any raise. Reality: hero might call a min-raise (to ~14bb) with AA at SPR 4.3 given pot odds; the calculation simplifies. Raise-size-specific branch would tighten.
  - Severity 1, P3.

### §9

- **F-9a** (P3): Hero's A-blockers are described qualitatively. Exact Ax-combo-containing-A♦-or-A♣ count not explicitly derived. "12-15 combos" is a rough bracket.
  - Fix: Per-Ax-class × A♦-or-A♣ fraction.
  - Severity 1, P3.

### §10

- **F-10a** (P2): **D15 applied correctly — POSITIVE (first corpus application).** §10.3-10.4 captures the range-vs-hand divergence cleanly: hero AA is range-top by preflop strength but only ~58% equity on this runout (not >80% nut-class). The reasoning-chain is explicit and prevents "it's AA so bet big" trap.
  - No fix needed. Cited as positive D15-formalization validation.

- **F-10b** (P3): Realization factor 0.75 is `assumed` from "standard OOP-wet-board table" without specific citation.
  - Fix: Cite specific realization table (PokerCoaching, Upswing, or Run It Once realization factor content).
  - Severity 1, P3.

### §11

- **Completeness gate present** with 57-claims log. Positive.

### §12

- **Clean.** Four assumptions with numeric flip thresholds. Action-robustness explicit.

### §13

- **Clean.** 10 sources, 10A verdict, D16 documentation present.

### §14a

- **Clean.** Mirror-node role-inverted (BTN-IP-3bettor); 2 invert + 3 stay + 1 partial. Under D8 cap.

### §14b

- **Clean.** Decision-level-robust statement justified.

### §14c

- **Clean.** Counter-artifact pointer specific (bet-variant + dry-variant).

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Backlog |
|---|---|---|---|---|---|
| 1 | F-2a — SB flat-3bet range load-bearing estimate | 2 | P2 | M | US-A11-F2a |
| 2 | F-3a — Hero equity Equilab tightening | 2 | P2 | S | US-A11-F3a |
| 3 | F-6a — 70pp delta-vs-population magnitude | 2 | P2 | M (data) | US-A11-F6a |
| 4 | F-8a — Turn-play EV per-turn-card breakdown | 2 | P2 | S | US-A11-F8a |
| 5 | F-10a — D15 positive (first corpus application) | — | Positive | — | — |
| 6 | F-2b — BTN 3bet per-class enumeration | 1 | P3 | S | — |
| 7 | F-3b — Equity variance per-turn enumeration | 1 | P3 | S | — |
| 8 | F-4a — Solver analog provenance | 1 | P3 | Observation | — |
| 9 | F-6b — Dist clean check | — | Ongoing | — | — |
| 10 | F-7a — Villain model per-class | 1 | P3 | S | — |
| 11 | F-8b — Raise-size-specific branch | 1 | P3 | S | — |
| 12 | F-9a — Blocker per-class derivation | 1 | P3 | S | — |
| 13 | F-10b — Realization table citation | 1 | P3 | S | — |

**Breakdown:** 0 P1, 4 P2, 9 P3 (+1 positive). YELLOW verdict reflects that 4 P2s exceed typical GREEN-artifact threshold of ≤3 P2s.

---

## Rubric-candidate tally

**No new rubric candidates.** v2.3 absorbed the D15-first-application cleanly. D18 (order-of-action MW) not applicable (HU). Current v2.3 is mature.

---

## LSW-audit cross-reference

LSW-A4 audit (`docs/design/audits/line-audits/sb-vs-btn-3bp-oop-wet-t98.md`) already closed. Artifact uses the post-F4 line state (hero.action: 'call' not 'fourBet'; AA "strong-but-vulnerable" framing not "bluff-catcher"; frameworks `range_morphology` + `board_tilt`).

**Inheritance from LSW-A4 resolved:**
- Schema declaration mismatch (fourBet → call): fixed upstream. Artifact doesn't re-surface.
- AA bluff-catcher framing: artifact explicitly reframes as "strong-but-vulnerable" (LSW-F4-A2 sitting in line content). Matching treatment.
- Solver-mix acknowledgment (10% small-polar-bet freq): captured in §4.3 and §6 delta-vs-solver.
- POKER_THEORY.md §9.3 divergence: inherited in §1 + §2.3 + closing note.

No new LSW-level content issues.

---

## Audit sign-off

**Verdict:** YELLOW (light). 4 P2s trigger YELLOW but none blocks downstream work. First D15 application successful. First "check correct" successful. First overpair-as-hero successful.

**Structural-diversity achievement:** this artifact represents the largest corpus-structural-expansion since artifact #1. Hand-class, decision-type, and texture-regime all new.

**Recommendation:** Proceed to Stage 4i + 5i. Queue P2 fixes (F-2a, F-3a, F-6a, F-8a) for batch polish pass. F-10a (D15 positive) is a milestone — first corpus D15-applicable → document in project memory.

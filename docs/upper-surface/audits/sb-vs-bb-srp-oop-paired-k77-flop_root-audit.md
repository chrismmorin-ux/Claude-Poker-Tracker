# Self-Audit — `sb-vs-bb-srp-oop-paired-k77-flop_root`

**Rubric:** v2.3. **Date:** 2026-04-23. **Verdict: GREEN (light).** 9 findings: 0 P1, 3 P2, 6 P3.

---

## Executive summary

First paired-board artifact in corpus. v2.3 D14 / D15 / D16 applied; D17 N/A (HU). v2.1 D10 first-pass enumeration discipline applied cleanly in §2.

**No new rubric candidates.** v2.3 absorbs all observed patterns smoothly. D18 (order-of-action MW) not reinforced (HU artifact).

**Headline findings.**
- **Texture-as-first-order-variable teaching clean.** The "paired rainbow → reduced nut advantage → small merged sizing" chain is well-captured across §3, §4, §6. §7 villain-perspective explicitly distinguishes merged-cbet interpretation from polar-cbet interpretation.
- **§2 range enumeration is dense but heuristic.** Combo counts are good-enough but some per-class sums don't precisely match their class labels (see F-2a, F-2b). No load-bearing claim fails; precision is P3-level.
- **Pot authored 5.5bb vs derived 6bb** logged as §11 row 1.2 but not itself a finding — matches convention across the drill-content corpus (all SRP nodes are authored at 5.5). Documented, not flagged.
- **D15 explicitly non-applicable** (second instance; validates D15 as trigger-check-not-always-required forcing constraint).

---

## Findings

### §1

- **F-1a** (P3): Pot 5.5 authored vs 6.0 derivation. Logged in §11 row 1.2 with internal-falsifier. Matches drill-content corpus convention. Not a unique flaw of this artifact.
  - **Fix:** No change required; observation preserved in ledger.
  - **Severity 1, P3.**

### §2

- **F-2a** (P2): **Hero's range combo aggregation uses informal sums that don't cleanly total 560.**
  - The flop-range decomposition table (§2, "Hero's range on K♠7♦7♣ — decomposition") lists hand classes with combo counts but sums only cross-check at the "rough totals" step with approximate language ("~560 combos"). A disciplined first-pass would compute the exact remaining-combo subtotal per class after board-card-conflict removal.
  - **Impact:** Downstream §3 equity computation uses bucket counts (305/85/6/15) derived loosely from these subtotals. The 82–84% weighted equity holds under ±3 pp CI.
  - **Fix:** Tighten per-class combo arithmetic with board-conflict explicit per class (e.g., "KK preflop = 6 combos − 2 K♠-containing combos = 3 remaining post-K♠-board"; "77 preflop = 6 combos − 3 for each 7-on-board × 2 = 0 combos remaining; but 77 with no board 7 = 6 − C(2,2 of 4) card conflict = hmm").
  - **Severity 2 (P2), effort S.** Backlog: `US-A10-F2a`.

- **F-2b** (P3): **BB cold-call range ±6pp CI may be wider than stated.** Live-cash BB defend rates are highly variable across stakes and player types. The ~35% figure is plausible at 2/5 live but could be 25% at 1/2 or 45% at 5/10.
  - **Fix:** Widen CI or stake-condition the claim.
  - **Severity 1, P3.**

- **F-2c** (P3): **Villain 7x suited trips combo count (~12) is a rough estimate** and depends on whether BB flats A7s, K7s, Q7s, J7s, T7s, 97s, 87s, 76s. Not all of these are in a standard live BB flat range.
  - **Fix:** Per-7x-class derivation. E.g., "A7s rarely flat (often 3bet blocker); Q7s flat ~70%; K7s flat ~70%; J7s flat ~50%; 97s flat ~80%; 87s flat ~60%; 76s flat ~80%. Total 7x suited ≈ 16 × 0.6 avg − hero blockers ≈ 10."
  - **Severity 1, P3.**

### §3

- **F-3a** (P3): **Equity bucket recount is iterative in-text rather than single-pass.**
  - The artifact first presents buckets with "Nuts >80% ~120 combos" etc., then notes "Actually let me recompute" and restarts — this signals good discipline (v2.1 D10 transparency) but is slightly distracting for a graded artifact.
  - **Fix:** Replace the iterative recount with a single clean pass.
  - **Severity 1, P3.**

### §4

- **F-4a** (P3): Solver cbet-33% frequency 60.2% is quoted directly from LSW-A3 secondary citation. The primary source (Getcoach article citing solver) is itself a secondary reference to solver output. Provenance-chain depth is 2 hops.
  - **Fix:** Acknowledge the provenance chain in the source-scope check; not a B-finding since no source scope mismatch.
  - **Severity 1, P3.**

### §5

- **F-5a** (P3): **`population-consensus-observed` applied correctly.** Positive finding. Doug Polk + Upswing + SplitSuit consensus; stated stake-scope in ≥1 source; sourcing-floor met. D14 precedent-reinforced.

- **F-5b** (P3): Row 5.4 BB check-raise live rate (~5–10%) is labeled `population-observed` with n≈0. Wide CI documented.
  - **Fix:** Confidence-floor note already implicit (via `population-observed` label) but not called out as a distinct §5 paragraph. Could tighten.
  - **Severity 1, P3.**

### §6

- **Clean.** Pre-drafting check performed (§4 + §5 authored first). Archetype-conditional note applied per v2.1 D11; Ed Miller station-exploit nuance absorbed into archetype note rather than buried in §12.

### §7

- **F-7a** (P3): Villain-EV claim "BB's average continuing-range equity ≈ 35–40%" is cited but the derivation (row 7.4) is `computed` without showing the enumeration inline.
  - **Fix:** Add a brief inline derivation in §7 prose linking to the §11 row.
  - **Severity 1, P3.**

### §8

- **F-8a** (P2): **Turn continuation EV is estimated, not computed.** The artifact states "Hero's expected turn continuation: bet 33-50% of pot on majority of turn cards, check-back pot-control on 1-2 edge cards" and aggregates to "~+5bb" without per-turn-card EV computation.
  - v2 D5 forcing constraint: "Depth-2 EV computations must show **per-runout-class breakdown** before summing to a weighted total."
  - **Impact:** The per-runout-class table IS present (turn card class distribution table), but the EV-per-turn-class column is missing. Only the equity-per-turn-class column is present.
  - **Fix:** Add EV-per-turn-class column with weighted sum. The current summary is EV-estimate-not-EV-computation.
  - **Severity 2 (P2), effort S.** Backlog: `US-A10-F8a`.

- **F-8b** (P2): **Raise-branch EV (−0.5 to 0bb) is asserted without derivation.** Similar to J85 artifact's F-8a — scenario E raise EV in MW case.
  - **Fix:** Show raise-branch decomposition: raise-size assumed (typically 3–4×), hero action tree (call vs fold AK), EV at each branch.
  - **Severity 2 (P2), effort S.** Backlog: `US-A10-F8b`.

### §9

- **Clean.** Blocker arithmetic correct. Net effect captured (+1pp equity, −2-3pp fold rate). Proper "no flip" conclusion.

### §10

- **F-10a** (P3): D15 non-applicability is cleanly articulated. Second corpus instance of explicit D15 non-applicability (first: J85 artifact #9). Validates D15 as a section-trigger-check, not always-required. Positive finding.

- **F-10b** (P3): **Realization factor 0.88 is asymmetrically justified.** Row 10.4 says "assumed" from "Standard OOP-IP realization table" but no specific table is cited. 
  - **Fix:** Cite PokerCoaching realization table or Upswing realization-factor article, or mark as `population-consensus-observed` based on multi-source consensus.
  - **Severity 1, P3.**

### §11

- **Completeness gate present** with sweep log: "55 claims ledgered". Positive.

- **F-11a** (P3): Row count is 55 but §11 would benefit from cross-reference columns (not in rubric format).
  - **Fix:** Optional polish.
  - **Severity 1, P3.**

### §12

- **Clean.** All four assumptions have numeric flip thresholds; action-robustness explicitly stated.

### §13

- **Clean.** 10 sources, 10A verdict. D16 documentation present (sources-count + 5 angles + closest-to-disagreeing). Ed Miller properly classified A-with-nuance (absorbed into §6 archetype note).

### §14a

- **Clean.** Mirror node role-inverted (BB-IP-defender). 2 inverts + 3 stays + 1 partial. Under D8 cap.

### §14b

- **Clean.** Decision-level-robust statement justified. No headline falsifier.

### §14c

- **Clean.** Counter-artifact pointer is specific (99 underpair variant would trigger D15).

---

## Prioritized fix list

| # | Finding | Severity | Priority | Effort | Backlog |
|---|---|---|---|---|---|
| 1 | F-2a — range combo aggregation tighter sum | 2 | P2 | S | US-A10-F2a |
| 2 | F-8a — turn per-runout-class EV column missing | 2 | P2 | S | US-A10-F8a |
| 3 | F-8b — raise-branch EV derivation | 2 | P2 | S | US-A10-F8b |
| 4 | F-1a — pot authored/derived gap | 1 | P3 | Observation | — |
| 5 | F-2b — BB range CI stake-condition | 1 | P3 | S | — |
| 6 | F-2c — 7x suited per-class | 1 | P3 | S | — |
| 7 | F-3a — §3 bucket iterative recount | 1 | P3 | S | — |
| 8 | F-4a — solver provenance chain depth | 1 | P3 | — | — |
| 9 | F-5b — confidence-floor note paragraph | 1 | P3 | S | — |
| 10 | F-7a — villain equity inline derivation | 1 | P3 | S | — |
| 11 | F-10a — D15 explicit non-applicability (positive) | — | Positive | — | — |
| 12 | F-10b — realization table citation | 1 | P3 | S | — |
| 13 | F-11a — cross-reference column polish | 1 | P3 | Optional | — |

**Breakdown:** 0 P1, 3 P2, 9 P3 (+1 positive).

---

## Rubric-candidate tally

No new candidates. D18 (order-of-action MW) not applicable (HU artifact). Current v2.3 handles this node cleanly.

---

## LSW-audit cross-reference

LSW-A3 audit (`docs/design/audits/line-audits/sb-vs-bb-srp-oop-paired-k77.md`) already closed with F3 shipped. All 4 LSW findings (position mismatch CO→SB, turn sizing 50→33, terminal pot reconciliation, villainAction ambiguity) resolved before this artifact was authored. Artifact uses the post-fix line state (SB-vs-BB; turn 33%; terminal pots 15.1).

No LSW-level content issues carry over.

---

## Audit sign-off

**Verdict:** GREEN (light). v2.3 continues to handle new texture classes cleanly. First paired-board artifact successful. 0 P1, 3 P2, 9 P3 — standard corpus-scaling distribution.

**Recommendation:** Proceed to Stage 4i (leading-theory comparison) and Stage 5i (drill card). Defer P2 fixes to batch LSW-G*-style polish pass.

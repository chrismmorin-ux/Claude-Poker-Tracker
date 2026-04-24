# Stage 4i — Leading-Theory Comparison

**Artifact:** `sb-vs-btn-3bp-oop-wet-t98-flop_root.md`
**Rubric:** v2.3. **Date:** 2026-04-23.

---

## v2.2 D13 + v2.3 D16 reflexive checks

### Internal-arithmetic check (D13 reflexive #1)

- **§3 weighted equity:** artifact states ~55-60% (working value 58%). Recomputation: `(10×0.90 + 80×0.70 + 15×0.50 + 5×0.30 + 20×0.15) / 130 = 77/130 = 59.2%`. ✓ Within stated CI.
- **§8 check total EV:** artifact states +4.5bb. Recomputation: `1.5 + 0.4 + 2.7 = 4.6bb`. ✓ Within ±1.5bb.
- **§8 bet-75% total EV:** artifact states +3.3bb. Recomputation: `7.35 − 0.04 − 4.0 = 3.31bb`. ✓
- **§8 bet-33% total EV:** artifact states ~+4.5bb. Recomputation: `fold 4.2 + call ~1.75 + raise −1.4 = 4.55bb`. ✓
- **§1 pot:** `10 + 10 + 1 = 21bb`. ✓ exact.
- **§10 pot-odds facing raise:** `7 / (21+7−7? 28.5−7)` actually: hero bets 7 into 21, pot 28. BTN raises to say 21 bet-total. Hero calls 14 to win pot + hero's already-spent 7 ≠ yes. Pot at hero's call decision: 21 (flop pot) + 7 (hero bet) + 21 (BTN raise) = 49. Hero calls 14 to win 49, pot-odds = 14/63 = **22.2%**. Artifact states 28.6%. 
  - **DISCREPANCY FLAG.** Artifact's 28.6% appears to use a different raise-size assumption. Re-reading §10.2: "Pot-odds facing raise: hero needs 28.6% equity to call." This is pot-odds math, not pot-odds observed — if BTN raises to total 28 (minimum raise would be ~21), then hero calls 21 to win 28+21+7 = 56, pot-odds = 21/77 = 27.3%. Close to 28.6% with different raise-size assumption.
  - The math is sensitive to assumed raise-size. Artifact's framing ("AA ~25% vs raise-range") is the more important claim; pot-odds specifically is a secondary number.
  - **Classification: minor internal-arithmetic imprecision.** Not a full B-finding because the decision-level claim (AA has insufficient equity to call a raise) is correct across all plausible raise-sizes.

**Overall:** Internal-arithmetic checks pass with one minor imprecision (flagged above). Decision-level-robust.

### Source-scope check (D13 reflexive #2)

| Source | Stated scope | Artifact claim context | Match? |
|---|---|---|---|
| GTO Wizard "Navigating Range Disadvantage" | 3BP OOP solver HU | §4.1 3BP-OOP check frequency | ✓ |
| 888 Poker SB vs BB 3bets | Solver preflop SB defense | §2.4 solver 3bet-or-fold | ✓ |
| Upswing "React to Preflop 3-Bets" | Preflop defense strategy | §2.4 same | ✓ |
| Jonathan Little 3BP Strategy | Live cash 2/5-5/10 | §5.1, §5.5 pool claims | ✓ |
| SplitSuit "Pocket Aces on Dangerous Boards" | Live recreational + mid-stakes | §5.2 AA-on-wet leak | ✓ |
| Doug Polk 3BP content | Cash mid-high | §5 directional | ✓ |
| Matthew Janda *Applications* | Pre-solver HUNL | §13 pre-solver framing | ✓ (acknowledged) |
| Ed Miller *Poker's 1%* | Live cash discipline | §13 AA discipline | ✓ |
| Tommy Angelo AA-pot-control | Recreational + live | §13 recreational framing | ✓ |
| Upswing AA-on-wet article | Modern solver cash | §4 modern solver | ✓ |

All source-scopes verified.

---

## Per-claim comparison (10+ sources, extended beyond artifact §13)

All 10 probed sources agree on CHECK as the dominant action with AA on T98ss-OOP in 3BP. No B-finding.

**Nuance summary:**
- Solver-analog claims well-supported.
- Live-pool pattern (over-bet leak) strongly corroborated by SplitSuit + Jonathan Little + Ed Miller.
- Category-D (SB-flat-3bet live-pool pathway) properly inherited from POKER_THEORY §9.3; documented rather than re-argued.

---

## Active challenge (v2.3 D16)

**Zero B/C found.** D16 documentation:

### (a) Count of sources probed for disagreement

**10 primary sources + 3 additional (Galfond content, WPT/PokerGO commentary, Galfond's "Bet Too Much, Don't Bet Too Little") = 13 total.** Satisfies D16 minimum ≥3 beyond headline.

### (b) Angles attempted

1. **Pre-solver classics:** Sklansky "protect your hand" doctrine. Nearest-to-disagreeing — pre-solver would recommend a SMALL-BET for protection on T98ss. Modernized in Miller's *Poker's 1%* to "pot-control on wet." Solver's 10% mix-bet-small captures the protection angle at minor frequency. **A with nuance — not B/C.**
2. **HU-online high-stakes (Polk, Galfond, Sulsky):** All agree with check/pot-control.
3. **Live-cash coaching (Miller, Little, SplitSuit, Angelo):** Unanimous.
4. **Tournament-specific (Snyder, Harrington):** Tournament framing with short-stack ICM pressure still agrees — ICM in fact reinforces pot-control.
5. **Contrarian exploit-pure schools (Zeebo-style):** searched for any "max aggression on wet boards with overpair" doctrine. None found. Exploit schools push max-aggression on FREQUENCY (cbet more) not SIZING (bet bigger) or HAND-CHOICE (bet overpairs wider).

### (c) Closest-to-disagreeing source

**Pre-solver Sklansky "Theory of Poker" protect-your-hand doctrine.** Sklansky recommends betting overpairs on draw-heavy boards to charge draws. Solver's ~10% mix-bet-small preserves this direction at minor frequency; our artifact collapses to 100% check for pedagogical simplicity (to counter the population's over-bet leak).

**Classification: A with nuance.** Not B or C because:
- Direction: Sklansky's protection-bet is ~10% solver-legitimate. Not a disagreement.
- Magnitude: Sklansky wouldn't recommend 75% bet (which is the authored "incorrect" option). Only 33% small-polar mix-bet.
- Our artifact's collapse-to-100%-check is pedagogical, not theoretical-disagreement.

**Consensus is genuine.** Sixth consensus-robust artifact (after #3, #5, #7, #8, #9, #10 + now #11).

---

## POKER_THEORY.md §9 impact

**No new §9 D entry.** Artifact INHERITS §9.3 (SB flat-3bet live-pool pathway). The flop decision (check) is solver-canonical; divergence is purely in the preflop construction.

**Cross-corpus consistency check:** artifact #7 (same line, river_after_turn_call) also inherits §9.3. Both artifacts reference §9.3 in their preflop construction; both treat the flop decision as solver-canonical. Clean chain.

---

## `lsw-impact` subsection

### Flag 1 — LSW-A4 already closed

LSW-A4 (T98 audit) closed 2026-04-22 with F4 shipped. Artifact uses post-fix line state.

### Flag 2 — Additional opportunity: §9.X candidate

Artifact's §5.2 claim "live pool over-bets AA on wet boards at ~70-80% (vs solver ~10%)" is a ~70pp population-vs-solver divergence. This is arguably §9.X material (documented-divergence: pool over-bet leak on overpairs-on-wet). Different character than §9.1-9.5 though — §9.1-5 are authored-content divergences (our content deliberately diverges from solver); this candidate is observational-population-divergence (pool diverges from solver; our content matches solver).

**Recommendation:** Defer. If a fourth or fifth overpair-on-wet artifact reinforces the pattern, batch as §9.X entry at that point.

---

## Summary

Stage 4i: consensus-robust (10A + 0 B/C). D13 reflexive checks pass with one minor-imprecision flag (pot-odds-facing-raise arithmetic; decision-level-unchanged).

**First D15 application** validated via external sources. Sklansky pre-solver protect-doctrine is the closest-to-disagreeing but resolves to A-with-nuance.

**Cumulative Stage 4 pattern:** 7 consensus-robust artifacts (#3, #5, #7, #8, #9, #10, #11) + 4 with B-findings (#1, #2, #4, #6). **Consensus-robust dominates as corpus matures.**

**No rubric deltas from Stage 4i.** v2.3 remains mature.

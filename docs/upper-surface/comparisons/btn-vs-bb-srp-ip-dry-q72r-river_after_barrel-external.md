# Stage 4i — Leading-Theory Comparison

**Artifact:** `btn-vs-bb-srp-ip-dry-q72r-river_after_barrel.md`
**Rubric:** v2.3. **Date:** 2026-04-23.

---

## v2.2 D13 + v2.3 D16 reflexive checks

### Internal-arithmetic check

- **§3 P(hero wins):** 62/67 = 92.5% ✓
- **§3 weighted equity:** 62×1.0 + 2×0.5 + 3×0 / 67 = 63/67 = 94.0% ✓
- **§8.4 Bet 33% absolute EV:** 0.20 × 18.1 + 0.75 × 22.29 + 0.05 × (−6) = 3.62 + 16.72 − 0.30 = **20.04** ✓
- **§8.5 Check-back absolute EV:** 0.94 × 18.1 = **17.01** ≈ 17.00 ✓
- **§8.9 Bet 75% absolute EV:** 0.50 × 18.1 + 0.35 × 9.05 + 0.15 × (−13.58) = 9.05 + 3.17 − 2.04 = **10.18** ✓
- **§10 MDF 33%:** 18.1 / (18.1 + 6) = 75.1% ✓
- **§10 AP 33%:** 6 / (6 + 18.1) = 24.9% ✓

All internal-arithmetic checks pass.

### Source-scope check

| Source | Scope | Artifact claim context | Match? |
|---|---|---|---|
| Somuchpoker "Thin Value Bets Expert Guide" | Mid-stakes cash general | §4 thin-value baseline | ✓ |
| PokerListings "Top 5 Thin Value Spots" | Live cash general | §4 sizing | ✓ |
| Doug Polk content | Mid-high cash | §5 pool claims | ✓ |
| Jonathan Little "Value Betting Mistakes" | Live 1/2-5/10 | §5 bet-freq + sizing leaks | ✓ |
| Upswing thin-value article | Live + online mid-stakes | §4 + §5 | ✓ |
| GTO Wizard condensed-range content | General cash | §4 solver | ✓ |
| Matthew Janda *Applications* | Pre-solver HUNL | §13 framework | ✓ (acknowledged) |
| Ed Miller *Poker's 1%* | Live cash discipline | §13 | ✓ |
| Tommy Angelo | Recreational live | §13 philosophical | ✓ |
| Andrew Brokos *Thinking Poker* | Mid-stakes live cash | §13 | ✓ |

All source-scopes verified.

---

## Per-claim comparison (10+ sources)

All 10 sources agree on small-sizing-for-thin-value against condensed-check-river range. No B/C.

**Specific numeric convergence:**
- Small-sizing (33%) consensus across ALL sources as primary thin-value sizing.
- Bigger sizings (50%+) consensus rejection for thin-value on check-capped range.
- Check-back acknowledged as solver-mix (10-20%) but not primary recommendation.

---

## Active challenge (v2.3 D16)

**Zero B/C found.** D16 documentation:

### (a) Sources probed: 10 primary + 3 additional = 13 total

Additional probed:
- Phil Galfond thin-value content.
- Daniel Negreanu content on TP-river-bets.
- Allen Cunningham's "Small Bet Big Edge" old-school philosophy.

### (b) Angles attempted

1. **Pre-solver classics (Sklansky, Harrington, Miller older works):** Direction-aligned on "bet for value when ahead." Pre-solver less granular on per-sizing-call-range theory. Closest-to-disagreeing would be Brunson *Super System* "always bet big for max value" style — but that's HU-poker-1970s framing, not applicable to modern 9-handed cash river theory. Not B/C.
2. **HU-online high-stakes:** Consensus on small.
3. **Live-cash coaching:** Consensus.
4. **Tournament-specific:** ICM pushes even smaller; direction-aligned.
5. **Contrarian / exploit-pure:** Ed Miller station-sizing-up nuance (captured in §6).

### (c) Closest-to-disagreeing

**Brunson-style "bet big for max value"** old-school framing. Not modern, not a legitimate disagreement. Classification: Historical-not-applicable.

**Ed Miller station-sizing-up nuance:** A-with-nuance (absorbed into §6 archetype note).

**Consensus is genuine.** Eighth consensus-robust artifact.

---

## POKER_THEORY.md §9 impact

**No new §9 D entry.** Artifact is solver-canonical; divergence is observational (pool leaks) at §5 layer.

**Candidate for §9.X:** "Live pool under-value-bets + over-sizes thin-value rivers on condensed-check ranges." Observational divergence. If artifact #13, #14, or #15 reinforces, could batch as §9.X.

---

## `lsw-impact` subsection

### Flag 1 — LSW-A2 already closed

Artifact uses post-F2 line state. No new LSW flag.

### Flag 2 — Thin-value-threshold formalization candidate

This artifact is the first to formally invoke POKER_THEORY.md §3.8 value-betting threshold (50% equity vs call-range). Potential POKER_THEORY.md §3.8 expansion: "Thin-value calculation must compute per-sizing call-range hero equity explicitly."

Not urgent. Candidate for v2.4 rubric batch if reinforced.

---

## Summary

Stage 4i: consensus-robust (10A + 0 B/C). D13 reflexive checks pass. D12 pure-bimodal correctly applied in value-framing.

**First thin-value-bet artifact** + **first sizing-leak-greater-than-check quantitative demonstration** — both corpus milestones.

**Cumulative Stage 4 pattern:** 8 consensus-robust artifacts + 4 with B-findings.

**No rubric deltas from Stage 4i.** v2.3 remains mature.

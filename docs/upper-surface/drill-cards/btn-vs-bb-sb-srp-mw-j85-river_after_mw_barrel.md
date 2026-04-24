---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/btn-vs-bb-sb-srp-mw-j85-river_after_mw_barrel.md
Source-Rubric: v2.3 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/btn-vs-bb-sb-srp-mw-j85-river_after_mw_barrel-external.md
Audit: docs/upper-surface/audits/btn-vs-bb-sb-srp-mw-j85-river_after_mw_barrel-audit.md
Authored: 2026-04-23
Word-count: ~245 (target ≤250)
---

# Drill Card — `btn-vs-bb-sb-srp-mw-j85-river_after_mw_barrel`

## Front (predict before flipping)

**Spot.** **3-way SRP MW, hero BTN IP.** 100bb eff. BTN 3 → SB call → BB call → flop J♠8♥5♦ (hero CHECKS back) → turn 2♣ (SB LEADS 50%, BTN calls, BB calls/folds ambiguous) → river **7♠** (brick). Pot 20bb. **Both villains check.** Hero **A♠J♣** (TPTK).

**Question.** Action + sizing?

---

## Back

### Action

**Bet 33% pot (~6.6bb) for thin value.** Single recommendation; robust across archetypes.

### Why (3 beats)

1. **Both villains signal weakness** [§7 D17]. SB led turn then gave up river (weak-capped); BB checked behind (passive-pair). Combined range: 87 combos, pair-heavy + missed-Ax + busted. Hero ~76% equity.
2. **"Bluff less, value MORE" in MW** [§4 Claim 3]. HU value-betting has one caller; MW can have two (compounded call-equity). Value-bet frequency should go WIDER in MW, not narrower. Pool under-bets by ~55pp (bets ~45%; solver ~90%).
3. **Joint-call ~70-80%** [§7 row 7.5]. Third-in-pot over-defense inflates MW calling. Thin-value prints across Scenarios B+C+D (one-or-both call with compounding call-equity). Bet-33% EV +17.6; check +15.2; delta **+2.4bb**.

### Pivot (sensitivity)

**§12 action-robust.** Bet vs check stays across fish/reg/pro/nit. **Sizing-level (33% vs overbet) is close-call** — MW fold-equity partially rescues overbet. Overbet EV ~+16.3bb (only 1.3bb worse than 33%). **C-incomplete finding** (§13): authored teaching overstates overbet leak magnitude.

### Falsification

**§14b: Bet vs check robust; sizing 33% vs overbet close-call.** If MW joint-fold-equity at overbet sizing ever exceeds ~70%, overbet could become optimal. **First C-incomplete since #6.**

### Where to dig deeper

§2 (**D17 three-range + combined 87 combos**) · §7 (**two villain subsections + joint synthesis + D18 candidate sequential-signal**) · §8 (**D17 scenario-grouping: Both-fold 20% / SB-fold 30% / SB-call 15% / Both-call 25% / Raise 10%**) · §10 (joint MDF 75.2%, close to pool defense; AP 24.8% at bluff threshold) · §13 (**C-incomplete on MW overbet-leak magnitude**)

### Corpus note

**FIRST MW RIVER + FIRST C-INCOMPLETE SINCE #6 + D18 THIRD DATA POINT.** HU-vs-MW contrast: #12 HU overbet loses ~10bb; #13 MW overbet loses only ~1.3bb (MW fold-equity rescue). **MW value-betting theory not just HU extended.**

---

### Faithfulness check

| Card claim | Anchor |
|---|---|
| "Bet 33% correct" | §6 + lines.js |
| "Hero ~76% equity" | §3 row 3.3 |
| "87 combos post-blocker" | §2 row 2.11 |
| "Joint call ~70-80%" | §7 row 7.5 |
| "Bet-33% EV +17.6bb" | §11 row 8.11 |
| "Check EV +15.2bb" | §11 row 8.12 |
| "Overbet EV +16.3bb (C-incomplete)" | §11 row 8.13 + §13 |
| "Delta bet-33% vs check +2.4bb" | §11 row 8.14 |
| "Delta bet-33% vs overbet +1.3bb" | §11 row 8.15 |
| "MW bluff-less-value-more" | §4 Claim 3 |
| "Joint MDF 75.2%" | §11 row 10.1 |
| "D18 candidate 3rd data point" | Closing notes |
| "D15 N/A" | §11 row 10.5 |

All claims grep-traceable.

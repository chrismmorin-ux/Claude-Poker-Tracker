---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/btn-vs-bb-srp-ip-dry-q72r-river_after_barrel.md
Source-Rubric: v2.3 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/btn-vs-bb-srp-ip-dry-q72r-river_after_barrel-external.md
Audit: docs/upper-surface/audits/btn-vs-bb-srp-ip-dry-q72r-river_after_barrel-audit.md
LSW-Audit: docs/design/audits/line-audits/btn-vs-bb-srp-ip-dry-q72r.md (LSW-A2 closed)
Authored: 2026-04-23
Word-count: ~245 (target ≤250)
---

# Drill Card — `btn-vs-bb-srp-ip-dry-q72r-river_after_barrel`

## Front (predict before flipping)

**Spot.** **HU SRP, hero BTN IP.** 100bb eff. BTN open → BB call → flop Q♠7♥2♣ cbet 33% called → turn 3♦ barrel 50% called → river **8♠** (brick). Pot 18.1bb. BB **checks**. Hero **A♠Q♣** (TPTK throughout).

**Question.** Action + sizing?

---

## Back

### Action

**Bet 33% pot (~6bb) for thin value.** Single recommendation; robust across fish/reg/pro (nit-override: check-back).

### Why (3 beats)

1. **Villain range condensed to pair-heavy** [§2 rows 2.5-2.11]. 65 combos after multi-street filter + river check: 22 Qx + 19 mid-pairs + 4 low-pairs + 3 small-pair + 13 A-high + 3 sets (trap-half) + ~1 busted. Hero dominates most of this.
2. **Hero ~94% equity at showdown** [§3 row 3.4, D12 pure-bimodal]. 62 combos hero beats / 67 total. Value-bet frame; not bluff-catch, not check-back-equity.
3. **Sizing leak is LARGER THAN check-back** [§8 row 8.11]. Bet-75% loses ~10bb vs bet-33% because larger sizing folds out the pair-heavy class (~22 Qx + ~19 mid-pairs) hero targets; only strong-Qx + sets + JJ call at 75%, where hero equity drops to ~50%. **Size down, not up.**

### Pivot (sensitivity)

**§12 action-robust across fish/reg/pro.** Nit-override: check-back 40% (nits fold too much; small-bet doesn't print against confirmed-nit). Only legitimate action-flip in §12.

### Falsification

**§14b: No action-level headline falsifiers** vs typical-pool archetype. Nit-override is archetype-conditional, handled at §6. **Eighth consensus-robust corpus artifact.**

### Where to dig deeper

§3 (**D12 pure-bimodal P(hero wins) = 62/67 = 93%**) · §8 (**3-sizing × 3-branch EV tree**: Bet-33% +20bb, Check +17bb, Bet-75% +10bb) · §10 (**thin-value threshold: hero-vs-call-range equity >50%**; 33% call-range gives 93%; 75% call-range gives 50%) · §7 (BB's capped-check-range = "hero mostly has me; I'll see if I need to pay one more")

### Corpus note

**FIRST THIN-VALUE-BET + FIRST SIZING-LEAK-GREATER-THAN-CHECK.** Inverse of normal teaching — bigger bets LOSE more than checking on condensed ranges. Full Q72r line now in corpus: #5 turn barrel, #4 river bluff-catch (alt-path), #12 river thin-value (this path). Value-betting threshold (POKER_THEORY §3.8) first formally invoked.

---

### Faithfulness check

| Card claim | Anchor |
|---|---|
| "Bet 33% correct" | §6 + lines.js river_after_barrel.decision |
| "Hero ~94% equity" | §3 row 3.4, §11 |
| "62/67 hero beats at showdown" | §3, §11 rows 3.1-3.3 |
| "BB range 65 combos" | §2 row 2.5 |
| "22 Qx + 19 mid-pairs + 4 low-pairs" | §2 rows 2.7-2.9 |
| "3 sets (trap-half)" | §2 row 2.6 |
| "Hero equity vs 33% call-range 93%" | §10 row 10.6 |
| "Hero equity vs 75% call-range 50%" | §10 row 10.7 |
| "Bet-33% EV +20.04" | §11 row 8.4 |
| "Check-back EV +17.00" | §11 row 8.5 |
| "Bet-75% EV +10.18" | §11 row 8.9 |
| "Thin-value threshold 50%" | §10 row 10.5 |
| "Nit-override check-back" | §6 archetype note |
| "D12 pure-bimodal river" | §3, §11 row 3.5 |
| "D15 N/A" | §11 row 10.8 |

All claims grep-traceable.

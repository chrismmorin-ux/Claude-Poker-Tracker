---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/utg-vs-btn-squeeze-mp-caller-pre_root.md
Source-Rubric: v2.3 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/utg-vs-btn-squeeze-mp-caller-pre_root-external.md
Audit: docs/upper-surface/audits/utg-vs-btn-squeeze-mp-caller-pre_root-audit.md
Authored: 2026-04-23
Word-count: ~245 (target ≤250)
---

# Drill Card — `utg-vs-btn-squeeze-mp-caller-pre_root`

## Front (predict before flipping)

**Spot.** **Preflop 3-way 3BP (squeeze).** Hero **UTG (OOP)**, 100bb. Action: UTG open 3 → MP1 call 3 → BTN squeeze 13 → SB/BB fold → MP1 still to act behind hero. Pot 20.5bb. Hero **Q♠Q♥** (pocket queens).

**Question.** Action with hero's hand?

---

## Back

### Action

**4bet to 30bb** (~2.3x BTN's squeeze). Single recommendation; action-level-robust per §12.

### Why (3 beats)

1. **Hero QQ has ~48% equity vs BTN's post-blocker squeeze range** [§3, row 3.6]. Hero's Q-blockers remove ~5 of 6 QQ combos from BTN's value, shifting BTN's value:bluff from ~55:45 to ~48:52 — blocker-favorable.
2. **Joint fold equity of 4bet ≈ 51%** [§11 row 7.4]. MP1 folds ~93% vs 4bet; BTN folds ~55% of squeeze range (bluffs gone). Joint MDF threshold (v2.3 D17) for BTN auto-profit was 50%; hero's 4bet breaks it.
3. **Call/fold are worse.** Fold concedes -3bb baseline. Call opens 3-way-to-flop where MP1's overcall/cold-4bet destroys equity realization; call EV ~+3-4bb. **4bet EV ~+7bb.**

### Pivot (sensitivity)

**§12 all assumptions robust.** BTN archetype (nit/reg/fish/maniac) doesn't flip 4bet; MP1 overcall/cold-4bet rate doesn't flip 4bet; sizing (~25-35bb) doesn't flip. **Decision-level-robust.**

### Falsification

**§14b: No action-level headline falsifiers.** Recommendation is robust across all §11 credible intervals. This is the 3rd corpus artifact with "decision-level-robust" §14b framing.

### Where to dig deeper

§2 (**first v1.1 D3 preflop-exception**) · §7 (two-villain + joint synthesis + order-of-action flagged) · §8 (**v2.3 D17 scenario-grouping**: 5 scenarios from 9 combinations) · §10 (**joint MDF = 50%** decision-relevant) · §13 (D16 search-depth: 12 sources, 5 angles, 0 B/C) · §9 (hero's Q-blockers strong)

### Corpus note

**First preflop + second multi-way artifact.** v2.3-native — all D14-D17 exercised in authoring. **One D18 candidate flagged** (order-of-action in MW §7; light; deferred).

---

### Faithfulness check (mechanical anchor map)

| Card claim | Source anchor |
|---|---|
| "48% equity post-blocker" | §3, §11 row 3.6 |
| "Q-blockers shift value:bluff 55→48" | §9, §11 row 9.4 |
| "Joint fold equity 51%" | §11 row 7.4 |
| "Joint MDF 50%" | §11 row 10.3 |
| "4bet EV +7bb" | §11 row 8.9 |
| "Call EV +3-4bb" | §11 row 8.10 |
| "BTN range composition 70:30" | §11 row 2.6 (D14 consensus-observed) |
| "MP1 fold-to-4bet 93%" | §11 row 5.3 |
| "12 sources, 0 B/C, D16 applied" | §13 |

All claims grep-traceable.

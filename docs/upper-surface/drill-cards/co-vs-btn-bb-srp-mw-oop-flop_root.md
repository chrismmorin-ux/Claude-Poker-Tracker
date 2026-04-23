---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/co-vs-btn-bb-srp-mw-oop-flop_root.md
Source-Rubric: v2.2 (MW extensions ad-hoc)
Stage-4-Comparison: docs/upper-surface/comparisons/co-vs-btn-bb-srp-mw-oop-flop_root-external.md
Audit: docs/upper-surface/audits/co-vs-btn-bb-srp-mw-oop-flop_root-audit.md
Authored: 2026-04-23
Word-count: ~240 (target ≤250)
---

# Drill Card — `co-vs-btn-bb-srp-mw-oop-flop_root`

## Front (predict before flipping)

**Spot.** 3-way SRP. Hero **CO (OOP sandwiched)**. 100bb effective. Preflop: CO open 2.5 → BTN flat → BB call. Flop **Q♥5♠3♦** (rainbow dry high-card). BB **checks**. BTN yet to act. Hero **A♠Q♣** (TPTK). Pot 10bb.

**Question.** Action with hero's hand?

---

## Back

### Action

**Cbet 50% pot (~5bb).** Single recommendation; action-level-robust across archetype mix.

### Why (3 beats)

1. **Hero has ~80% equity vs combined villain range** [§3, row 3.8]. Both villains' ranges are pair-heavy + broadway-miss-heavy; TPTK dominates the entire pool except sets + chop-AQ. Hero is clearly value-betting.
2. **Joint fold equity ~36%** at 50% cbet [§10, §11 row 7.3]. BB folds ~45% (broadway misses, marginal equity); BTN folds ~65% (tight vs 2 opponents). Cbet is auto-profitable at joint MDF threshold 33% — we clear it.
3. **Solver slightly prefers 33% sizing** (C-incomplete per §13) but 50% is pedagogically cleaner and **extracts more per-call value** from population-wider-calling BB + BTN.

### Pivot (sensitivity)

**§12 Assumption A.** If villains' call rates suggest joint-fold-equity drops below ~25%, cbet-33% EV overtakes cbet-50%. **Sizing could flip from 50% to 33%; action stays cbet.** Archetype doesn't flip action.

### Falsification

**§14b single headline falsifier (sizing-sensitive, action-robust).** 200+ hand sample of MW-cbet responses showing BB-call-rate + BTN-call-rate combined at ≥75% would flip sizing to 33%. Action (cbet) remains correct across all credible intervals.

### Where to dig deeper

§2 (3-player range construction) · §3 (~80% equity vs combined range) · §7 (**two villain perspectives** — BB model + BTN model + joint-fold synthesis) · §8 (4-scenario branch grouping: both-fold 36%, BB-folds-BTN-calls 19%, BB-calls-BTN-folds 34%, both-call 11%) · §10 (**joint MDF** novel concept) · §14b (sizing-sensitive, action-robust)

### Corpus note

**First multi-way artifact** in corpus. Rubric v2.2 stretched to accommodate 3-player dynamics; D17 candidate (MW extensions) proposed.

---

### Faithfulness check (mechanical anchor map)

| Card claim | Source anchor |
|---|---|
| "~80% equity vs combined" | §3, §11 row 3.8 |
| "Joint fold equity 36%" | §11 row 7.3, §10 |
| "BB/BTN fold rates 45%/65%" | §11 rows 5.2, 5.3 |
| "Solver 33% sizing preference" | §13 C-incomplete, §11 row 4.3 |
| "MDF threshold 33%" | §10, §11 row 10.2 |
| "Cbet-50% EV +7.07" | §11 row 8.5 |
| "Cbet-33% EV ~+6" | §11 row 8.6 |
| "Sizing-sensitivity falsifier" | §14b headline falsifier 1 |

All claims grep-traceable.

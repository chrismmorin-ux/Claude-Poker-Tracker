---
Drill-Card-Version: v1
Source-Artifact: docs/upper-surface/reasoning-artifacts/sb-vs-bb-srp-oop-paired-k77-flop_root.md
Source-Rubric: v2.3 (native)
Stage-4-Comparison: docs/upper-surface/comparisons/sb-vs-bb-srp-oop-paired-k77-flop_root-external.md
Audit: docs/upper-surface/audits/sb-vs-bb-srp-oop-paired-k77-flop_root-audit.md
LSW-Audit: docs/design/audits/line-audits/sb-vs-bb-srp-oop-paired-k77.md (LSW-A3 closed)
Authored: 2026-04-23
Word-count: ~245 (target ≤250)
---

# Drill Card — `sb-vs-bb-srp-oop-paired-k77-flop_root`

## Front (predict before flipping)

**Spot.** **HU SRP, hero SB (OOP).** 100bb effective. Preflop: SB open 3 → BB call. Flop **K♠7♦7♣** paired rainbow. Pot 5.5bb. Hero **A♥K♦** (TPTK). Hero acts first.

**Question.** Action + sizing?

---

## Back

### Action

**Cbet 33% pot (~1.8bb) — merged sizing.** Single recommendation; action-robust across archetypes.

### Why (3 beats)

1. **Highest-whiff-rate board class + reduced nut advantage** drives merged small sizing. [§4 row 4.1: solver 33%-cbet at 60.2%, check 32.9%, 67%-cbet only 6.2%.] Villain has few Kx, few 7x — range of mostly-whiffed A-high + small pairs + broadway misses. Small sizing charges the widest call range.
2. **Hero ~82% equity vs villain full range** [§3 row 3.10]. TPTK dominates all pair-below-K + all A-high + all air. A few 7x trips beat hero, but nut-bucket is tiny (~15 combos out of 411). Value frame.
3. **Pool over-sizes on paired** [§5 row 5.2]. HU-players transplant unpaired-board polar sizing (50-75%) onto paired textures. Our 33% sizing-discipline IS the exploit — not "cbet less," but "cbet at the right size."

### Pivot (sensitivity)

**§12 action-robust across all 4 assumptions.** Fold-rate 0% still keeps cbet +EV (hero has 82% when called). Archetype flip to fish/station → sizing up to 50% (same action, size adjusts). No flip threshold within any CI.

### Falsification

**§14b: No action-level headline falsifiers.** Decision-level-robust. Only sizing-pivot is archetype-vs-station. **Sixth consensus-robust corpus artifact** (#3, #5, #7, #8, #9 + #10).

### Where to dig deeper

§2 (**first paired-board artifact** — 415 post-blocker combos; 305 hero-dominates at 90%+) · §3 (**right-skewed distribution not bimodal**; justifies merged-small sizing structurally) · §4 (solver 60.2%/32.9%/6.2% split) · §7 (BB interprets 33% as merged-canon; 75% as inconsistent-polar) · §10 (**D15 N/A** — TPTK is range-top AND individual-correct)

### Corpus note

**FIRST PAIRED-BOARD ARTIFACT.** First hero-SB-OOP-as-PFA. First merged-range cbet study. Texture = first-order variable: paired → small-merged; unpaired-dry → medium-polar; wet-connected → large-polar.

---

### Faithfulness check

| Card claim | Anchor |
|---|---|
| "Cbet 33% correct" | §6 + lines.js flop_root.decision |
| "82% hero equity" | §3 row 3.10, §11 |
| "Solver 33%=60.2%, check=32.9%, 67%=6.2%" | §4 rows 4.1-4.3 (LSW-A3 source) |
| "Cbet-33% EV +5.0" | §11 row 8.9 |
| "Cbet-67% EV +3.75" | §11 row 8.10 |
| "Check-back EV +3.25" | §11 row 8.11 |
| "Delta over 67%: +1.25bb" | §11 row 8.12 |
| "Delta over check: +1.75bb" | §11 row 8.13 |
| "Highest-whiff-rate board class" | §3 shape + §4 Claim 2 |
| "Reduced nut advantage → small sizing" | §4 Claim 2 |
| "Pool over-sizes 50-75%" | §5 Claim 2 + row 5.2 |
| "D15 N/A" | §10.6 + §11 row 10.6 |
| "Fold rate ~50% live" | §5 row 5.3 |

All claims grep-traceable.

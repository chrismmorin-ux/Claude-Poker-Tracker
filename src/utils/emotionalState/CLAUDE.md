# Emotional State Engine — Domain Rules

**MANDATORY**: Before editing ANY file in this directory, read:
1. `.claude/context/POKER_THEORY.md` §1.4 (equity realization), §3 (postflop), §5.8 (trap problem)
2. `docs/projects/exploit-deviation/schema.md` §3 (`EmotionalState` + fear/greed as two dimensions) — authoritative
3. `docs/projects/exploit-deviation/theory-roundtable.md` Stage 6 + Stage 7 (fear/greed rationale + coefficient priors)

This module computes per-node `EmotionalState` objects as a **two-dimensional** (fear, greed) reshape operator on villain's decision distribution. It is consumed by `citedDecision/` as a secondary transform applied AFTER assumption operators. The joint distribution is preserved per owner directive 2026-04-23 — do not collapse to a signed axis.

---

## Core Principles

### 1. Two dimensions, not one (OWNER DIRECTIVE)
Fear and greed are **separate indices**. A villain can populate any of the four quadrants (low-fear low-greed, low-fear high-greed, high-fear low-greed, **high-fear AND high-greed** — e.g., top pair on a 4-flush board). The joint tuple `[fearIndex, greedIndex]` is persisted on every `CitedDecision` per schema §5 for later quadrant-distribution analysis.

Owner explicitly stated (2026-04-23): "I'm interested to see how the data falls on this." Do NOT collapse the two axes for downstream logic. A `netTilt` field exists as a derived convenience, not as a primary decision input.

### 2. Range-weighted, not holding-specific
Hero doesn't see villain's cards. Fear and greed are computed over villain's **range** at the node:

```
expectedFear  = Σ P(combo ∈ range | action-history) · fearIndex(combo, state)
expectedGreed = Σ P(combo ∈ range | action-history) · greedIndex(combo, state)
```

`P(combo ∈ range | action-history)` comes from the existing `rangeEngine/` via `rangeProfile.js` and `comboEnumeration.js`. This module is **additive** — do not rewrite range semantics.

### 3. Literature-informed priors, not fabricated magnitudes
Fear coefficient `k = 8` (per 0.1 fearIndex increment → +2% fold%) is derived from solver equity-realization literature — specifically the ~8% realization drop on 4-flush boards for non-flush holdings. Greed coefficient `k = 6`. Per-style multipliers (Fish × 1.4, Nit × 0.7, LAG × 1.1, TAG × 1.0) reflect Exploit Theorist observation that amateur players feel emotion more strongly.

Do NOT invent coefficients. Starting priors come from solver literature. Adjustments come from Tier-2 calibration (see `calibration.md` §3.3 conservative-ceiling rule).

### 4. Version-stamped transforms
`EmotionalTiltTransform.version` is a first-class schema field. Calibration can bump the version without breaking persisted assumptions. See schema §3.3.

### 5. Conservative ceiling is automatic
When Tier-2 calibration gap > 0.25 for a predicate that uses emotional triggers, coefficients scale down per-predicate until gap ≤ 0.25. Persisted as `predicateTransformScale[predicateKey]` — audit-visible so over-fitting is spotted.

---

## Anti-Patterns

### DO NOT collapse fear + greed into a signed axis for decision logic
`netTilt = greed - fear` is a **convenience field**, not a primary metric. Using it as the sole downstream input loses the quadrant distinction. High-fear high-greed amateurs behave differently than low-fear low-greed pros even when `netTilt` is similar.

### DO NOT use per-holding emotional state — use range-weighted
Hero doesn't know villain's hand. Computing `fearIndex(villainHolding)` assumes information hero doesn't have. Always iterate villain's range and probability-weight.

### DO NOT invent coefficients
Starting coefficients are literature-sourced (solver equity-realization studies). Changing them without Tier-2 evidence is speculation. The conservative-ceiling rule scales down automatically; manual overrides require version bump + documented rationale.

### DO NOT stack emotional tilt on top of observed tendency deltas
If villain's observed fold rate already reflects their fear response (e.g., fish overfold on scare cards measurably), applying the fear-coefficient ON TOP double-counts the behavioral signal. The emotional transform reshapes the BASELINE distribution, not the assumption-mutated distribution's tendency-derived components. See architecture §5 I-AE-7 typing rule by analogy.

### DO NOT compute emotional state for hero from villain range
Hero-side fear/greed (per schema §6) is a **separate computation** using hero's session context (P/L, prior sessions, declared mood). It does NOT read villain's range. Hero-side assumptions never render live per I-AE-2; they are drill-only.

### DO NOT skip cache invalidation on hand transition
`EmotionalState` is cached per node in `assumptionReducer` state. New hand (`hand:new` trigger) must invalidate the cache. Stale emotional state on a fresh hand produces wrong tilt for what is now a different decision.

### DO NOT allow fear + greed to exceed their caps
Compound cap: fear contributes at most +25% fold, greed contributes at most +20% raise. Capping is per-dimension, not joint. A high-fear high-greed node still respects both caps independently.

---

## Key Concepts

### `fearIndex` computation inputs
- `rangePositionBottomShare` — how much of villain's range is in the bottom 30%
- `textureShift_against_combo` — did the turn/river scare villain's combo?
- `drawCompletion_against_combo` — did a draw hero might have complete?
- `sprDynamic_for_combo` — high SPR + marginal equity = elevated fear
- `rangeCapping` — does action history cap combo's credible range?

### `greedIndex` computation inputs
- `rangePositionTopShare` — how much of villain's range is in the top 15%
- `textureShift_for_combo` — did the texture help this combo?
- `sprDynamic_for_combo` — low SPR + top-of-range = elevated greed
- `sessionContext_heater` — villain session-level winning magnitude

### Literature priors
- Fear coefficient k = 8 (per 0.1 fearIndex → +2% fold)
- Greed coefficient k = 6 (per 0.1 greedIndex → +1.5% raise)
- Compound caps: +25% fold, +20% raise
- Per-style multipliers: Fish 1.4×, Nit 0.7×, LAG 1.1×, TAG 1.0×
- All values calibration-tunable per `calibration.md` §3.3

### Emotional-tilt transform schema
```ts
interface EmotionalTiltTransform {
  version: "1.0"
  fearCoefficient: 8
  greedCoefficient: 6
  fearFoldCap: 0.25
  greedRaiseCap: 0.20
  styleMultipliers: { Fish: 1.4, Nit: 0.7, LAG: 1.1, TAG: 1.0, Unknown: 1.0 }
  conservativeCeilingRule: { triggerGap: 0.25 }
}
```

---

## File Responsibilities (planned per architecture §2.1)

| File | Does | Does NOT | Commit |
|------|------|----------|--------|
| `index.js` | Public API — `computeEmotionalState`, `applyEmotionalTilt` | Internal computation | 1 (stub) → 2 (real) |
| `emotionalStateComputer.js` | Range-weighted fear + greed aggregation | Per-combo logic | 2 |
| `fearIndex.js` | Per-combo + range-weighted fear | Greed | 2 |
| `greedIndex.js` | Per-combo + range-weighted greed | Fear | 2 |
| `tiltTransform.js` | Apply emotional tilt to a decision distribution | Computation or caching | 2 |

Scaffolding (this commit) creates only `CLAUDE.md` + `index.js` stub.

---

## Related docs

- `docs/projects/exploit-deviation/schema.md` §3 — `EmotionalState` spec
- `docs/projects/exploit-deviation/theory-roundtable.md` Stage 6 — joint distribution rationale
- `docs/projects/exploit-deviation/theory-roundtable.md` Stage 7 — coefficient rationale
- `docs/projects/exploit-deviation/canonical-assumptions.md` — Examples 4 (fear-exploit) + 5 (greed-blind) show emotional triggers in action
- `assumptionEngine/CLAUDE.md` — sibling module (consumer of this module's output via `citedDecision/`)

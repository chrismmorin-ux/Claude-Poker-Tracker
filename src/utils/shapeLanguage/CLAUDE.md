# shapeLanguage/ — Domain Rules

**MANDATORY**: Before editing ANY file in this directory, read:

1. `.claude/context/POKER_THEORY.md` §7 — first-principles decision modeling.
2. `docs/projects/poker-shape-language.project.md` — Stream B1 scope + 10-descriptor catalog.
3. `docs/projects/poker-shape-language/roundtable.md` — silhouette prototype taxonomy + T6 compound-label verdict.
4. `docs/design/contracts/shape-mastery.md` — adjacent domain (user-skill state); this module is independent of it.
5. `src/constants/shapeMasteryConstants.js` — `SHAPE_DESCRIPTOR_CATALOG` (the canonical descriptor IDs this directory's classifiers populate).

This directory is the **classifier primitive layer** of the Shape Language System. It owns:

- Pure-math feature extractors on 169-cell preflop range grids (`gridFeatures.js`).
- Prototype signature constants for each descriptor (`silhouettePrototypes.js` for Range Silhouette; sibling modules for future descriptors).
- The classifier orchestration that produces `{label, confidence, prototypeScores, features, components?}` from a grid (`silhouetteClassifier.js`).
- The lesson registry that loads markdown content from `docs/projects/poker-shape-language/lessons/*.md` (`lessonRegistry.js`).

It does NOT own:

- The mastery state (Bayesian posterior over user knowledge) — that lives at `src/utils/skillAssessment/shapeLanguage/`.
- Any IDB persistence — pure-math only.
- Any React components — those live with their surface (e.g., `HandReplayView/RangeSilhouetteSection.jsx`).
- Decision-driving logic — classifiers describe range geometry; they never produce strategic recommendations.

## Core principles

### 1. Labels are derived OUTPUTS, never decision INPUTS

The classifier produces labels (Oval / Barbell / Triangle / Comb / Cloud / compound). These labels are presentation-only. They MUST NEVER be:

- Used as inputs to villain modeling (range-update weights, exploit recommendations).
- Used as inputs to hero advice (action selection, sizing).
- Used as features in any decision-driving computation.

Villain decisions derive from equity, pot odds, SPR, and players remaining per POKER_THEORY.md §7 + `feedback_first_principles_decisions.md`. If a downstream module wants to read silhouette labels, it must be a presentation surface (HandReplay descriptor row, lesson runner, transparency panel), not a strategy engine.

**Test target**: grep for imports of this module from `src/utils/exploitEngine/` or `src/utils/rangeEngine/` — those imports are forbidden. Only `src/components/views/` and `src/utils/skillAssessment/shapeLanguage/` (read-only descriptive use) may import.

### 2. Pure-math only

Every function in this directory is a pure transformation: input → output, no side effects. No `fetch`, no `dispatch`, no `localStorage`, no `import.meta.glob` outside the explicit lesson loader. Same input → same output, every time.

### 3. Prototype signatures are calibration constants

`silhouettePrototypes.js` defines each prototype's target feature vector + per-feature weight as hand-calibrated constants. They are NOT learned weights. Calibration evolves via:

1. Adding a fixture test for a real-world range that the classifier mislabels.
2. Adjusting targets + weights to fix the fixture.
3. Verifying all existing fixtures still pass.

Never auto-tune from production data — that creates a feedback loop where the classifier's labels become inputs to its own training, drifting away from the descriptive purpose.

### 4. Compound labels are principled, not fallbacks

Per the SLS Gate 2 roundtable T6 verdict: when the top-2 prototype probabilities are within `COMPOUND_DELTA` (default 0.15) of each other, the classifier returns `label: 'compound'` with `components: [top1, top2]`. This is the correct behavior — a flipping single-label classifier (Polarized one frame, Merged the next, as the range shifts incrementally) is worse than a stable compound label.

If you find yourself wanting to suppress compound labels or force a single-label output, you're fighting the design. Surface the compound clearly in UI; do not hide it.

### 5. Range matrix layout follows `rangeMatrix.js`

Input is a 169-cell `Float64Array` with weights in [0, 1]. The grid layout follows `src/utils/pokerCore/rangeMatrix.js`:

- Rank indices: 0=2, ..., 12=A.
- Pair index: `r * 13 + r` (diagonal).
- Suited index: `high * 13 + low` (high > low, upper triangle).
- Offsuit index: `low * 13 + high` (lower triangle).

Any feature extractor that needs to know which cells are pairs / suited / offsuit must use this convention. Do not introduce a competing layout.

## Anti-patterns

### DO NOT use silhouette labels as decision inputs

Stated under principle 1, restated because it's the load-bearing rule. A flag in an exploit recommendation like `if (silhouette === 'barbell') foldRate *= 1.1` is a violation of POKER_THEORY.md §7. Compute villain frequencies from the underlying range geometry, equity, and pot odds — not from the silhouette label.

### DO NOT learn the prototype signatures

`silhouettePrototypes.js` constants are calibrated, not learned. Auto-tuning them from production data creates a feedback loop: the classifier produces labels, those labels filter into "improved" training data, the prototype drifts toward whatever the classifier was already saying. Calibration is hand-driven via fixture tests.

### DO NOT bypass the sparse-input guard

The classifier returns `label: 'empty'` when `totalMass < MIN_CLASSIFIABLE_MASS`. This guard exists because forcing a label on a near-empty grid produces misleading confidence. Surfaces must check `label !== 'empty'` before rendering — do not paper over the empty case in the classifier itself.

### DO NOT introduce a "polarized" or "merged" label separate from the 5-prototype alphabet

The roundtable's morphology adjectives (condensed / polarized / linear / capped / merged) are ALIASES for the 5 prototype names (Oval / Barbell / Triangle / Comb / Cloud). Use `getSilhouetteMorphology(label)` if a surface wants the morphology word. Do not add a sibling 6th prototype called "merged" — Cloud already covers that morphology.

### DO NOT add "we recommend" or grading framing

Per the autonomy red lines + I-SM-9 + CD-3: descriptors are factual labels, never graded. The classifier output never includes "your range looks weak" / "this is a great barbell" / similar copy. Surfaces compose neutral display from the factual fields.

### DO NOT couple this module to mastery state

The mastery posterior lives at `src/utils/skillAssessment/shapeLanguage/`. This classifier directory does not import from there, does not read `shapeMastery` IDB store, and does not dispatch to `shapeMasteryReducer`. They are adjacent domains: classification describes range geometry; mastery describes user knowledge. Keep the boundary clean.

## Directory layout (SPR-084 Decision B — consolidated namespace)

Per-descriptor classifier modules live under `shapeDescriptors/`. General feature math + shared lesson loading stay at this parent level.

```
src/utils/shapeLanguage/
├── CLAUDE.md                       # this file
├── index.js                        # public barrel; re-exports from shapeDescriptors/ + gridFeatures + lessonRegistry
├── gridFeatures.js                 # general 169-cell feature math (shared across descriptors)
├── lessonRegistry.js               # shared lesson loader (markdown registry)
└── shapeDescriptors/               # per-descriptor classifiers + prototypes
    ├── index.js                    # namespace barrel
    ├── silhouetteClassifier.js     # B1 (Range Silhouette)
    ├── silhouettePrototypes.js
    ├── equityDistributionCurve.js  # B2 — data/compute, no label output
    ├── equityShapeClassifier.js    # B2 — Spire + Polarization (one fn, two-field output)
    ├── equityShapePrototypes.js
    ├── sizingCurveTagClassifier.js # B2 — Ridge/Plateau/Cliff/Ramp
    ├── sizingCurveTagPrototypes.js
    └── __tests__/                  # per-descriptor unit tests
```

## File map

| File | Purpose |
|------|---------|
| `index.js` | Top-level public re-exports. |
| `gridFeatures.js` | Pure feature extractors over a 169-cell grid (mass, rank-sum statistics, suited asymmetry, wedge monotonicity, entropy, contiguity, etc.). General — not per-descriptor. |
| `lessonRegistry.js` | Loader for `docs/projects/poker-shape-language/lessons/*.md`. `getShapeLesson(descriptorId)` public API. |
| `shapeDescriptors/` | Per-descriptor classifier + prototype modules + their tests. New descriptor work goes here. |
| `CLAUDE.md` | This file. |

## Cross-domain import rule (SPR-084 Decision C)

Data flows `exploitEngine/` → `shapeLanguage/`, never the reverse. Specifically:

- ✅ `shapeLanguage/` MAY import pure data producers from `src/utils/exploitEngine/` (e.g., `computeComboEquityDistribution`) and `src/utils/rangeEngine/` (range matrices).
- ❌ `src/utils/exploitEngine/` and `src/utils/rangeEngine/` MUST NOT import from `shapeLanguage/`. The first-principles rule under §1 above is the load-bearing reason — descriptor labels are derived outputs, never decision inputs.
- ❌ `shapeLanguage/` MUST NOT import anything from `exploitEngine/` that contains decision-driving logic (recommendation generation, exploit policies, hero advice). Data + pure compute only.

Grep target: `grep -r "from.*shapeLanguage" src/utils/exploitEngine src/utils/rangeEngine` must return zero results.

## Future scope (per project doc Stream B)

The remaining descriptors in `SHAPE_DESCRIPTOR_CATALOG` each get their own classifier module + tests under `shapeDescriptors/`:

| # | Descriptor | Module | Status |
|---|------------|--------|--------|
| 1 | Range Silhouette | `shapeDescriptors/silhouetteClassifier.js` | **WS-041 / SPR-082 SHIPPED** (relocated SPR-084 Sub-phase 0) |
| 2 | Equity-Distribution Curve | `shapeDescriptors/equityDistributionCurve.js` (data/compute, no label) | **WS-042 / SPR-084 SHIPPED** |
| 3 | Spire + Polarization | `shapeDescriptors/equityShapeClassifier.js` (one fn, two-field output) | **WS-042 / SPR-084 SHIPPED** |
| 4 | Sizing Curve Tag | `shapeDescriptors/sizingCurveTagClassifier.js` | **WS-042 / SPR-084 SHIPPED** |
| 5 | Saddle | `shapeDescriptors/saddleClassifier.js` | **WS-043 / SPR-088 SHIPPED** |
| 6 | Basin + Sankey | `shapeDescriptors/basinClassifier.js` (not yet authored) | Deferred (Stream B4+; scope re-framed — see note below) |
| 7-10 | Advanced (Ridgeline / Contour Tree / Basin Map / Trajectory) | TBD | Deferred (Streams B5-B9) |

**Basin scope re-frame (2026-05-18, SPR-088 plan-mode owner correction):** the project doc Phase 7 phrase "river-equity variance" is misleading. At river, equity per villain combo is binary (showdown is deterministic) — there is no continuous variance to compute across runouts. The correct primitive for Basin is the *showdown-outcome distribution* of villain's range, with strength-tier bucketing computed against the public board (not vs hero) to expose bluff content. The engine plumbing for per-combo `villainStrengthBucket` does not exist today and is a prereq for Basin. See memory entry `feedback_river_equity_is_showdown_outcome.md` for the full reasoning and an inline-authored WS ticket for the engine refactor (queued from SPR-088 close-out).

Each future module follows the same shape: feature extractors + prototype signatures + classifier orchestrator. Mastery state stays at `src/utils/skillAssessment/shapeLanguage/`; classifier primitives stay here.

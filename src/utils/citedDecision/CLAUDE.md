# Cited Decision — Domain Rules

**MANDATORY**: Before editing ANY file in this directory, read:
1. `.claude/context/POKER_THEORY.md` §6 (math) + §5 (weakness/exploit theory)
2. `docs/projects/exploit-deviation/schema.md` §4 (`DecisionModelMutation`) + §5 (`CitedDecision`) + §6 (dial math) — authoritative
3. `docs/projects/exploit-deviation/architecture.md` §10 (the `villainProfileBuilder.js` relationship — option (c) layered consumer)
4. `docs/projects/exploit-deviation/theory-roundtable.md` Stage 4 (baseline = engine depth-3 per resolution)

This module wraps the game-tree depth-3 baseline with assumption-operator composition + emotional-tilt transform + Shapley-style per-assumption attribution + dial-blended commitment. Output is a `CitedDecision` consumed by both drill (expanded) and live sidebar (compact) surfaces.

---

## Core Principles

### 1. Dividend is measured against engine depth-3 baseline, not GTO
Per Theory Roundtable Stage 4 resolution. The baseline is what `exploitEngine/gameTreeEvaluator.depth3()` returns for hero's holding + node. Dividends represent "incremental EV the deviation layer unlocks beyond the engine's standing recommendation" — not theoretical GTO EV (which we don't compute), not hero's current-strategy EV (which we don't know).

### 2. Shapley-style marginal attribution
Per-assumption `contributionToDividend` is the marginal EV drop if THIS assumption is removed from the applied set (everything else held constant). Sums approximately to total dividend for independent assumptions; exact Shapley decomposition over the full 2^n subset lattice is computationally prohibitive and not required at v1.

### 3. Honesty check is sacred (I-AE-3)
`blend = 0` → `dividend ≈ 0`. This is the single most important invariant. If it fails, the engine manufactures recommendations out of thin air. Wired as a CI gate (Phase 4 CTO condition 5). DEBUG mode asserts this after every `produceCitedDecision` call where blend = 0.

### 4. Dial is drill-only (CC-5)
Per Theory Roundtable CC-5 + drill surface spec. The dial affordance is rendered in drill mode. Live sidebar does NOT render the dial. Hero overrides live by playing the alternate action (MH-13 silent override); dial state is telemetered silently.

### 5. Layered on top of villainProfileBuilder (architecture §10, option (c))
Per CTO review condition 2. `VillainCategorization` CONSUMES `villainProfileBuilder.js` output (existing 655-line module that builds poker-native villain decision profiles for sidebar HUD) and adds the actionable-assumption bundle on top. The two modules coexist with distinct responsibilities — profile = who the villain is, categorization = which deviations are actionable against them. Do not re-implement profile construction here.

### 6. Baseline absence → no citation (I-AE-6)
If `gameTreeEvaluator.depth3()` returns `bailedOut: true` or otherwise fails to produce a valid baseline, `produceCitedDecision` returns `{ citation: null, reason: "insufficient-baseline" }`. Never fabricate a baseline. Drill labels "evaluation timed out"; sidebar omits the citation.

### 7. Surface-aware production
`produceCitedDecision({ surface: "drill" | "live" })` filters assumptions by surface-specific actionability gate. Live surface excludes hero-side assumptions (I-AE-2); drill includes them. Recognizability thresholds differ per schema §7.1 (drill 0.40 / live 0.60).

---

## Anti-Patterns

### DO NOT compute dividend against GTO
We don't have a GTO solver. The baseline IS the engine's depth-3 approximation. Attempting to compute a GTO baseline per-node would be prohibitively expensive and architecturally wrong (we'd be asserting we can compute GTO when we can't). See Theory Roundtable Stage 4.

### DO NOT render `CitedDecision` without a baseline
I-AE-6. No baseline = no citation. Do not fabricate one or substitute a weaker evaluation. Graceful degradation: label the spot, skip the citation.

### DO NOT average `posteriorConfidence` and `resistanceScore` (I-AE-7)
Per sibling `assumptionEngine/CLAUDE.md` anti-pattern. These measure different things. Shapley attribution uses them independently — posterior weights the marginal contribution; resistance modulates the counter-exploit cost side of asymmetric payoff. Never combine into a single score.

### DO NOT render the dial in live surface
CC-5. Drill renders dial; live hides it. Consumers of `CitedDecision.contestability.alternateDials` in the live renderer are a bug. Validator should reject.

### DO NOT reset hero's dial overrides on hand transition
Hero's dial state per assumption persists across hands within a session (drill-set dial carries forward when assumption is re-used). Only `hand:new` re-evaluates the FSM visibility; dial state is session-scoped, not node-scoped.

### DO NOT compute dividend for non-actionable assumptions
Filter first (hard-edge gate per I-AE-1), attribute after. Computing Shapley contribution for a sub-threshold assumption is wasted cycles AND pollutes the citation pool if any leakage occurs.

### DO NOT skip staleness integration in live mode
Per live citation surface spec (R-4.4). Citation age contributes to `computeAdviceStaleness` in the sidebar. Omitting this feed produces stale citations without user-visible indication — the single most trust-destroying failure mode for the tool.

### DO NOT cache `CitedDecision` beyond its node
`CitedDecision` is a function of `(node, appliedAssumptions, emotionalState, baseline, blend)`. Any input change invalidates the cache. Per-node cache in `assumptionReducer.citedDecisionCache`; cleared on `hand:new`.

---

## Key Concepts

### Dial curve (schema §6.1)
Per-assumption commitment:
```
currentDial = clamp(
  dialFloor + (dialCeiling − dialFloor) × sigmoid(k × (quality.composite − 0.5)),
  dialFloor, dialCeiling
)
```
Default: `dialFloor = 0.3`, `dialCeiling = 0.9`, `k = 8`.

### Blend formula (schema §4.1)
Overall commitment:
```
blend = clamp(
  0.5 +
  0.15 × normalize(Σ_i quality_i × recognizability_i × (1 − counterExploitFragility_i)) +
  0.10 × varianceBudgetFactor +
  0.05 × stakeContextFactor,
  0, 1
)
```

### Final model (schema §4.2)
```
DM_villain_used = blend × DM_villain_mutated + (1 − blend) × DM_villain_baseline
```

### Attribution (Shapley marginal)
```
contributionToDividend[i] = EV_with_all − EV_with_all_except_i
```
Computed for each applied assumption. Sum ≈ total dividend for independent assumptions.

### Contestability payload (drill-only)
`alternateDials` lists "what happens at alternative dial positions" — e.g., "at dial=0.4, bet re-emerges as mixed." Renders the re-convergence path visually in drill; never shown live.

---

## File Responsibilities (planned per architecture §2.1)

| File | Does | Does NOT | Commit |
|------|------|----------|--------|
| `index.js` | Public API — `produceCitedDecision`, `computeDialBlend` | Internal computation | 1 (stub) → 6 (real) |
| `citedDecisionProducer.js` | Wrap baseline + mutation + attribution → CitedDecision | Assumption production | 6 |
| `dialMath.js` | Dial curves, blend formula | Production or attribution | 6 |
| `attribution.js` | Shapley marginal contribution | Dial math or production | 6 |

Scaffolding (this commit) creates only `CLAUDE.md` + `index.js` stub.

---

## Related docs

- `docs/projects/exploit-deviation/schema.md` §4, §5, §6 — CitedDecision + DecisionModelMutation + dial math
- `docs/projects/exploit-deviation/theory-roundtable.md` Stage 4 — baseline resolution
- `docs/projects/exploit-deviation/architecture.md` §10 — villainProfileBuilder option (c)
- `docs/projects/exploit-deviation/calibration.md` §7 — honesty check discipline
- `docs/design/surfaces/presession-drill.md` — drill consumer (contestability visible)
- `docs/design/surfaces/live-exploit-citation.md` — live consumer (dial hidden)
- `assumptionEngine/CLAUDE.md` — sibling module (provider of applied assumptions)
- `emotionalState/CLAUDE.md` — sibling module (provider of EmotionalState for secondary transform)

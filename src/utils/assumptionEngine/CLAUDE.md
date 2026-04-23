# Assumption Engine — Domain Rules

**MANDATORY**: Before editing ANY file in this directory, read in order:
1. `.claude/context/POKER_THEORY.md` — poker theory foundation (shared with `exploitEngine/`, `rangeEngine/`)
2. `docs/projects/exploit-deviation/schema.md` — `VillainAssumption` v1.1 schema (authoritative shape)
3. `docs/projects/exploit-deviation/architecture.md` — module boundaries + performance budgets + invariants (authoritative architecture)
4. `docs/projects/exploit-deviation/calibration.md` — Tier 1 / Tier 2 calibration framework

This engine produces `VillainAssumption` objects from the existing tendency + range + game-tree stack. Actionable assumptions (passing the four-gate hard-edge test) are consumed by two surfaces: `PresessionDrillView` (teaching) and the Live Exploit Citation (sidebar Z2 extension).

The engine is **structurally separate** from `exploitEngine/` (I-AE-CIRC-1). This engine is behavioral inference — Bayesian posterior over predicates. Exploits are downstream consumers; the inference layer must not import from them.

---

## Core Principles

### 1. Hard edges, not soft recommendations
Every assumption is **actionable or it does not exist** (I-AE-1). Four gates: posterior confidence ≥ 0.80, stability composite ≥ 0.70, surface-specific recognizability (drill ≥ 0.40 / live ≥ 0.60), asymmetric payoff ≥ 0.30 bb per 100 trigger firings. A Sharpe floor (`mean / sd ≥ 1.0`) rejects variance-toxic deviations. Sub-threshold assumptions do NOT render to either surface — they pollute decision-making.

### 2. Bayesian, not frequentist
Posterior confidence is `P(claim true | evidence)` integrated over a Beta posterior, with a **mandatory prior** (population or style-conditioned). Never compute confidence from point-estimate + sample-size heuristics. Priors overridden by observed frequency as samples accrue — this is the standard Beta-Binomial update.

### 3. Categorization is emergent, never assigned
`VillainCategorization` (the bundle of actionable assumptions per villain) is **derived** from the set of gated assumptions. Do NOT tag a villain "L2-capped-station" by hand and look up deviations. Compute actionable assumptions; label falls out. Labels are outputs, not inputs — per `feedback_first_principles_decisions`.

### 4. Schema v1.1 is additive-only
New predicates, new fields, new scope dimensions — all additive. A breaking change requires a schema version bump with a migration handler (see `migrations.js`). Retired predicates move to `DEPRECATED_PREDICATES` with a `retiredAt` date and stay there so old persisted records deserialize cleanly.

### 5. Posterior confidence and resistance score are never combined (I-AE-7)
`evidence.posteriorConfidence` is a Bayesian posterior — an epistemic claim about a behavioral rate. `counterExploit.resistanceScore` is a heuristic score — a game-theoretic prediction about adaptation stability. These measure different things on different scales. ESLint rule flags any arithmetic combining them; do not fight the rule.

### 6. Suppression handles the trap problem (I-AE-4)
When a villain exhibits both a "limp range capped" pattern AND a "showed down premium from passive line" trap pattern, the latter SUPPRESSES the former (trap detection dials limp-range-capped to 0). Cycle detection runs at production time; cycles throw. See `suppression.js`.

### 7. Emotional state is an operator, not a feature
Fear and greed are two-dimensional per-node modulations of villain's decision distribution. They reshape (not replace) the baseline after assumption operators apply. Tilt coefficients are literature-informed priors + per-style multipliers (Fish × 1.4, Nit × 0.7, LAG × 1.1, TAG × 1.0). Magnitudes are calibration targets; see `calibration.md` §3.3 conservative-ceiling rule.

---

## Anti-Patterns

### DO NOT surface sub-threshold assumptions
If `quality.actionableInDrill === false` and `quality.actionableLive === false`, the assumption has no rendering rights. Filtering at the consumer (drill / sidebar) is not enough — validator rejects sub-threshold production output before it reaches the reducer. Hard edge, no tier leakage.

### DO NOT combine `posteriorConfidence` with `resistanceScore`
Combining: `composite = (posterior * resistance)^0.5` — **wrong**. They measure different things. Combining: `asymmetricPayoff = dividend * posterior - cost * (1 - resistance)` — **right** (uses them independently on each side of the trade-off). ESLint enforces; see architecture §5 I-AE-7.

### DO NOT import from `exploitEngine/` outside `gameTreeEvaluator`
`exploitEngine/` holds exploit logic + deprecated `WEAKNESS_EXPLOIT_MAP` residue + tendency data surfacing. For this engine, only the game-tree baseline evaluator is a valid dependency. Anything else is a coupling violation.

### DO NOT apply population priors when style is classified
Schema §1.2: `prior.type` is `"population"` OR `"style"`. Style priors (Fish/Nit/LAG/TAG) override population priors once classification is confident. Applying both stacks the same behavioral information twice — double-counting per `POKER_THEORY.md §7.4`.

### DO NOT add a predicate without a Tier-1 scenario
Every new `PredicateKey` requires:
1. Entry in `assumptionTypes.js`
2. Production rule in `assumptionProducer.js`
3. Narrative template in `narratives/<predicateKey>.js`
4. Tier-1 scenario in `__sim__/scenarios/<predicateKey>.js`

Missing any of these means CI fails (architecture §11 discipline). Shipping a predicate without a synthetic-villain test means shipping math errors invisibly.

### DO NOT use a single signed emotional axis
Fear and greed are two dimensions. A villain can be high-fear AND high-greed simultaneously (top pair on 4-flush, set on monotone). Collapsing to a signed `netTilt` loses the quadrant — and owner directive 2026-04-23 explicitly required the joint distribution be preserved. See `emotionalState/CLAUDE.md`.

### DO NOT trust extension payloads without validation
Sidebar extension is the only untrusted input source in the system (per SYSTEM_MODEL.md). All extension-provided state runs through `validator.js` before entering assumption production. Malformed payload → `validator` returns `invariant-violated`; consumer skips the frame per R-10.1 payload invariants.

### DO NOT render assumptions without a game-tree baseline (I-AE-6)
A `CitedDecision` requires a valid depth-3 baseline from `gameTreeEvaluator`. If the baseline times out (`bailedOut: true`), the assumption does not render — it moves to `hidden` FSM state or the drill surface labels it "evaluation timed out." Never fabricate a baseline.

### DO NOT silently retire a predicate
When Tier-2 calibration gap exceeds 0.35 for 10 consecutive sessions, a predicate moves through `active → expiring → retired`. Each transition is an `ASSUMPTION_RETIRED` dispatch with a `reason` field. Retirement is observable — users can see why a pattern they trusted moved to expiring (per `calibration.md` §6).

### DO NOT skip the honesty check (I-AE-3)
`blend = 0` across all assumptions MUST produce `dividend ≈ 0`. This is the single most important invariant — if it fails, the engine manufactures recommendations out of thin air. Wired as a CI gate per Phase 4 CTO condition 5. Do not weaken the test.

---

## Key Concepts

### Four-gate actionability
Posterior confidence / stability / recognizability / asymmetric payoff + Sharpe floor. All must pass. See schema §1.10 + architecture §5 I-AE-1.

### Dial curve
Per-assumption commitment = `sigmoid(k × (quality.composite − 0.5))` clamped to `[dialFloor, dialCeiling]`. Default k = 8, floor = 0.3, ceiling = 0.9. Schema §6.1.

### Overall blend
Two-level commitment: per-assumption dial + overall blend. Blend = baseline 0.5 + quality-weighted shift + variance-budget adjustment + stake-context adjustment. Schema §4.1.

### Suppression cycle detection
Kahn's algorithm or equivalent topological sort on the suppression graph. Cycle = fail-at-production. See `suppression.js`.

### Tier-1 math-integrity simulator
Synthetic villains with exactly-coded policies (e.g. "Fish: folds rivers 17%, calls 83%"). Runs 10,000 hands × 10 seeds per scenario. Predicted dividend must be within 5% of simulated dividend. CI ship gate. See `calibration.md` §2.

### Tier-2 model-validity backtest
Real hand history; per-predicate calibration gap `|predicted − realized| / |predicted|`. Rolling metric, NOT a ship gate. Drives conservative-ceiling rule + predicate retirement. See `calibration.md` §3.

### Conservative-ceiling rule
When Tier-2 gap > 0.25 for a predicate, emotional-tilt coefficients scale down per-predicate until gap ≤ 0.25. Persisted as `predicateTransformScale[predicateKey]`. Prevents over-fitting.

---

## File Responsibilities (planned per architecture §2.1)

| File | Does | Does NOT | Commit |
|------|------|----------|--------|
| `index.js` | Public API — ≤ 6 exports | Internal implementation | 1 (stub) → 4 (real) |
| `assumptionTypes.js` | `PredicateKey` enum, scope types, deviation types, constants | Production logic | 3 |
| `assumptionProducer.js` | Produce `VillainAssumption` from tendency + range + state | Surface rendering | 4 |
| `qualityGate.js` | Four-gate + Sharpe + surface-specific gate | Production logic | 4 |
| `operator.js` | Apply `DecisionModelOperator` transforms | Quality gate | 4 |
| `suppression.js` | Resolve suppressions + cycle detection | Production logic | 5 |
| `validator.js` | Runtime validation (boundary + internal) | Production or gate | 3 |
| `migrations.js` | Schema version migrations (v1.0 → v1.1, future) | Production logic | 3 |
| `narratives/*.js` | Per-predicate narrative templates | Production logic | 4 |
| `__sim__/` | Tier-1 calibration simulator + scenarios | Production logic | 4 |
| `__backtest__/` | Tier-2 real-data backtest accumulator | Production logic | 5 |

Scaffolding (this commit) creates only `CLAUDE.md` + `index.js` stub. No other files yet.

---

## Related docs

- `schema.md` — VillainAssumption shape (v1.1 authoritative)
- `architecture.md` — module boundaries + invariants + performance budgets
- `calibration.md` — Tier 1 + Tier 2 framework
- `canonical-assumptions.md` — six worked examples (end-to-end test fixtures)
- `theory-roundtable.md` — schema v1.0 → v1.1 rationale
- `engine-roundtable.md` — architecture decisions + findings
- `cto-review.md` — five conditions for Phase 6
- `docs/design/surfaces/presession-drill.md` — drill surface consumer
- `docs/design/surfaces/live-exploit-citation.md` — live surface consumer

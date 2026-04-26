# `__coherence__` Metadata Schema

**Version:** 0.1 (Phase 0 — schema frozen for Phase 1 scanner)
**Authored:** 2026-04-25
**Owner:** [`.claude/programs/model-coherence.md`](../../.claude/programs/model-coherence.md)

---

## Purpose

Every decision-relevant module in the codebase exports a `__coherence__` constant. The constant is the single source of truth about how that module participates in the decision pipeline — what it produces, what it consumes, whether it's integrated, and (if not) when it intends to be.

The scanner (`scripts/coherence-scan.cjs`, Phase 1) reads these constants across the corpus, builds the integration graph, and generates `docs/engine/CANONICAL_PIPELINE.md`, `docs/engine/SURFACE_SUBSCRIBERS.md`, `docs/engine/INTEGRATION_DEBT.md` deterministically. Hand-edited manifests are forbidden — they drift the moment a refactor happens. The graph IS the manifest.

---

## Canonical form

```javascript
export const __coherence__ = {
  id: 'exploit.villain-profile-builder',
  kind: 'primitive',
  produces: ['villain-profile'],
  consumes: ['villain-model', 'villain-observation', 'tendency-stats'],
  status: 'integrated',
  pipelineStep: 4,
  owners: {
    introducedBy: 'commit:e7a9f3b',
    persona: 'systems-architect',
  },
};
```

**Why a runtime export and not a JSDoc `@coherence` block:** discoverable, unit-testable, parsed via AST without comment-traversal edge cases. The cost (one named export per file) is trivial. JSDoc form remains an option if a module truly cannot afford the export (e.g., re-export-only barrel files), but the canonical form is the export.

---

## Field reference

### `id` (required, string)

Stable kebab-case handle, **independent of file path**. Lets the manifest survive renames and lets `consumes:` reference IDs not paths.

**Convention:** `<cluster>.<module>` where `<cluster>` is one of:

- `exploit` — `src/utils/exploitEngine/`
- `range` — `src/utils/rangeEngine/`
- `analysis` — `src/utils/handAnalysis/` and `src/utils/analysisPipeline.js`
- `core` — `src/utils/pokerCore/`
- `anchor` — `src/utils/anchorLibrary/`
- `assumption` — `src/utils/assumptionEngine/`
- `skill` — `src/utils/skillAssessment/`
- `drill` — `src/utils/drillContent/`
- `hook` — `src/hooks/`
- `surface` — `src/components/views/` or `src/components/extension/`
- `infrastructure` — persistence, workers, bridge protocol

`id` MUST be unique across the corpus. The scanner enforces uniqueness.

### `kind` (required, enum)

| Value | Meaning | Examples |
|-------|---------|----------|
| `primitive` | Pure compute. Stateless function module. Produces decision-relevant output. | `exploitEngine/foldEquityCalculator.js`, `exploitEngine/villainProfileBuilder.js`, `rangeEngine/buildRangeProfile.js` |
| `aggregator` | Hook or composer that fans multiple primitives, often produces synthesized output. | `hooks/usePlayerTendencies.js`, `hooks/useLiveActionAdvisor.js` |
| `surface` | View or UI consumer that renders decision output. | `components/views/TableView/LiveAdviceBar.jsx`, `components/extension/ExtensionPanel.jsx` |
| `infrastructure` | Persistence, workers, bridge protocol — supports the pipeline but doesn't produce decision-relevant output itself. | `utils/persistence/`, `utils/worker/` |
| `research` | Explicitly not yet wired. MUST carry `targetIntegration` with a deadline OR `notes` justifying indefinite research-only status. | `drillContent/shapes.js` (until absorbed) |

### `produces` (required for `primitive` and `aggregator`, string[])

Open-vocabulary string tags describing what the module emits. **No closed enum.** New tags self-introduce; the scanner reports first-occurrences for vocabulary triage.

**Seed vocabulary** (from Phase 1 census — these tags already have producers in the codebase):

| Tag | Description | Producer examples |
|-----|-------------|-------------------|
| `ev` | Expected-value number, action-conditional | `gameTreeDepth2`, `gameTreeEvaluator` |
| `fold-rate` | Frequency villain folds to a sized bet | `villainDecisionModel`, `foldEquityCalculator` |
| `fold-equity` | EV gain from villain folding (note: ≠ fold-rate) | `foldEquityCalculator` |
| `range-profile` | Bayesian preflop range estimate per position+action | `rangeEngine` |
| `narrowed-range` | Postflop-narrowed range for a villain | `postflopNarrower` |
| `villain-model` | Bayesian villain decision distribution | `villainDecisionModel` |
| `villain-profile` | Hero-facing decision profile (poker-native language) | `villainProfileBuilder` |
| `villain-observation` | Contextual behavior observation | `villainObservations` |
| `weakness` | Villain -EV decision pattern | `weaknessDetector` |
| `exploit` | Scored exploit suggestion | `generateExploits` |
| `thought` | Inferred villain cognitive pattern | `thoughtInference` |
| `briefing` | Narrative briefing text | `briefingBuilder` |
| `equity` | Hand-vs-range equity | `monteCarloEquity`, `gameTreeEquity` |
| `recommendation` | Ranked hero action recommendation | `gameTreeEvaluator` |
| `action-class` | VALUE / BLUFF / SEMI-BLUFF / CHECK label | `actionClassifier` |
| `hero-action` | Specific hero action with sizing | `heroActionBuilder` |
| `bucket-segment` | Strategic bucket label (nuts/strong/marginal/draw/air) | `rangeSegmenter` |
| `tendency-stats` | Raw VPIP/PFR/AF/cbet etc. | `tendencyCalculations` |
| `risk` | Action risk quantification | `riskAnalysis` |
| `confidence` | Bayesian credible interval / sample-size weight | `bayesianConfidence` |
| `assumption` | Villain assumption hypothesis | `assumptionEngine/assumptionProducer` |
| `cited-decision` | Baseline + per-dial dividend decision | `useCitedDecisions` |
| `anchor-score` | Calibration validation result | `anchorLibrary/anchorScenarioRunner` |
| `skill-score` | Inferred skill assessment | `skillAssessment/` (planned) |
| `shape` | Equity shape / lane (preflop) | `drillContent/shapes` (pending absorption) |
| `frame` | Intermediate-state framing between streets | (pending — does not yet exist as a producer) |
| `intermediate-state` | Loading/transition state between streets | (pending) |

**Adding a new tag:** just use it in `produces:`. The scanner detects first-use and creates a P3 vocabulary-triage backlog item. After triage, the tag is added to this seed reference (or renamed/retired if it duplicates an existing concept).

### `consumes` (required for `aggregator` and `surface`, string[])

References tags from the `produces` vocabulary. Drives surface-completeness checks (failure mode #1: a surface that should consume `shape` but doesn't is mechanically detectable by walking from `shape` producers and finding zero or under-coverage on consumer side).

**Rule:** every value in `consumes` must match at least one `produces` value somewhere in the corpus. The scanner flags "dangling consumer" violations (P1 auto-backlog).

### `targetIntegration` (required for `kind: 'research'` and `status: 'pending-absorption'`)

```javascript
targetIntegration: {
  layer: 'aggregator' | 'surface' | 'pipeline',
  expectedConsumers: ['hook.action-advisor', 'surface.extension-sidebar'],  // optional, by id
  deadline: '2026-07-01',  // ISO date
  predicate: 'After sidebar UX pass — shapes consumed by live recommendation flow',  // optional, free text
}
```

This is the heart of the mechanism. It is the **promise** a research module makes about its own absorption.

- `layer` says "I should be pulled into the aggregator/surface/canonical-pipeline tier."
- `expectedConsumers` (optional, by `id`) lets the author declare specific targets. If declared, the scanner verifies each target's `consumes` includes one of this module's `produces` tags. Mismatch = P1 unfulfilled-expectation backlog.
- `deadline` is the **hard date**. Past it, `INTEGRATION_DEBT.md` flips that row to RED and `/health-check` auto-creates a P1 REVIEW backlog item naming the originating handoff.
- `predicate` is a free-text gate humans evaluate at `/health-check` ("once `shapes.js` ships street-aware shapes"). Advisory.

### `status` (required, enum)

| Value | Meaning |
|-------|---------|
| `integrated` | At least one consumer in the manifest. The default for primitives that have been absorbed. |
| `pending-absorption` | Author intends absorption with a `targetIntegration.deadline`. Scanner tracks deadline progress. |
| `research-only` | Explicit, indefinite. Rare. Carries an extra `notes:` field justifying why this exists outside the pipeline. |
| `deprecated` | Scheduled for removal. Scanner warns on any new consumers and auto-creates a P2 backlog item if any consumer adds it after the deprecation declaration. |

### `owners` (optional)

```javascript
owners: {
  introducedBy: 'commit:<sha>' | 'handoff:<id>' | 'backlog:<id>',
  persona: 'systems-architect' | 'product-ux-engineer' | ...,  // optional
}
```

Pointer back to the originating context. Primary use: when a `pending-absorption` deadline expires, `/health-check` names the originating handoff so the next session has full context.

### `pipelineStep` (optional, number, primitives only)

If this primitive sits inside `analysisPipeline.js`'s 8-step backbone (Step 1 through Step 8 as documented in MEMORY.md and `analysisPipeline.js` itself), declare which step. Lets the scanner regenerate `CANONICAL_PIPELINE.md` ordering deterministically rather than from heuristic import order.

Steps (canonical):
1. Build raw stats (`buildPlayerStats`)
2. Derive percentages, classify style, build position stats
3. Build range profile (`buildRangeProfile`)
4. Accumulate decisions, build villain decision model, detect weaknesses
5. Build villain profile, infer thoughts
6. Generate exploits, compute observations
7. Build briefings
8. (downstream) game tree evaluation in aggregator hooks (out of scope for `pipelineStep`)

### `notes` (optional, string)

Free-form. Discouraged but sometimes load-bearing — e.g., for `research-only` modules to explain why they exist outside the pipeline indefinitely.

---

## Worked examples

### Example 1 — Integrated primitive

**File:** `src/utils/exploitEngine/villainProfileBuilder.js`

```javascript
export const __coherence__ = {
  id: 'exploit.villain-profile-builder',
  kind: 'primitive',
  produces: ['villain-profile'],
  consumes: ['villain-model', 'villain-observation', 'tendency-stats'],
  status: 'integrated',
  pipelineStep: 5,
  owners: {
    introducedBy: 'commit:<sha>',
    persona: 'systems-architect',
  },
};
```

The module is fully integrated (consumed by `usePlayerTendencies` aggregator and `VillainModelCard` / `VillainProfileModal` surfaces). Status is `integrated`; no `targetIntegration` field needed.

### Example 2 — Aggregator hook

**File:** `src/hooks/usePlayerTendencies.js`

```javascript
export const __coherence__ = {
  id: 'hook.player-tendencies',
  kind: 'aggregator',
  produces: ['villain-profile', 'exploit', 'briefing', 'thought'],
  consumes: ['tendency-stats', 'range-profile', 'villain-model', 'weakness', 'villain-observation'],
  status: 'integrated',
};
```

Aggregators have **both** `produces` and `consumes` — they synthesize lower-level primitives into higher-level outputs that surfaces consume. `usePlayerTendencies` produces `villain-profile` (from `villainProfileBuilder`) AND owns the synthesis to `exploit` (via `generateExploits`) AND `briefing` (via `briefingBuilder`).

### Example 3 — Decision-rendering surface

**File:** `src/components/views/TableView/LiveAdviceBar.jsx`

```javascript
export const __coherence__ = {
  id: 'surface.live-advice-bar',
  kind: 'surface',
  consumes: ['recommendation', 'hero-action', 'briefing', 'thought', 'action-class', 'confidence'],
  status: 'integrated',
};
```

Surfaces have only `consumes` — they don't produce decision-relevant output back into the pipeline. The list of `consumes` tags doubles as a coverage check: if the surface is missing `consumes: ['shape']` once `shapes.js` is absorbed, the scanner reports a "could-consume" gap (advisory).

### Example 4 — Pending absorption (the canonical failure-mode #1 example)

**File:** `src/utils/drillContent/shapes.js`

```javascript
export const __coherence__ = {
  id: 'drill.shapes',
  kind: 'research',
  produces: ['shape', 'frame', 'intermediate-state'],
  status: 'pending-absorption',
  targetIntegration: {
    layer: 'aggregator',
    expectedConsumers: ['hook.live-action-advisor', 'surface.extension-sidebar'],
    deadline: '2026-07-01',
    predicate: 'After sidebar UX pass — shapes consumed by live recommendation flow',
  },
  owners: {
    introducedBy: 'handoff:shape-language-session1',
    persona: 'product-ux-engineer',
  },
  notes: 'Today consumed only by drill content / drill-mode UI education layer. Long-term intent: lane/shape information enriches live recommendations on the table and in the Ignition sidebar. Tracked as failure mode #1 in `.claude/programs/model-coherence.md`.',
};
```

The moment `2026-07-01` passes without `hook.live-action-advisor` declaring `consumes: ['shape']` AND `surface.extension-sidebar` declaring `consumes: ['shape', 'frame']`, the scanner:
1. Flips the `INTEGRATION_DEBT.md` row for `drill.shapes` to RED
2. Auto-creates a P1 REVIEW backlog item with the template: *"Integration debt expired: drill.shapes promised absorption into aggregator by 2026-07-01. Originating: handoff:shape-language-session1"*
3. The owner sees the item in `/status` and `/backlog` output

**Note:** the deadline (2026-07-01) and `expectedConsumers` are placeholders pending owner confirmation during Phase 0 → Phase 1 transition. Owner will adjust based on actual roadmap.

---

## Scanner contract (forward reference)

The Phase 1 scanner (`scripts/coherence-scan.cjs`) MUST:

1. Walk all designated paths (defined in `docs/engine/COHERENCE_ROLLOUT.md`)
2. Parse each file's AST and locate `__coherence__` named export
3. Evaluate the export as a static literal (no expressions allowed in metadata)
4. Validate against this schema:
   - All required fields present per `kind`
   - `id` unique across corpus
   - `produces` / `consumes` are non-empty arrays of strings (where required)
   - `status` is one of the four enum values
   - `targetIntegration.deadline` is a valid ISO date
   - `expectedConsumers` (if present) reference real `id` values in the corpus
   - `pipelineStep` (if present) is in 1–8 range
5. Build the integration graph (nodes = modules, edges = `produces → consumes` matches by tag)
6. Compute drift signals (orphans, dangling consumers, expired deadlines, schema violations, undeclared modules in designated paths, surface gaps, new tags)
7. Generate `docs/engine/CANONICAL_PIPELINE.md`, `docs/engine/SURFACE_SUBSCRIBERS.md`, `docs/engine/INTEGRATION_DEBT.md` (each with `<!-- GENERATED — do not edit -->` header)
8. Emit `.claude/coherence-report.json` for `/health-check` consumption

The scanner's exit code:
- `0` — no schema violations, no expired deadlines (hard failures)
- `1` — schema violations or expired deadlines present (Phase 3+: blocks merge; Phase 1: advisory)
- `2` — internal scanner error (parse failure, etc.)

Performance budget: `<5s` for full corpus run on this codebase. `<500ms` for `--staged` mode.

---

## Adding a new module

When you author a new decision-relevant module (under designated paths or matching shape-based catch-all `**/{*Engine,*Builder,*Detector,*Inference,*Profile}.{js,jsx}`):

1. Add the `__coherence__` export at the **top** of the file (after imports, before any other named exports).
2. Choose `id` per convention (`<cluster>.<kebab-name>`).
3. Pick `kind` based on what the module does (`primitive` for pure compute, `aggregator` for hooks, `surface` for views).
4. List `produces` tags (use existing seed vocabulary; new tags are fine — scanner will flag them for triage).
5. List `consumes` tags (must match real `produces` somewhere).
6. Set `status: 'integrated'` if at least one consumer already declares the relevant `consumes`. Otherwise `status: 'pending-absorption'` with `targetIntegration` populated.
7. Run `node scripts/coherence-scan.cjs --check` (Phase 1+) — fix any errors.
8. In your `/handoff`, fill out the **Coherence Declarations** section (Phase 1+).

If your module is decision-relevant but the path doesn't match designated-path detection, the scanner will not catch it. Either move it to a designated path, or add it to the rollout doc's path list.

If your module matches a designated path but is NOT decision-relevant (utility shim, pure type re-export), add the pragma `// @coherence-exempt: <reason>` at the top of the file. Scanner skips exempt files.

---

## Versioning

This schema is at version `0.1`. Breaking changes (renaming fields, changing required fields, introducing new required fields) require:
1. A migration plan in `docs/engine/COHERENCE_ROLLOUT.md`
2. A backfill PR updating all existing `__coherence__` declarations
3. A version bump in this file's front-matter

Additive changes (new optional fields, new `kind` values, new `status` values) are non-breaking and noted in History below.

---

## History

| Date | Version | Notes |
|------|---------|-------|
| 2026-04-25 | 0.1 | Initial schema. Phase 0 scaffold. Five `kind` values, four `status` values, `targetIntegration` field for the failure-mode-#1 forcing function. Seed vocabulary of 26 `produces` tags from Phase 1 census. |

# Model Coherence — Rollout Plan

**Authored:** 2026-04-25
**Owner:** [`.claude/programs/model-coherence.md`](../../.claude/programs/model-coherence.md)
**Schema:** [`docs/engine/COHERENCE_SCHEMA.md`](./COHERENCE_SCHEMA.md)

---

## Rollout philosophy

Each phase is **reversible**. Each phase has explicit entry and exit criteria. The plan optimizes for "ship the smallest unit, validate, expand" rather than "design once, deploy everything." If any phase reveals the design is wrong, only that phase's artifacts roll back — earlier phases stand.

The rollout order is:
1. **Documentation only** (Phase 0 — current)
2. **Forward-only enforcement** (Phase 1 — new files must declare; existing grandfathered)
3. **Cluster-by-cluster backfill** (Phase 2 — engines → hooks → surfaces)
4. **Full enforcement** (Phase 3 — all designated paths must declare)
5. **Steady state** (Phase 4 — scanner runs in `/health-check`, drift becomes auto-backlog)

---

## Phase 0 — Scaffold (CURRENT)

**Goal:** establish the schema, the program file, and this rollout plan as the system's commitment to model coherence. Zero code change.

### Entry criteria
- User approves the design (✅ approved 2026-04-25 via `velvet-humming-quasar.md` plan)

### Artifacts produced
- [`.claude/programs/model-coherence.md`](../../.claude/programs/model-coherence.md) — program file
- [`docs/engine/COHERENCE_SCHEMA.md`](./COHERENCE_SCHEMA.md) — schema specification
- [`docs/engine/COHERENCE_ROLLOUT.md`](./COHERENCE_ROLLOUT.md) — this file

### Not produced (deliberately)
- No `scripts/coherence-scan.cjs`
- No `__coherence__` blocks in any source module
- No edits to `.claude/commands/handoff.md` or `.claude/commands/health-check.md`
- No edits to `.claude/context/INVARIANTS.md`
- No edits to `.claude/STATUS.md`
- No husky / CI integration

### Exit criteria
- Three docs reviewed and accepted by user
- User confirms the **opt-in vs opt-out path-detection** choice (default in this doc: **opt-out**, see §"Designated paths" below; user can flip to opt-in by editing this section before Phase 1 starts)
- User confirms the `drill.shapes` deadline (default in `COHERENCE_SCHEMA.md` worked example: `2026-07-01`; replace with actual roadmap deadline before authoring the first metadata block)

### Reversibility
Delete three docs. Trivial. No source code touched.

---

## Phase 1 — Scanner ships, advisory mode

**Goal:** the scanner exists, runs fast, and produces accurate output — but enforcement is forward-only (new files only). Existing modules are grandfathered.

### Entry criteria
- Phase 0 exit met
- User approves Phase 1 scope

### Work
1. **Author `scripts/coherence-scan.cjs`** — AST-based via `@babel/parser`, `<5s` perf budget on full corpus, `<500ms` on `--staged` subset. Emits JSON report at `.claude/coherence-report.json`. Generates `docs/engine/CANONICAL_PIPELINE.md`, `docs/engine/SURFACE_SUBSCRIBERS.md`, `docs/engine/INTEGRATION_DEBT.md` deterministically. Style: `.cjs`, mirrors `scripts/check-protocol-sync.cjs` and `scripts/invariant-test-generator.cjs`. (Backlog: COH-0)
2. **Add husky pre-commit hook** running `coherence-scan.cjs --staged` in advisory mode. Warns on schema violations and missing declarations on **newly created files** in designated paths only. Existing files grandfathered. (Backlog: COH-0a)
3. **Add CI step** running full `coherence-scan.cjs`. Phase 1: advisory annotations only — never red. CI emits the manifests as build artifacts so reviewers can see drift in PRs. (Backlog: COH-0b)
4. **Append "Coherence Declarations" section to `.claude/commands/handoff.md`** — conditional, shown only when the session touched designated paths (detected via `git diff --name-only`). Three sub-prompts: new primitives shipped, pending-absorption deadlines hit/approaching, surface drift detected. (Backlog: COH-0c)
5. **Append `INV-COH-01` to `.claude/context/INVARIANTS.md`** — *"every decision-relevant primitive (file matching designated paths) appears in the canonical pipeline manifest OR the integration debt ledger with `targetIntegration.deadline >= today`. Enforced by `scripts/coherence-scan.cjs` exit code (Phase 3+)."* (Backlog: COH-8)
6. **Author the first metadata block** as the test fixture: `src/utils/drillContent/shapes.js` with `status: 'pending-absorption'`. This validates the scanner end-to-end on a real failure-mode-#1 case.

### Phase 1 mode of pre-commit / CI
- **Newly created file** in designated path without `__coherence__` → CI annotation, pre-commit warning (not blocking)
- **Existing file** in designated path without `__coherence__` → silent (grandfathered)
- **Schema violation** in any staged `__coherence__` block → CI annotation, pre-commit warning
- **Expired deadline** in any module → CI annotation, no merge block

### Exit criteria
- Scanner runs <5s on full corpus, validated by timing in CI
- Scanner output (especially generated manifests) reviewed against the Phase 1 census in `velvet-humming-quasar.md` — no false positives, no missed primitives
- `INTEGRATION_DEBT.md` is generated and contains at least the `drill.shapes` row
- Two consecutive weeks with CI advisory output reviewed and stable
- Backlog items `COH-1` through `COH-5` (cluster backfills) created and prioritized
- Program flips from `ROLLOUT (Phase 0)` to `ROLLOUT (Phase 1)`

### Reversibility
- Revert husky hook (one settings file change)
- Revert CI step (one workflow file change)
- Delete `scripts/coherence-scan.cjs`
- Revert handoff template change
- Revert INVARIANTS.md addition
- The `__coherence__` block in `shapes.js` is harmless to leave or remove

All five reverts are independent. Lossless rollback.

---

## Phase 2 — Backfill, cluster-by-cluster

**Goal:** every existing decision-relevant module declares `__coherence__`. The graph becomes complete.

### Entry criteria
- Phase 1 exit met (scanner stable)
- User approves Phase 2 scope (per cluster)

### Sequencing (one PR per sub-cluster, ~5–10 modules per PR)

**COH-1: `src/utils/exploitEngine/`** (~40 modules)
The largest cluster. The good news: `src/utils/exploitEngine/CLAUDE.md` already documents 40 modules with crisp "Does / Does NOT" responsibility pairs. Each "Does" maps mechanically to `produces:` tags; the file responsibilities table is essentially pre-mapped metadata.

Sub-clustering:
- COH-1a: Exploit pipeline (orchestration + rules) — `generateExploits`, `exploitScoringUtils`, `exploitRuleUtils`, `statRules`, `rangeRules`, `subActionRules`, `exploitValidator`
- COH-1b: Analysis pipeline — `decisionAccumulator`, `villainDecisionModel`, `villainModelData`, `villainProfileBuilder`, `villainObservations`, `bucketQueryUtils`, `weaknessDetector`, `positionStats`, `bayesianConfidence`, `thoughtInference`, `thoughtCatalog`, `thoughtSignatureEvaluators`, `preflopFlopEV`
- COH-1c: Action recommendation — `gameTreeEvaluator`, `gameTreeContext`, `heroActionBuilder`, `actionClassifier`, `gameTreeConstants`, `gameTreeSizingHelpers`, `gameTreeEquity`, `gameTreeSampling`, `gameTreeDepth2`, `preflopAdvisor`, `decisionTreeBuilder`, `riskAnalysis`, `liveGameContext`
- COH-1d: Range manipulation + support — `rangeSegmenter`, `postflopNarrower`, `foldEquityCalculator`, `briefingBuilder`, `briefingMerge`, `reEvaluationEngine`, `modelAudit`

**COH-2: `src/utils/rangeEngine/` + `src/utils/handAnalysis/`** (~13 modules)
6 range engine modules + 7 handAnalysis utils. Smaller and tighter scope.

**COH-3: Aggregator hooks** (~6 hooks)
`usePlayerTendencies`, `useOnlineAnalysis`, `useActionAdvisor`, `useLiveActionAdvisor`, `useHandReplayAnalysis`, `useCitedDecisions`. Core decision-flow aggregators.

**COH-4: Decision-rendering surfaces** (~10–15 components)
`LiveAdviceBar`, `SizingPresetsPanel`, `HeroCoachingCard`, `VillainModelCard`, `VillainProfileModal`, `PlayerAnalysisPanel`, `LiveRecommendations`, `ExtensionPanel`, `WeaknessesSection`, `ReviewObservations`, OnlineView seat annotations, Hand Replay views.

**COH-5: Anchor / assumption / skill / drill** (~variable)
`anchorLibrary/`, `assumptionEngine/`, `skillAssessment/` (when authored), `drillContent/shapes.js` (already declared in Phase 1 as the fixture).

### During Phase 2

- Program flips to `YELLOW` until `Undeclared modules in designated paths` ≤ 5
- Each PR is independently mergeable; failure of one cluster's PR doesn't block others
- The scanner regenerates manifests on each merge — graph completeness visible in `INTEGRATION_DEBT.md` row count over time

### Exit criteria
- `Undeclared modules in designated paths` count == 0
- All `__coherence__` blocks pass schema validation
- `CANONICAL_PIPELINE.md` is comprehensive — all 8 pipeline steps populated
- `SURFACE_SUBSCRIBERS.md` is comprehensive — every surface has at least one `consumes` entry
- Program flips to `GREEN`

### Reversibility
Each cluster PR is independently revertible. Even with all clusters reverted, the metadata blocks are pure declarations — they have no runtime effect. Scanner reverts to "Phase 1 advisory" output (only flagging missing on new files).

---

## Phase 3 — Full enforcement

**Goal:** the gates become teeth. Schema violations and missing declarations block merge.

### Entry criteria
- Phase 2 exit met (`Undeclared modules` == 0, program GREEN)
- Two consecutive `/health-check` cycles GREEN
- User approves enforcement flip

### Work
1. **Flip pre-commit hook to blocking** for all designated paths. New files MUST declare. Schema violations MUST resolve. (Backlog: COH-6)
2. **Flip CI step to fail** on (a) schema violations, (b) undeclared modules in designated paths, (c) introduction of expired deadlines. Note: existing expired deadlines remain advisory annotations — they trigger backlog, not merge block.
3. **Promote `// @coherence-exempt: <reason>` pragma** as the only escape hatch for files that match designated paths but are genuinely not decision-relevant.

### During Phase 3
- Monitor false-positive rate. If any merge is blocked by a false positive (the scanner caught something that isn't actually a decision-relevant module), update designated paths or `// @coherence-exempt` it within the same PR.
- Track time-to-resolution for blocked merges. Target: <2 hours from block to resolution.

### Exit criteria
- Four consecutive weeks with zero false-positive merge blocks
- Program remains `GREEN`

### Reversibility
- Flip hooks back to advisory (one settings change + one workflow change)
- All `__coherence__` blocks remain in place; their effect is purely advisory under reverted gates

---

## Phase 4 — Steady state

**Goal:** model coherence is a self-maintaining property of the codebase. New work is mechanically gated; drift is mechanically detected.

### Entry criteria
- Phase 3 exit met

### Work
1. **Wire scanner into `/health-check` step 1.5** (Backlog: COH-7) — runs `node scripts/coherence-scan.cjs` once; reads `.claude/coherence-report.json`; for each `expired`, `orphans`, `schemaViolations`, `undeclared`, `surfaceGaps`, `dangling-consumers` entry, evaluates the matching auto-backlog trigger from `model-coherence.md` and adds REVIEW items to `.claude/BACKLOG.md`. Regenerates the three generated manifests as a side effect.
2. **Add "MODEL COHERENCE" line to `/health-check` output dashboard** showing program status, orphan count, expired-deadline count, undeclared count.

### Continuous behavior
- Every `/health-check` cycle regenerates manifests and creates auto-backlog items as needed
- Every `/handoff` for sessions touching designated paths fills the "Coherence Declarations" section
- New `produces` tags surface as P3 vocabulary-triage items in `/backlog`
- The schema's history table tracks any schema evolution

### Exit criteria
**None.** This is the steady state. Annual schema review captures vocabulary drift; otherwise the system runs itself.

---

## Designated paths (auto-detected as decision-relevant)

The scanner uses **path + shape** detection with `@coherence-exempt` opt-out.

### Path-based primary

```
src/utils/exploitEngine/**/*.{js,jsx}     (excluding **/__tests__/**)
src/utils/rangeEngine/**/*.{js,jsx}
src/utils/handAnalysis/**/*.{js,jsx}
src/utils/anchorLibrary/**/*.{js,jsx}
src/utils/skillAssessment/**/*.{js,jsx}
src/utils/assumptionEngine/**/*.{js,jsx}
src/utils/drillContent/shapes.js
src/utils/analysisPipeline.js
src/utils/citedDecision/**/*.{js,jsx}
src/utils/emotionalState/**/*.{js,jsx}
src/hooks/use{Player*,*Advisor,*Analysis,CitedDecisions}.{js,jsx}
src/components/views/**/*.{jsx,tsx}
src/components/extension/**/*.{jsx,tsx}
```

### Shape-based catch-all

```
**/{*Engine,*Builder,*Detector,*Inference,*Profile}.{js,jsx}
```

This catches future primitives placed outside today's designated dirs (e.g., `src/utils/myThing/skillFrameDetector.js`). Aligns with the "anticipatory, not retrofit" principle.

### Opt-out (decision: opt-out, recommended)

A file matching designated paths but **not** decision-relevant (utility shim, type-only re-export, plain helper) MUST add a pragma:

```javascript
// @coherence-exempt: utility helpers — no decision-relevant output
```

The scanner skips files with this pragma. The `<reason>` is required (free text).

**Why opt-out over opt-in:**
- Catches future primitives placed outside today's designated dirs (the "anticipatory" principle)
- Lower risk of failure mode #2 (the "narrow-scope ancillary" trap) recurring
- The cost (occasional friction adding `@coherence-exempt`) is borne once per file, vs. opt-in's cost of remembering to declare every time

**To flip to opt-in:** edit this section before Phase 1 starts. Opt-in mode means the scanner only inspects files that explicitly declare `__coherence__` (no path/shape inference). The trade-off: lower friction, higher risk of missed primitives.

### Excluded paths (always)

```
**/__tests__/**
**/*.test.{js,jsx}
**/*.spec.{js,jsx}
src/__dev__/**
node_modules/**
dist/**
.vite/**
```

---

## Scanner architecture (forward reference for Phase 1)

`scripts/coherence-scan.cjs` will:

1. **Walk** designated paths via `fast-glob`
2. **Parse** each file via `@babel/parser` (`sourceType: 'module'`, plugins: `['jsx']`); locate the `__coherence__` named export declaration
3. **Evaluate** the export as a static literal — only object literals with primitive values, arrays of strings, and nested object literals allowed. No expressions, no spread, no function calls.
4. **Validate** against schema (hand-rolled validator; no Zod dep). Collect schema violations.
5. **Build** in-memory graph: nodes keyed by `id`, edges via `produces` ↔ `consumes` tag join across the corpus.
6. **Compute** drift signals:
   - Orphan primitives (`produces` tag with zero matching `consumes`)
   - Dangling consumers (`consumes` tag with zero matching `produces`)
   - Expired deadlines (`targetIntegration.deadline < today` AND `status !== 'integrated'`)
   - Unfulfilled `expectedConsumers` (named consumer doesn't declare the expected `consumes` tag)
   - Schema violations
   - Undeclared modules in designated paths (without `@coherence-exempt`)
   - Surface "could-consume" gaps (advisory)
   - First-occurrence tags
7. **Output**:
   - Generated manifests with `<!-- GENERATED — do not edit. Source: __coherence__ blocks. Run `scripts/coherence-scan.cjs` -->` header
   - JSON report at `.claude/coherence-report.json`
8. **Cache** parse results by mtime in `.claude/.coherence-cache/` for `<500ms` re-runs

### Modes

- `node scripts/coherence-scan.cjs` — full run, regenerates docs, exits non-zero on hard failures
- `node scripts/coherence-scan.cjs --check` — validate only, no doc regeneration
- `node scripts/coherence-scan.cjs --staged` — only files in `git diff --cached`, fast pre-commit mode
- `node scripts/coherence-scan.cjs --json` — emit only the JSON report (for `/health-check` consumption)

---

## Glossary

| Term | Meaning |
|------|---------|
| **Decision-relevant module** | A module whose output flows (directly or transitively) into a UI surface that displays decision information (recommendations, EV, fold rates, weaknesses, exploits, briefings, villain profiles, shapes, etc.). |
| **Canonical pipeline** | The 8-step `analysisPipeline.js` backbone plus the game tree evaluator stack. |
| **Orphan primitive** | A module whose `produces` tags have zero consumers anywhere in the corpus. Detected mechanically. The user's failure mode #2. |
| **Dangling consumer** | A module that `consumes` a tag for which no producer exists. Detected mechanically. |
| **Pending absorption** | A module that exists but is not yet wired into expected consumers. Carries `targetIntegration.deadline`. The user's failure mode #1. |
| **Expired deadline** | A `pending-absorption` module past its `targetIntegration.deadline` without `status: 'integrated'`. Auto-creates P1 backlog. |
| **Surface gap** | A surface that doesn't `consume` a tag that primitives in the same cluster `produce`. Advisory only — not every surface should consume every tag. |
| **Designated path** | A path matching the path-based or shape-based pattern in §"Designated paths". |
| **Coherence-exempt** | A file in a designated path that has explicitly opted out via `// @coherence-exempt: <reason>` pragma. |
| **Generated manifest** | One of the three `docs/engine/{CANONICAL_PIPELINE,SURFACE_SUBSCRIBERS,INTEGRATION_DEBT}.md` files. Always regenerated by the scanner. Hand edits will be overwritten and are forbidden. |

---

## History

| Date | Notes |
|------|-------|
| 2026-04-25 | Phase 0 rollout plan authored. Phase 1 gated on user approval. Default opt-out path detection — user can flip to opt-in by editing §"Designated paths" before Phase 1 starts. |

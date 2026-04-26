# Program: Model Coherence

Status: ROLLOUT (Phase 1 — scanner shipped, advisory mode, 2026-04-26)
Owner: `/eng-engine` roundtable + systems-architect persona
Charter: [docs/engine/COHERENCE_ROLLOUT.md](../../docs/engine/COHERENCE_ROLLOUT.md)
Schema: [docs/engine/COHERENCE_SCHEMA.md](../../docs/engine/COHERENCE_SCHEMA.md)
Last assessed: 2026-04-26
Last verified against code: 2026-04-26 (Phase 1 scanner end-to-end run)

---

## What this program governs

Every **decision-relevant module** in the codebase — primitives in `src/utils/{exploitEngine,rangeEngine,handAnalysis,anchorLibrary,assumptionEngine,skillAssessment}/`, aggregator hooks in `src/hooks/use{Player*,*Advisor,*Analysis,CitedDecisions}.js`, and decision-rendering surfaces under `src/components/views/` and `src/components/extension/`. The program treats **integration as a first-class architectural quality** on equal footing with semantic correctness (engine-accuracy).

The program does NOT catch whether a number is mathematically correct (engine-accuracy owns that). It catches **integration drift** — the gap between concepts the codebase has learned to compute and surfaces empowered to consume them.

## The anti-pattern it exists to prevent

> **Failure mode #1 (concept exists, surface never consumes it):** *"We built shapes, and the kind of intermediate-state loading based framing between streets, as concept, but in the future the sidebar can be able to consider them if it did a heavy-high level UX pass."*
>
> **Failure mode #2 (engine primitive stays ancillary):** *"We build a new engine item, that results in more precise output in one area, but it stays 'ancillary' because it was written with narrow scope, and doesn't get eventually 'pulled' into the engine itself."*

These happen when:
- A new primitive ships with narrow scope; no forcing function moves it into the canonical pipeline. Memory shows `personalizedFoldCurve` waited until item 25.1 to be wired; `villainProfileBuilder` and `primitiveValidity` similarly required explicit absorption work.
- A concept (shapes, intermediate-state framing) is designed and implemented but downstream surfaces don't yet route through it. Without a forcing function, this stays true indefinitely.
- The "core primitives of the model and its assumptions" (user's framing) drift apart from the surfaces that should reflect them.

**The Model Coherence Program prevents both by making absorption a *declared promise with a deadline*** — every decision-relevant module exports a `__coherence__` metadata block; primitives that aren't yet integrated declare `status: 'pending-absorption'` with a `targetIntegration.deadline`; a build-time scanner detects orphan primitives and expired deadlines and creates auto-backlog REVIEW items. Drift becomes mechanically visible at the moment it's introduced, not three months later.

---

## Health Criteria

**Governance metrics** (what the program is responsible for):

| Metric | Green | Yellow | Red | Current |
|--------|-------|--------|-----|---------|
| Schema spec + rollout doc + program file landed | All 3 present | 1–2 present | 0 | 3 of 3 (Phase 0 complete) |
| Scanner shipped (`scripts/coherence-scan.cjs`) | Present, runs <5s | Present, slower | Missing | Present, ~110ms warm / 2.3s cold (Phase 1) |
| CI advisory step | Active | Configured but disabled | Missing | Active (continue-on-error, manifests as artifacts) |
| Pre-commit gate active (forward-only) | Active | Configured but disabled | Missing | Deferred — husky not installed (see History) |
| Pre-commit gate active (full enforcement) | Active | Advisory only | Missing | Missing — Phase 3 |
| `/health-check` integration (step 1.5) | Wired | Configured | Missing | Missing — Phase 4 |

**Execution indicators** (continuous, evaluated by scanner):

| Metric | Green | Yellow | Red | Current |
|--------|-------|--------|-----|---------|
| Orphan primitives (`produces` tag with zero consumers) | 0 | 1–2 | 3+ | 0 (only `drill.shapes` declared, research-kind, tracked separately) |
| Expired `targetIntegration.deadline` count | 0 | 1 | 2+ | 0 |
| `pending-absorption` modules > 90 days without progress | 0 | 1 | 2+ | 0 (drill.shapes deadline 2026-07-01) |
| Schema violations in `__coherence__` blocks | 0 | — | Any | 0 |
| Undeclared modules in designated paths (Phase 3+) | 0 | 1–5 | 6+ | 254 — Phase 1 grandfathers existing files (advisory) |
| Surface "could-consume" gaps (advisory) | < 5 | 5–10 | > 10 | 0 (no surfaces declared yet — Phase 2 backfill) |
| New `produces` tags untriaged > 30 days | 0 | 1–2 | 3+ | 0 (`drill.shapes` declares only seed-vocabulary tags) |

---

## Active Backlog Items

Phase 1+ work to be claimed. None blocking today.

- **COH-0** ✅ DONE (2026-04-26): `scripts/coherence-scan.cjs` shipped. AST via `@babel/parser`, walk via `fast-glob`, mtime cache at `.claude/.coherence-cache/`. Cold ~2.3s, warm ~110ms. 36 unit tests in `scripts/__tests__/coherence-scan.test.js`. Modes: default / `--check` / `--staged` / `--json` / `--strict`. Generates `.claude/coherence-report.json` + `docs/engine/{CANONICAL_PIPELINE,SURFACE_SUBSCRIBERS,INTEGRATION_DEBT}.md`. First fixture: `__coherence__` block in `src/utils/drillContent/shapes.js` with `status: 'pending-absorption'`.
- **COH-0a** (DEFERRED): pre-commit hook deferred — husky is not currently a project dep. Phase 1 enforcement is purely advisory anyway, so the CI step + manual `node scripts/coherence-scan.cjs --staged` covers the same ground. Re-evaluate at Phase 3 transition (when blocking enforcement is needed).
- **COH-0b** ✅ DONE (2026-04-26): `.github/workflows/ci.yml` runs `node scripts/coherence-scan.cjs` with `continue-on-error: true` and uploads the four generated artifacts. Phase 1: advisory only.
- **COH-0c** ✅ DONE (2026-04-26): `.claude/commands/handoff.md` template extended with a conditional "Coherence Declarations" section that fires only when the session touched designated paths.
- **COH-1** (REVIEW): Phase 2 — backfill `src/utils/exploitEngine/` (~40 modules; pre-mapped via `src/utils/exploitEngine/CLAUDE.md` "Does / Does NOT" pairs)
- **COH-2** (REVIEW): Phase 2 — backfill `src/utils/rangeEngine/` + `src/utils/handAnalysis/`
- **COH-3** (REVIEW): Phase 2 — backfill aggregator hooks (`usePlayerTendencies`, `useOnlineAnalysis`, `useActionAdvisor`, `useLiveActionAdvisor`, `useHandReplayAnalysis`, `useCitedDecisions`)
- **COH-4** (REVIEW): Phase 2 — backfill decision-rendering surfaces (`LiveAdviceBar`, `SizingPresetsPanel`, `HeroCoachingCard`, `VillainModelCard`, `VillainProfileModal`, `PlayerAnalysisPanel`, `LiveRecommendations`, `ExtensionPanel`)
- **COH-5** (REVIEW): Phase 2 — backfill `anchorLibrary/`, `assumptionEngine/`, `skillAssessment/`, `drillContent/shapes.js`. Note: `shapes.js` is the canonical Phase 1 example of failure mode #1 — its first declaration carries `status: 'pending-absorption'`.
- **COH-6** (REVIEW): Phase 3 — flip pre-commit hook to blocking; CI fails on schema violations + undeclared
- **COH-7** (REVIEW): Phase 4 — wire scanner into `/health-check` step 1.5; auto-backlog triggers fire automatically; manifests regenerated each scan
- **COH-8** ✅ DONE (2026-04-26): `INV-COH-01` appended to `.claude/context/INVARIANTS.md` MUST-Always-Be-True table. Enforcement: `scripts/coherence-scan.cjs` exit code (Phase 1 advisory; Phase 3 blocking).

---

## Milestone Gates

| Gate | Status | Criteria |
|------|--------|---------|
| Phase 0: Schema + program + rollout authored | ✅ COMPLETE 2026-04-25 | This file + `docs/engine/COHERENCE_SCHEMA.md` + `docs/engine/COHERENCE_ROLLOUT.md` present |
| Phase 1: Scanner non-blocking | ✅ COMPLETE 2026-04-26 | `scripts/coherence-scan.cjs` runs ~2.3s cold / ~110ms warm on 255-file corpus; CI advisory step active; pre-commit deferred (husky not installed). First `__coherence__` fixture authored at `drill.shapes`. |
| Phase 1 stable | OPEN | Two weeks CI green; scanner output validated against Phase 1 census; `INTEGRATION_DEBT.md` generated and reviewed |
| Phase 2: Engine backfill | OPEN | All modules under `src/utils/exploitEngine/` declare `__coherence__` |
| Phase 2: Hook backfill | OPEN | All decision-relevant hooks declare |
| Phase 2: Surface backfill | OPEN | All decision-rendering surfaces declare |
| Phase 3: Full enforcement | OPEN | Pre-commit blocks all designated paths without `__coherence__`; CI fails on schema violations and undeclared |
| Phase 4: Steady state | OPEN | Two consecutive `/health-check` cycles GREEN; zero schema violations; auto-backlog triggers wired |

---

## Auto-Backlog Triggers

Evaluated by `scripts/coherence-scan.cjs` (Phase 1+) and surfaced by `/health-check` (Phase 4+).

| Condition | Backlog Template | Priority |
|-----------|------------------|----------|
| `targetIntegration.deadline` expired AND `status !== 'integrated'` | "Integration debt expired: [id] promised absorption into [layer] by [deadline]. Originating: [owners.introducedBy]" | P1 |
| Orphan primitive (`produces` tag with zero consumers) detected for ≥2 consecutive scans | "Orphan primitive: [id] produces [tag] with no consumers — absorb or downgrade to research-only with rationale" | P1 |
| File added under designated paths without `__coherence__` (Phase 3+) | "Coherence declaration missing: [path]" | P0 (blocks merge) |
| Schema violation in `__coherence__` block | "Schema violation in [file]: [error]" | P0 |
| New `produces` tag introduced (never seen before) | "Vocabulary triage: new tag '[tag]' introduced by [id] — promote/rename/retire" | P3 |
| Surface declares `consumes: ['<tag>']` but no primitive `produces` it | "Dangling consumer: [surface-id] expects [tag] with no producer" | P1 |

---

## Relationship to Engine Accuracy

> **engine-accuracy = correct math.** Does the EV number reflect reality? Does the villain model correctly compose Bayesian priors? Are NaN guards in place? Does `stableSoftmax` replace inline `Math.exp`?
>
> **model-coherence = correct integration.** Does the surface that should see the EV number actually receive it? Does the new primitive get absorbed into the canonical pipeline within its declared deadline? When `shapes.js` ships street-aware shapes, does the sidebar consume them?

A change can pass engine-accuracy and fail model-coherence (a new `bucketSegmenter` ships with correct math but `LiveAdviceBar` still shows pre-bucket recommendations because no aggregator pipes the segments through). A change can pass model-coherence and fail engine-accuracy (the wiring is whole but the number is wrong). They are **orthogonal fitness functions**, in the sense of Neal Ford / ThoughtWorks evolutionary architecture: each one tests one architectural characteristic and either gates or surfaces drift independently.

The two programs share the `eng-engine` roundtable as governance owner but maintain distinct Health Criteria, distinct Auto-Backlog Triggers, and distinct enforcement points (engine-accuracy uses test snapshots like RT-108; model-coherence uses the in-source `__coherence__` graph).

---

## Forcing Functions (Mechanical, Not Vigilance)

The program's enforcement points, listed in order of authority:

1. **In-module declaration** — every decision-relevant module exports `__coherence__`. Source of truth lives next to the code; metadata travels with refactors.
2. **Pre-commit gate** (Phase 1+) — `scripts/coherence-scan.cjs --staged`. Phase 1: advisory on new files only. Phase 3: blocking on all designated paths.
3. **CI scan** — every PR runs `coherence-scan.cjs`. Phase 1: advisory annotations. Phase 3: red on schema violations + undeclared.
4. **`/handoff` integration** — conditional "Coherence Declarations" section, shown only when the session touched designated paths. Forces visibility at session close.
5. **`/health-check` step 1.5** (Phase 4+) — runs scanner once; auto-creates REVIEW items from triggers; regenerates manifests.
6. **Invariant INV-COH-01** — added to `.claude/context/INVARIANTS.md` (Phase 1+): every decision-relevant primitive appears in the canonical pipeline manifest OR the integration debt ledger with a non-expired deadline.

The forcing functions compose: a new primitive that escapes the pre-commit gate is caught by CI; a primitive that escapes both is caught at the next `/health-check`; a primitive that hits its deadline without absorption auto-creates a REVIEW item the owner sees in `/status`.

---

## History

| Date | Status | Notes |
|------|--------|-------|
| 2026-04-25 | ROLLOUT (Phase 0) | Program established. Phase 0 deliverables (this file + `docs/engine/COHERENCE_SCHEMA.md` + `docs/engine/COHERENCE_ROLLOUT.md`) authored. No code changes; fully reversible by deleting three docs. Phase 1 (scanner authoring) gated on user approval to proceed. Phase 1 codebase census (Plan-mode exploration) confirmed no major bypass paths exist today; primary value of program is forward-looking prevention of failure modes #1 and #2 as the codebase grows. |
| 2026-04-26 | ROLLOUT (Phase 1) | Scanner shipped. `scripts/coherence-scan.cjs` (530 lines) + `scripts/__tests__/coherence-scan.test.js` (36 tests, all green). New devDeps: `@babel/parser`, `fast-glob`. CI step added with `continue-on-error: true`; manifests uploaded as artifacts. First `__coherence__` block authored in `src/utils/drillContent/shapes.js` per the schema worked example #4 (canonical failure-mode-#1 fixture, deadline `2026-07-01` placeholder pending owner confirmation). `INV-COH-01` added to `INVARIANTS.md`. `.claude/commands/handoff.md` extended with conditional "Coherence Declarations" section. Husky pre-commit deferred — Phase 1 is advisory-only; defer the husky install decision to Phase 3 transition. End-to-end scanner run: 255 files scanned, 1 declared, 254 undeclared (Phase 1 grandfathered), 0 schema violations, 0 expired deadlines, 2 unfulfilled `expectedConsumers` on `drill.shapes` (intentional — both target IDs are placeholders waiting for Phase 2 backfill of `hook.live-action-advisor` and `surface.extension-sidebar`). |

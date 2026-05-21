# ADR-DS-1: `decisionSystems/` Extraction + Shared Primitives Charter

**Status:** Accepted
**Date:** 2026-05-14
**Sprint:** SPR-078 (Refactor Sprint Item 4)
**Authors:** Owner-ratified via plan-mode Q1=Broader / Q2=Bind / Q3=Two ADRs (2026-05-14)
**Supersedes:** —
**Superseded by:** —
**Cross-links:**
- `.claude/decisions/2026-05-14-idb-store-factory-migration-binding.md` (ADR-DS-2)
- `.claude/context/SYSTEM_MODEL.md` §6.1 C-15 + §11 TD-15
- `.claude/projects/refactor-sprint-2026-05-10.md` Item 4
- `src/utils/decisionSystems/CLAUDE.md` (module rules)

---

## Context

The codebase has authored the same 5-piece "decision-system" pattern — engine logic + IDB store + reducer + persistence hook + context+view — **four times**: `anchorLibrary`, `assumptionEngine`, `skillAssessment`, `predictionAudit`. Each instance was built from scratch with slightly different choices: bespoke Beta-Binomial primitives, ad-hoc IDB-wrapper boilerplate, doc-only writer registries, divergent z constants (1.96 vs 1.959963984540054).

The 2026-05-10 architectural survey identified this as the highest-leverage hidden-coupling pattern in the codebase (`SYSTEM_MODEL.md` §6.1 C-15 + §11 TD-15). The next decision-system consumer (PMC Phase 5b prediction ledger) would pay the build cost a 5th time and the existing 4 instances would continue to drift without a shared spine.

Refactor Sprint 2026-05-10 (project charter) ratified Item 4 as the headline of the architectural reset: extract the pattern into `src/utils/decisionSystems/`, migrate `anchorLibrary` as the proof instance, and ship the abstraction with an ADR.

## Decision

Extract `src/utils/decisionSystems/` with a **4-piece surface** mirroring the project charter's DoD verbatim:

1. **`accumulator/`** — `createAccumulator` factory + shared Beta-Binomial primitives (`betaPosterior`: `Z_95`, `applyEvent`, `mean`, `variance`, `standardDeviation`, `credibleInterval`) + Wilson CI (`wilsonInterval`).
2. **`registry/`** — `createRegistry` ID-keyed append-only registry factory + `registryInvariants` validation. No `deregister` (matches I-WR-1 enumerability doctrine).
3. **`idbStore/`** — three factories (`createUpsertStore`, `createReplaceAllStore`, `createEmbeddedRecordStore`) + `migrationGuard` (binding governed by ADR-DS-2).
4. **`reducerComposition/`** — `createNamespacedReducer` slice-composition factory + `withPersistenceDispatch` action-tagging convention.

### Scope boundary

The pattern this module serves is the **stateful decision-system**: engine logic + IDB store + reducer + persistence hook + context+view. Members:
- **Day-1:** `anchorLibrary` (migrates this sprint as proof — `primitiveValidity.js` delegates Beta math to `betaPosterior`; the 4 IDB store wrappers collapse to factory calls; `writers.js` is a new in-code registry mirror of `WRITERS.md`).
- **Tracked-as-future:** `assumptionEngine` (matches all 5 pieces; migration deferred until forcing function appears).

**Explicitly excluded** (different pattern, separate module if shared infra needed):
- `skillAssessment` — pure detector pipeline, no reducer, no context.
- `predictionAudit` — post-hoc reconstruction, output embedded on host hand record, no separate store.

### Reducer-composition adoption

`createNamespacedReducer` and `withPersistenceDispatch` **ship unadopted by anchorLibrary**. anchorLibrary's existing flat reducer stays on `createValidatedReducer` because its 8 actions don't decompose into independent slices cleanly today. The helpers are "available, not yet adopted" — an explicit forcing function for the next stateful migration (assumptionEngine's drillSession sub-slice or PMC Phase 5b's ledger+aggregator dual-slice).

### Growth rule (binding)

A new abstraction enters this module only when a second concrete consumer needs it identically. The 4-instance drift was caused by exactly the reverse pattern (building bespoke shapes that converged but never consolidated); the growth rule is the structural prevention.

## Rationale

### Why the full 4-piece surface (vs narrower options)

The owner ratified Q1=Broader (full charter-verbatim) over Q1=Narrow (`createDecisionSystemReducer` wrapper only) and Q1=Middle (3 grounded pieces, defer reducer-composition).

Three reasons:

1. **Grounded extraction, not speculative API design.** Each of the four pieces is extracted from existing converged code:
   - `createAccumulator` mirrors `primitiveValidity.applyFiringBatch`'s `events.reduce(...)` pattern + `assumptionEngine`'s buildEvidence batch update.
   - `betaPosterior` resolves a real z-constant drift (1.959963984540054 in anchorLibrary, 1.96 in assumptionEngine + skillAssessment).
   - `createUpsertStore` collapses 4 IDB-wrapper files that were 95% identical (~750 LOC of boilerplate → ~600 deleted).
   - `createRegistry` lights up `anchorLibrary/writers.js` (always-planned in-code mirror of `WRITERS.md`) and the same primitive will eventually serve `skillAssessment/leakRules` glob-load + `assumptionEngine/PRODUCTION_RECIPES`.

2. **Long-term-aggressive doctrine** (per `feedback_long_term_over_transition.md`). The owner is the sole user; transition-cost concerns weigh less than end-state shape. Better to author the shared spine with eyes on the next 5+ consumers than to ship a one-consumer-fits-only shape and refactor with each migration.

3. **Forcing function for the unadopted pieces is real.** PMC Phase 5b will need either reducer composition or per-slice persistence dispatch; building the helpers now means the next migration is "wire up the existing primitive," not "design the abstraction during execution." The risk of "ship unadopted abstraction whose shape mismatches the second consumer" is mitigated by the growth rule — substantive changes land with an ADR amendment.

### Risk acceptance

**Over-abstraction churn on consumer #2.** Real risk: assumptionEngine's migration may reveal that `createAccumulator`'s shape doesn't fit perfectly. Mitigation: the abstraction is extracted from existing converged code, not designed-from-imagined-need. If the second consumer reveals a shape mismatch, that's a v2 with an ADR amendment — explicitly preferred over the alternative (4 more years of drift across 5+ instances).

### Why `skillAssessment` and `predictionAudit` are excluded

They're a structurally different pattern: pure detector / pure reconstruction with no Redux state. Forcing them under `decisionSystems/` would be the classic over-abstraction trap (single-abstraction-fits-too-much). If their shared-infrastructure needs grow, the right answer is a separate `src/utils/detectors/` module with its own ADR.

## Consequences

### Resolved

- **SYSTEM_MODEL.md §6.1 C-15** — partially resolved. anchorLibrary migrated; the 5-piece pattern is now named + factored at `src/utils/decisionSystems/`. The remaining drift (assumptionEngine migration) is tracked as TD-15-followup. Pure-detector pattern is explicitly excluded.
- **SYSTEM_MODEL.md §11 TD-15** — same as above. New TD-15-followup entry tracks assumptionEngine migration.
- **z-constant drift across consumers** — RESOLVED. All consumers of Beta-Binomial CI now share `Z_95 = 1.959963984540054` via `betaPosterior`. `assumptionEngine/assumptionProducer.js` still inlines `1.96` (deferred to its future migration); CI grep target catches drift in newly-authored code.

### Introduced

- **One canonical home for shared decision-system math.** `Z_95`, `betaPosterior.applyEvent`, `wilsonInterval` are the canonical primitives. Inlining `1.96` in any new code is an anti-pattern (`decisionSystems/CLAUDE.md`).
- **Forcing function for the next stateful migration.** The unadopted helpers (`createNamespacedReducer`, `withPersistenceDispatch`) make assumptionEngine's migration cheaper. The growth rule prevents premature additions.
- **Tighter coupling to `migrationRegistry.js`** via ADR-DS-2's factory binding. New IDB stores authored through the factories cannot exist without a registry entry.

### Deferred

- **assumptionEngine migration** — tracked as TD-15-followup. Forcing function: when assumptionEngine touches its persistence layer next or when PMC Phase 5b ships, migrate.
- **skillAssessment `heroLeakDetector` migration to shared registry** — deferred; existing `import.meta.glob` auto-load works.
- **`assumptionEngine/PRODUCTION_RECIPES` migration to shared registry** — deferred.
- **Reducer-composition adoption by anchorLibrary** — deferred indefinitely; reducer shape doesn't decompose cleanly into independent slices.
- **Exact Beta CDF inversion** for credible intervals (currently normal approximation). The approximation is conservative (slightly wider CI on small n → harder to invalidate primitives, which is the safe direction). If precision becomes load-bearing, swap with an ADR amendment.

## Verification

### Test surface

- 134 new tests across `src/utils/decisionSystems/**/__tests__/` (accumulator 50 + registry 20 + idbStore 45 + reducerComposition 19).
- 9 new drift tests at `src/utils/anchorLibrary/__tests__/writers.test.js` (parses WRITERS.md, asserts registry parity).
- All 1590 existing anchorLibrary + persistence + decisionSystems tests pass post-migration.
- z-constant drift check: `grep -rn "1.96" src/utils/anchorLibrary src/utils/decisionSystems` returns zero matches outside `betaPosterior.js` (the canonical home).

### Manual smoke (Anchor Library view)

1. Open Anchor Library — anchors hydrate and render.
2. Capture an observation via HandReplayView; reload — observation persists.
3. Retire an anchor via long-press → RetirementConfirmModal; reload — retired status persists.

### Build

- `npm run build` clean.
- No circular imports — `decisionSystems/` depends only on `persistence/migrationRegistry.js` (read-only consumption by `migrationGuard`) and `persistence/database.js` (for `getDB` / `log` / `logError`). It is a leaf in the import graph relative to consumers.

## Alternatives considered

### Narrow (Q1=Narrow)

Ship only a `createDecisionSystemReducer` wrapper (~80 LOC). Defer accumulator + registry + IDB factory + composition. Rationale (rejected): cheapest, easiest retreat, but doesn't address the verbatim charter DoD; the z-constant drift would persist; the 4-instance store-wrapper boilerplate would stay; the next consumer (PMC Phase 5b) still pays the build cost.

### Middle (Q1=Middle)

Ship 3 grounded pieces (accumulator + registry + IDB factory). Defer reducer-composition. Rationale (rejected by Q1=Broader vote): valid middle ground — captures most of the leverage — but the unadopted reducer-composition is a cheap forcing function whose shape is grounded in existing dual-slice patterns (anchorLibrary's anchors+observations+drafts+primitives slices already exist as fields; PMC Phase 5b's ledger+aggregator is the obvious next consumer). Authoring the helper now means the next migration is "wire up," not "design."

### Decouple from migrationRegistry (Q2=Decouple)

The factory produces CRUD wrappers without registry membership assertion. Rationale (rejected by Q2=Bind vote): the registry's drift surface stays open; nothing forces new stores to register; "prefer unrepresentable to validated" doctrine (`feedback_action_dispatch_legality.md`) favors making the wrong thing hard to author. See ADR-DS-2 for the binding rationale.

### One ADR (Q3=One)

Cover the whole pattern in a single document. Rationale (rejected by Q3=Two vote): the migration-registry binding (ADR-DS-2) is a narrower, more contentious decision than the umbrella extraction. Future challenges to the binding shouldn't re-open the umbrella decision. Two ADRs let each one be ratified or amended independently.

## Status notes

- Initial authoring: 2026-05-14 (SPR-078).
- Owner-ratified: 2026-05-14 via plan-mode AskUserQuestion (Q1=Broader, Q2=Bind, Q3=Two ADRs).
- Implementation: SPR-078 single-item plan-first sprint; ~3-session-equivalent scope completed.

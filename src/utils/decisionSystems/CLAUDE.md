# decisionSystems/ — Domain Rules

**MANDATORY**: Before editing ANY file in this directory, read in order:
1. `.claude/decisions/2026-05-14-decision-systems-extraction.md` (ADR-1 — extraction charter, scope boundary, growth rule)
2. `.claude/decisions/2026-05-14-idb-store-factory-migration-binding.md` (ADR-2 — IDB factory ↔ migrationRegistry binding)
3. `.claude/context/SYSTEM_MODEL.md` §6.1 C-15 + §11 TD-15 (what this module was extracted to resolve)
4. The CLAUDE.md of the consumer you're touching (e.g., `src/utils/anchorLibrary/CLAUDE.md`)

This module is shared infrastructure for the **stateful decision-system pattern**: engine logic + IDB store + reducer + persistence hook + context+view. It was extracted in SPR-078 (2026-05-14) from four instances that had silently drifted apart.

## Who belongs (member criteria)

A consumer is a "stateful decision system" when **all five** of these hold:

1. It has its own **engine logic** (pure functions producing/updating typed records).
2. It owns one or more **IDB stores** for persisted records.
3. It has a **reducer** with named action types over a dict-keyed slice or slices.
4. It has a **persistence hook** that hydrates on mount and debounce-writes on change.
5. It has a **React context** that exposes selectors + a dispatcher.

Day-1 member: **anchorLibrary**.
Tracked-as-future member: **assumptionEngine** (matches all 5; migration deferred per ADR-1).

## Who does NOT belong

A consumer is **NOT** a member of this module if it lacks a reducer (transient state) OR lacks an IDB store (computation-only) OR is a pure detector that writes directly to IDB without Redux state:

- **`skillAssessment/`** — pure detector pipeline; no reducer, no context. If shared infra is needed, it goes to a `src/utils/detectors/` module (separate ADR).
- **`predictionAudit/`** — post-hoc reconstruction; output embedded on the host hand record. No reducer, no dedicated store.

These are a DIFFERENT pattern. Forcing them under `decisionSystems/` would be over-abstraction.

## Growth rule (binding)

**An abstraction enters this module only when a second concrete consumer needs it identically.** Reducer-composition + persistence-dispatch helpers ship in the initial extraction unadopted by anchorLibrary — they are explicitly **forcing functions** for the next migration (assumptionEngine, PMC Phase 5b ledger). Do NOT add a new shared helper merely because "we might want one." The 4-instance drift this module was extracted to resolve was caused by EXACTLY that pattern in reverse — building bespoke shapes that converged but never consolidated.

## Surface (≤ 12 exports)

| Submodule | Export | Purpose |
|-----------|--------|---------|
| `accumulator/` | `createAccumulator` | Generic incremental accumulator factory; thin wrapper over a reduce fn. |
| `accumulator/` | `Z_95` | Canonical IEEE-754 nearest representable of Φ⁻¹(0.975) = 1.959963984540054. **Single source of truth.** |
| `accumulator/` | `applyEvent`, `mean`, `variance`, `standardDeviation`, `credibleInterval` | Beta-Binomial primitives. |
| `accumulator/` | `wilsonInterval` | Wilson 95% CI for binomial proportions; defaults to Z_95. |
| `registry/` | `createRegistry` | ID-keyed append-only registry with required-field validation. No deregister (I-WR-1 enumerability). |
| `idbStore/` | `createUpsertStore` | CRUD wrapper for upsert-by-key stores. |
| `idbStore/` | `createReplaceAllStore` | CRUD + atomic per-owner replace-all wrapper. |
| `idbStore/` | `createEmbeddedRecordStore` | Read/write wrapper for records embedded on a host record. |
| `idbStore/` | `assertStoreRegistered`, `__testing__` | migrationRegistry binding (ADR-2). |
| `reducerComposition/` | `createNamespacedReducer` | Slice composition; ships unadopted (per ADR-1). |
| `reducerComposition/` | `withPersistenceDispatch`, `shouldPersistAction` | `{ persist: false }` action-tagging convention. |

## Anti-patterns

### DO NOT inline `1.96` anywhere

`Z_95 = 1.959963984540054` is canonical. The extraction's load-bearing benefit is the single z constant across consumers. CI grep target: `grep -rn "1.96" src/utils/anchorLibrary src/utils/decisionSystems` returns zero hits outside `betaPosterior.js`.

### DO NOT bypass the migration guard outside tests

`__testing__.bypassMigrationCheck` is a test-only escape hatch. Production code MUST NOT reference `__testing__`. CI grep enforces (`grep -rn "bypassMigrationCheck" src/` returns hits only in `__tests__/` paths + `migrationGuard.js` itself).

### DO NOT add a generic accumulator base class

`createAccumulator` is a factory, not a class. Inheritance creates coupling between consumers; the factory keeps consumers independent. If a consumer's accumulator looks structurally identical to another consumer's, that's a sign to revisit shared primitives (`betaPosterior`, `wilsonCI`) — NOT to introduce a base class.

### DO NOT add a `deregister` to the registry

The append-only contract is load-bearing for I-WR-1 enumerability (writer/rule/recipe registries depend on it). If a consumer needs deregistration semantics, that's a different abstraction — challenge before extending this one.

### DO NOT subsume pure-detector instances

`skillAssessment/` and `predictionAudit/` are pure detectors. Do not migrate them under `decisionSystems/`. If a future detector needs shared infra, author it at `src/utils/detectors/` (separate ADR).

### DO NOT couple decisionSystems/ to consumer domains

This module knows nothing about anchors, assumptions, leaks, or predictions. If a helper here references domain concepts (poker hands, villains, exploits, leaks), refactor the domain out.

### DO NOT skip the ADR

Every architectural choice this module ratifies is recorded in ADR-1 or ADR-2. Substantive changes (new submodule, contract breakages, migration-binding behavior change) MUST land with an ADR amendment.

## File responsibilities

| File | Does | Does NOT |
|------|------|----------|
| `accumulator/createAccumulator.js` | Generic { fold, step, finalize } factory | Domain math |
| `accumulator/betaPosterior.js` | Beta-Binomial primitives + Z_95 | Domain bookkeeping (sampleSize, supportsCount stay with consumer) |
| `accumulator/wilsonCI.js` | Wilson 95% CI for binomial proportions | Domain rules (n≥30 floor stays with skillAssessment) |
| `registry/createRegistry.js` | ID-keyed append-only registry factory | Domain-specific registration logic |
| `registry/registryInvariants.js` | Required-field validation | Type/range invariants |
| `idbStore/createUpsertStore.js` | CRUD wrapper for upsert-by-key stores | Store creation (still in migrations.js) |
| `idbStore/createReplaceAllStore.js` | CRUD + atomic per-owner replace-all wrapper | Index/keyPath design (consumer's choice) |
| `idbStore/createEmbeddedRecordStore.js` | Read/write wrapper for embedded records | Host record schema |
| `idbStore/migrationGuard.js` | `assertStoreRegistered` + test escape hatch | Database opening |
| `reducerComposition/createNamespacedReducer.js` | Slice-map → composed reducer | Action-shape design (consumer's choice) |
| `reducerComposition/withPersistenceDispatch.js` | `{ persist: false }` action-tagging convention | Debounce / write logic (in consumer's persistence hook) |

## Related docs

- `.claude/decisions/2026-05-14-decision-systems-extraction.md` (ADR-1)
- `.claude/decisions/2026-05-14-idb-store-factory-migration-binding.md` (ADR-2)
- `.claude/context/SYSTEM_MODEL.md` §6.1 C-15 + §11 TD-15
- `.claude/projects/refactor-sprint-2026-05-10.md` Item 4 (this sprint)
- `src/utils/anchorLibrary/CLAUDE.md` (day-1 consumer)
- `src/utils/persistence/migrationRegistry.js` (ADR-2 binding target)

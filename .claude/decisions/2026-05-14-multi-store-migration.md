# ADR-PERSIST-2: Multi-Store Migration in Single Version

**Status:** Accepted
**Date:** 2026-05-14
**Sprint:** SPR-080 Item 2 (Refactor Sprint Item 7 / WS-188 Phase 3)
**Cross-links:**
- `.claude/decisions/2026-05-14-schema-versioning-policy.md` (ADR-PERSIST-1)
- `docs/persistence/FAILURE_MODES.md` FM-PERSIST-6, FM-PERSIST-12
- `src/utils/persistence/migrations.js`
- `docs/projects/exploit-anchor-library/gate4-p3-decisions.md` §2 (precedent)

---

## Context

When a single project introduces multiple related stores (e.g., EAL Phase 6 introduced 4 stores: `exploitAnchors`, `anchorObservations`, `anchorCandidates`, `perceptionPrimitives`), there are two possible structures:

1. **Serial**: one migration version per store (v19 = exploitAnchors, v20 = anchorObservations, …). Four version bumps for four related stores.
2. **Bundled**: one migration version creates all 4 stores in a single `onupgradeneeded` transaction.

EAL chose bundled: `migrateV19` creates all 4 stores. PMC Phase 5a followed the same precedent (v25 adds the `predictionAudit` field on hands + multiple related indexes).

This ADR ratifies bundled multi-store migration as the canonical pattern.

## Decision

A single migration version MAY add multiple object stores when they are part of the same coherent feature. The migration:
1. Must complete every store addition + index creation in a single `onupgradeneeded` transaction.
2. Must NOT split the feature across versions (e.g., v19 adds 2 of 4 stores and v20 adds the other 2). Bundling is all-or-nothing per feature.
3. Must list every store in the `MIGRATION_REGISTRY` entry's `storesAdded` array.
4. Migration registry test #5 enforces the registry-side consistency.

## Rationale

### Why bundling

IDB transaction atomicity is the load-bearing guarantee. Bundling means **a feature ships entirely or not at all**. If the app crashes mid-migration, the rollback reverts every change — no partial-feature state.

Serial migration loses this guarantee. If v19 creates `exploitAnchors` and the upgrade succeeds, but v20 (which would create `anchorObservations`) is on a later code version, the database has a half-feature: anchors exist but no observation store. The hooks that depend on both stores must handle this missing-store case at runtime — bloat and complexity.

### Why the same-feature rule

Bundling unrelated stores in one version makes the change log unreadable and couples unrelated programs. The rule is: bundle if and only if the stores are part of the same feature. EAL's 4 stores are tightly coupled (writers WRITERS.md spans all 4); they belong together. If PIO and PMC each need a new store on the same day, they get separate versions even if they ship in the same release.

### Cursor error caveat (FM-PERSIST-6 / FM-PERSIST-12)

There is a real bug in the current migration code: cursor-based data backfill in `migrations.js` logs cursor errors but does NOT call `tx.abort()`. This means a cursor error during multi-store migration silently leaves the transaction in a partial state.

**This is a bug, not a refutation of bundling.** The fix (add `tx.abort()` to every cursor `.onerror` handler) is tracked as TD-19. Once that fix lands, bundling's atomicity guarantee holds end-to-end.

## Consequences

### Enforced

- Single `onupgradeneeded` transaction per `DB_VERSION` bump.
- `MIGRATION_REGISTRY[version].storesAdded` lists every store created at that version.
- Test #5 in `migrationRegistry.test.js` verifies registry-vs-code consistency.

### Limitations

- Bundled migrations are larger and harder to review. Each one should have a project charter referenced in `owner.projectRef`.
- Bundled migrations are harder to roll back partially. If only one store of a 4-store bundle needs revision, the choice is either a new migration (additive) or live with the original shape.
- Cursor error mid-bundle currently leaves partial state (FM-PERSIST-6). Fix tracked as TD-19.

### Sub-decisions deferred

- Per-store rollback: not supported; would require IDB-spec-level changes.
- Cursor-error abort enforcement: tracked as TD-19; not blocking this ADR.

## Alternatives considered

### Serial (rejected)

One store per version. Rejected: loses atomicity per feature; bloats version numbers; introduces missing-store runtime checks in every consumer.

### Lazy creation (rejected)

Create stores on first write. Rejected: IDB doesn't support runtime store creation outside `onupgradeneeded`; would require complex retry logic and migration timing.

### Migration scripts external to code (rejected)

Run migrations from a separate SQL-like file. Rejected: IDB has no equivalent; the migration is JS regardless. The registry already serves as the "external" documentation layer.

## Status notes

- Initial authoring: 2026-05-14 (SPR-080).
- Pattern in production since EAL v19 (2026-04-25); formalized here.
- Owner-ratified via WS-188 spec list.

# IDB_CONCURRENT_CURSOR_MIGRATION_CLOBBER

**Status:** GUARDED 2026-06-05 by the `oldVersion < N` skip pattern in `migrateV27` + `migrationV27.test.js` concurrent-cursor regression test + INV-TAG-3.

## Trigger

Two (or more) IndexedDB schema migrations each walk a cursor over the **same object store** within a **single `onupgradeneeded` transaction** (i.e., a user upgrading across both versions in one DB open), and each cursor's `cursor.update(record)` writes back a record default. After the upgrade, one migration's field default is silently missing — the other migration clobbered it.

**Origin incident:** 2026-06-05, SPR-107 / WS-190. `migrateV27` added a `reviewTag: null` default to the `hands` store using the same cursor-walk pattern as `migrateV25` (`predictionAudit: null`). On any pre-v25 → v27 upgrade (e.g., the migrationV25 test seeds at v24), both `migrateV25` and `migrateV27` open cursors over `hands` in the same upgrade transaction. `migrationV25.test.js` began failing: `expected undefined to be null` — `predictionAudit` was gone. Caught locally by the existing v25 test during the WS-190 verification run; fixed before commit.

## Mechanism

Per the IndexedDB request-ordering spec, requests against a transaction process in FIFO order, and `cursor.update()` / `cursor.continue()` enqueue **new** requests at the tail of the queue:

1. `migrateV25` opens cursor → request `R1` queued. `migrateV27` opens cursor → request `R2` queued.
2. `R1` fires (record #1): callback reads the **original** record (snapshot), sets `predictionAudit`, enqueues `R1a` (put) + `R1b` (continue) — both AFTER `R2`.
3. `R2` fires (record #1): reads the **original** record again (R1a's put hasn't executed yet), sets `reviewTag`, enqueues `R2a` (put). `R2`'s snapshot has no `predictionAudit`.
4. `R1a` executes → writes `{…, predictionAudit: null}` (no reviewTag).
5. `R2a` executes → writes `{…, reviewTag: null}` (NO predictionAudit — R2's stale snapshot). **R2a wins → predictionAudit lost.**

This is real IndexedDB behavior, not a fake-indexeddb artifact — it would corrupt the v25 default in production for any user upgrading from < v25.

## Fix

Never run two concurrent cursor walks over the same store in one upgrade transaction. `migrateV27` skips its cursor pass when a co-running migration owns the store this upgrade:

```js
// migrateV27(db, transaction, oldVersion)
if (oldVersion < 25) {
  // migrateV25 also walks `hands` this upgrade — skip to avoid clobbering it.
  return;
}
```

Legacy hands on a pre-v25 → v27 upgrade then carry `reviewTag: undefined`. This is safe **only because every consumer reads the field via `hand.reviewTag?.tagged`** (undefined ≡ null ≡ untagged). The `runMigrations` call passes `oldVersion` through: `if (oldVersion < 27 && oldVersion > 0) migrateV27(db, transaction, oldVersion);`.

## Prevention

- **Before adding a cursor-walk default to a store that already has one in a lower version,** check `runMigrations` for other `migrateVN` functions that walk the same store. If the upgrade range can include both, guard the newer one with `oldVersion >= <other version>` (or consolidate the defaults into one pass).
- Field-default migrations are only safe to skip when **all consumers tolerate `undefined`** (use optional chaining). If a consumer requires the field to exist, the skip is not acceptable — consolidate instead.
- Test the cross-version path explicitly: seed at a version below the older migration, open at the newer version, and assert **both** fields survive. See `migrationV27.test.js` "concurrent-cursor hazard mitigation".
- This is distinct from the additive-only invariant (`scripts/check-idb-additive.sh`) — that guard does not catch same-store concurrent cursors.

## Related

- INV-TAG-3 (`system/invariants.md`) — codifies the guard for the reviewTag migration.
- `src/utils/persistence/migrations.js` — `migrateV25` (predictionAudit), `migrateV27` (reviewTag) + hazard comment.

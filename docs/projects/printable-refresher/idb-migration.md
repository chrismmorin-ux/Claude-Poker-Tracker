# IDB migration spec — Printable Refresher

**Status:** v1.0 — Gate 4, Session 6 (2026-04-25).
**Depends on:** `docs/design/surfaces/printable-refresher.md` §State (store shapes); `WRITERS.md` (writer keypath + index requirements); `docs/projects/printable-refresher.project.md` §Decisions §Q6 (dynamic IDB version coordination); EAL `gate4-p3-decisions.md` §2 (precedent for `max(currentVersion + 1, targetVersion)` rule).
**Purpose:** Define the additive IDB migration that adds two new stores (`userRefresherConfig` singleton + `printBatches` UUID-keyed) without modifying any existing v17 stores. Migration is idempotent, additive-only, and coordinates with parallel project version claims.

---

## Why this spec exists

The Printable Refresher needs persistent state for owner preferences + print history. Two stores cover the full scope:

- `userRefresherConfig` — singleton record holding `cardVisibility` + `suppressedClasses` + `printPreferences` + `notifications` + `lastExportAt`. Owner-mutated; one record per user.
- `printBatches` — UUID-keyed records, one per print batch. Append-only per I-WR-5. Used by `selectStaleCards` for staleness-diff.

Both stores are new in this migration. Existing stores (hands / sessions / players / activeSession / settings / rangeProfiles / tournaments / villainAssumptions / and any other v17-additions) are NOT touched.

The IDB version number is dynamic per Q6 — both PRF and Shape Language laid claim to v18 in parallel. Whichever project ships its migration first claims v18; the other bumps to v19. This spec uses the symbolic name `<TARGET_VERSION>` rather than a hardcoded number until the implementation moment.

---

## Coordination rule (Q6 ratified)

Per Q6 owner ratification + EAL gate4-p3-decisions §2 precedent:

```
TARGET_VERSION = max(currentVersion + 1, 18)
```

At Phase 5 implementation time:
1. Read current `db.version` from a fresh IDB connection (or `indexedDB.databases()` lookup).
2. Compute `TARGET_VERSION = Math.max(currentVersion + 1, 18)`.
3. Open IDB at `TARGET_VERSION`; `onupgradeneeded` runs the migration.

If Shape Language ships first at v18, PRF's `currentVersion + 1` becomes 19 ≥ 18, so PRF claims v19. If PRF ships first, PRF claims v18; Shape Language's later migration bumps to v19. The `max` formula is monotonic + collision-free.

---

## Stores added by this migration

### Store 1 — `userRefresherConfig`

| Property | Value |
|---|---|
| **Keypath** | `id` (string, constant `'singleton'`) |
| **Auto-increment** | No |
| **Indexes** | None (single-record store; no query needed) |
| **Records at migration time** | 1 — seeded with default singleton (see §Seeding) |

**Record shape v1:**

```ts
type UserRefresherConfigRecord = {
  id: 'singleton';
  schemaVersion: 1;
  cardVisibility: { [cardId: string]: 'default' | 'hidden' | 'pinned' };
  suppressedClasses: string[];
  printPreferences: {
    pageSize: 'letter' | 'a4';
    cardsPerSheet: 12 | 6 | 4 | 1;
    colorMode: 'auto' | 'bw';
    includeLineage: boolean;
    includeCodex: false;  // Phase 1 structural per Q7 + AP-PRF-09
  };
  notifications: {
    staleness: boolean;  // default false per AP-PRF-08
  };
  lastExportAt: ISO8601 | null;
};
```

### Store 2 — `printBatches`

| Property | Value |
|---|---|
| **Keypath** | `batchId` (string, UUID v4) |
| **Auto-increment** | No |
| **Indexes** | `printedAt` (for chronological listing + most-recent-batch lookup per `selectStaleCards`) |
| **Records at migration time** | 0 — empty store; first record on first owner print confirmation |

**Record shape v1:**

```ts
type PrintBatchRecord = {
  batchId: string;       // UUID v4
  printedAt: ISO8601;    // user-entered + editable + backdateable per Q9
  label: string | null;
  cardIds: string[];
  engineVersion: string; // e.g., 'v4.7.2'
  appVersion: string;    // e.g., 'v123'
  perCardSnapshots: {
    [cardId: string]: {
      contentHash: string;  // sha256:...
      version: string;      // semver
    };
  };
  schemaVersion: 1;
};
```

`printBatches` is **append-only** per I-WR-5. The migration creates the store but writes zero records. W-URC-3 (print-date-stamp-writer) is the only caller that ever inserts.

---

## Migration code (Phase 5 implementation sketch)

```js
// src/utils/persistence/migrations.js (extended for refresher stores)

export function migrateRefresherStores(db, oldVersion, newVersion) {
  // Idempotent — only acts if the stores don't already exist
  // Migration is additive: existing stores untouched.

  if (!db.objectStoreNames.contains('userRefresherConfig')) {
    const configStore = db.createObjectStore('userRefresherConfig', {
      keyPath: 'id',
      autoIncrement: false,
    });
    // Seed singleton (see §Seeding below)
    configStore.put(buildDefaultRefresherConfig());
  }

  if (!db.objectStoreNames.contains('printBatches')) {
    const batchStore = db.createObjectStore('printBatches', {
      keyPath: 'batchId',
      autoIncrement: false,
    });
    batchStore.createIndex('printedAt', 'printedAt', { unique: false });
    // No seeding — empty until first user print
  }
}

// src/utils/persistence/refresherDefaults.js
export function buildDefaultRefresherConfig() {
  return {
    id: 'singleton',
    schemaVersion: 1,
    cardVisibility: {},        // empty map; entries added on owner action
    suppressedClasses: [],     // empty array; entries added on owner action
    printPreferences: {
      pageSize: 'letter',      // Q4 default
      cardsPerSheet: 12,       // 12-up default per Q4
      colorMode: 'auto',
      includeLineage: true,    // lineage footer ON by default per red line #12
      includeCodex: false,     // Phase 1 structural; never true at v1
    },
    notifications: {
      staleness: false,        // AP-PRF-08 opt-in default OFF
    },
    lastExportAt: null,
  };
}

// src/utils/persistence/openDb.js (extended)
export async function openRefresherAwareDb() {
  const databases = await indexedDB.databases?.() ?? [];
  const existing = databases.find(d => d.name === DB_NAME);
  const currentVersion = existing?.version ?? 0;
  const TARGET_VERSION = Math.max(currentVersion + 1, 18);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, TARGET_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Existing migrations from v0..v17 run as-is per their existing code paths.
      // Refresher migration runs as additive overlay:
      migrateRefresherStores(db, oldVersion, TARGET_VERSION);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
```

**Critical properties:**

1. **Existence-check before create.** `if (!db.objectStoreNames.contains(...))` makes the migration idempotent — running it twice (or in a refresh-then-upgrade scenario) doesn't error.
2. **Singleton seeded at create time.** The empty default singleton lets W-URC-1 / W-URC-2 read-then-modify on first owner action without an additional "does the singleton exist?" check at every read.
3. **printBatches NOT seeded.** Empty store at create; first record on first owner print. No "default batch" semantics.
4. **Existing v17 stores untouched.** The `migrateRefresherStores` function does not reference any existing store; running it on a v17 db produces a v18+ db with two new stores added and zero modifications elsewhere.

---

## Seeding (`userRefresherConfig` singleton)

The singleton is seeded **at migration time**, not at first-read time. Rationale:

- W-URC-1 + W-URC-2 read-then-modify the singleton. If the read returns `undefined` (no record yet), every writer would need a "create singleton" branch.
- Seeding at migration removes that branch — readers always see a valid singleton.
- Migration is run-once per IDB open; cost is negligible.

The default singleton matches `buildDefaultRefresherConfig()` above. Phase 1 structural defaults:

- `cardVisibility: {}` — no per-card overrides at first launch.
- `suppressedClasses: []` — no class suppressed at first launch.
- `printPreferences.pageSize: 'letter'` — Q4 default.
- `printPreferences.cardsPerSheet: 12` — Q4 default.
- `printPreferences.colorMode: 'auto'` — let browser/printer manage.
- `printPreferences.includeLineage: true` — red line #12 lineage-mandatory.
- `printPreferences.includeCodex: false` — Phase 1 structural; AP-PRF-09 + Q7.
- `notifications.staleness: false` — AP-PRF-08 opt-in default OFF.
- `lastExportAt: null` — no exports yet.

The W-URC-1 validator rejects any patch attempting to set `includeCodex: true` (Phase 1 enforcement); upgrade to `true` is gated on Phase 2+ Gate 4 design pass per PRF-P2-PE.

---

## Test coverage targets (PRF-G5-MIG)

### Migration round-trip

```js
// src/utils/persistence/__tests__/refresherMigration.test.js
describe('Refresher migration', () => {
  it('creates both stores on fresh v17 → v18+ upgrade', async () => {
    const db = await openV17TestDb();           // simulates existing v17 db
    expect(db.objectStoreNames.contains('userRefresherConfig')).toBe(false);
    expect(db.objectStoreNames.contains('printBatches')).toBe(false);

    db.close();
    const upgraded = await openRefresherAwareDb();  // runs the migration
    expect(upgraded.objectStoreNames.contains('userRefresherConfig')).toBe(true);
    expect(upgraded.objectStoreNames.contains('printBatches')).toBe(true);
  });

  it('seeds default singleton on first migration', async () => {
    const db = await openRefresherAwareDb();
    const tx = db.transaction('userRefresherConfig', 'readonly');
    const record = await promisifiedGet(tx, 'singleton');
    expect(record).toEqual(buildDefaultRefresherConfig());
  });

  it('is idempotent — re-running migration does not duplicate or reset', async () => {
    const db1 = await openRefresherAwareDb();
    // Mutate singleton
    await mutateConfig(db1, { 'printPreferences.colorMode': 'bw' });
    db1.close();

    // Force re-open at higher version
    const db2 = await openRefresherAwareDbForceUpgrade();
    const record = await getConfig(db2);
    expect(record.printPreferences.colorMode).toBe('bw');  // mutation preserved
  });

  it('does not modify any v17 store', async () => {
    const v17Snapshot = await captureV17Snapshot();
    const upgraded = await openRefresherAwareDb();
    const v18Snapshot = await captureV17StoresFromV18Db(upgraded);
    expect(v18Snapshot).toEqual(v17Snapshot);  // byte-equal
  });

  it('printBatches has printedAt index', async () => {
    const db = await openRefresherAwareDb();
    const tx = db.transaction('printBatches', 'readonly');
    const indexNames = Array.from(tx.objectStore('printBatches').indexNames);
    expect(indexNames).toEqual(['printedAt']);
  });

  it('handles dynamic version target collision-free with Shape Language pre-claim', async () => {
    // Simulate Shape Language claiming v18 first
    const db = await openShapeLanguageDb({ targetVersion: 18 });
    db.close();

    // PRF runs after; should claim v19
    const upgraded = await openRefresherAwareDb();
    expect(upgraded.version).toBeGreaterThanOrEqual(19);
  });
});
```

### Suppression durability across migrations (red line #13 + I-WR-4)

```js
it('preserves suppressedClasses across simulated v18 → v19 bump (PRF-G5-DS)', async () => {
  const db1 = await openRefresherAwareDb();
  await mutateConfig(db1, { suppressedClasses: ['exceptions', 'equity'] });
  db1.close();

  // Simulate a future v19 schema bump (additive — adds a new field; preserves existing)
  const db2 = await openRefresherAwareDbForceUpgrade();
  const record = await getConfig(db2);
  expect(record.suppressedClasses).toEqual(['exceptions', 'equity']);
});
```

This test is shared with PRF-G5-DS (durable-suppression test target) — the migration spec asserts suppression survives bumps; the durable-suppression test asserts the same property at the writer/reducer layer.

### printBatches append-only invariant (I-WR-5)

```js
it('does not delete printBatches records on migration', async () => {
  const db1 = await openRefresherAwareDb();
  await db1.transaction('printBatches', 'readwrite').objectStore('printBatches').put({
    batchId: 'test-uuid',
    printedAt: '2026-04-25T00:00:00Z',
    cardIds: ['math-auto-profit'],
    perCardSnapshots: { 'math-auto-profit': { contentHash: 'sha256:abc', version: 'v1.0' } },
    engineVersion: 'v4.7.2',
    appVersion: 'v123',
    label: null,
    schemaVersion: 1,
  });
  db1.close();

  const db2 = await openRefresherAwareDbForceUpgrade();
  const tx = db2.transaction('printBatches', 'readonly');
  const records = await getAllRecords(tx, 'printBatches');
  expect(records).toHaveLength(1);
  expect(records[0].batchId).toBe('test-uuid');  // batch preserved
});
```

---

## Future schema-version bumps (within v18+ migration framework)

The migration spec covers the **store-creation** event. Future schema changes within the stores (e.g., adding a new field to `userRefresherConfig` v2) are handled by **per-record schema versioning**, not full IDB version bumps:

- Add new field with default value at read-time (lazy migration).
- Increment `record.schemaVersion` at next write.
- New writers handle both v1 and v2 records on read.

This pattern matches EAL precedent. Full IDB version bumps are reserved for store-level changes (new store, new index, deleted store). Field-level changes are read-time-migrated.

**Ratified invariant (I-WR-4 from WRITERS.md):** future schema bumps preserve `suppressedClasses` byte-for-byte. No "upgrade" or "reset" of suppression state. Test PRF-G5-DS asserts this.

---

## Coordination with parallel projects

At Phase 5 implementation, two parallel projects may be claiming new IDB versions concurrently:

- **Shape Language** plans v18 for `shapeMastery` + `shapeLessons` stores.
- **Monetization & PMF** plans v18+ for billing-related stores (subscription state + entitlement).
- **Possible others** if more projects open before refresher implementation.

The dynamic-target rule resolves all collisions:

```
TARGET_VERSION = max(currentVersion + 1, planned_minimum)
```

Each project's migration logic checks the current db version + adds 1 (or claims its planned minimum, whichever is higher). Multi-project simultaneous open is not a concern — IDB serializes via `onversionchange` events.

**STATUS.md coordination:** When implementation begins, STATUS.md top entry should declare the version claim ("PRF claims v18" or "PRF claims v19, Shape Language having shipped v18 first"). This is for human visibility; the runtime claim is dynamic regardless.

---

## Phase 5 implementation checklist

- [ ] Author `src/utils/persistence/migrations.js` extension `migrateRefresherStores(db, oldVersion, newVersion)`.
- [ ] Author `src/utils/persistence/refresherDefaults.js` `buildDefaultRefresherConfig()`.
- [ ] Extend `src/utils/persistence/openDb.js` with dynamic-target version computation.
- [ ] Author `src/utils/persistence/__tests__/refresherMigration.test.js` with 6+ migration test cases (round-trip / seed / idempotent / no-mutation / index / collision).
- [ ] Verify `fake-indexeddb` test environment supports `databases()` API (or shim if needed).
- [ ] Update `SYSTEM_MODEL.md` §Persistence with new stores documented + dynamic-version note.
- [ ] Coordinate with Shape Language at implementation time to confirm version claim order.
- [ ] Add `userRefresherConfig` + `printBatches` to backup/export pipeline (`docs/projects/exploit-anchor-library/gate4-p3-decisions.md` §3 precedent — backup expansion table; PRF inherits the same pattern).

---

## Backup / export expansion (cross-project pattern)

Per EAL gate4-p3-decisions §3, the app's backup/export pipeline expands additively as new stores are added. Both `userRefresherConfig` and `printBatches` should be included in:

- **Owner backup** — full IDB dump for owner's own use.
- **Owner migration** — moving to a new device. Both stores included; schema preserved.

**Out of scope for Phase 1:** share-with-others variant of `printBatches` (would let owner share a print pack with another owner). Phase 8+ defers per EAL precedent.

---

## Amendment rule

Adding a new store to the refresher project requires:
1. **Persona-level review.**
2. New JTBD or new persona that motivates the store.
3. Update this spec with shape + keypath + indexes + seeding rule.
4. Update WRITERS.md with the writer(s) for the new store.
5. Update content-drift CI if the store affects card content rendering.
6. Update `selectors.md` if the store needs a read-side selector.

Modifying an existing store (adding a field) is per-record schema versioning per the framework above; does not require full migration spec amendment.

Removing a store is forbidden without Phase 2+ Gate 4 re-design.

---

## Change log

- **2026-04-25 — v1.0 shipped (Gate 4, Session 6).** Migration covers 2 new stores (`userRefresherConfig` singleton + `printBatches` UUID-keyed with `printedAt` index). Dynamic version target via `max(currentVersion + 1, 18)` per Q6 + EAL gate4-p3-decisions §2 precedent (collision-free with Shape Language v18 + future MPMF claims). Migration is idempotent + additive-only + zero mutations to v17 stores. Default singleton seeded at migration time with Phase 1 structural defaults (Letter / 12-up / auto / lineage-on / codex-OFF / staleness-notifications-OFF). 6 migration test cases enumerated for PRF-G5-MIG (round-trip / seed / idempotent / no-v17-mutation / index / collision-resolution). PRF-G5-DS shared test asserts `suppressedClasses` preservation across simulated v18 → v19 bump. I-WR-5 append-only verified via batch-preservation test. Future schema bumps via per-record schemaVersion; field-level changes read-time-migrated. Backup/export expansion inherits EAL precedent.

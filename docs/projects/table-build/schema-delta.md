# Table-Build — Schema Delta (Gate 4)

**Gate:** 4 (Design) — schema sub-artifact
**Date:** 2026-04-26
**Status:** Authored; pending Gate 5 implementation.

**Cross-links:**
- Gate 1 Entry — [`docs/design/audits/2026-04-26-entry-table-build.md`](../../design/audits/2026-04-26-entry-table-build.md)
- Gate 2 Blind-Spot — [`docs/design/audits/2026-04-26-blindspot-table-build.md`](../../design/audits/2026-04-26-blindspot-table-build.md) (verdict YELLOW)
- Gate 3 Research — [`gate3-research.md`](./gate3-research.md) (Q3, Q4, Q5, Q7, Q8, Q9 ratified; Q1, Q2, Q6 ratified by owner)
- Primary persona — [`docs/design/personas/situational/cold-read-chris.md`](../../design/personas/situational/cold-read-chris.md)

**Owner ratifications absorbed:**
- **Q1** — absorb picker + create-from-query + assignment-grid; survive editor edit-existing path + PlayersView database-browser/bulk-ops.
- **Q2** — adaptive single surface (no Ringmaster mode toggle).
- **Q6** — parallel `seatClothingObservations` store mirroring EAL Phase 6 B3 pattern (NOT EAL `anchorObservations` reuse).

This document specifies the IDB v21 → v22 migration, the new `seatClothingObservations` store, the per-feature stability-flag schema, the ranking algorithm, the Possible-Matches threshold, and migration test cases. No production code; this is the spec the Gate 5 implementation reads.

---

## Section 1 — Migration spec v21 → v22

Three changes, all carried by a single `migrateV22(db, transaction)` function added to `src/utils/persistence/migrations.js` between `migrateV21` (telemetry-consent) and the orchestrator block. Pattern follows v19 EAL precedent (`migrations.js:570-643`) — additive store creation interleaved with cursor-walk data migration on existing records, idempotent existence-checks, partial-failure-replay safe.

### Change 1 — `players.avatarFeatures` flat → versioned with stability flags

**Schema before (current; see `src/constants/avatarFeatureConstants.js:112-122` `DEFAULT_AVATAR_FEATURES`):**

```js
avatarFeatures: {
  skin: 'skin.medium',
  hair: 'hair.short-wavy',
  hairColor: 'color.brown',
  beard: 'beard.full',
  beardColor: 'color.brown',
  eyes: 'eyes.almond',
  eyeColor: 'eye-color.brown',
  glasses: 'glasses.clear-frame-rect',
  hat: 'hat.none',
}
```

**Schema after (v22):** every feature wraps as a *stability envelope* `{ value, stability: { value, source } }`. Hair / beard / eye are *compound features* — each sub-key (style, color, shape) carries its own envelope:

```js
avatarFeatures: {
  skin:    { value, stability },                    // simple
  hair:    { style: { value, stability },           // compound
             color: { value, stability } },
  beard:   { style: { value, stability },           // compound
             color: { value, stability } },
  eye:     { shape: { value, stability },           // compound (renamed from `eyes` for consistency)
             color: { value, stability } },
  glasses: { value, stability },                    // simple
  hat:     { value, stability },                    // simple
}
```

Where `stability = { value: 'always' | 'today' | 'unknown', source: 'inferred' | 'user' }`.

**Backwards-compat read path.** Code reading the player record must tolerate legacy flat shape *and* envelope shape. A small read-side adapter (`unwrapFeature(featureOrLegacy, defaultStability)`) lives in a new `src/utils/avatarFeatureSchema.js` (Gate 5 deliverable, not part of this spec). On legacy flat read:

```
unwrapFeature('skin.medium')
→ { value: 'skin.medium', stability: { value: 'always', source: 'inferred' } }
```

The `'always'` + `'inferred'` default is load-bearing: legacy records have no provenance, so the system marks them inferred (not user-set), which means an explicit user demote later survives re-inference per autonomy red-line #3 (Gate 2 Stage E). The migration *also* performs the wrap on disk so the read-time adapter eventually becomes a no-op for fully-migrated installs — but the adapter stays in code through v23 to handle pre-v22 backups, dev-data fixtures, and any record the migration cursor missed (defensive read).

### Change 2 — `players.ethnicity` → `players.ethnicityTags`

**Schema before:**
```js
ethnicity: 'Irish' | null
```
**Schema after:**
```js
ethnicityTags: string[]   // e.g. ['Irish'], or [] if previously null
ethnicity: 'Irish' | null  // RETAINED at v22 for one version (deprecated-but-readable)
```

Migration splits the single value into a one-element array; `null` / `undefined` / `''` → `[]`. Per Gate 1 owner question 7 + Gate 3 Q7, the curated suggestion list (~120 entries) ships separately as a constant module. **`ethnicity` field is RETAINED at v22 and dropped at v23** so any code path not yet migrated to read `ethnicityTags` continues to work for one version. v23 migration will remove the legacy field via a cursor walk that deletes `record.ethnicity`.

### Change 3 — New store: `seatClothingObservations`

Mirrors EAL `anchorObservations` store pattern (`migrations.js:589-599`) per owner-ratified Q6. Full spec in §2 below. Schema-level summary at v22: store created with `keyPath: 'id'`, three indexes (`sessionId_seatNumber` compound, `playerId`, `capturedAt`), no seed data (empty at create — populated by capture flow).

### Upgrade callback shape

The pattern follows v19 EAL upgrade verbatim:

```
const migrateV22 = (db, transaction) => {
  log('Upgrading to v22: Table-Build (avatarFeatures envelope, ethnicityTags, seatClothingObservations)');

  // ─── Schema: create seatClothingObservations store ───────────────────
  if (!db.objectStoreNames.contains(SEAT_CLOTHING_OBSERVATIONS_STORE_NAME)) {
    const store = db.createObjectStore(SEAT_CLOTHING_OBSERVATIONS_STORE_NAME, { keyPath: 'id' });
    store.createIndex('sessionId_seatNumber', ['sessionId', 'seatNumber'], { unique: false });
    store.createIndex('playerId', 'playerId', { unique: false });
    store.createIndex('capturedAt', 'capturedAt', { unique: false });
    log('seatClothingObservations object store created (v22)');
  }

  // ─── Data: walk every player record; wrap features + tag-array ────────
  if (db.objectStoreNames.contains(PLAYERS_STORE_NAME)) {
    const playersStore = transaction.objectStore(PLAYERS_STORE_NAME);
    const cursor = playersStore.openCursor();

    cursor.onsuccess = (e) => {
      const c = e.target.result;
      if (c) {
        const record = c.value;
        let changed = false;

        // Wrap avatarFeatures (idempotent — skip already-wrapped envelopes)
        if (record.avatarFeatures && !isWrapped(record.avatarFeatures)) {
          record.avatarFeatures = wrapAvatarFeatures(record.avatarFeatures);
          changed = true;
        }

        // ethnicity → ethnicityTags (additive; legacy field RETAINED)
        if (!Array.isArray(record.ethnicityTags)) {
          if (typeof record.ethnicity === 'string' && record.ethnicity.length > 0) {
            record.ethnicityTags = [record.ethnicity];
          } else {
            record.ethnicityTags = [];
          }
          changed = true;
        }

        if (changed) c.update(record);
        c.continue();
      } else {
        log('v22 migration: players migrated (avatarFeatures wrapped + ethnicityTags populated)');
      }
    };

    cursor.onerror = (e) => logError('v22 migration failed:', e.target.error);
  }
};
```

`wrapAvatarFeatures` and `isWrapped` are pure helpers colocated in `migrations.js` (per v19 precedent of helpers near the migration that uses them). Wrap helper applies the per-feature stability default table from §3.

### Rollback / partial-failure note

IDB upgrade transactions are atomic at the store-creation level: if `migrateV22` throws inside `onupgradeneeded`, the entire transaction aborts and the database remains at v21. The cursor-walk data migration is *also* atomic in the IDB sense — partial cursor updates already committed inside the transaction roll back if the transaction aborts.

The idempotent existence-check on store creation (`if (!db.objectStoreNames.contains(...))`) and the idempotent shape-check on records (`!isWrapped(record.avatarFeatures)` + `!Array.isArray(record.ethnicityTags)`) make the migration safe to retry: a fresh v22 upgrade attempt against a partially-migrated database (e.g., process killed mid-migration on a separate device that synced) will skip already-migrated records and fix the rest.

**Downgrade is not supported.** A user opening a v22 database with v21 application code will encounter wrapped envelopes that the v21 read path treats as opaque objects (e.g., `record.avatarFeatures.skin === 'skin.medium'` becomes `record.avatarFeatures.skin === { value: 'skin.medium', stability: {...} }`), causing render failures in `AvatarRenderer`. Documented; not codified.

---

## Section 2 — `seatClothingObservations` store spec

Mirrors `anchorObservationsStore.js` (`src/utils/persistence/anchorObservationsStore.js`) per owner-ratified Q6. Architectural pattern reuse, *not* shared store — clothing is recognition-aid territory, EAL anchors are exploit-engine territory.

### Record shape

```js
{
  id: 'clothing:<sessionId>:<seatNumber>:<index>',  // primary key (deterministic)
  sessionId: number,                                 // FK to sessions store
  seatNumber: number,                                // 1..9
  playerId: number | null,                           // FK to players (null until seat assigned)
  observation: {
    category: 'vest' | 'chain' | 'jersey' | 'hoodie' | 'today-hat' | 'sunglasses' | 'other',
    value: string,                                    // free-text or curated id
    capturedAt: number,                              // epoch ms
    source: 'user' | 'inferred',                     // user-typed vs. system-suggested
  },
  userId: string,                                    // multi-user isolation (per v7 pattern)
  schemaVersion: '1.0.0',
}
```

Why per-seat-per-session and not per-player: a vest is a recognition cue Chris uses *this session*. Storing it on the player record would pollute the durable identity. The promotion rule (below) is what bridges ephemeral observation → durable feature.

### Indexes

| Index name | KeyPath | Use |
|---|---|---|
| `sessionId_seatNumber` (compound) | `['sessionId', 'seatNumber']` | "Show me this seat's today-features in this session" — primary query during candidate-list rendering and seat-tooltip rendering. |
| `playerId` | `playerId` | "Show me all today-features for this player across sessions" — needed for the N=2 promotion-eligibility check (Gate 3 Q3). |
| `capturedAt` | `capturedAt` | Stale-cleanup tooling + post-session-Chris review queries (most-recent-first). |

No userId index — multi-user isolation is enforced via `playerId` joins to the players store (which already carries userId). Single-user installs dominate.

### Wrapper functions to author

Mirror `anchorObservationsStore.js` (file shipped at S12). Module path: `src/utils/persistence/seatClothingObservationsStore.js`. Functions:

| Function | Mirrors EAL | Purpose |
|---|---|---|
| `getObservation(id)` | `anchorObservationsStore.getObservation` | Single-record lookup by deterministic id. |
| `getObservationsBySessionAndSeat(sessionId, seatNumber)` | `getObservationsByHandId` (similar compound semantic) | Renders today-features chip strip on a seat. Uses `sessionId_seatNumber` compound index (`IDBKeyRange.only([sessionId, seatNumber])`). |
| `getObservationsByPlayer(playerId)` | new (no direct EAL analogue) | All clothing observations for a player across sessions. Uses `playerId` index. Powers the promotion-eligibility check. |
| `putObservation(record)` | `putObservation` (verbatim shape) | Auto-attaches deterministic `id` if missing per `anchorObservationDraftsStore.putDraft` pattern (`anchorObservationDraftsStore.js:80-114`); rejects mismatched explicit ids. |
| `deleteObservation(id)` | `deleteObservation` (verbatim) | Single-record delete. |
| `getRecentSessionsObservedForPlayer(playerId, limit = 3)` | new | Returns the *distinct sessionIds* in which `playerId` had ≥1 clothing observation, sorted desc by maxCapturedAt, capped at `limit`. Powers the N=2 promotion rule directly. |

All wrapper functions follow the EAL idiom: input validation (throw with descriptive message on bad arg), `getDB()` then transaction, Promise-wrapping `onsuccess`/`onerror`, `log()` on success, `logError()` on failure (`anchorObservationsStore.js:36-61` reference).

### Promotion-rule pseudo-code (Gate 3 Q3 + autonomy red-line #3)

```
async function checkPromotionEligibility(playerId, observation) {
  // observation.category + observation.value identify the feature being checked
  // Promotion fires when this same feature was observed in N=2 distinct prior sessions

  const allObs = await getObservationsByPlayer(playerId);
  const matching = allObs.filter(o =>
    o.observation.category === observation.category &&
    o.observation.value    === observation.value
  );

  // Count distinct sessions
  const sessionsObserved = new Set(matching.map(o => o.sessionId));
  sessionsObserved.add(observation.sessionId);  // include current

  if (sessionsObserved.size >= 2) {
    return {
      eligible: true,
      sessionCount: sessionsObserved.size,
      // CRITICAL: never silent flip. Surface a one-tap "promote to always" suggestion.
      // If the user dismisses, source: 'user' is recorded with stability: 'today'
      // and re-promotion is suppressed (autonomy red-line #3 sticky-override).
      suggestion: {
        kind: 'promote-to-always',
        feature: observation.category,
        value: observation.value,
      },
    };
  }
  return { eligible: false };
}
```

The suggestion fires at session start (when Chris opens Table-Build for a returning player) or at observation capture time, whichever comes first. The toast/inline-affordance is a Gate 5 UX artifact; the algorithmic contract is owner-ratified at Gate 3.

---

## Section 3 — Stability-flag schema

The `value` field on the inner stability envelope takes the literals `'always'` / `'today'` / `'unknown'` (Gate 3 Q9 ratified; full English wins on Nielsen H-N6). The `source` field takes `'inferred'` / `'user'`. Per autonomy red-line #3 (Gate 2 Stage E), once `source === 'user'` the system never silently re-promotes/demotes — re-inference paths check this field and skip.

### Per-feature envelope examples

```js
skin: { value: 'skin.medium', stability: { value: 'always', source: 'user' } }

hair: {
  style: { value: 'hair.short-wavy', stability: { value: 'always', source: 'user' } },
  color: { value: 'color.brown',     stability: { value: 'always', source: 'inferred' } }
}

beard: {
  style: { value: 'beard.full',      stability: { value: 'today', source: 'inferred' } },
  color: { value: 'color.brown',     stability: { value: 'today', source: 'inferred' } }
}

// Glasses default depends on sub-type — the migration consults the table below
glasses: { value: 'glasses.clear-frame-rect',   stability: { value: 'always', source: 'inferred' } }
glasses: { value: 'glasses.sunglasses-aviator', stability: { value: 'today',  source: 'inferred' } }

hat: { value: 'hat.baseball-cap', stability: { value: 'today', source: 'inferred' } }

eye: {
  shape: { value: 'eyes.almond',        stability: { value: 'always', source: 'inferred' } },
  color: { value: 'eye-color.brown',    stability: { value: 'always', source: 'inferred' } }
}
```

### Per-feature stability default table (verbatim from `cold-read-chris.md` §"Stability-flag defaults")

| Feature key | Default stability.value | Notes |
|---|---|---|
| `skin` | `'always'` | Rare override |
| `build` (future field; not in current `avatarFeatureConstants`) | `'always'` | Rare override |
| `gender` (existing `players.gender` field, default male) | `'always'` | Rare override |
| `ethnicityTags` (each tag carries the table's `'always'`) | `'always'` | Rare override |
| `hair.color` | `'always'` | Possible override (dye) |
| `hair.style` | `'always'` | Possible override (haircut) |
| `beard.style` if observed across ≥2 sessions | `'always'` | promoted |
| `beard.style` first observation | `'today'` | promotes via N=2 rule |
| `beard.color` | inherits `beard.style` policy | same envelope cadence |
| `eye.shape` | `'always'` | Rare override |
| `eye.color` | `'always'` | Rare override |
| `glasses` if id starts with `glasses.clear-frame-` | `'always'` | clear-frame default always |
| `glasses` if id starts with `glasses.sunglasses-` | `'today'` | sunglasses default today |
| `glasses` if id starts with `glasses.tinted-` or `glasses.prescription-` | `'unknown'` | unclear stability |
| `hat` (any) | `'today'` | defaults to ephemeral |
| Clothing items (vest / chain / jersey / hoodie) | `'today'` (per-seat-per-session — not on player record) | promote per N=2 rule |

The migration's `wrapAvatarFeatures` helper consults this table by feature key + value-prefix to pick the right `stability.value` per legacy field. `source` is always `'inferred'` on migration (legacy records have no user-set provenance).

---

## Section 4 — Ranking algorithm spec

`scorePlayerMatch(query, candidate, queryFeatures)` returns a number in `[0, 1]`. Used by `findPossibleMatches` (§5) to rank candidates. Stability-aware per Gate 3 Q5: only `always`-flagged features on *both* the query side and the candidate side contribute weight to the cross-session match. `today` features contribute zero — they describe the moment, not the durable identity.

### Scoring formula

```
score =
    0.35 * jaroWinkler(query.namePrefix, candidate.name)
  + 0.20 * (ethnicityOverlap(query.ethnicityTags, candidate.ethnicityTags) > 0 ? 1 : 0)
  + 0.15 * stableMatch('skin',  query, candidate)
  + 0.15 * stableMatch('build', query, candidate)
  + 0.10 * stableHairColorMatch(query, candidate)
  + 0.05 * stableEyeColorMatch(query, candidate)
```

Total weights = 1.00.

### `stableMatch` definition

```js
function stableMatch(featureKey, query, candidate) {
  const q = query.features?.[featureKey];          // envelope or undefined
  const c = candidate.avatarFeatures?.[featureKey];
  if (!q || !c) return 0;
  // Both sides must be `always` for the cross-session ranking to count this feature.
  if (q.stability?.value !== 'always') return 0;
  if (c.stability?.value !== 'always') return 0;
  return q.value === c.value ? 1 : 0;
}

function stableHairColorMatch(query, candidate) {
  // Hair is compound — color sub-key carries its own stability.
  const q = query.features?.hair?.color;
  const c = candidate.avatarFeatures?.hair?.color;
  if (!q || !c) return 0;
  if (q.stability?.value !== 'always') return 0;
  if (c.stability?.value !== 'always') return 0;
  return q.value === c.value ? 1 : 0;
}

function stableEyeColorMatch(query, candidate) {
  const q = query.features?.eye?.color;
  const c = candidate.avatarFeatures?.eye?.color;
  if (!q || !c) return 0;
  if (q.stability?.value !== 'always') return 0;
  if (c.stability?.value !== 'always') return 0;
  return q.value === c.value ? 1 : 0;
}

function ethnicityOverlap(qTags, cTags) {
  if (!Array.isArray(qTags) || !Array.isArray(cTags)) return 0;
  const cSet = new Set(cTags);
  return qTags.filter(t => cSet.has(t)).length;   // count of overlapping tags
}
```

`jaroWinkler` is the standard Winkler-extended Fellegi-Sunter string distance with prefix bonus (Gate 3 Q5 — best practice for short-name fields). Range `[0, 1]`.

### Worked example — 10 sample queries × candidate-pool fixture

**Candidate pool (4 fixtures):**

| Candidate | Name | EthnicityTags | skin (always) | build (always) | hair.color (always) | eye.color (always) | beard (today) |
|---|---|---|---|---|---|---|---|
| C1 | Mike Reilly | [Irish] | medium | heavy | brown | brown | full (today) |
| C2 | Mike Sokolov | [Polish] | light | medium | blonde | blue | none |
| C3 | John Whitfield | [Irish, English] | medium | medium | brown | hazel | (none) |
| C4 | Mike O'Connor | [Irish] | tan | heavy | red | green | none |

**Worked queries:**

| # | Query | Top-1 | Score | Notes |
|---|---|---|---|---|
| 1 | namePrefix:"Mike", ethnicity:[Irish], skin:medium(always), build:heavy(always), hair.color:brown(always) | C1 | ~0.95 | Name 0.35 + ethnicity 0.20 + skin 0.15 + build 0.15 + hair-color 0.10 = 0.95 |
| 2 | namePrefix:"Mike", ethnicity:[Polish], skin:light(always), build:medium(always), hair.color:blonde(always) | C2 | ~0.95 | All weights triggered for C2; C1/C3/C4 cap below 0.45 |
| 3 | namePrefix:"Mike", no features | C1 | ~0.31 | jaroWinkler("Mike","Mike Reilly")≈0.88 → 0.31; below 0.45 → no panel |
| 4 | namePrefix:"John", ethnicity:[Irish], skin:medium(always) | C3 | ~0.66 | Name 0.31 + ethnicity 0.20 + skin 0.15 = 0.66 |
| 5 | namePrefix:"John W", ethnicity:[Irish], skin:medium(always), beard:full(today) | C3 | ~0.69 | **Persona's named failure case.** beard contributes 0 (today); name+ethnicity+skin still rank C3 top-1 — new beard does NOT displace |
| 6 | namePrefix:"Mike", ethnicity:[Irish], skin:tan(always), build:heavy(always), hair.color:red(always) | C4 | ~0.95 | All Irish-Mikes named — disambiguation by stable features |
| 7 | namePrefix:"Mike", ethnicity:[Irish], skin:medium(always) | C1 | ~0.66 | C1 wins (Irish + medium); C4 trails at 0.51 (Irish only); C3 not "Mike" |
| 8 | namePrefix:"M", ethnicity:[Irish] | C1 | ~0.43 | Just under the panel threshold; weak Mike-prefix + Irish; no panel fires (intended — too vague) |
| 9 | (no name), ethnicity:[Irish], skin:medium(always), build:heavy(always) | C1 | ~0.50 | Wordless cold-read — features alone push above 0.45; C1 + C3 both surface (C3 ≈0.35; below floor) |
| 10 | namePrefix:"Mike", ethnicity:[Irish], skin:medium(always), build:heavy(always), hair.color:brown(today) | C1 | ~0.85 | Identical to #1 except hair-color is `today` not `always` → drops 0.10 → still top-1 well above panel |

Query #5 is the persona-named load-bearing case from `cold-read-chris.md` ("a new beard or new haircut should not displace a partial-name + stable-feature match"). The algorithm satisfies it because today-flagged features contribute zero weight regardless of value.

Score #1 in #1 is also the per-feature-coverage upper bound for the published weights. A perfect-match record never reaches 1.00 because eye-color (0.05) is rarely captured during cold-read.

---

## Section 5 — Possible-Matches threshold

**Threshold: 0.45.** Score `>= 0.45` fires the panel. Score `< 0.45` does not.

**Top 3 only**, sorted descending by score. The panel surfaces *evidence* (which weights triggered + which feature values matched) but **never the score itself** (Gate 2 Stage E autonomy finding — a confidence number is opaque inference; an evidence list is autonomy-honest).

### `findPossibleMatches` pseudo-code

```js
function findPossibleMatches(draft, allPlayers) {
  const PANEL_THRESHOLD = 0.45;
  const TOP_K = 3;

  const queryFeatures = draft.avatarFeatures;   // wrapped envelope shape
  const query = {
    namePrefix:    draft.name ?? '',
    ethnicityTags: draft.ethnicityTags ?? [],
    features:      queryFeatures,
  };

  const scored = allPlayers
    .filter(p => p.playerId !== draft.playerId)        // never match self in edit-existing
    .map(candidate => {
      const score = scorePlayerMatch(query, candidate, queryFeatures);
      return { candidate, score, evidenceList: buildEvidenceList(query, candidate) };
    })
    .filter(({ score }) => score >= PANEL_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K);

  // RETURN SHAPE: the score is computed but NOT returned to UI consumers.
  // The UI receives only { candidate, evidenceList }. The score is logged
  // for observability + tuning but never rendered.
  return scored.map(({ candidate, evidenceList }) => ({ candidate, evidenceList }));
}

function buildEvidenceList(query, candidate) {
  const evidence = [];

  if (query.namePrefix && candidate.name?.toLowerCase().startsWith(query.namePrefix.toLowerCase())) {
    evidence.push({ kind: 'name-prefix', match: query.namePrefix });
  }

  const ethOverlap = query.ethnicityTags.filter(t => (candidate.ethnicityTags ?? []).includes(t));
  if (ethOverlap.length > 0) evidence.push({ kind: 'ethnicity', tags: ethOverlap });

  ['skin', 'build'].forEach(key => {
    if (stableMatch(key, query, candidate)) {
      evidence.push({ kind: `stable-${key}`, value: query.features[key].value });
    }
  });

  if (stableHairColorMatch(query, candidate)) {
    evidence.push({ kind: 'stable-hair-color', value: query.features.hair.color.value });
  }
  if (stableEyeColorMatch(query, candidate)) {
    evidence.push({ kind: 'stable-eye-color', value: query.features.eye.color.value });
  }

  // Informational: today-features that match (rendered as "today: ..." on the panel)
  // do not contribute to score but help Chris recognize.
  ['hat', 'beard'].forEach(key => {
    const q = query.features?.[key];
    const c = candidate.avatarFeatures?.[key];
    const qVal = q?.value ?? q?.style?.value;
    const cVal = c?.value ?? c?.style?.value;
    if (qVal && cVal && qVal === cVal) {
      const todayQ = (q?.stability?.value === 'today') || (q?.style?.stability?.value === 'today');
      if (todayQ) evidence.push({ kind: `today-${key}`, value: qVal, weight: 0 });
    }
  });

  return evidence;
}
```

The Gate 2 Stage E sample render (`Possible match: Mike R. ... Stable features matched: skin (medium), build (heavy), ethnicity (Irish)`) is exactly what the UI consumes from this evidenceList shape.

---

## Section 6 — Migration test cases

The fixture-based test suite lives at `src/utils/persistence/__tests__/migrations.test.js` (existing) extended for v22. Minimum 8 cases:

1. **Empty `avatarFeatures`.** Player record with `avatarFeatures: {}` after v22 stays `{}`. `ethnicityTags` populated to `[]` if `ethnicity` is null. No throw.
2. **Legacy flat `avatarFeatures` with all 8 fields populated.** Pre-migration: `{ skin: 'skin.medium', hair: 'hair.short-wavy', hairColor: 'color.brown', beard: 'beard.full', beardColor: 'color.brown', eyes: 'eyes.almond', eyeColor: 'eye-color.brown', glasses: 'glasses.clear-frame-rect', hat: 'hat.none' }`. Post-migration: every leaf wraps to envelope with default-table-driven `stability.value` and `source: 'inferred'`. Hair, beard, eye are compound; glasses default `'always'` (clear-frame); hat default `'today'`.
3. **Legacy `ethnicity: 'Irish'` → `ethnicityTags: ['Irish']`.** Legacy field RETAINED at v22 (dropped at v23). Both readable.
4. **Legacy `ethnicity: null` → `ethnicityTags: []`.** Same for `''` and `undefined`.
5. **Mid-migration crash recovery (transaction abort).** Simulate throw inside cursor callback after 3 of 5 records updated. Assert IDB rolls back to pre-v22 state (`db.version === 21`, all 5 records still flat). Re-run migration; assert all 5 records correctly wrapped.
6. **Concurrent open of v21 and v22 versions.** Single-device but two-tab scenario: tab A on v22, tab B opens at v21. Per `database.js:126-129` `request.onblocked`, v22 upgrade blocks; document tab-close prompt as expected behavior. Test asserts no data corruption when the v22 tab proceeds after v21 tab closes.
7. **Re-migration idempotency.** Open already-v22 database (oldVersion = 22). Migration orchestrator skips `migrateV22` per `if (oldVersion < 22)` guard. Manually invoke `migrateV22` against fully-v22 data: `isWrapped` check returns true → no rewrap; `Array.isArray(record.ethnicityTags)` true → no overwrite. Database unchanged.
8. **Forward read of v22 data on legacy v21 codepath.** Build database to v22, populate one player record with envelope shape, simulate v21 codepath read of `record.avatarFeatures.skin`. Assert: returns the envelope object (not the legacy string), causing v21 render-side failure. **Document this as expected — downgrade not supported.** Test asserts the failure mode (so a future regression that "fixes" it gets caught and reviewed).

Plus 2 recommended additional cases:

9. **Partial legacy record (missing some `avatarFeatures` keys).** Pre-migration: `{ skin: 'skin.medium' }` (only one key). Post: `{ skin: { value: 'skin.medium', stability: {...} } }`; other keys absent (not synthesized). The render-side adapter (Gate 5) handles missing keys; migration does not invent them.
10. **Glasses default-table coverage.** Three records with `glasses: 'glasses.clear-frame-rect'`, `'glasses.sunglasses-aviator'`, `'glasses.tinted-round'`. Post-migration: stability.value `'always'`, `'today'`, `'unknown'` respectively (per §3 default table). Confirms the `wrapAvatarFeatures` helper consults the value-prefix.

---

## Section 7 — Index dependencies + write performance

For each new index on `seatClothingObservations`:

| Index | Estimated write cost | Read pattern |
|---|---|---|
| `sessionId_seatNumber` (compound) | Negligible. Composite index entry per record; single-record put is `O(log n)` insertion across two B-trees. With realistic load — 9 seats × ~5 today-features per seat × 1 session per day = ~45 records/day per active user — total store size after 1 year is ~16k records. IDB handles this trivially. | **Hot read path.** Queried during candidate-list rendering for *this* session's seat (e.g., "show vest chip on seat 3 in active session"). Must be sub-millisecond. The compound index makes this an `IDBKeyRange.only([sessionId, seat])` exact lookup → `O(log n)`. |
| `playerId` | Negligible. Single B-tree entry per record; same insertion cost. | **Warm read path.** Powers `getObservationsByPlayer(playerId)` for the N=2 promotion check. Fires once per player at session start (returning-player detection) and once per save during Table-Build flow. Acceptable at hundreds of ms even in pathological cases (the promotion check is not in the typing-loop). |
| `capturedAt` | Negligible. Single B-tree entry per record. | **Cold read path.** Stale-cleanup tooling and post-session-Chris review queries. Sorted retrieval by index is built-in to IDB cursor traversal. |

Total write amplification per `putObservation`: 1 record + 3 index entries = ~4 B-tree mutations per record, all within the same IDB transaction. EAL `anchorObservations` carries 5 indexes (`migrations.js:592-598`) and exhibits no measurable write-cost concern in production tests; clothing observations are strictly cheaper.

**Read budget under Cold-Read Chris's typing loop:** the candidate-list ranking itself does not query `seatClothingObservations` — ranking uses `players` records (per §4). Clothing observations are rendered as decorative chips on already-resolved seats (separate UI subtree) and on the post-save promotion-suggestion path. Neither is a typing-loop dependency.

---

## Ratified decisions on spec-authoring open questions

Owner authorized 2026-04-26 with guidance: "*optimize for long-term health of the program. The user needs to be able to use it with minimal info, but if something significantly enhances his ability to be sure he's finding and correcting the right data, they'd be willing to include more detail.*" Decision criterion: **does this help confirm "is this the same person who is in the app?"** — if yes and consistency-preserving, include; if not, defer.

1. **`build` field — INTO `avatarFeatures` envelope at v22.** Rationale: build is a primary dedupe signal (0.15 weight in §4 ranking formula) and one of the most stable cross-session features (heavy/medium/slim doesn't change month-to-month for adults). Putting it inside the envelope means stability flags work uniformly across **every dedupe-relevant feature** — long-term health = one schema pattern, not two. Migration: existing top-level `players.build` string field migrates to `avatarFeatures.build = { value: <legacy>, stability: { value: 'always', source: 'inferred' } }`. Top-level field deprecated-but-readable at v22, dropped at v23.

2. **`gender` envelope — DEFER to v23.** Rationale: gender is **not** a ranking input (not in §4 formula) and the envelope adds detail-collection-cost (UI now has option to show gender stability override) without identification-benefit. Per owner guidance: don't include detail that doesn't significantly enhance dedupe confidence. v22 keeps `players.gender` as a flat string. If v23 introduces gender as a ranking signal (e.g., to support stronger early-narrowing on visual cue), the envelope wraps then.

3. **`ethnicityTags` per-tag stability — DEFER (keep `string[]`).** Rationale: §4 treats ethnicity match as binary (`ethnicity_tag_overlap > 0 ? 1 : 0`, weight 0.20), so per-tag stability does not currently improve dedupe confidence. Per "minimal info" first-principle: simpler schema preserves easier entry. If a user-confirmed-vs-guessed tag distinction (e.g., "Irish (told me)" vs "Polish (my guess from accent)") becomes load-bearing later for §4, lift to `Array<{ value, stability }>` at that point.

4. **Compound feature key rename `eyes` → `eye` — DO IT at v22.** Rationale: long-term consistency with hair/beard singular pattern (compound `{ style, color }` and `{ shape, color }` read naturally as singular). Cheap one-time rename; no UX impact. Migration must alias both shapes — test case: legacy `record.avatarFeatures.eyes = 'eyes.almond'` + `record.avatarFeatures.eyeColor = 'eye-color.brown'` → `record.avatarFeatures.eye = { shape: { value: 'eyes.almond', stability: {...} }, color: { value: 'eye-color.brown', stability: {...} } }`. Document the rename in the v22 migration log.

---

## Change log

- 2026-04-26 — Created. Gate 4 schema sub-artifact authored after Gate 1 (RED) + Gate 2 (YELLOW) + Gate 3 (ratified). Specifies v21 → v22 migration (avatarFeatures envelope, ethnicityTags array, seatClothingObservations store), per-feature stability default table, ranking algorithm + 10 worked-example queries, Possible-Matches threshold (0.45), 10 migration test cases, index write-cost analysis.
- 2026-04-26 — Spec-authoring open questions Q1–Q4 ratified by owner: Q1 build INTO envelope at v22; Q2 gender envelope DEFERRED to v23; Q3 ethnicityTags per-tag stability DEFERRED (keep `string[]`); Q4 `eyes` → `eye` rename DONE at v22. Decisions optimized for long-term schema consistency + dedupe-confidence enhancement. Schema is Gate-5-ready.

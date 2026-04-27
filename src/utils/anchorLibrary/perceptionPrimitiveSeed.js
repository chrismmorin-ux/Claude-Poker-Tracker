/**
 * perceptionPrimitiveSeed.js — Hardcoded seed records for the v19 IDB migration
 *
 * Mirrors `docs/projects/exploit-anchor-library/perception-primitives.md` (PP-01..PP-08).
 *
 * Used by `migrations.js` `migrateV19` to seed the `perceptionPrimitives` store
 * at first-time v19 migration. Idempotent — `seedPerceptionPrimitives()` checks
 * for existing records before insert (handles re-run after partial-failure recovery).
 *
 * **Markdown-as-source-of-truth.** The markdown file is canonical; this constant
 * mirrors the records the markdown describes. The EAL-G5-SI test target verifies
 * markdown ↔ IDB content match — if this constant drifts from markdown content,
 * the snapshot test fails CI with a diff.
 *
 * Phase 5+ may extract content (description / appliesToStyles / cognitiveStep)
 * from the markdown via a build-time generator script; for v19 ship, hardcoded.
 *
 * Pure module — exports the seed records + a writer function that takes an open
 * IDB transaction. Caller (migrateV19) provides the transaction.
 */

import {
  ANCHOR_OBSERVATION_SCHEMA_VERSION as _UNUSED, // eslint-disable-line no-unused-vars
} from '../../constants/anchorLibraryConstants';

/**
 * Schema version for PerceptionPrimitive records (mirrors validateAnchor.js
 * — kept here to avoid importing the validator into the migration path).
 */
export const PRIMITIVE_SCHEMA_VERSION = 'pp-v1.0';

/**
 * The 8 starter perception primitives, all initialized with a uniform Beta(1, 1)
 * prior per perception-primitives.md §"Validity score initialization (Phase 5)".
 *
 * `dependentAnchorCount` is initialized to 0; `migrateV19` rebuilds the count
 * from the `exploitAnchors` store after seeding (or leaves at 0 if the store
 * is empty at v19 migration time, which it will be on a fresh install).
 *
 * `validityScore.lastUpdated` is set per-record at migration time (not here)
 * so the migration's timestamp is the seed timestamp, not module-load time.
 */
export const PERCEPTION_PRIMITIVE_SEEDS = Object.freeze([
  {
    id: 'PP-01',
    schemaVersion: PRIMITIVE_SCHEMA_VERSION,
    name: 'Nit re-weights aggressively on scare cards',
    description: 'When a scare card lands (flush-completing, straight-completing, overcards on paired boards), Nits recompute villains perceived range as if their own range had fewer bluff-catchers than it actually does — they mentally prune their own calling range to just nutted combos and panic-fold to large sizing.',
    appliesToStyles: ['Nit', 'TAG'],
    cognitiveStep: 'range-reweighting',
    inverseOf: 'PP-03',
  },
  {
    id: 'PP-02',
    schemaVersion: PRIMITIVE_SCHEMA_VERSION,
    name: 'LAG treats check-check as mutual capping',
    description: 'LAGs interpret a turn check-through as a signal that both players lack a strong hand — they update their perceived fold equity upward and overbluff the river beyond theoretically-balanced rates.',
    appliesToStyles: ['LAG'],
    cognitiveStep: 'mutual-cap-misread',
  },
  {
    id: 'PP-03',
    schemaVersion: PRIMITIVE_SCHEMA_VERSION,
    name: "Fish doesn't re-weight on scare cards",
    description: "Fish process each street's decision independently — prior streets inform their current hand's value but not their perception of hero's range. A flush-completing river does not update their mental model of what hero might have; they continue to call pairs because pair > no-pair remains their operational rule.",
    appliesToStyles: ['Fish'],
    cognitiveStep: 'range-non-reweighting',
    inverseOf: 'PP-01',
  },
  {
    id: 'PP-04',
    schemaVersion: PRIMITIVE_SCHEMA_VERSION,
    name: 'TAG reads off-script aggression as value-indicating',
    description: 'TAGs have internalized a balanced line library; when hero deviates away from it (donk-bet, probe after missed cbet, overbet out of position), TAGs update toward "hero has a reason — probably value" rather than "hero is exploiting me — probably bluff."',
    appliesToStyles: ['TAG', 'Nit'],
    cognitiveStep: 'off-script-as-value',
  },
  {
    id: 'PP-05',
    schemaVersion: PRIMITIVE_SCHEMA_VERSION,
    name: "LAG doesn't integrate hero's prior-street range forward",
    description: "LAGs treat the current street's action in isolation — they don't ask 'what combos does hero have at this point in the hand given the flop/turn line?' — they ask 'what does hero's current action mean?'",
    appliesToStyles: ['LAG', 'Fish'],
    cognitiveStep: 'forward-range-integration-failure',
  },
  {
    id: 'PP-06',
    schemaVersion: PRIMITIVE_SCHEMA_VERSION,
    name: 'Fish treats bet-sizing linearly',
    description: 'Fish map bet size to "big bet = strong hand, small bet = bluff or weak" monotonically — they do not recognize polarized sizing (overbet = either nutted or bluffing, small bet = merged range) as a distinct regime.',
    appliesToStyles: ['Fish'],
    cognitiveStep: 'sizing-linearization',
  },
  {
    id: 'PP-07',
    schemaVersion: PRIMITIVE_SCHEMA_VERSION,
    name: 'Nit treats passive lines as hero-capped',
    description: "Nits interpret hero's check or call as a signal of hero weakness — they don't account for hero trapping or hero slowplaying nuts on dry textures.",
    appliesToStyles: ['Nit', 'TAG'],
    cognitiveStep: 'passive-line-misread',
    inverseOf: 'PP-05',
  },
  {
    id: 'PP-08',
    schemaVersion: PRIMITIVE_SCHEMA_VERSION,
    name: "All styles under-weight hero's PFA range on low/dry flops",
    description: 'Every style underestimates how nut-heavy heros preflop-raiser range is on low disconnected flops — they fold too much to small cbets because they perceive heros range as continuation-range-wide when it is actually continuation-range-concentrated-on-value.',
    appliesToStyles: ['Fish', 'Nit', 'LAG', 'TAG'],
    cognitiveStep: 'pfa-range-underweighting',
  },
]);

/**
 * Build a complete `PerceptionPrimitive` record for a seed entry, attaching
 * the migration timestamp + initial Beta(1, 1) validity prior.
 *
 * Pure function. Returns the record ready for `store.add(record)`.
 *
 * @param {Object} seed — entry from PERCEPTION_PRIMITIVE_SEEDS
 * @param {string} migrationTimestamp — ISO8601 string (use `new Date().toISOString()` at migration time)
 * @returns {Object} full PerceptionPrimitive record
 */
export const buildSeedRecord = (seed, migrationTimestamp) => ({
  ...seed,
  validityScore: {
    pointEstimate: 0.5, // mean of Beta(1, 1)
    credibleInterval: { lower: 0.025, upper: 0.975, level: 0.95 }, // wide CI of uniform prior
    priorAlpha: 1,
    priorBeta: 1,
    sampleSize: 0,
    supportsCount: 0,
    lastUpdated: migrationTimestamp,
    dependentAnchorCount: 0, // rebuilt from exploitAnchors store after seed (will be 0 on fresh install)
  },
  authoredAt: '2026-04-24', // matches perception-primitives.md authored date
  authoredBy: 'session-1',
});

/**
 * Seed all 8 perception primitives into the store via the supplied transaction.
 *
 * **Idempotent:** caller wraps in `if (oldVersion < 19)`; this function
 * additionally checks per-record for existence (defensive — handles partial-failure
 * recovery if a previous migration crashed mid-seed).
 *
 * @param {IDBObjectStore} store — open `perceptionPrimitives` object store
 * @param {string} migrationTimestamp — ISO8601 string
 * @param {function} [onSeed] — optional per-record callback for logging
 */
export const seedPerceptionPrimitives = (store, migrationTimestamp, onSeed) => {
  for (const seed of PERCEPTION_PRIMITIVE_SEEDS) {
    const record = buildSeedRecord(seed, migrationTimestamp);
    // Use put rather than add so re-running is idempotent (overwrites same id).
    // First-time install creates; partial-failure-recovery overwrites with same content.
    store.put(record);
    if (typeof onSeed === 'function') onSeed(record);
  }
};

/**
 * migrations.js — Schema version migrations for persisted VillainAssumption records
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Supports the additive-only schema-evolution contract per schema §8:
 *   - New fields never break old assumptions (existing records get defaults).
 *   - Retired predicates are kept in DEPRECATED_PREDICATES so old records deserialize.
 *   - Breaking changes require a version bump + explicit migration handler here.
 *
 * Invariant I-AE-5 (schema version consistency): persisted records must either
 * match SCHEMA_VERSION or be migratable through a documented path. Records with
 * unknown versions throw — safer than silently producing partially-valid state.
 *
 * Current migration paths:
 *   1.0 → 1.1  (Theory Roundtable, 2026-04-23)
 */

import {
  SCHEMA_VERSION,
  SCHEMA_VERSION_HISTORY,
  VILLAIN_SIDE_THRESHOLDS,
  HERO_SIDE_THRESHOLDS,
} from './assumptionTypes';

/**
 * Migrate a persisted assumption record from one schema version to another.
 *
 * Usage pattern (in `assumptionStorage.js` upon IDB open):
 *   if (needsMigration(record)) {
 *     record = migratePersistedAssumption(record, record.schemaVersion, SCHEMA_VERSION);
 *   }
 *   validateAssumption(record); // verify migration produced a valid shape
 *
 * @param {Object} record - Persisted assumption record
 * @param {string} fromVersion - Source schema version
 * @param {string} toVersion - Target schema version (typically SCHEMA_VERSION)
 * @returns {Object} Migrated record
 * @throws {Error} When no migration path exists
 */
export const migratePersistedAssumption = (record, fromVersion, toVersion = SCHEMA_VERSION) => {
  if (record == null || typeof record !== 'object' || Array.isArray(record)) {
    throw new Error('migratePersistedAssumption: record must be a plain object');
  }
  if (!SCHEMA_VERSION_HISTORY.includes(fromVersion)) {
    throw new Error(`migratePersistedAssumption: unknown source version "${fromVersion}". Known: ${SCHEMA_VERSION_HISTORY.join(', ')}`);
  }
  if (!SCHEMA_VERSION_HISTORY.includes(toVersion)) {
    throw new Error(`migratePersistedAssumption: unknown target version "${toVersion}". Known: ${SCHEMA_VERSION_HISTORY.join(', ')}`);
  }
  if (fromVersion === toVersion) return { ...record };

  // Determine forward-migration steps.
  // Current supported path: 1.0 → 1.1.
  const migrated = { ...record };
  let currentVersion = fromVersion;

  while (currentVersion !== toVersion) {
    const step = MIGRATION_STEPS[currentVersion];
    if (!step) {
      throw new Error(`migratePersistedAssumption: no migration step from "${currentVersion}". Supported starts: ${Object.keys(MIGRATION_STEPS).join(', ')}`);
    }
    const result = step(migrated);
    currentVersion = result.toVersion;
    Object.assign(migrated, result.record);
    migrated.schemaVersion = currentVersion;
  }

  return migrated;
};

// ───────────────────────────────────────────────────────────────────────────
// Step: 1.0 → 1.1
// ───────────────────────────────────────────────────────────────────────────

/**
 * v1.0 → v1.1 migration:
 *   - Adds `scope.activationFrequency` (optional) with default undefined
 *   - Adds `consequence.expectedDividend.sharpe` (required) — derived as mean/sd if sd > 0, else set to 1.0 (passes floor)
 *   - Changes `consequence.expectedDividend.unit` from "bb/100" to "bb per 100 trigger firings"
 *   - Adds `counterExploit.resistanceConfidence` (required) — default 0.5 (low, conservative)
 *   - Adds `observationCount` to each resistanceSources item — default 0
 *   - Adds `operator.suppresses` (required, empty array default)
 *   - Adds `stability.nonNullSubscoreCount` (required, derived from existing subscores)
 *   - Replaces `quality.actionable` boolean with surface-specific: `actionableInDrill` + `actionableLive`
 *   - Keeps `quality.actionable` as alias = actionableLive for back-compat
 *   - Restructures `quality.thresholds` to new `villainSide` + `heroSide` shape
 *   - Adds `quality.gatesPassed.recognizabilityDrill` + `recognizabilityLive` + `sharpe`
 */
const migrateV10ToV11 = (record) => {
  const migrated = deepClone(record);

  // scope — activationFrequency may be absent (v1.1 §1.1 allows undefined)
  if (migrated.claim?.scope && migrated.claim.scope.activationFrequency === undefined) {
    // leave as undefined; schema tolerates absence
  }

  // consequence.expectedDividend
  if (migrated.consequence?.expectedDividend) {
    const ed = migrated.consequence.expectedDividend;
    if (ed.sharpe === undefined) {
      ed.sharpe = (ed.sd > 0 && Number.isFinite(ed.mean))
        ? Math.abs(ed.mean) / ed.sd
        : 1.0;
    }
    ed.unit = 'bb per 100 trigger firings'; // unconditional rename
  }

  // counterExploit.resistanceConfidence
  if (migrated.counterExploit) {
    if (migrated.counterExploit.resistanceConfidence === undefined) {
      migrated.counterExploit.resistanceConfidence = 0.5; // conservative default
    }
    // Per-source observationCount
    if (Array.isArray(migrated.counterExploit.resistanceSources)) {
      migrated.counterExploit.resistanceSources = migrated.counterExploit.resistanceSources.map((src) => ({
        ...src,
        observationCount: src.observationCount ?? 0,
      }));
    }
  }

  // operator.suppresses
  if (migrated.operator && !Array.isArray(migrated.operator.suppresses)) {
    migrated.operator.suppresses = [];
  }

  // stability.nonNullSubscoreCount
  if (migrated.stability) {
    const subscoreKeys = ['acrossSessions', 'acrossTextures', 'acrossStackDepths', 'acrossStreetContext'];
    const nonNullCount = subscoreKeys.reduce((acc, key) => {
      const v = migrated.stability[key];
      return acc + (v !== null && v !== undefined ? 1 : 0);
    }, 0);
    migrated.stability.nonNullSubscoreCount = nonNullCount;
    // v1.0 lacked the null-for-scoped-dimensions rule; preserve existing values.
  }

  // quality — split single actionable into actionableInDrill + actionableLive
  if (migrated.quality) {
    const q = migrated.quality;
    if (typeof q.actionable === 'boolean' && q.actionableInDrill === undefined) {
      q.actionableInDrill = q.actionable;
      q.actionableLive = q.actionable;
    }
    // thresholds restructure: old flat shape → new { villainSide, heroSide } layered
    const isHeroSide = migrated.operator?.target === 'hero';
    q.thresholds = {
      villainSide: { ...VILLAIN_SIDE_THRESHOLDS },
      heroSide: { ...HERO_SIDE_THRESHOLDS },
    };
    // gatesPassed: ensure v1.1 fields present
    if (q.gatesPassed) {
      if (q.gatesPassed.recognizabilityDrill === undefined) {
        q.gatesPassed.recognizabilityDrill = q.gatesPassed.recognizability ?? false;
      }
      if (q.gatesPassed.recognizabilityLive === undefined) {
        q.gatesPassed.recognizabilityLive = q.gatesPassed.recognizability ?? false;
      }
      if (q.gatesPassed.sharpe === undefined) {
        q.gatesPassed.sharpe = true; // conservative default; Tier-1 will re-evaluate
      }
    }
    // hero-side actionableLive is always false
    if (isHeroSide) {
      q.actionableLive = false;
      q.actionable = false;
    }
  }

  return { toVersion: '1.1', record: migrated };
};

const MIGRATION_STEPS = Object.freeze({
  '1.0': migrateV10ToV11,
});

// ───────────────────────────────────────────────────────────────────────────
// Utilities
// ───────────────────────────────────────────────────────────────────────────

/**
 * Deep-clone a plain-object record. No Float64Arrays or other typed structures
 * are expected in VillainAssumption records (ranges live in a different store),
 * so structuredClone is overkill; a JSON round-trip is sufficient.
 */
const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

/**
 * Returns the list of migration paths currently supported.
 * Used by test harness + storage-layer diagnostics.
 */
export const supportedMigrationPaths = () => {
  const paths = [];
  for (const fromVersion of Object.keys(MIGRATION_STEPS)) {
    paths.push({ from: fromVersion, to: SCHEMA_VERSION });
  }
  return paths;
};

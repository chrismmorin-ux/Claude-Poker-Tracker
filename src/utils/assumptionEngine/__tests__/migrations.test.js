import { describe, it, expect } from 'vitest';
import {
  migratePersistedAssumption,
  supportedMigrationPaths,
} from '../migrations';
import { SCHEMA_VERSION } from '../assumptionTypes';
import { validateAssumption } from '../validator';
import { legacyV10Record } from './fixtures';

describe('migratePersistedAssumption — v1.0 → v1.1', () => {
  it('bumps schemaVersion to 1.1', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    expect(migrated.schemaVersion).toBe('1.1');
  });

  it('preserves unchanged fields (id, villainId, status)', () => {
    const original = legacyV10Record();
    const migrated = migratePersistedAssumption(original, '1.0', '1.1');
    expect(migrated.id).toBe(original.id);
    expect(migrated.villainId).toBe(original.villainId);
    expect(migrated.status).toBe(original.status);
  });

  it('adds sharpe to consequence.expectedDividend', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    expect(migrated.consequence.expectedDividend.sharpe).toBeDefined();
    expect(typeof migrated.consequence.expectedDividend.sharpe).toBe('number');
  });

  it('computes sharpe from mean/sd when sd > 0', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    const { mean, sd, sharpe } = migrated.consequence.expectedDividend;
    expect(sharpe).toBeCloseTo(Math.abs(mean) / sd, 4);
  });

  it('renames consequence.expectedDividend.unit to v1.1 unit', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    expect(migrated.consequence.expectedDividend.unit).toBe('bb per 100 trigger firings');
  });

  it('adds counterExploit.resistanceConfidence with conservative default', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    expect(migrated.counterExploit.resistanceConfidence).toBe(0.5);
  });

  it('adds observationCount to each resistanceSources entry', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    for (const src of migrated.counterExploit.resistanceSources) {
      expect(src.observationCount).toBeDefined();
      expect(typeof src.observationCount).toBe('number');
    }
  });

  it('adds operator.suppresses as empty array', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    expect(Array.isArray(migrated.operator.suppresses)).toBe(true);
    expect(migrated.operator.suppresses).toHaveLength(0);
  });

  it('adds stability.nonNullSubscoreCount (derived from existing subscores)', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    expect(migrated.stability.nonNullSubscoreCount).toBe(4); // all 4 subscores present in fixture
  });

  it('splits quality.actionable into actionableInDrill + actionableLive', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    expect(typeof migrated.quality.actionableInDrill).toBe('boolean');
    expect(typeof migrated.quality.actionableLive).toBe('boolean');
    expect(typeof migrated.quality.actionable).toBe('boolean');
  });

  it('restructures quality.thresholds into villainSide + heroSide', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    expect(migrated.quality.thresholds.villainSide).toBeDefined();
    expect(migrated.quality.thresholds.heroSide).toBeDefined();
    expect(migrated.quality.thresholds.villainSide.confidence).toBe(0.80);
    expect(migrated.quality.thresholds.heroSide.confidence).toBe(0.70);
  });

  it('adds v1.1 gatesPassed fields', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    expect(migrated.quality.gatesPassed.recognizabilityDrill).toBeDefined();
    expect(migrated.quality.gatesPassed.recognizabilityLive).toBeDefined();
    expect(migrated.quality.gatesPassed.sharpe).toBeDefined();
  });

  it('hero-side records have actionableLive forced to false', () => {
    const record = legacyV10Record();
    record.operator.target = 'hero';
    record.villainId = '_hero';
    const migrated = migratePersistedAssumption(record, '1.0', '1.1');
    expect(migrated.quality.actionableLive).toBe(false);
    expect(migrated.quality.actionable).toBe(false);
  });

  it('does not mutate the input record', () => {
    const original = legacyV10Record();
    const originalJson = JSON.stringify(original);
    migratePersistedAssumption(original, '1.0', '1.1');
    expect(JSON.stringify(original)).toBe(originalJson);
  });

  it('produces a record that validates against v1.1 schema', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0', '1.1');
    const result = validateAssumption(migrated);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.log('Migration-validation errors:', result.errors);
    }
  });
});

describe('migratePersistedAssumption — edge cases', () => {
  it('no-op when fromVersion equals toVersion', () => {
    const record = { schemaVersion: '1.1', id: 'x' };
    const migrated = migratePersistedAssumption(record, '1.1', '1.1');
    expect(migrated).toEqual(record);
    expect(migrated).not.toBe(record); // shallow-cloned
  });

  it('throws on unknown fromVersion', () => {
    expect(() => migratePersistedAssumption({}, '0.5', '1.1')).toThrow(/unknown source version/);
  });

  it('throws on unknown toVersion', () => {
    expect(() => migratePersistedAssumption({}, '1.0', '2.0')).toThrow(/unknown target version/);
  });

  it('throws when record is not a plain object', () => {
    expect(() => migratePersistedAssumption(null, '1.0', '1.1')).toThrow();
    expect(() => migratePersistedAssumption('str', '1.0', '1.1')).toThrow();
    expect(() => migratePersistedAssumption([], '1.0', '1.1')).toThrow();
  });

  it('default toVersion is SCHEMA_VERSION', () => {
    const migrated = migratePersistedAssumption(legacyV10Record(), '1.0');
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe('supportedMigrationPaths', () => {
  it('lists the 1.0 → current path', () => {
    const paths = supportedMigrationPaths();
    expect(paths).toContainEqual({ from: '1.0', to: SCHEMA_VERSION });
  });
});

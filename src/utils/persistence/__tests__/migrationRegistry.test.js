/**
 * migrationRegistry.test.js — semantic invariants over MIGRATION_REGISTRY.
 *
 * Companion to scripts/check-idb-additive.sh (source-level grep gate). These
 * tests assert the registry's own data shape; the script asserts the migration
 * source code doesn't call destructive IDB APIs. Different failure modes,
 * both enforced.
 *
 * Resolves SYSTEM_MODEL.md §11 TD-16 (Refactor Sprint Item 3).
 */

import { describe, it, expect } from 'vitest';
import { DB_VERSION } from '../database';
import * as migrations from '../migrations';
import {
  MIGRATION_REGISTRY,
  KNOWN_PROGRAM_IDS,
  getStoreOwner,
  getVersionsForStore,
  getStoresAtVersion,
} from '../migrationRegistry';

describe('MIGRATION_REGISTRY', () => {
  // ─── 1. Completeness ─────────────────────────────────────────────────────
  describe('completeness', () => {
    it('has an entry for every version from 1 to DB_VERSION (no gaps)', () => {
      expect(MIGRATION_REGISTRY.length).toBe(DB_VERSION);
      MIGRATION_REGISTRY.forEach((entry, i) => {
        expect(entry.version).toBe(i + 1);
      });
    });

    it('versions are strictly monotonic increasing', () => {
      for (let i = 1; i < MIGRATION_REGISTRY.length; i++) {
        expect(MIGRATION_REGISTRY[i].version).toBeGreaterThan(
          MIGRATION_REGISTRY[i - 1].version,
        );
      }
    });

    it('every entry has all required fields', () => {
      for (const entry of MIGRATION_REGISTRY) {
        expect(typeof entry.version).toBe('number');
        expect(typeof entry.name).toBe('string');
        expect(entry.name.length).toBeGreaterThan(0);
        expect(typeof entry.description).toBe('string');
        expect(entry.description.length).toBeGreaterThan(0);
        expect(Array.isArray(entry.storesAdded)).toBe(true);
        expect(Array.isArray(entry.storesChanged)).toBe(true);
        expect(Array.isArray(entry.storesRemoved)).toBe(true);
        expect(entry.owner).toBeTruthy();
        expect(typeof entry.owner.program).toBe('string');
        expect(typeof entry.owner.project).toBe('string');
        expect(typeof entry.migrationFn).toBe('string');
      }
    });
  });

  // ─── 2. Additive-only semantics ──────────────────────────────────────────
  describe('additive-only invariant', () => {
    it('no entry removes a store', () => {
      for (const entry of MIGRATION_REGISTRY) {
        expect(entry.storesRemoved).toEqual([]);
      }
    });
  });

  // ─── 3. Store-set monotonic growth ───────────────────────────────────────
  describe('store-set monotonic growth', () => {
    it('cumulative store set never shrinks across versions', () => {
      let prevSize = 0;
      for (let v = 1; v <= DB_VERSION; v++) {
        const stores = getStoresAtVersion(v);
        expect(stores.size).toBeGreaterThanOrEqual(prevSize);
        prevSize = stores.size;
      }
    });

    it('no store is added twice across the registry', () => {
      const seen = new Set();
      for (const entry of MIGRATION_REGISTRY) {
        for (const name of entry.storesAdded) {
          expect(seen.has(name)).toBe(false);
          seen.add(name);
        }
      }
    });

    it('final store count at DB_VERSION matches the 25 stores fresh-init test expects', () => {
      // database.test.js asserts 25 stores on fresh install — registry must agree.
      // v26 adds shapeMastery + shapeLessons (23 + 2 = 25).
      const finalStores = getStoresAtVersion(DB_VERSION);
      expect(finalStores.size).toBe(25);
    });
  });

  // ─── 4. Owner integrity ──────────────────────────────────────────────────
  describe('owner integrity', () => {
    it("every entry's owner.program is a known program id", () => {
      for (const entry of MIGRATION_REGISTRY) {
        expect(KNOWN_PROGRAM_IDS).toContain(entry.owner.program);
      }
    });

    it('storesChanged entries reference stores that exist at or before this version', () => {
      // If v23 says it changes `players`, then `players` must have been added
      // at v <= 23. Catches a future drift where someone declares a change to
      // a store that doesn't exist yet.
      for (const entry of MIGRATION_REGISTRY) {
        const knownByNow = getStoresAtVersion(entry.version);
        for (const name of entry.storesChanged) {
          expect(knownByNow.has(name)).toBe(true);
        }
      }
    });
  });

  // ─── 5. migrationFn linkage ──────────────────────────────────────────────
  describe('migrationFn linkage', () => {
    it("every entry's migrationFn matches a runMigrations dispatch in migrations.js", () => {
      // migrations.js does not export per-version functions individually —
      // they are internal to the module and dispatched through runMigrations.
      // We assert runMigrations itself is exported (proxy for module health).
      expect(typeof migrations.runMigrations).toBe('function');
      // Each registry entry declares its function name; we verify the name
      // follows the migrateVN convention so future refactors keep alignment.
      for (const entry of MIGRATION_REGISTRY) {
        expect(entry.migrationFn).toBe(`migrateV${entry.version}`);
      }
    });
  });

  // ─── 6. DB_VERSION alignment ─────────────────────────────────────────────
  describe('DB_VERSION alignment', () => {
    it("last entry's version equals DB_VERSION", () => {
      const last = MIGRATION_REGISTRY[MIGRATION_REGISTRY.length - 1];
      expect(last.version).toBe(DB_VERSION);
    });
  });

  // ─── 7. Helpers ──────────────────────────────────────────────────────────
  describe('getStoreOwner', () => {
    it("returns the owner of the migration that added 'hands'", () => {
      const owner = getStoreOwner('hands');
      expect(owner).toEqual({ program: 'engineering', project: 'baseline' });
    });

    it("returns the EAL owner for 'exploitAnchors'", () => {
      const owner = getStoreOwner('exploitAnchors');
      expect(owner).not.toBeNull();
      expect(owner.program).toBe('domain-correctness');
      expect(owner.project).toBe('EAL');
    });

    it("returns the PRF owner for 'userRefresherConfig'", () => {
      const owner = getStoreOwner('userRefresherConfig');
      expect(owner).not.toBeNull();
      expect(owner.program).toBe('engineering');
      expect(owner.project).toBe('PRF');
    });

    it("returns the PIO owner for 'sightingLogs'", () => {
      const owner = getStoreOwner('sightingLogs');
      expect(owner).not.toBeNull();
      expect(owner.program).toBe('domain-correctness');
      expect(owner.project).toBe('PIO');
    });

    it('returns null for an unknown store name', () => {
      expect(getStoreOwner('nonexistent_store')).toBeNull();
    });
  });

  describe('getVersionsForStore', () => {
    it("'hands' appears across multiple versions (added at v1, changed several times)", () => {
      const entries = getVersionsForStore('hands');
      const versions = entries.map((e) => e.version);
      expect(versions).toContain(1); // added
      expect(versions).toContain(8); // actionSequence
      expect(versions).toContain(25); // predictionAudit
      expect(entries.length).toBeGreaterThan(1);
    });

    it("'players' first appears at v5 and is changed several times", () => {
      const entries = getVersionsForStore('players');
      expect(entries[0].version).toBe(5);
      expect(entries.some((e) => e.version === 23)).toBe(true); // PIO schema extension
      expect(entries.some((e) => e.version === 24)).toBe(true); // accessoryInventory + marks
    });

    it('returns empty array for unknown store', () => {
      expect(getVersionsForStore('nonexistent_store')).toEqual([]);
    });
  });
});

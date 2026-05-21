/**
 * migrationGuard.js — assertStoreRegistered + test escape hatch.
 *
 * Per ADR-DS-2 (`.claude/decisions/2026-05-14-idb-store-factory-migration-binding.md`):
 * every IDB store created via `decisionSystems/idbStore/` factories MUST be
 * registered in `migrationRegistry.js`. The factories call
 * `assertStoreRegistered(storeName)` at construction time; an unregistered
 * store throws synchronously with an error message pointing the author at
 * the registry file.
 *
 * Why: today a store can exist in IDB without a registry entry. The
 * registry is governance with no teeth. Binding the factory closes that
 * drift surface — friction goes to authoring time instead of first-write-
 * in-production time.
 *
 * Test escape hatch: tests that want to exercise the factory shape without
 * mutating `migrationRegistry.js` can flip `__testing__.bypassMigrationCheck`
 * to `true` for the duration of the test, then back to `false` in `afterEach`.
 * Production code MUST NOT reference `__testing__` — CI grep enforces.
 *
 * Pure module — no IO.
 */

import { getStoreOwner } from '../../persistence/migrationRegistry';

let _bypass = false;

/**
 * Test-only escape hatch. NEVER reference from production code.
 *
 * Usage in a test:
 *   beforeEach(() => { __testing__.bypassMigrationCheck = true; });
 *   afterEach(() => { __testing__.bypassMigrationCheck = false; });
 */
export const __testing__ = Object.freeze({
  /** @returns {boolean} */
  get bypassMigrationCheck() {
    return _bypass;
  },
  /** @param {boolean} v */
  set bypassMigrationCheck(v) {
    _bypass = !!v;
  },
});

/**
 * Assert that a store name is registered in migrationRegistry. Throws
 * synchronously if not. No-ops when the bypass flag is on.
 *
 * @param {string} storeName
 */
export const assertStoreRegistered = (storeName) => {
  if (_bypass) return;
  if (typeof storeName !== 'string' || storeName.length === 0) {
    throw new TypeError(
      'assertStoreRegistered: storeName must be a non-empty string',
    );
  }
  const owner = getStoreOwner(storeName);
  if (!owner) {
    throw new Error(
      `assertStoreRegistered: store "${storeName}" is not registered in `
        + 'src/utils/persistence/migrationRegistry.js. '
        + 'Before creating an IDB store via the decisionSystems/idbStore factories, '
        + 'add an entry whose storesAdded includes this name. See '
        + 'docs/decisions/2026-05-14-idb-store-factory-migration-binding.md for the contract.',
    );
  }
};

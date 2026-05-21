/**
 * perceptionPrimitivesStore.js — IDB CRUD for the EAL `perceptionPrimitives` store
 *
 * Per `docs/projects/exploit-anchor-library/schema-delta.md` §3.3 + WRITERS.md
 * §`perceptionPrimitives` (3 writers: W-PP-1 migration-seed, W-PP-2 tier2-validity-updater,
 * W-PP-3 owner-primitive-override).
 *
 * Primitives are seeded at v19 migration time (8 records: PP-01..PP-08). This module
 * exposes the CRUD primitives used by W-PP-2 (validity updates) and W-PP-3 (owner
 * overrides, Phase 8). W-PP-1 writes happen inside the migration transaction itself.
 *
 * **Authoring note (SPR-078 / 2026-05-14):** body collapsed to a factory call
 * (`createUpsertStore` from `decisionSystems/idbStore`). Public API + behavior
 * preserved verbatim. The factory asserts the store is registered in
 * `migrationRegistry.js` at construction time (ADR-2 binding).
 */

import { PERCEPTION_PRIMITIVES_STORE_NAME } from './database';
import { createUpsertStore } from '../decisionSystems/idbStore/createUpsertStore';

const store = createUpsertStore({
  storeName: PERCEPTION_PRIMITIVES_STORE_NAME,
  keyPath: 'id',
});

/** Read a single primitive by id (e.g. 'PP-01'). */
export const getPrimitive = (id) => store.get(id);

/** Read all primitives. Used at hydration on app start. */
export const getAllPrimitives = () => store.getAll();

/**
 * Read all primitives that apply to a given style via the multi-entry
 * `appliesToStyles` index. `style` is one of: 'Fish' | 'Nit' | 'LAG' | 'TAG'
 * (or any style stored by W-PP-1's seed).
 */
export const getPrimitivesByStyle = (style) => {
  if (typeof style !== 'string' || style.length === 0) {
    return Promise.reject(new Error('getPrimitivesByStyle requires a non-empty string style'));
  }
  return store.getByIndex('appliesToStyles', style);
};

/**
 * Write (create or replace) a primitive record.
 *
 * Called by W-PP-2 (after `updatePrimitiveValidity` computes new posterior) and
 * W-PP-3 (Phase 8 owner override). W-PP-1 writes via the migration transaction
 * in `migrations.js`, not through this primitive.
 */
export const putPrimitive = (record) => store.put(record);

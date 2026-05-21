/**
 * anchorObservationsStore.js — IDB CRUD for the EAL `anchorObservations` store
 *
 * Per `docs/projects/exploit-anchor-library/schema-delta.md` §3.1 + WRITERS.md
 * §`anchorObservations` (3 writers: W-AO-1 hand-replay-capture-writer,
 * W-AO-2 matcher-system-observation-writer, W-AO-3 candidate-promotion-writer).
 *
 * **Authoring note (SPR-078 / 2026-05-14):** body collapsed to a factory call
 * (`createUpsertStore` from `decisionSystems/idbStore`). Public API + behavior
 * preserved verbatim. The factory asserts the store is registered in
 * `migrationRegistry.js` at construction time (ADR-2 binding).
 *
 * Note on signal separation (I-WR-2, I-AE-7):
 *   - W-AO-1 writes `origin: 'owner-captured'`.
 *   - W-AO-2 writes `origin: 'matcher-system'`.
 *   - This module's `putObservation` accepts both shapes; downstream selectors
 *     filter by `origin` to preserve signal separation on the
 *     Calibration Dashboard (red line: never arithmetically fuse — AP-08).
 */

import { ANCHOR_OBSERVATIONS_STORE_NAME } from './database';
import { createUpsertStore } from '../decisionSystems/idbStore/createUpsertStore';

const store = createUpsertStore({
  storeName: ANCHOR_OBSERVATIONS_STORE_NAME,
  keyPath: 'id',
});

/** Read a single observation by id. */
export const getObservation = (id) => store.get(id);

/** Read all observations for a given hand via the `handId` index. */
export const getObservationsByHandId = (handId) => {
  if (typeof handId !== 'string' || handId.length === 0) {
    return Promise.reject(new Error('getObservationsByHandId requires a non-empty string handId'));
  }
  return store.getByIndex('handId', handId);
};

/** Read all observations. Used at hydration on app start. */
export const getAllObservations = () => store.getAll();

/** Write (create or replace) an observation record. */
export const putObservation = (record) => {
  if (!record || typeof record !== 'object' || !record.id) {
    return Promise.reject(new Error('putObservation requires a record with an id field'));
  }
  return store.put(record);
};

/** Delete an observation by id (W-AO-3 cleanup path / dev-mode reset). */
export const deleteObservation = (id) => store.delete(id);

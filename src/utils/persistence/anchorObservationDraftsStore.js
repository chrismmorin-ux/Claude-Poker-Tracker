/**
 * anchorObservationDraftsStore.js — IDB CRUD for the EAL `anchorObservationDrafts` sidecar
 *
 * Per `docs/design/surfaces/hand-replay-observation-capture.md` §State:
 * 400ms-debounced draft persistence; keypath `id` with format `draft:<handId>`.
 *
 * Drafts are the in-progress capture-modal state — separate from
 * `anchorObservations` (final records). On Save, the draft is promoted to an
 * observation via W-AO-1 and the draft is deleted.
 *
 * **Authoring note (SPR-078 / 2026-05-14):** body collapsed to a factory call
 * (`createUpsertStore` from `decisionSystems/idbStore`). Public API + behavior
 * preserved verbatim. The factory asserts the store is registered in
 * `migrationRegistry.js` at construction time (ADR-2 binding).
 */

import { ANCHOR_OBSERVATION_DRAFTS_STORE_NAME } from './database';
import { createUpsertStore } from '../decisionSystems/idbStore/createUpsertStore';

const store = createUpsertStore({
  storeName: ANCHOR_OBSERVATION_DRAFTS_STORE_NAME,
  keyPath: 'id',
});

const draftId = (handId) => `draft:${handId}`;

const requireHandId = (handId, fnName) => {
  if (typeof handId !== 'string' || handId.length === 0) {
    throw new Error(`${fnName} requires a non-empty string handId`);
  }
};

/** Read a single draft by handId-derived id (`draft:<handId>`). */
export const getDraft = (handId) => {
  try {
    requireHandId(handId, 'getDraft');
  } catch (err) {
    return Promise.reject(err);
  }
  return store.get(draftId(handId));
};

/**
 * Write (create or replace) the draft for a given hand.
 *
 * Caller constructs the record; the writer auto-attaches the deterministic
 * `id` if missing, but if the caller passes an explicit id it must match
 * `draft:<handId>` format (asserted to prevent accidental cross-hand writes).
 */
export const putDraft = (record) => {
  if (!record || typeof record !== 'object' || !record.handId) {
    return Promise.reject(new Error('putDraft requires a record with a handId field'));
  }
  const expectedId = draftId(record.handId);
  if (record.id !== undefined && record.id !== expectedId) {
    return Promise.reject(new Error(
      `putDraft: record.id "${record.id}" does not match expected "${expectedId}" — drafts are keyed by handId`,
    ));
  }
  return store.put({ ...record, id: expectedId });
};

/** Delete a draft by handId. */
export const deleteDraft = (handId) => {
  try {
    requireHandId(handId, 'deleteDraft');
  } catch (err) {
    return Promise.reject(err);
  }
  return store.delete(draftId(handId));
};

/** Read all drafts. Used at hydration on app start. */
export const getAllDrafts = () => store.getAll();

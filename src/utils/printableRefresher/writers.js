/**
 * writers.js — Printable Refresher writer registry (W-URC-1 / W-URC-2 / W-URC-3).
 *
 * Three writers per `docs/projects/printable-refresher/WRITERS.md` v1.0. Each
 * composes with `refresherStore.js` IDB primitives + enforces field-ownership
 * (I-WR-3 segregation) + Phase 1 structural invariants (AP-PRF-09 includeCodex
 * refusal / red line #13 deliberate-suppression / red line #15 owner-initiated-print).
 *
 * Architectural separation:
 *   - `refresherStore.js` is the data layer (IDB primitives + input shape validation).
 *   - This module is the **policy layer** — what writers can write where, with
 *     what guards. Writers compose with primitives; primitives never call writers.
 *   - Hooks (next session) compose with writers — `useRefresherConfig` debounces
 *     W-URC-1 calls; `useRefresherView` does NOT touch IDB (localStorage UI state).
 *
 * Enforcement:
 *   - Synchronous validation throws on field-ownership violation. UI must catch.
 *   - I-WR-1 enumeration enforcement is at CI-grep level (`scripts/check-refresher-writers.sh`).
 *   - I-WR-2 reference-mode write-silence is at reducer-boundary level (PRF-G5-RI test).
 */

import {
  getRefresherConfig,
  putRefresherConfig,
  putPrintBatch,
} from '../persistence/refresherStore';
import { REFRESHER_CONFIG_SINGLETON_ID } from '../persistence/refresherDefaults';

// ─── W-URC-1 — config-preferences writer ────────────────────────────────────

const W_URC_1_OWNED_TOP_LEVEL_KEYS = new Set([
  'printPreferences',
  'notifications',
  'lastExportAt',
]);

const VALID_PRINT_PREFERENCE_KEYS = new Set([
  'pageSize',
  'cardsPerSheet',
  'colorMode',
  'includeLineage',
  'includeCodex',
]);

const VALID_NOTIFICATIONS_KEYS = new Set([
  'staleness',
]);

/**
 * W-URC-1 — Persist owner-toggled settings (printPreferences + notifications.staleness
 * + lastExportAt). Composes read → merge → put. Caller (typically the hook layer)
 * is responsible for debouncing rapid toggles; this writer is synchronous-per-call.
 *
 * Invariants enforced:
 *   - I-WR-3 field-ownership: rejects cardVisibility / suppressedClasses keys.
 *   - AP-PRF-09 + red line #16: rejects `printPreferences.includeCodex: true`
 *     (Phase 1 structural; upgrade gated on Phase 2+ Gate 4 design pass).
 *   - Schema: rejects unknown top-level keys + unknown nested keys.
 *
 * @param {object} patch — partial record matching the singleton record shape.
 *                         Top-level keys must be a subset of {printPreferences,
 *                         notifications, lastExportAt}. Nested keys must be valid.
 * @returns {Promise<object>} the new merged singleton record after write.
 */
export async function writeConfigPreferences(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new Error('writeConfigPreferences requires a non-null object patch');
  }

  // Reject any top-level key not owned by W-URC-1 (I-WR-3 segregation).
  for (const key of Object.keys(patch)) {
    if (!W_URC_1_OWNED_TOP_LEVEL_KEYS.has(key)) {
      throw new Error(
        `W-URC-1 does not own field '${key}'. Use writeCardVisibility / writeSuppressedClass for ` +
        `cardVisibility / suppressedClasses, or check the field name (top-level keys: ${[...W_URC_1_OWNED_TOP_LEVEL_KEYS].join(', ')}).`
      );
    }
  }

  // Validate nested printPreferences keys + Phase 1 includeCodex refusal.
  if (patch.printPreferences !== undefined) {
    if (!patch.printPreferences || typeof patch.printPreferences !== 'object' || Array.isArray(patch.printPreferences)) {
      throw new Error('writeConfigPreferences.printPreferences must be a non-null object');
    }
    for (const k of Object.keys(patch.printPreferences)) {
      if (!VALID_PRINT_PREFERENCE_KEYS.has(k)) {
        throw new Error(
          `writeConfigPreferences.printPreferences contains unknown key '${k}'. ` +
          `Valid keys: ${[...VALID_PRINT_PREFERENCE_KEYS].join(', ')}.`
        );
      }
    }
    if (patch.printPreferences.includeCodex === true) {
      throw new Error(
        'AP-PRF-09: includeCodex:true is not permitted at Phase 1 (red line #16). ' +
        'Personal codex is deferred to Phase 2+ via PRF-P2-PE explicit opt-in gesture.'
      );
    }
  }

  if (patch.notifications !== undefined) {
    if (!patch.notifications || typeof patch.notifications !== 'object' || Array.isArray(patch.notifications)) {
      throw new Error('writeConfigPreferences.notifications must be a non-null object');
    }
    for (const k of Object.keys(patch.notifications)) {
      if (!VALID_NOTIFICATIONS_KEYS.has(k)) {
        throw new Error(
          `writeConfigPreferences.notifications contains unknown key '${k}'. ` +
          `Valid keys: ${[...VALID_NOTIFICATIONS_KEYS].join(', ')}.`
        );
      }
    }
  }

  if (patch.lastExportAt !== undefined) {
    if (patch.lastExportAt !== null && typeof patch.lastExportAt !== 'string') {
      throw new Error('writeConfigPreferences.lastExportAt must be ISO8601 string or null');
    }
  }

  // Read-merge-put. Singleton shape is preserved.
  const current = await getRefresherConfig();
  const next = {
    ...current,
    printPreferences: patch.printPreferences
      ? { ...current.printPreferences, ...patch.printPreferences }
      : current.printPreferences,
    notifications: patch.notifications
      ? { ...current.notifications, ...patch.notifications }
      : current.notifications,
    lastExportAt: patch.lastExportAt !== undefined ? patch.lastExportAt : current.lastExportAt,
    id: REFRESHER_CONFIG_SINGLETON_ID,
  };
  await putRefresherConfig(next);
  return next;
}

// ─── W-URC-2 — card-visibility writer + class-suppression writer ────────────

const VALID_VISIBILITY_VALUES = new Set(['default', 'hidden', 'pinned']);

/**
 * W-URC-2a — Set per-card visibility (default / hidden / pinned).
 *
 * Pin and Hide are immediate single-tap actions; no debounce. Pinning a card
 * un-hides it; hiding a pinned card un-pins it (last-write-wins enum semantics).
 *
 * Invariants enforced:
 *   - I-WR-3 field-ownership: only writes cardVisibility[cardId]; rejects
 *     attempts to mutate other fields.
 *   - Visibility value must be in {default, hidden, pinned}.
 *
 * @param {object} args — { cardId, visibility }
 * @returns {Promise<object>} the new merged singleton record after write.
 */
export async function writeCardVisibility({ cardId, visibility } = {}) {
  if (typeof cardId !== 'string' || cardId.length === 0) {
    throw new Error('writeCardVisibility requires non-empty string cardId');
  }
  if (!VALID_VISIBILITY_VALUES.has(visibility)) {
    throw new Error(
      `writeCardVisibility requires visibility ∈ {${[...VALID_VISIBILITY_VALUES].join(', ')}} (got '${visibility}')`
    );
  }

  const current = await getRefresherConfig();
  const nextCardVisibility = { ...(current.cardVisibility || {}) };
  if (visibility === 'default') {
    delete nextCardVisibility[cardId]; // 'default' means absent from map
  } else {
    nextCardVisibility[cardId] = visibility;
  }
  const next = { ...current, cardVisibility: nextCardVisibility, id: REFRESHER_CONFIG_SINGLETON_ID };
  await putRefresherConfig(next);
  return next;
}

/**
 * W-URC-2b — Toggle class-level suppression (suppress / un-suppress an entire class).
 *
 * Suppress requires modal confirmation per red line #13 — defense at writer:
 *   `options.confirmed === true` is mandatory. UI path enforces; writer
 *   defends against direct API calls bypassing the modal.
 *
 * Un-suppress requires owner-initiated tap per AP-PRF-05 refusal of un-suppress
 * nudges — defense at writer:
 *   `options.ownerInitiated === true` is mandatory. No programmatic un-suppress
 *   call-path is permitted (e.g., a "reconsider this card?" cross-card surfacer
 *   would be refused at this writer boundary).
 *
 * @param {object} args — { classId, suppress, confirmed?, ownerInitiated? }
 * @returns {Promise<object>} the new merged singleton record after write.
 */
export async function writeSuppressedClass({ classId, suppress, confirmed, ownerInitiated } = {}) {
  if (typeof classId !== 'string' || classId.length === 0) {
    throw new Error('writeSuppressedClass requires non-empty string classId');
  }
  if (typeof suppress !== 'boolean') {
    throw new Error('writeSuppressedClass requires boolean suppress');
  }
  if (suppress === true && confirmed !== true) {
    throw new Error(
      'writeSuppressedClass({suppress: true}) requires options.confirmed === true ' +
      '(SuppressConfirmModal must have been confirmed; red line #13 deliberate-suppression).'
    );
  }
  if (suppress === false && ownerInitiated !== true) {
    throw new Error(
      'writeSuppressedClass({suppress: false}) requires options.ownerInitiated === true ' +
      '(no programmatic un-suppress permitted; AP-PRF-05 refuses un-suppress nudges).'
    );
  }

  const current = await getRefresherConfig();
  const currentList = Array.isArray(current.suppressedClasses) ? current.suppressedClasses : [];
  let nextList;
  if (suppress) {
    nextList = currentList.includes(classId) ? currentList : [...currentList, classId];
  } else {
    nextList = currentList.filter((c) => c !== classId);
  }
  const next = { ...current, suppressedClasses: nextList, id: REFRESHER_CONFIG_SINGLETON_ID };
  await putRefresherConfig(next);
  return next;
}

// ─── W-URC-3 — print-batch writer (red line #15 owner-initiated only) ───────

/**
 * Generate a UUID v4. Uses crypto.randomUUID when available (Web Crypto + Node
 * crypto both support it as of recent runtimes); falls back to a simple
 * v4 implementation for environments without it.
 */
function generateBatchId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  // Fallback: RFC 4122 v4-ish (uses Math.random — acceptable for batchId
  // identity since IDB keypath uniqueness is not security-critical here).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * W-URC-3 — Append a new print batch record.
 *
 * Fires only from the PrintConfirmationModal confirm handler (red line #15
 * no-proactive-print). I-WR-1 CI-grep enforces this at the call-site level;
 * this writer does not have a separate "is the call-site allowed?" guard.
 *
 * Invariants enforced:
 *   - I-WR-6 perCardSnapshots completeness: keys MUST equal cardIds set.
 *   - cardIds non-empty (empty batch is meaningless).
 *   - printedAt > +1 day in the future → dev-mode warning (accepted; owner
 *     may set a future-print reminder).
 *   - Post-write side effect: invokes W-URC-1 to update lastExportAt.
 *
 * @param {object} payload — { printedAt, label, cardIds, engineVersion,
 *                             appVersion, perCardSnapshots }
 * @returns {Promise<{batchId: string, record: object}>} the created batch record.
 */
export async function writePrintBatch(payload = {}) {
  const {
    printedAt,
    label = null,
    cardIds,
    engineVersion,
    appVersion,
    perCardSnapshots,
  } = payload;

  if (typeof printedAt !== 'string' || printedAt.length === 0) {
    throw new Error('writePrintBatch requires non-empty string printedAt (ISO8601)');
  }
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    throw new Error('writePrintBatch requires non-empty cardIds array');
  }
  if (typeof engineVersion !== 'string' || engineVersion.length === 0) {
    throw new Error('writePrintBatch requires non-empty string engineVersion');
  }
  if (typeof appVersion !== 'string' || appVersion.length === 0) {
    throw new Error('writePrintBatch requires non-empty string appVersion');
  }
  if (!perCardSnapshots || typeof perCardSnapshots !== 'object' || Array.isArray(perCardSnapshots)) {
    throw new Error('writePrintBatch requires non-null perCardSnapshots object');
  }
  if (label !== null && typeof label !== 'string') {
    throw new Error('writePrintBatch.label must be string or null');
  }

  // I-WR-6 — perCardSnapshots key set === cardIds set.
  const cardIdsSet = new Set(cardIds);
  const snapshotKeys = Object.keys(perCardSnapshots);
  if (snapshotKeys.length !== cardIds.length) {
    throw new Error(
      `I-WR-6 perCardSnapshots completeness violation: cardIds has ${cardIds.length} entries ` +
      `but perCardSnapshots has ${snapshotKeys.length}. Keys must match cardIds 1:1.`
    );
  }
  for (const k of snapshotKeys) {
    if (!cardIdsSet.has(k)) {
      throw new Error(
        `I-WR-6 perCardSnapshots completeness violation: snapshot key '${k}' not in cardIds.`
      );
    }
  }
  for (const id of cardIds) {
    const snap = perCardSnapshots[id];
    if (!snap || typeof snap !== 'object') {
      throw new Error(`I-WR-6 perCardSnapshots completeness violation: cardId '${id}' missing snapshot.`);
    }
    if (typeof snap.contentHash !== 'string' || snap.contentHash.length === 0) {
      throw new Error(`writePrintBatch.perCardSnapshots['${id}'].contentHash must be non-empty string.`);
    }
    if (typeof snap.version !== 'string' || snap.version.length === 0) {
      throw new Error(`writePrintBatch.perCardSnapshots['${id}'].version must be non-empty string.`);
    }
  }

  // printedAt future-warn (dev-mode only; not a hard reject).
  const printedAtMs = Date.parse(printedAt);
  if (!Number.isNaN(printedAtMs) && printedAtMs > Date.now() + ONE_DAY_MS) {
    // eslint-disable-next-line no-console
    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      console.warn(
        `writePrintBatch: printedAt '${printedAt}' is more than 1 day in the future. ` +
        `This is permitted (owner may be backdating a future print) but unusual.`
      );
    }
  }

  const batchId = generateBatchId();
  const record = {
    batchId,
    printedAt,
    label,
    cardIds: [...cardIds],
    engineVersion,
    appVersion,
    perCardSnapshots: { ...perCardSnapshots },
    schemaVersion: 1,
  };

  await putPrintBatch(record);

  // Post-write side effect: update lastExportAt via W-URC-1.
  // Single-ownership pattern per WRITERS.md note on lastExportAt shared write.
  await writeConfigPreferences({ lastExportAt: printedAt });

  return { batchId, record };
}

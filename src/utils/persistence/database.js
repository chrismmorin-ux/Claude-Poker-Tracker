/**
 * database.js - IndexedDB initialization and configuration
 *
 * Provides database initialization, constants, and migration logic.
 * This is the foundation module that all other persistence modules depend on.
 *
 * Database Schema:
 *   Database: "PokerTrackerDB" v13
 *   Object Stores:
 *     - "hands" (keyPath: "handId", autoIncrement: true)
 *       Indexes: timestamp, sessionId, userId, userId_timestamp (compound)
 *       Fields: seatPlayers, actionSequence, userId (for multi-user data isolation)
 *     - "sessions" (keyPath: "sessionId", autoIncrement: true)
 *       Indexes: startTime, endTime, isActive, userId, userId_startTime (compound)
 *       Fields: venue, gameType, buyIn, rebuyTransactions (array), cashOut, goal, notes, userId
 *     - "activeSession" (keyPath: "id")
 *       Per-user store: id = `active_${userId}` (e.g., "active_guest")
 *       Fields: sessionId, userId, lastUpdated
 *     - "players" (keyPath: "playerId", autoIncrement: true)
 *       Indexes: name, createdAt, lastSeenAt, userId, userId_name (compound)
 *       Fields: name, nickname, ethnicity, build, gender, facialHair, styleTags, notes, avatar, userId
 *     - "settings" (keyPath: "id")
 *       Per-user store: id = `settings_${userId}` (e.g., "settings_guest")
 *       Fields: theme, cardSize, defaultVenue, defaultGameType, customVenues, customGameTypes, userId
 *     - "rangeProfiles" (keyPath: "profileKey")
 *       Indexes: playerId, userId
 *       Fields: profileKey, playerId, userId, ranges, showdownAnchors, handsProcessed
 *
 * Migration History:
 *   v6 → v7: Added userId field to all stores for multi-user data isolation
 *            Changed settings/activeSession from singleton to per-user keying
 *   v7 → v8: Added actionSequence field to hands for ordered action storage
 *            Converts existing seatActions to actionSequence on migration
 *   v8 → v9: Added rangeProfiles object store for cached Bayesian range estimates
 *   v9 → v10: Added exploitBriefings[] and dismissedBriefingIds[] to player records
 *   v10 → v11: Added tournaments object store for tournament state persistence
 *   v11 → v12: Added source/tableId indexes to hands/sessions for online play integration
 *   v12 → v13: Normalized seatActions field in existing hand records
 */

import { logger } from '../errorHandler';
import { GUEST_USER_ID } from '../../constants/authConstants';
import { runMigrations } from './migrations';

// =============================================================================
// CONSTANTS
// =============================================================================

export const DB_NAME = 'PokerTrackerDB';
export const DB_VERSION = 27;

export { GUEST_USER_ID };
export const STORE_NAME = 'hands';
export const SESSIONS_STORE_NAME = 'sessions';
export const ACTIVE_SESSION_STORE_NAME = 'activeSession';
export const PLAYERS_STORE_NAME = 'players';
export const SETTINGS_STORE_NAME = 'settings';
export const RANGE_PROFILES_STORE_NAME = 'rangeProfiles';
export const TOURNAMENTS_STORE_NAME = 'tournaments';
export const PLAYER_DRAFTS_STORE_NAME = 'playerDrafts';
export const PREFLOP_DRILLS_STORE_NAME = 'preflopDrills';
export const POSTFLOP_DRILLS_STORE_NAME = 'postflopDrills';
export const VILLAIN_ASSUMPTIONS_STORE_NAME = 'villainAssumptions';
// MPMF G5-B1 (2026-04-25) — entitlement state for monetization & PMF.
// Single record per install (keypath: userId). Per WRITERS.md §subscription store.
export const SUBSCRIPTION_STORE_NAME = 'subscription';

// EAL Phase 6 Stream D (2026-04-25, S11) — exploit anchor library v19 stores.
// Per `docs/projects/exploit-anchor-library/schema-delta.md` §5.1
// + `docs/projects/exploit-anchor-library/WRITERS.md` (13 writers across 4 main stores
// + drafts sidecar per `docs/design/surfaces/hand-replay-observation-capture.md`).
export const EXPLOIT_ANCHORS_STORE_NAME = 'exploitAnchors';
export const ANCHOR_OBSERVATIONS_STORE_NAME = 'anchorObservations';
export const ANCHOR_OBSERVATION_DRAFTS_STORE_NAME = 'anchorObservationDrafts';
export const ANCHOR_CANDIDATES_STORE_NAME = 'anchorCandidates';
export const PERCEPTION_PRIMITIVES_STORE_NAME = 'perceptionPrimitives';

// PRF Phase 5 (2026-04-26, PRF-G5-MIG) — printable refresher v20 stores.
// Per `docs/projects/printable-refresher/idb-migration.md` §Stores added.
// Dynamic-target rule (max(currentVersion+1, 18)) resolved statically to v20
// because EAL claimed v19 first; PRF computes max(19+1, 18) = 20.
export const USER_REFRESHER_CONFIG_STORE_NAME = 'userRefresherConfig';
export const PRINT_BATCHES_STORE_NAME = 'printBatches';

// MPMF G5-B2 (2026-04-26) — telemetry consent state at v21.
// Dedicated store (rather than nested under settings) avoids a write race
// between useSettingsPersistence and useTelemetryConsentPersistence — both
// reducers share state, but they own non-overlapping IDB regions.
// Singleton per user, keyed by userId. See subscriptionStore for the
// closest pattern.
export const TELEMETRY_CONSENT_STORE_NAME = 'telemetryConsent';

// SCF Gate 5 child 1 (2026-05-03, SPR-030 / WS-145) — hero-leak detection storage.
// Composite keypath [playerId, situationKey] per SCF G3 SCHEMA.
// Read-allowed surfaces: HandReplayView (review-mode only), SelfCoachView.
// BLACKLISTED: live-table surfaces per chris-live-player.md autonomy red line #8.
// See src/utils/skillAssessment/CLAUDE.md for the source-util-policy whitelist.
export const HERO_LEAKS_STORE_NAME = 'heroLeaks';

// SLS Stream D (2026-05-14, SPR-081 / WS-040) — shape language mastery + lesson completion.
// Per `docs/design/contracts/shape-mastery.md` canonical shape +
// `docs/design/surfaces/shape-skill-map.md` transparency surface +
// `docs/projects/poker-shape-language/gate3-decision-memo.md` Q1-Q7 verdicts.
//
// `shapeMastery` — singleton per user (keyPath: userId). Record holds
// {userId, enrolled, enrolledAt, schemaVersion, descriptors: {[id]: DescriptorMastery}}.
// Per-descriptor mastery state includes Bayesian Beta posterior, declared signal,
// mute state, and temporal anchors. I-SM-1 separates declared from posterior; no
// fused score field exists by design.
//
// `shapeLessons` — append-only per-completion store (keyPath: id where id =
// `${userId}:${lessonId}:${completedAt}`). 3 indexes (userId, descriptorId,
// completedAt). Lesson CATALOG stays in code (src/utils/skillAssessment/lessonRegistry.js
// pattern) — this store is owner-ratified per-user history only (SPR-081 plan-mode Decision 2).
export const SHAPE_MASTERY_STORE_NAME = 'shapeMastery';
export const SHAPE_LESSONS_STORE_NAME = 'shapeLessons';

// PIO Gate 5 child A (2026-05-04, SPR-034 / WS-160) — player identification v2 stores.
// Per `docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md` §PIO-G4-MIG.
//
// `sightingLogs` — append-only per-event store; 5 indexes (playerId, playerId+sessionId
// composite, featuresSeen multiEntry, capturedAt, venueId). Stores attribute snapshots
// per sighting (Bayesian-Beta posteriors derived at read-time via `computeStability()`).
//
// `playerPhotos` — blob storage; cascade-on-delete when Player deleted. 1 index
// (playerId). Per `docs/design/surfaces/camera-capture-modal.md` §Atomic-txn binding.
export const SIGHTING_LOGS_STORE_NAME = 'sightingLogs';
export const PLAYER_PHOTOS_STORE_NAME = 'playerPhotos';

const MODULE_NAME = 'Persistence';

// Backward-compatible logging wrappers
export const log = (...args) => logger.debug(MODULE_NAME, ...args);
export const logError = (error) => logger.error(MODULE_NAME, error);

// =============================================================================
// DATABASE INITIALIZATION
// =============================================================================

/**
 * Initialize IndexedDB database
 * Creates database and object store if they don't exist
 * @returns {Promise<IDBDatabase>} Database connection
 */
export const initDB = async () => {
  return new Promise((resolve, reject) => {
    // Check if IndexedDB is supported
    if (!window.indexedDB) {
      logError('IndexedDB not supported in this browser');
      reject(new Error('IndexedDB not supported'));
      return;
    }

    log('Initializing database...');

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      logError('Failed to open database:', event.target.error);
      reject(event.target.error);
    };

    request.onblocked = () => {
      logError('Database upgrade blocked — another tab may have an open connection. Please close other tabs and reload.');
      reject(new Error('Database upgrade blocked by another tab. Close other tabs and reload.'));
    };

    request.onsuccess = (event) => {
      const db = event.target.result;
      log('Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      const transaction = event.target.transaction;

      log(`Database upgrade needed: v${oldVersion} → v${DB_VERSION}`);

      runMigrations(db, transaction, oldVersion);
    };
  });
};

// =============================================================================
// CONNECTION POOL (singleton cached connection)
// =============================================================================

let cachedDb = null;
let dbPromise = null;

/**
 * Get a shared database connection. Returns cached connection if alive,
 * otherwise opens a new one via initDB(). Never call db.close() on the
 * returned connection — use closeDB() for explicit shutdown.
 * @returns {Promise<IDBDatabase>}
 */
export const getDB = async () => {
  if (cachedDb) return cachedDb;
  if (dbPromise) return dbPromise;

  dbPromise = initDB().then(db => {
    cachedDb = db;
    dbPromise = null;

    db.onclose = () => { cachedDb = null; };
    db.onversionchange = () => {
      db.close();
      cachedDb = null;
    };

    return db;
  }).catch(err => {
    dbPromise = null;
    throw err;
  });

  return dbPromise;
};

/**
 * Explicitly close the cached connection (for app unmount / test teardown).
 */
export const closeDB = () => {
  if (cachedDb) {
    cachedDb.close();
    cachedDb = null;
  }
  dbPromise = null;
};

/**
 * Reset pool state for test isolation with fake-indexeddb. Defensively closes
 * the cached DB before nullifying — WS-126 root cause was test files that
 * skipped closeDB() in afterEach, leaving stale event handlers that race with
 * subsequent tests' IDBFactory swap. Closing here is a belt-and-suspenders
 * guarantee: any caller that reaches resetDBPool gets clean teardown even if
 * they didn't call closeDB explicitly.
 */
export const resetDBPool = () => {
  if (cachedDb) {
    try { cachedDb.close(); } catch (_) { /* ignore — fake-indexeddb may have already torn down */ }
  }
  cachedDb = null;
  dbPromise = null;
};

// =============================================================================
// SHARED TRANSACTION HELPERS (WS-226)
//
// Contract:
//   - Helpers reject with the RAW DOMException, never wrapped, so caller
//     checks like `error?.name === 'QuotaExceededError'` keep working. Only
//     when tx.error is null do they synthesize an Error carrying store +
//     helper context.
//   - Helpers do NOT log. Each module's createPersistenceLogger try/catch
//     owns logging and the swallow-vs-propagate decision.
//   - Write helpers (writeTx/updateTx/atomicTx, and cursorTx in 'readwrite'
//     mode) resolve on tx.oncomplete — i.e. AFTER the transaction durably
//     commits — not on request.onsuccess (DEC: WS-226 durable-writes).
//   - Layer-internal: exported from database.js only, not the index.js barrel.
// =============================================================================

/**
 * Single-store readonly transaction. fn(store) must return one IDBRequest
 * (get / getAll / count / index().get / ...). Resolves request.result.
 * @param {string} storeName
 * @param {(store: IDBObjectStore) => IDBRequest} fn
 * @returns {Promise<any>}
 */
export const readTx = async (storeName, fn) => {
  const db = await getDB();
  const request = fn(db.transaction([storeName], 'readonly').objectStore(storeName));
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Single-store readwrite transaction. fn(store) returns the one IDBRequest
 * whose result the caller wants (put / add / delete / clear) — it may issue
 * additional requests first. Resolves that result AFTER the tx commits.
 * @param {string} storeName
 * @param {(store: IDBObjectStore) => IDBRequest|void} fn
 * @returns {Promise<any>}
 */
export const writeTx = async (storeName, fn) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    let result;
    const request = fn(tx.objectStore(storeName));
    if (request) request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error(`writeTx(${storeName}) aborted`));
  });
};

/**
 * Read-modify-write in ONE transaction. mutate(record) returns the record to
 * put, or undefined to skip the write (resolves undefined). Throw inside
 * mutate to abort the tx and reject with your error (e.g. not-found).
 * Resolves the written record after commit.
 * @param {string} storeName
 * @param {IDBValidKey} key
 * @param {(record: any) => any|undefined} mutate
 * @returns {Promise<any|undefined>}
 */
export const updateTx = async (storeName, key, mutate) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], 'readwrite');
    const store = tx.objectStore(storeName);
    let result;
    const getReq = store.get(key);
    getReq.onsuccess = () => {
      let updated;
      try {
        updated = mutate(getReq.result);
      } catch (err) {
        reject(err);
        try { tx.abort(); } catch (_) { /* tx may already be settled */ }
        return;
      }
      if (updated === undefined) return;
      store.put(updated);
      result = updated;
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error(`updateTx(${storeName}, ${key}) aborted`));
  });
};

/**
 * Cursor walk. visit(cursor, acc) — push results into acc; return false to
 * stop early. mode:'readwrite' permits cursor.update()/delete() during the
 * walk. Resolves acc on tx.oncomplete.
 * @param {string} storeName
 * @param {{index?: string, range?: IDBKeyRange, direction?: IDBCursorDirection, mode?: IDBTransactionMode}} options
 * @param {(cursor: IDBCursorWithValue, acc: any[]) => boolean|void} visit
 * @returns {Promise<any[]>}
 */
export const cursorTx = async (storeName, options, visit) => {
  const { index = null, range = null, direction = 'next', mode = 'readonly' } = options || {};
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([storeName], mode);
    const store = tx.objectStore(storeName);
    const source = index ? store.index(index) : store;
    const acc = [];
    const req = source.openCursor(range, direction);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return; // exhausted — tx completes
      let verdict;
      try {
        verdict = visit(cursor, acc);
      } catch (err) {
        reject(err);
        try { tx.abort(); } catch (_) { /* tx may already be settled */ }
        return;
      }
      if (verdict !== false) cursor.continue();
    };
    tx.oncomplete = () => resolve(acc);
    tx.onabort = () => reject(tx.error || new Error(`cursorTx(${storeName}) aborted`));
  });
};

/**
 * Multi-store atomic readwrite transaction. fn(stores, tx, setResult) gets a
 * {storeName: IDBObjectStore} map; chain requests with your own callbacks and
 * call setResult(v) for the resolved value. All-or-nothing: resolves on
 * tx.oncomplete, rejects with raw tx.error on abort. Throw synchronously
 * inside fn to abort.
 * @param {string[]} storeNames
 * @param {(stores: Record<string, IDBObjectStore>, tx: IDBTransaction, setResult: (v: any) => void) => void} fn
 * @returns {Promise<any>}
 */
export const atomicTx = async (storeNames, fn) => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite');
    const stores = Object.fromEntries(storeNames.map((n) => [n, tx.objectStore(n)]));
    let result;
    try {
      fn(stores, tx, (v) => { result = v; });
    } catch (err) {
      reject(err);
      try { tx.abort(); } catch (_) { /* tx may already be settled */ }
      return;
    }
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error || new Error(`atomicTx(${storeNames.join('+')}) aborted`));
  });
};

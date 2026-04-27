/**
 * migrations.js - IndexedDB migration functions (v1-v12)
 *
 * Each migration is a named function receiving (db, transaction, oldVersion).
 * Called by runMigrations() in version order, guarded by oldVersion checks.
 */

import { GUEST_USER_ID } from '../../constants/authConstants';
import {
  STORE_NAME,
  SESSIONS_STORE_NAME,
  ACTIVE_SESSION_STORE_NAME,
  PLAYERS_STORE_NAME,
  SETTINGS_STORE_NAME,
  RANGE_PROFILES_STORE_NAME,
  TOURNAMENTS_STORE_NAME,
  PLAYER_DRAFTS_STORE_NAME,
  PREFLOP_DRILLS_STORE_NAME,
  POSTFLOP_DRILLS_STORE_NAME,
  VILLAIN_ASSUMPTIONS_STORE_NAME,
  SUBSCRIPTION_STORE_NAME,
  EXPLOIT_ANCHORS_STORE_NAME,
  ANCHOR_OBSERVATIONS_STORE_NAME,
  ANCHOR_OBSERVATION_DRAFTS_STORE_NAME,
  ANCHOR_CANDIDATES_STORE_NAME,
  PERCEPTION_PRIMITIVES_STORE_NAME,
  USER_REFRESHER_CONFIG_STORE_NAME,
  PRINT_BATCHES_STORE_NAME,
  TELEMETRY_CONSENT_STORE_NAME,
  log,
  logError,
} from './database';
import { seedPerceptionPrimitives } from '../anchorLibrary/perceptionPrimitiveSeed';
import { buildDefaultRefresherConfig } from './refresherDefaults';

// =============================================================================
// SCHEMA-ONLY MIGRATIONS
// =============================================================================

/** v1: Create hands object store */
const migrateV1 = (db) => {
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const objectStore = db.createObjectStore(STORE_NAME, {
      keyPath: 'handId',
      autoIncrement: true
    });
    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
    objectStore.createIndex('sessionId', 'sessionId', { unique: false });
    log('Hands object store and indexes created');
  }
};

/** v2: Create sessions + activeSession stores */
const migrateV2 = (db) => {
  if (!db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
    const sessionsStore = db.createObjectStore(SESSIONS_STORE_NAME, {
      keyPath: 'sessionId',
      autoIncrement: true
    });
    sessionsStore.createIndex('startTime', 'startTime', { unique: false });
    sessionsStore.createIndex('endTime', 'endTime', { unique: false });
    sessionsStore.createIndex('isActive', 'isActive', { unique: false });
    log('Sessions object store and indexes created');
  }

  if (!db.objectStoreNames.contains(ACTIVE_SESSION_STORE_NAME)) {
    db.createObjectStore(ACTIVE_SESSION_STORE_NAME, { keyPath: 'id' });
    log('ActiveSession object store created');
  }
};

/** v5: Create players object store */
const migrateV5 = (db) => {
  if (!db.objectStoreNames.contains(PLAYERS_STORE_NAME)) {
    const playersStore = db.createObjectStore(PLAYERS_STORE_NAME, {
      keyPath: 'playerId',
      autoIncrement: true
    });
    playersStore.createIndex('name', 'name', { unique: false });
    playersStore.createIndex('createdAt', 'createdAt', { unique: false });
    playersStore.createIndex('lastSeenAt', 'lastSeenAt', { unique: false });
    log('Players object store and indexes created');
  }
};

/** v6: Create settings object store */
const migrateV6 = (db) => {
  if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
    db.createObjectStore(SETTINGS_STORE_NAME, { keyPath: 'id' });
    log('Settings object store created');
  }
};

/** v9: Create rangeProfiles object store */
const migrateV9 = (db) => {
  if (!db.objectStoreNames.contains(RANGE_PROFILES_STORE_NAME)) {
    const store = db.createObjectStore(RANGE_PROFILES_STORE_NAME, { keyPath: 'profileKey' });
    store.createIndex('playerId', 'playerId', { unique: false });
    store.createIndex('userId', 'userId', { unique: false });
    log('RangeProfiles object store and indexes created');
  }
};

/** v11: Create tournaments object store */
const migrateV11 = (db) => {
  if (!db.objectStoreNames.contains(TOURNAMENTS_STORE_NAME)) {
    const tournamentsStore = db.createObjectStore(TOURNAMENTS_STORE_NAME, {
      keyPath: 'tournamentId',
      autoIncrement: true,
    });
    tournamentsStore.createIndex('sessionId', 'sessionId', { unique: true });
    tournamentsStore.createIndex('userId', 'userId', { unique: false });
    log('Tournaments object store and indexes created');
  }
};

// =============================================================================
// DATA MIGRATIONS (cursor-based, need transaction)
// =============================================================================

/** v3: Add venue, gameType, convert rebuy → rebuyTransactions */
const migrateV3 = (transaction) => {
  log('Upgrading to v3: Adding venue, gameType, and rebuyTransactions');

  const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
  const getAllRequest = sessionsStore.openCursor();

  getAllRequest.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const session = cursor.value;
      session.venue = session.venue || 'Online';
      session.gameType = session.gameType || '1/2';

      if (typeof session.rebuy === 'number') {
        if (session.rebuy > 0) {
          session.rebuyTransactions = [{
            timestamp: session.startTime + 60000,
            amount: session.rebuy
          }];
        } else {
          session.rebuyTransactions = [];
        }
        delete session.rebuy;
      } else {
        session.rebuyTransactions = session.rebuyTransactions || [];
      }

      cursor.update(session);
      cursor.continue();
    } else {
      log('v3 migration completed for all sessions');
    }
  };

  getAllRequest.onerror = (e) => {
    logError('v3 migration failed:', e.target.error);
  };
};

/** v4: Add cashOut field to sessions */
const migrateV4 = (transaction) => {
  log('Upgrading to v4: Adding cashOut field');

  const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
  const getAllRequest = sessionsStore.openCursor();

  getAllRequest.onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const session = cursor.value;
      session.cashOut = session.cashOut || null;
      cursor.update(session);
      cursor.continue();
    } else {
      log('v4 migration completed for all sessions');
    }
  };

  getAllRequest.onerror = (e) => {
    logError('v4 migration failed:', e.target.error);
  };
};

/** v7: Add userId indexes + migrate existing data to guest user (hybrid: schema + data) */
const migrateV7 = (db, transaction, oldVersion) => {
  log('Upgrading to v7: Adding userId for multi-user support');

  // Schema: add userId indexes to all stores
  if (db.objectStoreNames.contains(STORE_NAME)) {
    const handsStore = transaction.objectStore(STORE_NAME);
    if (!handsStore.indexNames.contains('userId')) {
      handsStore.createIndex('userId', 'userId', { unique: false });
      log('Created userId index on hands store');
    }
    if (!handsStore.indexNames.contains('userId_timestamp')) {
      handsStore.createIndex('userId_timestamp', ['userId', 'timestamp'], { unique: false });
      log('Created userId_timestamp compound index on hands store');
    }
  }

  if (db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
    const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
    if (!sessionsStore.indexNames.contains('userId')) {
      sessionsStore.createIndex('userId', 'userId', { unique: false });
      log('Created userId index on sessions store');
    }
    if (!sessionsStore.indexNames.contains('userId_startTime')) {
      sessionsStore.createIndex('userId_startTime', ['userId', 'startTime'], { unique: false });
      log('Created userId_startTime compound index on sessions store');
    }
  }

  if (db.objectStoreNames.contains(PLAYERS_STORE_NAME)) {
    const playersStore = transaction.objectStore(PLAYERS_STORE_NAME);
    if (!playersStore.indexNames.contains('userId')) {
      playersStore.createIndex('userId', 'userId', { unique: false });
      log('Created userId index on players store');
    }
    if (!playersStore.indexNames.contains('userId_name')) {
      playersStore.createIndex('userId_name', ['userId', 'name'], { unique: false });
      log('Created userId_name compound index on players store');
    }
  }

  // Data: migrate existing records to guest user (skip on fresh install)
  if (oldVersion > 0) {
    if (db.objectStoreNames.contains(STORE_NAME)) {
      const handsStore = transaction.objectStore(STORE_NAME);
      const handsCursor = handsStore.openCursor();
      handsCursor.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const record = cursor.value;
          if (!record.userId) {
            record.userId = GUEST_USER_ID;
            cursor.update(record);
          }
          cursor.continue();
        } else {
          log('v7 migration: hands userId added');
        }
      };
    }

    if (db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
      const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
      const sessionsCursor = sessionsStore.openCursor();
      sessionsCursor.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const record = cursor.value;
          if (!record.userId) {
            record.userId = GUEST_USER_ID;
            cursor.update(record);
          }
          cursor.continue();
        } else {
          log('v7 migration: sessions userId added');
        }
      };
    }

    if (db.objectStoreNames.contains(PLAYERS_STORE_NAME)) {
      const playersStore = transaction.objectStore(PLAYERS_STORE_NAME);
      const playersCursor = playersStore.openCursor();
      playersCursor.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const record = cursor.value;
          if (!record.userId) {
            record.userId = GUEST_USER_ID;
            cursor.update(record);
          }
          cursor.continue();
        } else {
          log('v7 migration: players userId added');
        }
      };
    }

    if (db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
      const settingsStore = transaction.objectStore(SETTINGS_STORE_NAME);
      const settingsCursor = settingsStore.openCursor();
      settingsCursor.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const record = cursor.value;
          if (record.id === 1 && !record.userId) {
            settingsStore.delete(1);
            record.id = `settings_${GUEST_USER_ID}`;
            record.userId = GUEST_USER_ID;
            settingsStore.add(record);
            log('v7 migration: settings migrated to userId-based key');
          }
          cursor.continue();
        } else {
          log('v7 migration: settings userId added');
        }
      };
    }

    if (db.objectStoreNames.contains(ACTIVE_SESSION_STORE_NAME)) {
      const activeStore = transaction.objectStore(ACTIVE_SESSION_STORE_NAME);
      const activeCursor = activeStore.openCursor();
      activeCursor.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          const record = cursor.value;
          if (record.id === 1 && !record.userId) {
            activeStore.delete(1);
            record.id = `active_${GUEST_USER_ID}`;
            record.userId = GUEST_USER_ID;
            activeStore.add(record);
            log('v7 migration: activeSession migrated to userId-based key');
          }
          cursor.continue();
        } else {
          log('v7 migration: activeSession userId added');
        }
      };
    }
  }

  log('v7 migration initiated for all stores');
};

/** v8: Add actionSequence field to hands (convert seatActions → ordered array) */
const migrateV8 = (db, transaction) => {
  log('Upgrading to v8: Adding actionSequence field to hands');

  if (db.objectStoreNames.contains(STORE_NAME)) {
    const handsStore = transaction.objectStore(STORE_NAME);
    const handsCursor = handsStore.openCursor();

    handsCursor.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const hand = cursor.value;

        if (!hand.actionSequence || hand.actionSequence.length === 0) {
          const seatActions = hand.seatActions || hand.gameState?.seatActions;

          if (seatActions && typeof seatActions === 'object') {
            const sequence = [];
            const streets = ['preflop', 'flop', 'turn', 'river'];
            let order = 1;

            streets.forEach(street => {
              const streetActions = seatActions[street];
              if (!streetActions || typeof streetActions !== 'object') return;

              const seats = Object.keys(streetActions)
                .map(Number)
                .sort((a, b) => a - b);

              seats.forEach(seat => {
                const actions = streetActions[seat];
                if (!Array.isArray(actions)) return;

                actions.forEach(action => {
                  if (action && typeof action === 'string') {
                    sequence.push({ seat, action, street, order: order++ });
                  }
                });
              });
            });

            hand.actionSequence = sequence;
            cursor.update(hand);
          } else {
            hand.actionSequence = [];
            cursor.update(hand);
          }
        }

        cursor.continue();
      } else {
        log('v8 migration: hands actionSequence added');
      }
    };

    handsCursor.onerror = (e) => {
      logError('v8 migration failed:', e.target.error);
    };
  }

  log('v8 migration initiated for hands store');
};

/** v10: Add exploitBriefings and dismissedBriefingIds to players */
const migrateV10 = (transaction) => {
  log('Upgrading to v10: Adding exploitBriefings to players');

  {
    const playersStore = transaction.objectStore(PLAYERS_STORE_NAME);
    const playersCursor = playersStore.openCursor();

    playersCursor.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const record = cursor.value;
        if (!record.exploitBriefings) {
          record.exploitBriefings = [];
          record.dismissedBriefingIds = [];
          cursor.update(record);
        }
        cursor.continue();
      } else {
        log('v10 migration: exploitBriefings initialized on all players');
      }
    };

    playersCursor.onerror = (e) => {
      logError('v10 migration failed:', e.target.error);
    };
  }
};

/** v12: Add source/tableId indexes to hands/sessions for online play */
const migrateV12 = (db, transaction) => {
  log('Upgrading to v12: Adding source indexes for online play');

  if (db.objectStoreNames.contains(STORE_NAME)) {
    const handsStore = transaction.objectStore(STORE_NAME);
    if (!handsStore.indexNames.contains('source')) {
      handsStore.createIndex('source', 'source', { unique: false });
    }
  }

  if (db.objectStoreNames.contains(SESSIONS_STORE_NAME)) {
    const sessionsStore = transaction.objectStore(SESSIONS_STORE_NAME);
    if (!sessionsStore.indexNames.contains('source')) {
      sessionsStore.createIndex('source', 'source', { unique: false });
    }
    if (!sessionsStore.indexNames.contains('tableId')) {
      sessionsStore.createIndex('tableId', 'tableId', { unique: false });
    }
  }

  log('v12 migration complete: source + tableId indexes added');
};

/** v14: Create playerDrafts store for in-progress player creation (PEO-1). Additive only. */
const migrateV14 = (db) => {
  if (!db.objectStoreNames.contains(PLAYER_DRAFTS_STORE_NAME)) {
    db.createObjectStore(PLAYER_DRAFTS_STORE_NAME, { keyPath: 'userId' });
    log('PlayerDrafts object store created');
  }
};

/** v15: Create preflopDrills store for tracking preflop-equity drill attempts. */
const migrateV15 = (db) => {
  if (!db.objectStoreNames.contains(PREFLOP_DRILLS_STORE_NAME)) {
    const store = db.createObjectStore(PREFLOP_DRILLS_STORE_NAME, {
      keyPath: 'drillId',
      autoIncrement: true,
    });
    store.createIndex('userId', 'userId', { unique: false });
    store.createIndex('drillType', 'drillType', { unique: false });
    store.createIndex('matchupKey', 'matchupKey', { unique: false });
    store.createIndex('userId_timestamp', ['userId', 'timestamp'], { unique: false });
    log('PreflopDrills object store created');
  }
};

/** v16: Create postflopDrills store for tracking postflop range-vs-board drill attempts. */
const migrateV16 = (db) => {
  if (!db.objectStoreNames.contains(POSTFLOP_DRILLS_STORE_NAME)) {
    const store = db.createObjectStore(POSTFLOP_DRILLS_STORE_NAME, {
      keyPath: 'drillId',
      autoIncrement: true,
    });
    store.createIndex('userId', 'userId', { unique: false });
    store.createIndex('drillType', 'drillType', { unique: false });
    store.createIndex('scenarioKey', 'scenarioKey', { unique: false });
    store.createIndex('userId_timestamp', ['userId', 'timestamp'], { unique: false });
    log('PostflopDrills object store created');
  }
};

/**
 * v17: Create villainAssumptions store for the Exploit Deviation Engine.
 * Compound key [villainId, assumptionId]. Indexes on status + lastUpdated
 * for retirement queries + staleness sweeps.
 *
 * Origin: exploit-deviation project Phase 6 Commit 7; architecture §8.1.
 */
const migrateV17 = (db) => {
  if (!db.objectStoreNames.contains(VILLAIN_ASSUMPTIONS_STORE_NAME)) {
    const store = db.createObjectStore(VILLAIN_ASSUMPTIONS_STORE_NAME, {
      keyPath: ['villainId', 'id'],
    });
    store.createIndex('villainId', 'villainId', { unique: false });
    store.createIndex('status', 'status', { unique: false });
    store.createIndex('lastUpdated', 'evidence.lastUpdated', { unique: false });
    store.createIndex('schemaVersion', 'schemaVersion', { unique: false });
    log('VillainAssumptions object store created (v17)');
  }
};

/**
 * v18: Create subscription store for the Monetization & PMF entitlement system.
 * Single record per install with keyPath 'userId' (no autoIncrement, no indexes).
 *
 * MPMF G5-B1 (2026-04-25). Architecture: entitlement-architecture.md §IDB.
 * WRITERS: 5 writers per WRITERS.md §subscription store.
 * I-WR-1: registry CI-grep enforces all writes go through W-SUB-* entry points.
 *
 * Seeds a single guest record with `tier: 'free', cohort: 'standard'` so
 * subsequent reads always succeed (no "create-on-first-read" branch needed
 * in writers). Idempotent: existence-check before create.
 */
const migrateV18 = (db, transaction) => {
  if (!db.objectStoreNames.contains(SUBSCRIPTION_STORE_NAME)) {
    db.createObjectStore(SUBSCRIPTION_STORE_NAME, { keyPath: 'userId' });
    log('Subscription object store created (v18)');

    // Seed guest user with default free-tier record. Use the in-flight upgrade
    // transaction so seed lands atomically with store creation.
    const seedRecord = {
      userId: GUEST_USER_ID,
      tier: 'free',
      cohort: 'standard',
      acquiredAt: null,
      billingCycle: null,
      nextBillAt: null,
      nextBillAmount: null,
      paymentMethod: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      cancellation: { isCancelled: false, canceledAt: null, accessThrough: null },
      pendingPlanChange: { isActive: false, targetTier: null, effectiveDate: null },
      cardDecline: { isActive: false, declinedAt: null, graceUntil: null },
      overrides: { devForceTier: null },
      schemaVersion: '1.0.0',
    };

    try {
      const subscriptionStore = transaction.objectStore(SUBSCRIPTION_STORE_NAME);
      subscriptionStore.add(seedRecord);
      log('Subscription seed record added for guest user');
    } catch (e) {
      logError('v18 seed failed:', e);
    }
  }
};

/**
 * v19: Create the 4 main Exploit Anchor Library stores + 1 drafts sidecar store.
 *
 * Per `docs/projects/exploit-anchor-library/schema-delta.md` §5.1
 * + `docs/projects/exploit-anchor-library/WRITERS.md` (13 writers across 4 stores)
 * + `docs/design/surfaces/hand-replay-observation-capture.md` §State (drafts sidecar
 *   keypath `draft:<handId>` per `useAnchorObservationDraft` hook spec).
 *
 * Per `docs/projects/exploit-anchor-library/gate4-p3-decisions.md` §2 dynamic-target
 * pattern: if MPMF had taken v18 (which it did), EAL targets v19.
 *
 * **Additive only.** No modifications to v18 or earlier stores. Idempotent
 * (existence-check before each create) — safe under partial-failure replay.
 *
 * Seeds the `perceptionPrimitives` store with the 8 starter primitives from
 * `docs/projects/exploit-anchor-library/perception-primitives.md` via the
 * authored constant in `src/utils/anchorLibrary/perceptionPrimitiveSeed.js`.
 * EAL-G5-SI markdown-IDB idempotency test verifies the seed matches markdown content.
 *
 * EAL Phase 6 Stream D B3 — Session 11 (2026-04-25).
 */
const migrateV19 = (db, transaction) => {
  log('Upgrading to v19: Exploit Anchor Library stores');
  const migrationTimestamp = new Date().toISOString();

  // ─── exploitAnchors ─────────────────────────────────────────────────
  // Schema: ExploitAnchor extends VillainAssumption v1.1; flat keypath `id`
  // (anchors are often style-scoped rather than villain-scoped per Gate 2 Stage D #1).
  if (!db.objectStoreNames.contains(EXPLOIT_ANCHORS_STORE_NAME)) {
    const store = db.createObjectStore(EXPLOIT_ANCHORS_STORE_NAME, { keyPath: 'id' });
    store.createIndex('villainId', 'villainId', { unique: false });
    store.createIndex('archetypeName', 'archetypeName', { unique: false });
    store.createIndex('polarity', 'polarity', { unique: false });
    store.createIndex('tier', 'tier', { unique: false });
    store.createIndex('status', 'status', { unique: false });
    store.createIndex('lastUpdated', 'evidence.lastUpdated', { unique: false });
    store.createIndex('schemaVersion', 'schemaVersion', { unique: false });
    log('exploitAnchors object store created (v19)');
  }

  // ─── anchorObservations ─────────────────────────────────────────────
  // Schema: id format `obs:<handId>:<index>` per W-AO-1 writer.
  if (!db.objectStoreNames.contains(ANCHOR_OBSERVATIONS_STORE_NAME)) {
    const store = db.createObjectStore(ANCHOR_OBSERVATIONS_STORE_NAME, { keyPath: 'id' });
    store.createIndex('handId', 'handId', { unique: false });
    store.createIndex('createdAt', 'createdAt', { unique: false });
    store.createIndex('status', 'status', { unique: false });
    store.createIndex('promotedToCandidateId', 'promotedToCandidateId', { unique: false });
    store.createIndex('origin', 'origin', { unique: false });
    log('anchorObservations object store created (v19)');
  }

  // ─── anchorObservationDrafts (sidecar) ──────────────────────────────
  // Per surface spec: capture-modal draft persistence; keypath `id` with
  // format `draft:<handId>`. Separate store (not keypath-namespaced within
  // anchorObservations) to keep draft cursors out of canonical-observation queries.
  if (!db.objectStoreNames.contains(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME)) {
    const store = db.createObjectStore(ANCHOR_OBSERVATION_DRAFTS_STORE_NAME, { keyPath: 'id' });
    store.createIndex('handId', 'handId', { unique: false });
    store.createIndex('updatedAt', 'updatedAt', { unique: false });
    log('anchorObservationDrafts object store created (v19)');
  }

  // ─── anchorCandidates (Phase 2 — empty at v19) ──────────────────────
  // Per W-AC-1 writer: store created at v19 with zero contents to avoid a
  // trivially-scoped migration when Phase 2 candidate-promotion ships.
  if (!db.objectStoreNames.contains(ANCHOR_CANDIDATES_STORE_NAME)) {
    const store = db.createObjectStore(ANCHOR_CANDIDATES_STORE_NAME, { keyPath: 'id' });
    store.createIndex('status', 'status', { unique: false });
    store.createIndex('ownerPromotedAt', 'ownerPromotedAt', { unique: false });
    store.createIndex('archetypeName', 'draftAnchor.archetypeName', { unique: false });
    log('anchorCandidates object store created (v19)');
  }

  // ─── perceptionPrimitives + seed ─────────────────────────────────────
  // 8 starter primitives per `perception-primitives.md` PP-01..PP-08, all with
  // uniform Beta(1, 1) prior. Tier 2 calibration updates validityScore via
  // W-PP-2 writer post-firing.
  if (!db.objectStoreNames.contains(PERCEPTION_PRIMITIVES_STORE_NAME)) {
    const store = db.createObjectStore(PERCEPTION_PRIMITIVES_STORE_NAME, { keyPath: 'id' });
    store.createIndex('appliesToStyles', 'appliesToStyles', { unique: false, multiEntry: true });
    store.createIndex('lastUpdated', 'validityScore.lastUpdated', { unique: false });
    log('perceptionPrimitives object store created (v19)');

    // Seed via the in-flight upgrade transaction so primitives land atomically
    // with store creation. Idempotent put() handles partial-failure replay.
    try {
      const primitivesStore = transaction.objectStore(PERCEPTION_PRIMITIVES_STORE_NAME);
      seedPerceptionPrimitives(primitivesStore, migrationTimestamp);
      log('perceptionPrimitives seeded with 8 starter records');
    } catch (e) {
      logError('v19 perception-primitive seed failed:', e);
    }
  }
};

/**
 * v20: Printable Refresher stores — additive only, zero v19 mutation.
 *
 * Adds:
 *   - userRefresherConfig (singleton; keypath `id`; seeded with default singleton at create)
 *   - printBatches (UUID-keyed; keypath `batchId`; index `printedAt`; empty at create)
 *
 * Per `docs/projects/printable-refresher/idb-migration.md` v1.0:
 *   - Existence-check before create (idempotent on repeat upgrade).
 *   - Seed singleton at migration time so writers don't need a "create on first read" branch.
 *   - printBatches NOT seeded — append-only per I-WR-5; first record on first owner print.
 *
 * Dynamic version target: spec called for `max(currentVersion + 1, 18)`. EAL Phase 6 Stream D
 * shipped v19 first; PRF computes max(19+1, 18) = 20. The dynamic-target rule resolves at
 * compile time now that EAL has claimed v19, so v20 is statically chosen here.
 */
const migrateV20 = (db, transaction) => {
  log('Upgrading to v20: Printable Refresher stores (userRefresherConfig + printBatches)');

  // ─── userRefresherConfig (singleton) ─────────────────────────────────
  if (!db.objectStoreNames.contains(USER_REFRESHER_CONFIG_STORE_NAME)) {
    db.createObjectStore(USER_REFRESHER_CONFIG_STORE_NAME, {
      keyPath: 'id',
      autoIncrement: false,
    });
    log('userRefresherConfig object store created (v20)');

    // Seed default singleton via the in-flight upgrade transaction so it lands
    // atomically with store creation. Idempotent put() handles partial-failure
    // replay if the upgrade is interrupted and retried.
    try {
      const configStore = transaction.objectStore(USER_REFRESHER_CONFIG_STORE_NAME);
      configStore.put(buildDefaultRefresherConfig());
      log('userRefresherConfig seeded with default singleton');
    } catch (e) {
      logError('v20 userRefresherConfig seed failed:', e);
    }
  }

  // ─── printBatches (append-only, UUID-keyed) ──────────────────────────
  if (!db.objectStoreNames.contains(PRINT_BATCHES_STORE_NAME)) {
    const batchStore = db.createObjectStore(PRINT_BATCHES_STORE_NAME, {
      keyPath: 'batchId',
      autoIncrement: false,
    });
    // printedAt index supports `selectStaleCards` most-recent-batch-per-card lookup
    // per `docs/projects/printable-refresher/selectors.md`.
    batchStore.createIndex('printedAt', 'printedAt', { unique: false });
    log('printBatches object store created (v20) with printedAt index');
    // No seeding — empty until first owner print confirmation (W-URC-3 sole writer).
  }
};

/**
 * v21: Create telemetryConsent object store + seed guest record.
 *
 * MPMF G5-B2 (2026-04-26) — Telemetry Foundation.
 *
 * Additive-only schema migration. Creates a dedicated singleton-per-user
 * store keyed by `userId`, no autoIncrement, no indexes. Mirrors the v18
 * subscription store pattern. Avoids a write-race that would have existed
 * if telemetry consent had been nested under the settings record (since
 * useSettingsPersistence overwrites the whole settings record on every
 * non-telemetry settings change).
 *
 * The seeded guest record has `firstLaunchSeenAt: null` which causes the
 * FirstLaunchTelemetryPanel to render exactly once on next boot for new
 * installs and existing users who haven't seen it. After dismissal,
 * MPMF-AP-13 enforces no-re-fire via the reducer.
 *
 * Idempotent via existence check before create.
 */
const migrateV21 = (db, transaction) => {
  log('Upgrading to v21: telemetryConsent store + guest seed');

  if (!db.objectStoreNames.contains(TELEMETRY_CONSENT_STORE_NAME)) {
    db.createObjectStore(TELEMETRY_CONSENT_STORE_NAME, {
      keyPath: 'userId',
      autoIncrement: false,
    });
    log('telemetryConsent object store created (v21)');

    // Seed the guest record. Mirrors v18 subscription seed pattern: lands
    // atomically with the create inside the upgrade transaction.
    try {
      const store = transaction.objectStore(TELEMETRY_CONSENT_STORE_NAME);
      store.put({
        userId: GUEST_USER_ID,
        firstLaunchSeenAt: null,
        categories: {
          usage: true,
          session_replay: true,
          error_tracking: true,
          feature_flags: true,
        },
        schemaVersion: '1.0.0',
      });
      log('telemetryConsent guest record seeded');
    } catch (e) {
      logError('v21 telemetryConsent seed failed:', e);
    }
  }
};

/** v13: Normalize seatActions strings to arrays in-place (one-time, replaces per-load normalization) */
const migrateV13 = (db, transaction) => {
  log('Upgrading to v13: Normalizing seatActions strings to arrays');

  if (!db.objectStoreNames.contains(STORE_NAME)) return;

  const handsStore = transaction.objectStore(STORE_NAME);
  const cursor = handsStore.openCursor();

  cursor.onsuccess = (e) => {
    const c = e.target.result;
    if (c) {
      const hand = c.value;
      const sa = hand.seatActions;
      if (sa && typeof sa === 'object') {
        let changed = false;
        for (const street of Object.keys(sa)) {
          const streetActions = sa[street];
          if (!streetActions || typeof streetActions !== 'object') continue;
          for (const seat of Object.keys(streetActions)) {
            const val = streetActions[seat];
            if (typeof val === 'string') {
              streetActions[seat] = val ? [val] : [];
              changed = true;
            } else if (!Array.isArray(val)) {
              streetActions[seat] = [];
              changed = true;
            }
          }
        }
        if (changed) {
          c.update(hand);
        }
      }
      c.continue();
    } else {
      log('v13 migration: seatActions normalization complete');
    }
  };

  cursor.onerror = (e) => {
    logError('v13 migration failed:', e.target.error);
  };
};

// =============================================================================
// MIGRATION ORCHESTRATOR
// =============================================================================

/**
 * Run all migrations needed to upgrade from oldVersion to current.
 * Called within the implicit onupgradeneeded transaction.
 */
export const runMigrations = (db, transaction, oldVersion) => {
  // v1: hands store
  if (oldVersion < 1) migrateV1(db);

  // v2: sessions + activeSession stores
  if (oldVersion < 2) migrateV2(db);

  // v3: venue, gameType, rebuyTransactions (data migration, skip fresh install)
  if (oldVersion < 3 && oldVersion > 0) migrateV3(transaction);

  // v4: cashOut field (data migration, skip fresh install)
  if (oldVersion < 4 && oldVersion > 0) migrateV4(transaction);

  // v5: players store
  if (oldVersion < 5) migrateV5(db);

  // v6: settings store
  if (oldVersion < 6) migrateV6(db);

  // v7: userId indexes + data migration (hybrid)
  if (oldVersion < 7) migrateV7(db, transaction, oldVersion);

  // v8: actionSequence (data migration, skip fresh install)
  if (oldVersion < 8 && oldVersion > 0) migrateV8(db, transaction);

  // v9: rangeProfiles store
  if (oldVersion < 9) migrateV9(db);

  // v10: exploitBriefings on players (data migration, skip fresh install)
  if (oldVersion < 10 && oldVersion > 0) migrateV10(transaction);

  // v11: tournaments store
  if (oldVersion < 11) migrateV11(db);

  // v12: source/tableId indexes
  if (oldVersion < 12) migrateV12(db, transaction);

  // v13: normalize seatActions strings → arrays (data migration, skip fresh install)
  if (oldVersion < 13 && oldVersion > 0) migrateV13(db, transaction);

  // v14: playerDrafts store (additive, PEO-1)
  if (oldVersion < 14) migrateV14(db);

  // v15: preflopDrills store (additive, Preflop Drills feature)
  if (oldVersion < 15) migrateV15(db);

  // v16: postflopDrills store (additive, Postflop Drills feature)
  if (oldVersion < 16) migrateV16(db);

  if (oldVersion < 17) migrateV17(db);

  // v18: subscription store (additive, MPMF Gate 5 B1 entitlement foundation)
  if (oldVersion < 18) migrateV18(db, transaction);

  // v19: 4 EAL stores + drafts sidecar (additive, EAL Phase 6 Stream D B3)
  if (oldVersion < 19) migrateV19(db, transaction);

  // v20: 2 PRF stores (userRefresherConfig singleton + printBatches with printedAt index)
  // (additive, PRF-G5-MIG; spec dynamic-target max(currentVersion+1, 18) resolved to 20
  // because EAL claimed v19 first)
  if (oldVersion < 20) migrateV20(db, transaction);

  // v21: telemetry sub-state on settings records (additive, MPMF G5-B2 Telemetry Foundation;
  // dynamic-target max(currentVersion+1, 21) resolved to 21)
  if (oldVersion < 21) migrateV21(db, transaction);
};

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
  log,
  logError,
} from './database';

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
};

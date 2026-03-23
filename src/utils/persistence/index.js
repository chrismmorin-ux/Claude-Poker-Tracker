/**
 * persistence/index.js - Central export for persistence layer
 *
 * Re-exports all persistence functions from domain-specific modules.
 * This file replaces the original persistence.js for backward compatibility.
 *
 * Module structure:
 *   - database.js: DB initialization, constants, logging
 *   - handsStorage.js: Hand CRUD operations
 *   - sessionsStorage.js: Session CRUD operations
 *   - playersStorage.js: Player CRUD operations
 */

import { logger } from '../errorHandler';

// Database initialization and constants
export { initDB, GUEST_USER_ID } from './database';

/**
 * Creates a persistence logger for a module
 * @param {string} moduleName - Module name for log prefix
 * @returns {{ log: Function, logError: Function }}
 */
export const createPersistenceLogger = (moduleName) => ({
  log: (...args) => logger.debug(moduleName, ...args),
  logError: (error) => logger.error(moduleName, error),
});

// Hand CRUD operations
export {
  saveHand,
  loadLatestHand,
  loadHandById,
  getAllHands,
  getHandsBySessionId,
  deleteHand,
  clearAllHands,
  getHandCount,
  handExists,
  saveOnlineHand,
  getHandsBySource,
} from './handsStorage';

// Session CRUD operations
export {
  createSession,
  endSession,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  getAllSessions,
  getSessionById,
  deleteSession,
  updateSession,
  getSessionHandCount,
  createSessionAtomic,
  endSessionAtomic,
  getOrCreateOnlineSession,
} from './sessionsStorage';

// Player CRUD operations
export {
  createPlayer,
  getAllPlayers,
  getPlayerById,
  updatePlayer,
  deletePlayer,
  getPlayerByName,
} from './playersStorage';

// Settings CRUD operations
export {
  getSettings,
  saveSettings,
  updateSettings,
  resetSettings,
  clearSettings,
} from './settingsStorage';

// Range Profile CRUD operations
export {
  saveRangeProfile,
  getRangeProfile,
  deleteRangeProfile,
  getAllRangeProfiles,
} from './rangeProfilesStorage';

// Tournament CRUD operations
export {
  createTournament,
  getTournamentBySessionId,
  updateTournament,
  deleteTournament,
  getAllTournaments,
} from './tournamentsStorage';

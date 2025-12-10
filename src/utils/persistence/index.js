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

// Database initialization and constants
export { initDB } from './database';

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

/**
 * exportUtils.js - Data export and import utilities
 *
 * Provides functions to export all application data to JSON
 * and import data from JSON backups.
 */

import {
  getAllHands,
  getAllSessions,
  getAllPlayers,
  clearAllHands,
  saveHand,
  createSession,
  createPlayer,
  deleteSession,
  deletePlayer,
} from './persistence';

// Current export version - increment when schema changes
const EXPORT_VERSION = '1.0.0';

/**
 * Export all application data to a JSON object
 *
 * @returns {Promise<Object>} Complete data export with version and timestamp
 */
export const exportAllData = async () => {
  const [hands, sessions, players] = await Promise.all([
    getAllHands(),
    getAllSessions(),
    getAllPlayers(),
  ]);

  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    exportedAtISO: new Date().toISOString(),
    data: {
      hands,
      sessions,
      players,
    },
    counts: {
      hands: hands.length,
      sessions: sessions.length,
      players: players.length,
    },
  };
};

/**
 * Trigger download of data as a JSON file
 *
 * @param {Object} data - Data to download
 * @param {string} filename - Filename for download
 */
export const downloadAsJson = (data, filename) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
};

/**
 * Export all data and trigger download
 *
 * @returns {Promise<void>}
 */
export const downloadBackup = async () => {
  const data = await exportAllData();
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const filename = `poker-tracker-backup-${date}.json`;
  downloadAsJson(data, filename);
};

/**
 * Validate import data structure
 *
 * @param {Object} importData - Data to validate
 * @returns {{ valid: boolean, errors: string[] }} Validation result
 */
export const validateImportData = (importData) => {
  const errors = [];

  // Check top-level structure
  if (!importData || typeof importData !== 'object') {
    return { valid: false, errors: ['Invalid data format: expected an object'] };
  }

  if (!importData.version) {
    errors.push('Missing version field');
  }

  if (!importData.data) {
    errors.push('Missing data field');
  } else {
    // Validate data arrays
    if (!Array.isArray(importData.data.hands)) {
      errors.push('Missing or invalid hands array');
    }
    if (!Array.isArray(importData.data.sessions)) {
      errors.push('Missing or invalid sessions array');
    }
    if (!Array.isArray(importData.data.players)) {
      errors.push('Missing or invalid players array');
    }
  }

  // Validate individual records (basic checks)
  if (importData.data?.hands) {
    importData.data.hands.forEach((hand, index) => {
      if (!hand.timestamp) {
        errors.push(`Hand at index ${index} missing timestamp`);
      }
    });
  }

  if (importData.data?.sessions) {
    importData.data.sessions.forEach((session, index) => {
      if (!session.startTime) {
        errors.push(`Session at index ${index} missing startTime`);
      }
    });
  }

  if (importData.data?.players) {
    importData.data.players.forEach((player, index) => {
      if (!player.name) {
        errors.push(`Player at index ${index} missing name`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Clear all existing data (used before import)
 *
 * @returns {Promise<void>}
 */
export const clearAllData = async () => {
  // Get all existing data
  const [sessions, players] = await Promise.all([
    getAllSessions(),
    getAllPlayers(),
  ]);

  // Delete all hands first
  await clearAllHands();

  // Delete sessions
  for (const session of sessions) {
    if (session.sessionId) {
      await deleteSession(session.sessionId);
    }
  }

  // Delete players
  for (const player of players) {
    if (player.playerId) {
      await deletePlayer(player.playerId);
    }
  }
};

/**
 * Import data from a backup file
 *
 * @param {Object} importData - Validated import data
 * @returns {Promise<{ success: boolean, counts: Object, errors: string[] }>}
 */
export const importAllData = async (importData) => {
  const errors = [];
  const counts = { hands: 0, sessions: 0, players: 0 };

  try {
    // Clear existing data first
    await clearAllData();

    // Import players first (hands may reference them)
    for (const player of importData.data.players || []) {
      try {
        // Remove playerId to let the database assign a new one
        const { playerId, ...playerData } = player;
        await createPlayer(playerData);
        counts.players++;
      } catch (err) {
        errors.push(`Failed to import player "${player.name}": ${err.message}`);
      }
    }

    // Import sessions (hands reference them)
    const sessionIdMap = {}; // Map old sessionId to new sessionId
    for (const session of importData.data.sessions || []) {
      try {
        const { sessionId, ...sessionData } = session;
        const newSessionId = await createSession({
          ...sessionData,
          // Ensure isActive is false for imported sessions
          isActive: false,
        });
        sessionIdMap[sessionId] = newSessionId;
        counts.sessions++;
      } catch (err) {
        errors.push(`Failed to import session: ${err.message}`);
      }
    }

    // Import hands (update sessionId references)
    for (const hand of importData.data.hands || []) {
      try {
        const { handId, sessionId, ...handData } = hand;
        await saveHand({
          ...handData,
          // Map to new sessionId if exists, otherwise null
          sessionId: sessionId ? (sessionIdMap[sessionId] || null) : null,
        });
        counts.hands++;
      } catch (err) {
        errors.push(`Failed to import hand: ${err.message}`);
      }
    }

    return {
      success: errors.length === 0,
      counts,
      errors,
    };
  } catch (err) {
    return {
      success: false,
      counts,
      errors: [...errors, `Import failed: ${err.message}`],
    };
  }
};

/**
 * Read and parse a JSON file from a File input
 *
 * @param {File} file - File object from input element
 * @returns {Promise<Object>} Parsed JSON data
 */
export const readJsonFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        resolve(data);
      } catch (err) {
        reject(new Error('Invalid JSON file'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
};

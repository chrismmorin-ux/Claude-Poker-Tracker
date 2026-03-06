/**
 * parseBlinds.js - Parse gameType string to blind amounts
 */

/**
 * Parse a gameType string like "1/2" or "2/5" into blind values.
 * @param {string} gameType
 * @returns {{ smallBlind: number, bigBlind: number }}
 */
export const parseBlinds = (gameType) => {
  if (!gameType || typeof gameType !== 'string') {
    return { smallBlind: 1, bigBlind: 2 };
  }
  const parts = gameType.split('/');
  if (parts.length !== 2) {
    return { smallBlind: 1, bigBlind: 2 };
  }
  const sb = parseFloat(parts[0]);
  const bb = parseFloat(parts[1]);
  if (!Number.isFinite(sb) || !Number.isFinite(bb) || sb <= 0 || bb <= 0) {
    return { smallBlind: 1, bigBlind: 2 };
  }
  return { smallBlind: sb, bigBlind: bb };
};

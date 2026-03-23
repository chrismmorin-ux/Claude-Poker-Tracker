/**
 * playerNameMap.js - Shared seat-to-name resolution
 *
 * Builds a { [seat]: playerName } lookup from seatPlayers and allPlayers.
 * Eliminates duplicate getPlayerName helpers across views.
 */

/**
 * @param {Object} seatPlayers - { [seat]: playerId }
 * @param {Array} allPlayers - [{ playerId, name, ... }]
 * @returns {Object} { [seat]: string }
 */
/**
 * @param {Object} seatNames - Pre-built { [seat]: name } map
 * @param {number|string} seat
 * @returns {string}
 */
export const getPlayerName = (seatNames, seat) => seatNames[seat] || `Seat ${seat}`;

export const buildSeatNameMap = (seatPlayers, allPlayers) => {
  const names = {};
  const playerMap = {};
  if (allPlayers) {
    for (const p of allPlayers) {
      playerMap[p.playerId] = p.name;
    }
  }
  for (const [seat, playerId] of Object.entries(seatPlayers || {})) {
    names[seat] = playerMap[playerId] || `P${seat}`;
  }
  return names;
};

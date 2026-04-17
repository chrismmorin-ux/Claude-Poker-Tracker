/**
 * statsRecompute.js — Denormalized player-stat recompute from hand history (PEO-1)
 *
 * `handCount` and `stats` live denormalized on the Player record
 * (playersStorage.js:50-51). When a retroactive link (or any backfill)
 * mutates the seat→player mapping on prior hands, this module computes the
 * fresh `handCount` the player now "deserves" by counting hands where any
 * seat in seatPlayers references their playerId.
 *
 * Scope (S1): handCount only. `stats` derivation is intentionally NOT
 * re-run here — that's a heavier pipeline owned by usePlayerTendencies /
 * analysisPipeline. Per plan §Out of Scope, full stats recompute is
 * deferred to a future session.
 *
 * Usage:
 *   const fresh = computePlayerStatsFromHands(playerId, allHands);
 *   await updatePlayer(playerId, { handCount: fresh.handCount }, userId);
 */

/**
 * Count the hands where this player occupied any seat.
 * No side effects. No IDB.
 *
 * @param {number} playerId
 * @param {Array} hands — any hand array; non-session-scoped (player's lifetime).
 * @returns {{ handCount: number }}
 */
export const computePlayerStatsFromHands = (playerId, hands) => {
  if (typeof playerId !== 'number') return { handCount: 0 };
  if (!Array.isArray(hands) || hands.length === 0) return { handCount: 0 };

  let count = 0;
  for (const hand of hands) {
    const seatPlayers = hand?.seatPlayers;
    if (!seatPlayers || typeof seatPlayers !== 'object') continue;
    // A player occupies at most one seat per hand, but defensively tolerate
    // multi-seat maps (shouldn't happen but doesn't change the count).
    for (const value of Object.values(seatPlayers)) {
      if (value === playerId) {
        count += 1;
        break;
      }
    }
  }

  return { handCount: count };
};

/**
 * Compute fresh stats for every playerId that appears in the given hands.
 * Useful when a retro-link may have affected multiple players simultaneously
 * (rare, but possible in future batch flows).
 *
 * @param {Array} hands
 * @returns {Map<number, {handCount: number}>}
 */
export const computeAllPlayerStatsFromHands = (hands) => {
  const result = new Map();
  if (!Array.isArray(hands)) return result;

  for (const hand of hands) {
    const seatPlayers = hand?.seatPlayers;
    if (!seatPlayers || typeof seatPlayers !== 'object') continue;
    const seenThisHand = new Set();
    for (const value of Object.values(seatPlayers)) {
      if (typeof value !== 'number') continue;
      if (seenThisHand.has(value)) continue;
      seenThisHand.add(value);
      const prev = result.get(value);
      if (prev) {
        prev.handCount += 1;
      } else {
        result.set(value, { handCount: 1 });
      }
    }
  }
  return result;
};

/**
 * handLinking.js — Pure retroactive seat↔player linking (PEO-1)
 *
 * Produces a plan (list of handIds to update) from an in-memory hands array.
 * No IDB, no reducer, no side effects — callable from anywhere.
 *
 * Invariants enforced here:
 *   I-PEO-2 Session scope: only hands matching sessionId are considered.
 *   I-PEO-3 Idempotence: a hand already mapped to (seat → playerId) is a no-op.
 *   I-PEO-4 Undo captures: the returned undoToken carries the exact handIds
 *           captured at link time, so subsequent changes to the seat don't
 *           confuse undo.
 *
 * Boundary rule (see plan §D3):
 *   Walk hands of the target session in reverse-chronological order, starting
 *   from the newest. For each hand:
 *     - If seatPlayers[seat] === playerId → already linked; record as no-op
 *       (does not appear in undo handIds), continue walking.
 *     - If seatPlayers[seat] is missing / null / undefined → link this hand,
 *       continue walking.
 *     - If seatPlayers[seat] is a DIFFERENT playerId → STOP. Earlier hands
 *       belonged to somebody else; never backfill past a different player.
 *
 *   The "different playerId" stop condition prevents stealing history from
 *   another player who occupied this seat earlier in the session.
 */

// Deterministic-ish short token; collision risk is benign (used only for
// client-side undo lifecycle, never persisted as an ID).
const makeUndoToken = (seat, playerId) =>
  `retro-${seat}-${playerId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Plan retroactive seat→player linking.
 *
 * @param {Array} hands           all hands available (any sessions, any order).
 * @param {number} seat           target seat (1-indexed).
 * @param {number} playerId       player being assigned.
 * @param {number|null} sessionId current session id; hands outside this session are ignored.
 * @returns {{ handIds: number[], undoToken: string, skipped: number }}
 *   handIds  — hands that would be modified (freshly set or overwritten from null).
 *   undoToken — opaque string; pass to buildUnlinkPlan to revert exactly these hands.
 *   skipped  — count of in-session hands already bearing this (seat, playerId) pair.
 */
export const linkPlayerToPriorSeatHands = (hands, seat, playerId, sessionId) => {
  if (!Array.isArray(hands) || hands.length === 0) {
    return { handIds: [], undoToken: makeUndoToken(seat, playerId), skipped: 0 };
  }
  if (sessionId === null || sessionId === undefined) {
    return { handIds: [], undoToken: makeUndoToken(seat, playerId), skipped: 0 };
  }
  if (typeof seat !== 'number' || typeof playerId !== 'number') {
    return { handIds: [], undoToken: makeUndoToken(seat, playerId), skipped: 0 };
  }

  // Filter to the target session, sort by timestamp descending (newest first).
  const sessionHands = hands
    .filter(h => h && h.sessionId === sessionId && typeof h.handId === 'number')
    .slice()
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  const handIds = [];
  let skipped = 0;

  for (const hand of sessionHands) {
    const currentAssignment = hand.seatPlayers?.[seat];
    if (currentAssignment === playerId) {
      // Already linked; idempotent no-op for this hand. Continue walking —
      // there may be earlier unlinked hands before any boundary.
      skipped += 1;
      continue;
    }
    if (currentAssignment !== undefined && currentAssignment !== null) {
      // Hit a different player's assignment — stop. Do not steal history.
      break;
    }
    // Seat is vacant or null on this hand — link it.
    handIds.push(hand.handId);
  }

  return {
    handIds,
    undoToken: makeUndoToken(seat, playerId),
    skipped,
  };
};

/**
 * Produce an unlink plan for a previously executed link.
 *
 * @param {{handIds: number[]}} linkResult the object returned by linkPlayerToPriorSeatHands.
 * @param {number} seat
 * @param {number} playerId  the player that WAS linked (so we only clear hands still carrying them).
 * @param {Array} hands       current hands — used to avoid clearing hands where
 *                            the seat has since been reassigned to someone else.
 * @returns {Array<{handId: number, seat: number, playerId: null}>} batch update payload.
 */
export const buildUnlinkPlan = (linkResult, seat, playerId, hands = []) => {
  if (!linkResult || !Array.isArray(linkResult.handIds)) return [];
  const handById = new Map();
  for (const h of hands) {
    if (h && typeof h.handId === 'number') handById.set(h.handId, h);
  }
  const updates = [];
  for (const handId of linkResult.handIds) {
    const h = handById.get(handId);
    // If hand is no longer in state, still emit the clear (best-effort revert).
    if (!h) {
      updates.push({ handId, seat, playerId: null });
      continue;
    }
    // Only clear if the seat still maps to the player we originally linked.
    // If something else wrote over it, leave it alone.
    if (h.seatPlayers?.[seat] === playerId) {
      updates.push({ handId, seat, playerId: null });
    }
  }
  return updates;
};

/**
 * Produce the batch-update payload for the link plan. Apply via
 * batchUpdateSeatPlayers in one IDB transaction.
 *
 * @param {{handIds: number[]}} linkResult
 * @param {number} seat
 * @param {number} playerId
 * @returns {Array<{handId: number, seat: number, playerId: number}>}
 */
export const buildLinkPayload = (linkResult, seat, playerId) => {
  if (!linkResult || !Array.isArray(linkResult.handIds)) return [];
  return linkResult.handIds.map(handId => ({ handId, seat, playerId }));
};

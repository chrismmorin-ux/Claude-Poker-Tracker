/**
 * useRetroactiveLinking.js — Seat↔player retro-link flow (PEO-1)
 *
 * When a player is assigned to a seat, this hook:
 *   1. Finds all prior-session hands where the seat was anonymous/null.
 *   2. Batches their seatPlayers updates in ONE IDB transaction.
 *   3. Recomputes the player's handCount from the updated hands.
 *   4. Dispatches RETROACTIVELY_LINK_PLAYER to sync in-memory state.
 *   5. Returns an undo token + tiny undo closure for the UI toast.
 *
 * The hook is *orthogonal* to PlayerContext's assignPlayerToSeat — that
 * handles the current-hand seat mapping; this one handles the historical
 * backfill. Call both when a player is picked for a seat.
 *
 * Invariants enforced:
 *   - I-PEO-2 (session-scoped via the pure handLinking fn)
 *   - I-PEO-3 (idempotent — skipped hands counted but not re-linked)
 *   - I-PEO-4 (undo token carries exact handIds captured at link time)
 *
 * External event: fires a `hands-updated` CustomEvent on `window` so
 * replay/analysis views can re-derive without a full reload.
 */

import { useCallback } from 'react';
import {
  getAllHands,
  batchUpdateSeatPlayers,
  updatePlayer,
  linkPlayerToPriorSeatHands,
  buildLinkPayload,
  buildUnlinkPlan,
  computePlayerStatsFromHands,
  GUEST_USER_ID,
} from '../utils/persistence';
import { PLAYER_ACTIONS } from '../constants/playerConstants';
import { AppError, ERROR_CODES } from '../utils/errorHandler';

const HANDS_UPDATED_EVENT = 'hands-updated';

const emitHandsUpdated = (detail) => {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(HANDS_UPDATED_EVENT, { detail }));
    }
  } catch {
    // Non-fatal; event is an optimization for live re-derivation.
  }
};

/**
 * @param {Function} dispatchPlayer — PlayerContext dispatcher
 * @param {Array} allPlayers — current in-memory players list (for handCount delta)
 * @param {string} userId
 * @returns {{
 *   linkPlayerToPriorHandsInSession: (seat: number, playerId: number, sessionId: number | null) => Promise<LinkResult>,
 *   undoRetroactiveLink: (token: LinkResult) => Promise<void>
 * }}
 *
 * LinkResult: { handIds, undoToken, skipped, playerId, seat, sessionId, previousHandCount, newHandCount }
 */
export const useRetroactiveLinking = (dispatchPlayer, allPlayers, userId = GUEST_USER_ID) => {
  const linkPlayerToPriorHandsInSession = useCallback(
    async (seat, playerId, sessionId) => {
      if (typeof seat !== 'number' || typeof playerId !== 'number') {
        throw new AppError(
          ERROR_CODES.INVALID_INPUT || 'INVALID_INPUT',
          'linkPlayerToPriorHandsInSession requires numeric seat + playerId',
        );
      }

      // Sessionless context (e.g. practice mode, pre-session) → nothing to link.
      if (sessionId === null || sessionId === undefined) {
        return {
          handIds: [],
          undoToken: `retro-noop-${Date.now()}`,
          skipped: 0,
          playerId,
          seat,
          sessionId: null,
          previousHandCount: null,
          newHandCount: null,
        };
      }

      const hands = await getAllHands(userId);
      const plan = linkPlayerToPriorSeatHands(hands, seat, playerId, sessionId);

      if (plan.handIds.length === 0) {
        // Nothing to do. Return the plan envelope (caller may still toast skipped>0).
        return {
          ...plan,
          playerId,
          seat,
          sessionId,
          previousHandCount: null,
          newHandCount: null,
        };
      }

      const payload = buildLinkPayload(plan, seat, playerId);
      await batchUpdateSeatPlayers(payload);

      // Recompute handCount from the NOW-updated hands list. We re-fetch
      // rather than mutate in memory — this pins freshness on the DB.
      const freshHands = await getAllHands(userId);
      const { handCount: newHandCount } = computePlayerStatsFromHands(playerId, freshHands);
      const prev = allPlayers.find(p => p.playerId === playerId);
      const previousHandCount = prev?.handCount ?? 0;

      await updatePlayer(playerId, { handCount: newHandCount, lastSeenAt: Date.now() }, userId);

      dispatchPlayer({
        type: PLAYER_ACTIONS.RETROACTIVELY_LINK_PLAYER,
        payload: { playerId, newHandCount },
      });

      emitHandsUpdated({ type: 'retro-link', playerId, seat, sessionId, handIds: plan.handIds });

      return {
        ...plan,
        playerId,
        seat,
        sessionId,
        previousHandCount,
        newHandCount,
      };
    },
    [dispatchPlayer, allPlayers, userId],
  );

  const undoRetroactiveLink = useCallback(
    async (linkResult) => {
      if (!linkResult || !Array.isArray(linkResult.handIds) || linkResult.handIds.length === 0) {
        return;
      }
      const { playerId, seat, previousHandCount } = linkResult;

      // Re-fetch current hands so the unlink plan respects any since-writes
      // (e.g. user reassigned the seat to someone else before hitting Undo).
      const hands = await getAllHands(userId);
      const clearPayload = buildUnlinkPlan(linkResult, seat, playerId, hands);
      if (clearPayload.length === 0) return;

      await batchUpdateSeatPlayers(clearPayload);

      // Restore handCount to the captured previous value, not a recompute —
      // because another hand may have legitimately added a hand for this
      // player in the meantime. Delta-based revert is safer.
      const restoreHandCount = Math.max(
        0,
        (previousHandCount ?? 0) - (linkResult.handIds.length - clearPayload.length),
      );
      await updatePlayer(playerId, { handCount: restoreHandCount }, userId);

      dispatchPlayer({
        type: PLAYER_ACTIONS.UNDO_RETROACTIVE_LINK,
        payload: { playerId, newHandCount: restoreHandCount },
      });

      emitHandsUpdated({ type: 'retro-unlink', playerId, seat, handIds: linkResult.handIds });
    },
    [dispatchPlayer, userId],
  );

  return { linkPlayerToPriorHandsInSession, undoRetroactiveLink };
};

export { HANDS_UPDATED_EVENT };

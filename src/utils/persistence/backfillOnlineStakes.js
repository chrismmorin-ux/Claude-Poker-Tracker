/**
 * backfillOnlineStakes.js — one-time WS-260 re-key of legacy online sessions.
 *
 * Before WS-260, createOnlineSession hardcoded gameType 'NL Holdem', collapsing every
 * online stake into one pool-baseline segment (FIND-037). The captured hands, however,
 * persist the real table blinds in ignitionMeta.blinds — so this pass derives each
 * legacy session's true stakes from its own stored hands and re-labels the session.
 *
 * Non-destructive and idempotent: only sessions with source 'ignition' and no `stakes`
 * field are touched; a session with no captured blinds in any hand is left as-is (it
 * stays in the legacy segment, which falls back to the founder estimate per pool
 * doctrine). Safe to run on every app start — a second run finds nothing to do.
 *
 * Founder decision (SPR-147): one-time re-key over fresh-start, so historical online
 * hands immediately count toward the correct per-stake baselines.
 */

import {
  readTx,
  updateTx,
  STORE_NAME,
  SESSIONS_STORE_NAME,
  GUEST_USER_ID,
  log,
  logError,
} from './database';
import { normalizeStakes, stakesLabel } from './sessionsStorage';

/**
 * Derive a session's stakes from its hands' captured blinds — majority wins, so a
 * stray partial capture can't mislabel the table.
 * @param {Object[]} hands - Hand records (may carry ignitionMeta.blinds).
 * @returns {{sb: number, bb: number}|null} majority stakes, or null if none captured.
 */
export const deriveStakesFromHands = (hands) => {
  const counts = new Map(); // label → { stakes, count }
  for (const hand of hands || []) {
    const stakes = normalizeStakes(hand?.ignitionMeta?.blinds);
    if (!stakes) continue;
    const key = stakesLabel(stakes);
    const entry = counts.get(key) || { stakes, count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  let best = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  return best ? best.stakes : null;
};

/**
 * Re-key this user's legacy online sessions from their stored hands' blinds.
 * @param {string} userId - Resolved auth userId (never assume 'guest' for a signed-in user).
 * @returns {Promise<{scanned: number, updated: number, error?: string}>}
 */
export const backfillOnlineStakes = async (userId = GUEST_USER_ID) => {
  try {
    const sessions = await readTx(SESSIONS_STORE_NAME, (store) => store.index('userId').getAll(userId));
    const targets = (sessions || []).filter((s) => s && s.source === 'ignition' && !s.stakes);
    let updated = 0;

    for (const session of targets) {
      const hands = await readTx(STORE_NAME, (store) => store.index('sessionId').getAll(session.sessionId));
      const stakes = deriveStakesFromHands(hands);
      if (!stakes) continue;

      const written = await updateTx(SESSIONS_STORE_NAME, session.sessionId, (record) => {
        // Re-check inside the tx — another writer may have healed it meanwhile.
        if (!record || record.stakes) return undefined;
        return { ...record, stakes, gameType: stakesLabel(stakes) };
      });
      if (written) {
        updated += 1;
        log(`Backfilled stakes on online session ${session.sessionId} → ${stakesLabel(stakes)}`);
      }
    }

    if (targets.length > 0) {
      log(`backfillOnlineStakes: ${updated}/${targets.length} legacy online session(s) re-keyed for ${userId}`);
    }
    return { scanned: targets.length, updated };
  } catch (error) {
    logError('Error in backfillOnlineStakes:', error);
    return { scanned: 0, updated: 0, error: error?.message };
  }
};

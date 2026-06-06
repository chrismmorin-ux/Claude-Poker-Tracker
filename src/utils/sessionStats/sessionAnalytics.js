/**
 * sessionAnalytics.js — pure derivations over session records for the
 * Sessions view Insights band (Phase 2 — Sessions View Improvement, 2026-06-06).
 *
 * No persistence, no React. Every function takes a sessions array and returns
 * plain data. P&L is computed identically to SessionsView.calculateTotalBankroll
 * and SessionCard: cashOut − buyIn − rebuys − tip, so the band, the rows, and
 * the (folded-in) lifetime bankroll never disagree.
 *
 * A session is "completed" (and therefore counts toward money/rate metrics) when
 * it has an endTime and a non-null cashOut. In-progress and active sessions are
 * excluded from money math but may still be counted in totals where noted.
 */

import { calculateTotalRebuy } from '../displayUtils';

/**
 * Whether a session is completed (has a realized result).
 * @param {Object} session
 * @returns {boolean}
 */
export const isCompletedSession = (session) =>
  !!session &&
  !!session.endTime &&
  session.cashOut !== null &&
  session.cashOut !== undefined;

/**
 * Realized profit/loss for a completed session, else null.
 * @param {Object} session
 * @returns {number|null}
 */
export const computeSessionPnl = (session) => {
  if (!isCompletedSession(session)) return null;
  const buyIn = session.buyIn || 0;
  const rebuys = calculateTotalRebuy(session.rebuyTransactions);
  const tip = session.tipAmount || 0;
  return session.cashOut - buyIn - rebuys - tip;
};

/**
 * Duration of a session in milliseconds (0 if missing/negative).
 * Completed sessions only — uses endTime − startTime.
 * @param {Object} session
 * @returns {number}
 */
export const computeSessionDurationMs = (session) => {
  if (!session || !session.startTime || !session.endTime) return 0;
  return Math.max(0, session.endTime - session.startTime);
};

const MS_PER_HOUR = 3600000;

/**
 * Aggregate summary over a sessions list. Money/rate metrics consider completed
 * sessions only; totalSessions counts everything passed in.
 *
 * @param {Array<Object>} sessions
 * @returns {{
 *   totalSessions:number, completedCount:number, winningCount:number,
 *   losingCount:number, breakEvenCount:number, winRate:number|null,
 *   totalPnl:number, totalHands:number, totalDurationMs:number,
 *   hourlyRate:number|null, perSessionAvg:number|null, avgDurationMs:number|null,
 *   best:{session:Object, pnl:number}|null, worst:{session:Object, pnl:number}|null
 * }}
 */
export const computeSummary = (sessions = []) => {
  const list = Array.isArray(sessions) ? sessions : [];
  const completed = list.filter(isCompletedSession);

  let totalPnl = 0;
  let totalDurationMs = 0;
  let totalHands = 0;
  let winningCount = 0;
  let losingCount = 0;
  let breakEvenCount = 0;
  let best = null;
  let worst = null;

  for (const session of completed) {
    const pnl = computeSessionPnl(session);
    totalPnl += pnl;
    totalDurationMs += computeSessionDurationMs(session);
    totalHands += session.handCount || 0;

    if (pnl > 0) winningCount += 1;
    else if (pnl < 0) losingCount += 1;
    else breakEvenCount += 1;

    if (!best || pnl > best.pnl) best = { session, pnl };
    if (!worst || pnl < worst.pnl) worst = { session, pnl };
  }

  const totalHours = totalDurationMs / MS_PER_HOUR;

  return {
    totalSessions: list.length,
    completedCount: completed.length,
    winningCount,
    losingCount,
    breakEvenCount,
    winRate: completed.length > 0 ? winningCount / completed.length : null,
    totalPnl,
    totalHands,
    totalDurationMs,
    hourlyRate: totalHours > 0 ? totalPnl / totalHours : null,
    perSessionAvg: completed.length > 0 ? totalPnl / completed.length : null,
    avgDurationMs: completed.length > 0 ? totalDurationMs / completed.length : null,
    best,
    worst,
  };
};

/**
 * Group completed sessions by a key extractor and aggregate per group.
 * Sorted by total P&L descending. Used for by-stake and by-venue breakdowns.
 *
 * @param {Array<Object>} sessions
 * @param {(s:Object)=>string} keyFn
 * @param {string} [fallbackKey='Unspecified']
 * @returns {Array<{key:string, count:number, pnl:number, durationMs:number,
 *   hands:number, hourlyRate:number|null}>}
 */
export const groupBy = (sessions = [], keyFn, fallbackKey = 'Unspecified') => {
  const list = Array.isArray(sessions) ? sessions : [];
  const groups = new Map();

  for (const session of list) {
    if (!isCompletedSession(session)) continue;
    const rawKey = keyFn(session);
    const key = rawKey === null || rawKey === undefined || rawKey === '' ? fallbackKey : rawKey;
    const g = groups.get(key) || { key, count: 0, pnl: 0, durationMs: 0, hands: 0 };
    g.count += 1;
    g.pnl += computeSessionPnl(session);
    g.durationMs += computeSessionDurationMs(session);
    g.hands += session.handCount || 0;
    groups.set(key, g);
  }

  return Array.from(groups.values())
    .map((g) => ({
      ...g,
      hourlyRate: g.durationMs > 0 ? g.pnl / (g.durationMs / MS_PER_HOUR) : null,
    }))
    .sort((a, b) => b.pnl - a.pnl);
};

/**
 * Breakdown by stake (gameType label).
 * @param {Array<Object>} sessions
 */
export const groupByStake = (sessions = []) =>
  groupBy(sessions, (s) => s.gameType, 'Unspecified');

/**
 * Breakdown by venue.
 * @param {Array<Object>} sessions
 */
export const groupByVenue = (sessions = []) =>
  groupBy(sessions, (s) => s.venue, 'No venue');

/**
 * Cumulative-bankroll series for the chart: completed sessions ordered by
 * endTime ascending, each point carrying the running cumulative P&L.
 *
 * @param {Array<Object>} sessions
 * @returns {Array<{t:number, pnl:number, cumulative:number, sessionId:*}>}
 */
export const buildBankrollSeries = (sessions = []) => {
  const list = Array.isArray(sessions) ? sessions : [];
  const completed = list
    .filter(isCompletedSession)
    .slice()
    .sort((a, b) => a.endTime - b.endTime);

  let cumulative = 0;
  return completed.map((session) => {
    const pnl = computeSessionPnl(session);
    cumulative += pnl;
    return { t: session.endTime, pnl, cumulative, sessionId: session.sessionId };
  });
};

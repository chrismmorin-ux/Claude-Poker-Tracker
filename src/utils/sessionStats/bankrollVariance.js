/**
 * bankrollVariance.js — bankroll and variance derivations over session records.
 *
 * Pure: no persistence, no React, no ambient randomness. Sibling to
 * sessionAnalytics.js and built on its P&L/duration primitives so every figure
 * here agrees with the Insights band and the session rows.
 *
 * These answer the questions the founder's spreadsheet posed and left blank:
 * true win rate with a confidence interval, risk of ruin, required bankroll,
 * expected downswing, and Kelly stake sizing.
 *
 * ---------------------------------------------------------------------------
 * THE CLUSTER UNIT IS THE SESSION — POKER_THEORY §14.3/§14.4
 * ---------------------------------------------------------------------------
 * "Variance claims name their cluster unit. Cluster over sessions or players;
 *  let hands be the unit *inside* the cluster, never the cluster itself."
 *
 * Hands within a session are not independent — same opponents, same table
 * dynamic, same tilt state — so treating hands as the resampling unit would
 * understate variance badly. Every estimator below clusters on the session, and
 * every returned object carries `clusterUnit` and `n` so no figure can be
 * rendered without its sample size.
 *
 * §14.4 also binds: "Any figure derived through an unobserved-completion
 * assumption is stamped as modelled." Risk of ruin, required bankroll, Kelly and
 * the bootstrap drawdown all extrapolate beyond observation; each carries
 * `modelled: true` and the UI must display that.
 *
 * ---------------------------------------------------------------------------
 * WHY TOURNAMENTS ARE EXCLUDED
 * ---------------------------------------------------------------------------
 * Tournament results have a heavy right tail (most entries lose the buy-in; a
 * rare finish returns many multiples). Pooling them with cash games inflates the
 * standard deviation and drags the mean, which would corrupt every bankroll
 * figure downstream. They are reported separately, never mixed in.
 *
 * @see src/utils/sessionStats/sessionAnalytics.js
 * @see .claude/context/POKER_THEORY.md §14
 */

import {
  isCompletedSession,
  computeSessionPnl,
  computeSessionDurationMs,
  buildBankrollSeries,
} from './sessionAnalytics';

const MS_PER_HOUR = 3600000;

/** Minimum sessions before an interval is meaningful enough to show. */
export const MIN_SESSIONS_FOR_INTERVAL = 20;

/** z multipliers for the two intervals the founder's sheet asked for. */
export const Z_SCORES = { 70: 1.036, 95: 1.96 };

/**
 * Hours of play in a session.
 *
 * Prefers the explicit `durationHours` written by the sheet importer (which
 * knows about overnight wraps and missing clocks) and otherwise derives it from
 * the start/end timestamps of an app-tracked session.
 *
 * @param {Object} session
 * @returns {number|null} hours, or null when the length is unknown
 */
export const sessionHours = (session) => {
  if (!session) return null;
  if (session.durationHours !== undefined && session.durationHours !== null) {
    return session.durationHours > 0 ? session.durationHours : null;
  }
  const ms = computeSessionDurationMs(session);
  return ms > 0 ? ms / MS_PER_HOUR : null;
};

/**
 * Whether a session belongs in the cash-game variance sample.
 *
 * Requires a realized result AND a known length: a session of unknown duration
 * would otherwise contribute profit against zero hours, silently distorting a
 * per-hour rate.
 *
 * @param {Object} session
 * @returns {boolean}
 */
export const isCashVarianceSession = (session) =>
  isCompletedSession(session) &&
  session.sessionKind !== 'tournament' &&
  sessionHours(session) !== null;

/**
 * Split a session list into the cash variance sample and the excluded remainder.
 *
 * Exposed so the UI can be explicit about what it left out — a variance panel
 * that silently drops 26 of 78 sessions reads as if it covered everything.
 *
 * @param {Array<Object>} sessions
 * @returns {{sample:Array<Object>, tournaments:Array<Object>, noDuration:Array<Object>}}
 */
export const partitionSessions = (sessions = []) => {
  const list = Array.isArray(sessions) ? sessions : [];
  const completed = list.filter(isCompletedSession);
  return {
    sample: completed.filter(isCashVarianceSession),
    tournaments: completed.filter((s) => s.sessionKind === 'tournament'),
    noDuration: completed.filter(
      (s) => s.sessionKind !== 'tournament' && sessionHours(s) === null
    ),
  };
};

/**
 * Win rate and its uncertainty, clustered on the session.
 *
 * Sessions differ in length, so the rate is total profit over total hours rather
 * than an average of per-session rates — a 20-minute session must not carry the
 * same weight as a 6-hour one.
 *
 *   mu    = Σpnl / Σhours                        (dollars per hour)
 *   SS    = Σ(pnl_i − mu·h_i)²                   (residual sum of squares)
 *   var/h = SS / Σhours                          (variance per hour)
 *   SE    = √SS / Σhours                         (cluster-robust standard error)
 *
 * The SE is the cluster-robust form with the session as the cluster: each
 * session contributes one residual, whatever happened inside it. This is the
 * §14.3 requirement made concrete.
 *
 * @param {Array<Object>} sessions
 * @returns {{
 *   mu:number|null, sigmaPerHour:number|null, se:number|null,
 *   hours:number, totalPnl:number, n:number, clusterUnit:'session'
 * }}
 */
export const computeWinRate = (sessions = []) => {
  const { sample } = partitionSessions(sessions);

  let hours = 0;
  let totalPnl = 0;
  for (const s of sample) {
    hours += sessionHours(s);
    totalPnl += computeSessionPnl(s);
  }

  const base = { hours, totalPnl, n: sample.length, clusterUnit: 'session' };
  if (sample.length === 0 || hours <= 0) {
    return { ...base, mu: null, sigmaPerHour: null, se: null };
  }

  const mu = totalPnl / hours;
  let ss = 0;
  for (const s of sample) {
    const residual = computeSessionPnl(s) - mu * sessionHours(s);
    ss += residual * residual;
  }

  return {
    ...base,
    mu,
    sigmaPerHour: Math.sqrt(ss / hours),
    se: Math.sqrt(ss) / hours,
  };
};

/**
 * Confidence interval on the TRUE long-run win rate.
 *
 * Returns null below MIN_SESSIONS_FOR_INTERVAL: a band computed from a handful
 * of sessions is not a weak answer, it is a misleading one, and the honest
 * response is to say the sample is too small.
 *
 * `straddlesZero` is the headline fact — when true, the data is consistent with
 * being a losing player, however good the observed rate looks.
 *
 * @param {ReturnType<computeWinRate>} stats
 * @param {70|95} [level=95]
 * @returns {{low:number, high:number, level:number, straddlesZero:boolean,
 *   n:number, clusterUnit:'session'}|null}
 */
export const computeWinRateInterval = (stats, level = 95) => {
  if (!stats || stats.mu === null || stats.se === null) return null;
  if (stats.n < MIN_SESSIONS_FOR_INTERVAL) return null;
  const z = Z_SCORES[level];
  if (!z) return null;

  const low = stats.mu - z * stats.se;
  const high = stats.mu + z * stats.se;
  return {
    low,
    high,
    level,
    straddlesZero: low <= 0 && high >= 0,
    n: stats.n,
    clusterUnit: 'session',
  };
};

/**
 * Probability of losing an entire bankroll, playing this rate forever.
 *
 *   P(ruin) = exp(−2 · mu · B / σ²)
 *
 * the standard result for a random walk with positive drift. It assumes the win
 * rate and variance hold indefinitely and that stakes never change — which is
 * why the result is stamped `modelled`.
 *
 * At mu ≤ 0 ruin is CERTAIN, not merely likely: a break-even or losing player
 * busts any finite bankroll with probability 1. The function returns 1 with an
 * explicit `certain` flag so the UI cannot render a comforting small number for
 * a player who is not beating the game.
 *
 * @param {{mu:number, sigmaPerHour:number}} stats
 * @param {number} bankroll — dollars
 * @returns {{probability:number, certain:boolean, modelled:true}|null}
 */
export const computeRiskOfRuin = (stats, bankroll) => {
  if (!stats || stats.mu === null || stats.sigmaPerHour === null) return null;
  if (!Number.isFinite(bankroll) || bankroll <= 0) return null;

  // Checked BEFORE the variance guard: a losing player busts eventually whatever
  // the swings look like, so certainty here does not depend on knowing sigma.
  if (stats.mu <= 0) {
    return { probability: 1, certain: true, modelled: true };
  }

  // A winning rate with no observed variance never draws down at all.
  if (stats.sigmaPerHour === 0) {
    return { probability: 0, certain: false, modelled: true };
  }

  const variancePerHour = stats.sigmaPerHour * stats.sigmaPerHour;
  const probability = Math.exp((-2 * stats.mu * bankroll) / variancePerHour);
  return {
    probability: Math.min(1, Math.max(0, probability)),
    certain: false,
    modelled: true,
  };
};

/**
 * Bankroll needed to hold risk of ruin at a chosen tolerance.
 *
 *   B = −ln(tolerance) · σ² / (2 · mu)
 *
 * the inverse of computeRiskOfRuin. Null at mu ≤ 0, because no finite bankroll
 * makes a losing game survivable — the honest answer is "there isn't one", not
 * a very large number.
 *
 * @param {{mu:number, sigmaPerHour:number}} stats
 * @param {number} tolerance — e.g. 0.05 for a 5% chance of ruin
 * @returns {{bankroll:number, tolerance:number, modelled:true}|null}
 */
export const computeRequiredBankroll = (stats, tolerance = 0.05) => {
  if (!stats || stats.mu === null || !stats.sigmaPerHour) return null;
  if (!(tolerance > 0 && tolerance < 1)) return null;
  if (stats.mu <= 0) return null;

  const variancePerHour = stats.sigmaPerHour * stats.sigmaPerHour;
  return {
    bankroll: (-Math.log(tolerance) * variancePerHour) / (2 * stats.mu),
    tolerance,
    modelled: true,
  };
};

/**
 * Kelly bankroll requirements.
 *
 * For a continuous, roughly Gaussian edge, full Kelly holds a bankroll of σ²/mu.
 * Full Kelly maximises long-run growth but tolerates brutal swings; most players
 * run a fraction of it, so half and quarter Kelly are returned alongside.
 *
 * @param {{mu:number, sigmaPerHour:number}} stats
 * @returns {{full:number, half:number, quarter:number, modelled:true}|null}
 */
export const computeKelly = (stats) => {
  if (!stats || stats.mu === null || !stats.sigmaPerHour) return null;
  if (stats.mu <= 0) return null;

  const variancePerHour = stats.sigmaPerHour * stats.sigmaPerHour;
  const full = variancePerHour / stats.mu;
  // Risking a smaller fraction of growth-optimal requires a proportionally
  // larger bankroll for the same stake.
  return { full, half: full * 2, quarter: full * 4, modelled: true };
};

/**
 * Deterministic PRNG (mulberry32).
 *
 * The bootstrap must be reproducible: a drawdown figure that changes on every
 * render is not a statistic, and the project's testing rules forbid tests that
 * depend on ambient randomness.
 *
 * @param {number} seed
 * @returns {() => number} generator on [0, 1)
 */
export const createRng = (seed = 1) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Largest peak-to-trough fall in a cumulative P&L series.
 *
 * @param {Array<number>} cumulative
 * @returns {number} a non-negative dollar amount
 */
const maxDrawdownOf = (cumulative) => {
  let peak = 0;
  let worst = 0;
  for (const value of cumulative) {
    if (value > peak) peak = value;
    const fall = peak - value;
    if (fall > worst) worst = fall;
  }
  return worst;
};

/**
 * Downswing analysis: the worst run actually endured, and what the model says to
 * expect from the same edge and variance.
 *
 * The modelled figure resamples SESSIONS with replacement (§14.3 — the session
 * is the cluster; resampling hands would understate the swing) and reports the
 * mean and 90th percentile of the resulting maximum-drawdown distribution.
 *
 * The 90th percentile is the useful number for bankroll planning: the typical
 * bad run is not what busts a player, the unusually bad one is.
 *
 * @param {Array<Object>} sessions
 * @param {{iterations?:number, seed?:number}} [options]
 * @returns {{
 *   observed:number, expected:number|null, p90:number|null,
 *   n:number, clusterUnit:'session', modelled:true
 * }}
 */
export const computeDrawdown = (sessions = [], options = {}) => {
  const { iterations = 2000, seed = 20260807 } = options;
  const { sample } = partitionSessions(sessions);

  const observed = maxDrawdownOf(buildBankrollSeries(sample).map((p) => p.cumulative));
  const base = {
    observed,
    n: sample.length,
    clusterUnit: 'session',
    modelled: true,
  };

  if (sample.length < 2) return { ...base, expected: null, p90: null };

  const pnls = sample.map(computeSessionPnl);
  const rng = createRng(seed);
  const draws = [];

  for (let i = 0; i < iterations; i += 1) {
    let running = 0;
    let peak = 0;
    let worst = 0;
    for (let j = 0; j < pnls.length; j += 1) {
      running += pnls[Math.floor(rng() * pnls.length)];
      if (running > peak) peak = running;
      const fall = peak - running;
      if (fall > worst) worst = fall;
    }
    draws.push(worst);
  }

  draws.sort((a, b) => a - b);
  const mean = draws.reduce((s, v) => s + v, 0) / draws.length;
  const p90 = draws[Math.min(draws.length - 1, Math.floor(draws.length * 0.9))];

  return { ...base, expected: mean, p90 };
};

/**
 * Win rate with the all-in EV adjustment applied.
 *
 * Takes the raw stats and a total dollar adjustment (from
 * `handStats/allInEquity.computeSessionAdjustment`, summed across sessions) and
 * re-expresses it as an hourly rate over the SAME hours, so the two rates are
 * directly comparable.
 *
 * This is a MODELLED figure per POKER_THEORY §14.4 — it replaces outcomes that
 * were observed with outcomes that were expected. It must never be displayed
 * without that stamp, and never instead of the raw rate.
 *
 * @param {ReturnType<computeWinRate>} stats
 * @param {{delta:number, adjustedHands:number, totalHands:number}} adjustment
 * @returns {{mu:number, delta:number, adjustedHands:number, totalHands:number,
 *   covers:boolean, clusterUnit:'session', n:number, modelled:true}|null}
 */
export const computeAdjustedWinRate = (stats, adjustment) => {
  if (!stats || stats.mu === null || !(stats.hours > 0)) return null;
  if (!adjustment) return null;

  const delta = Number.isFinite(adjustment.delta) ? adjustment.delta : 0;
  return {
    mu: (stats.totalPnl + delta) / stats.hours,
    delta,
    adjustedHands: adjustment.adjustedHands || 0,
    totalHands: adjustment.totalHands || 0,
    // False when no hand qualified. The UI must say so rather than print a
    // number identical to the raw rate, which would read as confirmation.
    covers: (adjustment.adjustedHands || 0) > 0,
    clusterUnit: 'session',
    n: stats.n,
    modelled: true,
  };
};

/**
 * Everything the variance panel needs, in one pass.
 *
 * @param {Array<Object>} sessions
 * @param {{bankroll?:number, tolerance?:number, seed?:number}} [options]
 */
export const computeVarianceReport = (sessions = [], options = {}) => {
  const { bankroll = null, tolerance = 0.05, seed } = options;
  const partition = partitionSessions(sessions);
  const winRate = computeWinRate(sessions);

  return {
    winRate,
    interval70: computeWinRateInterval(winRate, 70),
    interval95: computeWinRateInterval(winRate, 95),
    riskOfRuin: bankroll ? computeRiskOfRuin(winRate, bankroll) : null,
    requiredBankroll: computeRequiredBankroll(winRate, tolerance),
    kelly: computeKelly(winRate),
    drawdown: computeDrawdown(sessions, seed === undefined ? {} : { seed }),
    excluded: {
      tournaments: partition.tournaments.length,
      noDuration: partition.noDuration.length,
    },
  };
};

export default computeVarianceReport;

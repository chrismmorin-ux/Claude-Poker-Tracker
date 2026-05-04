/**
 * @file Solver baseline lookup table for hero-leak detection.
 *
 * v1: Hardcoded entries for the IP cbet defense rule (~6 keys). Future rules
 * add entries here. Structure supports extension to computed baselines (via
 * gameTreeEvaluator) — the resolver path can branch on `source` field.
 *
 * Per CLAUDE.md anti-pattern: DO NOT compute solver baselines on-the-fly
 * per render. Hardcoded lookup is fast + deterministic. Computed path is
 * deferred to a future sprint with measured perf justification.
 */

const BASELINES = {
  // ─── hero-ip-cbet-overfold rule (SHIPPED v1, SPR-030 / WS-145) ────
  // IP cbet defense fold-to-cbet rates by board texture × hero position.
  // Source: industry-standard solver outputs (Pio/GTOWizard); ~38% baseline
  // across textures, with minor texture-conditioning (wet boards justify
  // slightly higher fold rate due to draw equity capture; dry boards justify
  // tighter folding because villain has fewer bluffs).
  'flop:dry:LATE:def:ip:bet:vsBet': { baseline: 0.36, source: 'hardcoded', confidence: 0.85, lastValidatedAt: '2026-05-03' },
  'flop:medium:LATE:def:ip:bet:vsBet': { baseline: 0.38, source: 'hardcoded', confidence: 0.85, lastValidatedAt: '2026-05-03' },
  'flop:wet:LATE:def:ip:bet:vsBet': { baseline: 0.42, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-03' },
  'flop:dry:BUTTON:def:ip:bet:vsBet': { baseline: 0.34, source: 'hardcoded', confidence: 0.85, lastValidatedAt: '2026-05-03' },
  'flop:medium:BUTTON:def:ip:bet:vsBet': { baseline: 0.36, source: 'hardcoded', confidence: 0.85, lastValidatedAt: '2026-05-03' },
  'flop:wet:BUTTON:def:ip:bet:vsBet': { baseline: 0.40, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-03' },

  // ─── hero-bb-defense-width rule (SHIPPED v1, SPR-031 / WS-146 first claim) ────
  // BB defense fold rate vs single open. Baselines derived from standard solver
  // outputs with the BB pot-odds discount factored in. Single texture key
  // (preflop has no board) — situation keys all share preflop:none:BIG_BLIND.
  // Not split by opener position in v1 (catalog notes v2 expansion candidate).
  // Intuition: BB should defend wider vs late-position opens because of (a)
  // pot-odds discount, (b) opener's wider range, (c) closing the action.
  'preflop:none:BIG_BLIND:def:oop:raise:vsopen': { baseline: 0.45, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-03' },
};

/**
 * Look up the solver baseline for a situation key.
 *
 * @param {string} situationKey
 * @returns {{baseline: number, source: 'hardcoded'|'computed', confidence: number, lastValidatedAt: string}|null}
 */
export const getSolverBaseline = (situationKey) => {
  return BASELINES[situationKey] || null;
};

/**
 * @returns {string[]} - All situation keys with baseline coverage.
 */
export const listCoveredSituationKeys = () => Object.keys(BASELINES).sort();

/**
 * Diagnostic: which categories of leak rules currently have baseline coverage?
 * Used by tests + the leak-catalog status updater.
 */
export const baselineCoverageByPrefix = () => {
  const counts = {};
  for (const key of Object.keys(BASELINES)) {
    const prefix = key.split(':').slice(0, 3).join(':'); // street:texture:posCategory
    counts[prefix] = (counts[prefix] || 0) + 1;
  }
  return counts;
};

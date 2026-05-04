/**
 * @file SCF composite-signal — picks the next-teachable concept from a
 * weighted combination of leak / drill / test / recency signals.
 *
 * Formula (per SCF Gate 4 audit §SCF-G4-SPINE):
 *
 *   score(concept) =
 *       enableLeak   ? W_leak   * (hasFiredLeak ? severity : 0)    : 0
 *     + enableDrill  ? W_drill  * (1 - drillMastery)               : 0
 *     + enableTest   ? W_test   * (1 - testMastery)                : 0
 *     - enableRecent ? W_recent * recencyPenalty                   : 0
 *
 * The concept with the highest score is the next teachable concept.
 *
 * Weights + toggles default to SCF G4 v1 spec values; the user can
 * override both via `settings.selfCoach.{signalWeights,signalToggles}`
 * (the SettingsContext layer; UI lands in WS-159).
 *
 * Per `feedback_scf_learning_state_not_tier_rank.md` — weights are
 * configuration, not constants. Per `chris-live-player.md` autonomy red
 * line #5 — composite scores feed inspection surfaces, not gamification.
 *
 * SPR-033 / WS-148 (2026-05-04).
 */

import { listAllConceptMastery } from './conceptMastery.js';

/**
 * Default signal weights per SCF Gate 4 v1 spec §SCF-G4-SPINE.
 */
export const DEFAULT_WEIGHTS = Object.freeze({
  W_leak:   0.5,
  W_drill:  0.3,
  W_test:   0.15,
  W_recent: 0.05,
});

/**
 * Default signal toggles. All on by default; user-toggleable via settings.
 */
export const DEFAULT_TOGGLES = Object.freeze({
  enableLeak:   true,
  enableDrill:  true,
  enableTest:   true,
  enableRecent: true,
});

/**
 * Compute composite scores for a list of concept-mastery records.
 *
 * @param {Array<object>} conceptMasteries - output of listAllConceptMastery
 * @param {object} [options]
 * @param {object} [options.weights] - partial override of DEFAULT_WEIGHTS
 * @param {object} [options.toggles] - partial override of DEFAULT_TOGGLES
 * @param {Function} [options.conceptKindFilter] - predicate (mastery) => boolean
 * @returns {Array<{conceptId: string, compositeScore: number, breakdown: object}>}
 */
export const computeComposites = (conceptMasteries, options = {}) => {
  const weights = { ...DEFAULT_WEIGHTS, ...(options.weights || {}) };
  const toggles = { ...DEFAULT_TOGGLES, ...(options.toggles || {}) };
  const filter = typeof options.conceptKindFilter === 'function' ? options.conceptKindFilter : null;

  const filtered = filter ? conceptMasteries.filter(filter) : conceptMasteries;

  return filtered.map((cm) => {
    const leakValue = cm.leakSignal.hasFiredLeak ? (cm.leakSignal.severity || 0) : 0;
    const drillGap = 1 - (cm.drillSignal.mastery || 0);
    const testGap  = 1 - (cm.testSignal.mastery  || 0);
    const recency  = cm.recencyPenalty || 0;

    const leakContrib  = toggles.enableLeak   ? weights.W_leak   * leakValue : 0;
    const drillContrib = toggles.enableDrill  ? weights.W_drill  * drillGap  : 0;
    const testContrib  = toggles.enableTest   ? weights.W_test   * testGap   : 0;
    const recentContrib = toggles.enableRecent ? weights.W_recent * recency  : 0;

    const compositeScore = leakContrib + drillContrib + testContrib - recentContrib;

    return {
      conceptId: cm.conceptId,
      compositeScore,
      breakdown: {
        leak: leakContrib,
        drill: drillContrib,
        test: testContrib,
        recent: recentContrib,
      },
    };
  });
};

/**
 * Pick the concept with the highest composite score.
 *
 * @param {string} userId
 * @param {object} [options] - same shape as computeComposites
 * @returns {Promise<{conceptId, compositeScore, breakdown}|null>}
 */
export const pickNextTeachableConcept = async (userId, options = {}) => {
  const masteries = await listAllConceptMastery(userId);
  const composites = computeComposites(masteries, options);
  if (composites.length === 0) return null;
  // Sort descending; tie-break alphabetically by conceptId for determinism.
  const sorted = [...composites].sort((a, b) => {
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
    return a.conceptId.localeCompare(b.conceptId);
  });
  return sorted[0];
};

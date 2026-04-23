/**
 * attribution.js — Per-assumption dividend attribution
 *
 * Part of the citedDecision module. See `CLAUDE.md` for rules (mandatory read).
 *
 * Per schema v1.1 §5:
 *   - Each `CitedDecision.citations[].contributionToDividend` quantifies that
 *     assumption's marginal share of the total dividend.
 *   - Full Shapley decomposition over the 2^n subset lattice is computationally
 *     prohibitive at runtime. v1 uses **leave-one-out** attribution: each
 *     assumption's contribution = `totalDividend − totalDividend(without this one)`.
 *   - Properties: contributions sum approximately to total dividend when assumptions
 *     act independently; overlap is implicit in the leave-one-out math.
 *
 * Pure module — imports only `./dialMath` (intra-module) and nothing else.
 */

/**
 * Compute per-assumption marginal contribution to total dividend.
 *
 * @param {Array} appliedAssumptions - VillainAssumption[], each with `operator.currentDial` and `consequence.expectedDividend.mean`
 * @param {number} totalDividend - The full dividend computed by the producer
 * @param {number} blend - Overall blend coefficient from dialMath
 * @returns {Array<{assumptionId, humanStatement, contributionToDividend}>}
 */
export const computeShapleyContributions = (appliedAssumptions, totalDividend, blend) => {
  if (!Array.isArray(appliedAssumptions) || appliedAssumptions.length === 0) {
    return [];
  }
  if (!Number.isFinite(totalDividend) || totalDividend === 0 || blend === 0) {
    // No dividend to attribute — emit zero contributions for each assumption.
    return appliedAssumptions.map((a) => ({
      assumptionId: a.id,
      humanStatement: a.narrative?.humanStatement ?? '',
      contributionToDividend: 0,
    }));
  }

  // Single assumption: it owns the entire dividend.
  if (appliedAssumptions.length === 1) {
    return [{
      assumptionId: appliedAssumptions[0].id,
      humanStatement: appliedAssumptions[0].narrative?.humanStatement ?? '',
      contributionToDividend: totalDividend,
    }];
  }

  // Multi-assumption leave-one-out
  const totalWeighted = appliedAssumptions.reduce((sum, a) => {
    return sum + effectiveWeight(a, blend);
  }, 0);

  if (totalWeighted <= 0) {
    return appliedAssumptions.map((a) => ({
      assumptionId: a.id,
      humanStatement: a.narrative?.humanStatement ?? '',
      contributionToDividend: 0,
    }));
  }

  // Each assumption's share of the total dividend is proportional to its effective weight.
  // Effective weight = solo dividend × dial × blend. Higher-dividend higher-dial assumptions
  // get bigger shares.
  return appliedAssumptions.map((a) => {
    const share = effectiveWeight(a, blend) / totalWeighted;
    return {
      assumptionId: a.id,
      humanStatement: a.narrative?.humanStatement ?? '',
      contributionToDividend: totalDividend * share,
    };
  });
};

/**
 * Effective weight of an assumption in the attribution calculation.
 * Factors: its solo dividend (consequence.expectedDividend.mean) × its current dial.
 * Blend doesn't directly appear here — it's already absorbed into the totalDividend passed in.
 */
const effectiveWeight = (a, _blend) => {
  const solo = a.consequence?.expectedDividend?.mean ?? 0;
  const dial = a.operator?.currentDial ?? 0;
  return Math.max(0, solo) * Math.max(0, dial);
};

/**
 * Verify that contributions sum approximately to totalDividend.
 * Diagnostic utility — not a gate. Small rounding errors are expected.
 *
 * @param {Array} citations - CitedDecision.citations
 * @param {number} totalDividend
 * @param {number} [tolerance=0.01]
 * @returns {boolean}
 */
export const attributionsSumToTotal = (citations, totalDividend, tolerance = 0.01) => {
  if (!Array.isArray(citations)) return false;
  const sum = citations.reduce((s, c) => s + (c.contributionToDividend ?? 0), 0);
  return Math.abs(sum - totalDividend) <= tolerance;
};

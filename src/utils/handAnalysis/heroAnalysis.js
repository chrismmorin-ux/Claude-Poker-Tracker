/**
 * heroAnalysis.js - Equity-based hero coaching for hand replay
 *
 * Three pure functions for hero coaching during hand replay.
 * No React, no async — operates on pre-computed equity and segmentation data.
 * Used by HandReplayView via replayAnalysis.js → buildHeroCoaching().
 *
 * Contrast with handReviewAnalyzer.js which is rule-based, synchronous, and
 * used by AnalysisView. This module's equity-based analysis is more authoritative
 * when available since it uses actual range computations rather than heuristics.
 */

import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';

/**
 * Assess whether hero's action was +EV/-EV given their equity.
 *
 * @param {number} heroEquity - Hero's equity vs villain range (0-1)
 * @param {string} action - Primitive action taken
 * @param {number} potSize - Pot before this action
 * @param {number} betSize - Amount bet/called (0 for check/fold)
 * @returns {{ verdict: string, reason: string, equityNeeded: number|null, actualEquity: number }|null}
 */
export const assessHeroEV = (heroEquity, action, potSize, betSize) => {
  if (heroEquity === null || heroEquity === undefined) return null;
  const eqPct = Math.round(heroEquity * 100);

  // Compute numeric expected value where possible
  const computeCallEV = (eq, pot, bet) => eq * (pot + bet) - bet;
  const computeFoldEV = () => 0;

  if (action === PRIMITIVE_ACTIONS.CALL) {
    if (!betSize || betSize <= 0) return null;
    const equityNeeded = betSize / (potSize + betSize);
    const neededPct = Math.round(equityNeeded * 100);
    const expectedValue = computeCallEV(heroEquity, potSize, betSize);

    if (heroEquity > equityNeeded + 0.10) {
      return {
        verdict: '+EV',
        reason: `Comfortable call — ${eqPct}% equity vs ${neededPct}% needed`,
        equityNeeded, actualEquity: heroEquity, expectedValue,
      };
    }
    if (heroEquity > equityNeeded) {
      return {
        verdict: '+EV',
        reason: `Close but profitable — ${eqPct}% equity vs ${neededPct}% needed`,
        equityNeeded, actualEquity: heroEquity, expectedValue,
      };
    }
    return {
      verdict: '-EV',
      reason: `Needed ${neededPct}% but had ${eqPct}% — insufficient equity to call`,
      equityNeeded, actualEquity: heroEquity, expectedValue,
    };
  }

  if (action === PRIMITIVE_ACTIONS.BET || action === PRIMITIVE_ACTIONS.RAISE) {
    // For bets/raises, EV depends on fold equity which we don't have here.
    // Provide equity-only estimate: hero equity * pot - bet cost (vs full range)
    const estimatedEV = heroEquity * (potSize + betSize * 2) - betSize;
    if (heroEquity > 0.5) {
      return {
        verdict: '+EV',
        reason: `${eqPct}% equity vs full range — likely value (calling range may be stronger)`,
        equityNeeded: null, actualEquity: heroEquity, expectedValue: estimatedEV,
      };
    }
    if (heroEquity >= 0.3) {
      return {
        verdict: 'neutral',
        reason: `Semi-bluff with ${eqPct}% equity — needs fold equity to profit`,
        equityNeeded: null, actualEquity: heroEquity, expectedValue: estimatedEV,
      };
    }
    return {
      verdict: '-EV',
      reason: `Pure bluff with ${eqPct}% equity — requires significant fold equity`,
      equityNeeded: null, actualEquity: heroEquity, expectedValue: estimatedEV,
    };
  }

  if (action === PRIMITIVE_ACTIONS.CHECK) {
    if (heroEquity > 0.65) {
      return {
        verdict: 'neutral',
        reason: `${eqPct}% equity — consider betting for value (trapping may also be valid)`,
        equityNeeded: null, actualEquity: heroEquity,
      };
    }
    if (heroEquity < 0.35) {
      return {
        verdict: '+EV',
        reason: `Correct check with ${eqPct}% equity — not enough to bet for value`,
        equityNeeded: null, actualEquity: heroEquity,
      };
    }
    return {
      verdict: 'neutral',
      reason: `${eqPct}% equity — check is reasonable`,
      equityNeeded: null, actualEquity: heroEquity,
    };
  }

  if (action === PRIMITIVE_ACTIONS.FOLD) {
    if (potSize > 0 && betSize > 0) {
      const equityNeeded = betSize / (potSize + betSize);
      const neededPct = Math.round(equityNeeded * 100);
      const callEV = computeCallEV(heroEquity, potSize, betSize);
      const foldEV = computeFoldEV();
      if (heroEquity > equityNeeded) {
        return {
          verdict: '-EV',
          reason: `Folded with ${eqPct}% equity — only needed ${neededPct}% to call`,
          equityNeeded, actualEquity: heroEquity,
          expectedValue: foldEV,
          alternatives: [{ action: 'Call', ev: callEV }],
        };
      }
      return {
        verdict: '+EV',
        reason: `Correct fold — ${eqPct}% equity vs ${neededPct}% needed`,
        equityNeeded, actualEquity: heroEquity,
        expectedValue: foldEV,
        alternatives: [{ action: 'Call', ev: callEV }],
      };
    }
    return null;
  }

  return null;
};

/**
 * Suggest the optimal play given hero's situation.
 *
 * @param {number} heroEquity - Hero's equity (0-1)
 * @param {Object|null} villainSegmentation - Villain's range segmentation
 * @param {Object|null} boardTexture - Board texture analysis
 * @param {boolean} isIP - Whether hero is in position
 * @param {number} potSize - Current pot
 * @returns {{ suggestedAction: string, reason: string }|null}
 */
export const suggestOptimalPlay = (heroEquity, villainSegmentation, boardTexture, isIP, potSize) => {
  if (heroEquity === null || heroEquity === undefined) return null;

  const buckets = villainSegmentation?.buckets;
  const villainNuts = (buckets?.nuts?.pct || 0) + (buckets?.strong?.pct || 0);
  const villainAir = buckets?.air?.pct || 0;
  const villainCapped = villainNuts < 15; // Villain's range has few strong hands
  const texture = boardTexture?.texture || 'dry';

  // Strong equity + villain range capped → bet for value
  if (heroEquity > 0.65 && villainCapped) {
    return {
      suggestedAction: 'Bet for value',
      reason: "Villain's range is capped with few strong hands",
    };
  }

  // Good equity on dry board → consider betting
  if (heroEquity > 0.50 && texture === 'dry') {
    return {
      suggestedAction: 'Consider betting',
      reason: 'Range advantage on dry board — villain has limited equity',
    };
  }

  // Low equity → fold if facing a bet
  if (heroEquity < 0.25) {
    return {
      suggestedAction: 'Consider folding',
      reason: `Only ${Math.round(heroEquity * 100)}% equity — insufficient against this range`,
    };
  }

  // Medium equity with draws on board → check to realize equity
  if (heroEquity >= 0.30 && heroEquity <= 0.50 && (texture === 'wet' || texture === 'medium')) {
    return {
      suggestedAction: 'Check is reasonable',
      reason: 'Protect your range and realize equity on a draw-heavy board',
    };
  }

  // Bluffing a calling station
  if (heroEquity < 0.30 && villainAir < 20 && villainNuts > 30) {
    return {
      suggestedAction: 'Avoid bluffing',
      reason: "Villain's range is strong — bluffs won't generate enough folds",
    };
  }

  return null;
};

/**
 * Check if this action matches a known hero weakness pattern.
 *
 * @param {string} situationKey - Current action's situation key
 * @param {Array|null} heroWeaknesses - Hero's detected weaknesses
 * @returns {{ weakness: Object, matchCount: number, message: string }|null}
 */
export const matchHeroWeakness = (situationKey, heroWeaknesses) => {
  if (!situationKey || !heroWeaknesses || heroWeaknesses.length === 0) return null;

  const [actionStreet, , , actionType] = situationKey.split(':');

  for (const weakness of heroWeaknesses) {
    if (!weakness.situationKeys || weakness.situationKeys.length === 0) continue;

    const match = weakness.situationKeys.some(sk => {
      const [wStreet, , , wAction] = sk.split(':');
      return wStreet === actionStreet && wAction === actionType;
    });

    if (match) {
      return {
        weakness,
        matchCount: weakness.sampleSize || 1,
        message: `Pattern: ${weakness.label} — occurrence #${weakness.sampleSize || 1} in ${actionStreet} ${actionType} spots`,
      };
    }
  }

  return null;
};

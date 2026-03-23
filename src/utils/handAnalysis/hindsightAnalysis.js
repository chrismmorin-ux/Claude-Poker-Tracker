/**
 * hindsightAnalysis.js - Villain analysis "with hindsight" (knowing actual cards + runout)
 *
 * Computes actual equity at decision point vs hero's estimated range,
 * runout equity on full board, and lucky/unlucky assessment.
 */

import { handVsRange } from './exploitEngine/equityCalculator';
import { parseBoard, parseAndEncode } from './pokerCore/cardParser';
import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';

/**
 * Analyze a villain's action knowing their actual cards and the full runout.
 *
 * @param {string[]} villainCards - ['Ah', 'Kd'] villain's hole cards
 * @param {Float64Array|null} heroRange - Hero's estimated range at this point
 * @param {string[]} currentBoard - Board cards visible at the decision point
 * @param {string[]} fullBoard - All 5 community cards (or however many were dealt)
 * @param {string} action - Primitive action villain took
 * @param {number} potSize - Pot at the decision point
 * @param {number} betSize - Amount bet/called
 * @returns {Promise<{ actualEquity: number, runoutEquity: number|null, wasCorrectPlay: string, luckyUnlucky: string, verdict: string }|null>}
 */
export const analyzeWithHindsight = async (villainCards, heroRange, currentBoard, fullBoard, action, potSize, betSize) => {
  if (!villainCards || villainCards.length < 2 || !heroRange) return null;

  const v0 = parseAndEncode(villainCards[0]);
  const v1 = parseAndEncode(villainCards[1]);
  if (v0 < 0 || v1 < 0) return null;

  const currentBoardEncoded = currentBoard.length >= 3 ? parseBoard(currentBoard) : [];
  const fullBoardFiltered = (fullBoard || []).filter(c => c && c.trim().length >= 2);
  const fullBoardEncoded = fullBoardFiltered.length >= 3 ? parseBoard(fullBoardFiltered) : [];

  // Actual equity at decision point
  let actualEquity = null;
  try {
    const result = await handVsRange([v0, v1], heroRange, currentBoardEncoded, { trials: 1000 });
    actualEquity = result.equity;
  } catch (e) {
    return null;
  }

  // Runout equity (on full board) — only if we have more cards than at decision point
  let runoutEquity = null;
  if (fullBoardEncoded.length > currentBoardEncoded.length && fullBoardEncoded.length >= 3) {
    try {
      const result = await handVsRange([v0, v1], heroRange, fullBoardEncoded, { trials: 1000 });
      runoutEquity = result.equity;
    } catch (e) {
      // Non-critical
    }
  }

  // Was the action correct?
  let wasCorrectPlay;
  const eqPct = Math.round(actualEquity * 100);

  if (action === PRIMITIVE_ACTIONS.BET || action === PRIMITIVE_ACTIONS.RAISE) {
    if (actualEquity > 0.5) {
      wasCorrectPlay = `Correct value bet — ${eqPct}% equity vs hero's range`;
    } else if (actualEquity >= 0.3) {
      wasCorrectPlay = `Semi-bluff — ${eqPct}% equity, needed fold equity`;
    } else {
      wasCorrectPlay = `Pure bluff — only ${eqPct}% equity vs hero's range`;
    }
  } else if (action === PRIMITIVE_ACTIONS.CALL) {
    const equityNeeded = betSize > 0 ? betSize / (potSize + betSize) : 0;
    const neededPct = Math.round(equityNeeded * 100);
    if (actualEquity >= equityNeeded) {
      wasCorrectPlay = `Correct call — ${eqPct}% equity vs ${neededPct}% needed`;
    } else {
      wasCorrectPlay = `-EV call — ${eqPct}% equity but needed ${neededPct}%`;
    }
  } else if (action === PRIMITIVE_ACTIONS.FOLD) {
    if (betSize <= 0) {
      wasCorrectPlay = `Folded with ${eqPct}% equity (no bet faced)`;
    } else {
      const equityNeeded = betSize / (potSize + betSize);
      const neededPct = Math.round(equityNeeded * 100);
      if (actualEquity < equityNeeded) {
        wasCorrectPlay = `Correct fold — ${eqPct}% equity vs ${neededPct}% needed`;
      } else {
        wasCorrectPlay = `Folded best hand — had ${eqPct}% equity, only needed ${neededPct}%`;
      }
    }
  } else if (action === PRIMITIVE_ACTIONS.CHECK) {
    if (actualEquity > 0.65) {
      wasCorrectPlay = `Missed value — ${eqPct}% equity, could have bet`;
    } else {
      wasCorrectPlay = `Reasonable check with ${eqPct}% equity`;
    }
  } else {
    wasCorrectPlay = `${eqPct}% equity at decision point`;
  }

  // Lucky/unlucky assessment
  let luckyUnlucky = 'neutral';
  if (runoutEquity !== null) {
    const delta = runoutEquity - actualEquity;
    if (delta > 0.15) luckyUnlucky = 'lucky';
    else if (delta < -0.15) luckyUnlucky = 'unlucky';
  }

  // Build verdict
  let verdict = wasCorrectPlay;
  if (runoutEquity !== null && luckyUnlucky !== 'neutral') {
    const runPct = Math.round(runoutEquity * 100);
    const direction = luckyUnlucky === 'lucky' ? 'improved' : 'worsened';
    verdict += `. Board runout ${direction} equity from ${eqPct}% to ${runPct}%`;
  }

  return {
    actualEquity,
    runoutEquity,
    wasCorrectPlay,
    luckyUnlucky,
    verdict,
  };
};

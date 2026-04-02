/**
 * replayAnalysis.js - Pure functions extracted from useHandReplayAnalysis
 *
 * Contains all analytical logic for hand replay: action classification,
 * EV assessment, range initialization, hero coaching, and per-action analysis.
 * The hook (useHandReplayAnalysis) is now a thin orchestrator calling these.
 */

import { getPositionName, getRangePositionCategory, isInPosition } from '../positionUtils';
import { parseBoard, parseAndEncode, getCardsForStreet } from '../pokerCore/cardParser';
import { analyzeBoardFromStrings } from '../pokerCore/boardTexture';
import { narrowByBoard } from '../exploitEngine/postflopNarrower';
import { segmentRange } from '../exploitEngine/rangeSegmenter';
import { buildSituationKey } from '../exploitEngine/decisionAccumulator';
import { queryActionDistribution } from '../exploitEngine/villainDecisionModel';
import { handVsRange } from '../exploitEngine/equityCalculator';
import { PRIMITIVE_ACTIONS, LEGACY_TO_PRIMITIVE } from '../../constants/primitiveActions';
import { getPopulationPrior } from '../rangeEngine/populationPriors';
import { assessHeroEV, suggestOptimalPlay, matchHeroWeakness } from './heroAnalysis';

/**
 * Determine if a player's hand at showdown was a value bet or bluff
 * at a given action point based on their hand's equity vs opponent range.
 */
export const classifyAction = (handEquity, action) => {
  if (action !== PRIMITIVE_ACTIONS.BET && action !== PRIMITIVE_ACTIONS.RAISE) {
    return null;
  }
  if (handEquity === null || handEquity === undefined) return null;
  return handEquity > 0.5 ? 'value' : 'bluff';
};

/**
 * Assess whether an action is +EV based on range equity and board context.
 * This is a board-context-aware heuristic, not exact EV calculation.
 */
export const assessEV = (action, segmentation, boardTexture, rangeEquityPct) => {
  if (!segmentation || !segmentation.buckets) return null;

  const { nuts, strong, marginal, draw, air } = segmentation.buckets;
  const valuePct = (nuts?.pct || 0) + (strong?.pct || 0);
  const airPct = air?.pct || 0;
  const drawPct = draw?.pct || 0;
  const texture = boardTexture?.texture || 'dry';

  if (action === PRIMITIVE_ACTIONS.BET || action === PRIMITIVE_ACTIONS.RAISE) {
    if (texture === 'dry' && valuePct > 50) {
      return { verdict: '+EV', reason: `Range has ${Math.round(valuePct)}% value on ${texture} board — profitable bet` };
    }
    if (texture === 'wet' && valuePct < 35 && airPct > 30) {
      return { verdict: '-EV', reason: `Only ${Math.round(valuePct)}% value on wet board with ${Math.round(airPct)}% air — opponent range has draws and equity` };
    }
    if (valuePct > 45) {
      return { verdict: '+EV', reason: `Range has ${Math.round(valuePct)}% value hands — enough to support betting` };
    }
    if (valuePct < 25 && drawPct < 20) {
      return { verdict: '-EV', reason: `Only ${Math.round(valuePct)}% value with few draws — betting mostly air` };
    }
    return { verdict: 'neutral', reason: `Mixed range: ${Math.round(valuePct)}% value, ${Math.round(drawPct)}% draws` };
  }

  if (action === PRIMITIVE_ACTIONS.CHECK) {
    if (texture === 'dry' && valuePct > 60) {
      return { verdict: '-EV', reason: `Checking with ${Math.round(valuePct)}% value on dry board — likely missing value` };
    }
    if (texture === 'wet' && valuePct < 40) {
      return { verdict: '+EV', reason: `Checking on wet board with ${Math.round(valuePct)}% value — protecting range` };
    }
    return { verdict: 'neutral', reason: `Check is reasonable with ${Math.round(valuePct)}% value` };
  }

  if (action === PRIMITIVE_ACTIONS.CALL) {
    if (valuePct + drawPct > 50) {
      return { verdict: '+EV', reason: `Calling with ${Math.round(valuePct + drawPct)}% value + draws` };
    }
    if (airPct > 50) {
      return { verdict: '-EV', reason: `Calling with ${Math.round(airPct)}% air — folding would be better` };
    }
    return { verdict: 'neutral', reason: `Mixed calling range: ${Math.round(valuePct)}% value, ${Math.round(drawPct)}% draws` };
  }

  return null;
};

/**
 * Compute range equity: what percentage of a range has >50% equity.
 * Approximated from segmentation buckets (nuts + strong always profitable,
 * marginal ~ 50/50, draws depend on outs).
 */
export const estimateRangeEquityPct = (buckets) => {
  if (!buckets) return null;
  const nuts = buckets.nuts?.pct || 0;
  const strong = buckets.strong?.pct || 0;
  const marginal = buckets.marginal?.pct || 0;
  return nuts + strong + marginal * 0.5;
};

/**
 * Initialize per-seat ranges from tendency data and range profiles.
 *
 * @param {Object} seatPlayers - { [seat]: playerId }
 * @param {Object} tendencyMap - { [playerId]: { rangeProfile, ... } }
 * @param {number} buttonSeat - Dealer button seat
 * @returns {{ seatRanges: Object, seatRangeProfiles: Object, seatRangeLabels: Object }}
 */
export const initializeSeatRanges = (seatPlayers, tendencyMap, buttonSeat) => {
  const seatRanges = {};
  const seatRangeLabels = {};
  const seatRangeProfiles = {};

  for (const [seat, playerId] of Object.entries(seatPlayers)) {
    const tendency = tendencyMap?.[playerId];
    const rangeProfile = tendency?.rangeProfile;
    if (rangeProfile) {
      const posCategory = getRangePositionCategory(Number(seat), buttonSeat);
      const posName = getPositionName(Number(seat), buttonSeat);
      const openRange = rangeProfile.ranges?.[posCategory]?.open;
      if (openRange) {
        seatRanges[seat] = new Float64Array(openRange);
        seatRangeLabels[seat] = `${posName} open range`;
      }
      seatRangeProfiles[seat] = rangeProfile;
    }
  }

  return { seatRanges, seatRangeProfiles, seatRangeLabels };
};

/**
 * Build hero coaching analysis for a hero action.
 *
 * @param {Object} params
 * @returns {Promise<Object|null>}
 */
export const buildHeroCoaching = async ({
  entry, index, street, heroSeat, heroCards, cardsForStreet,
  seatRanges, seatPlayers, tendencyMap, timeline, results,
  boardTexture, situationKey, potAtPoint, buttonSeat,
}) => {
  let heroEqForCoaching = null;

  // Single backward scan to find villain context (range, segmentation, seat, facing bet)
  let villainRange = null, villainSeg = null, villainSeat = null, facingBet = 0;
  for (let j = index - 1; j >= 0; j--) {
    const prev = timeline[j];
    const isVillain = String(prev.seat) !== String(heroSeat);

    // facingBet: most recent bet/raise on same street
    if (facingBet === 0 && prev.street === street) {
      const prevPrim = LEGACY_TO_PRIMITIVE[prev.action] ?? prev.action;
      if (prevPrim === PRIMITIVE_ACTIONS.BET || prevPrim === PRIMITIVE_ACTIONS.RAISE) {
        facingBet = prev.amount || 0;
      }
    }

    if (!isVillain) continue;

    if (!villainRange && seatRanges[prev.seat]) villainRange = seatRanges[prev.seat];
    if (!villainSeg && results[j]?.segmentation) villainSeg = results[j].segmentation;
    if (villainSeat === null) villainSeat = Number(prev.seat);

    if (villainRange && villainSeg && villainSeat !== null && facingBet !== 0) break;
  }

  if (heroCards && heroCards.length === 2 && cardsForStreet.length >= 3 && villainRange) {
    const h0 = parseAndEncode(heroCards[0]);
    const h1 = parseAndEncode(heroCards[1]);
    if (h0 >= 0 && h1 >= 0) {
      const board = parseBoard(cardsForStreet);
      try {
        const eqResult = await handVsRange([h0, h1], villainRange, board, { trials: 500 });
        heroEqForCoaching = eqResult.equity;
      } catch (e) {
        // Non-critical
      }
    }
  }

  if (heroEqForCoaching === null) return null;

  const action = entry.action;
  const primitive = LEGACY_TO_PRIMITIVE[action] ?? action;

  const evAssessment = assessHeroEV(
    heroEqForCoaching, primitive, potAtPoint, facingBet || (entry.amount || 0)
  );

  // Determine if hero is in position vs the most recent villain actor
  const isIP = villainSeat !== null
    ? isInPosition(Number(heroSeat), villainSeat, buttonSeat)
    : false;

  const optimalPlay = suggestOptimalPlay(
    heroEqForCoaching, villainSeg, boardTexture, isIP, potAtPoint
  );

  // Weakness matching
  const heroPlayerId = seatPlayers[heroSeat];
  const heroTendency = tendencyMap?.[heroPlayerId];
  const heroWeaknesses = heroTendency?.weaknesses || null;
  const weaknessMatch = matchHeroWeakness(situationKey, heroWeaknesses);

  return {
    evAssessment,
    optimalPlay,
    weaknessMatch,
    heroEquity: heroEqForCoaching,
  };
};

/**
 * Analyze a single timeline action — computes range narrowing, segmentation,
 * equity, EV assessment, showdown classification, and hero coaching.
 *
 * IMPORTANT: Mutates seatRanges and seatRangeLabels in place for range tracking.
 *
 * @param {Object} params
 * @returns {Promise<Object>} Analysis result for this action
 */
export const analyzeTimelineAction = async ({
  entry, index, timeline, seatRanges, seatRangeLabels,
  seatRangeProfiles, seatPlayers, tendencyMap, buttonSeat,
  communityCards, heroSeat, heroCards, showdownCards, blindsPosted, results,
}) => {
  const seat = entry.seat;
  const street = entry.street;
  const action = entry.action;
  const posCategory = getRangePositionCategory(Number(seat), buttonSeat);
  const posName = getPositionName(Number(seat), buttonSeat);

  // Get board cards for this street
  const cardsForStreet = getCardsForStreet(communityCards, street);
  const boardTexture = cardsForStreet.length >= 3
    ? analyzeBoardFromStrings(cardsForStreet)
    : null;

  // Pot at this action point
  let potAtPoint = 0;
  if (blindsPosted) potAtPoint = (blindsPosted.sb || 0) + (blindsPosted.bb || 0);
  for (let j = 0; j < index; j++) {
    if (timeline[j].amount) potAtPoint += timeline[j].amount;
  }

  let rangeAtPoint = seatRanges[seat] || null;
  let segmentation = null;
  let rangeEquity = null;
  let heroEquity = null;
  let actionClass = null;
  let evAssessment = null;
  let preActionRanges = null;
  let preActionLabel = null;

  // Build pre-action decision distribution for preflop
  if (street === 'preflop') {
    const rangeProfile = seatRangeProfiles[seat];
    const posRanges = rangeProfile?.ranges?.[posCategory];

    const facedRaise = timeline.slice(0, index).some(
      a => a.street === 'preflop' && a.seat !== seat && a.action === 'raise'
    );

    const getRange = (actionName) => {
      const profileRange = posRanges?.[actionName];
      if (profileRange && profileRange.some(w => w > 0)) {
        return new Float64Array(profileRange);
      }
      return getPopulationPrior(posCategory, actionName);
    };

    if (facedRaise) {
      preActionRanges = {
        raise: getRange('threeBet'),
        call: getRange('coldCall'),
        fold: getRange('fold'),
      };
      preActionLabel = `${posName} vs raise`;
    } else {
      preActionRanges = {
        raise: getRange('open'),
        call: getRange('limp'),
        fold: getRange('fold'),
      };
      preActionLabel = `${posName} unopened`;
    }
  }

  // Update range label for preflop actions
  if (street === 'preflop' && rangeAtPoint) {
    const actionLabel = action === 'raise' ? 'open-raise'
      : action === 'call' ? 'call' : action;
    seatRangeLabels[seat] = `${posName} ${actionLabel} range`;
  }

  if (rangeAtPoint && street !== 'preflop' && cardsForStreet.length >= 3) {
    const board = parseBoard(cardsForStreet);
    const playerId = seatPlayers[seat];
    const tendency = tendencyMap?.[playerId];
    const playerStats = tendency ? {
      af: tendency.af, cbet: tendency.cbet, vpip: tendency.vpip,
      style: tendency.style, threeBet: tendency.threeBet,
    } : undefined;

    // Narrow range by this action
    try {
      const narrowed = narrowByBoard(rangeAtPoint, action, board, [], { playerStats, boardTexture });
      seatRanges[seat] = narrowed;
      rangeAtPoint = narrowed;
      const streetLabel = street.charAt(0).toUpperCase() + street.slice(1);
      seatRangeLabels[seat] = `${posName} range after ${streetLabel} ${action}`;
    } catch (e) {
      // Keep existing range if narrowing fails
    }

    // Segment the narrowed range
    try {
      segmentation = segmentRange(rangeAtPoint, board);
      rangeEquity = estimateRangeEquityPct(segmentation.buckets);
    } catch (e) {
      // Segmentation is non-critical
    }

    // Hero equity vs this player's range
    if (heroSeat && String(heroSeat) !== seat && heroCards.length === 2) {
      const h0 = parseAndEncode(heroCards[0]);
      const h1 = parseAndEncode(heroCards[1]);
      if (h0 >= 0 && h1 >= 0) {
        try {
          const eqResult = await handVsRange([h0, h1], rangeAtPoint, board, { trials: 500 });
          heroEquity = eqResult.equity;
        } catch (e) {
          // Equity calc is non-critical
        }
      }
    }

    // EV assessment
    evAssessment = assessEV(action, segmentation, boardTexture, rangeEquity);

    // Showdown labeling
    const seatShowdown = showdownCards[seat] || showdownCards[Number(seat)];
    if (seatShowdown && Array.isArray(seatShowdown) && seatShowdown.length === 2) {
      const s0 = parseAndEncode(seatShowdown[0]);
      const s1 = parseAndEncode(seatShowdown[1]);
      if (s0 >= 0 && s1 >= 0) {
        const opponentSeat = heroSeat && String(heroSeat) !== seat
          ? String(heroSeat) : null;
        if (opponentSeat && seatRanges[opponentSeat]) {
          try {
            const sdResult = await handVsRange(
              [s0, s1], seatRanges[opponentSeat], board, { trials: 500 }
            );
            actionClass = classifyAction(sdResult.equity, action);
          } catch (e) {
            // Non-critical
          }
        }
      }
    }
  }

  const situationKey = buildSituationKey(street, boardTexture?.texture || 'unknown', posCategory, action);

  // Hero coaching analysis
  let heroAnalysis = null;
  if (heroSeat && String(entry.seat) === String(heroSeat) && street !== 'preflop') {
    heroAnalysis = await buildHeroCoaching({
      entry, index, street, heroSeat, heroCards, cardsForStreet,
      seatRanges, seatPlayers, tendencyMap, timeline, results,
      boardTexture, situationKey, potAtPoint, buttonSeat,
    });
  }

  // Store hero's range at this point for hindsight analysis
  const heroRangeAtPoint = heroSeat && seatRanges[String(heroSeat)]
    ? new Float64Array(seatRanges[String(heroSeat)])
    : null;

  // Model prediction for villain actions (non-hero, postflop only)
  let modelPrediction = null;
  if (heroSeat && String(seat) !== String(heroSeat) && street !== 'preflop') {
    const playerId = seatPlayers[seat];
    const villainModel = tendencyMap?.[playerId]?.villainModel;
    if (villainModel?._buckets) {
      // Determine what villain was facing
      const prevActions = timeline.slice(0, index).filter(a => a.street === street && a.seat !== seat);
      const lastOpponentAction = prevActions.length > 0 ? prevActions[prevActions.length - 1].action : null;
      const facingAction = (lastOpponentAction === 'bet' || lastOpponentAction === 'raise') ? 'bet' : 'none';
      const heroIP = heroSeat ? isInPosition(Number(heroSeat), Number(seat), buttonSeat) : null;
      const villainIP = heroIP === true ? 'oop' : heroIP === false ? 'ip' : '*';

      try {
        const dist = queryActionDistribution(
          villainModel, street, boardTexture?.texture || '*', posCategory, '*', villainIP, facingAction
        );
        if (dist.confidence > 0) {
          // Compute surprise score: -log2(predicted probability of actual action)
          const primitiveAction = LEGACY_TO_PRIMITIVE[action] || action;
          const actionKey = primitiveAction === PRIMITIVE_ACTIONS.BET ? 'bet'
            : primitiveAction === PRIMITIVE_ACTIONS.RAISE ? 'raise'
            : primitiveAction === PRIMITIVE_ACTIONS.CALL ? 'call'
            : primitiveAction === PRIMITIVE_ACTIONS.CHECK ? 'check'
            : 'fold';
          const predictedPct = dist.actions[actionKey] || 0;
          const surprise = predictedPct > 0.01 ? -Math.log2(predictedPct) : 5;

          modelPrediction = {
            actions: dist.actions,
            confidence: dist.confidence,
            effectiveN: dist.effectiveN,
            source: dist.source,
            actualAction: actionKey,
            surprise,
          };
        }
      } catch {
        // Model query is non-critical
      }
    }
  }

  return {
    seat,
    street,
    action,
    order: entry.order,
    posName,
    posCategory,
    rangeAtPoint: rangeAtPoint ? new Float64Array(rangeAtPoint) : null,
    rangeLabel: seatRangeLabels[seat] || null,
    preActionRanges,
    preActionLabel,
    segmentation,
    boardTexture,
    rangeEquity,
    heroEquity,
    actionClass,
    evAssessment,
    situationKey,
    heroAnalysis,
    heroRangeAtPoint,
    modelPrediction,
  };
};

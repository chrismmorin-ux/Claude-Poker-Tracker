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
// RT-35: These 4 symbols are injected via deps parameter to analyzeTimelineAction
// to avoid handAnalysis → exploitEngine import (INV-08 violation).
// Defaults provide graceful degradation when deps are not supplied.
import { handVsRange } from '../pokerCore/monteCarloEquity';
import { bayesianSampleConfidence } from '../pokerCore/betaMath';
import { PRIMITIVE_ACTIONS, LEGACY_TO_PRIMITIVE } from '../../constants/primitiveActions';
import { getPopulationPrior } from '../rangeEngine/populationPriors';
import { assessHeroEV, suggestOptimalPlay, matchHeroWeakness } from './heroAnalysis';

/**
 * Classify a bet/raise as value, thin value, or bluff based on the actor's
 * hand equity vs opponent range — with optional sample-size-aware banding.
 *
 * MoE-symmetric banding (POKER_THEORY.md §181 "Thin value betting"):
 *   - 'value' when equity > 0.5 + moe (clearly above the >50% threshold)
 *   - 'thin'  when |equity - 0.5| <= moe (within Monte-Carlo noise of the boundary)
 *   - 'bluff' when equity < 0.5 - moe (clearly below)
 *
 * Backward-compat: if `moe` is null/undefined/0, falls back to the original
 * binary cutoff (>0.5 → 'value', else 'bluff') so legacy callers keep working.
 *
 * @param {number} handEquity — actor's equity vs opponent calling range
 * @param {string} action — must be BET or RAISE; null returned otherwise
 * @param {{ moe?: number }} [opts] — `moe` is the 95% MoE half-width (e.g.
 *   `handVsRange().ciHalf`). When supplied, enables banded classification.
 * @returns {{ class: 'value'|'thin'|'bluff', equity: number, moe: number|null } | null}
 */
export const classifyAction = (handEquity, action, opts = {}) => {
  if (action !== PRIMITIVE_ACTIONS.BET && action !== PRIMITIVE_ACTIONS.RAISE) {
    return null;
  }
  if (handEquity === null || handEquity === undefined) return null;

  const { moe = null } = opts;

  if (moe === null || moe === undefined || moe === 0) {
    return {
      class: handEquity > 0.5 ? 'value' : 'bluff',
      equity: handEquity,
      moe: null,
    };
  }

  let klass;
  if (handEquity > 0.5 + moe) klass = 'value';
  else if (handEquity < 0.5 - moe) klass = 'bluff';
  else klass = 'thin';

  return { class: klass, equity: handEquity, moe };
};

/**
 * Minimum hands on a player before assessEV emits a categorical verdict.
 * Matches rangeEngine PRIOR_WEIGHT (10): below this the narrowed range is
 * dominated by the population prior, so a confident +EV/-EV label over its
 * segmentation overstates precision (POKER_THEORY §6.5).
 */
const MIN_EV_ASSESS_SAMPLE = 10;

/**
 * Assess whether an action is +EV based on range equity and board context.
 * This is a board-context-aware heuristic, not exact EV calculation.
 *
 * @param {object} [opts] - { sampleSize } hands observed on the acting player.
 *   When supplied and below MIN_EV_ASSESS_SAMPLE, returns an 'unknown' verdict
 *   instead of a confident-looking category (FIND-009). Omitting sampleSize
 *   preserves the ungated population-level behavior for legacy callers.
 */
export const assessEV = (action, segmentation, boardTexture, rangeEquityPct, opts = {}) => {
  if (!segmentation || !segmentation.buckets) return null;

  const { sampleSize = null } = opts;
  if (sampleSize != null && sampleSize < MIN_EV_ASSESS_SAMPLE) {
    return {
      verdict: 'unknown',
      reason: `Insufficient data — ${sampleSize} hand${sampleSize === 1 ? '' : 's'} on this player; need ≥${MIN_EV_ASSESS_SAMPLE} to assess range EV`,
      confidence: bayesianSampleConfidence(sampleSize),
    };
  }

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
 * Build the depth-2/3 counterfactual game tree for a single timeline entry.
 *
 * Evaluates from hero's seat at the state present at this entry — board, pot,
 * villain's narrowed range, villain's most-recent action on this street.
 * For hero-actor entries this answers "what alternative action could hero have
 * taken?". For villain-actor entries it is entirely counterfactual from hero's
 * seat — "if hero had been on turn at this state, what's the EV landscape?".
 * Downstream consumers (SR-30 modal) own the labeling.
 *
 * Returns null when the engine cannot evaluate:
 *   - preflop entries (engine is postflop-only)
 *   - <3 community cards
 *   - missing or unparseable hero hole cards
 *   - no usable villain range
 *   - engine throws
 *
 * INV-08: `evaluateGameTree` is injected via `deps` (engine import lives in
 * the hook caller, not in this module). Callers must supply it; otherwise the
 * helper returns null without computing.
 *
 * @param {Object} params
 * @param {Object} params.entry           Current timeline entry
 * @param {number} params.index           Its index in timeline
 * @param {Array}  params.timeline        Full timeline
 * @param {Object} params.seatRanges      { [seat]: Float64Array } — narrowed at this point
 * @param {Object} params.seatPlayers     { [seat]: playerId }
 * @param {Object} params.tendencyMap     { [playerId]: { villainModel, af, vpip, ... } }
 * @param {number} params.heroSeat
 * @param {string[]} params.heroCards     Hero hole card strings (length 2)
 * @param {string[]} params.cardsForStreet Community cards revealed at this street
 * @param {number} params.potAtPoint      Pot before this entry
 * @param {Object} [params.boardTexture]  Optional pre-computed texture (passed as contextHint)
 * @param {Object} params.deps            { evaluateGameTree }
 * @returns {Promise<Object|null>}
 */
export const buildCounterfactualTree = async ({
  entry, index, timeline, seatRanges, seatPlayers, tendencyMap,
  heroSeat, heroCards, cardsForStreet, potAtPoint, boardTexture,
  deps = {},
}) => {
  const { evaluateGameTree } = deps;
  if (!evaluateGameTree) return null;
  if (!entry || entry.street === 'preflop') return null;
  if (!cardsForStreet || cardsForStreet.length < 3) return null;
  if (!heroCards || heroCards.length !== 2) return null;

  const h0 = parseAndEncode(heroCards[0]);
  const h1 = parseAndEncode(heroCards[1]);
  if (h0 < 0 || h1 < 0) return null;

  // Find most-recent villain on the SAME street before this entry.
  // Their range/action defines what hero is "facing" from the engine's perspective.
  let villainSeat = null;
  let villainPlayerId = null;
  let villainRange = null;
  let villainAction = null;
  let villainBet = 0;
  for (let j = index - 1; j >= 0; j--) {
    const prev = timeline[j];
    if (prev.street !== entry.street) break;
    if (String(prev.seat) === String(heroSeat)) continue;
    villainSeat = Number(prev.seat);
    villainPlayerId = seatPlayers?.[prev.seat] ?? seatPlayers?.[villainSeat];
    villainRange = seatRanges?.[prev.seat] ?? seatRanges?.[String(prev.seat)] ?? null;
    const prevPrim = LEGACY_TO_PRIMITIVE[prev.action] ?? prev.action;
    if (prevPrim === PRIMITIVE_ACTIONS.BET) {
      villainAction = 'bet';
      villainBet = prev.amount || 0;
    } else if (prevPrim === PRIMITIVE_ACTIONS.RAISE) {
      villainAction = 'raise';
      villainBet = prev.amount || 0;
    }
    break;
  }

  // First-to-act on a street (no prior villain action this street): fall back to
  // the first non-hero seat with a range so the engine has a villain to model.
  if (!villainRange) {
    for (const [seatKey, range] of Object.entries(seatRanges || {})) {
      if (String(seatKey) === String(heroSeat) || !range) continue;
      villainRange = range;
      villainSeat = Number(seatKey);
      villainPlayerId = seatPlayers?.[seatKey] ?? seatPlayers?.[villainSeat];
      break;
    }
  }
  if (!villainRange) return null;

  const board = parseBoard(cardsForStreet);
  if (!board || board.length < 3) return null;

  const tendency = villainPlayerId != null ? tendencyMap?.[villainPlayerId] : null;
  const playerStats = tendency ? {
    af: tendency.af, cbet: tendency.cbet, vpip: tendency.vpip,
    style: tendency.style, threeBet: tendency.threeBet,
  } : undefined;
  const villainModel = tendency?.villainModel;

  let result;
  try {
    result = await evaluateGameTree({
      villainRange,
      board,
      heroCards: [h0, h1],
      potSize: potAtPoint,
      villainAction: villainAction || undefined,
      villainBet,
      playerStats,
      villainModel,
      contextHints: boardTexture ? { boardTexture } : {},
    });
  } catch (e) {
    return null;
  }

  if (!result || !Array.isArray(result.recommendations)) return null;

  return {
    recommendations: result.recommendations,
    treeMetadata: result.treeMetadata,
    foldPct: result.foldPct,
    foldMeta: result.foldMeta,
    modelQuality: result.modelQuality,
    bucketEquities: result.bucketEquities,
    // SLS Stream B2 wiring (SPR-086 / WS-192). perCombo is the per-villain-
    // combo equity distribution exposed by evaluateGameTree; consumed by
    // EquityDistributionCurveSection + SpirePolarizationSection inside
    // ReviewPanel. evByFraction is derived from the same recommendations[]
    // already returned; consumed by SizingCurveTagSection. Both are null
    // when the engine produced no usable distribution (e.g., sparse villain
    // range) — sections render null per INV-SLS-B2-SECTION-NULL-DEGRADATION.
    perCombo: result.perCombo || null,
    evByFraction: deriveEvByFraction(result.recommendations),
    villainContext: {
      villainSeat,
      villainAction,
      villainBet,
    },
  };
};

/**
 * Derive an `evByFraction` array from evaluateGameTree's recommendations[]
 * for SizingCurveTagSection consumption.
 *
 * The Sizing Curve Tag classifier expects an array of `{fraction, ev}`
 * sorted ascending by fraction. heroActionBuilder.js emits multiple
 * `{action: 'bet'|'raise', sizing: {betFraction, ...}}` candidates per
 * decision; we filter + map + sort.
 *
 * Returns null when fewer than `MIN_SAMPLES_FOR_CLASSIFICATION` (3) bet
 * candidates are emitted — the classifier would label 'empty' anyway,
 * so the section renders null per INV-SLS-B2-SECTION-NULL-DEGRADATION.
 *
 * SLS Stream B2 wiring — SPR-086 / WS-192.
 */
const deriveEvByFraction = (recommendations) => {
  if (!Array.isArray(recommendations)) return null;
  const betSizing = recommendations
    .filter((r) => (r.action === 'bet' || r.action === 'raise') && r.sizing?.betFraction != null)
    .map((r) => ({ fraction: r.sizing.betFraction, ev: r.ev }))
    .sort((a, b) => a.fraction - b.fraction);
  return betSizing.length >= 3 ? betSizing : null;
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
  deps = {},
}) => {
  // Injected dependencies (from exploitEngine, passed by hook caller)
  const {
    narrowByBoard = (range) => range,
    segmentRange: segmentRangeFn = () => null,
    buildSituationKey: buildSituationKeyFn = () => '',
    queryActionDistribution: queryActionDistributionFn = () => ({ actions: {}, confidence: 0 }),
  } = deps;
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
      segmentation = segmentRangeFn(rangeAtPoint, board);
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

    // EV assessment — gated on how many hands we have on this player (FIND-009)
    evAssessment = assessEV(action, segmentation, boardTexture, rangeEquity, {
      sampleSize: tendency?.sampleSize ?? 0,
    });

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
            actionClass = classifyAction(sdResult.equity, action, { moe: sdResult.ciHalf });
          } catch (e) {
            // Non-critical
          }
        }
      }
    }
  }

  const situationKey = buildSituationKeyFn(street, boardTexture?.texture || 'unknown', posCategory, action);

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
        const dist = queryActionDistributionFn(
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
    potAtPoint,
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

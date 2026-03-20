/**
 * useHandReplayAnalysis.js - Per-action range/equity analysis for hand replay
 *
 * When reviewing a hand, produces analysis for each action in the timeline:
 * estimated range at that point, equity, segmentation, board texture,
 * and EV assessment. Post-showdown: labels actions as value/bluff.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { buildTimeline, getStreetTimeline } from '../utils/handTimeline';
import { getPositionName, getRangePositionCategory, isInPosition } from '../utils/positionUtils';
import { parseBoard, parseAndEncode, getCardsForStreet } from '../utils/pokerCore/cardParser';
import { analyzeBoardFromStrings } from '../utils/pokerCore/boardTexture';
import { narrowByBoard } from '../utils/exploitEngine/postflopNarrower';
import { segmentRange } from '../utils/exploitEngine/rangeSegmenter';
import { buildSituationKey } from '../utils/exploitEngine/decisionAccumulator';
import { handVsRange } from '../utils/exploitEngine/equityCalculator';
import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';
import { getPopulationPrior } from '../utils/rangeEngine/populationPriors';

/**
 * Determine if a player's hand at showdown was a value bet or bluff
 * at a given action point based on their hand's equity vs opponent range.
 */
const classifyAction = (handEquity, action) => {
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
const assessEV = (action, segmentation, boardTexture, rangeEquityPct) => {
  if (!segmentation || !segmentation.buckets) return null;

  const { nuts, strong, marginal, draw, air } = segmentation.buckets;
  const valuePct = (nuts?.pct || 0) + (strong?.pct || 0);
  const airPct = air?.pct || 0;
  const drawPct = draw?.pct || 0;
  const texture = boardTexture?.texture || 'dry';

  if (action === PRIMITIVE_ACTIONS.BET || action === PRIMITIVE_ACTIONS.RAISE) {
    // Betting: profitable when enough of range is value + reasonable bluffs
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
    // Checking: potentially -EV if range dominates this board
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
const estimateRangeEquityPct = (buckets) => {
  if (!buckets) return null;
  const nuts = buckets.nuts?.pct || 0;
  const strong = buckets.strong?.pct || 0;
  const marginal = buckets.marginal?.pct || 0;
  // Nuts and strong are >50% equity, marginal is ~50/50, draws and air are <50%
  return nuts + strong + marginal * 0.5;
};

/**
 * @param {Object|null} selectedHand - The hand record
 * @param {Array} timeline - From buildTimeline()
 * @param {Object} tendencyMap - { [playerId]: { rangeProfile, ... } }
 * @returns {{ actionAnalysis: Array|null, isComputing: boolean }}
 */
export const useHandReplayAnalysis = (selectedHand, timeline, tendencyMap) => {
  const [actionAnalysis, setActionAnalysis] = useState(null);
  const [isComputing, setIsComputing] = useState(false);
  const lastHandIdRef = useRef(null);

  const compute = useCallback(async () => {
    if (!selectedHand || !timeline || timeline.length === 0) {
      setActionAnalysis(null);
      return;
    }

    const handId = selectedHand.handId ?? selectedHand.id;
    if (handId === lastHandIdRef.current && actionAnalysis) return;
    lastHandIdRef.current = handId;

    setIsComputing(true);
    try {
      const buttonSeat = selectedHand?.gameState?.dealerButtonSeat ?? 1;
      const seatPlayers = selectedHand?.seatPlayers || {};
      const heroSeat = selectedHand?.gameState?.mySeat ?? null;
      const communityCards = selectedHand?.cardState?.communityCards ||
                             selectedHand?.gameState?.communityCards || [];

      // Collect showdown data: which seats showed cards
      const showdownCards = selectedHand?.gameState?.showdownCards || {};
      const heroCards = selectedHand?.cardState?.selectedCards ||
                        selectedHand?.gameState?.holeCards || [];

      // Build per-seat range tracking: start from preflop range
      const seatRanges = {}; // seat -> current Float64Array range
      const seatRangeLabels = {}; // seat -> descriptive label for current range

      // Initialize ranges from tendencyMap for each seat
      for (const [seat, playerId] of Object.entries(seatPlayers)) {
        const tendency = tendencyMap?.[playerId];
        const rangeProfile = tendency?.rangeProfile;
        if (rangeProfile) {
          const posCategory = getRangePositionCategory(Number(seat), buttonSeat);
          const posName = getPositionName(Number(seat), buttonSeat);
          // Start with the player's preflop opening range as baseline
          const openRange = rangeProfile.ranges?.[posCategory]?.open;
          if (openRange) {
            seatRanges[seat] = new Float64Array(openRange);
            seatRangeLabels[seat] = `${posName} open range`;
          }
        }
      }

      // Store range profiles per seat for pre-action distribution
      const seatRangeProfiles = {};
      for (const [seat, playerId] of Object.entries(seatPlayers)) {
        const tendency = tendencyMap?.[playerId];
        if (tendency?.rangeProfile) {
          seatRangeProfiles[seat] = tendency.rangeProfile;
        }
      }

      const results = [];

      for (let i = 0; i < timeline.length; i++) {
        const entry = timeline[i];
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

          // Did this player face a raise before this action?
          const facedRaise = timeline.slice(0, i).some(
            a => a.street === 'preflop' && a.seat !== seat && a.action === 'raise'
          );

          // Use player's profile ranges, or fall back to population priors
          const getRange = (action) => {
            const profileRange = posRanges?.[action];
            if (profileRange && profileRange.some(w => w > 0)) {
              return new Float64Array(profileRange);
            }
            return getPopulationPrior(posCategory, action);
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

        // Update range label for preflop actions (post-action narrowed range)
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
            // Append narrowing step to label
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

          // Showdown labeling: if this player showed cards
          const seatShowdown = showdownCards[seat] || showdownCards[Number(seat)];
          if (seatShowdown && Array.isArray(seatShowdown) && seatShowdown.length === 2) {
            const s0 = parseAndEncode(seatShowdown[0]);
            const s1 = parseAndEncode(seatShowdown[1]);
            if (s0 >= 0 && s1 >= 0) {
              // Find opponent range to check equity against
              // Use hero's range or any other player's range
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

        results.push({
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
        });
      }

      setActionAnalysis(results);
    } catch (e) {
      console.error('useHandReplayAnalysis: failed', e);
      setActionAnalysis(null);
    } finally {
      setIsComputing(false);
    }
  }, [selectedHand, timeline, tendencyMap]);

  useEffect(() => {
    compute();
  }, [compute]);

  return { actionAnalysis, isComputing };
};

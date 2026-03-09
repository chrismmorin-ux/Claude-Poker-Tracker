/**
 * handReviewAnalyzer.js - Decision point analysis for hand review
 *
 * Pure utility, no React. Analyzes a Hero decision point in the context
 * of villain stats, position, and board texture.
 *
 * Public API:
 *   analyzeDecisionPoint({ timeline, focusedAction, heroSeat, hand, tendencyMap, boardCards })
 *     -> DecisionAnalysis
 */

import { getPositionName, isInPosition } from './positionUtils';
import { analyzeBoardFromStrings } from './pokerCore/boardTexture';
import { getCardsForStreet } from './pokerCore/cardParser';
import { findLastRaiser, getStreetTimeline } from './handTimeline';
import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';

// =============================================================================
// BOARD TEXTURE DESCRIPTION
// =============================================================================

const describeBoardTexture = (boardTexture) => {
  if (!boardTexture) return null;
  const parts = [];
  parts.push(boardTexture.texture);
  if (boardTexture.isPaired) parts.push('paired');
  if (boardTexture.flushDraw) parts.push('flush draw');
  if (boardTexture.flushComplete) parts.push('flush possible');
  if (boardTexture.straightPossible) parts.push('straight draw');
  if (boardTexture.monotone) parts.push('monotone');
  if (boardTexture.rainbow) parts.push('rainbow');
  return parts.join(', ');
};

// =============================================================================
// SITUATION DESCRIPTION
// =============================================================================

const describeSituation = (heroPos, villainPos, villainName, action, street) => {
  const streetLabel = street.charAt(0).toUpperCase() + street.slice(1);
  if (villainPos && villainName) {
    return `${streetLabel}: Hero in ${heroPos} vs ${villainName} (${villainPos})`;
  }
  return `${streetLabel}: Hero in ${heroPos}`;
};

// =============================================================================
// FIND RELEVANT VILLAIN
// =============================================================================

const findRelevantVillain = (timeline, focusedAction, heroSeat, seatPlayers) => {
  const streetActions = getStreetTimeline(timeline, focusedAction.street);

  // Find the last aggressor before hero's action (the player hero is responding to)
  let villainSeat = null;
  for (const entry of streetActions) {
    if (entry.order >= focusedAction.order) break;
    if (entry.seat !== String(heroSeat)) {
      if (entry.action === PRIMITIVE_ACTIONS.RAISE || entry.action === PRIMITIVE_ACTIONS.BET) {
        villainSeat = entry.seat;
      }
    }
  }

  // If hero is the aggressor, find who acts after / the caller
  if (!villainSeat) {
    for (const entry of streetActions) {
      if (entry.order > focusedAction.order && entry.seat !== String(heroSeat)) {
        villainSeat = entry.seat;
        break;
      }
    }
  }

  // Fallback: any other player who acted on this street
  if (!villainSeat) {
    for (const entry of streetActions) {
      if (entry.seat !== String(heroSeat)) {
        villainSeat = entry.seat;
        break;
      }
    }
  }

  if (!villainSeat) return null;

  const villainPlayerId = seatPlayers?.[villainSeat] || seatPlayers?.[Number(villainSeat)];
  return { villainSeat: Number(villainSeat), villainPlayerId };
};

// =============================================================================
// ANALYSIS RULES
// =============================================================================

const rules = [
  // Calling tight raiser
  {
    id: 'calling-tight-raiser',
    check: ({ action, villainStats, streetActions, focusedAction, heroSeat }) => {
      if (action !== PRIMITIVE_ACTIONS.CALL) return null;
      if (!villainStats || villainStats.vpip === null) return null;
      // Check if villain raised before hero
      const villainRaised = streetActions.some(e =>
        e.seat !== String(heroSeat) && e.order < focusedAction.order &&
        e.action === PRIMITIVE_ACTIONS.RAISE
      );
      if (!villainRaised || villainStats.vpip >= 20) return null;
      return {
        text: `Villain plays tight (VPIP ${villainStats.vpip}%) -- consider folding marginal hands`,
        severity: 'minor',
      };
    },
  },
  // Missed 3-bet opportunity
  {
    id: 'missed-3bet',
    check: ({ action, street, villainStats, streetActions, focusedAction, heroSeat }) => {
      if (street !== 'preflop' || action !== PRIMITIVE_ACTIONS.CALL) return null;
      // Must be facing a raise
      const facingRaise = streetActions.some(e =>
        e.seat !== String(heroSeat) && e.order < focusedAction.order &&
        e.action === PRIMITIVE_ACTIONS.RAISE
      );
      if (!facingRaise) return null;
      if (!villainStats || villainStats.vpip === null) return null;
      // High VPIP + high PFR = they fold to 3-bets often
      if (villainStats.vpip > 30 && villainStats.pfr > 20) {
        return {
          text: `3-bet opportunity -- villain opens wide (VPIP ${villainStats.vpip}%, PFR ${villainStats.pfr}%) and likely over-folds`,
          severity: 'minor',
        };
      }
      return null;
    },
  },
  // Limping in position
  {
    id: 'limp-in-position',
    check: ({ action, street, heroPos }) => {
      if (street !== 'preflop' || action !== PRIMITIVE_ACTIONS.CALL) return null;
      const latePositions = ['HJ', 'CO', 'BTN'];
      if (!latePositions.includes(heroPos)) return null;
      return {
        text: `Raise or fold in late position (${heroPos}) -- limping is a leak`,
        severity: 'minor',
      };
    },
  },
  // Calling tight 3-bet
  {
    id: 'calling-tight-3bet',
    check: ({ action, street, villainStats, streetActions, focusedAction, heroSeat }) => {
      if (street !== 'preflop' || action !== PRIMITIVE_ACTIONS.CALL) return null;
      if (!villainStats || villainStats.threeBet === null) return null;
      // Count raises before hero's action
      const raisesBeforeHero = streetActions.filter(e =>
        e.order < focusedAction.order && e.action === PRIMITIVE_ACTIONS.RAISE
      );
      if (raisesBeforeHero.length < 2) return null; // Need at least 2 raises for a 3-bet scenario
      if (villainStats.threeBet < 5) {
        return {
          text: `Villain's 3-bet is always premium (3-bet ${villainStats.threeBet}%) -- fold non-nuts`,
          severity: 'major',
        };
      }
      return null;
    },
  },
  // Bluffing a station
  {
    id: 'bluffing-station',
    check: ({ action, street, villainStats }) => {
      if (street === 'preflop') return null;
      if (action !== PRIMITIVE_ACTIONS.BET && action !== PRIMITIVE_ACTIONS.RAISE) return null;
      if (!villainStats || villainStats.vpip === null || villainStats.af === null) return null;
      if (villainStats.vpip > 40 && villainStats.af < 1.5) {
        return {
          text: `Avoid bluffing calling stations (VPIP ${villainStats.vpip}%, AF ${villainStats.af}) -- bet for value only`,
          severity: 'minor',
        };
      }
      return null;
    },
  },
  // Missed value bet
  {
    id: 'missed-value',
    check: ({ action, street, villainStats }) => {
      if (street === 'preflop') return null;
      if (action !== PRIMITIVE_ACTIONS.CHECK) return null;
      if (!villainStats || villainStats.af === null) return null;
      if (villainStats.af < 1.0 && villainStats.vpip > 30) {
        return {
          text: `Consider value betting -- villain is passive (AF ${villainStats.af}) and calls with worse frequently`,
          severity: 'minor',
        };
      }
      return null;
    },
  },
  // C-bet on wet board
  {
    id: 'cbet-wet-board',
    check: ({ action, street, boardTexture, villainStats, heroSeat, timeline }) => {
      if (street !== 'flop') return null;
      if (action !== PRIMITIVE_ACTIONS.BET) return null;
      // Check if hero was preflop aggressor
      const pfRaiser = findLastRaiser(timeline, 'preflop');
      if (pfRaiser !== String(heroSeat)) return null;
      if (!boardTexture || boardTexture.texture !== 'wet') return null;
      if (villainStats && villainStats.af > 2) {
        return {
          text: `Risky c-bet on wet board -- villain is aggressive (AF ${villainStats.af}) and may raise`,
          severity: 'minor',
        };
      }
      return null;
    },
  },
];

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * Analyze a Hero decision point.
 *
 * @param {Object} params
 * @param {Array} params.timeline - Full hand timeline from buildTimeline
 * @param {Object} params.focusedAction - The specific timeline entry for the focused action
 * @param {number} params.heroSeat - Hero's seat number
 * @param {Object} params.hand - Full hand record
 * @param {Object} params.tendencyMap - { [playerId]: { vpip, pfr, af, threeBet, cbet, style, ... } }
 * @param {string[]} params.boardCards - Community cards array ['Ah', 'Kd', '7c', '', '']
 * @returns {Object} DecisionAnalysis
 */
export const analyzeDecisionPoint = ({ timeline, focusedAction, heroSeat, hand, tendencyMap, boardCards }) => {
  if (!focusedAction || !timeline) {
    return null;
  }

  const buttonSeat = hand?.gameState?.dealerButtonSeat ?? 1;
  const seatPlayers = hand?.seatPlayers || {};
  const focusedSeat = Number(focusedAction.seat);
  const isHeroAction = heroSeat && focusedSeat === heroSeat;
  const focusedPos = getPositionName(focusedSeat, buttonSeat);
  const street = focusedAction.street;
  const action = focusedAction.action;

  // Board texture (postflop only)
  const cardsForStreet = getCardsForStreet(boardCards, street);
  const boardTexture = cardsForStreet.length > 0 ? analyzeBoardFromStrings(cardsForStreet) : null;

  // For hero actions, find villain context. For villain actions, show villain's own stats.
  let opponentInfo = null;
  let opponentStats = null;
  let opponentName = null;
  let opponentPos = null;

  if (isHeroAction) {
    // Hero action: find the relevant villain
    opponentInfo = findRelevantVillain(timeline, focusedAction, heroSeat, seatPlayers);
    if (opponentInfo) {
      opponentPos = getPositionName(opponentInfo.villainSeat, buttonSeat);
      if (opponentInfo.villainPlayerId && tendencyMap) {
        opponentStats = tendencyMap[opponentInfo.villainPlayerId] || null;
      }
      opponentName = opponentStats?.name || `Seat ${opponentInfo.villainSeat}`;
    }
  } else {
    // Villain action: show this player's own stats
    const focusedPlayerId = seatPlayers?.[focusedAction.seat] || seatPlayers?.[focusedSeat];
    if (focusedPlayerId && tendencyMap) {
      opponentStats = tendencyMap[focusedPlayerId] || null;
    }
    opponentName = opponentStats?.name || `Seat ${focusedSeat}`;
    opponentPos = focusedPos;
  }

  // Position (IP/OOP)
  let positionNote = null;
  if (heroSeat && street !== 'preflop') {
    if (isHeroAction && opponentInfo) {
      const ip = isInPosition(heroSeat, opponentInfo.villainSeat, buttonSeat);
      positionNote = ip ? 'Hero is in position (IP)' : 'Hero is out of position (OOP)';
    } else if (!isHeroAction) {
      const ip = isInPosition(focusedSeat, heroSeat, buttonSeat);
      positionNote = ip ? `${opponentName} is in position (IP)` : `${opponentName} is out of position (OOP)`;
    }
  }

  // Situation description
  const situation = isHeroAction
    ? describeSituation(focusedPos, opponentPos, opponentName, action, street)
    : describeSituation(focusedPos, null, null, action, street);

  // Board texture description
  const boardDescription = describeBoardTexture(boardTexture);

  // Profile summary
  let villainProfile = null;
  if (opponentStats) {
    const parts = [];
    const label = isHeroAction ? '' : `${opponentName}: `;
    if (opponentStats.vpip !== null) parts.push(`VPIP ${opponentStats.vpip}%`);
    if (opponentStats.pfr !== null) parts.push(`PFR ${opponentStats.pfr}%`);
    if (opponentStats.af !== null) parts.push(`AF ${opponentStats.af}`);
    if (opponentStats.style) parts.push(opponentStats.style);
    villainProfile = label + parts.join(' / ');
  }

  // Range estimate
  let rangeNote = null;
  if (opponentStats?.rangeProfile) {
    const totalHands = opponentStats.rangeProfile.handsProcessed || 0;
    if (totalHands >= 20) {
      const who = isHeroAction ? "Villain's" : `${opponentName}'s`;
      rangeNote = `${who} range based on ${totalHands} observed hands`;
    }
  }

  // Street actions for rule context
  const streetActions = getStreetTimeline(timeline, street);

  // Run analysis rules (only for hero actions — rules are hero-centric)
  const observations = [];
  let mistakeFlag = null;

  if (isHeroAction) {
    const heroPos = getPositionName(heroSeat, buttonSeat);
    for (const rule of rules) {
      const result = rule.check({
        action, street, heroPos, heroSeat, villainStats: opponentStats, boardTexture,
        streetActions, focusedAction, timeline, seatPlayers,
      });
      if (result) {
        observations.push({ id: rule.id, text: result.text });
        if (result.severity === 'major' && !mistakeFlag) {
          mistakeFlag = { severity: 'major', text: result.text };
        } else if (result.severity === 'minor' && !mistakeFlag) {
          mistakeFlag = { severity: 'minor', text: result.text };
        }
      }
    }
  }

  return {
    situation,
    villainProfile,
    rangeNote,
    positionNote,
    boardDescription,
    observations,
    mistakeFlag,
  };
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get the streets that have actions in a hand.
 */
export const getAvailableStreets = (timeline) => {
  const streets = new Set();
  for (const entry of timeline) {
    streets.add(entry.street);
  }
  return ['preflop', 'flop', 'turn', 'river'].filter(s => streets.has(s));
};

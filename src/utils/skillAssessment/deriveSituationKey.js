/**
 * @file deriveSituationKey — derive the situation key for a single hero
 * action in a hand. Used by:
 *   - heroDecisionAccumulator (per-action across all hands)
 *   - ReviewPanel (current decision point lookup for useHeroLeaks)
 *
 * Extracted from heroDecisionAccumulator in WS-158 / SPR-031 so the
 * derivation logic is shared between offline accumulation and live consumer.
 *
 * Format extended from 7 to 8 axes in WS-146 SPR-040 (2026-05-06):
 *   street:texture:posCategory:isAgg:isIP:facingAction:contextAction:preflopAggressor
 *
 * The `preflopAggressor` axis distinguishes "hero called preflop" (`pfc`)
 * from "hero raised preflop" (`pfa`) on postflop streets. This separates
 * cbet-defense (hero pfc, faces villain cbet) from donk-defense (hero pfa,
 * faces villain donk). Without it, both situations collapse to the same
 * bucket and rules can't distinguish them. On preflop streets the axis
 * value is `'na'` (not applicable — the action under analysis IS the
 * preflop decision).
 */

import { analyzeBoardTexture } from '../pokerCore/boardTexture.js';

const TEXTURE_LABELS = ['dry', 'medium', 'wet'];

const NORMALIZE_ACTION = (action) => {
  if (!action) return 'unknown';
  const a = String(action).toLowerCase();
  if (a.includes('fold')) return 'fold';
  if (a.includes('call')) return 'call';
  if (a.includes('raise')) return 'raise';
  if (a.includes('check')) return 'check';
  if (a.includes('bet')) return 'bet';
  return 'unknown';
};

const POS_CATEGORY_FOR_SEAT = (seat, buttonSeat, totalPlayers = 6) => {
  if (!seat || !buttonSeat) return 'MIDDLE';
  const offset = ((seat - buttonSeat) % totalPlayers + totalPlayers) % totalPlayers;
  if (offset === 0) return 'BUTTON';
  if (offset === 1) return 'SMALL_BLIND';
  if (offset === 2) return 'BIG_BLIND';
  if (offset >= 3 && offset <= 4) return 'EARLY';
  return totalPlayers > 6 ? 'MIDDLE' : 'LATE';
};

const DERIVE_TEXTURE = (board) => {
  if (!board || board.length === 0) return 'none';
  const texture = analyzeBoardTexture(board);
  return texture?.texture || 'medium';
};

const getBoardForStreet = (communityCards, street) => {
  if (!Array.isArray(communityCards)) return [];
  if (street === 'preflop') return [];
  if (street === 'flop') return communityCards.slice(0, 3);
  if (street === 'turn') return communityCards.slice(0, 4);
  if (street === 'river') return communityCards.slice(0, 5);
  return [];
};

const COUNT_PREFLOP_RAISES_BEFORE = (actionSequence, currentOrder) => {
  if (!Array.isArray(actionSequence)) return 0;
  return actionSequence.filter(
    (a) =>
      a.street === 'preflop'
      && (a.order ?? 0) < currentOrder
      && (a.action === 'raise' || a.action === 'bet'),
  ).length;
};

const FIND_LAST_AGGRESSIVE_ACTION = (actionSequence, street, currentOrder) => {
  if (!Array.isArray(actionSequence)) return null;
  const earlier = actionSequence.filter(
    (a) => a.street === street && (a.order ?? 0) < currentOrder,
  );
  for (let i = earlier.length - 1; i >= 0; i -= 1) {
    const verb = NORMALIZE_ACTION(earlier[i].action);
    if (verb === 'bet' || verb === 'raise') return earlier[i];
  }
  return null;
};

const DERIVE_CONTEXT_ACTION = ({ street, action, actionSequence, order, isAgg }) => {
  const verb = NORMALIZE_ACTION(action);
  if (street === 'preflop') {
    const raisesBefore = COUNT_PREFLOP_RAISES_BEFORE(actionSequence, order);
    if (raisesBefore === 0) return verb === 'raise' || verb === 'bet' ? 'open' : 'limp';
    if (raisesBefore === 1) return verb === 'raise' ? '3bet' : 'vsopen';
    if (raisesBefore === 2) return verb === 'raise' ? '4bet' : 'vs3bet';
    return 'vs3bet';
  }
  const lastAgg = FIND_LAST_AGGRESSIVE_ACTION(actionSequence, street, order);
  if (lastAgg) {
    if (verb === 'fold' || verb === 'call' || verb === 'raise') return 'vsBet';
    return 'unknown';
  }
  if (verb === 'bet' || verb === 'raise') return 'cbet';
  if (verb === 'check') return 'check';
  return verb;
};

const HERO_IS_AGGRESSOR = ({ street, actionSequence, heroSeat, currentOrder, currentAction }) => {
  const verb = NORMALIZE_ACTION(currentAction);
  const earlier = (actionSequence || []).filter(
    (a) => a.street === street && (a.order ?? 0) < currentOrder,
  );
  const heroEarlier = earlier.find(
    (a) =>
      Number(a.seat) === Number(heroSeat)
      && (NORMALIZE_ACTION(a.action) === 'bet' || NORMALIZE_ACTION(a.action) === 'raise'),
  );
  if (heroEarlier) return true;
  return verb === 'bet' || verb === 'raise';
};

const HERO_IS_IN_POSITION = ({ heroSeat, villainSeats, buttonSeat, totalPlayers = 6 }) => {
  if (!heroSeat || !buttonSeat) return false;
  if (!Array.isArray(villainSeats) || villainSeats.length === 0) return true;
  const offsetOf = (seat) => ((seat - buttonSeat) % totalPlayers + totalPlayers) % totalPlayers;
  const heroOffset = offsetOf(heroSeat);
  return villainSeats.every((vs) => offsetOf(Number(vs)) > heroOffset);
};

const FACING_ACTION = ({ street, actionSequence, currentOrder }) => {
  const lastAgg = FIND_LAST_AGGRESSIVE_ACTION(actionSequence, street, currentOrder);
  if (!lastAgg) return 'none';
  return NORMALIZE_ACTION(lastAgg.action);
};

const DERIVE_PREFLOP_AGGRESSOR = ({ street, actionSequence, heroSeat }) => {
  // On preflop the action under analysis IS the preflop decision; the axis
  // is irrelevant to bucketing. Emit 'na' so preflop keys stay distinct
  // from postflop keys at the same axis position.
  if (street === 'preflop') return 'na';
  if (!Array.isArray(actionSequence)) return 'pfc';
  const heroPreflopActions = actionSequence.filter(
    (a) => a.street === 'preflop' && Number(a.seat) === Number(heroSeat),
  );
  // Hero is preflop aggressor if they bet or raised at any point preflop
  // (3bet / 4bet / open-raise). Calling, checking, or limping → caller.
  const wasAggressor = heroPreflopActions.some((a) => {
    const verb = NORMALIZE_ACTION(a.action);
    return verb === 'bet' || verb === 'raise';
  });
  return wasAggressor ? 'pfa' : 'pfc';
};

const computeActiveOpponentSeats = (actionSequence, heroSeat, currentStreet, currentOrder) => {
  if (!Array.isArray(actionSequence)) return [];
  const folded = new Set();
  for (const a of actionSequence) {
    if ((a.order ?? 0) > currentOrder) break;
    if (NORMALIZE_ACTION(a.action) === 'fold') folded.add(Number(a.seat));
  }
  const seenSeats = new Set();
  for (const a of actionSequence) {
    seenSeats.add(Number(a.seat));
  }
  return [...seenSeats].filter((s) => s !== Number(heroSeat) && !folded.has(s));
};

/**
 * Build a situation key for a hero decision.
 *
 * 8-axis format (extended from 7 in WS-146 SPR-040):
 *   street:texture:posCategory:isAgg:isIP:facingAction:contextAction:preflopAggressor
 *
 * `preflopAggressor` defaults to `'na'` for preflop streets (the action under
 * analysis IS the preflop decision) and `'pfc'` for postflop streets when
 * unspecified. Callers passing 7-axis args (without preflopAggressor) get a
 * sensible default; this preserves backward-compat for tests that haven't
 * been migrated yet.
 *
 * @param {object} parts - All 8 axes pre-derived.
 * @returns {string}
 */
export const buildHeroSituationKey = ({
  street,
  texture,
  posCategory,
  isAgg,
  isIP,
  facingAction,
  contextAction,
  preflopAggressor,
}) => {
  const pfa = preflopAggressor ?? (street === 'preflop' ? 'na' : 'pfc');
  return `${street}:${texture}:${posCategory}:${isAgg}:${isIP}:${facingAction}:${contextAction}:${pfa}`;
};

/**
 * Derive the situation key for a single hero action in a hand. Returns null
 * if required inputs are missing.
 *
 * @param {object} args
 * @param {object} args.hand               - Full hand record (or partial: cardState + gameState)
 * @param {object} args.actionEntry        - { seat, action, street, order, ... }
 * @param {number} args.heroSeat           - Hero's seat number
 * @param {number} args.buttonSeat         - Dealer button seat
 * @param {number} [args.totalPlayers=6]   - Player count (defaults 6)
 * @returns {string|null}
 */
export const deriveSituationKey = ({ hand, actionEntry, heroSeat, buttonSeat, totalPlayers = 6 }) => {
  if (!hand || !actionEntry || !heroSeat || !buttonSeat) return null;
  const actionSequence = hand?.gameState?.actionSequence || [];
  const street = actionEntry.street;
  const order = actionEntry.order ?? 0;

  const board = getBoardForStreet(hand?.cardState?.communityCards, street);
  const texture = DERIVE_TEXTURE(board);
  const posCategory = POS_CATEGORY_FOR_SEAT(heroSeat, buttonSeat, totalPlayers);

  const villainSeatsActive = computeActiveOpponentSeats(
    actionSequence,
    heroSeat,
    street,
    order,
  );
  const isIP = HERO_IS_IN_POSITION({
    heroSeat,
    villainSeats: villainSeatsActive,
    buttonSeat,
    totalPlayers,
  });

  const isAgg = HERO_IS_AGGRESSOR({
    street,
    actionSequence,
    heroSeat,
    currentOrder: order,
    currentAction: actionEntry.action,
  });

  const facingAction = FACING_ACTION({ street, actionSequence, currentOrder: order });

  const contextAction = DERIVE_CONTEXT_ACTION({
    street,
    action: actionEntry.action,
    actionSequence,
    order,
    isAgg,
  });

  const preflopAggressor = DERIVE_PREFLOP_AGGRESSOR({ street, actionSequence, heroSeat });

  return buildHeroSituationKey({
    street,
    texture,
    posCategory,
    isAgg: isAgg ? 'agg' : 'def',
    isIP: isIP ? 'ip' : 'oop',
    facingAction,
    contextAction,
    preflopAggressor,
  });
};

// Internal helpers exported for accumulator's bucket population (it needs
// these same primitives to count actions per hand).
export const _internals = {
  NORMALIZE_ACTION,
  POS_CATEGORY_FOR_SEAT,
  DERIVE_TEXTURE,
  DERIVE_PREFLOP_AGGRESSOR,
  getBoardForStreet,
  computeActiveOpponentSeats,
};

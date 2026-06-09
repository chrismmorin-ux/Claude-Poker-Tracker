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

// ─── Aggression-frequency decision derivation (WS-146 SPR-108) ───────────
//
// The 8-axis situation key buckets each hero ACTION by what was taken (a
// fold and a check route to different `contextAction` values). That makes
// fold-rate-over-a-vs-bet-defense decisions computable from one bucket, but
// NOT frequency-of-aggression decisions (cbet vs check live in separate
// buckets). This mirrors the deferred `hero-pf-open-overfold` blocker
// (catalog 2026-05-07): RFI fold + RFI open bucket to different keys.
//
// Resolution (catalog option b — additive parallel bucket type): a SEPARATE
// "decision bucket" aggregates across the action-taken for a single decision
// class, so cbetFrequency = aggress / (aggress + pass) is computable. The
// player-count dimension (`hu` vs `mw`) lives ONLY in this new bucket type —
// it does NOT fragment the 8-axis action buckets, so the 6 shipped action
// rules and their calibrations are untouched.
//
// v1 scope: flop cbet decision only (hero was the preflop aggressor and is
// first-in on the flop, choosing to continuation-bet or check). Coarse key
// (no texture/position split) maximizes sample size for the rarer multiway
// decision. Texture/position/3way-vs-4way+ splits are v2 expansions.

const PLAYERS_REMAINING_BUCKET = (villainCount) => (villainCount >= 2 ? 'mw' : 'hu');

/**
 * Derive the cbet-frequency decision for a single hero action, or null if the
 * action is not a flop cbet decision (hero-as-PFA, first-in on the flop).
 *
 * A cbet decision is: street===flop, hero was the preflop aggressor (`pfa`),
 * and hero is first-in on the flop (no prior aggression this street, so the
 * action's contextAction is `cbet` (hero bet/raised) or `check`). Facing a
 * bet (`vsBet`), or hero-as-preflop-caller (`pfc`), is NOT a cbet decision.
 *
 * @param {object} args - Same shape as deriveSituationKey().
 * @returns {{decisionKey: string, decisionClass: 'aggress'|'pass', playersRemaining: 'hu'|'mw', villainCount: number}|null}
 */
export const deriveCbetDecision = ({ hand, actionEntry, heroSeat, buttonSeat, totalPlayers = 6 }) => {
  if (!hand || !actionEntry || !heroSeat || !buttonSeat) return null;
  const street = actionEntry.street;
  if (street !== 'flop') return null; // v1: flop cbet decision only

  const actionSequence = hand?.gameState?.actionSequence || [];
  const order = actionEntry.order ?? 0;

  const preflopAggressor = DERIVE_PREFLOP_AGGRESSOR({ street, actionSequence, heroSeat });
  if (preflopAggressor !== 'pfa') return null; // only hero-as-PFA continuation decisions

  const isAgg = HERO_IS_AGGRESSOR({
    street,
    actionSequence,
    heroSeat,
    currentOrder: order,
    currentAction: actionEntry.action,
  });
  const contextAction = DERIVE_CONTEXT_ACTION({
    street,
    action: actionEntry.action,
    actionSequence,
    order,
    isAgg,
  });

  let decisionClass;
  if (contextAction === 'cbet') decisionClass = 'aggress';
  else if (contextAction === 'check') decisionClass = 'pass';
  else return null; // vsBet / unknown — hero is not first-in, not a cbet decision

  const villainCount = computeActiveOpponentSeats(actionSequence, heroSeat, street, order).length;
  const playersRemaining = PLAYERS_REMAINING_BUCKET(villainCount);

  return {
    decisionKey: `${street}:cbet-decision:${playersRemaining}`,
    decisionClass,
    playersRemaining,
    villainCount,
  };
};

// ─── Turn double-barrel frequency decision (WS-146 SPR-109) ──────────────
//
// The turn analogue of the cbet decision: hero was the preflop aggressor,
// continued (bet) the flop, and now faces the turn first-in (no bet/raise on
// the turn before hero's action). The choice to fire again (barrel) or check
// back is a frequency-of-aggression decision — cbet and check route to
// different `contextAction` keys, so the 8-axis action buckets can't compute
// a barrel FREQUENCY. This deriver feeds the parallel decision-bucket type.
//
// v1 scope (per leak-catalog #hero-turn-barrel-frequency): heads-up only
// (coarse single baseline maximizes sample; equity-shifter-card splits are
// v2). The `hu`/`mw` dimension lives in the decision key; the rule matches
// only `hu` for v1 (mirrors heroMultiwayBluffFrequency matching only `mw`).

const HERO_BET_OR_RAISED_STREET = (actionSequence, heroSeat, street) => {
  if (!Array.isArray(actionSequence)) return false;
  return actionSequence.some((a) => {
    if (a.street !== street) return false;
    if (Number(a.seat) !== Number(heroSeat)) return false;
    const verb = NORMALIZE_ACTION(a.action);
    return verb === 'bet' || verb === 'raise';
  });
};

/**
 * Derive the turn-barrel decision for a single hero action, or null if the
 * action is not a turn-barrel decision.
 *
 * A barrel decision is: street===turn, hero was the preflop aggressor
 * (`pfa`), hero bet/raised the flop (continued), and hero is first-in on the
 * turn (no prior aggression this street → contextAction is `cbet` for a bet
 * or `check`). Facing a turn bet (`vsBet`), not the PFA, or no flop bet, is
 * NOT a barrel decision.
 *
 * @param {object} args - Same shape as deriveSituationKey().
 * @returns {{decisionKey: string, decisionClass: 'aggress'|'pass', playersRemaining: 'hu'|'mw', villainCount: number}|null}
 */
export const deriveTurnBarrelDecision = ({ hand, actionEntry, heroSeat, buttonSeat, totalPlayers = 6 }) => {
  if (!hand || !actionEntry || !heroSeat || !buttonSeat) return null;
  const street = actionEntry.street;
  if (street !== 'turn') return null; // v1: turn barrel decision only

  const actionSequence = hand?.gameState?.actionSequence || [];
  const order = actionEntry.order ?? 0;

  const preflopAggressor = DERIVE_PREFLOP_AGGRESSOR({ street, actionSequence, heroSeat });
  if (preflopAggressor !== 'pfa') return null; // only hero-as-PFA barrel decisions

  // Hero must have continued (bet/raised) the flop — a barrel is a SECOND
  // bullet. A delayed cbet (checked flop, bet turn) is a different decision.
  if (!HERO_BET_OR_RAISED_STREET(actionSequence, heroSeat, 'flop')) return null;

  const isAgg = HERO_IS_AGGRESSOR({
    street,
    actionSequence,
    heroSeat,
    currentOrder: order,
    currentAction: actionEntry.action,
  });
  const contextAction = DERIVE_CONTEXT_ACTION({
    street,
    action: actionEntry.action,
    actionSequence,
    order,
    isAgg,
  });

  let decisionClass;
  if (contextAction === 'cbet') decisionClass = 'aggress'; // first-in bet on turn = barrel
  else if (contextAction === 'check') decisionClass = 'pass';
  else return null; // vsBet / unknown — hero is not first-in, not a barrel decision

  const villainCount = computeActiveOpponentSeats(actionSequence, heroSeat, street, order).length;
  const playersRemaining = PLAYERS_REMAINING_BUCKET(villainCount);

  return {
    decisionKey: `${street}:barrel-decision:${playersRemaining}`,
    decisionClass,
    playersRemaining,
    villainCount,
  };
};

// ─── Preflop RFI (raise-first-in) open-fold frequency decision (WS-146 SPR-109) ──
//
// Resolves the `hero-pf-open-overfold` blocker DEFERRED since SPR-046. When
// folded to hero preflop (pot unopened — hero is first-in), the choice is
// open-raise (aggress) vs fold (pass). The 8-axis action key buckets an RFI
// fold (contextAction `limp`) and an RFI open (contextAction `open`) under
// different keys, so the open FREQUENCY over the RFI decision space was not
// computable from one action bucket. The parallel decision-bucket type (the
// same path that resolved the cbet-frequency blocker) makes it computable.
//
// v1 scope (per leak-catalog #hero-pf-open-overfold):
//   - First-in only: any prior voluntary action (limp/call/raise) → null.
//     Limp is excluded (over-limp / iso decisions are separate future rules).
//   - Open-positions only: EARLY / MIDDLE / LATE / BUTTON. Blinds (SB/BB)
//     excluded — the SB RFI vs BB is a structurally different decision.
//   - Position-split decision key (RFI range size differs sharply by seat).

/**
 * Derive the preflop RFI open-fold decision for a single hero action, or null
 * if the action is not a clean RFI decision (first-in, non-blind, open-or-fold).
 *
 * @param {object} args - Same shape as deriveSituationKey().
 * @returns {{decisionKey: string, decisionClass: 'aggress'|'pass', posCategory: string}|null}
 */
export const deriveRfiDecision = ({ hand, actionEntry, heroSeat, buttonSeat, totalPlayers = 6 }) => {
  if (!hand || !actionEntry || !heroSeat || !buttonSeat) return null;
  const street = actionEntry.street;
  if (street !== 'preflop') return null; // RFI is a preflop decision

  const actionSequence = hand?.gameState?.actionSequence || [];
  const order = actionEntry.order ?? 0;

  // First-in check: no VOLUNTARY action (limp/call/raise/bet) by anyone before
  // hero this preflop. Only folds before → pot unopened → RFI. A prior limp or
  // raise means it's an iso/over-limp/3bet decision, not RFI (excluded v1).
  const priorVoluntary = actionSequence.some((a) => {
    if (a.street !== 'preflop') return false;
    if ((a.order ?? 0) >= order) return false;
    const verb = NORMALIZE_ACTION(a.action);
    return verb === 'call' || verb === 'raise' || verb === 'bet';
  });
  if (priorVoluntary) return null;

  const posCategory = POS_CATEGORY_FOR_SEAT(heroSeat, buttonSeat, totalPlayers);
  // v1 covers open-positions only. Blinds are a different decision class.
  if (posCategory !== 'EARLY' && posCategory !== 'MIDDLE'
      && posCategory !== 'LATE' && posCategory !== 'BUTTON') {
    return null;
  }

  const verb = NORMALIZE_ACTION(actionEntry.action);
  let decisionClass;
  if (verb === 'raise' || verb === 'bet') decisionClass = 'aggress'; // open-raise
  else if (verb === 'fold') decisionClass = 'pass'; // open-fold
  else return null; // limp (call) / check / unknown — excluded from the RFI decision v1

  return {
    decisionKey: `${street}:rfi-decision:${posCategory}`,
    decisionClass,
    posCategory,
  };
};

// Registry of decision derivers. Each maps a hero action to a decision-bucket
// contribution (aggress/pass for one decision class) or null. The accumulator
// iterates all of them per hero action; each is mutually exclusive by
// street/precondition, so at most one fires per action. Additive — adding a
// deriver here adds a decision-bucket type without touching existing buckets.
export const DECISION_DERIVERS = [
  deriveCbetDecision,
  deriveTurnBarrelDecision,
  deriveRfiDecision,
];

// Internal helpers exported for accumulator's bucket population (it needs
// these same primitives to count actions per hand).
export const _internals = {
  NORMALIZE_ACTION,
  POS_CATEGORY_FOR_SEAT,
  DERIVE_TEXTURE,
  DERIVE_PREFLOP_AGGRESSOR,
  PLAYERS_REMAINING_BUCKET,
  getBoardForStreet,
  computeActiveOpponentSeats,
};

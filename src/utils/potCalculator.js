/**
 * potCalculator.js - Pure utility for pot size tracking
 *
 * Calculates running pot total from action sequences and provides
 * sizing options for bet/raise actions.
 */

import { PRIMITIVE_ACTIONS } from '../constants/primitiveActions';

/**
 * Parse a gameType string like "1/2" into { sb, bb } amounts.
 * Returns { sb: 1, bb: 2 } for "1/2", defaults to { sb: 1, bb: 2 } if unparseable.
 *
 * @param {string|null} gameType - e.g. "1/2", "2/5", "5/10"
 * @returns {{ sb: number, bb: number }}
 */
export const parseBlinds = (gameType) => {
  if (!gameType || typeof gameType !== 'string') return { sb: 1, bb: 2 };
  const parts = gameType.split('/');
  if (parts.length !== 2) return { sb: 1, bb: 2 };
  const sb = parseFloat(parts[0]);
  const bb = parseFloat(parts[1]);
  if (isNaN(sb) || isNaN(bb) || sb <= 0 || bb <= 0) return { sb: 1, bb: 2 };
  return { sb, bb };
};

/**
 * Calculate pot total from an action sequence.
 *
 * Amount semantics (load-bearing — see INV-POT-RAISETO-IS-NOT-INCREMENT):
 * - CALL `amount` is the INCREMENT (amount owed) the seat adds.
 * - BET/RAISE/STRADDLE `amount` is the raise-TO LEVEL (the seat's cumulative
 *   contribution on that street), NOT an increment. Net new chips a raiser puts
 *   in = level − what they already had in this street. Adding the full level
 *   over-counts the pot whenever the seat already contributed (re-raises, or a
 *   blind seat raising).
 *
 * Pass `{ smallBlindSeat, bigBlindSeat }` so a blind seat that later raises/calls
 * is not double-counted (their blind is seeded as a prior preflop contribution).
 * Omitting them keeps the headline total correct for every flow except a blind
 * seat raising, where the total over-counts by the blind.
 *
 * @param {Array} actionSequence - Array of ActionEntry objects
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @param {{ smallBlindSeat?: number, bigBlindSeat?: number }} [opts] - Blind seats for exact per-seat seeding
 * @returns {{ total: number, currentBet: number, isEstimated: boolean }}
 */
export const calculatePot = (actionSequence, blinds, opts = {}) => {
  const { sb, bb } = blinds || { sb: 1, bb: 2 };
  const { smallBlindSeat, bigBlindSeat } = opts;
  let total = sb + bb;
  let currentBet = bb;
  let currentStreet = 'preflop';
  let isEstimated = false;
  // Per-seat contributions on the CURRENT street, used to derive raise increments
  // and call amounts. Seeded with blinds on preflop when blind seats are provided.
  const seedContribs = () => {
    const c = {};
    if (smallBlindSeat) c[smallBlindSeat] = sb;
    if (bigBlindSeat) c[bigBlindSeat] = bb;
    return c;
  };
  let seatContribs = seedContribs();

  if (!actionSequence || actionSequence.length === 0) {
    return { total, currentBet, isEstimated };
  }

  for (const entry of actionSequence) {
    // Reset on street change (blinds only seed preflop; post-flop starts empty)
    if (entry.street !== currentStreet) {
      currentStreet = entry.street;
      currentBet = 0;
      seatContribs = {};
    }

    switch (entry.action) {
      case PRIMITIVE_ACTIONS.FOLD:
      case PRIMITIVE_ACTIONS.CHECK:
        break;

      case PRIMITIVE_ACTIONS.CALL: {
        const alreadyIn = seatContribs[entry.seat] || 0;
        // CALL.amount is the increment; fall back to matching the current bet.
        const increment = entry.amount !== undefined
          ? entry.amount
          : Math.max(0, currentBet - alreadyIn);
        total += increment;
        seatContribs[entry.seat] = alreadyIn + increment;
        break;
      }

      case PRIMITIVE_ACTIONS.BET:
      case PRIMITIVE_ACTIONS.RAISE:
      case PRIMITIVE_ACTIONS.STRADDLE:
        if (entry.amount !== undefined) {
          // amount is the raise-TO level; net new chips = level − alreadyIn.
          const alreadyIn = seatContribs[entry.seat] || 0;
          total += Math.max(0, entry.amount - alreadyIn);
          currentBet = entry.amount;
          seatContribs[entry.seat] = entry.amount;
        } else {
          isEstimated = true;
        }
        break;

      default:
        break;
    }
  }

  return { total, currentBet, isEstimated };
};

/**
 * Pot size BEFORE each action in the sequence. Mirrors `calculatePot`'s walk
 * semantics exactly (street resets, auto-call matches current bet, straddle
 * raises the bet level) but emits a per-entry view instead of a final total.
 *
 * `estimated` flips true from the first amountless bet/raise/straddle onward —
 * downstream pot values are no longer trustworthy from that point. Consumers
 * converting amounts to pot fractions (anchor matcher bridge) must skip
 * conversion when `estimated` is set or `potBefore` is 0.
 *
 * @param {Array} actionSequence - Array of ActionEntry objects
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @returns {Array<{ potBefore: number, estimated: boolean }>} aligned by index
 */
export const calculatePotProgression = (actionSequence, blinds) => {
  const { sb, bb } = blinds || { sb: 1, bb: 2 };
  let total = sb + bb;
  let currentBet = bb;
  let currentStreet = 'preflop';
  let estimated = false;
  let seatContribs = {};
  const progression = [];

  if (!Array.isArray(actionSequence)) return progression;

  for (const entry of actionSequence) {
    if (!entry || typeof entry !== 'object') {
      progression.push({ potBefore: total, estimated });
      continue;
    }
    if (entry.street !== currentStreet) {
      currentStreet = entry.street;
      currentBet = 0;
      seatContribs = {};
    }

    progression.push({ potBefore: total, estimated });

    switch (entry.action) {
      case PRIMITIVE_ACTIONS.FOLD:
      case PRIMITIVE_ACTIONS.CHECK:
        break;

      case PRIMITIVE_ACTIONS.CALL: {
        const alreadyIn = seatContribs[entry.seat] || 0;
        const increment = entry.amount !== undefined
          ? entry.amount
          : Math.max(0, currentBet - alreadyIn);
        total += increment;
        seatContribs[entry.seat] = alreadyIn + increment;
        break;
      }

      case PRIMITIVE_ACTIONS.BET:
      case PRIMITIVE_ACTIONS.RAISE:
      case PRIMITIVE_ACTIONS.STRADDLE:
        if (entry.amount !== undefined) {
          // amount is the raise-TO level; net new chips = level − alreadyIn.
          const alreadyIn = seatContribs[entry.seat] || 0;
          total += Math.max(0, entry.amount - alreadyIn);
          currentBet = entry.amount;
          seatContribs[entry.seat] = entry.amount;
        } else {
          estimated = true;
        }
        break;

      default:
        break;
    }
  }

  return progression;
};

/**
 * Get the current bet amount on a given street from the action sequence.
 *
 * @param {Array} actionSequence - Array of ActionEntry objects
 * @param {string} street - Street to check
 * @returns {number} Current bet amount (0 if no bet)
 */
export const getCurrentBet = (actionSequence, street) => {
  if (!actionSequence) return 0;
  let currentBet = 0;

  for (const entry of actionSequence) {
    if (entry.street !== street) continue;
    if (
      (entry.action === PRIMITIVE_ACTIONS.BET ||
        entry.action === PRIMITIVE_ACTIONS.RAISE ||
        entry.action === PRIMITIVE_ACTIONS.STRADDLE) &&
      entry.amount !== undefined
    ) {
      currentBet = entry.amount;
    }
  }

  return currentBet;
};

/**
 * Calculate per-seat contribution on a given street.
 * Includes blind contributions on preflop.
 *
 * @param {Array} actionSequence - Array of ActionEntry objects
 * @param {string} street - Street to compute for
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @param {number} smallBlindSeat - SB seat number
 * @param {number} bigBlindSeat - BB seat number
 * @returns {Object} Map of seat number to total amount contributed on this street
 */
export const getSeatContributions = (actionSequence, street, blinds, smallBlindSeat, bigBlindSeat) => {
  const contributions = {};
  const { sb, bb } = blinds || { sb: 1, bb: 2 };

  // On preflop, blinds have forced contributions
  if (street === 'preflop') {
    if (smallBlindSeat) contributions[smallBlindSeat] = sb;
    if (bigBlindSeat) contributions[bigBlindSeat] = bb;
  }

  if (!actionSequence) return contributions;

  // Current bet on this street (for auto-calculating call amounts)
  let currentBet = street === 'preflop' ? bb : 0;

  for (const entry of actionSequence) {
    if (entry.street !== street) continue;

    switch (entry.action) {
      case PRIMITIVE_ACTIONS.CALL: {
        const alreadyIn = contributions[entry.seat] || 0;
        const increment = entry.amount !== undefined
          ? entry.amount
          : Math.max(0, currentBet - alreadyIn);
        contributions[entry.seat] = alreadyIn + increment;
        break;
      }
      case PRIMITIVE_ACTIONS.BET:
      case PRIMITIVE_ACTIONS.RAISE:
      case PRIMITIVE_ACTIONS.STRADDLE:
        if (entry.amount !== undefined) {
          // amount is the raise-TO level (the seat's cumulative street contribution),
          // not an increment — set, don't add. Adding double-counts re-raises and
          // blind seats that raise (see INV-POT-RAISETO-IS-NOT-INCREMENT).
          contributions[entry.seat] = entry.amount;
          currentBet = entry.amount;
        }
        break;
      default:
        break;
    }
  }

  return contributions;
};

/**
 * Sum each seat's TOTAL contribution across every street of the hand (including
 * preflop blinds). This is the input to side-pot layering — side pots are
 * determined by how many chips each player committed over the whole hand.
 *
 * @param {Array} actionSequence
 * @param {{ sb: number, bb: number }} blinds
 * @param {number} [smallBlindSeat]
 * @param {number} [bigBlindSeat]
 * @returns {Object} Map of seat number → total chips committed
 */
export const getTotalContributions = (actionSequence, blinds, smallBlindSeat, bigBlindSeat) => {
  const streets = ['preflop', 'flop', 'turn', 'river'];
  const totals = {};
  for (const street of streets) {
    const perStreet = getSeatContributions(actionSequence, street, blinds, smallBlindSeat, bigBlindSeat);
    for (const seatKey of Object.keys(perStreet)) {
      const seat = Number(seatKey);
      totals[seat] = (totals[seat] || 0) + perStreet[seatKey];
    }
  }
  return totals;
};

const sameSeatSet = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);

/**
 * Partition committed chips into a main pot plus side pots from the action
 * sequence. Side pots arise when all-in players commit different amounts: each
 * pot is contested only by the players who put in at least that layer's chips.
 *
 * Doctrine (Gate 2 roundtable, INV-POT-CONSERVATION): pots are DERIVED from the
 * recorded amounts — never entered. Folded players' chips are dead money (counted
 * in pot amounts) but those players are not eligible to win. A top layer with a
 * single contributor is an uncalled bet, returned to that seat (not a pot).
 *
 * @param {Array} actionSequence
 * @param {{ sb: number, bb: number }} blinds
 * @param {{ smallBlindSeat?: number, bigBlindSeat?: number }} [opts]
 * @returns {{
 *   pots: Array<{ amount: number, eligibleSeats: number[] }>,
 *   returned: number,
 *   returnedSeat: number|null,
 *   totalContributed: number,
 *   isEstimated: boolean
 * }} Main pot is pots[0]; eligibleSeats are the non-folded contributors.
 */
export const calculateSidePots = (actionSequence, blinds, opts = {}) => {
  const { smallBlindSeat, bigBlindSeat } = opts;
  const totals = getTotalContributions(actionSequence, blinds, smallBlindSeat, bigBlindSeat);

  const seq = actionSequence || [];
  const foldedSeats = new Set(
    seq.filter(e => e && e.action === PRIMITIVE_ACTIONS.FOLD).map(e => e.seat)
  );
  // Contributions are unreliable if any bet/raise lacked an amount (estimated pot).
  const isEstimated = seq.some(e =>
    e &&
    (e.action === PRIMITIVE_ACTIONS.BET ||
      e.action === PRIMITIVE_ACTIONS.RAISE ||
      e.action === PRIMITIVE_ACTIONS.STRADDLE) &&
    e.amount === undefined
  );

  const remaining = new Map();
  let totalContributed = 0;
  for (const seatKey of Object.keys(totals)) {
    const amt = totals[seatKey];
    if (amt > 0) {
      remaining.set(Number(seatKey), amt);
      totalContributed += amt;
    }
  }

  const pots = [];
  let returned = 0;
  let returnedSeat = null;
  const EPS = 1e-9;

  // Layer from the bottom up. Each iteration removes at least one all-in seat,
  // so the loop is bounded by the number of contributing seats.
  let guard = 0;
  while (guard++ < 64) {
    const contributors = [...remaining.entries()]
      .filter(([, amt]) => amt > EPS)
      .map(([seat]) => seat);
    if (contributors.length === 0) break;

    const eligibleContributors = contributors.filter(s => !foldedSeats.has(s));
    // Only folded money left — dead chips with no eligible winner (degenerate).
    if (eligibleContributors.length === 0) break;

    // An uncalled top bet (one lone contributor) is returned, not a pot.
    if (contributors.length === 1) {
      const s = contributors[0];
      returned += remaining.get(s);
      returnedSeat = s;
      remaining.set(s, 0);
      break;
    }

    // Layer height = smallest remaining among eligible (non-folded) contributors.
    const layer = Math.min(...eligibleContributors.map(s => remaining.get(s)));

    let amount = 0;
    for (const s of contributors) {
      const put = Math.min(remaining.get(s), layer);
      amount += put;
      remaining.set(s, remaining.get(s) - put);
    }

    pots.push({
      amount,
      eligibleSeats: [...eligibleContributors].sort((a, b) => a - b),
    });
  }

  // Collapse adjacent layers that share the same eligible set (e.g. a folded
  // seat capped a layer without changing who can win).
  const merged = [];
  for (const pot of pots) {
    const last = merged[merged.length - 1];
    if (last && sameSeatSet(last.eligibleSeats, pot.eligibleSeats)) {
      last.amount += pot.amount;
    } else {
      merged.push({ ...pot });
    }
  }

  return { pots: merged, returned, returnedSeat, totalContributed, isEstimated };
};

// =============================================================================
// RAKE & ANTE UTILITIES
// =============================================================================

/**
 * Estimate rake taken from a pot.
 *
 * Returns 0 when: rakeConfig is null/undefined, or street is preflop
 * and noFlopNoDrop is true (the standard "no flop, no drop" rule).
 * Otherwise: min(potSize * pct, cap).
 *
 * @param {number} potSize - Total pot at showdown
 * @param {object|null} rakeConfig - { pct: number (0-1), cap: number ($), noFlopNoDrop: boolean }
 * @param {string} [street='flop'] - Current street
 * @returns {number} Estimated rake amount
 */
export const estimateRake = (potSize, rakeConfig, street = 'flop') => {
  if (!rakeConfig || potSize <= 0) return 0;
  if (street === 'preflop' && rakeConfig.noFlopNoDrop) return 0;
  const { pct = 0, cap = Infinity } = rakeConfig;
  return Math.min(potSize * pct, cap);
};

/**
 * Calculate the starting pot from blinds and antes.
 *
 * Supports two ante formats:
 * - 'per-player': Each player posts an ante (online tournaments).
 *   Pot = sb + bb + (ante * seatCount)
 * - 'bb-ante': BB posts the ante in addition to their blind (live tournaments).
 *   Pot = sb + bb + ante
 *
 * @param {{ sb: number, bb: number }} blinds
 * @param {{ amount: number, format: 'per-player'|'bb-ante', seatCount: number }} [anteConfig]
 * @returns {number} Starting pot size
 */
export const calculateStartingPot = (blinds, anteConfig) => {
  const { sb = 0, bb = 0 } = blinds || {};
  let pot = sb + bb;
  if (anteConfig && anteConfig.amount > 0) {
    if (anteConfig.format === 'bb-ante') {
      pot += anteConfig.amount;
    } else {
      // Default: per-player
      pot += anteConfig.amount * (anteConfig.seatCount || 2);
    }
  }
  return pot;
};

// Default multiplier/fraction arrays for each sizing scenario
const DEFAULT_PREFLOP_OPEN = [2.5, 4, 5, 10];
const DEFAULT_PREFLOP_RAISE = [2, 3, 4, 5];
const DEFAULT_POSTFLOP_BET = [0.25, 0.5, 0.75, 1.0];
const DEFAULT_POSTFLOP_RAISE = [2, 3, 4, 5];

// Labels for pot fraction sizing
const fractionLabel = (f) => {
  if (f === 0.25) return '1/4';
  if (f === 0.5) return '1/2';
  if (f === 0.75) return '3/4';
  if (f === 1.0) return '1x';
  return `${f}x`;
};

/**
 * Get sizing option buttons for bet/raise actions.
 *
 * @param {string} street - Current street
 * @param {string} actionType - 'bet' or 'raise'
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @param {number} potTotal - Current pot total
 * @param {number} currentBet - Current bet to face
 * @param {number[]|null} customMultipliers - Optional custom multipliers/fractions to override defaults
 * @returns {Array<{ label: string, amount: number }>}
 */
export const getSizingOptions = (street, actionType, blinds, potTotal, currentBet, customMultipliers) => {
  const { bb } = blinds || { sb: 1, bb: 2 };

  if (street === 'preflop') {
    if (actionType === PRIMITIVE_ACTIONS.RAISE && currentBet <= bb) {
      // Preflop open (facing only blinds)
      const mults = customMultipliers || DEFAULT_PREFLOP_OPEN;
      return mults.map(m => ({ label: `${m}x`, amount: Math.round(bb * m) }));
    }
    // Preflop raise facing a bet
    const mults = customMultipliers || DEFAULT_PREFLOP_RAISE;
    return mults.map(m => ({ label: `${m}x`, amount: Math.round(currentBet * m) }));
  }

  // Postflop
  if (actionType === PRIMITIVE_ACTIONS.BET) {
    // Bet into pot (no current bet)
    const pot = potTotal || 1;
    const fracs = customMultipliers || DEFAULT_POSTFLOP_BET;
    return fracs.map(f => ({ label: fractionLabel(f), amount: Math.round(pot * f) }));
  }

  // Raise facing a bet (postflop)
  const mults = customMultipliers || DEFAULT_POSTFLOP_RAISE;
  return mults.map(m => ({ label: `${m}x`, amount: Math.round(currentBet * m) }));
};

/**
 * Get minimum legal raise amount for the current action sequence.
 * In NL holdem: min raise = currentBet + lastRaiseIncrement.
 *
 * @param {Array} actionSequence - Array of ActionEntry objects
 * @param {string} street - Current street
 * @param {{ sb: number, bb: number }} blinds - Blind amounts
 * @returns {number} Minimum legal raise-to amount
 */
export const getMinRaise = (actionSequence, street, blinds) => {
  const { bb } = blinds || { sb: 1, bb: 2 };
  let previousBet = 0;
  let currentBet = street === 'preflop' ? bb : 0;

  if (actionSequence) {
    for (const entry of actionSequence) {
      if (entry.street !== street) continue;
      if (
        (entry.action === PRIMITIVE_ACTIONS.BET ||
          entry.action === PRIMITIVE_ACTIONS.RAISE ||
          entry.action === PRIMITIVE_ACTIONS.STRADDLE) &&
        entry.amount !== undefined
      ) {
        previousBet = currentBet;
        currentBet = entry.amount;
      }
    }
  }

  const lastIncrement = currentBet - previousBet;
  return currentBet + Math.max(lastIncrement, bb);
};

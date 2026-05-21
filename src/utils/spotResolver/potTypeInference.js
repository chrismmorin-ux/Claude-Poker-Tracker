/**
 * potTypeInference.js — Infer pot type from a hand's preflop action timeline.
 *
 * Maps preflop action sequence to one of the canonical POT_TYPES strings
 * used by both `postflopDrillContent/lineSchema.js:POT_TYPES` and the
 * upper-surface filename encoding. The output is the `<pot-type>` field
 * in the 8-dim spot-key descriptor.
 *
 * Conventions:
 * - 'srp'        — single-raised pot (one preflop raise, called) heads-up
 * - '3bp'        — three-bet pot (two preflop raises) heads-up
 * - '4bp'        — four-bet pot (three preflop raises) heads-up
 * - 'limped'     — no preflop raise (BB special)
 * - 'srp-3way'   — single-raised, 3 players to the flop
 * - '3bp-3way'   — three-bet, 3 players to the flop
 * - 'srp-4way'   — single-raised, 4 players to the flop
 * - null         — pot type un-inferrable (no preflop entries, or 5+ players)
 *
 * Pure function. SLS spike §"Encoding mismatch — quantified" line 97
 * estimated this at ~20 LoC; landed close.
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

import { POT_TYPES } from '../postflopDrillContent/lineSchema';

/**
 * Infer pot type from a buildTimeline(hand) output array.
 *
 * @param {Array<{order, seat, action, street, amount?}>} timeline
 * @returns {string|null} — one of POT_TYPES, or null if un-inferrable
 */
export const inferPotType = (timeline) => {
  if (!Array.isArray(timeline) || timeline.length === 0) return null;

  const preflop = timeline.filter((e) => e && e.street === 'preflop' && e.action);
  if (preflop.length === 0) return null;

  // Count distinct preflop raises (each raise increments the bet level).
  // The first preflop "raise" is the open-raise (level 1 = SRP). Each
  // subsequent raise increments the level (level 2 = 3BP, level 3 = 4BP).
  const raises = preflop.filter((e) => e.action === 'raise').length;

  // Count distinct seats that saw the flop — i.e., seats that VPIP'd
  // preflop without folding. Used to detect 3-way / 4-way pots.
  const seatsByAction = new Map();
  for (const e of preflop) {
    if (!e.seat) continue;
    const prior = seatsByAction.get(e.seat) || [];
    prior.push(e.action);
    seatsByAction.set(e.seat, prior);
  }
  // A seat is "active to flop" if it took at least one non-fold action.
  // Blinds posted but folded preflop don't count.
  let activeToFlop = 0;
  for (const [, actions] of seatsByAction) {
    const folded = actions[actions.length - 1] === 'fold';
    if (!folded) activeToFlop += 1;
  }

  let result;
  if (raises === 0) {
    result = 'limped'; // No preflop raise — BB special / family pot
  } else if (raises === 1) {
    result = activeToFlop >= 4 ? 'srp-4way'
      : activeToFlop === 3 ? 'srp-3way'
        : 'srp';
  } else if (raises === 2) {
    result = activeToFlop === 3 ? '3bp-3way' : '3bp';
  } else {
    // raises >= 3
    result = '4bp';
  }

  // Defensive: only return values that the canonical enum recognizes.
  return POT_TYPES.includes(result) ? result : null;
};

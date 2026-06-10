/**
 * deriveLiveSituation.js — Build matcher `situation` from live game state.
 *
 * Per `docs/projects/exploit-anchor-library/exploit-anchor-library.project.md`
 * Stream C, this produces the structured input that `getMatchingAnchors` (Stream B
 * matcher) consumes. Pure transform — no React, no IDB.
 *
 * Walks `actionSequence` (gameReducer-shaped entries: `{seat, street, action, amount?}`)
 * and groups by street, extracting the focused villain's and hero's actions per
 * street as the last bet/raise/call/check on that street.
 *
 * Per `matcher.js:35-60` the `situation` shape is:
 *
 *     {
 *       villainStyle?,
 *       actionHistory: { preflop?, flop?, turn?, river? }
 *     }
 *
 * Each street entry carries `{ heroAction?, villainAction?, board?, spr? }`.
 * Anchor-side absent fields are wildcards (matcher rule), so providing only a
 * subset of fields is fine — the matcher will still match anchors whose steps
 * don't constrain the missing fields.
 *
 * Sizing convention (matches anchor `sizingRange` semantics, schema-delta §2.2 +
 * POKER_THEORY §6.2): pot-fraction at decision time — `amount / potBefore`,
 * where potBefore comes from `calculatePotProgression`. Raises use the
 * raise-to amount over the pot before the raise. FAIL-SAFE: when blinds are
 * unavailable or the pot is estimated/zero (an earlier bet lacked an amount),
 * sizing is OMITTED — sizing-constrained anchor steps then don't fire, rather
 * than firing on a wrong number.
 *
 * Board conditions are derived per street from `communityCards` via
 * `deriveAnchorBoardCondition` (anchor texture vocabulary + turn/river
 * scareKind). Streets whose board prefix isn't fully entered carry no board
 * slot; the matcher treats no-effective-demand conditions ('any') as matching.
 *
 * v1 scope:
 *   - spr is omitted (v2 work — requires effective stack accounting)
 *
 * AP-07 / Red Line #8 implications: this module produces only the matcher input;
 * it does NOT render anything. Output is not the live-surface payload.
 */

import { ACTIONS } from '../../constants/gameConstants';
import { calculatePotProgression } from '../potCalculator';
import { deriveAnchorBoardCondition } from './deriveAnchorBoardCondition';

const STREETS = Object.freeze(['preflop', 'flop', 'turn', 'river']);

// gameReducer ACTIONS map preflop/postflop variants to the same conceptual
// kinds the matcher expects ('check' | 'bet' | 'raise' | 'call' | 'fold').
// Anchor lineSequence steps use the conceptual kind, not the gameReducer
// action constant — this map normalizes.
const ACTION_KIND_MAP = Object.freeze({
  // Bets / raises — sizing is read from `amount` when present
  bet: 'bet',
  raise: 'raise',
  cbet: 'bet',
  donk: 'bet',
  '3bet': 'raise',
  '4bet': 'raise',
  '5bet': 'raise',
  cbetraise: 'raise',
  // Calls
  call: 'call',
  callcbet: 'call',
  callraise: 'call',
  // Checks
  check: 'check',
  // Folds — usually filter villains out before reaching matcher, but support
  // for completeness
  [ACTIONS.FOLD]: 'fold',
  [ACTIONS.FOLD_TO_CR]: 'fold',
  [ACTIONS.FOLD_TO_CBET]: 'fold',
});

/** Round pot fractions for stable comparisons and snapshots. */
const roundSizing = (n) => Number(n.toFixed(4));

/**
 * Normalize a raw action constant to the conceptual kind the matcher expects.
 * Returns null for unmappable actions (showdown actions, MUCKED, WON, etc.).
 */
const normalizeKind = (rawAction) => {
  if (typeof rawAction !== 'string') return null;
  const lower = rawAction.toLowerCase();
  if (ACTION_KIND_MAP[lower]) return ACTION_KIND_MAP[lower];
  if (ACTION_KIND_MAP[rawAction]) return ACTION_KIND_MAP[rawAction];
  return null;
};

/**
 * Given a street's action entries, find the most recent meaningful action by a
 * specific seat. "Meaningful" excludes folds (folded villains are filtered
 * upstream; including a fold would cause matcher false-positives on
 * fold-action anchors that aren't intended to fire here).
 *
 * Sizing is attached as a pot-fraction only when the pot before the action is
 * known and trustworthy (see module doc, fail-safe rule).
 */
const findLastActionForSeat = (streetEntries, seat, progression) => {
  if (!Array.isArray(streetEntries) || typeof seat !== 'number') return null;
  for (let i = streetEntries.length - 1; i >= 0; i--) {
    const { entry, index } = streetEntries[i];
    if (!entry || entry.seat !== seat) continue;
    const kind = normalizeKind(entry.action);
    if (!kind || kind === 'fold') continue;
    const actionRecord = { kind };
    if (typeof entry.amount === 'number' && entry.amount >= 0 && progression) {
      const pot = progression[index];
      if (pot && !pot.estimated && pot.potBefore > 0) {
        actionRecord.sizing = roundSizing(entry.amount / pot.potBefore);
      }
    }
    return actionRecord;
  }
  return null;
};

/**
 * Group an action sequence into per-street arrays of `{entry, index}` where
 * `index` is the entry's position in the full sequence (aligns with the pot
 * progression array).
 */
const groupByStreet = (actionSequence) => {
  const grouped = { preflop: [], flop: [], turn: [], river: [] };
  if (!Array.isArray(actionSequence)) return grouped;
  for (let index = 0; index < actionSequence.length; index++) {
    const entry = actionSequence[index];
    if (!entry || typeof entry !== 'object') continue;
    const s = entry.street;
    if (s in grouped) {
      grouped[s].push({ entry, index });
    }
  }
  return grouped;
};

/**
 * Build the matcher `situation` from current live game state.
 *
 * @param {Object} params
 * @param {Array} params.actionSequence — gameReducer action entries `{seat, street, action, amount?}`
 * @param {string} params.currentStreet — 'preflop' | 'flop' | 'turn' | 'river'
 * @param {number|null} params.heroSeat
 * @param {number|null} params.villainSeat
 * @param {string|null} params.villainStyle — 'Nit' | 'LAG' | 'TAG' | 'Fish' | etc.
 * @param {{sb: number, bb: number}|null} params.blinds — blind amounts in the
 *        same units as actionSequence amounts; absent → sizing omitted
 * @param {string[]|null} params.communityCards — raw card strings (5-slot
 *        array); absent → board slots omitted
 * @returns {Object} situation
 */
export const deriveLiveSituation = ({
  actionSequence,
  currentStreet,
  heroSeat,
  villainSeat,
  villainStyle,
  blinds,
  communityCards,
}) => {
  const situation = {
    actionHistory: {},
  };

  if (typeof villainStyle === 'string' && villainStyle.length > 0) {
    situation.villainStyle = villainStyle;
  }

  if (!STREETS.includes(currentStreet)) {
    return situation;
  }

  const blindsUsable = blinds
    && typeof blinds.sb === 'number' && blinds.sb > 0
    && typeof blinds.bb === 'number' && blinds.bb > 0;
  const progression = blindsUsable
    ? calculatePotProgression(actionSequence, blinds)
    : null;

  const grouped = groupByStreet(actionSequence);
  const currentIndex = STREETS.indexOf(currentStreet);

  // Walk every street up to and including the current one. Only include
  // streets that have at least one action; absent streets stay absent in
  // actionHistory (the matcher treats them as "hasn't happened yet").
  for (let i = 0; i <= currentIndex; i++) {
    const street = STREETS[i];
    const streetEntries = grouped[street];
    if (!Array.isArray(streetEntries) || streetEntries.length === 0) continue;

    const entry = {};

    const heroAction = findLastActionForSeat(streetEntries, heroSeat, progression);
    if (heroAction) entry.heroAction = heroAction;

    const villainAction = findLastActionForSeat(streetEntries, villainSeat, progression);
    if (villainAction) entry.villainAction = villainAction;

    const board = deriveAnchorBoardCondition(communityCards, street);
    if (board) entry.board = board;

    if (Object.keys(entry).length > 0) {
      situation.actionHistory[street] = entry;
    }
  }

  return situation;
};

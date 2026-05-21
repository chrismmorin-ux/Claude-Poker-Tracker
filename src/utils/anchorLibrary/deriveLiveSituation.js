/**
 * deriveLiveSituation.js — Build matcher `situation` from live game state.
 *
 * Per `docs/projects/exploit-anchor-library/exploit-anchor-library.project.md`
 * Stream C, this produces the structured input that `getMatchingAnchors` (Stream B
 * matcher) consumes. Pure transform — no React, no IDB.
 *
 * Walks `actionSequence` (gameReducer-shaped entries: `{seat, street, action, amount?}`)
 * and groups by street, extracting the focused villain's and hero's actions per
 * street as the last bet/raise/call/check on that street. Texture (when known
 * for the current street) is folded into the matching street's board condition.
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
 * v1 scope:
 *   - heroAction / villainAction kind + sizing extracted from actionSequence
 *   - board.texture from current-street boardTexture (when supplied)
 *   - spr is omitted (v2 work — requires effective stack accounting)
 *
 * AP-07 / Red Line #8 implications: this module produces only the matcher input;
 * it does NOT render anything. Output is not the live-surface payload.
 */

import { ACTIONS } from '../../constants/gameConstants';

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
 */
const findLastActionForSeat = (streetEntries, seat) => {
  if (!Array.isArray(streetEntries) || typeof seat !== 'number') return null;
  for (let i = streetEntries.length - 1; i >= 0; i--) {
    const entry = streetEntries[i];
    if (!entry || entry.seat !== seat) continue;
    const kind = normalizeKind(entry.action);
    if (!kind || kind === 'fold') continue;
    const actionRecord = { kind };
    // Sizing in pot-fraction terms. v1 stores raw amount; the matcher's
    // sizingRange check requires a number, so we pass through. Callers that
    // know pot size at the action-time may want to convert before this call.
    if (typeof entry.amount === 'number' && entry.amount >= 0) {
      actionRecord.sizing = entry.amount;
    }
    return actionRecord;
  }
  return null;
};

/**
 * Group an action sequence into per-street arrays. Returns a frozen object
 * keyed by street with sorted entries (sequence order preserved).
 */
const groupByStreet = (actionSequence) => {
  const grouped = { preflop: [], flop: [], turn: [], river: [] };
  if (!Array.isArray(actionSequence)) return grouped;
  for (const entry of actionSequence) {
    if (!entry || typeof entry !== 'object') continue;
    const s = entry.street;
    if (s in grouped) {
      grouped[s].push(entry);
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
 * @param {Object|null} params.boardTexture — { texture, scareKind } for current street
 * @returns {Object} situation
 */
export const deriveLiveSituation = ({
  actionSequence,
  currentStreet,
  heroSeat,
  villainSeat,
  villainStyle,
  boardTexture,
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

    const heroAction = findLastActionForSeat(streetEntries, heroSeat);
    if (heroAction) entry.heroAction = heroAction;

    const villainAction = findLastActionForSeat(streetEntries, villainSeat);
    if (villainAction) entry.villainAction = villainAction;

    // Board texture only applied to the current street; older streets'
    // textures aren't tracked in v1. Matcher's anchor 'any' texture is a
    // wildcard so the minimum case still works.
    if (street === currentStreet && boardTexture && typeof boardTexture === 'object') {
      const board = {};
      if (typeof boardTexture.texture === 'string') board.texture = boardTexture.texture;
      if (typeof boardTexture.scareKind === 'string') board.scareKind = boardTexture.scareKind;
      if (Object.keys(board).length > 0) entry.board = board;
    }

    if (Object.keys(entry).length > 0) {
      situation.actionHistory[street] = entry;
    }
  }

  return situation;
};

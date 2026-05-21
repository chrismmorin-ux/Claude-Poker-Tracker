/**
 * nodeClassifier.js — Classify a postflop decision into a canonical
 * node_id matching the upper-surface filename + LSW lines.js vocabulary.
 *
 * The canonical vocabulary (extracted from lines.js + reasoning-artifacts):
 *   Flop:   'flop_root'
 *   Turn:   'turn_after_cbet', 'turn_after_call', 'turn_after_check',
 *           'turn_after_checkback', 'turn_brick', 'turn_brick_v_checkraises',
 *           'turn_checked_back'
 *   River:  'river_after_barrel', 'river_after_flop_checkback',
 *           'river_after_turn_call', 'river_after_turn_checkback',
 *           'river_brick_v_calls', 'river_checkback',
 *           'river_after_mw_barrel'
 *
 * Inputs:
 *   street          — 'flop' | 'turn' | 'river'
 *   actionPrefix    — array of {actor, action, street} ordered chronologically
 *                     from the start of postflop (flop forward) to just before
 *                     the decision being classified
 *   boardTransition — {prevTexture, currTexture, brickness} optional context
 *                     for distinguishing brick vs danger turn/river cards
 *
 * Returns:
 *   canonical node_id string OR null when the decision sequence doesn't
 *   map to a known vocabulary entry. Null cascades to `confidence:
 *   'no-analog'` at the orchestrator.
 *
 * Per spike line 174 (LSW node-id drift guard): when lines.js renames a
 * node, the corresponding test must fail. Tests reference live LINES.
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

/**
 * Filter actionPrefix down to entries on a specific street.
 */
const onStreet = (prefix, street) =>
  Array.isArray(prefix) ? prefix.filter((e) => e && e.street === street) : [];

/**
 * Find the most recent VILLAIN action on a given street.
 * Returns the action kind ('bet'|'check'|'raise'|'call'|'fold') or null.
 */
const lastVillainAction = (streetEntries, heroSeat) => {
  for (let i = streetEntries.length - 1; i >= 0; i--) {
    const e = streetEntries[i];
    if (!e) continue;
    if (String(e.actor) === String(heroSeat)) continue;
    return e.action || null;
  }
  return null;
};

/**
 * Detect whether the hero or villain check-raised on a given street.
 * Returns true if the street action contains 'raise' after a 'bet'/'cbet'.
 */
const sawCheckRaise = (streetEntries) => {
  let sawBet = false;
  for (const e of streetEntries) {
    if (!e) continue;
    if (e.action === 'bet' || e.action === 'cbet') sawBet = true;
    if (sawBet && e.action === 'raise') return true;
  }
  return false;
};

/**
 * Classify a postflop decision into a canonical node_id.
 *
 * @param {Object} params
 * @param {'flop'|'turn'|'river'} params.street
 * @param {Array<{actor, action, street}>} params.actionPrefix
 * @param {string|number} params.heroSeat
 * @param {Object} [params.boardTransition]
 * @returns {string|null}
 */
export const classifyNode = ({
  street,
  actionPrefix,
  heroSeat,
  // boardTransition is reserved for future brick/danger detection; v1
  // uses action-history-only classification per spike scope.
}) => {
  if (!street) return null;

  if (street === 'flop') {
    // Every postflop hand's flop decision (first action) maps to flop_root.
    // No further disambiguation needed at v1.
    return 'flop_root';
  }

  if (street === 'turn') {
    const flopEntries = onStreet(actionPrefix, 'flop');
    if (flopEntries.length === 0) return null;

    const flopHadCheckRaise = sawCheckRaise(flopEntries);
    if (flopHadCheckRaise) {
      // Check-raised flop → unusual line, no specific v1 corpus node for the
      // turn after a flop check-raise. Falls through to no-analog.
      return null;
    }

    const lastFlopVillain = lastVillainAction(flopEntries, heroSeat);

    // turn_after_check: villain checked the flop, action goes to turn
    //   (typically villain checks → hero checks back → turn = checked-through OR
    //    villain checks → hero bets → villain calls → turn)
    // turn_after_call: villain called hero's flop bet/cbet → turn
    // turn_after_cbet: hero c-bet flop and got called → turn (same as turn_after_call from
    //   villain's perspective; LSW uses turn_after_call for that)
    // turn_checked_back: villain checked → hero checked back → turn
    // turn_after_checkback: same as turn_checked_back in some lines; check both

    // The most-discriminating signal: did the villain call on the flop?
    if (lastFlopVillain === 'call') return 'turn_after_call';

    // If villain checked AND hero also checked, turn_checked_back / turn_after_checkback
    if (lastFlopVillain === 'check') {
      // Check if hero also checked (no flop bet from hero in prefix entries).
      const heroBetFlop = flopEntries.some((e) =>
        String(e.actor) === String(heroSeat) && (e.action === 'bet' || e.action === 'cbet'),
      );
      if (!heroBetFlop) return 'turn_checked_back';
      // Hero bet, villain checked first then called: turn_after_call covers it
      return 'turn_after_call';
    }

    // Villain bet/raised on flop, somehow we're now on turn → ambiguous; null
    return null;
  }

  if (street === 'river') {
    const turnEntries = onStreet(actionPrefix, 'turn');
    if (turnEntries.length === 0) {
      // No turn action means the line skipped a street — invalid input.
      return null;
    }

    const lastTurnVillain = lastVillainAction(turnEntries, heroSeat);
    const turnHadCheckRaise = sawCheckRaise(turnEntries);
    if (turnHadCheckRaise) return null; // unusual line, no v1 corpus

    // Most-common path: hero bet turn (barrel) and got called → river_after_barrel
    const heroBarreled = turnEntries.some((e) =>
      String(e.actor) === String(heroSeat) && (e.action === 'bet' || e.action === 'cbet'),
    );
    if (heroBarreled && lastTurnVillain === 'call') return 'river_after_barrel';

    // Turn checked through: villain checked, hero checked back → river_after_turn_checkback
    if (lastTurnVillain === 'check') {
      const heroBetTurn = turnEntries.some((e) =>
        String(e.actor) === String(heroSeat) && (e.action === 'bet' || e.action === 'cbet'),
      );
      if (!heroBetTurn) return 'river_after_turn_checkback';
    }

    // Turn called by villain after hero's bet → river_after_turn_call
    if (lastTurnVillain === 'call') return 'river_after_turn_call';

    // Villain bet turn, hero called → river_brick_v_calls (also covers checked-back turn → river)
    if (lastTurnVillain === 'bet') return 'river_brick_v_calls';

    return null;
  }

  return null;
};

/**
 * Convenience: all known canonical node IDs. Used by tests to assert
 * the classifier output is within the recognized vocabulary.
 */
export const CANONICAL_NODE_IDS = Object.freeze([
  // Flop
  'flop_root',
  // Turn
  'turn_after_cbet', 'turn_after_call', 'turn_after_check',
  'turn_after_checkback', 'turn_brick', 'turn_brick_v_checkraises',
  'turn_checked_back',
  // River
  'river_after_barrel', 'river_after_flop_checkback',
  'river_after_turn_call', 'river_after_turn_checkback',
  'river_brick_v_calls', 'river_checkback',
  'river_after_mw_barrel',
]);

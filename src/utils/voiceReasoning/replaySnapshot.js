/**
 * voiceReasoning/replaySnapshot.js — state binding for Voice Reasoning Notes (VRN)
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 * Gate 2 findings: C-1 (continuous binding), Gate 1 observation 2 (never infer)
 *
 * Pure function. No side effects, no state, no IDB.
 *
 * Builds the immutable context object stamped onto each narration segment — the
 * exact state that was on screen when the founder spoke those words. This is the
 * whole point of the feature: a claim with its conditioning set attached is
 * evidence; a claim without it is a diary entry.
 *
 * BINDING RULE (Gate 1 observation 2): a field the app does not track is `null`,
 * never inferred. A grader that checks a claim against a guessed value is worse
 * than no grader. Per-seat stacks are NOT tracked in the live cash path, so
 * `stacks` is null there and stack/SPR claims come back `not-checkable`.
 *
 * Output must be JSON-serializable for IDB — no Map, no Set, no undefined.
 */

/**
 * Convert the replay `seatStates` Map into a plain, serializable object and
 * derive which seats are still live at this point in the hand.
 *
 * @param {Map<number, {lastAction: string, hasFolded: boolean, totalBet: number}>} seatStates
 * @returns {{ seats: Object, seatsLive: number[] }}
 */
const serializeSeatStates = (seatStates) => {
  const seats = {};
  const seatsLive = [];
  if (!seatStates || typeof seatStates.forEach !== 'function') {
    return { seats, seatsLive };
  }
  seatStates.forEach((state, seat) => {
    const seatNum = Number(seat);
    seats[seatNum] = {
      lastAction: state?.lastAction ?? null,
      hasFolded: !!state?.hasFolded,
      totalBet: Number(state?.totalBet) || 0,
    };
    if (!state?.hasFolded) seatsLive.push(seatNum);
  });
  seatsLive.sort((a, b) => a - b);
  return { seats, seatsLive };
};

/**
 * Reduce a timeline entry to the fields worth persisting on a note. The full
 * timeline already lives on the hand record; the snapshot only needs enough to
 * make the segment self-describing when read back.
 */
const serializeAction = (entry) => {
  if (!entry) return null;
  return {
    seat: Number(entry.seat),
    action: entry.action ?? null,
    amount: Number(entry.amount) || 0,
    street: entry.street ?? null,
  };
};

/**
 * Build the per-segment context object from the replay cursor.
 *
 * Sources everything from `useReplayState`'s return value, which already derives
 * `communityCardsAtPoint` and `potAtPoint` at the cursor — no re-derivation here.
 *
 * @param {Object} replayState — the object returned by useReplayState()
 * @param {Object|null} selectedHand — the hand record being replayed
 * @returns {Object} JSON-serializable context
 */
export function buildReplaySnapshot(replayState = {}, selectedHand = null) {
  const {
    currentActionIndex = -1,
    currentStreet = 'preflop',
    communityCardsAtPoint = [],
    potAtPoint = 0,
    currentActionEntry = null,
    visibleActions = [],
    seatStates = null,
    timelineLength = 0,
  } = replayState;

  const { seats, seatsLive } = serializeSeatStates(seatStates);

  const heroSeat = selectedHand?.gameState?.mySeat ?? null;
  const allPlayerCards =
    selectedHand?.cardState?.allPlayerCards ||
    selectedHand?.gameState?.allPlayerCards ||
    null;

  // Hero cards are only included when both slots are actually filled. A
  // half-entered hand yields null rather than a partial hand nobody can reason
  // about later.
  let heroCards = null;
  if (heroSeat !== null && allPlayerCards) {
    const cards = allPlayerCards[heroSeat];
    if (Array.isArray(cards) && cards[0] && cards[1]) {
      heroCards = [cards[0], cards[1]];
    }
  }

  return {
    // Where in the hand
    street: currentStreet,
    actionIndex: Number(currentActionIndex),
    timelineLength: Number(timelineLength) || 0,

    // What was visible
    board: Array.isArray(communityCardsAtPoint) ? [...communityCardsAtPoint] : [],
    heroSeat,
    heroCards,

    // Pot geometry — pot IS tracked; stacks are NOT (see binding rule above)
    pot: Number(potAtPoint) || 0,
    stacks: null,
    spr: null,

    // Who is still in it
    seats,
    seatsLive,
    playersLive: seatsLive.length,

    // Immediate action context
    currentAction: serializeAction(currentActionEntry),
    actionsSoFar: Array.isArray(visibleActions) ? visibleActions.length : 0,
  };
}

/**
 * Cheap equality check used to decide whether the founder has navigated to a new
 * point in the hand mid-narration, which appends a context marker to the session
 * timeline (Gate 2 C-1 — continuous binding rather than a staleness flag).
 *
 * Compares only the cursor, not the derived payload — the cursor determines
 * everything else.
 */
export function isSameReplayPoint(a, b) {
  if (!a || !b) return a === b;
  return a.actionIndex === b.actionIndex && a.street === b.street;
}

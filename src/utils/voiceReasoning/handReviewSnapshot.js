/**
 * voiceReasoning/handReviewSnapshot.js — state binding for the Hand Review walkthrough
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 *
 * Pure function. Sibling of `replaySnapshot.js`, for the other surface the
 * founder narrates from.
 *
 * THE TWO SURFACES HAVE DIFFERENT GRANULARITY, AND THAT MATTERS.
 * HandReplayView steps action-by-action, so "the pot" is exact at the cursor.
 * The Hand Review walkthrough steps STREET-by-street, so "the pot" is ambiguous
 * unless you say which moment you mean. Rather than pick one silently, every
 * snapshot carries `potBasis` naming what the number is conditioned on:
 *
 *   'street-start' — blinds + every action on prior streets (no action focused)
 *   'action'       — pot through the focused action, inclusive
 *
 * This follows the standing rule that a number travels with its conditional. A
 * grader that reads `pot` without reading `potBasis` is reading a different
 * quantity than the one recorded.
 *
 * Same binding rule as the replay sibling: a field the app does not track is
 * `null`, never inferred.
 */

/**
 * Pot arithmetic, mirroring useReplayState's `potAtPoint` exactly (blinds plus
 * the summed amounts of the entries in scope) so the two surfaces can never
 * disagree about the same moment in the same hand.
 *
 * @param {Array} entries — timeline entries in scope
 * @param {Object|null} selectedHand
 */
export function potFromEntries(entries, selectedHand) {
  let pot = 0;
  const blindsPosted = selectedHand?.gameState?.blindsPosted;
  if (blindsPosted) {
    pot += (blindsPosted.sb || 0) + (blindsPosted.bb || 0);
  }
  for (const entry of entries || []) {
    if (entry?.amount) pot += entry.amount;
  }
  return pot;
}

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
 * Build the per-segment context object from the Hand Review walkthrough.
 *
 * @param {Object} reviewState — fields taken from useHandReview()
 * @param {Object|null} selectedHand
 * @returns {Object} JSON-serializable context
 */
export function buildHandReviewSnapshot(reviewState = {}, selectedHand = null) {
  const {
    currentStreet = 'preflop',
    availableStreets = [],
    timeline = [],
    streetActions = [],
    communityCardsForStreet = [],
    focusedAction = null,
    focusedActionIndex = null,
    heroSeat = null,
  } = reviewState;

  // "Prior streets" comes from the surface's own ordering rather than a
  // separately-assumed street order, so the snapshot can't disagree with what
  // the founder was actually looking at.
  const streetIdx = availableStreets.indexOf(currentStreet);
  const priorStreets = streetIdx > 0 ? availableStreets.slice(0, streetIdx) : [];
  const priorEntries = (timeline || []).filter((e) => priorStreets.includes(e?.street));

  const hasFocus = Number.isInteger(focusedActionIndex) && focusedActionIndex >= 0;

  // With an action focused we can be exact; without one, the honest answer is
  // the pot as the street began.
  const entriesInScope = hasFocus
    ? (timeline || []).slice(0, focusedActionIndex + 1)
    : priorEntries;

  const allPlayerCards =
    selectedHand?.cardState?.allPlayerCards ||
    selectedHand?.gameState?.allPlayerCards ||
    null;

  let heroCards = null;
  const seat = heroSeat ?? selectedHand?.gameState?.mySeat ?? null;
  if (seat !== null && allPlayerCards) {
    const cards = allPlayerCards[seat];
    if (Array.isArray(cards) && cards[0] && cards[1]) {
      heroCards = [cards[0], cards[1]];
    }
  }

  return {
    // Where in the hand
    street: currentStreet,
    actionIndex: hasFocus ? Number(focusedActionIndex) : null,
    timelineLength: Array.isArray(timeline) ? timeline.length : 0,

    // What was visible
    board: Array.isArray(communityCardsForStreet) ? [...communityCardsForStreet] : [],
    heroSeat: seat,
    heroCards,

    // Pot geometry — the number and what it is conditioned on
    pot: potFromEntries(entriesInScope, selectedHand),
    potBasis: hasFocus ? 'action' : 'street-start',
    stacks: null,
    spr: null,

    // Seat occupancy is not derived at this surface's granularity — the
    // walkthrough shows a street's actions, not a running per-seat state. Null
    // rather than a guess.
    seats: null,
    seatsLive: [],
    playersLive: null,

    // Immediate action context
    currentAction: serializeAction(focusedAction),
    actionsOnStreet: Array.isArray(streetActions) ? streetActions.length : 0,
    actionsSoFar: entriesInScope.length,
  };
}

/**
 * Cursor equality for this surface — street plus focused action.
 */
export function isSameReviewPoint(a, b) {
  if (!a || !b) return a === b;
  return a.street === b.street && a.actionIndex === b.actionIndex;
}

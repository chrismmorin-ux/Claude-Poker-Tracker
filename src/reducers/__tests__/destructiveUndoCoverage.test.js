/**
 * destructiveUndoCoverage.test.js — WS-563
 *
 * WHAT THIS GUARDS, AND WHY IT IS A REDUCER TEST RATHER THAN A COMPONENT TEST.
 *
 * `Reset Hand` and `Next Hand` are destructive and are made recoverable by a 12s undo
 * toast rather than a confirmation dialog — a deliberate ruling recorded at
 * `CommandStrip.jsx` ("AUDIT-2026-04-21-TV F1: snapshot state for undo toast, replacing
 * window.confirm... mid-hand-chris explicitly forbids modal interrupts"). Undo is
 * therefore the ONLY thing standing between a mis-tap and a destroyed hand.
 *
 * The defect this file exists to prevent: the undo snapshots in `CommandStrip.jsx` are
 * hand-written field lists, while the fields actually destroyed are decided by the
 * REDUCERS. The two drifted. `RESET_HAND` cleared `potOverride` and `reviewTag` and
 * `RESET_CARDS` cleared `allPlayerCards`, and none of those three were ever captured —
 * so Undo restored a partial hand and reported "Hand restored" anyway. `allPlayerCards`
 * is every villain card recorded that hand, which is the read data the product exists
 * to collect.
 *
 * A component test would assert that today's snapshot restores today's fields. It would
 * NOT fail when someone adds a seventh field to `RESET_HAND` next month and forgets the
 * snapshot — which is exactly how the original gap appeared. This test fails on that
 * change, and names the file to edit.
 *
 * If a case here fails: a reducer's destructive scope changed. Update the matching
 * snapshot AND restore payload in `src/components/views/TableView/CommandStrip.jsx`
 * (`handleResetHand` / `handleNextHand`), then update the list below.
 */

import { describe, it, expect } from 'vitest';
import { gameReducer, initialGameState, GAME_ACTIONS } from '../gameReducer';
import { cardReducer, initialCardState, CARD_ACTIONS } from '../cardReducer';

/** Fields the Reset Hand / Next Hand undo snapshots capture today (CommandStrip.jsx). */
const GAME_FIELDS_CAPTURED_BY_UNDO = [
  'actionSequence',
  'dealerButtonSeat',
  'currentStreet',
  'absentSeats',
  'potOverride',
  'reviewTag',
];
const CARD_FIELDS_CAPTURED_BY_UNDO = [
  'communityCards',
  'holeCards',
  'allPlayerCards',
];

/** A hand mid-flight, with every destructible field carrying a non-default value. */
const populatedGameState = () => ({
  ...initialGameState,
  currentStreet: 'turn',
  dealerButtonSeat: 3,
  absentSeats: [7],
  actionSequence: [{ seat: 1, action: 'bet', street: 'flop', order: 1, amount: 25 }],
  potOverride: 340,
  reviewTag: { tagged: true, taggedAt: 1787000000000 },
});

const populatedCardState = () => ({
  ...initialCardState,
  communityCards: ['As', 'Kd', '7h', '2c', ''],
  holeCards: ['Qs', 'Qh'],
  allPlayerCards: { ...initialCardState.allPlayerCards, 4: ['Jc', 'Jd'] },
});

const changedFields = (before, after) =>
  Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));

describe('WS-563: destructive actions cannot clear a field the undo does not restore', () => {
  it('RESET_HAND clears nothing the undo snapshot fails to capture', () => {
    const before = populatedGameState();
    const after = gameReducer(before, { type: GAME_ACTIONS.RESET_HAND });
    const cleared = changedFields(before, after);

    // Sanity: the action must actually be destructive, or this test proves nothing.
    expect(cleared.length).toBeGreaterThan(0);

    const uncaptured = cleared.filter((f) => !GAME_FIELDS_CAPTURED_BY_UNDO.includes(f));
    expect(uncaptured).toEqual([]);
  });

  it('RESET_CARDS clears nothing the undo snapshot fails to capture', () => {
    const before = populatedCardState();
    const after = cardReducer(before, { type: CARD_ACTIONS.RESET_CARDS });
    const cleared = changedFields(before, after);

    expect(cleared.length).toBeGreaterThan(0);

    const uncaptured = cleared.filter((f) => !CARD_FIELDS_CAPTURED_BY_UNDO.includes(f));
    expect(uncaptured).toEqual([]);
  });

  it('NEXT_HAND clears nothing the undo snapshot fails to capture, except the ledger it deliberately advances', () => {
    const before = populatedGameState();
    const after = gameReducer(before, { type: GAME_ACTIONS.NEXT_HAND, payload: {} });
    const cleared = changedFields(before, after);

    expect(cleared.length).toBeGreaterThan(0);

    // `seatStacks` and `handNumber` are ADVANCED rather than cleared — NEXT_HAND settles
    // the stack ledger and increments a monotonic counter. Restoring them on undo is a
    // ledger-provenance question governed by INV-STK-01, not a snapshot omission, and it
    // is deliberately NOT resolved here. Tracked separately; see the WS-563 status note.
    const LEDGER_ADVANCED_NOT_CLEARED = ['seatStacks', 'handNumber'];

    const uncaptured = cleared.filter(
      (f) => !GAME_FIELDS_CAPTURED_BY_UNDO.includes(f) && !LEDGER_ADVANCED_NOT_CLEARED.includes(f),
    );
    expect(uncaptured).toEqual([]);
  });

  it('the three fields that were missing are genuinely destroyed — the anchor for this whole file', () => {
    // Known-answer anchor. If any of these stops being cleared, the bug that motivated
    // WS-563 no longer exists in that field and this file should be revisited rather
    // than silently continuing to pass.
    const g = gameReducer(populatedGameState(), { type: GAME_ACTIONS.RESET_HAND });
    expect(g.potOverride).toBeNull();
    expect(g.reviewTag).toBeNull();

    const c = cardReducer(populatedCardState(), { type: CARD_ACTIONS.RESET_CARDS });
    expect(c.allPlayerCards[4]).toEqual(['', '']);
  });
});

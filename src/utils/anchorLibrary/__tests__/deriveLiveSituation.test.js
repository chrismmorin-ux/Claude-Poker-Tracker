/**
 * deriveLiveSituation.test.js — Stream C live-situation derivation unit tests
 *
 * Covers the pure transform from gameReducer-shaped game state into the
 * `situation` shape that `getMatchingAnchors` consumes:
 *   - per-street hero/villain action extraction
 *   - sizing as pot-fraction (amount / pot-before-action), fail-safe omitted
 *     when blinds are missing or the pot is estimated
 *   - per-street board conditions in anchor vocabulary (incl. scareKind on
 *     turn/river) derived from community cards
 */

import { describe, it, expect } from 'vitest';
import { deriveLiveSituation } from '../deriveLiveSituation';
import { ACTIONS } from '../../../constants/gameConstants';

const BLINDS = { sb: 1, bb: 2 }; // preflop starting pot = 3

const baseInput = (overrides = {}) => ({
  actionSequence: [],
  currentStreet: 'flop',
  heroSeat: 1,
  villainSeat: 4,
  villainStyle: 'Nit',
  blinds: BLINDS,
  communityCards: ['J♥', 'T♥', '9♦', '', ''], // wet flop
  ...overrides,
});

describe('deriveLiveSituation — empty state', () => {
  it('returns minimal situation when no actions exist', () => {
    const sit = deriveLiveSituation(baseInput({ actionSequence: [] }));
    expect(sit.actionHistory).toEqual({});
    expect(sit.villainStyle).toBe('Nit');
  });

  it('omits villainStyle when null/empty', () => {
    const sit = deriveLiveSituation(baseInput({ villainStyle: null }));
    expect(sit.villainStyle).toBeUndefined();
  });

  it('returns empty actionHistory when currentStreet is invalid', () => {
    const sit = deriveLiveSituation(baseInput({ currentStreet: 'bogus' }));
    expect(sit.actionHistory).toEqual({});
  });
});

describe('deriveLiveSituation — single-street action history', () => {
  it('extracts hero check + villain bet with pot-fraction sizing', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [
        { seat: 1, street: 'flop', action: 'check' },
        { seat: 4, street: 'flop', action: 'bet', amount: 3 }, // pot before = 3 → 1.0
      ],
    }));
    expect(sit.actionHistory.flop).toMatchObject({
      heroAction: { kind: 'check' },
      villainAction: { kind: 'bet', sizing: 1.0 },
      board: { texture: 'wet' },
    });
  });

  it('uses the LAST action of each seat on the street (most recent wins)', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [
        { seat: 4, street: 'flop', action: 'bet', amount: 3 },   // pot before 3
        { seat: 1, street: 'flop', action: 'raise', amount: 9 }, // pot before 6 → 1.5
        { seat: 4, street: 'flop', action: 'call' },
      ],
    }));
    expect(sit.actionHistory.flop.heroAction).toEqual({ kind: 'raise', sizing: 1.5 });
    expect(sit.actionHistory.flop.villainAction).toEqual({ kind: 'call' });
  });

  it('skips folds (folded villains are filtered upstream conceptually)', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [
        { seat: 4, street: 'flop', action: 'bet', amount: 3 },
        { seat: 4, street: 'flop', action: ACTIONS.FOLD },
      ],
    }));
    // The fold is the latest action, but findLastActionForSeat skips folds.
    // The bet remains as the last meaningful action.
    expect(sit.actionHistory.flop.villainAction).toEqual({ kind: 'bet', sizing: 1.0 });
  });
});

describe('deriveLiveSituation — sizing fail-safe', () => {
  it('omits sizing entirely when blinds are missing', () => {
    const sit = deriveLiveSituation(baseInput({
      blinds: null,
      actionSequence: [{ seat: 4, street: 'flop', action: 'bet', amount: 3 }],
    }));
    expect(sit.actionHistory.flop.villainAction).toEqual({ kind: 'bet' });
  });

  it('omits sizing once the pot is estimated (earlier amountless bet)', () => {
    const sit = deriveLiveSituation(baseInput({
      currentStreet: 'turn',
      communityCards: ['J♥', 'T♥', '9♦', '2♣', ''],
      actionSequence: [
        { seat: 4, street: 'flop', action: 'bet' }, // no amount → pot unknown after
        { seat: 1, street: 'flop', action: 'call', amount: 5 },
        { seat: 4, street: 'turn', action: 'bet', amount: 10 },
      ],
    }));
    expect(sit.actionHistory.turn.villainAction).toEqual({ kind: 'bet' });
  });

  it('rounds sizing to 4 decimals', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [{ seat: 4, street: 'flop', action: 'bet', amount: 1 }], // 1/3
    }));
    expect(sit.actionHistory.flop.villainAction.sizing).toBe(0.3333);
  });
});

describe('deriveLiveSituation — multi-street action history + boards', () => {
  const riverInput = () => baseInput({
    currentStreet: 'river',
    communityCards: ['J♥', 'T♥', '8♥', '4♦', '2♥'],
    actionSequence: [
      { seat: 1, street: 'preflop', action: 'raise', amount: 6 },  // pot before 3 → 2.0
      { seat: 4, street: 'preflop', action: 'call' },              // auto-call 6 → pot 15
      { seat: 1, street: 'flop', action: 'bet', amount: 8 },       // 8/15 ≈ 0.5333
      { seat: 4, street: 'flop', action: 'call' },                 // pot 31
      { seat: 1, street: 'turn', action: 'bet', amount: 23 },      // 23/31 ≈ 0.7419
      { seat: 4, street: 'turn', action: 'call' },                 // pot 77
      { seat: 1, street: 'river', action: 'bet', amount: 92 },     // 92/77 ≈ 1.1948
    ],
  });

  it('builds entries for every street with actions, sized in pot fractions', () => {
    const sit = deriveLiveSituation(riverInput());
    expect(Object.keys(sit.actionHistory).sort()).toEqual(['flop', 'preflop', 'river', 'turn']);
    expect(sit.actionHistory.preflop.heroAction).toEqual({ kind: 'raise', sizing: 2.0 });
    expect(sit.actionHistory.flop.heroAction).toEqual({ kind: 'bet', sizing: 0.5333 });
    expect(sit.actionHistory.turn.heroAction).toEqual({ kind: 'bet', sizing: 0.7419 });
    expect(sit.actionHistory.river.heroAction).toEqual({ kind: 'bet', sizing: 1.1948 });
  });

  it('attaches anchor-vocabulary boards to EVERY postflop street, not just the current one', () => {
    const sit = deriveLiveSituation(riverInput());
    expect(sit.actionHistory.preflop.board).toBeUndefined();
    expect(sit.actionHistory.flop.board).toEqual({ texture: 'monotone' }); // J♥T♥8♥
    expect(sit.actionHistory.turn.board).toEqual({ texture: 'wet', scareKind: 'none' });
    expect(sit.actionHistory.river.board).toEqual({ texture: 'flush-complete', scareKind: '4-flush' });
  });

  it('does not include streets later than currentStreet', () => {
    const sit = deriveLiveSituation(baseInput({
      currentStreet: 'flop',
      actionSequence: [
        { seat: 1, street: 'flop', action: 'check' },
        { seat: 1, street: 'turn', action: 'bet', amount: 5 }, // future street, ignored
      ],
    }));
    expect(sit.actionHistory.flop).toBeDefined();
    expect(sit.actionHistory.turn).toBeUndefined();
  });

  it('omits boards when community cards are not entered', () => {
    const sit = deriveLiveSituation(baseInput({
      communityCards: null,
      actionSequence: [{ seat: 1, street: 'flop', action: 'check' }],
    }));
    expect(sit.actionHistory.flop).toEqual({ heroAction: { kind: 'check' } });
  });
});

describe('deriveLiveSituation — defensive input handling', () => {
  it('returns empty situation on null actionSequence', () => {
    const sit = deriveLiveSituation(baseInput({ actionSequence: null }));
    expect(sit.actionHistory).toEqual({});
  });

  it('omits hero/villain action fields when seat is null (board-only entry)', () => {
    const sit = deriveLiveSituation(baseInput({
      heroSeat: null,
      villainSeat: null,
      actionSequence: [{ seat: 1, street: 'flop', action: 'check' }],
    }));
    expect(sit.actionHistory.flop).toEqual({ board: { texture: 'wet' } });
  });

  it('omits action fields with unmappable action kinds, retaining only the board', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [
        { seat: 1, street: 'flop', action: 'unknown-action-type' },
      ],
    }));
    expect(sit.actionHistory.flop).toEqual({ board: { texture: 'wet' } });
  });

  it('returns no street entry when neither actions nor board are derivable', () => {
    const sit = deriveLiveSituation(baseInput({
      heroSeat: null,
      villainSeat: null,
      communityCards: null,
      actionSequence: [{ seat: 1, street: 'flop', action: 'unknown-action-type' }],
    }));
    expect(sit.actionHistory.flop).toBeUndefined();
  });
});

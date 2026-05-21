/**
 * deriveLiveSituation.test.js — Stream C live-situation derivation unit tests
 *
 * Covers the pure transform from gameReducer-shaped game state into the
 * `situation` shape that `getMatchingAnchors` consumes.
 */

import { describe, it, expect } from 'vitest';
import { deriveLiveSituation } from '../deriveLiveSituation';
import { ACTIONS } from '../../../constants/gameConstants';

const baseInput = (overrides = {}) => ({
  actionSequence: [],
  currentStreet: 'flop',
  heroSeat: 1,
  villainSeat: 4,
  villainStyle: 'Nit',
  boardTexture: { texture: 'wet', scareKind: 'overcard' },
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
  it('extracts hero check + villain bet on flop', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [
        { seat: 1, street: 'flop', action: 'check' },
        { seat: 4, street: 'flop', action: 'bet', amount: 0.75 },
      ],
    }));
    expect(sit.actionHistory.flop).toMatchObject({
      heroAction: { kind: 'check' },
      villainAction: { kind: 'bet', sizing: 0.75 },
      board: { texture: 'wet', scareKind: 'overcard' },
    });
  });

  it('uses the LAST action of each seat on the street (most recent wins)', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [
        { seat: 4, street: 'flop', action: 'bet', amount: 0.5 },
        { seat: 1, street: 'flop', action: 'raise', amount: 1.5 },
        { seat: 4, street: 'flop', action: 'call' },
      ],
    }));
    expect(sit.actionHistory.flop.heroAction).toEqual({ kind: 'raise', sizing: 1.5 });
    expect(sit.actionHistory.flop.villainAction).toEqual({ kind: 'call' });
  });

  it('skips folds (folded villains are filtered upstream conceptually)', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [
        { seat: 4, street: 'flop', action: 'bet', amount: 0.5 },
        { seat: 4, street: 'flop', action: ACTIONS.FOLD },
      ],
    }));
    // The fold is the latest action, but findLastActionForSeat skips folds.
    // The bet remains as the last meaningful action.
    expect(sit.actionHistory.flop.villainAction).toEqual({ kind: 'bet', sizing: 0.5 });
  });
});

describe('deriveLiveSituation — multi-street action history', () => {
  it('builds preflop + flop + turn entries when current street is turn', () => {
    const sit = deriveLiveSituation(baseInput({
      currentStreet: 'turn',
      actionSequence: [
        { seat: 1, street: 'preflop', action: 'raise', amount: 3 },
        { seat: 4, street: 'preflop', action: 'call' },
        { seat: 1, street: 'flop', action: 'bet', amount: 0.5 },
        { seat: 4, street: 'flop', action: 'call' },
        { seat: 1, street: 'turn', action: 'bet', amount: 0.75 },
      ],
    }));
    expect(Object.keys(sit.actionHistory).sort()).toEqual(['flop', 'preflop', 'turn']);
    expect(sit.actionHistory.preflop.heroAction).toEqual({ kind: 'raise', sizing: 3 });
    expect(sit.actionHistory.flop.heroAction).toEqual({ kind: 'bet', sizing: 0.5 });
    expect(sit.actionHistory.turn.heroAction).toEqual({ kind: 'bet', sizing: 0.75 });
  });

  it('does not include streets later than currentStreet', () => {
    const sit = deriveLiveSituation(baseInput({
      currentStreet: 'flop',
      actionSequence: [
        { seat: 1, street: 'flop', action: 'check' },
        { seat: 1, street: 'turn', action: 'bet', amount: 0.5 }, // future street, ignored
      ],
    }));
    expect(sit.actionHistory.flop).toBeDefined();
    expect(sit.actionHistory.turn).toBeUndefined();
  });

  it('only stamps boardTexture on the current street, not on earlier streets', () => {
    const sit = deriveLiveSituation(baseInput({
      currentStreet: 'turn',
      actionSequence: [
        { seat: 1, street: 'flop', action: 'check' },
        { seat: 1, street: 'turn', action: 'bet', amount: 0.5 },
      ],
      boardTexture: { texture: 'wet' },
    }));
    expect(sit.actionHistory.flop.board).toBeUndefined();
    expect(sit.actionHistory.turn.board).toEqual({ texture: 'wet' });
  });
});

describe('deriveLiveSituation — defensive input handling', () => {
  it('returns empty situation on null actionSequence', () => {
    const sit = deriveLiveSituation(baseInput({ actionSequence: null }));
    expect(sit.actionHistory).toEqual({});
  });

  it('omits hero/villain action fields when seat is null (board-only entry on current street with texture)', () => {
    const sit = deriveLiveSituation(baseInput({
      heroSeat: null,
      villainSeat: null,
      actionSequence: [{ seat: 1, street: 'flop', action: 'check' }],
    }));
    // currentStreet=flop with boardTexture present → entry exists with board only
    expect(sit.actionHistory.flop).toEqual({ board: { texture: 'wet', scareKind: 'overcard' } });
    expect(sit.actionHistory.flop.heroAction).toBeUndefined();
    expect(sit.actionHistory.flop.villainAction).toBeUndefined();
  });

  it('omits action fields with unmappable action kinds, retaining only the board on current street', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [
        { seat: 1, street: 'flop', action: 'unknown-action-type' },
      ],
    }));
    expect(sit.actionHistory.flop).toEqual({ board: { texture: 'wet', scareKind: 'overcard' } });
    expect(sit.actionHistory.flop.heroAction).toBeUndefined();
    expect(sit.actionHistory.flop.villainAction).toBeUndefined();
  });

  it('returns no current-street entry when neither actions nor boardTexture are available', () => {
    const sit = deriveLiveSituation(baseInput({
      heroSeat: null,
      villainSeat: null,
      actionSequence: [{ seat: 1, street: 'flop', action: 'unknown-action-type' }],
      boardTexture: null,
    }));
    expect(sit.actionHistory.flop).toBeUndefined();
  });

  it('omits boardTexture on current street when texture/scareKind are missing', () => {
    const sit = deriveLiveSituation(baseInput({
      actionSequence: [{ seat: 1, street: 'flop', action: 'check' }],
      boardTexture: {},
    }));
    expect(sit.actionHistory.flop.board).toBeUndefined();
  });
});

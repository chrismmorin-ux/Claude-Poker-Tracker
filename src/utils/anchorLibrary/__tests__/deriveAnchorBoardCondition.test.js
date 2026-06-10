/**
 * deriveAnchorBoardCondition.test.js — anchor-vocabulary board translation.
 *
 * Texture priority: flush-complete > monotone > straight-complete > paired >
 * wet/medium/dry. scareKind (turn/river street-transition): 4-flush >
 * straight-complete > board-pair > overcard > none.
 */

import { describe, it, expect } from 'vitest';
import { deriveAnchorBoardCondition } from '../deriveAnchorBoardCondition';

describe('deriveAnchorBoardCondition — guards', () => {
  it('returns null for preflop and invalid streets', () => {
    expect(deriveAnchorBoardCondition(['A♠', 'K♦', '2♣'], 'preflop')).toBeNull();
    expect(deriveAnchorBoardCondition(['A♠', 'K♦', '2♣'], 'showdown')).toBeNull();
    expect(deriveAnchorBoardCondition(['A♠', 'K♦', '2♣'], undefined)).toBeNull();
  });

  it('returns null when the street prefix is not fully entered', () => {
    expect(deriveAnchorBoardCondition(['A♠', 'K♦'], 'flop')).toBeNull();
    expect(deriveAnchorBoardCondition(['A♠', 'K♦', '2♣'], 'turn')).toBeNull();
    expect(deriveAnchorBoardCondition(['A♠', 'K♦', '2♣', '7♥'], 'river')).toBeNull();
    expect(deriveAnchorBoardCondition(null, 'flop')).toBeNull();
    expect(deriveAnchorBoardCondition([], 'flop')).toBeNull();
  });

  it('returns null when cards are unparseable', () => {
    expect(deriveAnchorBoardCondition(['A♠', 'XX', '2♣'], 'flop')).toBeNull();
  });
});

describe('deriveAnchorBoardCondition — texture', () => {
  it('classifies a dry rainbow flop as dry', () => {
    expect(deriveAnchorBoardCondition(['K♠', '7♦', '2♣'], 'flop'))
      .toEqual({ texture: 'dry' });
  });

  it('classifies a connected two-tone flop as wet', () => {
    expect(deriveAnchorBoardCondition(['J♥', 'T♥', '9♦'], 'flop'))
      .toEqual({ texture: 'wet' });
  });

  it('classifies a middling board as medium (matches only anchor texture "any")', () => {
    expect(deriveAnchorBoardCondition(['J♠', 'T♦', '8♥'], 'flop'))
      .toEqual({ texture: 'medium' });
  });

  it('classifies a paired flop as paired', () => {
    expect(deriveAnchorBoardCondition(['8♠', '8♦', '3♣'], 'flop'))
      .toEqual({ texture: 'paired' });
  });

  it('classifies a monotone flop as monotone', () => {
    expect(deriveAnchorBoardCondition(['Q♠', '8♠', '4♠'], 'flop'))
      .toEqual({ texture: 'monotone' });
  });

  it('flush-complete (4+ of a suit) outranks monotone', () => {
    const board = deriveAnchorBoardCondition(['Q♠', '8♠', '4♠', '2♠'], 'turn');
    expect(board.texture).toBe('flush-complete');
  });

  it('classifies 4 consecutive ranks as straight-complete', () => {
    const board = deriveAnchorBoardCondition(['9♠', '8♦', '7♣', '6♥'], 'turn');
    expect(board.texture).toBe('straight-complete');
  });

  it('detects the A-2-3-4 wheel run as straight-complete', () => {
    const board = deriveAnchorBoardCondition(['A♠', '2♦', '3♣', '4♥'], 'turn');
    expect(board.texture).toBe('straight-complete');
  });
});

describe('deriveAnchorBoardCondition — scareKind (street transition)', () => {
  it('omits scareKind on the flop (no prior street to transition from)', () => {
    const board = deriveAnchorBoardCondition(['K♠', '7♦', '2♣'], 'flop');
    expect(board).not.toHaveProperty('scareKind');
  });

  it('labels the 4th suited card 4-flush', () => {
    const board = deriveAnchorBoardCondition(['J♥', 'T♥', '8♥', '4♦', '2♥'], 'river');
    expect(board.scareKind).toBe('4-flush');
  });

  it('labels a card completing 4 consecutive ranks straight-complete', () => {
    const board = deriveAnchorBoardCondition(['9♠', '8♦', '7♣', '6♥'], 'turn');
    expect(board.scareKind).toBe('straight-complete');
  });

  it('labels a card pairing the board board-pair', () => {
    const board = deriveAnchorBoardCondition(['K♠', '7♦', '2♣', 'K♥'], 'turn');
    expect(board.scareKind).toBe('board-pair');
  });

  it('labels a new high card overcard', () => {
    const board = deriveAnchorBoardCondition(['K♠', '7♦', '2♣', 'A♥'], 'turn');
    expect(board.scareKind).toBe('overcard');
  });

  it('labels a brick none', () => {
    const board = deriveAnchorBoardCondition(['K♠', '7♦', '2♣', '3♥'], 'turn');
    expect(board.scareKind).toBe('none');
  });

  it('4-flush outranks board-pair when both apply', () => {
    // River T♠ is the 4th spade AND pairs the turn T♦ — flush wins.
    const board = deriveAnchorBoardCondition(['J♠', '9♠', '4♠', 'T♦', 'T♠'], 'river');
    expect(board.scareKind).toBe('4-flush');
  });

  it('scareKind reflects only the current street transition (turn scare, river brick)', () => {
    // Turn A♥ was an overcard; river 2♦ relative to the 4-card board is a brick.
    const board = deriveAnchorBoardCondition(['K♠', '7♦', '3♣', 'A♥', '2♦'], 'river');
    expect(board.scareKind).toBe('none');
  });
});

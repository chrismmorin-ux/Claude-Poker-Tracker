/**
 * Tests for protocol-adapter.js — domain event mapping from raw Ignition payloads
 */

import { describe, it, expect } from 'vitest';
import { adaptPayload } from '../protocol-adapter.js';
import { PID, FACE_DOWN, ACTION_BITS } from '../protocol.js';

// ============================================================================
// HELPERS
// ============================================================================

const expectEvent = (events, kind) => {
  const match = events.find(e => e.kind === kind);
  expect(match).toBeDefined();
  return match;
};

// ============================================================================
// NOISE / IGNORED
// ============================================================================

describe('adaptPayload — noise PIDs', () => {
  it('returns ignored for SYS_INFO', () => {
    const events = adaptPayload('SYS_INFO', {});
    expect(events).toEqual([{ kind: 'ignored' }]);
  });

  it('returns ignored for PONG', () => {
    expect(adaptPayload(PID.PONG, {})).toEqual([{ kind: 'ignored' }]);
  });

  it('returns ignored for PLAY_TIME_INFO', () => {
    expect(adaptPayload(PID.PLAY_TIME_INFO, {})).toEqual([{ kind: 'ignored' }]);
  });

  it('returns ignored for PLAY_ACCOUNT_INFO', () => {
    expect(adaptPayload(PID.PLAY_ACCOUNT_INFO, {})).toEqual([{ kind: 'ignored' }]);
  });

  it('returns ignored for PLAY_CLEAR_INFO', () => {
    expect(adaptPayload(PID.PLAY_CLEAR_INFO, {})).toEqual([{ kind: 'ignored' }]);
  });
});

// ============================================================================
// NEW HAND
// ============================================================================

describe('adaptPayload — newHand', () => {
  it('extracts handNumber from PLAY_STAGE_INFO', () => {
    const events = adaptPayload(PID.PLAY_STAGE_INFO, { stageNo: 'hand_123' });
    const e = expectEvent(events, 'newHand');
    expect(e.handNumber).toBe('hand_123');
  });

  it('extracts handNumber from PLAY_TOUR_STAGENUMBER', () => {
    const events = adaptPayload(PID.PLAY_TOUR_STAGENUMBER, { stageNumber: 456 });
    const e = expectEvent(events, 'newHand');
    expect(e.handNumber).toBe(456);
  });

  it('returns null handNumber when no stage field present', () => {
    const events = adaptPayload(PID.PLAY_STAGE_INFO, {});
    expect(events[0].handNumber).toBeNull();
  });
});

// ============================================================================
// DEALER SEAT
// ============================================================================

describe('adaptPayload — dealerSeat', () => {
  it('extracts seat number', () => {
    const events = adaptPayload(PID.CO_DEALER_SEAT, { seat: 3 });
    expect(events).toEqual([{ kind: 'dealerSeat', seat: 3 }]);
  });

  it('returns empty for non-number seat', () => {
    expect(adaptPayload(PID.CO_DEALER_SEAT, { seat: 'bad' })).toEqual([]);
  });
});

// ============================================================================
// STREET CHANGE
// ============================================================================

describe('adaptPayload — streetChange', () => {
  it('maps CO_TABLE_STATE preflop (8)', () => {
    const events = adaptPayload(PID.CO_TABLE_STATE, { tableState: 8 });
    const e = expectEvent(events, 'streetChange');
    expect(e.stateValue).toBe(8);
    expect(e.streetName).toBe('preflop');
  });

  it('maps flop (16)', () => {
    const events = adaptPayload(PID.CO_TABLE_STATE, { tableState: 16 });
    expect(events[0].streetName).toBe('flop');
  });

  it('maps turn (32)', () => {
    const events = adaptPayload(PID.CO_TABLE_STATE, { tableState: 32 });
    expect(events[0].streetName).toBe('turn');
  });

  it('maps river (64)', () => {
    const events = adaptPayload(PID.CO_TABLE_STATE, { tableState: 64 });
    expect(events[0].streetName).toBe('river');
  });

  it('returns empty for unknown state value', () => {
    expect(adaptPayload(PID.CO_TABLE_STATE, { tableState: 999 })).toEqual([]);
  });
});

// ============================================================================
// BLINDS
// ============================================================================

describe('adaptPayload — blind', () => {
  it('extracts SB blind with cents-to-dollars conversion', () => {
    const events = adaptPayload(PID.CO_BLIND_INFO, { seat: 1, btn: 2, bet: 50, account: 10000 });
    const e = expectEvent(events, 'blind');
    expect(e.seat).toBe(1);
    expect(e.blindType).toBe('sb');
    expect(e.amount).toBe(0.5);
    expect(e.stack).toBe(100);
  });

  it('extracts BB blind', () => {
    const events = adaptPayload(PID.CO_BLIND_INFO, { seat: 2, btn: 4, bet: 100, account: 9900 });
    const e = expectEvent(events, 'blind');
    expect(e.blindType).toBe('bb');
    expect(e.amount).toBe(1);
  });

  it('returns empty for non-number seat', () => {
    expect(adaptPayload(PID.CO_BLIND_INFO, { seat: null, btn: 2, bet: 50 })).toEqual([]);
  });
});

// ============================================================================
// HOLE CARDS
// ============================================================================

describe('adaptPayload — holeCards', () => {
  it('extracts hero hole cards (real cards)', () => {
    const events = adaptPayload(PID.CO_CARDTABLE_INFO, { seat5: [0, 13] }); // Ac, Ad
    const e = expectEvent(events, 'holeCards');
    expect(e.seat).toBe(5);
    expect(e.isHero).toBe(true);
    expect(e.cards).toEqual(['Ac', 'Ad']);
  });

  it('extracts face-down cards (non-hero)', () => {
    const events = adaptPayload(PID.CO_CARDTABLE_INFO, { seat3: [FACE_DOWN, FACE_DOWN] });
    const e = expectEvent(events, 'holeCards');
    expect(e.seat).toBe(3);
    expect(e.isHero).toBe(false);
    expect(e.cards).toEqual(['', '']);
  });

  it('handles multiple seats', () => {
    const events = adaptPayload(PID.CO_CARDTABLE_INFO, {
      seat1: [FACE_DOWN, FACE_DOWN],
      seat5: [0, 13],
    });
    expect(events).toHaveLength(2);
    expect(events.find(e => e.seat === 5).isHero).toBe(true);
    expect(events.find(e => e.seat === 1).isHero).toBe(false);
  });
});

// ============================================================================
// COMMUNITY CARDS
// ============================================================================

describe('adaptPayload — communityCards', () => {
  it('extracts flop (3 cards)', () => {
    const events = adaptPayload(PID.CO_BCARD3_INFO, { bcard: [0, 13, 26] });
    const e = expectEvent(events, 'communityCards');
    expect(e.position).toBe('flop');
    expect(e.cards).toHaveLength(3);
  });

  it('extracts turn card (pos 4)', () => {
    const events = adaptPayload(PID.CO_BCARD1_INFO, { pos: 4, card: 39 });
    const e = expectEvent(events, 'communityCards');
    expect(e.position).toBe('turn');
    expect(e.cards).toHaveLength(1);
  });

  it('extracts river card (pos 5)', () => {
    const events = adaptPayload(PID.CO_BCARD1_INFO, { pos: 5, card: 51 });
    const e = expectEvent(events, 'communityCards');
    expect(e.position).toBe('river');
  });

  it('returns empty for invalid position', () => {
    expect(adaptPayload(PID.CO_BCARD1_INFO, { pos: 3, card: 0 })).toEqual([]);
  });
});

// ============================================================================
// ACTIONS
// ============================================================================

describe('adaptPayload — action', () => {
  it('decodes fold', () => {
    const events = adaptPayload(PID.CO_SELECT_INFO, { seat: 1, btn: ACTION_BITS.FOLD, bet: 0, account: 9900 });
    const e = expectEvent(events, 'action');
    expect(e.action).toBe('fold');
    expect(e.amount).toBeNull();
    expect(e.stack).toBe(99);
  });

  it('decodes raise with amount (cents-to-dollars)', () => {
    const events = adaptPayload(PID.CO_SELECT_INFO, { seat: 3, btn: ACTION_BITS.RAISE, bet: 600, account: 9400 });
    const e = expectEvent(events, 'action');
    expect(e.action).toBe('raise');
    expect(e.amount).toBe(6);
    expect(e.stack).toBe(94);
  });

  it('decodes check', () => {
    const events = adaptPayload(PID.CO_SELECT_INFO, { seat: 5, btn: ACTION_BITS.CHECK });
    const e = expectEvent(events, 'action');
    expect(e.action).toBe('check');
    expect(e.amount).toBeNull();
  });

  it('returns empty for null action', () => {
    expect(adaptPayload(PID.CO_SELECT_INFO, { seat: 1, btn: 0 })).toEqual([]);
  });
});

// ============================================================================
// HERO HINT
// ============================================================================

describe('adaptPayload — heroHint', () => {
  it('extracts from CO_SELECT_REQ', () => {
    const events = adaptPayload(PID.CO_SELECT_REQ, { seat: 5 });
    expect(events).toEqual([{ kind: 'heroHint', seat: 5, source: 'selectReq' }]);
  });

  it('extracts from CO_SIT_PLAY (play=1)', () => {
    const events = adaptPayload(PID.CO_SIT_PLAY, { play: 1, seat: 5 });
    expect(events).toEqual([{ kind: 'heroHint', seat: 5, source: 'sitPlay' }]);
  });

  it('ignores CO_SIT_PLAY when play !== 1', () => {
    expect(adaptPayload(PID.CO_SIT_PLAY, { play: 0, seat: 5 })).toEqual([]);
  });
});

// ============================================================================
// RESULT & POT
// ============================================================================

describe('adaptPayload — result', () => {
  it('extracts final stacks and winners', () => {
    const events = adaptPayload(PID.CO_RESULT_INFO, {
      account: [9500, 0, 10500, 0, 0, 0, 0, 0, 0],
      handHi1: true,
    });
    const e = expectEvent(events, 'result');
    expect(e.stacks[1]).toBe(95);
    expect(e.stacks[3]).toBe(105);
    expect(e.winners).toContain(1);
  });
});

describe('adaptPayload — potUpdate', () => {
  it('sums pot from curPot array (cents-to-dollars)', () => {
    const events = adaptPayload(PID.CO_CHIPTABLE_INFO, { curPot: [500, 300] });
    const e = expectEvent(events, 'potUpdate');
    expect(e.pot).toBe(8);
  });
});

describe('adaptPayload — potDistribution', () => {
  it('extracts returnHi array', () => {
    const events = adaptPayload(PID.CO_POT_INFO, { returnHi: [0, 0, 1000, 0, 0, 0, 0, 0, 0] });
    const e = expectEvent(events, 'potDistribution');
    expect(e.returnHi).toHaveLength(9);
    expect(e.returnHi[2]).toBe(1000);
  });
});

// ============================================================================
// TABLE INFO (composite)
// ============================================================================

describe('adaptPayload — tableInfo (CO_TABLE_INFO)', () => {
  it('decomposes into multiple events', () => {
    const events = adaptPayload(PID.CO_TABLE_INFO, {
      dealerSeat: 3,
      account: [10000, 0, 9500, 0, 10500, 0, 0, 0, 0],
      tableState: 8,
    });

    expect(events.length).toBeGreaterThanOrEqual(3); // dealer + seats + streetChange
    expect(events[0]).toEqual({ kind: 'dealerSeat', seat: 3 });
    expect(events.some(e => e.kind === 'seatInfo')).toBe(true);
    // streetChange must be last
    expect(events[events.length - 1].kind).toBe('streetChange');
  });

  it('extracts hero cards from pcard fields', () => {
    const events = adaptPayload(PID.CO_TABLE_INFO, {
      pcard5: [0, 13], // Ac, Ad
    });
    const hc = expectEvent(events, 'holeCards');
    expect(hc.seat).toBe(5);
    expect(hc.isHero).toBe(true);
  });

  it('extracts board cards from bcard array', () => {
    const events = adaptPayload(PID.CO_TABLE_INFO, {
      bcard: [0, 13, 26],
    });
    const cc = expectEvent(events, 'communityCards');
    expect(cc.cards).toHaveLength(3);
    expect(cc.position).toBe('tableInfo');
  });
});

// ============================================================================
// OPTION INFO
// ============================================================================

describe('adaptPayload — optionInfo', () => {
  it('extracts blinds and ante (cents-to-dollars)', () => {
    const events = adaptPayload(PID.CO_OPTION_INFO, { sblind: 50, bblind: 100, ante: 10, gameType: 1 });
    const e = expectEvent(events, 'optionInfo');
    expect(e.blinds).toEqual({ sb: 0.5, bb: 1 });
    expect(e.ante).toBe(0.1);
    expect(e.gameType).toBe(1);
  });
});

// ============================================================================
// TOURNAMENT
// ============================================================================

describe('adaptPayload — tournament', () => {
  it('extracts tournament antes with stacks', () => {
    const events = adaptPayload(PID.TCO_ANTE_INFO_ALL, {
      account: [10000, 9500, 10500, 0, 0, 0, 0, 0, 0],
      ante: 25,
    });
    const e = expectEvent(events, 'tournamentAntes');
    expect(e.stacks[1]).toBe(100);
    expect(e.stacks[2]).toBe(95);
    expect(e.ante).toBe(0.25);
  });

  it('extracts tournament level info', () => {
    const events = adaptPayload(PID.PLAY_TOUR_LEVEL_INFO, { level: 5, blinds: 100 });
    const e = expectEvent(events, 'tournamentLevel');
    expect(e.payload.level).toBe(5);
  });
});

// ============================================================================
// SEAT INFO
// ============================================================================

describe('adaptPayload — seatInfo', () => {
  it('extracts seat with stack and regSeatNo', () => {
    const events = adaptPayload(PID.PLAY_SEAT_INFO, { seat: 3, regSeatNo: 42, type: 1, account: 10000 });
    const e = expectEvent(events, 'seatInfo');
    expect(e.seat).toBe(3);
    expect(e.regSeatNo).toBe(42);
    expect(e.isActive).toBe(true);
    expect(e.stack).toBe(100);
  });
});

// ============================================================================
// SHOW/MUCK & REVEALED CARDS
// ============================================================================

describe('adaptPayload — showMuck', () => {
  it('extracts muck action', () => {
    const events = adaptPayload(PID.CO_SHOW_INFO, { seat: 3, btn: 32768 }); // MUCK bit
    expect(events).toEqual([{ kind: 'showMuck', seat: 3 }]);
  });

  it('ignores show action', () => {
    const events = adaptPayload(PID.CO_SHOW_INFO, { seat: 3, btn: 8192 }); // SHOW bit
    expect(events).toEqual([]);
  });
});

describe('adaptPayload — revealedCards', () => {
  it('extracts revealed cards', () => {
    const events = adaptPayload(PID.CO_PCARD_INFO, { seat: 3, card: [0, 13] });
    const e = expectEvent(events, 'revealedCards');
    expect(e.seat).toBe(3);
    expect(e.cards).toEqual(['Ac', 'Ad']);
  });
});

// ============================================================================
// HAND END
// ============================================================================

describe('adaptPayload — handEnd', () => {
  it('returns handEnd event', () => {
    expect(adaptPayload(PID.PLAY_STAGE_END_REQ, {})).toEqual([{ kind: 'handEnd' }]);
  });
});

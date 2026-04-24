import { describe, it, expect } from 'vitest';
import {
  reconstructStateAtDecisionNode,
  __TEST_ONLY__,
} from '../__backtest__/handStateReconstructor';

const {
  encodeCards,
  calculatePotUpToNode,
  countActiveSeats,
  isVillainInPosition,
  pinVillainRangeFromShowdown,
  STREET_BOARD_COUNT,
} = __TEST_ONLY__;

// ───────────────────────────────────────────────────────────────────────────
// Helper builders for hand records
// ───────────────────────────────────────────────────────────────────────────

const makeHand = (overrides = {}) => ({
  handId: overrides.handId ?? 'h1',
  sessionId: overrides.sessionId ?? 's1',
  gameState: {
    mySeat: overrides.heroSeat ?? 1,
    dealerButtonSeat: overrides.dealerButtonSeat ?? 9,
    absentSeats: overrides.absentSeats ?? [],
    currentStreet: overrides.currentStreet ?? 'turn',
    actionSequence: overrides.actionSequence ?? [
      // Default HU heads-up scenario:
      // Seat 5 (BB) raises preflop, hero (seat 1, BTN) calls, seat 5 bets flop, hero calls,
      // seat 5 bets turn — that's the decision node.
      { seat: 9, street: 'preflop', action: 'fold', order: 1 },
      { seat: 5, street: 'preflop', action: 'raise', amount: 6, order: 2 },
      { seat: 1, street: 'preflop', action: 'call', amount: 6, order: 3 },
      { seat: 5, street: 'flop', action: 'bet', amount: 8, order: 4 },
      { seat: 1, street: 'flop', action: 'call', amount: 8, order: 5 },
      { seat: 5, street: 'turn', action: 'bet', amount: 20, order: 6 },
    ],
    potOverride: null,
  },
  cardState: {
    holeCards: overrides.holeCards ?? ['A♠', 'K♠'],
    holeCardsVisible: true,
    communityCards: overrides.communityCards ?? ['Q♥', 'J♣', '7♦', '5♣'],
    allPlayerCards: {},
  },
  seatPlayers: overrides.seatPlayers ?? { '5': 'v-villain' },
  ...overrides.handExtras,
});

const matchedNodeForTurnBet = (overrides = {}) => ({
  handId: 'h1',
  villainSeat: 5,
  street: 'turn',
  action: 'bet',
  amount: 20,
  texture: 'medium',
  position: 'any',
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// encodeCards
// ───────────────────────────────────────────────────────────────────────────

describe('encodeCards', () => {
  it('encodes valid card strings to integers in [0, 51]', () => {
    const out = encodeCards(['A♠', 'K♥']);
    expect(out).toHaveLength(2);
    for (const c of out) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(51);
    }
  });

  it('returns null when any card fails to parse', () => {
    expect(encodeCards(['A♠', 'XX'])).toBeNull();
    expect(encodeCards(['', 'K♥'])).toBeNull();
  });

  it('returns null on non-array input', () => {
    expect(encodeCards(null)).toBeNull();
    expect(encodeCards('A♠')).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// calculatePotUpToNode
// ───────────────────────────────────────────────────────────────────────────

describe('calculatePotUpToNode', () => {
  it('starts with sb + bb when no actions consumed', () => {
    const seq = [{ seat: 1, street: 'preflop', action: 'fold', order: 1 }];
    const { total } = calculatePotUpToNode(seq, 1, { sb: 1, bb: 2 });
    expect(total).toBe(3); // 1 + 2 = 3 (no actions before order=1)
  });

  it('accumulates bets/calls strictly before targetOrder', () => {
    const seq = [
      { seat: 5, street: 'preflop', action: 'raise', amount: 6, order: 1 },
      { seat: 1, street: 'preflop', action: 'call', amount: 6, order: 2 },
      { seat: 5, street: 'flop', action: 'bet', amount: 10, order: 3 },
    ];
    // At order=3 (the flop bet), pot = sb+bb+raise+call = 1+2+6+6 = 15
    const { total } = calculatePotUpToNode(seq, 3, { sb: 1, bb: 2 });
    expect(total).toBe(15);
  });

  it('handles call without amount (auto-derives from currentBet)', () => {
    const seq = [
      { seat: 5, street: 'preflop', action: 'raise', amount: 6, order: 1 },
      { seat: 1, street: 'preflop', action: 'call', order: 2 }, // no amount → auto-derive
      { seat: 5, street: 'flop', action: 'bet', amount: 10, order: 3 },
    ];
    const { total } = calculatePotUpToNode(seq, 3, { sb: 1, bb: 2 });
    // Auto-derive: currentBet=6, hero contributed 0 → call = 6 - 0 = 6
    expect(total).toBe(15);
  });

  it('resets currentBet on street change', () => {
    const seq = [
      { seat: 5, street: 'preflop', action: 'raise', amount: 6, order: 1 },
      { seat: 1, street: 'preflop', action: 'call', amount: 6, order: 2 },
      { seat: 1, street: 'flop', action: 'check', order: 3 },
      { seat: 5, street: 'flop', action: 'bet', amount: 10, order: 4 },
    ];
    // At order=4: 1+2+6+6 = 15 (check is no-op)
    const { total } = calculatePotUpToNode(seq, 4, { sb: 1, bb: 2 });
    expect(total).toBe(15);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// countActiveSeats
// ───────────────────────────────────────────────────────────────────────────

describe('countActiveSeats', () => {
  it('counts unique seats minus folds before targetOrder', () => {
    const seq = [
      { seat: 1, street: 'preflop', action: 'raise', amount: 6, order: 1 },
      { seat: 5, street: 'preflop', action: 'call', amount: 6, order: 2 },
      { seat: 9, street: 'preflop', action: 'fold', order: 3 },
      { seat: 1, street: 'flop', action: 'bet', amount: 10, order: 4 },
    ];
    // Before order=4: seats 1, 5, 9 acted; 9 folded. Active = 2.
    expect(countActiveSeats(seq, 4)).toBe(2);
  });

  it('treats absentSeats as out', () => {
    const seq = [
      { seat: 1, street: 'preflop', action: 'raise', amount: 6, order: 1 },
      { seat: 5, street: 'preflop', action: 'call', amount: 6, order: 2 },
    ];
    // Even though seat 5 hasn't folded, marking as absent removes it.
    expect(countActiveSeats(seq, 99, [5])).toBe(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// isVillainInPosition
// ───────────────────────────────────────────────────────────────────────────

describe('isVillainInPosition', () => {
  it('villain further from button (going CW from BTN) is IP relative to hero', () => {
    // Button at seat 9. Hero seat 1 = distance 1 from BTN (acts first postflop in CW order).
    // Villain seat 5 = distance 5 from BTN (acts later than hero postflop).
    // Implementation: distance = (seat - dealer + numSeats) % numSeats; 0 → numSeats.
    // dealer=9, hero=1: (1-9+9)=1 → 1
    // dealer=9, villain=5: (5-9+9)=5 → 5
    // Larger distance = acts later = IP. Villain IP relative to hero → true.
    expect(isVillainInPosition({ villainSeat: 5, heroSeat: 1, dealerButtonSeat: 9 })).toBe(true);
  });

  it('villain on button is IP relative to hero in BB', () => {
    // dealer=1 (BTN). Hero=2 (BB). Villain=1 (BTN).
    // distFromBtn(hero=2) = (2-1+9)%9 = 1
    // distFromBtn(villain=1) = (1-1+9)%9 = 0 → 9 (treated as last)
    // 9 > 1 → villain IP. ✓
    expect(isVillainInPosition({ villainSeat: 1, heroSeat: 2, dealerButtonSeat: 1 })).toBe(true);
  });

  it('returns false on non-integer inputs', () => {
    expect(isVillainInPosition({ villainSeat: null, heroSeat: 1, dealerButtonSeat: 9 })).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// reconstructStateAtDecisionNode — happy path
// ───────────────────────────────────────────────────────────────────────────

describe('reconstructStateAtDecisionNode — HU postflop happy path', () => {
  it('reconstructs heroCards, board, pot, villainBet, villainAction', () => {
    const recon = reconstructStateAtDecisionNode({
      hand: makeHand(),
      decisionNode: matchedNodeForTurnBet(),
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.reconstructed).toBe(true);
    expect(recon.source).toBe('real-board-pot');
    expect(recon.heroCards).toHaveLength(2);
    expect(recon.board).toHaveLength(4); // turn = 4 board cards
    expect(recon.villainBet).toBe(20);
    expect(recon.villainAction).toBe('bet');
    expect(recon.numOpponents).toBe(1);
    expect(recon.street).toBe('turn');
    // Pot before turn bet: sb(1) + bb(2) + raise(6) + call(6) + flop bet(8) + flop call(8) = 31
    expect(recon.potSize).toBe(31);
  });

  it('exposes display info for diagnostic UI', () => {
    const recon = reconstructStateAtDecisionNode({
      hand: makeHand(),
      decisionNode: matchedNodeForTurnBet(),
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'LAG' },
    });
    expect(recon.display).toEqual({
      board: ['Q♥', 'J♣', '7♦', '5♣'],
      texture: expect.any(String),
      position: expect.stringMatching(/^(IP|OOP)$/),
      style: 'LAG',
      street: 'turn',
      villainRangeSource: 'style-synthesized',
      villainShowdownCards: null,
    });
  });

  it('villainRange is a Float64Array(169)', () => {
    const recon = reconstructStateAtDecisionNode({
      hand: makeHand(),
      decisionNode: matchedNodeForTurnBet(),
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Nit' },
    });
    expect(recon.villainRange).toBeInstanceOf(Float64Array);
    expect(recon.villainRange.length).toBe(169);
  });

  it('default effective stack = 100 × bb', () => {
    const recon = reconstructStateAtDecisionNode({
      hand: makeHand(),
      decisionNode: matchedNodeForTurnBet(),
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.effectiveStack).toBe(200); // 100 × 2bb
  });

  it('honors defaults.effectiveStackBB override', () => {
    const recon = reconstructStateAtDecisionNode({
      hand: makeHand(),
      decisionNode: matchedNodeForTurnBet(),
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
      defaults: { effectiveStackBB: 50 },
    });
    expect(recon.effectiveStack).toBe(100); // 50 × 2bb
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Skip conditions
// ───────────────────────────────────────────────────────────────────────────

describe('reconstructStateAtDecisionNode — skip conditions', () => {
  it('skips multiway hands', () => {
    const hand = makeHand({
      actionSequence: [
        { seat: 5, street: 'preflop', action: 'raise', amount: 6, order: 1 },
        { seat: 1, street: 'preflop', action: 'call', amount: 6, order: 2 },
        { seat: 9, street: 'preflop', action: 'call', amount: 6, order: 3 },
        { seat: 5, street: 'flop', action: 'bet', amount: 10, order: 4 },
      ],
    });
    const recon = reconstructStateAtDecisionNode({
      hand,
      decisionNode: { villainSeat: 5, street: 'flop', action: 'bet', amount: 10 },
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.reconstructed).toBe(false);
    expect(recon.skipped).toBe(true);
    expect(recon.reason).toBe('multiway');
  });

  it('skips hands with missing hero hole cards', () => {
    const hand = makeHand({ holeCards: ['', ''] });
    const recon = reconstructStateAtDecisionNode({
      hand,
      decisionNode: matchedNodeForTurnBet(),
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.reconstructed).toBe(false);
    expect(recon.reason).toBe('missing-hero-cards');
  });

  it('skips when board has too few cards for the node street', () => {
    const hand = makeHand({ communityCards: ['Q♥', 'J♣'] }); // only 2 board cards
    const recon = reconstructStateAtDecisionNode({
      hand,
      decisionNode: matchedNodeForTurnBet(), // turn requires 4
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.reconstructed).toBe(false);
    expect(recon.reason).toBe('missing-board');
  });

  it('skips preflop nodes', () => {
    const hand = makeHand();
    const recon = reconstructStateAtDecisionNode({
      hand,
      decisionNode: { villainSeat: 5, street: 'preflop', action: 'raise', amount: 6 },
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.reconstructed).toBe(false);
    expect(recon.reason).toBe('preflop-or-unknown-street');
  });

  it('skips when matched node not found in actionSequence', () => {
    const hand = makeHand();
    const recon = reconstructStateAtDecisionNode({
      hand,
      decisionNode: { villainSeat: 7, street: 'turn', action: 'bet', amount: 99 }, // seat 7 never acts
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.reconstructed).toBe(false);
    expect(recon.reason).toBe('node-not-in-sequence');
  });

  it('returns missing-input on null inputs', () => {
    expect(reconstructStateAtDecisionNode({ hand: null, decisionNode: matchedNodeForTurnBet(), blinds: { sb: 1, bb: 2 } }).reason).toBe('missing-input');
    expect(reconstructStateAtDecisionNode({ hand: makeHand(), decisionNode: null }).reason).toBe('missing-input');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// STREET_BOARD_COUNT sanity
// ───────────────────────────────────────────────────────────────────────────

describe('STREET_BOARD_COUNT', () => {
  it('maps streets to board sizes', () => {
    expect(STREET_BOARD_COUNT.flop).toBe(3);
    expect(STREET_BOARD_COUNT.turn).toBe(4);
    expect(STREET_BOARD_COUNT.river).toBe(5);
    expect(STREET_BOARD_COUNT.preflop).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// pinVillainRangeFromShowdown — Q3 follow-on
// ───────────────────────────────────────────────────────────────────────────

describe('pinVillainRangeFromShowdown', () => {
  it('returns null when allPlayerCards is missing', () => {
    expect(pinVillainRangeFromShowdown({}, 5)).toBeNull();
    expect(pinVillainRangeFromShowdown({ allPlayerCards: null }, 5)).toBeNull();
    expect(pinVillainRangeFromShowdown(null, 5)).toBeNull();
  });

  it('returns null when villain seat has empty cards', () => {
    const cs = { allPlayerCards: { 5: ['', ''] } };
    expect(pinVillainRangeFromShowdown(cs, 5)).toBeNull();
  });

  it('returns null when villain seat has only one card revealed', () => {
    const cs = { allPlayerCards: { 5: ['K♥', ''] } };
    expect(pinVillainRangeFromShowdown(cs, 5)).toBeNull();
  });

  it('returns null when card strings fail to parse', () => {
    const cs = { allPlayerCards: { 5: ['XX', 'YY'] } };
    expect(pinVillainRangeFromShowdown(cs, 5)).toBeNull();
  });

  it('pins to a single-combo Float64Array(169) when both cards are revealed (suited)', () => {
    const cs = { allPlayerCards: { 5: ['K♥', 'Q♥'] } };
    const range = pinVillainRangeFromShowdown(cs, 5);
    expect(range).toBeInstanceOf(Float64Array);
    expect(range.length).toBe(169);
    let nonzeroCount = 0;
    let totalWeight = 0;
    for (let i = 0; i < 169; i++) {
      if (range[i] > 0) nonzeroCount += 1;
      totalWeight += range[i];
    }
    expect(nonzeroCount).toBe(1);
    expect(totalWeight).toBe(1.0);
  });

  it('pins to a single-combo for offsuit hands', () => {
    const cs = { allPlayerCards: { 5: ['A♠', 'K♥'] } };
    const range = pinVillainRangeFromShowdown(cs, 5);
    expect(range).toBeInstanceOf(Float64Array);
    let nonzeroCount = 0;
    for (let i = 0; i < 169; i++) if (range[i] > 0) nonzeroCount += 1;
    expect(nonzeroCount).toBe(1);
  });

  it('pins to a pocket-pair cell on the diagonal', () => {
    const cs = { allPlayerCards: { 5: ['K♥', 'K♦'] } };
    const range = pinVillainRangeFromShowdown(cs, 5);
    // KK lives on the diagonal — index = 11*13 + 11 = 154
    expect(range[154]).toBe(1.0);
  });

  it('puts AKs and AKo in different cells (suit matters)', () => {
    const aksCs = { allPlayerCards: { 5: ['A♥', 'K♥'] } };
    const akoCs = { allPlayerCards: { 5: ['A♥', 'K♣'] } };
    const aks = pinVillainRangeFromShowdown(aksCs, 5);
    const ako = pinVillainRangeFromShowdown(akoCs, 5);
    let aksIdx = -1; let akoIdx = -1;
    for (let i = 0; i < 169; i++) {
      if (aks[i] > 0) aksIdx = i;
      if (ako[i] > 0) akoIdx = i;
    }
    expect(aksIdx).not.toBe(akoIdx);
    expect(aksIdx).toBeGreaterThanOrEqual(0);
    expect(akoIdx).toBeGreaterThanOrEqual(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// reconstructStateAtDecisionNode — pinning integration
// ───────────────────────────────────────────────────────────────────────────

describe('reconstructStateAtDecisionNode — villain range pinning at showdown', () => {
  const makeHandWithShowdown = (villainCards) => makeHand({
    handExtras: {
      cardState: {
        holeCards: ['A♠', 'K♠'],
        holeCardsVisible: true,
        communityCards: ['Q♥', 'J♣', '7♦', '5♣'],
        allPlayerCards: { 1: ['A♠', 'K♠'], 5: villainCards },
      },
    },
  });

  it('pins villain range to revealed combo + reports villainRangeSource = showdown-pinned', () => {
    const recon = reconstructStateAtDecisionNode({
      hand: makeHandWithShowdown(['Q♣', 'Q♦']),
      decisionNode: matchedNodeForTurnBet(),
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.reconstructed).toBe(true);
    expect(recon.villainRangeSource).toBe('showdown-pinned');
    expect(recon.villainShowdownCards).toEqual(['Q♣', 'Q♦']);

    // Single-combo range
    let nonzeroCount = 0;
    for (let i = 0; i < 169; i++) if (recon.villainRange[i] > 0) nonzeroCount += 1;
    expect(nonzeroCount).toBe(1);
  });

  it('falls back to style-synthesized range when showdown not available', () => {
    const recon = reconstructStateAtDecisionNode({
      hand: makeHand(), // default makeHand has no allPlayerCards reveal
      decisionNode: matchedNodeForTurnBet(),
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.reconstructed).toBe(true);
    expect(recon.villainRangeSource).toBe('style-synthesized');
    expect(recon.villainShowdownCards).toBeNull();

    // Style range should have many non-zero cells
    let nonzeroCount = 0;
    for (let i = 0; i < 169; i++) if (recon.villainRange[i] > 0) nonzeroCount += 1;
    expect(nonzeroCount).toBeGreaterThan(10);
  });

  it('display.villainRangeSource + villainShowdownCards surface for diagnostic UI', () => {
    const recon = reconstructStateAtDecisionNode({
      hand: makeHandWithShowdown(['T♠', 'T♣']),
      decisionNode: matchedNodeForTurnBet(),
      blinds: { sb: 1, bb: 2 },
      villainTendency: { style: 'Fish' },
    });
    expect(recon.display.villainRangeSource).toBe('showdown-pinned');
    expect(recon.display.villainShowdownCards).toEqual(['T♠', 'T♣']);
  });
});

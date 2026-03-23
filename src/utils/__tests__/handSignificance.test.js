import { describe, it, expect } from 'vitest';
import { computeHandSignificance } from '../handSignificance';

/**
 * Helper to build a minimal hand record for testing.
 */
const makeHand = (overrides = {}) => ({
  gameState: {
    mySeat: 1,
    dealerButtonSeat: 9,
    blindsPosted: { sb: 1, bb: 2 },
    actionSequence: [],
    ...overrides.gameState,
  },
  seatPlayers: { 1: 'hero', 3: 'villain1', 5: 'villain2', ...overrides.seatPlayers },
  cardState: { allPlayerCards: {}, communityCards: [], ...overrides.cardState },
  ...overrides,
});

const makeAction = (seat, action, street = 'flop', amount = 0) => ({
  seat, action, street, order: 0, ...(amount ? { amount } : {}),
});

describe('computeHandSignificance', () => {
  it('returns score between 0 and 1 with factor breakdown', () => {
    const hand = makeHand();
    const result = computeHandSignificance(hand, 'hero', {});
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('factors');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(result.factors).toHaveProperty('heroLearning');
    expect(result.factors).toHaveProperty('villainIntel');
    expect(result.factors).toHaveProperty('structural');
  });

  it('scores higher when hero acts postflop', () => {
    const handNoAction = makeHand({
      gameState: { actionSequence: [makeAction(1, 'fold', 'preflop')] },
    });
    const handWithAction = makeHand({
      gameState: {
        actionSequence: [
          makeAction(1, 'call', 'preflop'),
          makeAction(3, 'bet', 'flop', 10),
          makeAction(1, 'call', 'flop', 10),
        ],
      },
    });
    const noAction = computeHandSignificance(handNoAction, 'hero', {});
    const withAction = computeHandSignificance(handWithAction, 'hero', {});
    expect(withAction.factors.heroLearning).toBeGreaterThan(noAction.factors.heroLearning);
  });

  it('scores higher when hero faces aggression', () => {
    const hand = makeHand({
      gameState: {
        actionSequence: [
          makeAction(3, 'raise', 'flop', 15),
          makeAction(1, 'call', 'flop', 15),
        ],
      },
    });
    const result = computeHandSignificance(hand, 'hero', {});
    // heroFacedAggression should be 1
    expect(result.factors.heroLearning).toBeGreaterThan(0);
  });

  it('scores higher with showdown data', () => {
    const handNoSD = makeHand();
    const handWithSD = makeHand({
      cardState: { allPlayerCards: { 3: ['Ah', 'Kd'] }, communityCards: [] },
    });
    const noSD = computeHandSignificance(handNoSD, 'hero', {});
    const withSD = computeHandSignificance(handWithSD, 'hero', {});
    expect(withSD.factors.villainIntel).toBeGreaterThan(noSD.factors.villainIntel);
  });

  it('scores higher for multi-street hands', () => {
    const onlyPreflop = makeHand({
      gameState: {
        actionSequence: [makeAction(1, 'fold', 'preflop')],
      },
    });
    const multiStreet = makeHand({
      gameState: {
        actionSequence: [
          makeAction(1, 'call', 'preflop'),
          makeAction(3, 'bet', 'flop', 5),
          makeAction(1, 'call', 'flop', 5),
          makeAction(3, 'bet', 'turn', 10),
          makeAction(1, 'call', 'turn', 10),
          makeAction(3, 'bet', 'river', 20),
          makeAction(1, 'call', 'river', 20),
        ],
      },
    });
    const pf = computeHandSignificance(onlyPreflop, 'hero', {});
    const ms = computeHandSignificance(multiStreet, 'hero', {});
    expect(ms.factors.structural).toBeGreaterThan(pf.factors.structural);
  });

  it('derives heroPlayerId from seatPlayers when not provided', () => {
    const hand = makeHand({
      gameState: {
        mySeat: 1,
        actionSequence: [makeAction(1, 'call', 'flop', 10)],
      },
      seatPlayers: { 1: 'hero123' },
    });
    // Pass null heroPlayerId — should derive from mySeat
    const result = computeHandSignificance(hand, null, {});
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('handles hero weakness matching', () => {
    const hand = makeHand({
      gameState: {
        actionSequence: [
          makeAction(1, 'call', 'flop', 10),
          makeAction(3, 'bet', 'flop', 10),
        ],
      },
    });
    const tendencyMap = {
      hero: {
        weaknesses: [{
          label: 'Flop calling station',
          situationKeys: ['flop:unknown:EP:call'],
          sampleSize: 3,
        }],
      },
    };
    const withWeakness = computeHandSignificance(hand, 'hero', tendencyMap);
    const withoutWeakness = computeHandSignificance(hand, 'hero', {});
    expect(withWeakness.factors.heroLearning).toBeGreaterThanOrEqual(withoutWeakness.factors.heroLearning);
  });

  it('detects villain profile deviation (passive player raising)', () => {
    const hand = makeHand({
      gameState: {
        actionSequence: [
          makeAction(3, 'raise', 'flop', 20),
          makeAction(1, 'fold', 'flop'),
        ],
      },
    });
    const tendencyMap = {
      villain1: { af: 0.5, vpip: 40, sampleSize: 10 },
    };
    const result = computeHandSignificance(hand, 'hero', tendencyMap);
    // villainProfileDeviation should fire for passive player raising postflop
    expect(result.factors.villainIntel).toBeGreaterThan(0);
  });

  it('handles empty action sequence gracefully', () => {
    const hand = makeHand({ gameState: { actionSequence: [] } });
    const result = computeHandSignificance(hand, 'hero', {});
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});

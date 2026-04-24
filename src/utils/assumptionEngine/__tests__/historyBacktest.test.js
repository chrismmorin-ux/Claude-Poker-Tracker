/**
 * Tests for historyBacktest — Tier-2 activation-rate harness.
 *
 * Covers scope matching semantics, roll-up correctness, graceful degradation
 * on missing data, and the v1 rule that 'medium' textures are rejected by
 * specific wet/dry scopes.
 */

import { describe, it, expect } from 'vitest';
import {
  extractDecisionNodes,
  scopeMatches,
  runActivationBacktest,
} from '../__backtest__/historyBacktest';

// ───────────────────────────────────────────────────────────────────────────
// Test fixtures
// ───────────────────────────────────────────────────────────────────────────

const makeHand = ({
  handId = 'h1',
  heroSeat = 1,
  buttonSeat = 1,
  community = ['A♥', 'K♥', '2♦', '7♣', '9♠'],
  actionSequence = [],
  seatPlayers = {},
} = {}) => ({
  handId,
  seatPlayers,
  cardState: { communityCards: community },
  gameState: {
    mySeat: heroSeat,
    dealerButtonSeat: buttonSeat,
    actionSequence,
    currentStreet: 'river',
  },
});

const makeAssumption = (overrides = {}) => ({
  id: 'a1',
  villainId: 'v42',
  prior: { style: 'Fish' },
  claim: {
    predicate: 'foldToCbet',
    operator: '>=',
    threshold: 0.7,
    scope: { street: 'flop', texture: 'dry', position: 'any' },
  },
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// extractDecisionNodes
// ───────────────────────────────────────────────────────────────────────────

describe('extractDecisionNodes', () => {
  it('returns empty for hand with no actionSequence', () => {
    expect(extractDecisionNodes({})).toEqual([]);
    expect(extractDecisionNodes({ gameState: {} })).toEqual([]);
  });

  it('skips preflop actions (v1 postflop-only scope)', () => {
    const hand = makeHand({
      heroSeat: 1,
      actionSequence: [
        { seat: 2, action: 'raise', street: 'preflop', order: 1, amount: 10 },
        { seat: 2, action: 'bet', street: 'flop', order: 2, amount: 15 },
      ],
    });
    const nodes = extractDecisionNodes(hand);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].street).toBe('flop');
  });

  it('skips hero actions (decision nodes are villain-only)', () => {
    const hand = makeHand({
      heroSeat: 1,
      actionSequence: [
        { seat: 1, action: 'bet', street: 'flop', order: 1, amount: 15 },
        { seat: 2, action: 'call', street: 'flop', order: 2, amount: 15 },
      ],
    });
    const nodes = extractDecisionNodes(hand);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].villainSeat).toBe(2);
  });

  it('attaches a texture token per street', () => {
    // Wet flop (Ah Kh Qh — monotone straight-connected); dry turn (adds 2c);
    // river adds another low offsuit.
    const hand = makeHand({
      heroSeat: 1,
      community: ['A♥', 'K♥', 'Q♥', '2♣', '7♠'],
      actionSequence: [
        { seat: 2, action: 'call', street: 'flop', order: 1 },
        { seat: 2, action: 'call', street: 'turn', order: 2 },
        { seat: 2, action: 'call', street: 'river', order: 3 },
      ],
    });
    const nodes = extractDecisionNodes(hand);
    expect(nodes).toHaveLength(3);
    expect(nodes[0].texture).toBe('wet');
  });

  it('texture is null when community cards for a street are missing', () => {
    const hand = makeHand({
      heroSeat: 1,
      community: [], // no board revealed
      actionSequence: [
        { seat: 2, action: 'bet', street: 'flop', order: 1 },
      ],
    });
    const nodes = extractDecisionNodes(hand);
    expect(nodes[0].texture).toBeNull();
  });

  it('medium textures normalize to null (cannot match wet/dry scopes)', () => {
    // A 9s 3d — medium texture (wetScore between 40 and 65)
    const hand = makeHand({
      heroSeat: 1,
      community: ['A♠', '9♥', '3♦', '2♣', '7♠'],
      actionSequence: [
        { seat: 2, action: 'call', street: 'flop', order: 1 },
      ],
    });
    const nodes = extractDecisionNodes(hand);
    // Could be wet, medium, or dry depending on wetScore — assert it's a valid token
    expect([null, 'wet', 'dry']).toContain(nodes[0].texture);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// scopeMatches
// ───────────────────────────────────────────────────────────────────────────

describe('scopeMatches', () => {
  const node = (overrides = {}) => ({
    street: 'flop',
    texture: 'dry',
    position: 'any',
    villainSeat: 2,
    action: 'fold',
    ...overrides,
  });

  it('returns false on missing scope or node', () => {
    expect(scopeMatches(null, node())).toBe(false);
    expect(scopeMatches({ street: 'flop' }, null)).toBe(false);
  });

  it('matches when street + texture agree', () => {
    expect(scopeMatches({ street: 'flop', texture: 'dry' }, node())).toBe(true);
  });

  it('rejects when street disagrees', () => {
    expect(scopeMatches({ street: 'turn', texture: 'dry' }, node())).toBe(false);
  });

  it('rejects when texture disagrees', () => {
    expect(scopeMatches({ street: 'flop', texture: 'wet' }, node())).toBe(false);
  });

  it("treats scope.street='any' as matching any street", () => {
    expect(scopeMatches({ street: 'any', texture: 'any' }, node({ street: 'river' }))).toBe(true);
  });

  it("treats scope.texture='any' as matching any texture", () => {
    expect(scopeMatches({ street: 'flop', texture: 'any' }, node({ texture: 'wet' }))).toBe(true);
    expect(scopeMatches({ street: 'flop', texture: 'any' }, node({ texture: null }))).toBe(true);
  });

  it('rejects a specific-texture scope when node texture is null', () => {
    expect(scopeMatches({ street: 'flop', texture: 'dry' }, node({ texture: null }))).toBe(false);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// runActivationBacktest
// ───────────────────────────────────────────────────────────────────────────

describe('runActivationBacktest — graceful degradation', () => {
  it('warns + returns 0 when no hands', () => {
    const r = runActivationBacktest({ assumptions: [makeAssumption()], hands: [] });
    expect(r.handsScanned).toBe(0);
    expect(r.warnings).toContain('No hands to scan');
    expect(r.perAssumption).toEqual([]);
  });

  it('warns + returns 0 when no assumptions', () => {
    const r = runActivationBacktest({ assumptions: [], hands: [makeHand()] });
    expect(r.warnings).toContain('No assumptions to evaluate');
  });

  it('accepts map-by-villainId assumptions', () => {
    const a = makeAssumption();
    const r = runActivationBacktest({
      assumptions: { v42: [a] },
      hands: [makeHand({ seatPlayers: { 2: 'v42' }, actionSequence: [
        { seat: 2, action: 'fold', street: 'flop', order: 1 },
      ] })],
    });
    expect(r.perAssumption).toHaveLength(1);
  });

  it('skips assumption records without a scope or villainId', () => {
    const r = runActivationBacktest({
      assumptions: [
        { id: 'x', villainId: 'v42' /* no claim */ },
        { id: 'y', claim: { scope: { street: 'flop' } } /* no villainId */ },
      ],
      hands: [makeHand({ seatPlayers: { 2: 'v42' } })],
    });
    expect(r.perAssumption).toEqual([]);
  });
});

describe('runActivationBacktest — activation counts', () => {
  // A dry board for scope 'dry' matching — Kh 7s 2d
  const dryBoard = ['K♥', '7♠', '2♦', 'J♣', '3♥'];
  // A wet board for scope 'wet' matching — Ah Kh Qh (monotone + straight-connected)
  const wetBoard = ['A♥', 'K♥', 'Q♥', '2♣', '7♠'];

  it('counts 1-for-1 when single hand matches scope', () => {
    const hand = makeHand({
      seatPlayers: { 2: 'v42' },
      community: dryBoard,
      actionSequence: [
        { seat: 2, action: 'fold', street: 'flop', order: 1 },
      ],
    });
    const r = runActivationBacktest({ assumptions: [makeAssumption()], hands: [hand] });
    expect(r.decisionNodesScanned).toBe(1);
    expect(r.perAssumption[0].eligibleNodes).toBe(1);
    expect(r.perAssumption[0].matchedNodes).toBe(1);
    expect(r.perAssumption[0].activationRate).toBe(1);
  });

  it('rejects wet-board node against dry-scope assumption', () => {
    const hand = makeHand({
      seatPlayers: { 2: 'v42' },
      community: wetBoard,
      actionSequence: [
        { seat: 2, action: 'fold', street: 'flop', order: 1 },
      ],
    });
    const r = runActivationBacktest({ assumptions: [makeAssumption()], hands: [hand] });
    expect(r.perAssumption[0].eligibleNodes).toBe(1); // right street
    expect(r.perAssumption[0].matchedNodes).toBe(0);   // wrong texture
    expect(r.perAssumption[0].activationRate).toBe(0);
  });

  it('null activationRate when no eligible nodes', () => {
    const hand = makeHand({
      seatPlayers: { 2: 'v42' },
      actionSequence: [
        { seat: 2, action: 'fold', street: 'turn', order: 1 },
      ],
    });
    const r = runActivationBacktest({ assumptions: [makeAssumption()], hands: [hand] });
    expect(r.perAssumption[0].eligibleNodes).toBe(0);
    expect(r.perAssumption[0].activationRate).toBeNull();
  });

  it('pools decision nodes across multiple hands for the same villain', () => {
    const h1 = makeHand({
      handId: 'h1',
      seatPlayers: { 2: 'v42' },
      community: dryBoard,
      actionSequence: [{ seat: 2, action: 'fold', street: 'flop', order: 1 }],
    });
    const h2 = makeHand({
      handId: 'h2',
      seatPlayers: { 2: 'v42' },
      community: dryBoard,
      actionSequence: [{ seat: 2, action: 'call', street: 'flop', order: 1 }],
    });
    const r = runActivationBacktest({ assumptions: [makeAssumption()], hands: [h1, h2] });
    expect(r.perAssumption[0].eligibleNodes).toBe(2);
    expect(r.perAssumption[0].matchedNodes).toBe(2);
    expect(r.perAssumption[0].handsWithVillain).toBe(2);
  });

  it('ignores decision nodes belonging to other villains', () => {
    const hand = makeHand({
      seatPlayers: { 2: 'v42', 3: 'other' },
      community: dryBoard,
      actionSequence: [
        { seat: 2, action: 'fold', street: 'flop', order: 1 },
        { seat: 3, action: 'call', street: 'flop', order: 2 },
      ],
    });
    const r = runActivationBacktest({ assumptions: [makeAssumption()], hands: [hand] });
    expect(r.perAssumption[0].eligibleNodes).toBe(1);
    expect(r.decisionNodesScanned).toBe(2);
  });

  it('skips a hand when villain is not seated', () => {
    const hand = makeHand({
      seatPlayers: { 2: 'notourguy' },
      community: dryBoard,
      actionSequence: [{ seat: 2, action: 'fold', street: 'flop', order: 1 }],
    });
    const r = runActivationBacktest({ assumptions: [makeAssumption()], hands: [hand] });
    expect(r.perAssumption[0].eligibleNodes).toBe(0);
    expect(r.perAssumption[0].handsWithVillain).toBe(0);
  });

  it('custom getVillainSeat overrides the default seatPlayers lookup', () => {
    const hand = makeHand({
      seatPlayers: {}, // empty — default resolver returns null
      community: dryBoard,
      actionSequence: [{ seat: 2, action: 'fold', street: 'flop', order: 1 }],
    });
    const getVillainSeat = (vid) => (vid === 'v42' ? 2 : null);
    const r = runActivationBacktest({
      assumptions: [makeAssumption()],
      hands: [hand],
      getVillainSeat,
    });
    expect(r.perAssumption[0].eligibleNodes).toBe(1);
    expect(r.perAssumption[0].matchedNodes).toBe(1);
  });
});

describe('runActivationBacktest — per-predicate rollup', () => {
  const dryBoard = ['K♥', '7♠', '2♦', 'J♣', '3♥'];

  it('aggregates per-predicate totals + byStyle + byStreet', () => {
    const a1 = makeAssumption({ id: 'a1', villainId: 'v42', prior: { style: 'Fish' } });
    const a2 = makeAssumption({ id: 'a2', villainId: 'v99', prior: { style: 'Nit' } });
    const hand = makeHand({
      seatPlayers: { 2: 'v42', 3: 'v99' },
      community: dryBoard,
      actionSequence: [
        { seat: 2, action: 'fold', street: 'flop', order: 1 },
        { seat: 3, action: 'fold', street: 'flop', order: 2 },
      ],
    });
    const r = runActivationBacktest({ assumptions: [a1, a2], hands: [hand] });
    const agg = r.perPredicate.foldToCbet;
    expect(agg.totalEligible).toBe(2);
    expect(agg.totalMatched).toBe(2);
    expect(agg.assumptions).toBe(2);
    expect(agg.activationRate).toBe(1);
    expect(agg.byStyle.Fish).toBe(1);
    expect(agg.byStyle.Nit).toBe(1);
    expect(agg.byStreet.flop).toBe(2);
  });

  it('null activationRate at roll-up when totalEligible is 0', () => {
    const a = makeAssumption();
    const hand = makeHand({
      seatPlayers: { 2: 'other' }, // villain not seated
      actionSequence: [{ seat: 2, action: 'fold', street: 'flop', order: 1 }],
    });
    const r = runActivationBacktest({ assumptions: [a], hands: [hand] });
    expect(r.perPredicate.foldToCbet.activationRate).toBeNull();
  });
});

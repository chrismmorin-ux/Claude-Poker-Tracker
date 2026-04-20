import { describe, test, expect, beforeEach } from 'vitest';
import {
  decomposeHandVsHand,
  clearDecompositionCache,
  BUCKETS,
  BUCKET_LABELS,
} from '../equityDecomposition';
import { computeHandVsHand, clearEquityCache } from '../preflopEquity';

describe('equityDecomposition — structural invariants', () => {
  beforeEach(() => {
    clearDecompositionCache();
    clearEquityCache();
  });

  test('sum of bucket equityShare equals total equity', () => {
    const r = decomposeHandVsHand('AKo', '22');
    const sumEquity = r.buckets.reduce((s, b) => s + b.equityShare, 0);
    expect(sumEquity).toBeCloseTo(r.total, 5);
  }, 60000);

  test('sum of bucket winShare equals total winRate', () => {
    const r = decomposeHandVsHand('AKs', 'JTs');
    const sumWin = r.buckets.reduce((s, b) => s + b.winShare, 0);
    expect(sumWin).toBeCloseTo(r.winRate, 5);
  }, 60000);

  test('sum of bucket tieShare equals total tieRate', () => {
    const r = decomposeHandVsHand('AKs', 'AKo');
    const sumTie = r.buckets.reduce((s, b) => s + b.tieShare, 0);
    expect(sumTie).toBeCloseTo(r.tieRate, 5);
  }, 60000);

  test('sum of bucket hitRate equals 1 (every board is in exactly one bucket)', () => {
    const r = decomposeHandVsHand('AKo', 'QQ');
    const sumHit = r.buckets.reduce((s, b) => s + b.hitRate, 0);
    expect(sumHit).toBeCloseTo(1, 5);
  }, 60000);

  test('total equity matches computeHandVsHand within floating-point tolerance', () => {
    const dec = decomposeHandVsHand('TT', '87s');
    const eq = computeHandVsHand('TT', '87s');
    expect(dec.total).toBeCloseTo(eq.equity, 4);
  }, 120000);
});

describe('equityDecomposition — bucket labeling', () => {
  beforeEach(() => {
    clearDecompositionCache();
  });

  test('buckets are in weakest → strongest order', () => {
    const r = decomposeHandVsHand('AKo', 'QQ');
    expect(r.buckets.map((b) => b.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(r.buckets.map((b) => b.label)).toEqual(BUCKET_LABELS);
  }, 60000);

  test('AA vs 22 — hero rarely has high-card (always has at least a pair)', () => {
    const r = decomposeHandVsHand('AA', '22');
    const highCardHits = r.buckets[BUCKETS.HIGH_CARD].hitRate;
    // AA always has a pair (pocket aces). High-card hits should be 0.
    expect(highCardHits).toBe(0);
  }, 60000);

  test('AA vs KK — TP/overpair is a meaningful bucket, and AA frequently upgrades to set/full house', () => {
    const r = decomposeHandVsHand('AA', 'KK');
    // AA holds as overpair ~35% of boards. The rest upgrades: ~20% set
    // (A on board), ~20%+ full house (set+pair or trips), two pair
    // (board pairs). Assert the TP/OP + SET + FULL_HOUSE combined are
    // the dominant hit surface.
    const tpOp = r.buckets[BUCKETS.TOP_PAIR_OR_OVERPAIR].hitRate;
    const set = r.buckets[BUCKETS.SET].hitRate;
    const fullHouse = r.buckets[BUCKETS.FULL_HOUSE].hitRate;
    expect(tpOp).toBeGreaterThan(0.25);
    expect(set).toBeGreaterThan(0.1);
    // Combined pair-family (TP/OP, TWO_PAIR, SET, FULL_HOUSE) dominates.
    const twoPair = r.buckets[BUCKETS.TWO_PAIR].hitRate;
    expect(tpOp + twoPair + set + fullHouse).toBeGreaterThan(0.85);
  }, 60000);

  test('TT vs 87s — TT often holds as overpair (low board), sometimes beaten by straight/flush', () => {
    const r = decomposeHandVsHand('TT', '87s');
    const straightLoses = r.buckets[BUCKETS.STRAIGHT].loseShare;
    const flushLoses = r.buckets[BUCKETS.FLUSH].loseShare;
    // When hero makes a straight/flush while 87s also does, hero might lose
    // those (villain's straight/flush is often higher). Non-zero expected.
    expect(straightLoses + flushLoses).toBeGreaterThan(0);
  }, 60000);
});

describe('equityDecomposition — caching', () => {
  beforeEach(() => { clearDecompositionCache(); });

  test('second call returns cached result', () => {
    const first = decomposeHandVsHand('AKs', 'JTs');
    const second = decomposeHandVsHand('AKs', 'JTs');
    expect(second.cached).toBe(true);
    expect(second.total).toBe(first.total);
  }, 60000);

  test('flipped matchup is NOT the same cache entry', () => {
    const ab = decomposeHandVsHand('AKs', 'JTs');
    const ba = decomposeHandVsHand('JTs', 'AKs');
    // Totals should be roughly win↔lose swapped.
    expect(ba.winRate).toBeCloseTo(ab.loseRate, 5);
    expect(ba.loseRate).toBeCloseTo(ab.winRate, 5);
    // But BUCKET data is hero-specific, so the arrays differ.
    // Neither is the "cached" flag of the other — they're independent.
    expect(ba.cached).toBeUndefined();
  }, 120000);
});

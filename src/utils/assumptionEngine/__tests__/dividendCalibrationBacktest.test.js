import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runDividendCalibrationBacktest,
  __TEST_ONLY__,
} from '../__backtest__/dividendCalibrationBacktest';

const { computeGap, flattenAssumptions, resolveTendency, HEURISTIC_EPS } = __TEST_ONLY__;

// Mock the citedDecision modules — we control engine output for deterministic tests.
vi.mock('../../citedDecision/computeBaselineForAssumption', () => ({
  computeBaselineForAssumption: vi.fn(),
}));

vi.mock('../../citedDecision/citedDecisionProducer', () => ({
  produceCitedDecision: vi.fn(),
}));

import { computeBaselineForAssumption } from '../../citedDecision/computeBaselineForAssumption';
import { produceCitedDecision } from '../../citedDecision/citedDecisionProducer';

const makeAssumption = (overrides = {}) => ({
  id: overrides.id ?? 'v42:foldToRiverBet@river',
  villainId: overrides.villainId ?? 'v42',
  schemaVersion: '1.1',
  status: 'active',
  claim: {
    predicate: overrides.predicate ?? 'foldToRiverBet',
    operator: '<=',
    threshold: 0.25,
    scope: { street: overrides.street ?? 'river', texture: 'wet', position: 'IP', sprRange: [2, 4], betSizeRange: [0.66, 1.0], playersToAct: 0, activationFrequency: 0.04 },
  },
  consequence: {
    deviationType: overrides.deviationType ?? 'bluff-prune',
    expectedDividend: { mean: overrides.heuristicMean ?? 0.85, sd: 0.15, sharpe: 5.7, unit: 'bb per 100 trigger firings' },
  },
  evidence: { posteriorConfidence: 0.85, sampleSize: 52 },
  stability: {},
  recognizability: {},
  counterExploit: {},
  operator: { currentDial: 0.6 },
  narrative: {},
  quality: { composite: 0.85, actionableInDrill: true },
  validation: {},
  _villainSnapshot: { villainId: overrides.villainId ?? 'v42', style: overrides.style ?? 'Fish' },
  ...overrides,
});

const successBaseline = (node = { templateId: 'tmpl-1', display: { street: 'river' } }) => ({
  baseline: {
    actionEVs: { bet: { ev: 1.5, sizing: 0.75 }, check: { ev: 0.5 } },
    villainDistribution: { fold: 0.25, call: 0.65, raise: 0.10 },
    recommendedAction: { action: 'bet', ev: 1.5, sizing: 0.75 },
  },
  node,
  source: 'synthesized',
});

const successCited = (dividend = 0.30) => ({
  baselineAction: { action: 'bet', ev: 1.5 },
  recommendedAction: { action: 'check', ev: 1.8 },
  dividend,
  citations: [],
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────────────────────────────────────────────────────────
// computeGap (pure helper)
// ───────────────────────────────────────────────────────────────────────────

describe('computeGap', () => {
  it('returns null when either input is non-finite', () => {
    expect(computeGap(NaN, 0.5)).toBeNull();
    expect(computeGap(0.5, NaN)).toBeNull();
    expect(computeGap(null, 0.5)).toBeNull();
    expect(computeGap(0.5, undefined)).toBeNull();
  });

  it('returns ratio when |heuristic| ≥ HEURISTIC_EPS', () => {
    // |0.85 - 0.31| / |0.85| ≈ 0.6353
    expect(computeGap(0.85, 0.31)).toBeCloseTo(0.6353, 3);
  });

  it('returns absolute error when |heuristic| < HEURISTIC_EPS', () => {
    // |0.01 - 0.05| = 0.04 (NOT |0.04|/|0.01| = 4)
    expect(computeGap(0.01, 0.05)).toBeCloseTo(0.04, 5);
  });

  it('returns 0 when both inputs are 0', () => {
    expect(computeGap(0, 0)).toBe(0);
  });

  it('handles negative dividends', () => {
    // |-0.5 - 0.5| / 0.5 = 2.0
    expect(computeGap(-0.5, 0.5)).toBeCloseTo(2.0, 3);
  });

  it('HEURISTIC_EPS sanity', () => {
    expect(HEURISTIC_EPS).toBeGreaterThan(0);
    expect(HEURISTIC_EPS).toBeLessThan(0.5);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// flattenAssumptions
// ───────────────────────────────────────────────────────────────────────────

describe('flattenAssumptions', () => {
  it('returns array as-is filtered for null', () => {
    const arr = [makeAssumption(), null, makeAssumption({ id: 'b' })];
    expect(flattenAssumptions(arr)).toHaveLength(2);
  });

  it('flattens map-by-villainId', () => {
    const map = { v1: [makeAssumption({ id: 'a' })], v2: [makeAssumption({ id: 'b' })] };
    expect(flattenAssumptions(map)).toHaveLength(2);
  });

  it('returns empty for null/undefined input', () => {
    expect(flattenAssumptions(null)).toEqual([]);
    expect(flattenAssumptions(undefined)).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// resolveTendency
// ───────────────────────────────────────────────────────────────────────────

describe('resolveTendency', () => {
  it('prefers explicit villainTendencies entry', () => {
    const a = makeAssumption({ style: 'Fish' });
    expect(resolveTendency(a, { v42: { style: 'Nit' } })).toEqual({ style: 'Nit' });
  });

  it('falls back to _villainSnapshot.style', () => {
    const a = makeAssumption({ style: 'LAG' });
    expect(resolveTendency(a, {})).toEqual({ style: 'LAG' });
  });

  it('defaults to Unknown when neither present', () => {
    const a = makeAssumption();
    delete a._villainSnapshot;
    expect(resolveTendency(a, {})).toEqual({ style: 'Unknown' });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// runDividendCalibrationBacktest — happy path + rollups
// ───────────────────────────────────────────────────────────────────────────

describe('runDividendCalibrationBacktest — success path', () => {
  it('computes per-assumption gap and classification on engine success', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.31));

    const a = makeAssumption({ heuristicMean: 0.85 });
    const report = await runDividendCalibrationBacktest({ assumptions: [a] });

    expect(report.assumptionsScanned).toBe(1);
    expect(report.engineBailouts).toBe(0);
    expect(report.perAssumption).toHaveLength(1);
    const row = report.perAssumption[0];
    expect(row.heuristicDividend).toBe(0.85);
    expect(row.engineDividend).toBeCloseTo(0.31, 5);
    expect(row.gap).toBeCloseTo(0.6353, 3);
    expect(row.classification).toBe('expiring'); // > 0.35
    expect(row.synthesizedNode).toEqual({ templateId: 'tmpl-1', display: { street: 'river' } });
  });

  it('per-predicate rollup averages gaps + computes avgHeuristic / avgEngine', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.40)); // gap = |0.85-0.40|/0.85 = 0.529

    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.80)); // gap = |0.85-0.80|/0.85 ≈ 0.059

    const report = await runDividendCalibrationBacktest({
      assumptions: [
        makeAssumption({ id: 'a1', heuristicMean: 0.85 }),
        makeAssumption({ id: 'a2', heuristicMean: 0.85 }),
      ],
    });
    const agg = report.perPredicate.foldToRiverBet;
    expect(agg.assumptions).toBe(2);
    expect(agg.avgHeuristic).toBeCloseTo(0.85, 5);
    expect(agg.avgEngine).toBeCloseTo(0.60, 2);
    // (0.529 + 0.059) / 2 ≈ 0.294
    expect(agg.avgGap).toBeCloseTo(0.294, 2);
    expect(agg.classification).toBe('conservative-ceiling');
  });

  it('byStyle / byStreet rollups count correctly', async () => {
    // 2 Fish-river + 1 Nit-flop, all foldToCbet
    for (let i = 0; i < 3; i++) {
      computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
      produceCitedDecision.mockReturnValueOnce(successCited(0.50));
    }
    const report = await runDividendCalibrationBacktest({
      assumptions: [
        makeAssumption({ id: 'a1', predicate: 'foldToCbet', style: 'Fish', street: 'river' }),
        makeAssumption({ id: 'a2', predicate: 'foldToCbet', style: 'Fish', street: 'river' }),
        makeAssumption({ id: 'a3', predicate: 'foldToCbet', style: 'Nit',  street: 'flop'  }),
      ],
    });
    const agg = report.perPredicate.foldToCbet;
    expect(agg.byStyle).toEqual({ Fish: 2, Nit: 1 });
    expect(agg.byStreet).toEqual({ river: 2, flop: 1 });
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Engine bailouts
// ───────────────────────────────────────────────────────────────────────────

describe('runDividendCalibrationBacktest — engine bailouts', () => {
  it('records gameTree-error per assumption + excludes from rollup', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce({
      baseline: null,
      node: { templateId: 'tmpl-x', display: {} },
      reason: 'gameTree-error',
      error: 'MC failed',
    });

    const report = await runDividendCalibrationBacktest({
      assumptions: [makeAssumption()],
    });
    expect(report.engineBailouts).toBe(1);
    expect(report.perAssumption[0].reason).toBe('gameTree-error');
    expect(report.perAssumption[0].engineDividend).toBeNull();
    expect(report.perAssumption[0].gap).toBeNull();
    expect(report.perAssumption[0].classification).toBe('no-data');
    // excluded from rollup
    expect(Object.keys(report.perPredicate)).toHaveLength(0);
    expect(report.warnings.some((w) => w.includes('engine could not produce'))).toBe(true);
  });

  it('records gameTree-empty per assumption', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce({
      baseline: null,
      node: { templateId: 'tmpl-x', display: {} },
      reason: 'gameTree-empty',
    });

    const report = await runDividendCalibrationBacktest({
      assumptions: [makeAssumption()],
    });
    expect(report.engineBailouts).toBe(1);
    expect(report.perAssumption[0].reason).toBe('gameTree-empty');
  });

  it('records producer-no-citation when produceCitedDecision returns insufficient-baseline', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce({ citation: null, reason: 'insufficient-baseline' });

    const report = await runDividendCalibrationBacktest({
      assumptions: [makeAssumption()],
    });
    expect(report.engineBailouts).toBe(1);
    expect(report.perAssumption[0].reason).toBe('insufficient-baseline');
  });

  it('records producer-error when produceCitedDecision throws', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockImplementationOnce(() => { throw new Error('producer crash'); });

    const report = await runDividendCalibrationBacktest({
      assumptions: [makeAssumption()],
    });
    expect(report.engineBailouts).toBe(1);
    expect(report.perAssumption[0].reason).toContain('producer-error');
    expect(report.perAssumption[0].reason).toContain('producer crash');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Input flexibility
// ───────────────────────────────────────────────────────────────────────────

describe('runDividendCalibrationBacktest — input flexibility', () => {
  it('accepts map-by-villainId', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));
    const report = await runDividendCalibrationBacktest({
      assumptions: { v42: [makeAssumption()] },
    });
    expect(report.assumptionsScanned).toBe(1);
  });

  it('returns warning + empty report for no assumptions', async () => {
    const report = await runDividendCalibrationBacktest({ assumptions: [] });
    expect(report.assumptionsScanned).toBe(0);
    expect(report.warnings).toContain('No assumptions to evaluate');
  });

  it('uses _villainSnapshot.style as tendency fallback when villainTendencies absent', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));
    const a = makeAssumption({ style: 'Nit' });
    const report = await runDividendCalibrationBacktest({ assumptions: [a] });
    // Engine call received { style: 'Nit' } from the snapshot.
    const call = computeBaselineForAssumption.mock.calls.at(0)[0];
    expect(call.villainTendency).toEqual({ style: 'Nit' });
    // The row's style reflects the resolved tendency
    expect(report.perAssumption[0].style).toBe('Nit');
  });

  it('villainTendencies override beats _villainSnapshot', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));
    const a = makeAssumption({ style: 'Fish' }); // snapshot says Fish
    await runDividendCalibrationBacktest({
      assumptions: [a],
      villainTendencies: { v42: { style: 'Nit', otherField: 'x' } },
    });
    const call = computeBaselineForAssumption.mock.calls.at(0)[0];
    expect(call.villainTendency.style).toBe('Nit');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Activation join
// ───────────────────────────────────────────────────────────────────────────

describe('runDividendCalibrationBacktest — activation join', () => {
  it('passes activation rate through to perAssumption row when hands present', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));

    // Construct a hand that DOES match the river + wet scope so activation > 0.
    // Using the same approach as historyBacktest tests — minimal hand record.
    const hand = {
      handId: 'h1',
      gameState: {
        mySeat: 1,
        actionSequence: [
          { seat: 5, street: 'river', action: 'bet', amount: 50 },
        ],
      },
      cardState: {
        // Wet board (T♥9♥6♠5♦2♣) — matches scope.texture='wet'
        communityCards: ['T♥', '9♥', '6♠', '5♦', '2♣'],
      },
      seatPlayers: { '5': 'v42' },
    };

    const a = makeAssumption();
    const report = await runDividendCalibrationBacktest({
      assumptions: [a],
      hands: [hand],
    });
    // Activation rate joined when hands present — value is what runActivationBacktest produced.
    // Even if specific match doesn't fire, activationRate field should exist.
    expect(report.perAssumption[0]).toHaveProperty('activationRate');
    expect(report.perAssumption[0]).toHaveProperty('eligibleNodes');
  });

  it('activation fields are null when hands absent', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));
    const report = await runDividendCalibrationBacktest({ assumptions: [makeAssumption()] });
    expect(report.perAssumption[0].activationRate).toBeNull();
    expect(report.perAssumption[0].eligibleNodes).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Real-mode (Plan B / S21)
// ───────────────────────────────────────────────────────────────────────────

const makeRealHand = (overrides = {}) => ({
  handId: overrides.handId ?? 'h1',
  sessionId: overrides.sessionId ?? 's1',
  gameState: {
    mySeat: 1,
    dealerButtonSeat: 9,
    absentSeats: [],
    actionSequence: overrides.actionSequence ?? [
      { seat: 5, street: 'preflop', action: 'raise', amount: 6, order: 1 },
      { seat: 1, street: 'preflop', action: 'call', amount: 6, order: 2 },
      { seat: 5, street: 'flop', action: 'bet', amount: 8, order: 3 },
      { seat: 1, street: 'flop', action: 'call', amount: 8, order: 4 },
      // River bet — the matched node for foldToRiverBet scope
      { seat: 5, street: 'river', action: 'bet', amount: 20, order: 5 },
    ],
    potOverride: null,
  },
  cardState: {
    holeCards: ['A♠', 'K♠'],
    holeCardsVisible: true,
    // Wet river board (matches scope.texture='wet')
    communityCards: ['T♥', '9♥', '6♠', '5♦', '2♣'],
  },
  seatPlayers: { '5': 'v42' },
});

describe('runDividendCalibrationBacktest — mode=real (Plan B / S21)', () => {
  it('default mode is synthesized (Plan A backward compat)', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));
    const report = await runDividendCalibrationBacktest({ assumptions: [makeAssumption()] });
    expect(report.mode).toBe('synthesized');
    expect(report.perFiringSkipped).toBeUndefined();
  });

  it('mode=real walks matched nodes, evaluates per firing, averages dividend', async () => {
    // Two firings, two distinct dividends, mean = 0.40
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.50));

    const a = makeAssumption({ heuristicMean: 0.85 });
    // Use two hands with one matched river-bet each
    const hand1 = makeRealHand({ handId: 'h1' });
    const hand2 = makeRealHand({ handId: 'h2' });

    const report = await runDividendCalibrationBacktest({
      assumptions: [a],
      hands: [hand1, hand2],
      mode: 'real',
    });

    expect(report.mode).toBe('real');
    expect(report.perFiringSkipped).toBe(0);
    expect(report.perAssumption[0].engineDividend).toBeCloseTo(0.40, 5);
    expect(report.perAssumption[0].firings).toBe(2);
    expect(report.perAssumption[0].firingsSkipped).toBe(0);
    expect(report.perAssumption[0].gap).toBeCloseTo(Math.abs(0.85 - 0.40) / 0.85, 3);
  });

  it('skipped firings tally into report.perFiringSkipped + perAssumption.firingsSkipped', async () => {
    // First firing: missing hero cards → skipped (no engine call expected)
    // Second firing: succeeds
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));

    const handMissingCards = makeRealHand({ handId: 'h1' });
    handMissingCards.cardState.holeCards = ['', ''];
    const handGood = makeRealHand({ handId: 'h2' });

    const report = await runDividendCalibrationBacktest({
      assumptions: [makeAssumption({ heuristicMean: 0.85 })],
      hands: [handMissingCards, handGood],
      mode: 'real',
    });

    expect(report.perFiringSkipped).toBe(1);
    expect(report.skipReasonCounts['missing-hero-cards']).toBe(1);
    expect(report.perAssumption[0].firings).toBe(1);
    expect(report.perAssumption[0].firingsSkipped).toBe(1);
    // engineDividend reflects the one successful firing
    expect(report.perAssumption[0].engineDividend).toBeCloseTo(0.30, 5);
  });

  it('all firings skipped → assumption recorded as no-data with reason=all-firings-skipped', async () => {
    // No engine calls expected — all firings skipped at reconstruction
    const handMissingCards = makeRealHand({ handId: 'h1' });
    handMissingCards.cardState.holeCards = ['', ''];

    const report = await runDividendCalibrationBacktest({
      assumptions: [makeAssumption()],
      hands: [handMissingCards],
      mode: 'real',
    });

    expect(report.perAssumption[0].engineDividend).toBeNull();
    expect(report.perAssumption[0].reason).toBe('all-firings-skipped');
    expect(report.perAssumption[0].firingsSkipped).toBeGreaterThan(0);
    // Excluded from rollup
    expect(report.perPredicate.foldToRiverBet).toBeUndefined();
    expect(report.engineBailouts).toBe(1);
  });

  it('no-hands edge → warning + per-assumption recorded as bailout', async () => {
    const report = await runDividendCalibrationBacktest({
      assumptions: [makeAssumption()],
      hands: [],
      mode: 'real',
    });
    expect(report.warnings.some((w) => w.includes('Real-mode requires hands'))).toBe(true);
    expect(report.perAssumption[0].engineDividend).toBeNull();
    expect(report.perAssumption[0].reason).toBe('no-hands');
  });

  it('getSession callback resolves blinds per session', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));

    const getSession = vi.fn(async (sid) => ({ sessionId: sid, gameType: '5/10' }));
    const hand = makeRealHand({ sessionId: 'session-A' });

    await runDividendCalibrationBacktest({
      assumptions: [makeAssumption()],
      hands: [hand],
      mode: 'real',
      getSession,
    });

    expect(getSession).toHaveBeenCalledWith('session-A');
  });

  it('honors reconstructorDefaults override (effective stack)', async () => {
    computeBaselineForAssumption.mockResolvedValueOnce(successBaseline());
    produceCitedDecision.mockReturnValueOnce(successCited(0.30));

    const hand = makeRealHand();

    await runDividendCalibrationBacktest({
      assumptions: [makeAssumption()],
      hands: [hand],
      mode: 'real',
      reconstructorDefaults: { effectiveStackBB: 50 },
    });

    // computeBaselineForAssumption received the reconstructed node — verify effectiveStack
    const call = computeBaselineForAssumption.mock.calls.at(0)[0];
    expect(call.node).toBeTruthy();
    expect(call.node.effectiveStack).toBe(100); // 50 × bb=2
  });
});


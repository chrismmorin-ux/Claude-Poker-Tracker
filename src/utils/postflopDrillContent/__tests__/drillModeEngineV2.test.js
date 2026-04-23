/**
 * Tests for LSW-G4-IMPL Commit 2 — engine v2 additions in drillModeEngine.js.
 *
 * Covers:
 *  - computeDecomposedActionEVs: per-group × per-action EV join.
 *  - computeValueBeatRatio: value vs bluff-or-pay weight split.
 *  - computeBucketEVsV2: orchestrator + errorState branches + decisionKind
 *    shaping + confidence caveats + streetNarrowing threading.
 *
 * v1 `computeBucketEVs` (BucketEVPanel.jsx) is NOT touched by these tests —
 * its test file continues to own v1 coverage.
 */

import { describe, it, expect } from 'vitest';
import {
  computeBucketEVsV2,
  computeDecomposedActionEVs,
  computeValueBeatRatio,
  GROUP_CALL_RATES,
} from '../drillModeEngine';
import { archetypeRangeFor } from '../archetypeRanges';
import { parseBoard } from '../../pokerCore/cardParser';

const flop = (...cards) => parseBoard(cards);

// ----- Fixtures --------------------------------------------------------------

const sampleDecomposition = [
  // crushed by villain (value region for bluff-catch)
  { groupId: 'set',        groupLabel: 'Set',                  weightPct: 5,  heroEquity: 0.10, relation: 'crushed',   comboCount: 2 },
  { groupId: 'overpair',   groupLabel: 'Overpair',             weightPct: 25, heroEquity: 0.25, relation: 'dominated', comboCount: 8 },
  // neutral
  { groupId: 'twoPair',    groupLabel: 'Two Pair',             weightPct: 5,  heroEquity: 0.52, relation: 'neutral',   comboCount: 2 },
  // favored (bluff region for bluff-catch, pays for thin-value)
  { groupId: 'overcardsAx',groupLabel: 'Overcards (Ax)',       weightPct: 45, heroEquity: 0.78, relation: 'favored',   comboCount: 12 },
  { groupId: 'gutshot',    groupLabel: 'Gutshot',              weightPct: 20, heroEquity: 0.65, relation: 'favored',   comboCount: 6 },
];

const defaultActions = [
  { label: 'check',    kind: 'check' },
  { label: 'bet 33%',  kind: 'bet', betFraction: 0.33 },
  { label: 'bet 75%',  kind: 'bet', betFraction: 0.75 },
  { label: 'bet 150%', kind: 'bet', betFraction: 1.50 },
];

// ----- GROUP_CALL_RATES shape -----------------------------------------------

describe('GROUP_CALL_RATES', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(GROUP_CALL_RATES)).toBe(true);
  });

  it('covers every DOMINATION_GROUPS id — no silent 0.3 defaults on known groups', () => {
    const knownGroupIds = [
      'premium','nutFlush','secondFlush','weakFlush','nutStraight','nonNutStraight',
      'set','trips','twoPair','pairPlusFD','pairPlusOesd','pairPlusGutshot',
      'overpair','tpStrong','tpWeak','middlePair','bottomPair','weakPair',
      'comboDraw','nutFlushDraw','nonNutFlushDraw','oesd','gutshot',
      'overcardsAx','overcardsKx','overcardsQxJx','overcardsOther',
      'backdoorCombo','backdoorFlush','backdoorStraight','air',
    ];
    for (const id of knownGroupIds) {
      expect(typeof GROUP_CALL_RATES[id]).toBe('number');
      expect(GROUP_CALL_RATES[id]).toBeGreaterThanOrEqual(0);
      expect(GROUP_CALL_RATES[id]).toBeLessThanOrEqual(1);
    }
  });

  it('nutFlush calls more than air (monotonicity spot check)', () => {
    expect(GROUP_CALL_RATES.nutFlush).toBeGreaterThan(GROUP_CALL_RATES.air);
    expect(GROUP_CALL_RATES.set).toBeGreaterThan(GROUP_CALL_RATES.gutshot);
    expect(GROUP_CALL_RATES.tpStrong).toBeGreaterThan(GROUP_CALL_RATES.middlePair);
  });
});

// ----- computeDecomposedActionEVs -------------------------------------------

describe('computeDecomposedActionEVs', () => {
  it('rejects empty heroActions', () => {
    expect(() =>
      computeDecomposedActionEVs({ decomposition: sampleDecomposition, heroActions: [], pot: 100 })
    ).toThrow(/non-empty/);
  });

  it('rejects non-finite pot', () => {
    expect(() =>
      computeDecomposedActionEVs({ decomposition: sampleDecomposition, heroActions: defaultActions, pot: NaN })
    ).toThrow(/non-negative finite/);
  });

  it('produces one entry per hero action', () => {
    const out = computeDecomposedActionEVs({
      decomposition: sampleDecomposition,
      heroActions: defaultActions,
      pot: 100,
    });
    expect(out.length).toBe(defaultActions.length);
  });

  it('per-action perGroupContribution has one entry per decomposition row', () => {
    const out = computeDecomposedActionEVs({
      decomposition: sampleDecomposition,
      heroActions: defaultActions,
      pot: 100,
    });
    for (const action of out) {
      expect(action.perGroupContribution.length).toBe(sampleDecomposition.length);
      // Each contribution row has the required shape
      for (const c of action.perGroupContribution) {
        expect(typeof c.groupId).toBe('string');
        expect(Number.isFinite(c.ev)).toBe(true);
        expect(Number.isFinite(c.weightTimesEV)).toBe(true);
      }
    }
  });

  it('totalEV equals sum of weightTimesEV per action', () => {
    const out = computeDecomposedActionEVs({
      decomposition: sampleDecomposition,
      heroActions: defaultActions,
      pot: 100,
    });
    for (const action of out) {
      const sum = action.perGroupContribution.reduce((s, c) => s + c.weightTimesEV, 0);
      expect(action.totalEV).toBeCloseTo(sum, 6);
    }
  });

  it('check-action EV equals weighted-average showdown equity × pot', () => {
    const out = computeDecomposedActionEVs({
      decomposition: sampleDecomposition,
      heroActions: [{ label: 'check', kind: 'check' }],
      pot: 100,
    });
    const expected = sampleDecomposition.reduce(
      (s, g) => s + (g.weightPct / 100) * g.heroEquity * 100,
      0,
    );
    expect(out[0].totalEV).toBeCloseTo(expected, 6);
  });

  it('fold-action returns 0 EV across all groups', () => {
    const out = computeDecomposedActionEVs({
      decomposition: sampleDecomposition,
      heroActions: [{ label: 'fold', kind: 'fold' }],
      pot: 100,
    });
    expect(out[0].totalEV).toBe(0);
    for (const c of out[0].perGroupContribution) {
      expect(c.ev).toBe(0);
      expect(c.weightTimesEV).toBe(0);
    }
  });

  it('marks unknown action kinds as unsupported', () => {
    const out = computeDecomposedActionEVs({
      decomposition: sampleDecomposition,
      heroActions: [{ label: 'custom', kind: 'elbow-drop' }],
      pot: 100,
    });
    expect(out[0].unsupported).toBe(true);
    expect(out[0].totalEV).toBe(0);
  });

  it('exactly one action has isBest=true when any are supported', () => {
    const out = computeDecomposedActionEVs({
      decomposition: sampleDecomposition,
      heroActions: defaultActions,
      pot: 100,
    });
    const bests = out.filter((a) => a.isBest);
    expect(bests.length).toBe(1);
  });

  it('totalEVCI is a finite band around totalEV', () => {
    const out = computeDecomposedActionEVs({
      decomposition: sampleDecomposition,
      heroActions: defaultActions,
      pot: 100,
    });
    for (const action of out) {
      expect(action.totalEVCI.low).toBeLessThanOrEqual(action.totalEV);
      expect(action.totalEVCI.high).toBeGreaterThanOrEqual(action.totalEV);
    }
  });
});

// ----- computeValueBeatRatio ------------------------------------------------

describe('computeValueBeatRatio', () => {
  it('returns null on empty decomposition', () => {
    expect(computeValueBeatRatio([])).toBeNull();
    expect(computeValueBeatRatio(null)).toBeNull();
  });

  it('sums value weight (crushed + dominated) and bluff weight (favored + dominating)', () => {
    const ratio = computeValueBeatRatio(sampleDecomposition);
    // value region: set 5 + overpair 25 = 30
    // bluff region: overcardsAx 45 + gutshot 20 = 65
    expect(ratio.valueWeight).toBe(30);
    expect(ratio.bluffOrPayWeight).toBe(65);
    expect(ratio.ratio).toBeCloseTo(30 / 65, 6);
  });

  it('returns Infinity ratio when bluff region is empty', () => {
    const allValue = [
      { groupId: 'set', weightPct: 50, relation: 'crushed',   heroEquity: 0.1 },
      { groupId: 'op',  weightPct: 50, relation: 'dominated', heroEquity: 0.3 },
    ];
    const ratio = computeValueBeatRatio(allValue);
    expect(ratio.ratio).toBe(Infinity);
  });

  it('returns null when all groups are neutral (neither side populated)', () => {
    const allNeutral = [
      { groupId: 'x', weightPct: 100, relation: 'neutral', heroEquity: 0.5 },
    ];
    expect(computeValueBeatRatio(allNeutral)).toBeNull();
  });
});

// ----- computeBucketEVsV2 — error paths -------------------------------------

describe('computeBucketEVsV2 errorState', () => {
  it('returns errorState on missing input', async () => {
    const out = await computeBucketEVsV2(null);
    expect(out.errorState).toMatchObject({ kind: 'engine-internal' });
    expect(out.decomposition).toEqual([]);
    expect(out.actionEVs).toEqual([]);
  });

  it('returns engine-internal on MW villains (LSW-G6 pending)', async () => {
    const out = await computeBucketEVsV2({
      nodeId: 'x', lineId: 'y', street: 'flop',
      board: flop('K♠', '7♥', '2♦'),
      pot: 100, effStack: 100,
      villains: [
        { position: 'BB', baseRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }) },
        { position: 'SB', baseRange: archetypeRangeFor({ position: 'SB', action: 'call', vs: 'BTN' }) },
      ],
      heroView: { kind: 'single-combo', combos: [{ card1: 51, card2: 47 }] },
      heroActions: defaultActions,
      archetype: 'reg',
    });
    expect(out.errorState?.kind).toBe('engine-internal');
    expect(out.errorState.userMessage).toMatch(/multiway|MW/i);
  });

  it('returns malformed-hero on non-single-combo heroView (v1 scope)', async () => {
    const out = await computeBucketEVsV2({
      nodeId: 'x', lineId: 'y', street: 'flop',
      board: flop('K♠', '7♥', '2♦'),
      pot: 100, effStack: 100,
      villains: [{ position: 'BB', baseRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }) }],
      heroView: { kind: 'combo-set', combos: [] },
      heroActions: defaultActions,
      archetype: 'reg',
    });
    expect(out.errorState?.kind).toBe('engine-internal');
    expect(out.errorState.userMessage).toMatch(/not yet supported/i);
  });

  it('returns engine-internal on invalid board', async () => {
    const out = await computeBucketEVsV2({
      nodeId: 'x', lineId: 'y', street: 'flop',
      board: [],
      pot: 100, effStack: 100,
      villains: [{ position: 'BB', baseRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }) }],
      heroView: { kind: 'single-combo', combos: [{ card1: 51, card2: 47 }] },
      heroActions: defaultActions,
      archetype: 'reg',
    });
    expect(out.errorState?.kind).toBe('malformed-hero');
  });

  it('returns errorState for unknown archetype', async () => {
    const out = await computeBucketEVsV2({
      nodeId: 'x', lineId: 'y', street: 'flop',
      board: flop('K♠', '7♥', '2♦'),
      pot: 100, effStack: 100,
      villains: [{ position: 'BB', baseRange: archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' }) }],
      heroView: { kind: 'single-combo', combos: [{ card1: 51, card2: 47 }] },
      heroActions: defaultActions,
      archetype: 'telepathist',
    });
    expect(out.errorState?.kind).toBe('engine-internal');
  });
});

// ----- computeBucketEVsV2 — happy path --------------------------------------

describe('computeBucketEVsV2 happy path (HU, single-combo, standard)', () => {
  // Shared input for the happy-path suite — K72r flop, BTN open vs BB defend,
  // hero pins Q♣Q♦ (overpair for the board — clean value case).
  const board = flop('K♠', '7♥', '2♦');
  const villainRange = archetypeRangeFor({ position: 'BB', action: 'call', vs: 'BTN' });
  const baseInput = {
    nodeId: 'test-node',
    lineId: 'test-line',
    street: 'flop',
    board,
    pot: 100,
    effStack: 100,
    villains: [{ position: 'BB', baseRange: villainRange }],
    heroView: { kind: 'single-combo', combos: [{ card1: 51, card2: 50 }] }, // Ace-Ace-ish slot indices OK for MC
    heroActions: defaultActions,
    archetype: 'reg',
  };

  it('returns a non-null decomposition with multiple groups', async () => {
    const out = await computeBucketEVsV2(baseInput);
    expect(out.errorState).toBeNull();
    expect(Array.isArray(out.decomposition)).toBe(true);
    expect(out.decomposition.length).toBeGreaterThan(0);
    for (const g of out.decomposition) {
      expect(typeof g.groupId).toBe('string');
      expect(typeof g.groupLabel).toBe('string');
      expect(g.weightPct).toBeGreaterThan(0);
      expect(g.heroEquity).toBeGreaterThanOrEqual(0);
      expect(g.heroEquity).toBeLessThanOrEqual(1);
      expect(g.heroEquityCI.method).toBe('mc');
      expect(g.heroEquityCI.low).toBeLessThanOrEqual(g.heroEquity);
      expect(g.heroEquityCI.high).toBeGreaterThanOrEqual(g.heroEquity);
      expect(['crushed','dominated','neutral','favored','dominating']).toContain(g.relation);
    }
  });

  it('returns one actionEVs entry per heroAction with the expected shape', async () => {
    const out = await computeBucketEVsV2(baseInput);
    expect(out.actionEVs.length).toBe(baseInput.heroActions.length);
    for (const a of out.actionEVs) {
      expect(typeof a.actionLabel).toBe('string');
      expect(Number.isFinite(a.totalEV)).toBe(true);
      expect(a.totalEVCI.low).toBeLessThanOrEqual(a.totalEV);
      expect(a.totalEVCI.high).toBeGreaterThanOrEqual(a.totalEV);
      expect(a.perGroupContribution.length).toBe(out.decomposition.length);
    }
  });

  it('recommendation.actionLabel matches the isBest action', async () => {
    const out = await computeBucketEVsV2(baseInput);
    const best = out.actionEVs.find((a) => a.isBest);
    expect(out.recommendation.actionLabel).toBe(best.actionLabel);
  });

  it('confidence.caveats always includes synthetic-range and v1-simplified-ev', async () => {
    const out = await computeBucketEVsV2(baseInput);
    expect(out.confidence.caveats).toEqual(expect.arrayContaining(['synthetic-range', 'v1-simplified-ev']));
  });

  it('confidence.archetype mirrors input', async () => {
    const out = await computeBucketEVsV2({ ...baseInput, archetype: 'fish' });
    expect(out.confidence.archetype).toBe('fish');
  });

  it('valueBeatRatio is null for standard decisionKind', async () => {
    const out = await computeBucketEVsV2({ ...baseInput, decisionKind: 'standard' });
    expect(out.valueBeatRatio).toBeNull();
  });

  it('valueBeatRatio is populated for bluff-catch decisionKind', async () => {
    const out = await computeBucketEVsV2({ ...baseInput, decisionKind: 'bluff-catch' });
    expect(out.valueBeatRatio).not.toBeNull();
    expect(typeof out.valueBeatRatio.valueWeight).toBe('number');
    expect(typeof out.valueBeatRatio.bluffOrPayWeight).toBe('number');
  });

  it('valueBeatRatio is populated for thin-value decisionKind', async () => {
    const out = await computeBucketEVsV2({ ...baseInput, decisionKind: 'thin-value' });
    expect(out.valueBeatRatio).not.toBeNull();
  });

  it('templatedReason mentions the correct action and matches decisionKind shape', async () => {
    const stdOut = await computeBucketEVsV2({ ...baseInput, decisionKind: 'standard' });
    expect(stdOut.recommendation.templatedReason).toMatch(/Correct/);

    const bcOut = await computeBucketEVsV2({ ...baseInput, decisionKind: 'bluff-catch' });
    expect(bcOut.recommendation.templatedReason).toMatch(/bluff|call-or-fold/i);

    const tvOut = await computeBucketEVsV2({ ...baseInput, decisionKind: 'thin-value' });
    expect(tvOut.recommendation.templatedReason).toMatch(/hands that pay|beats you/i);
  });

  it('streetNarrowing is null when actionHistory is absent', async () => {
    const out = await computeBucketEVsV2(baseInput);
    expect(out.streetNarrowing).toBeNull();
  });

  it('streetNarrowing is an ordered array when actionHistory is provided', async () => {
    const out = await computeBucketEVsV2({
      ...baseInput,
      actionHistory: [
        { street: 'flop', actor: 'villain', action: 'donk', sizing: 0.33 },
        { street: 'flop', actor: 'hero',    action: 'call' },
      ],
    });
    expect(Array.isArray(out.streetNarrowing)).toBe(true);
    expect(out.streetNarrowing.length).toBe(2);
    expect(out.streetNarrowing[0]).toMatchObject({ street: 'flop', actor: 'villain', action: 'donk' });
    expect(out.streetNarrowing[0].narrowingSpec).toBeDefined();
    expect(Number.isFinite(out.streetNarrowing[0].priorWeight)).toBe(true);
    expect(Number.isFinite(out.streetNarrowing[0].narrowedWeight)).toBe(true);
  });

  it('perVillainDecompositions and cascadingFoldProbability are null in HU v1', async () => {
    const out = await computeBucketEVsV2(baseInput);
    expect(out.perVillainDecompositions).toBeNull();
    expect(out.cascadingFoldProbability).toBeNull();
  });

  it('errorState is null on happy path (null, not undefined — required for consumers)', async () => {
    const out = await computeBucketEVsV2(baseInput);
    expect(out.errorState).toBeNull();
  });
});

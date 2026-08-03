/**
 * layerProbes.test.js — the guards that make a layer independently scoreable (WS-324).
 *
 * These pin behaviour that, if it broke silently, would produce plausible wrong numbers rather
 * than a failure — the family this repo keeps getting bitten by. In particular: a probe that
 * stopped refusing hypothesized input would not crash, it would quietly start averaging a
 * category error into a calibration number.
 *
 * Ranges are built from NAMED HANDS via the shared fixtures, never grid-index literals
 * (WS-300: index 0 is `22`, not `AA`).
 */

import { describe, test, expect } from 'vitest';

import {
  PROBE_REFUSALS, PROBEABLE_LAYERS, LAYER_PROBES,
  probeRange, probeEquity, probeFoldProbability, probeEv, probeAction,
  probeAtomLayer, probeLayerOverAtoms, probeAllLayers, hypothesizedRefusal, emissionFor,
} from '../layerProbes.js';
import { buildDecisionAtom, buildLayerEmission, buildAtomTruth } from '../decisionAtom.js';
import { parseAndEncode } from '../../pokerCore/cardParser';
import { parseRangeString } from '../../pokerCore/rangeMatrix';
import { tightRange } from '../../exploitEngine/__tests__/fixtures/ranges';

const cards = (...strs) => strs.map(parseAndEncode);
const BOARD = cards('A♠', '7♥', '2♦');
const IN_RANGE = cards('A♣', 'A♥');      // AA — inside the tight fixture
const OUT_OF_RANGE = cards('5♣', '4♥');  // 54o — outside it

test('fixture guard: every card in this file encodes to a real card', () => {
  for (const c of [...BOARD, ...IN_RANGE, ...OUT_OF_RANGE]) {
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThan(52);
  }
});

const atomWith = ({ layers = [], truth = null, outcome = null, carried = {} } = {}) => buildDecisionAtom({
  atomId: 'a1',
  situationKey: 'flop|btn|srp',
  carried: { board: BOARD, ...carried },
  surfaceId: 'sfc-test',
  action: { bet: 0.6, check: 0.4 },
  ruleId: null,
  warrant: null,
  layers,
  outcome,
  truth,
});

const rangeLayer = (extra = {}) => buildLayerEmission({
  layer: 'range', value: tightRange(), valueKind: 'full', ...extra,
});

describe('the layer/probe map', () => {
  test('action is not probeable — it has no ground truth, permanently', () => {
    expect(PROBEABLE_LAYERS).toEqual(['range', 'equity', 'foldProbability', 'ev']);
    expect(PROBEABLE_LAYERS).not.toContain('action');
  });

  test('every stack layer still has a probe, including the one that always refuses', () => {
    expect(Object.keys(LAYER_PROBES).sort())
      .toEqual(['action', 'equity', 'ev', 'foldProbability', 'range']);
  });

  test('probing action refuses with no-ground-truth, not with a missing probe', () => {
    const r = probeAction(atomWith());
    expect(r.refused).toBe(true);
    expect(r.reason).toBe(PROBE_REFUSALS.NO_GROUND_TRUTH);
  });
});

describe('the hypothesized refusal — inherited from holdingKnowledge, not re-derived', () => {
  test('refuses when the ATOM truth was recorded against a hypothesized branch', () => {
    const atom = atomWith({
      layers: [rangeLayer()],
      truth: buildAtomTruth({ revealed: IN_RANGE, basis: 'hypothesized' }),
    });
    const r = probeRange(atom);
    expect(r.refused).toBe(true);
    expect(r.reason).toBe(PROBE_REFUSALS.HYPOTHESIZED);
  });

  test('refuses when the LAYER provenance went through a hypothesized narrowing', () => {
    const atom = atomWith({
      layers: [rangeLayer({
        provenance: { narrowingCount: 2, observedNarrowings: 1, hypothesizedNarrowings: 1 },
      })],
      truth: buildAtomTruth({ revealed: IN_RANGE, basis: 'observed' }),
    });
    const r = probeRange(atom);
    expect(r.refused).toBe(true);
    expect(r.reason).toBe(PROBE_REFUSALS.HYPOTHESIZED);
  });

  test('a purely observed provenance is NOT refused', () => {
    const atom = atomWith({
      layers: [rangeLayer({
        provenance: { narrowingCount: 2, observedNarrowings: 2, hypothesizedNarrowings: 0 },
      })],
      truth: buildAtomTruth({ revealed: IN_RANGE, basis: 'observed' }),
    });
    expect(hypothesizedRefusal(atom, emissionFor(atom, 'range'))).toBe(false);
    expect(probeRange(atom).refused).toBe(false);
  });

  test('EVERY probeable layer refuses hypothesized input — criterion #6', () => {
    const truth = buildAtomTruth({ revealed: IN_RANGE, basis: 'hypothesized' });
    const atom = atomWith({
      truth,
      outcome: { showdownResult: 1, folded: false, realizedChips: 4 },
      layers: [
        rangeLayer(),
        buildLayerEmission({ layer: 'equity', value: 0.6, valueKind: 'full' }),
        buildLayerEmission({ layer: 'foldProbability', value: 0.4, valueKind: 'full' }),
        buildLayerEmission({ layer: 'ev', value: 1.2, valueKind: 'full' }),
      ],
    });
    for (const layer of PROBEABLE_LAYERS) {
      const r = probeAtomLayer(atom, layer);
      expect(r.refused, `${layer} scored a hypothesized branch`).toBe(true);
      expect(r.reason).toBe(PROBE_REFUSALS.HYPOTHESIZED);
    }
  });
});

describe('probeRange — delegates the join to holdingKnowledge, and reports logLift', () => {
  const observed = (hole) => atomWith({
    layers: [rangeLayer()],
    truth: buildAtomTruth({ revealed: hole, basis: 'observed' }),
  });

  test('a FLAT range scores exactly zero lift — narrowing alone earns nothing', () => {
    // Pinning a fact that is easy to get backwards. `logLift` is measured against a uniform
    // range over the RETAINED combos, not over all 1326. So a hard-edged range that keeps
    // every survivor at equal weight scores exactly 0 on any hand it contains, however tight
    // it is. Lift comes from WEIGHTING the true hand above its neighbours; it does not come
    // from eliminating other hands. `retainedFraction` is what records the narrowing, and it
    // is the fair baseline `rangeCalibrationProbe.mjs` insists on for exactly this reason.
    const r = probeRange(observed(IN_RANGE));
    expect(r.refused).toBe(false);
    expect(r.covered).toBe(true);
    expect(r.logLift).toBeCloseTo(0, 10);
    expect(r.retainedFraction).toBeLessThan(1);   // it DID narrow
    expect(r.signal).toBe(r.logLift);             // logLift IS the signal, not `covered`
  });

  test('a range that WEIGHTS the true hand above its neighbours scores positive lift', () => {
    const weighted = () => {
      const r = tightRange();
      const aa = parseRangeString('AA');
      for (let i = 0; i < r.length; i += 1) {
        if (r[i] > 0) r[i] = aa[i] > 0 ? 1.0 : 0.25;
      }
      return r;
    };
    const atom = atomWith({
      layers: [buildLayerEmission({ layer: 'range', value: weighted(), valueKind: 'full' })],
      truth: buildAtomTruth({ revealed: IN_RANGE, basis: 'observed' }),
    });
    const r = probeRange(atom);
    expect(r.refused).toBe(false);
    expect(r.logLift).toBeGreaterThan(0);
  });

  test('a hand outside a hard-edged range is a genuine coverage miss with negative lift', () => {
    const r = probeRange(observed(OUT_OF_RANGE));
    expect(r.refused).toBe(false);
    expect(r.covered).toBe(false);
    expect(r.logLift).toBeLessThan(0);
  });

  test('refuses NOT_REVEALED rather than scoring a zero when no showdown exists', () => {
    const r = probeRange(atomWith({ layers: [rangeLayer()] }));
    expect(r).toMatchObject({ refused: true, reason: PROBE_REFUSALS.NOT_REVEALED });
  });

  test('a card collision is UNSCOREABLE — a data problem, never averaged in as a zero', () => {
    const collide = atomWith({
      layers: [rangeLayer()],
      truth: buildAtomTruth({ revealed: [BOARD[0], IN_RANGE[1]], basis: 'observed' }),
    });
    expect(probeRange(collide)).toMatchObject({
      refused: true, reason: PROBE_REFUSALS.UNSCOREABLE,
    });
  });
});

describe('probeEquity — a chop is half a win, not a rounding decision', () => {
  const withEquity = (predicted, showdownResult) => atomWith({
    layers: [buildLayerEmission({ layer: 'equity', value: predicted, valueKind: 'full' })],
    outcome: { showdownResult },
  });

  test('scores squared error against a fractional realization', () => {
    const r = probeEquity(withEquity(0.7, 1));
    expect(r.refused).toBe(false);
    expect(r.error).toBeCloseTo(-0.3, 10);
    expect(r.brier).toBeCloseTo(0.09, 10);
  });

  test('a chop scores as 0.5, so a 50% equity call is exactly right', () => {
    const r = probeEquity(withEquity(0.5, 0.5));
    expect(r.error).toBeCloseTo(0, 10);
    expect(r.brier).toBeCloseTo(0, 10);
  });

  test('a realization outside [0,1] is unscoreable rather than clamped', () => {
    expect(probeEquity(withEquity(0.5, 1.4)))
      .toMatchObject({ refused: true, reason: PROBE_REFUSALS.UNSCOREABLE });
  });
});

describe('probeFoldProbability — log-loss punishes confident wrongness', () => {
  const withFold = (predicted, folded) => atomWith({
    layers: [buildLayerEmission({ layer: 'foldProbability', value: predicted, valueKind: 'full' })],
    outcome: { folded },
  });

  test('a confident correct call scores better than a hedged one', () => {
    const confident = probeFoldProbability(withFold(0.95, true));
    const hedged = probeFoldProbability(withFold(0.55, true));
    expect(confident.logLoss).toBeLessThan(hedged.logLoss);
    expect(confident.signal).toBeGreaterThan(hedged.signal);
  });

  test('a confident WRONG call is punished sharply', () => {
    const wrong = probeFoldProbability(withFold(0.95, false));
    const hedged = probeFoldProbability(withFold(0.55, false));
    expect(wrong.logLoss).toBeGreaterThan(hedged.logLoss);
  });

  test('a non-boolean realization is NOT_REVEALED, not a coerced false', () => {
    expect(probeFoldProbability(withFold(0.5, null)))
      .toMatchObject({ refused: true, reason: PROBE_REFUSALS.NOT_REVEALED });
  });

  test('a probability outside [0,1] is refused rather than clamped', () => {
    expect(probeFoldProbability(withFold(1.4, true)))
      .toMatchObject({ refused: true, reason: PROBE_REFUSALS.MISSING_VALUE });
  });
});

describe('probeEv — a bias test, not an accuracy test', () => {
  const withEv = (predicted, realizedChips) => atomWith({
    layers: [buildLayerEmission({ layer: 'ev', value: predicted, valueKind: 'full' })],
    outcome: { realizedChips },
  });

  test('signed error is preserved so the aggregate can detect bias', () => {
    expect(probeEv(withEv(2, 5)).error).toBeCloseTo(-3, 10);
    expect(probeEv(withEv(5, 2)).error).toBeCloseTo(3, 10);
  });

  test('over- and under-predictions cancel in the mean — that is the point of a bias test', () => {
    const agg = probeLayerOverAtoms({ layer: 'ev', atoms: [withEv(2, 5), withEv(8, 5)] });
    expect(agg.n).toBe(2);
    expect(agg.rows.reduce((s, r) => s + r.error, 0)).toBeCloseTo(0, 10);
  });
});

describe('aggregation — a skip is data', () => {
  test('refusals are counted BY REASON and never silently dropped', () => {
    const scoreable = atomWith({
      layers: [rangeLayer()],
      truth: buildAtomTruth({ revealed: IN_RANGE, basis: 'observed' }),
    });
    const noShowdown = atomWith({ layers: [rangeLayer()] });
    const counterfactual = atomWith({
      layers: [rangeLayer()],
      truth: buildAtomTruth({ revealed: IN_RANGE, basis: 'hypothesized' }),
    });

    const agg = probeLayerOverAtoms({
      layer: 'range', atoms: [scoreable, noShowdown, counterfactual],
    });

    expect(agg.n).toBe(1);
    expect(agg.refusedCount).toBe(2);
    expect(agg.refusals).toEqual({
      [PROBE_REFUSALS.NOT_REVEALED]: 1,
      [PROBE_REFUSALS.HYPOTHESIZED]: 1,
    });
    // n + refusedCount accounts for every atom offered — nothing vanishes.
    expect(agg.n + agg.refusedCount).toBe(3);
  });

  test('the ground truth source is reported, so a reader knows what it was scored against', () => {
    const agg = probeLayerOverAtoms({ layer: 'range', atoms: [] });
    expect(agg.groundTruth).toBe('revealedHolding');
  });

  test('probeAllLayers runs every probeable layer over THE SAME atoms', () => {
    const atom = atomWith({
      truth: buildAtomTruth({ revealed: IN_RANGE, basis: 'observed' }),
      outcome: { showdownResult: 1, folded: false, realizedChips: 3 },
      layers: [
        rangeLayer(),
        buildLayerEmission({ layer: 'equity', value: 0.62, valueKind: 'full' }),
        buildLayerEmission({ layer: 'foldProbability', value: 0.33, valueKind: 'full' }),
        buildLayerEmission({ layer: 'ev', value: 1.1, valueKind: 'full' }),
      ],
    });
    const all = probeAllLayers({ atoms: [atom] });
    expect(Object.keys(all)).toEqual([...PROBEABLE_LAYERS]);
    for (const layer of PROBEABLE_LAYERS) {
      expect(all[layer].n, `${layer} did not score the shared atom`).toBe(1);
    }
  });
});

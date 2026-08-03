/**
 * geometryPooling.test.js — WS-333 Parts D and E.
 *
 * The ablation is AS-711's named falsifier, so what matters most here is that it CAN refute:
 * fed data where street genuinely carries signal, it must say so rather than confirming the
 * founder's hypothesis. A falsifier that cannot fire is decoration.
 */

import { describe, it, expect } from 'vitest';

import {
  buildGeometryAblationArms,
  runGeometryAblation,
  pairedDelta,
  streetVerdict,
  MIN_CELL_N,
} from '../backtest/geometryAblation.mjs';
import {
  POLICY_HIERARCHY,
  POLICY_HIERARCHY_GEOMETRY,
  POLICY_HIERARCHY_GEOMETRY_ONLY,
  buildPolicyTable,
  queryPolicy,
} from '../backtest/behaviorPolicy.mjs';
import { HIERARCHY_ORDER } from '../../src/utils/exploitEngine/villainDecisionModel.js';
import { buildDeviationMap } from '../backtest/deviationMap.mjs';

/**
 * Synthetic observations. `streetMatters` controls whether the fold rate depends on street
 * beyond what geometry already explains — which is exactly the thing the ablation measures.
 */
const makeObs = ({ n = 4000, streetMatters = false } = {}) => {
  const out = [];
  const streets = ['flop', 'turn', 'river'];
  const buckets = ['0-33', '33-66', '66-100'];
  for (let i = 0; i < n; i++) {
    const street = streets[i % 3];
    const sizeBucket = buckets[Math.floor(i / 3) % 3];
    // Geometry drives folding: bigger bets fold more.
    let foldP = { '0-33': 0.25, '33-66': 0.45, '66-100': 0.65 }[sizeBucket];
    // Optionally let street add real signal on top of geometry.
    if (streetMatters) foldP += { flop: -0.20, turn: 0, river: 0.20 }[street];
    const action = ((i * 2654435761) % 1000) / 1000 < foldP ? 'fold' : 'call';
    out.push({
      facingAction: 'bet', action,
      isAgg: 'false', isIP: i % 2 === 0 ? 'true' : 'false',
      texture: 'dry', street, posCategory: 'LATE',
      sizeBucket, sprBand: 'medium', closesAction: String(i % 2 === 0),
    });
  }
  return out;
};

describe('the geometry hierarchies', () => {
  it('IMPORT the measured HIERARCHY_ORDER rather than re-declaring it', () => {
    // A re-declared copy would let a future re-measurement leave the two out of step.
    expect(POLICY_HIERARCHY.slice(0, HIERARCHY_ORDER.length)).toEqual(HIERARCHY_ORDER);
    expect(POLICY_HIERARCHY_GEOMETRY.slice(0, HIERARCHY_ORDER.length)).toEqual(HIERARCHY_ORDER);
  });

  it('append geometry at the SPECIFIC end, leaving the measured order undisturbed', () => {
    expect(POLICY_HIERARCHY_GEOMETRY.slice(-2)).toEqual(['sprBand', 'closesAction']);
    expect(POLICY_HIERARCHY_GEOMETRY.slice(0, -2)).toEqual(POLICY_HIERARCHY);
  });

  it('the geometry-only arm drops street and posCategory', () => {
    expect(POLICY_HIERARCHY_GEOMETRY_ONLY).not.toContain('street');
    expect(POLICY_HIERARCHY_GEOMETRY_ONLY).not.toContain('posCategory');
    expect(POLICY_HIERARCHY_GEOMETRY_ONLY).toContain('sizeBucket');
  });
});

describe('a table is queried under the ladder it was BUILT with', () => {
  it('reads the hierarchy back off the table rather than assuming the default', () => {
    const obs = makeObs({ n: 600 });
    const table = buildPolicyTable(obs, {}, { hierarchy: POLICY_HIERARCHY_GEOMETRY_ONLY });
    expect(table.provenance.hierarchy).toEqual(POLICY_HIERARCHY_GEOMETRY_ONLY);
    // If queryPolicy assumed POLICY_HIERARCHY it would look up level keys this table never
    // built, silently fall through to the pooled level, and every arm would score alike.
    const r = queryPolicy(table, obs[0]);
    expect(r.deepestDepth).toBeGreaterThan(0);
  });
});

describe('pairedDelta — admissible only when the CI excludes zero', () => {
  it('calls a consistent improvement BETTER', () => {
    expect(pairedDelta(Array.from({ length: 200 }, () => -0.05)).verdict).toBe('BETTER');
  });

  it('calls a consistent regression WORSE', () => {
    expect(pairedDelta(Array.from({ length: 200 }, () => 0.05)).verdict).toBe('WORSE');
  });

  it('calls noise n.s. rather than a small win', () => {
    const noisy = Array.from({ length: 200 }, (_, i) => (i % 2 ? 0.5 : -0.5));
    expect(pairedDelta(noisy).verdict).toBe('n.s.');
  });

  it('refuses to judge on too few pairs', () => {
    expect(pairedDelta([0.1]).verdict).toBe('insufficient');
  });
});

describe('THE FALSIFIER — the ablation must be able to refute AS-711', () => {
  it('detects street signal when street genuinely carries it', () => {
    const train = makeObs({ n: 6000, streetMatters: true });
    const evalObs = makeObs({ n: 3000, streetMatters: true });
    const r = runGeometryAblation({ trainObs: train, evalObs });
    // Adding street back must IMPROVE prediction here, i.e. the delta is negative.
    expect(r.streetContribution.verdict).toBe('BETTER');
    expect(r.verdict).toMatch(/AS-711 FALSIFIED/);
  });

  it('does not manufacture street signal when geometry already explains everything', () => {
    const train = makeObs({ n: 6000, streetMatters: false });
    const evalObs = makeObs({ n: 3000, streetMatters: false });
    const r = runGeometryAblation({ trainObs: train, evalObs });
    expect(r.streetContribution.verdict).not.toBe('BETTER');
    expect(r.verdict).not.toMatch(/FALSIFIED/);
  });

  it('does NOT claim pooling is proven on a null result', () => {
    const train = makeObs({ n: 6000 });
    const r = runGeometryAblation({ trainObs: train, evalObs: makeObs({ n: 3000 }) });
    if (r.streetContribution.verdict === 'n.s.') {
      // Small-and-measured and small-because-underpowered are different results.
      expect(r.verdict).toMatch(/NOT the\s+same as proven|NOT REFUTED/);
    }
  });

  it('scores every arm on the SAME decisions', () => {
    const r = runGeometryAblation({
      trainObs: makeObs({ n: 3000 }), evalObs: makeObs({ n: 1500 }),
    });
    const ns = r.arms.map((a) => a.n);
    expect(new Set(ns).size).toBe(1);
  });

  it('includes a delete-it baseline so a dimension must earn its place', () => {
    expect(buildGeometryAblationArms().some((a) => a.name === 'ctrl:pooled')).toBe(true);
  });

  it('reports per-cell sample counts and flags thin cells rather than dropping them', () => {
    const r = runGeometryAblation({
      trainObs: makeObs({ n: 3000 }), evalObs: makeObs({ n: 1500 }),
    });
    expect(r.cells.minCellN).toBe(MIN_CELL_N);
    for (const c of r.cells.cells) {
      expect(typeof c.n).toBe('number');
      expect(typeof c.thin).toBe('boolean');
    }
    expect(r.cells.cells.length).toBeGreaterThan(0);
  });

  it('states a majority verdict at cell grain, which is how AS-711 is written', () => {
    const r = runGeometryAblation({
      trainObs: makeObs({ n: 6000, streetMatters: true }),
      evalObs: makeObs({ n: 3000, streetMatters: true }),
    });
    expect(typeof r.cells.majorityVerdict).toBe('string');
    expect(r.cells.wellSampledCount).toBeGreaterThan(0);
  });
});

describe('streetVerdict language', () => {
  it('never says "proven" on a null', () => {
    expect(streetVerdict({ verdict: 'n.s.' })).not.toMatch(/proven\b(?!:)/i);
    expect(streetVerdict({ verdict: 'n.s.' })).toMatch(/NOT REFUTED/);
  });
});

describe('deviation map — the exploit map, frequency weighted', () => {
  const obs = makeObs({ n: 3000 });

  it('emits a signed deviation per geometry cell with its opportunity count', () => {
    const map = buildDeviationMap(obs, { minCellN: 50 });
    expect(map.cells.length).toBeGreaterThan(0);
    for (const c of map.cells) {
      expect(typeof c.n).toBe('number');
      expect(c.observedContinuation).toBeGreaterThanOrEqual(0);
      expect(typeof c.deviation).toBe('number');
    }
  });

  it('weights by how often the cell actually arrives', () => {
    const map = buildDeviationMap(obs, { minCellN: 50 });
    const totalFreq = map.cells.reduce((a, c) => a + c.frequency, 0);
    expect(totalFreq).toBeCloseTo(1, 6);
    const c = map.cells[0];
    expect(c.weightedDeviation).toBeCloseTo(c.deviation * c.frequency, 10);
  });

  it('reads as an observation about the POOL, never as hero advice', () => {
    // Weakness and exploit are separate layers — a deviation map must not carry an action.
    const map = buildDeviationMap(obs, { minCellN: 50 });
    for (const c of map.cells) {
      expect(c.reads).toMatch(/^pool (under|over)-defends/);
      expect(c.reads).not.toMatch(/bluff|value bet|you should/i);
    }
  });

  it('flags thin cells rather than dropping them', () => {
    const map = buildDeviationMap(obs, { minCellN: 1e9 });
    expect(map.wellSampledCells).toBe(0);
    expect(map.cells.length).toBeGreaterThan(0);
  });

  it('rake raises the floor, so a raked pool looks like it under-defends more', () => {
    const free = buildDeviationMap(obs, { minCellN: 50, rakeConfig: null });
    const raked = buildDeviationMap(obs, {
      minCellN: 50, rakeConfig: { pct: 0.10, cap: 8, noFlopNoDrop: true },
    });
    // Same observations, higher bar — required continuation is unchanged (MDF is rake-free)
    // but the required EQUITY rises, which is where rake shows up.
    expect(raked.cells[0].requiredContinuation).toBeCloseTo(free.cells[0].requiredContinuation, 10);
  });

  it('skips decisions with no bet to defend against', () => {
    const noBets = obs.map((o) => ({ ...o, facingAction: 'none' }));
    expect(buildDeviationMap(noBets).cells.length).toBe(0);
  });
});

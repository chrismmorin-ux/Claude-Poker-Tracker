/**
 * layerAttribution.test.js — the identity, the localization, and the WS-291 reproduction.
 *
 * The assertions here are the accept criteria of WS-324, not coverage. In particular:
 *
 *   #4  the by-layer and by-situation decompositions sum to the SAME total — asserted, never
 *       inspected, because a decomposition that silently stops summing still returns numbers.
 *   #7  a worked example where the fault is at layer 1 and the symptom at layer 5, and
 *       attribution names layer 1. An attribution that blamed `action` would have failed in
 *       exactly the way that let WS-291 hide for the life of the project.
 */

import { describe, test, expect } from 'vitest';

import {
  localizeByLayer,
  decomposeByLayerTelescoping,
  decomposeByLayerShapley,
  decomposeBySituation,
  decompositionsAgree,
  attributionGap,
  firstMeasuredDivergence,
  pairedMeanCI,
  pairAtoms,
  exactPairsOnly,
} from '../layerAttribution.js';
import {
  ATOMS_BEFORE, ATOMS_AFTER, ATOMS_TWO_FAULT,
  layerFns, layerFnsTwoFault, testD, testDLayer,
} from '../__fixtures__/ws291AtomSet.js';

const shapley = (a, b, fns = layerFns) => decomposeByLayerShapley({
  atomsA: a, atomsB: b, d: testD, layerFns: fns,
});
const telescoping = (a, b, fns = layerFns) => decomposeByLayerTelescoping({
  atomsA: a, atomsB: b, d: testD, layerFns: fns,
});
const situation = (a, b) => decomposeBySituation({ atomsA: a, atomsB: b, d: testD });

const sumShares = (dec) => Object.values(dec.shares).reduce((s, v) => s + (v.share ?? v.mean ?? 0), 0);

describe('`d` is required — no default, ever', () => {
  test('every decomposition throws without a divergence measure', () => {
    for (const fn of [decomposeByLayerShapley, decomposeByLayerTelescoping, decomposeBySituation]) {
      expect(() => fn({ atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER, layerFns }))
        .toThrow(/`d` \(the divergence measure\) is required/);
    }
  });

  test('the error explains WHY, so the next reader does not just add a default', () => {
    expect(() => decomposeBySituation({ atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER }))
      .toThrow(/ADR-009 permits exactly one comparison path/);
  });
});

describe('the evaluating instruments refuse to guess their layer functions', () => {
  test('both throw without pinned layerFns, and point at the evaluation-free alternative', () => {
    for (const fn of [decomposeByLayerShapley, decomposeByLayerTelescoping]) {
      expect(() => fn({ atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER, d: testD }))
        .toThrow(/localizeByLayer/);
    }
  });

  test('the message names the pinning requirement rather than just the missing argument', () => {
    expect(() => decomposeByLayerShapley({
      atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER, d: testD,
    })).toThrow(/never bind the live engine/);
  });
});

describe('CRITERION #4 — the two decompositions sum to the same total', () => {
  test('Shapley shares sum exactly to the total divergence', () => {
    const byLayer = shapley(ATOMS_BEFORE, ATOMS_AFTER);
    expect(sumShares(byLayer)).toBeCloseTo(byLayer.total, 12);
  });

  test('situation shares sum exactly to the same total', () => {
    const byLayer = shapley(ATOMS_BEFORE, ATOMS_AFTER);
    const bySituation = situation(ATOMS_BEFORE, ATOMS_AFTER);
    expect(bySituation.total).toBeCloseTo(byLayer.total, 12);
    expect(sumShares(bySituation)).toBeCloseTo(bySituation.total, 12);
  });

  test('decompositionsAgree confirms the identity for Shapley', () => {
    const agreement = decompositionsAgree(
      shapley(ATOMS_BEFORE, ATOMS_AFTER),
      situation(ATOMS_BEFORE, ATOMS_AFTER),
    );
    expect(agreement.agree).toBe(true);
    expect(agreement.layerSum).toBeCloseTo(agreement.situationSum, 12);
  });

  test('and for telescoping — both evaluating instruments satisfy the identity', () => {
    const agreement = decompositionsAgree(
      telescoping(ATOMS_BEFORE, ATOMS_AFTER),
      situation(ATOMS_BEFORE, ATOMS_AFTER),
    );
    expect(agreement.agree).toBe(true);
  });

  test('the identity holds when TWO layers carry blame, not only the degenerate one-fault case', () => {
    const byLayer = shapley(ATOMS_TWO_FAULT, ATOMS_AFTER, layerFnsTwoFault);
    const bySituation = situation(ATOMS_TWO_FAULT, ATOMS_AFTER);
    expect(decompositionsAgree(byLayer, bySituation).agree).toBe(true);
    // Genuinely non-degenerate: at least two layers carry a non-trivial share.
    const nonTrivial = Object.values(byLayer.shares).filter((s) => Math.abs(s.mean) > 1e-9);
    expect(nonTrivial.length).toBeGreaterThanOrEqual(2);
  });

  test('the divergence being decomposed is actually non-zero — the identity is not vacuous', () => {
    expect(shapley(ATOMS_BEFORE, ATOMS_AFTER).total).toBeGreaterThan(0.01);
  });
});

describe('CRITERION #7 — the WS-291 reproduction', () => {
  test('attribution names the RANGE layer, not the recommendation the fault corrupted', () => {
    const byLayer = shapley(ATOMS_BEFORE, ATOMS_AFTER);
    expect(firstMeasuredDivergence(byLayer)).toBe('range');
  });

  test('the range layer takes essentially the whole share', () => {
    const byLayer = shapley(ATOMS_BEFORE, ATOMS_AFTER);
    expect(byLayer.shares.range.mean).toBeCloseTo(byLayer.total, 12);
  });

  test('the ACTION layer takes none of it, though that is where the fault is VISIBLE', () => {
    // This is the whole point. The symptom is at layer 5; the fault is at layer 1. An
    // attribution that credited `action` would be reporting the symptom as the cause, which
    // is precisely the failure that let WS-291 survive unmeasured.
    const byLayer = shapley(ATOMS_BEFORE, ATOMS_AFTER);
    expect(Math.abs(byLayer.shares.action.mean)).toBeLessThan(1e-9);
    for (const layer of ['equity', 'foldProbability', 'ev', 'action']) {
      expect(Math.abs(byLayer.shares[layer].mean), `${layer} was blamed for a range fault`)
        .toBeLessThan(1e-9);
    }
  });

  test('the range share is admissible — its paired CI excludes zero', () => {
    expect(shapley(ATOMS_BEFORE, ATOMS_AFTER).shares.range.admissible).toBe(true);
  });

  test('telescoping reaches the same verdict on this fixture', () => {
    expect(firstMeasuredDivergence(telescoping(ATOMS_BEFORE, ATOMS_AFTER))).toBe('range');
  });
});

describe('localizeByLayer — evaluation-free, and honest that it does not decompose', () => {
  const loc = () => localizeByLayer({
    atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER, dLayer: testDLayer,
  });

  test('runs with NO layerFns at all — nothing is evaluated', () => {
    expect(() => loc()).not.toThrow();
    expect(loc().evaluationFree).toBe(true);
  });

  test('declares in the payload that it does NOT sum to the total', () => {
    // Encoded as data rather than documented in prose, so a caller cannot read the shares as
    // if they were a decomposition. A localization says WHERE, not HOW MUCH OF.
    expect(loc().sumsToTotal).toBe(false);
  });

  test('finds the range layer as the first separation point', () => {
    expect(loc().firstDivergentLayer).toBe('range');
  });

  test('reports a divergence at every layer — the fault DOES propagate, it just is not the cause', () => {
    const layers = loc().layers;
    for (const l of ['range', 'equity', 'foldProbability', 'ev']) {
      expect(layers[l].mean, `${l} should differ downstream of a range fault`).toBeGreaterThan(0);
    }
  });
});

describe('the gap between the two evaluating instruments', () => {
  test('on a one-fault fixture they agree exactly — there is no interaction to absorb', () => {
    const gap = attributionGap(
      telescoping(ATOMS_BEFORE, ATOMS_AFTER),
      shapley(ATOMS_BEFORE, ATOMS_AFTER),
    );
    expect(gap.totalsMatch).toBe(true);
    for (const l of Object.keys(gap.perLayer)) {
      expect(Math.abs(gap.perLayer[l].gap), `${l} disagreed on a no-interaction fixture`)
        .toBeLessThan(1e-9);
    }
  });

  test('both instruments still reach the same TOTAL on the two-fault fixture', () => {
    const gap = attributionGap(
      telescoping(ATOMS_TWO_FAULT, ATOMS_AFTER, layerFnsTwoFault),
      shapley(ATOMS_TWO_FAULT, ATOMS_AFTER, layerFnsTwoFault),
    );
    // The gaps redistribute blame between layers; they must cancel in the total, or one of
    // the two decompositions has stopped summing.
    expect(gap.totalsMatch).toBe(true);
    const gapSum = Object.values(gap.perLayer).reduce((s, g) => s + g.gap, 0);
    expect(gapSum).toBeCloseTo(0, 12);
  });
});

describe('pairing and exactness — what gets counted, and what gets refused', () => {
  test('unpaired decisions are counted on both sides, never silently dropped', () => {
    const { pairs, unpairedA, unpairedB } = pairAtoms(
      ATOMS_BEFORE.slice(0, 4), ATOMS_AFTER.slice(2),
    );
    expect(pairs.length).toBe(2);
    expect(unpairedA).toBe(2);
    expect(unpairedB).toBe(2);
  });

  test('only FULL intermediates are exactly substitutable; compressed rows are dropped and counted', () => {
    const compressed = ATOMS_BEFORE.map((a, i) => (i === 0 ? {
      ...a,
      layers: a.layers.map((l) => (l.layer === 'range' ? { ...l, valueKind: 'compressed' } : l)),
    } : a));
    const { pairs } = pairAtoms(compressed, ATOMS_AFTER);
    const { exact, dropped } = exactPairsOnly(pairs, ['range', 'equity']);
    expect(dropped).toBe(1);
    expect(exact.length).toBe(ATOMS_BEFORE.length - 1);
  });

  test('the decomposition reports how many rows it dropped for being non-exact', () => {
    const compressed = ATOMS_BEFORE.map((a, i) => (i === 0 ? {
      ...a,
      layers: a.layers.map((l) => (l.layer === 'ev' ? { ...l, valueKind: 'compressed' } : l)),
    } : a));
    const byLayer = shapley(compressed, ATOMS_AFTER);
    expect(byLayer.droppedNonExact).toBe(1);
    expect(byLayer.n).toBe(ATOMS_BEFORE.length - 1);
  });
});

describe('paired admissibility', () => {
  test('a single observation is never admissible', () => {
    expect(pairedMeanCI([0.5])).toMatchObject({ n: 1, ci: null, admissible: false });
  });

  test('a consistent non-zero difference is admissible', () => {
    expect(pairedMeanCI([0.5, 0.52, 0.49, 0.51, 0.5]).admissible).toBe(true);
  });

  test('a difference whose CI straddles zero is n.s., not a small win', () => {
    expect(pairedMeanCI([-1, 1, -1, 1, -0.5, 0.5]).admissible).toBe(false);
  });
});

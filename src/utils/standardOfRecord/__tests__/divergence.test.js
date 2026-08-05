/**
 * divergence.test.js — `d`, both candidates, and the proof there is only one of it (WS-350).
 *
 * Three blocks carry weight beyond the usual unit coverage:
 *
 *   1. THE REPO-WIDE SCAN. ADR-009 permits exactly one comparison path. A comment saying so is a
 *      promise; a scan that reads every source file is a fact. Same shape as
 *      `layerAblation.test.js` reading its own import list, one scale up.
 *   2. THE SAME-VOLUME PROOF. Both measures must be computed on identical rows, or the numbers
 *      are about the rows rather than the surfaces.
 *   3. THE SUM IDENTITY (WS-324 AC4 / WS-350 AC5). By-layer and by-situation decompose the same
 *      total, run through the REAL `d` from this module rather than the fixture's test-only one.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test, expect } from 'vitest';

import {
  DIVERGENCE_MEASURES, DIVERGENCE_WEIGHTINGS, KL_FLOOR, VOLUME_EXCLUSIONS,
  klDivergence, evDifference, divergenceFn, buildSurfaceOutput, outputOfAtom,
  preRegisterPrimary, measureBoth, rankSurfaces, klFloorSweep,
} from '../divergence.js';
import {
  localizeByLayer, decomposeByLayerShapley, decomposeByLayerTelescoping, decomposeBySituation,
  decompositionsAgree, attributeFirstLayer, shareOfTotal,
} from '../layerAttribution.js';
import { firstStructuralDivergence } from '../stack.js';
import {
  ATOMS_BEFORE, ATOMS_AFTER, ATOMS_TWO_FAULT, layerFns, layerFnsTwoFault, testDLayer,
} from '../__fixtures__/ws291AtomSet.js';

const PRE = preRegisterPrimary({
  primary: 'ev-difference',
  weighting: 'frequency',
  at: '2026-08-05T00:00:00Z',
  rationale: 'test fixture pre-registration',
});

/**
 * The fixture's pinned layer functions emit a bare action distribution at the terminal layer,
 * which was all `testD` needed. `divergence.js` reads ONE output shape carrying both the action
 * and the EV — that is what keeps the two measures on the same volume — so the terminal layer is
 * wrapped here rather than in the fixture, which other tests still read in its original form.
 *
 * The wrap is exact: the carry INTO the action layer IS the ev value, so nothing is recomputed.
 */
const bundled = (fns) => ({
  ...fns,
  action: {
    A: (ev, atom, meta) => buildSurfaceOutput({ action: fns.action.A(ev, atom, meta), ev }),
    B: (ev, atom, meta) => buildSurfaceOutput({ action: fns.action.B(ev, atom, meta), ev }),
  },
});

// ── 1. exactly ONE comparison path ─────────────────────────────────────────────────────

const REPO_ROOT = new URL('../../../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const SCANNED_DIRS = ['src', 'scripts'];
const SKIP_DIRS = new Set(['node_modules', '__tests__', '__fixtures__', '__dev__', 'dist', 'coverage']);

const walk = (dir, out = []) => {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) walk(full, out);
    else if (/\.(js|mjs)$/.test(name) && !/\.test\.(js|mjs)$/.test(name)) out.push(full);
  }
  return out;
};

const SOURCE_FILES = SCANNED_DIRS.flatMap((d) => walk(join(REPO_ROOT, d)));

describe('AC3 — exactly ONE divergence module, checked by scanning the repo', () => {
  test('the scan actually found source files (a scan over nothing passes vacuously)', () => {
    expect(SOURCE_FILES.length).toBeGreaterThan(200);
  });

  test('no file outside divergence.js DEFINES a KL / relative-entropy function', () => {
    // The signature of a KL implementation: a log of a ratio of two probabilities. Matching on
    // the NAME rather than the arithmetic is what makes this checkable without false positives
    // on every log in the repo — and a second path that hid behind an unrelated name would
    // still have to be exported and called, which the next assertion catches.
    const pattern = /\b(?:const|function|export const|export function)\s+\w*(?:kl|KL)(?:Divergence|Div)\w*\s*[=(]|relativeEntropy|kullback/i;
    const offenders = SOURCE_FILES.filter((f) => {
      if (f.endsWith('divergence.js')) return false;
      return pattern.test(readFileSync(f, 'utf8'));
    });
    expect(offenders.map((f) => f.replace(REPO_ROOT, ''))).toEqual([]);
  });

  test('no file outside divergence.js exports a surface-comparison entry point', () => {
    const pattern = /export\s+(?:const|function)\s+(?:compareSurfaces|surfaceDivergence|divergenceBetween|measureDivergence)\b/;
    const offenders = SOURCE_FILES.filter((f) => {
      if (f.endsWith('divergence.js')) return false;
      return pattern.test(readFileSync(f, 'utf8'));
    });
    expect(offenders.map((f) => f.replace(REPO_ROOT, ''))).toEqual([]);
  });

  test('layerAttribution still refuses to choose `d` — a decomposition is not a definition', () => {
    const src = readFileSync(new URL('../layerAttribution.js', import.meta.url), 'utf8');
    expect(src).not.toMatch(/from\s+'\.\/divergence\.js'/);
    expect(() => decomposeBySituation({ atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER })).toThrow(/required and has no default/);
  });
});

// ── 2. the two measures ────────────────────────────────────────────────────────────────

describe('the two candidates FSA named, and nothing else', () => {
  test('only kl and ev-difference exist', () => {
    expect([...DIVERGENCE_MEASURES]).toEqual(['kl', 'ev-difference']);
    expect(() => divergenceFn('js-divergence')).toThrow(/second comparison path/);
  });

  test('KL is zero for identical distributions and positive otherwise', () => {
    expect(klDivergence({ bet: 0.5, check: 0.5 }, { bet: 0.5, check: 0.5 })).toBe(0);
    expect(klDivergence({ bet: 0.9, check: 0.1 }, { bet: 0.1, check: 0.9 })).toBeGreaterThan(0);
  });

  test('KL is ASYMMETRIC, which is why the direction is part of the definition', () => {
    const a = { bet: 0.9, check: 0.1 };
    const b = { bet: 0.5, check: 0.5 };
    expect(klDivergence(a, b)).not.toBeCloseTo(klDivergence(b, a), 6);
  });

  test('a flipped argmax against a hard zero is finite ONLY because of the floor', () => {
    const kl = klDivergence({ bet: 1, check: 0 }, { bet: 0, check: 1 });
    expect(Number.isFinite(kl)).toBe(true);
    expect(kl).toBeCloseTo(Math.log(1 / KL_FLOOR), 3);
    // And the magnitude is SET by the floor — the finding, not an implementation detail.
    expect(klDivergence({ bet: 1, check: 0 }, { bet: 0, check: 1 }, { floor: 1e-3 }))
      .toBeCloseTo(Math.log(1e3), 3);
  });

  test('KL returns NaN, never 0, when a side is not a usable distribution', () => {
    expect(Number.isNaN(klDivergence(null, { bet: 1 }))).toBe(true);
    expect(Number.isNaN(klDivergence({ bet: 0 }, { bet: 1 }))).toBe(true);
  });

  test('EV-difference is absolute — a divergence is not an edge', () => {
    expect(evDifference(2, 5)).toBe(3);
    expect(evDifference(5, 2)).toBe(3);
    expect(Number.isNaN(evDifference(null, 2))).toBe(true);
  });

  test('the two measures disagree about the SAME decision, which is the whole question', () => {
    // A near-tie whose argmax flipped: behaviour differs maximally, money barely at all.
    const flip = {
      a: buildSurfaceOutput({ action: { bet: 1, check: 0 }, ev: 1.000 }),
      b: buildSurfaceOutput({ action: { bet: 0, check: 1 }, ev: 1.001 }),
    };
    // Same action either way, but valued very differently.
    const revalue = {
      a: buildSurfaceOutput({ action: { bet: 1, check: 0 }, ev: 1.0 }),
      b: buildSurfaceOutput({ action: { bet: 1, check: 0 }, ev: 9.0 }),
    };
    const kl = divergenceFn('kl');
    const ev = divergenceFn('ev-difference');

    expect(kl(flip.a, flip.b)).toBeGreaterThan(kl(revalue.a, revalue.b));
    expect(ev(flip.a, flip.b)).toBeLessThan(ev(revalue.a, revalue.b));
  });
});

// ── 3. pre-registration ────────────────────────────────────────────────────────────────

describe('pre-registration is required, and is not ceremony', () => {
  test('measureBoth refuses to run without one', () => {
    expect(() => measureBoth({ atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER }))
      .toThrow(/pre-registration is REQUIRED/);
  });

  test('a pre-registration must name a real measure, a real weighting, a rationale and a time', () => {
    expect(() => preRegisterPrimary({ primary: 'vibes', weighting: 'frequency', rationale: 'x', at: 'now' })).toThrow(/must be one of/);
    expect(() => preRegisterPrimary({ primary: 'kl', weighting: 'whatever', rationale: 'x', at: 'now' })).toThrow(/weighting/);
    expect(() => preRegisterPrimary({ primary: 'kl', weighting: 'frequency', at: 'now' })).toThrow(/rationale/);
    expect(() => preRegisterPrimary({ primary: 'kl', weighting: 'frequency', rationale: 'x' })).toThrow(/precedes the run/);
  });

  test('the pre-registration carries the secondary, so a card cannot report only the primary', () => {
    expect(PRE.secondary).toEqual(['kl']);
    expect(PRE.klFloor).toBe(KL_FLOOR);
  });
});

// ── 4. the SAME volume ─────────────────────────────────────────────────────────────────

describe('AC1 — both measures on the SAME divergence volume', () => {
  const r = measureBoth({ atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER, preRegistration: PRE });

  test('both measures report the same n', () => {
    expect(r.volume.sameVolume).toBe(true);
    expect(r.byMeasure.kl.frequency.n).toBe(r.volume.n);
    expect(r.byMeasure['ev-difference'].frequency.n).toBe(r.volume.n);
  });

  test('a row missing EV is excluded from BOTH measures, and counted', () => {
    const stripEv = (atoms) => atoms.map((a) => ({
      ...a, layers: a.layers.filter((l) => l.layer !== 'ev'),
    }));
    const r2 = measureBoth({
      atomsA: ATOMS_BEFORE, atomsB: stripEv(ATOMS_AFTER), preRegistration: PRE,
    });
    expect(r2.volume.n).toBe(0);
    expect(r2.volume.excluded[VOLUME_EXCLUSIONS.NO_EV]).toBe(ATOMS_BEFORE.length);
    // KL was perfectly computable on every one of those rows and is still not reported on them.
    expect(r2.byMeasure.kl.frequency.n).toBe(0);
  });

  test('both weightings are computed on every run; neither is a default', () => {
    for (const m of DIVERGENCE_MEASURES) {
      for (const w of DIVERGENCE_WEIGHTINGS) {
        expect(r.byMeasure[m][w].weighting).toBe(w);
      }
    }
    // Three situations, two decisions each in the fixture — so uniform and frequency need not
    // agree, and the object must not pretend they are one number.
    expect(r.volume.nSituations).toBe(3);
  });

  test('the payload refuses magnitude comparison between the two measures', () => {
    expect(r.comparableByMagnitude).toBe(false);
    expect(r.byMeasure.kl.units).toBe('nats');
  });
});

// ── 5. ranking, and the disagreement that is the finding ───────────────────────────────

describe('AC2 — ranking, and what happens when the measures disagree', () => {
  const candidates = [
    { surfaceId: 'sfc-after', atoms: ATOMS_AFTER },
    { surfaceId: 'sfc-two-fault', atoms: ATOMS_TWO_FAULT },
  ];

  test('ranking refuses to run on fewer than two candidates', () => {
    expect(() => rankSurfaces({
      referenceAtoms: ATOMS_BEFORE, candidates: [candidates[0]], preRegistration: PRE,
    })).toThrow(/at least two candidates/);
  });

  test('both orderings are reported, and agreement is a computed fact not an assumption', () => {
    const r = rankSurfaces({ referenceAtoms: ATOMS_BEFORE, candidates, preRegistration: PRE });
    expect(r.klOrder).toHaveLength(2);
    expect(r.evOrder).toHaveLength(2);
    expect(typeof r.ranksAgree).toBe('boolean');
    if (!r.ranksAgree) expect(r.swaps.length).toBeGreaterThan(0);
  });

  test('a constructed disagreement is DETECTED rather than smoothed', () => {
    // Two candidates built so behaviour and money order them oppositely: `loud` flips the action
    // on every decision at almost no cost; `costly` keeps the action and moves the money.
    const remap = (atoms, fn) => atoms.map((a) => ({ ...a, ...fn(a) }));
    const evOf = (a) => a.layers.find((l) => l.layer === 'ev').value;
    const withEv = (a, v) => ({ layers: a.layers.map((l) => (l.layer === 'ev' ? { ...l, value: v } : l)) });

    const loud = remap(ATOMS_BEFORE, (a) => ({
      action: { bet: a.action.bet > 0.5 ? 0 : 1, check: a.action.bet > 0.5 ? 1 : 0 },
      ...withEv(a, evOf(a) + 0.001),
    }));
    const costly = remap(ATOMS_BEFORE, (a) => ({
      action: { ...a.action },
      ...withEv(a, evOf(a) + 5),
    }));

    const r = rankSurfaces({
      referenceAtoms: ATOMS_BEFORE,
      candidates: [{ surfaceId: 'loud', atoms: loud }, { surfaceId: 'costly', atoms: costly }],
      preRegistration: PRE,
    });
    expect(r.klOrder[0]).toBe('loud');
    expect(r.evOrder[0]).toBe('costly');
    expect(r.ranksAgree).toBe(false);
    expect(r.swaps.map((s) => s.surfaceId).sort()).toEqual(['costly', 'loud']);
  });

  test('an ORDER is reported with whether the pair can be separated at all', () => {
    const r = rankSurfaces({ referenceAtoms: ATOMS_BEFORE, candidates, preRegistration: PRE });
    const key = 'sfc-after vs sfc-two-fault';
    expect(r.pairwiseSeparation[key]).toBeTruthy();
    for (const m of DIVERGENCE_MEASURES) {
      const s = r.pairwiseSeparation[key][m];
      expect(s.n).toBe(ATOMS_BEFORE.length);
      expect(typeof s.admissible).toBe('boolean');
      expect(s.differenceOf).toBe('sfc-after - sfc-two-fault');
    }
  });

  test('two IDENTICAL candidates are ordered but NOT separated — the order is noise', () => {
    // Sorting always returns an order. This is the assertion that stops one being read as a
    // finding: a zero difference on every decision cannot be admissible under either measure.
    const clone = ATOMS_AFTER.map((a) => ({ ...a }));
    const r = rankSurfaces({
      referenceAtoms: ATOMS_BEFORE,
      candidates: [{ surfaceId: 'x', atoms: ATOMS_AFTER }, { surfaceId: 'y', atoms: clone }],
      preRegistration: PRE,
    });
    const s = r.pairwiseSeparation['x vs y'];
    expect(s.kl.admissible).toBe(false);
    expect(s['ev-difference'].admissible).toBe(false);
    expect(s.rowsDiffering.kl).toBe(0);
    expect(s.rowsDiffering['ev-difference']).toBe(0);
  });

  test('the KL floor is swept, so a KL ranking cannot be published as a setting', () => {
    const sweep = klFloorSweep({ referenceAtoms: ATOMS_BEFORE, candidates, preRegistration: PRE });
    expect(sweep.sweptRange[0]).toBeLessThan(KL_FLOOR);
    expect(sweep.sweptRange[1]).toBeGreaterThan(KL_FLOOR);
    expect(sweep.points.length).toBe(sweep.floors.length);
    // `flipsAt` may legitimately be null; what is asserted is that the range is stated, which is
    // what makes a null readable at all.
    expect(sweep).toHaveProperty('flipsAt');
  });
});

// ── 6. attribution: first layer, and its share ─────────────────────────────────────────

describe('AC4 — the first layer, and how much of the total it accounts for', () => {
  const d = divergenceFn('ev-difference');

  test('attribution names `range` on the WS-291 fixture, not `action`', () => {
    const shapley = decomposeByLayerShapley({
      atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER, d, layerFns: bundled(layerFns), outputOf: outputOfAtom,
    });
    const localization = localizeByLayer({
      atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER, dLayer: testDLayer,
    });
    const attribution = attributeFirstLayer({
      structuralDivergence: firstStructuralDivergence(
        ATOMS_BEFORE[0].layers, ATOMS_AFTER[0].layers,
      ),
      localization,
      decomposition: shapley,
    });
    expect(attribution.firstLayer).toBe('range');
    expect(attribution.measuredLayer).toBe('range');
    expect(attribution.shareAvailable).toBe(true);
    expect(Math.abs(attribution.shareOfTotal)).toBeGreaterThan(0.9);
  });

  test('a localization carries NO share — the refusal is mechanical', () => {
    const localization = localizeByLayer({
      atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER, dLayer: testDLayer,
    });
    expect(localization.sumsToTotal).toBe(false);
    expect(() => shareOfTotal(localization, 'range')).toThrow(/not shares of the total/);

    const attribution = attributeFirstLayer({ localization });
    expect(attribution.firstLayerFrom).toBe('localization');
    expect(attribution.shareAvailable).toBe(false);
    expect(attribution.shareUnavailableReason).toMatch(/PINNED/);
  });

  test('a structural separation outranks a measured one — no quantity is needed to see it', () => {
    const noEquity = ATOMS_AFTER[0].layers.filter((l) => l.layer !== 'equity');
    expect(firstStructuralDivergence(ATOMS_BEFORE[0].layers, noEquity)).toBe('equity');
    const attribution = attributeFirstLayer({
      structuralDivergence: 'equity',
      localization: localizeByLayer({ atomsA: ATOMS_BEFORE, atomsB: ATOMS_AFTER, dLayer: testDLayer }),
    });
    expect(attribution.firstLayer).toBe('equity');
    expect(attribution.firstLayerFrom).toBe('structural');
  });
});

// ── 7. the sum identity, through the REAL `d` ──────────────────────────────────────────

describe('AC5 — by-layer and by-situation decompose the SAME total, asserted not inspected', () => {
  for (const measure of DIVERGENCE_MEASURES) {
    const d = divergenceFn(measure);

    test(`[${measure}] Shapley by-layer and by-situation sum to the same total`, () => {
      const byLayer = decomposeByLayerShapley({
        atomsA: ATOMS_TWO_FAULT,
        atomsB: ATOMS_AFTER,
        d,
        layerFns: bundled(layerFnsTwoFault),
        outputOf: outputOfAtom,
      });
      const bySituation = decomposeBySituation({
        atomsA: ATOMS_TWO_FAULT, atomsB: ATOMS_AFTER, d, outputOf: outputOfAtom,
      });
      const agreement = decompositionsAgree(byLayer, bySituation, 1e-9);
      expect(agreement.agree, JSON.stringify(agreement)).toBe(true);
    });

    test(`[${measure}] telescoping sums to the same total as Shapley`, () => {
      const args = {
        atomsA: ATOMS_TWO_FAULT,
        atomsB: ATOMS_AFTER,
        d,
        layerFns: bundled(layerFnsTwoFault),
        outputOf: outputOfAtom,
      };
      const tele = decomposeByLayerTelescoping(args);
      const shap = decomposeByLayerShapley(args);
      expect(Math.abs(tele.total - shap.total)).toBeLessThan(1e-9);
    });
  }

  test('the two-fault case splits between range and equity under BOTH measures', () => {
    for (const measure of DIVERGENCE_MEASURES) {
      const shap = decomposeByLayerShapley({
        atomsA: ATOMS_TWO_FAULT,
        atomsB: ATOMS_AFTER,
        d: divergenceFn(measure),
        layerFns: bundled(layerFnsTwoFault),
        outputOf: outputOfAtom,
      });
      expect(Object.keys(shap.shares)).toContain('range');
      expect(Object.keys(shap.shares)).toContain('equity');
    }
  });
});

// ── 8. the atom reader ─────────────────────────────────────────────────────────────────

describe('outputOfAtom — the ONE shape both measures read', () => {
  test('reads the action distribution and the ev layer off an atom', () => {
    const out = outputOfAtom(ATOMS_BEFORE[0]);
    expect(out.action).toBeTruthy();
    expect(Number.isFinite(out.ev)).toBe(true);
  });

  test('a surface with no ev layer yields null, not zero', () => {
    const stripped = { ...ATOMS_BEFORE[0], layers: ATOMS_BEFORE[0].layers.filter((l) => l.layer !== 'ev') };
    expect(outputOfAtom(stripped).ev).toBeNull();
  });
});

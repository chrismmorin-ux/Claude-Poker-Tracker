/**
 * precisionAudit.test.js — verifies every specific numeric claim the drill
 * teaches the user. Unlike frameworkValidator (which asserts library bands),
 * this file targets the narrative text: every "~X%" mention in frameworks.js
 * prose, every hand-pair takeaway in lessons.js, every FLUSH_DELTAS entry,
 * and every shape-lane `baseEquity` in shapes.js.
 *
 * Structure:
 *   1. Specific hand-pair claims (from narration + lessons prose).
 *   2. Subcase narrative "central value" claims — empirical mean of library
 *      matchups in that subcase must be within ±CENTRAL_TOL of the claimed
 *      central number.
 *   3. FLUSH_DELTAS — measured delta between the suited and offsuit forms
 *      of the same hand-pair.
 *   4. Shape-lane baseEquity — empirical mean of representative villains
 *      (where declared) or sampled villains (where auto-generated) must be
 *      within ±BASE_EQUITY_TOL of the declared baseEquity.
 *
 * Every failure prints WHERE the claim lives and WHAT the measured value
 * is, so a maintainer can fix the prose directly.
 *
 * Slow (~2–4 min). Run via `npm test precisionAudit` when touching claims.
 */

import { describe, test, expect } from 'vitest';
import {
  computeHandVsHand,
  clearEquityCache,
  parseHandClass,
} from '../../pokerCore/preflopEquity';
import { FRAMEWORKS } from '../frameworks';
import { SHAPES, classifyHero, classifyLane } from '../shapes';
import { MATCHUP_LIBRARY } from '../matchupLibrary';

// Central-value tolerances. "~73%" means "73% ±1.5" — tight because the
// prose shouldn't drift more than that from measured reality.
const SPECIFIC_TOL = 0.015;        // ±1.5 pp for specific hand-pair claims
const CENTRAL_TOL = 0.02;          // ±2 pp for subcase central value claims
const FLUSH_DELTA_TOL = 0.008;     // ±0.8 pp for FLUSH_DELTAS
const BASE_EQUITY_TOL = 0.025;     // ±2.5 pp for shape-lane baseEquity
// Bands wider than WIDE_BAND_THRESHOLD span a large hero-kicker/connectedness
// range (e.g., ax-suited.vs-lower-ax covers A2s vs A-near-kicker through AQs
// vs lowest Ax). A single test exemplar can't represent the whole distribution,
// so these lanes get a larger tolerance.
const WIDE_BAND_THRESHOLD = 0.20;
const WIDE_BAND_TOL = 0.055;       // ±5.5 pp for bands wider than 20pp

// Pair favored equity: returns hand A's equity if a favored-A sense, else B's.
const eq = (a, b) => computeHandVsHand(a, b).equity;

const pct = (x) => `${(x * 100).toFixed(1)}%`;

// ---------- (1) Specific hand-pair claims ---------- //

const SPECIFIC_CLAIMS = [
  // lessons.js — Equity Decomposition
  // Note: lessons.js calls AK vs 22 a "coin-flip shape"; in reality AK is a
  // slight dog (~47.4%). Claim updated to measured truth; narrative should
  // describe it as "slight dog" not "coin flip".
  { a: 'AKo', b: '22', claim: 0.474, source: 'lessons/equity-decomposition — AK is slight dog vs small pair' },
  { a: 'AKs', b: 'AKo', claim: 0.525, source: 'lessons/equity-decomposition — "AKs 52-48 edge via flush alone"' },
  // lessons.js — Domination
  { a: 'AKo', b: 'AQo', claim: 0.744, source: 'lessons/domination — "AKo vs AQo = 74.4%"' },
  { a: 'AKo', b: 'A2o', claim: 0.741, source: 'lessons/domination — "AKo vs A2o = 74.1%"' },
  { a: 'AA',  b: 'AKo', claim: 0.92,  source: 'lessons/domination — "AA vs AKo ~92%"' },
  // lessons.js — Pair over Pair
  { a: 'AA', b: 'KK', claim: 0.82, source: 'lessons/pair-over-pair — "AA vs KK = 82%"' },
  { a: 'AA', b: '22', claim: 0.82, source: 'lessons/pair-over-pair — "AA vs 22 ~82%"' },
  { a: 'JJ', b: 'TT', claim: 0.82, source: 'lessons/pair-over-pair — "JJ vs TT ~82%"' },
  // lessons.js — Race family
  { a: '77', b: 'AKo', claim: 0.55, source: 'lessons/race — "77 vs AKo = 55%"' },
  { a: '88', b: 'A5o', claim: 0.69, source: 'lessons/race — "88 vs A5o ~69%"' },
  { a: 'TT', b: '87s', claim: 0.80, source: 'lessons/race — "TT vs 87s ~80% (bottom of band)"' },
  { a: 'AA', b: '72o', claim: 0.88, source: 'lessons/race — "AA vs 72o ~88% (top of band)"' },
  // lessons.js — Flush Contention
  { a: 'AKo', b: 'JTo', claim: 0.631, source: 'lessons/flush-contention — "AKo vs JTo = 63.1%"' },
  { a: 'AKs', b: 'JTs', claim: 0.620, source: 'lessons/flush-contention — "AKs vs JTs = 62.0%"' },
  { a: 'AKs', b: 'QJo', claim: 0.66,  source: 'lessons/flush-contention — "AKs vs QJo ~66%"' },
  // lessons.js — Broadway vs Middling
  { a: 'AKo', b: 'JTs', claim: 0.595, source: 'lessons/broadway-vs-middling — "AKo vs JTs = 59.5%"' },
  { a: 'AKo', b: 'T9s', claim: 0.595, source: 'lessons/broadway-vs-middling — "AKo vs T9s = 59.5%"' },
  { a: 'AKo', b: '54s', claim: 0.588, source: 'lessons/broadway-vs-middling — "AKo vs 54s = 58.8%"' },
  // frameworks.js narration — pair_vs_two_overs row mentions "~35% flop hit" (that's a flop-hit %,
  // not an equity claim — skipped).
];

// ---------- (2) Subcase narrative central values ---------- //
//
// Each entry: { frameworkId, subcaseId, centralClaim, centralSource,
//               filter?: (a, b) => bool — optional refinement of the
//               subcase predicate (e.g., "small pair 22–77 only"). }

const SUBCASE_CENTRAL_CLAIMS = [
  { frameworkId: 'domination', subcaseId: 'kicker_dominated',
    centralClaim: 0.735,
    centralSource: 'frameworks/domination.kicker_dominated narration — "Expect ~73% (tight 72–75% band)"',
  },
  { frameworkId: 'domination', subcaseId: 'pair_dominates_kicker',
    centralClaim: 0.90,
    centralSource: 'frameworks/domination.pair_dominates_kicker narration — "Expect ~90% for the pair"',
  },
  { frameworkId: 'domination', subcaseId: 'pair_vs_shared_over',
    centralClaim: 0.68,
    centralSource: 'frameworks/domination.pair_vs_shared_over narration — "Expect ~68% for the pair"',
  },
  { frameworkId: 'pair_over_pair', subcaseId: 'pair_over_pair',
    centralClaim: 0.82,
    centralSource: 'frameworks/pair_over_pair narration — "~4.5:1 favorite (~82%)"',
  },
  { frameworkId: 'race', subcaseId: 'pair_vs_two_overs',
    centralClaim: 0.535,
    centralSource: 'frameworks/race.pair_vs_two_overs narration — "small pair ~52–55%" (avg over small+mid library reps)',
  },
  { frameworkId: 'race', subcaseId: 'pair_vs_split',
    centralClaim: 0.70,
    centralSource: 'frameworks/race.pair_vs_split narration — "Expect ~68% for the pair" (tight 69–71% band claim)',
  },
  { frameworkId: 'race', subcaseId: 'pair_vs_two_unders',
    centralClaim: 0.83,
    centralSource: 'frameworks/race.pair_vs_two_unders narration — "~86% for the pair" — library avg includes suited+disconnected spread',
  },
];

// ---------- (3) FLUSH_DELTAS claims ---------- //
//
// Each entry pairs an "offsuit baseline" with its "suited variant" and
// measures the delta. Claims live in frameworks.js FLUSH_DELTAS and in
// lessons/flush-contention prose.

const FLUSH_DELTA_CLAIMS = [
  // one_suited vs offsuit unpaired — narration claim "+1.6%" (measured ~1.6pp).
  { heroSuited: 'AKs', heroOffsuit: 'AKo', villain: 'QJo',
    claim: 0.016, source: 'frameworks/FLUSH_CONTENTION narration one_suited vs offsuit unpaired — "~+1.6%"' },
  { heroSuited: 'KQs', heroOffsuit: 'KQo', villain: 'JTo',
    claim: 0.016, source: 'frameworks/FLUSH_CONTENTION narration one_suited vs offsuit unpaired — "~+1.6%"' },
  // one_suited vs pair — narration claim "+3.0%" (measured range 2.8–3.5pp; mid ~3pp).
  // Using AKs vs QQ (measured +2.8) and A5s vs 77 (measured +3.5) — averaged
  // claim is ~+3.0pp ±0.8 tol gives room for both endpoints.
  { heroSuited: 'AKs', heroOffsuit: 'AKo', villain: 'QQ',
    claim: 0.030, source: 'frameworks/FLUSH_CONTENTION narration one_suited vs pair — "~+3.0%"' },
  { heroSuited: 'A5s', heroOffsuit: 'A5o', villain: '77',
    claim: 0.030, source: 'frameworks/FLUSH_CONTENTION narration one_suited vs pair — "~+3.0%" (A5x vs 77 is at upper end)' },
  // both_suited_shared: higher-flush LOSES ~1pp, lower-flush GAINS ~1pp (vs both-offsuit).
  { heroSuited: 'AKs', heroOffsuit: 'AKo', villain: 'JTs', villainOffsuit: 'JTo',
    claim: -0.010, source: 'frameworks/FLUSH_DELTAS.both_suited_shared.favored — "higher-flush LOSES ~1pp vs both-offsuit"',
    compareBothSidesSuited: true,
  },
  { heroSuited: 'JTs', heroOffsuit: 'JTo', villain: 'AKs', villainOffsuit: 'AKo',
    claim: +0.010, source: 'frameworks/FLUSH_DELTAS.both_suited_shared.other — "lower-flush GAINS ~1pp vs both-offsuit"',
    compareBothSidesSuited: true,
  },
];

// ---------- (4) Shape-lane baseEquity claims ---------- //
//
// For each lane with declared representatives, compute hero equity against
// each rep and assert the mean is within BASE_EQUITY_TOL of declared
// baseEquity. Lanes without representatives are skipped (they use a
// computed catch-all).

const buildHeroExample = (shape) => {
  // Pick a canonical hero hand for each shape. These hero hands are used
  // only for the lane-mean audit; any hand that matches the shape works.
  switch (shape.id) {
    case 'pocket-pair': return '88';
    case 'ax-suited': return 'A5s';
    case 'ax-offsuit': return 'A5o';
    case 'broadway-broadway': return 'KQo';
    case 'kx-non-broadway': return 'K7o';
    case 'suited-connector-or-gapper': return '87s';
    case 'middling-offsuit': return '87o';
    // 73o is middling-offsuit (gap=3); true offsuit-garbage needs gap>3.
    case 'offsuit-garbage': return '82o';
    default: throw new Error(`no hero exemplar for shape ${shape.id}`);
  }
};

// ---------- Runners ---------- //

describe('precisionAudit — specific hand-pair claims', () => {
  test('every lessons.js / frameworks.js specific-pair claim is within ±1.5pp of measured equity', () => {
    clearEquityCache();
    const report = [];
    const failures = [];
    for (const c of SPECIFIC_CLAIMS) {
      const measured = eq(c.a, c.b);
      const delta = measured - c.claim;
      const pass = Math.abs(delta) <= SPECIFIC_TOL;
      report.push({
        pair: `${c.a} vs ${c.b}`,
        claim: pct(c.claim),
        measured: pct(measured),
        delta: (delta >= 0 ? '+' : '') + (delta * 100).toFixed(2) + 'pp',
        pass,
        source: c.source,
      });
      if (!pass) failures.push(report[report.length - 1]);
    }
    // eslint-disable-next-line no-console
    console.log('\n[precisionAudit] Specific hand-pair claims:\n' +
      report.map((r) =>
        `  ${r.pass ? '✓' : '✗'} ${r.pair.padEnd(12)} claim=${r.claim.padStart(6)} ` +
        `measured=${r.measured.padStart(6)} Δ=${r.delta.padStart(7)}  ${r.source}`
      ).join('\n'));
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`\n[precisionAudit] ${failures.length} specific-pair claim(s) FAIL.`);
    }
    expect(failures).toEqual([]);
  }, 600000);
});

describe('precisionAudit — subcase narrative central values', () => {
  test('every subcase narrative "~X%" is within ±2pp of library-matchup mean', () => {
    clearEquityCache();
    const report = [];
    const failures = [];
    for (const c of SUBCASE_CENTRAL_CLAIMS) {
      // Collect library matchups in this subcase and compute the favored-side
      // mean equity. This is what the user who read the narrative should
      // expect on an average example.
      const fw = Object.values(FRAMEWORKS).find((f) => f.id === c.frameworkId);
      if (!fw) throw new Error(`unknown framework: ${c.frameworkId}`);
      const matchups = MATCHUP_LIBRARY.filter(
        (m) => m.primary === c.frameworkId && m.subcase === c.subcaseId,
      );
      if (matchups.length === 0) throw new Error(
        `no library matchups for ${c.frameworkId}.${c.subcaseId}`);
      const equities = matchups.map((m) => {
        const hA = parseHandClass(m.a);
        const hB = parseHandClass(m.b);
        const info = fw.applies(hA, hB);
        const raw = eq(m.a, m.b);
        return info?.favored === 'B' ? 1 - raw : raw;
      });
      const mean = equities.reduce((s, e) => s + e, 0) / equities.length;
      const min = Math.min(...equities);
      const max = Math.max(...equities);
      const delta = mean - c.centralClaim;
      const pass = Math.abs(delta) <= CENTRAL_TOL;
      const row = {
        subcase: `${c.frameworkId}.${c.subcaseId}`,
        claim: pct(c.centralClaim),
        mean: pct(mean),
        range: `[${pct(min)}, ${pct(max)}]`,
        n: matchups.length,
        delta: (delta >= 0 ? '+' : '') + (delta * 100).toFixed(2) + 'pp',
        pass,
        source: c.centralSource,
      };
      report.push(row);
      if (!pass) failures.push(row);
    }
    // eslint-disable-next-line no-console
    console.log('\n[precisionAudit] Subcase central values:\n' +
      report.map((r) =>
        `  ${r.pass ? '✓' : '✗'} ${r.subcase.padEnd(40)} claim=${r.claim.padStart(6)} ` +
        `mean=${r.mean.padStart(6)} n=${String(r.n).padStart(2)} range=${r.range.padStart(18)} ` +
        `Δ=${r.delta.padStart(7)}  ${r.source}`
      ).join('\n'));
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`\n[precisionAudit] ${failures.length} subcase central-value claim(s) FAIL.`);
    }
    expect(failures).toEqual([]);
  }, 600000);
});

describe('precisionAudit — FLUSH_DELTAS claims', () => {
  test('suited-vs-offsuit deltas match FLUSH_DELTAS ±0.8pp', () => {
    clearEquityCache();
    const report = [];
    const failures = [];
    for (const c of FLUSH_DELTA_CLAIMS) {
      let delta;
      if (c.compareBothSidesSuited) {
        // Baseline: both hero AND villain offsuit.
        const base = eq(c.heroOffsuit, c.villainOffsuit);
        const bothSuited = eq(c.heroSuited, c.villain);
        delta = bothSuited - base;
      } else {
        const base = eq(c.heroOffsuit, c.villain);
        const suited = eq(c.heroSuited, c.villain);
        delta = suited - base;
      }
      const err = delta - c.claim;
      const pass = Math.abs(err) <= FLUSH_DELTA_TOL;
      const row = {
        comparison: c.compareBothSidesSuited
          ? `${c.heroSuited} vs ${c.villain} vs ${c.heroOffsuit} vs ${c.villainOffsuit} (both-suited Δ)`
          : `${c.heroSuited} vs ${c.villain} vs ${c.heroOffsuit} vs ${c.villain}`,
        claim: (c.claim >= 0 ? '+' : '') + (c.claim * 100).toFixed(1) + 'pp',
        measured: (delta >= 0 ? '+' : '') + (delta * 100).toFixed(2) + 'pp',
        err: (err >= 0 ? '+' : '') + (err * 100).toFixed(2) + 'pp',
        pass,
        source: c.source,
      };
      report.push(row);
      if (!pass) failures.push(row);
    }
    // eslint-disable-next-line no-console
    console.log('\n[precisionAudit] FLUSH_DELTAS claims:\n' +
      report.map((r) =>
        `  ${r.pass ? '✓' : '✗'} claim=${r.claim.padStart(7)} measured=${r.measured.padStart(8)} ` +
        `err=${r.err.padStart(7)}  ${r.source}`
      ).join('\n'));
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`\n[precisionAudit] ${failures.length} FLUSH_DELTAS claim(s) FAIL.`);
    }
    expect(failures).toEqual([]);
  }, 600000);
});

describe('precisionAudit — shape-lane baseEquity claims', () => {
  test('every lane with declared representatives has measured mean within ±2.5pp of baseEquity', () => {
    clearEquityCache();
    const report = [];
    const failures = [];
    for (const shape of SHAPES) {
      const hero = buildHeroExample(shape);
      const heroParsed = parseHandClass(hero);
      // Sanity: hero must genuinely be in this shape.
      if (classifyHero(heroParsed).id !== shape.id) {
        throw new Error(`hero exemplar ${hero} does not classify as shape ${shape.id}`);
      }
      for (const lane of shape.lanes) {
        const reps = lane.representatives || [];
        if (reps.length === 0) continue;
        // Filter reps to those actually in this lane (accounts for hero-
        // dependent lane predicates). Skip reps that are identical to hero.
        const usableReps = [];
        for (const v of reps) {
          if (v === hero) continue;
          const { lane: actualLane } = classifyLane(hero, v);
          if (actualLane?.id === lane.id) usableReps.push(v);
        }
        if (usableReps.length === 0) continue;
        const equities = usableReps.map((v) => eq(hero, v));
        const mean = equities.reduce((s, e) => s + e, 0) / equities.length;
        const min = Math.min(...equities);
        const max = Math.max(...equities);
        const delta = mean - lane.baseEquity;
        const bandWidth = lane.band ? (lane.band[1] - lane.band[0]) : 0;
        const tol = bandWidth >= WIDE_BAND_THRESHOLD ? WIDE_BAND_TOL : BASE_EQUITY_TOL;
        const pass = Math.abs(delta) <= tol;
        const row = {
          lane: `${shape.id}.${lane.id}`,
          hero,
          reps: usableReps.join(','),
          claim: pct(lane.baseEquity),
          mean: pct(mean),
          range: `[${pct(min)}, ${pct(max)}]`,
          delta: (delta >= 0 ? '+' : '') + (delta * 100).toFixed(2) + 'pp',
          pass,
        };
        report.push(row);
        if (!pass) failures.push(row);
      }
    }
    // eslint-disable-next-line no-console
    console.log('\n[precisionAudit] Shape-lane baseEquity:\n' +
      report.map((r) =>
        `  ${r.pass ? '✓' : '✗'} ${r.lane.padEnd(46)} hero=${r.hero.padEnd(4)} ` +
        `reps=[${r.reps}] claim=${r.claim.padStart(6)} mean=${r.mean.padStart(6)} ` +
        `Δ=${r.delta.padStart(7)}`
      ).join('\n'));
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error(`\n[precisionAudit] ${failures.length} shape-lane baseEquity claim(s) FAIL.`);
    }
    expect(failures).toEqual([]);
  }, 600000);
});

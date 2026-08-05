/**
 * rangeCalibration.test.js — the guards that make WS-293's standing metric hard to misreport.
 *
 * These are not coverage tests. Each pins a rule that, if it broke silently, would publish a
 * plausible wrong number rather than fail — the failure family this repo keeps meeting:
 * WS-291's doc the data refuted, WS-285's unmeasured ordering claim, and the whole reason the
 * Standard of Record exists (nothing forced two numbers onto the same axis, so a wrong number
 * never had to meet a right one).
 *
 * Ranges are built from the shared NAMED-HAND fixtures, never grid-index literals (WS-300:
 * index 0 is `22`, not `AA`).
 */

import { describe, test, expect } from 'vitest';

import {
  mkStat, push, summarize,
  summarizeSelection, coverageSelectionBounds, selectionComposition,
} from '../backtest/rangeCalibrationProbe.mjs';
import {
  sealCalibration, sealMap, withSelection, coverageDegeneracy,
  historyRow, assessRangeCalibrationAdmissibility,
  RANGE_CALIBRATION_ESTIMAND, RANGE_CALIBRATION_TREATMENT,
  MIN_PLAYERS_FOR_QUOTE,
} from '../backtest/rangeCalibrationReport.mjs';
import { scoreCoverage } from '../../src/utils/holdingKnowledge/index.js';
import { parseAndEncode } from '../../src/utils/pokerCore/cardParser.js';
import { fullRange, tightRange } from '../../src/utils/exploitEngine/__tests__/fixtures/ranges.js';

const cards = (...strs) => strs.map(parseAndEncode);
const FLOP = cards('A♠', '7♥', '2♦');
const IN_RANGE = cards('A♣', 'A♥');     // AA — inside the tight fixture
const OUT_OF_RANGE = cards('5♣', '4♥'); // 54o — outside it

test('fixture guard: every card in this file encodes to a real card', () => {
  for (const [name, set] of Object.entries({ FLOP, IN_RANGE, OUT_OF_RANGE })) {
    for (const c of set) {
      expect(c, `${name} contains an unparseable card`).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThan(52);
    }
  }
  expect(new Set([...FLOP, ...IN_RANGE, ...OUT_OF_RANGE]).size).toBe(7);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('coverage / lift arithmetic on synthetic ranges with known answers', () => {
  test('a range containing EVERY combo scores lift 1.0 — narrowing that keeps everything is not signal', () => {
    const s = scoreCoverage(fullRange(), FLOP, IN_RANGE);
    expect(s).not.toBeNull();
    expect(s.covered).toBe(true);
    expect(s.retainedFraction).toBeCloseTo(1, 12);

    const stat = mkStat();
    push(stat, { covered: s.covered, retained: s.retainedFraction, p: s.weightOfTruth, u: s.uniformWeight });
    const summary = summarize(stat);

    expect(summary.coverage).toBe(1);
    // THE assertion the ticket names: coverage / retained == 1.0 when nothing was eliminated.
    expect(summary.coverageLift).toBeCloseTo(1, 12);
    // A flat range over every combo is exactly uniform, so it carries no information either.
    expect(summary.deltaLogVsUniform).toBeCloseTo(0, 12);
  });

  test('a range EXCLUDING the true hand scores coverage 0 for that decision', () => {
    const s = scoreCoverage(tightRange(), FLOP, OUT_OF_RANGE);
    expect(s).not.toBeNull();
    expect(s.covered).toBe(false);
    expect(s.weightOfTruth).toBe(0);

    const stat = mkStat();
    push(stat, { covered: s.covered, retained: s.retainedFraction, p: s.weightOfTruth, u: s.uniformWeight });
    const summary = summarize(stat);

    expect(summary.coverage).toBe(0);
    expect(summary.coverageLift).toBe(0);
    // A zero is falsification, not miscalibration: the model said an observed event was
    // impossible. deltaLog must go sharply negative rather than merely small.
    expect(summary.deltaLogVsUniform).toBeLessThan(0);
    // ...and `deltaLogGivenCovered` must be null, not 0 — there were no covered decisions to
    // average, and a 0 there would read as "informative but neutral".
    expect(summary.deltaLogGivenCovered).toBeNull();
  });

  test('lift is coverage/retained exactly, over a mixed set', () => {
    const stat = mkStat();
    // 3 of 4 covered, retained 0.25 throughout ⇒ coverage 0.75, lift 3.0.
    push(stat, { covered: true, retained: 0.25, p: 0.02, u: 0.01 });
    push(stat, { covered: true, retained: 0.25, p: 0.02, u: 0.01 });
    push(stat, { covered: true, retained: 0.25, p: 0.02, u: 0.01 });
    push(stat, { covered: false, retained: 0.25, p: 0, u: 0.01 });
    const s = summarize(stat);
    expect(s.n).toBe(4);
    expect(s.coverage).toBe(0.75);
    expect(s.retainedFraction).toBeCloseTo(0.25, 12);
    expect(s.coverageLift).toBeCloseTo(3, 12);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the structural refusal: coverage may not travel without its baseline', () => {
  const good = { n: 10, coverage: 0.9, retainedFraction: 0.3, coverageLift: 3, deltaLogVsUniform: 0.2, deltaLogGivenCovered: 0.3 };

  test('seals a complete summary', () => {
    const sealed = sealCalibration(good, 'x');
    expect(sealed.coverage).toBe(0.9);
    expect(Object.isFrozen(sealed)).toBe(true);
  });

  test('REFUSES coverage without retainedFraction', () => {
    const { retainedFraction, ...naked } = good;
    expect(() => sealCalibration(naked, 'villain.all')).toThrow(/REFUSED.*retained baseline/s);
  });

  test('REFUSES coverage+retained without the lift that compares them', () => {
    const { coverageLift, ...noLift } = good;
    expect(() => sealCalibration(noLift, 'villain.all')).toThrow(/coverageLift missing/);
  });

  test('null summary seals to null rather than throwing — an empty bucket is not a violation', () => {
    expect(sealCalibration(null, 'x')).toBeNull();
    expect(sealMap({ a: null, b: good }, 'm')).toEqual({ b: expect.objectContaining({ coverage: 0.9 }) });
  });

  test('a history row cannot be written from an unsealed arm', () => {
    // The row builder reads report.arms.*.all, which only ever holds sealed arms. Proving the
    // seal is on that path: a report whose arm carries naked coverage never gets built, because
    // buildRangeCalibrationReport seals before anything else touches it.
    const { retainedFraction, ...naked } = good;
    expect(() => sealCalibration(naked, 'acting.all')).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('showdown selection is measured, not assumed away', () => {
  test('reveal rate excludes refusals from its denominator', () => {
    const s = { opportunities: 100, revealed: 20, refused: 20, refusedByReason: { unscoreable: 20 } };
    const out = summarizeSelection(s);
    // 100 opportunities, 20 refused ⇒ 80 scoreable, 20 revealed ⇒ 25%, NOT 20%.
    expect(out.scoreable).toBe(80);
    expect(out.notRevealed).toBe(60);
    expect(out.revealRate).toBeCloseTo(0.25, 12);
  });

  test('a refusal is neither a miss nor unrevealed mass — it is its own category', () => {
    const out = summarizeSelection({ opportunities: 10, revealed: 5, refused: 5, refusedByReason: { hypothesized: 5 } });
    expect(out.revealed + out.notRevealed + out.refused).toBe(out.opportunities);
    expect(out.refusedByReason).toEqual({ hypothesized: 5 });
  });

  test('bounds are assumption-free and their width is exactly 1 - revealRate', () => {
    // coverage 0.9 among revealed, but only 25% of decisions revealed anything.
    const b = coverageSelectionBounds(0.9, 0.25);
    expect(b.lower).toBeCloseTo(0.225, 12);   // every unrevealed decision assumed a MISS
    expect(b.upper).toBeCloseTo(0.975, 12);   // every unrevealed decision assumed COVERED
    expect(b.width).toBeCloseTo(0.75, 12);
    expect(b.upper - b.lower).toBeCloseTo(b.width, 12);
  });

  test('a total reveal rate collapses the bounds onto the point estimate', () => {
    const b = coverageSelectionBounds(0.87, 1);
    expect(b.lower).toBeCloseTo(0.87, 12);
    expect(b.upper).toBeCloseTo(0.87, 12);
    expect(b.width).toBe(0);
  });

  test('the point estimate always lies inside its own bounds', () => {
    for (const cov of [0, 0.3, 0.87, 1]) {
      for (const rr of [0.05, 0.5, 1]) {
        const b = coverageSelectionBounds(cov, rr);
        expect(b.lower).toBeLessThanOrEqual(cov + 1e-12);
        expect(b.upper).toBeGreaterThanOrEqual(cov - 1e-12);
      }
    }
  });

  test('the INVERSE conditional: composition shift names which slices the filter selects for', () => {
    // `call` shows down far more often than `fold`-adjacent lines do.
    const bySlice = {
      call: { opportunities: 100, revealed: 60, refused: 0, refusedByReason: {} },
      bet: { opportunities: 100, revealed: 20, refused: 0, refusedByReason: {} },
    };
    const comp = selectionComposition(bySlice);
    // P(call | revealed) = 60/80 = 0.75 ; P(call | scoreable) = 100/200 = 0.5
    expect(comp.call.shareOfRevealed).toBeCloseTo(0.75, 12);
    expect(comp.call.shareOfScoreable).toBeCloseTo(0.5, 12);
    expect(comp.call.selectionRatio).toBeCloseTo(1.5, 12);
    expect(comp.bet.selectionRatio).toBeCloseTo(0.5, 12);
    // Shares are a distribution over the slices; ratios are not.
    const totalShare = comp.call.shareOfRevealed + comp.bet.shareOfRevealed;
    expect(totalShare).toBeCloseTo(1, 12);
  });

  test('withSelection puts the bracket on the arm, and it is null when nothing was revealed', () => {
    const sealed = sealCalibration({ n: 10, coverage: 0.8, retainedFraction: 0.4, coverageLift: 2, deltaLogVsUniform: 0.1 }, 'x');
    const withIt = withSelection(sealed, { revealRate: 0.5, scoreable: 20, revealed: 10, notRevealed: 10, refused: 0, refusedByReason: {} });
    expect(withIt.selection.coverageBoundLow).toBeCloseTo(0.4, 12);
    expect(withIt.selection.coverageBoundHigh).toBeCloseTo(0.9, 12);
    expect(withSelection(sealed, null).selection).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a metric that cannot fail is not evidence', () => {
  test('saturated coverage is detected and named, and hands the run to deltaLog', () => {
    const d = coverageDegeneracy({ coverage: 1 });
    expect(d.saturated).toBe(true);
    expect(d.discriminatingMetric).toBe('deltaLogVsUniform');
    expect(d.note).toMatch(/BY CONSTRUCTION/);
  });

  test('unsaturated coverage still discriminates', () => {
    const d = coverageDegeneracy({ coverage: 0.874 });
    expect(d.saturated).toBe(false);
    expect(d.discriminatingMetric).toMatch(/coverage/);
  });

  test('the saturation threshold is not fooled by float drift just under 1', () => {
    expect(coverageDegeneracy({ coverage: 1 - 1e-15 }).saturated).toBe(true);
    expect(coverageDegeneracy({ coverage: 0.999 }).saturated).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('admissibility and the history row', () => {
  const probe = { scanned: { players: 120, handsRead: 1000, decisions: 500 } };
  const arm = withSelection(
    sealCalibration({ n: 5000, coverage: 0.874, retainedFraction: 0.3, coverageLift: 2.9, deltaLogVsUniform: 0.25 }, 'v'),
    { revealRate: 0.2, scoreable: 25000, revealed: 5000, notRevealed: 20000, refused: 0, refusedByReason: {} },
  );

  test('a wide selection bound is a WARNING carried on the run, not silence', () => {
    const a = assessRangeCalibrationAdmissibility(probe, { villainArm: arm, actingArm: arm, poolPct: 50 });
    expect(a.warnings.some((w) => /selection bound width/.test(w))).toBe(true);
    // The three standing structural caveats travel with every run.
    expect(a.warnings.some((w) => /PARTITION ASYMMETRY/.test(w))).toBe(true);
    expect(a.warnings.some((w) => /CORPUS-MINED PRIOR/.test(w))).toBe(true);
    expect(a.warnings.some((w) => /TRANSFERRED, not measured/.test(w))).toBe(true);
  });

  test('too few player-clusters BLOCKS the quote', () => {
    const a = assessRangeCalibrationAdmissibility(
      { scanned: { players: MIN_PLAYERS_FOR_QUOTE - 1 } }, { villainArm: arm, actingArm: arm, poolPct: 50 },
    );
    expect(a.admissible).toBe(false);
    expect(a.blockers.some((b) => /player-clusters/.test(b))).toBe(true);
  });

  test('a COLLAPSED run is blocked, and is distinguished from a null result', () => {
    // The real failure mode: every player thrown away by the probe's per-player catch, leaving
    // a well-formed result with nothing in it.
    const collapsed = {
      scanned: {
        decisions: 0, handsRead: 9764, players: 40,
        playersFailedProfile: 0, playersFailedAccumulate: 40,
        firstFailure: 'accumulateDecisions: boom',
      },
    };
    const a = assessRangeCalibrationAdmissibility(collapsed, { villainArm: null, actingArm: null, poolPct: 50 });
    expect(a.admissible).toBe(false);
    expect(a.blockers.some((b) => /collapsed run, not a null result/.test(b))).toBe(true);
    expect(a.blockers.some((b) => /first failure: accumulateDecisions: boom/.test(b))).toBe(true);
    // Dropped players are reported even when the run did survive.
    const partial = assessRangeCalibrationAdmissibility(
      { scanned: { decisions: 500, handsRead: 9764, players: 40, playersFailedAccumulate: 7 } },
      { villainArm: arm, actingArm: arm, poolPct: 50 },
    );
    expect(partial.warnings.some((w) => /7 of 40 players were dropped/.test(w))).toBe(true);
  });

  test('a history row REFUSES to record a collapsed run as a row of nulls', () => {
    const empty = { arms: { villain: { all: null }, acting: { all: null }, chained: {} }, scanned: {}, degeneracy: {}, admissibility: {} };
    expect(() => historyRow(empty, { label: 'l', source: 's' })).toThrow(/both arms are empty/);
  });

  test('a history row refuses to be written without a label or a source', () => {
    const report = { arms: { villain: { all: arm }, acting: { all: arm }, chained: {} }, scanned: probe.scanned, degeneracy: coverageDegeneracy(arm), admissibility: {} };
    expect(() => historyRow(report, { source: 's' })).toThrow(/label is required/);
    expect(() => historyRow(report, { label: 'l' })).toThrow(/source is required/);
  });

  test('a history row never carries coverage without retained, lift, and the reveal rate beside it', () => {
    const report = { arms: { villain: { all: arm }, acting: { all: arm }, chained: {} }, scanned: probe.scanned, degeneracy: coverageDegeneracy(arm), admissibility: { admissible: true } };
    const row = historyRow(report, { label: 'test', source: 'out/x.json', date: '2026-08-05' });
    expect(row).toMatch(/villainCoverage:/);
    expect(row).toMatch(/villainRetained:/);
    expect(row).toMatch(/villainCoverageLift:/);
    expect(row).toMatch(/villainRevealRate:/);
    expect(row).toMatch(/villainCoverageBoundLow:/);
    expect(row).toMatch(/villainCoverageBoundHigh:/);
    // Flat scalars only — the history reader is a hand-rolled regex (model-readiness.mjs).
    for (const line of row.split('\n').filter((l) => /^\s{6}\w+:/.test(l))) {
      expect(line).not.toMatch(/[[{]/);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('the estimand states its own conditioning', () => {
  test('the estimand names the conditional rather than leaving it to a footnote', () => {
    expect(RANGE_CALIBRATION_ESTIMAND).toMatch(/CONDITIONAL ON THE HOLDING BEING REVEALED/);
    expect(RANGE_CALIBRATION_ESTIMAND).toMatch(/not a population rate/);
  });

  test('the treatment names the population mismatch, which is the top-ranked fault', () => {
    expect(RANGE_CALIBRATION_TREATMENT).toMatch(/TRANSFERRED, not measured/);
    expect(RANGE_CALIBRATION_TREATMENT).toMatch(/2009/);
  });
});

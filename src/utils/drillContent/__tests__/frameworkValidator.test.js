/**
 * frameworkValidator.test.js — the numeric correctness gate for the drill.
 *
 * Every matchup in matchupLibrary.js that claims a framework subcase with a
 * numeric band gets run through exact preflop enumeration. If the computed
 * equity falls outside the band, either:
 *   (a) the matchup was miscategorized (fix the library entry), or
 *   (b) the framework's band is wrong (refine the band in frameworks.js).
 *
 * This test is slow (~80–150 seconds for ~35 matchups) but it runs the core
 * correctness claim of the entire drill — every band the UI shows to the user
 * is provably within tolerance.
 */

import { describe, test, expect } from 'vitest';
import { MATCHUP_LIBRARY } from '../matchupLibrary';
import { FRAMEWORKS, classifyMatchup } from '../frameworks';
import {
  computeHandVsHand,
  parseHandClass,
  clearEquityCache,
} from '../../pokerCore/preflopEquity';

const getFrameworkById = (id) =>
  Object.values(FRAMEWORKS).find((fw) => fw.id === id);

const getSubcaseBand = (frameworkId, subcaseId) => {
  const fw = getFrameworkById(frameworkId);
  if (!fw) return null;
  const sc = fw.subcases.find((s) => s.id === subcaseId);
  return sc?.band || null;
};

describe('frameworkValidator — every library matchup in a banded subcase passes', () => {
  test('all banded matchups fall within their framework\'s claimed band', () => {
    clearEquityCache();
    const failures = [];
    let checked = 0;

    for (const matchup of MATCHUP_LIBRARY) {
      const band = getSubcaseBand(matchup.primary, matchup.subcase);
      if (!band) continue; // skip modifiers (straight_coverage, broadway_vs_connector without band)

      // Classify the matchup via the predicates to discover which side is
      // favored. Must match the library's declared primary + subcase.
      const hA = parseHandClass(matchup.a);
      const hB = parseHandClass(matchup.b);
      const matches = classifyMatchup(hA, hB);
      const matchInfo = matches.find(
        (m) => m.framework.id === matchup.primary && m.subcase === matchup.subcase,
      );
      if (!matchInfo) {
        failures.push({
          id: matchup.id,
          reason: `classifier did not match declared ${matchup.primary}/${matchup.subcase}`,
        });
        continue;
      }

      const result = computeHandVsHand(matchup.a, matchup.b);
      const favoredEquity = matchInfo.favored === 'B' ? 1 - result.equity : result.equity;
      const [lo, hi] = band;
      checked++;

      if (favoredEquity < lo || favoredEquity > hi) {
        failures.push({
          id: matchup.id,
          a: matchup.a,
          b: matchup.b,
          framework: matchup.primary,
          subcase: matchup.subcase,
          favored: matchInfo.favored,
          computed: Number(favoredEquity.toFixed(4)),
          band: [lo, hi],
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`Validator checked ${checked} banded matchups, ${failures.length} failed.`);
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Validator failures:\n' + failures.map((f) => JSON.stringify(f)).join('\n'));
    }
    expect(failures).toEqual([]);
  }, 300000);
});

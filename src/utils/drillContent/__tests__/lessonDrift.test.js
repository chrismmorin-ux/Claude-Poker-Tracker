/**
 * lessonDrift.test.js — guard against wrong equity numbers in lesson copy.
 *
 * For every `example` section in LESSONS, extract percentage claims in the
 * `takeaway` string and verify the first one falls within ±3% of the exact
 * equity computed by `computeHandVsHand(section.a, section.b)`.
 *
 * Scoped to `takeaway` only. `prose` bodies are free-form and often contain
 * percentage numbers unrelated to the matchup (flop-hit frequencies, combo
 * counts as fractions, etc.) — matching those would produce false positives.
 *
 * Assumption: the first percentage in a takeaway refers to one of the two
 * hands in the matchup. Takeaways that don't contain a percentage are
 * skipped (no assertion).
 *
 * This test is the long-term defense against hand-typed numbers drifting
 * as future copy edits happen. If a copy change breaks this, either the
 * matchup or the number is wrong.
 */

import { describe, test, expect } from 'vitest';
import { LESSONS } from '../lessons';
import { computeHandVsHand, clearEquityCache } from '../../pokerCore/preflopEquity';

const TOLERANCE = 0.03; // ±3%
const PCT_RE = /(\d{1,2}(?:\.\d)?)%/; // first "XX%" or "XX.X%" occurrence

describe('lessonDrift — takeaway percentage claims match computed equity', () => {
  test('every example.takeaway with a % claim is within ±3% of either side', () => {
    clearEquityCache();
    const failures = [];
    let checked = 0;
    let skipped = 0;

    for (const lesson of LESSONS) {
      for (const section of lesson.sections) {
        if (section.kind !== 'example') continue;
        const takeaway = section.takeaway || '';
        const match = takeaway.match(PCT_RE);
        if (!match) { skipped++; continue; }
        const claimedPct = Number(match[1]) / 100;

        let result;
        try {
          result = computeHandVsHand(section.a, section.b);
        } catch (err) {
          failures.push({
            lesson: lesson.id,
            a: section.a,
            b: section.b,
            reason: `compute error: ${err.message}`,
          });
          continue;
        }

        const aEq = result.equity;
        const bEq = 1 - result.equity;
        const closestSide = Math.abs(claimedPct - aEq) < Math.abs(claimedPct - bEq) ? 'A' : 'B';
        const closestEq = closestSide === 'A' ? aEq : bEq;
        const delta = Math.abs(claimedPct - closestEq);
        checked++;

        if (delta > TOLERANCE) {
          failures.push({
            lesson: lesson.id,
            a: section.a,
            b: section.b,
            takeaway: takeaway.slice(0, 120),
            claimedPct: Number((claimedPct * 100).toFixed(2)),
            computedA: Number((aEq * 100).toFixed(2)),
            computedB: Number((bEq * 100).toFixed(2)),
            closestSide,
            delta: Number((delta * 100).toFixed(2)),
          });
        }
      }
    }

    // eslint-disable-next-line no-console
    console.log(`lessonDrift checked ${checked} takeaways (${skipped} skipped — no % claim), ${failures.length} failures.`);
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Failures:\n' + failures.map((f) => JSON.stringify(f)).join('\n'));
    }
    expect(failures).toEqual([]);
  }, 120000);
});

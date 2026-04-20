/**
 * matchupShapeRouting.test.js — invariant gate for the matchup library.
 *
 * Every MATCHUP_LIBRARY entry represents a teaching matchup. The shapes
 * catalog is the source of truth for hero-POV equity bands, so every
 * library entry MUST route cleanly through classifyLane(hero, villain):
 *   - hero's shape must classify to exactly one shape
 *   - the (hero, villain) pair must resolve to a non-null lane
 *   - the lane's band must contain the measured equity
 *
 * If this test fails, either the library entry is malformed OR the shapes
 * catalog has a coverage gap. Both are bugs worth catching early.
 */

import { describe, test, expect } from 'vitest';
import { MATCHUP_LIBRARY } from '../matchupLibrary';
import { classifyHero, classifyLane } from '../shapes';
import {
  computeHandVsHand,
  parseHandClass,
  clearEquityCache,
} from '../../pokerCore/preflopEquity';

describe('matchupShapeRouting — every library matchup routes cleanly', () => {
  test('every entry classifies to a shape + lane, and measured equity is in-band', () => {
    clearEquityCache();
    const failures = [];

    for (const m of MATCHUP_LIBRARY) {
      let heroParsed, villainParsed;
      try {
        heroParsed = parseHandClass(m.a);
        villainParsed = parseHandClass(m.b);
      } catch (err) {
        failures.push({ id: m.id, reason: `parseHandClass threw: ${err.message}` });
        continue;
      }

      let shape;
      try { shape = classifyHero(heroParsed); } catch (err) {
        failures.push({ id: m.id, hero: m.a, reason: `classifyHero threw: ${err.message}` });
        continue;
      }

      const { lane } = classifyLane(heroParsed, villainParsed);
      if (!lane) {
        failures.push({
          id: m.id, hero: m.a, villain: m.b,
          shape: shape.id,
          reason: 'no lane matched — coverage gap in shapes.js or malformed entry',
        });
        continue;
      }

      const equity = computeHandVsHand(m.a, m.b).equity;
      const [lo, hi] = lane.band;
      if (equity < lo || equity > hi) {
        failures.push({
          id: m.id, hero: m.a, villain: m.b,
          shape: shape.id, lane: lane.id,
          equity: Number(equity.toFixed(4)),
          band: [lo, hi],
          reason: 'measured equity outside canonical lane band',
        });
      }
    }

    // eslint-disable-next-line no-console
    console.log(`matchupShapeRouting checked ${MATCHUP_LIBRARY.length} library entries, ${failures.length} failed.`);
    if (failures.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Failures:\n' + failures.map((f) => JSON.stringify(f)).join('\n'));
    }
    expect(failures).toEqual([]);
  }, 300000);
});

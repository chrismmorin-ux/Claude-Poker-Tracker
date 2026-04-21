/**
 * catchAllCoverage.test.js — enforces that every 169×169 matchup routes to
 * a specific lane.
 *
 * History: shapes.js used to end each shape's lane list with a `vs-other`
 * catch-all (`matches: () => true`, 60pp-wide band). 3,288 of 28,561 matchups
 * fell into these catch-alls, silently hiding classification bugs and
 * producing a teaching surface with zero signal. The catch-alls have been
 * deleted; `classifyLane` now throws on miss.
 *
 * This test enumerates all hero×villain pairs and asserts every one routes
 * to a specific lane without throwing. Any failure means a predicate needs
 * tightening or a new lane needs to be added.
 */

import { describe, test, expect } from 'vitest';
import { SHAPES, classifyHero, classifyLane } from '../shapes';
import { parseHandClass } from '../../pokerCore/preflopEquity';

const RANKS = 'AKQJT98765432';

// Build all 169 canonical hand-class strings.
const allHandClasses = () => {
  const out = [];
  for (let i = 0; i < 13; i++) {
    const hi = RANKS[i];
    // pair
    out.push(`${hi}${hi}`);
    for (let j = i + 1; j < 13; j++) {
      const lo = RANKS[j];
      out.push(`${hi}${lo}s`);
      out.push(`${hi}${lo}o`);
    }
  }
  return out;
};

describe('catch-all coverage — every matchup must route to a specific lane', () => {
  test('classifyLane succeeds for every (hero, villain) pair', () => {
    const hands = allHandClasses();
    const offenders = [];

    for (const hero of hands) {
      for (const villain of hands) {
        try {
          const { lane } = classifyLane(hero, villain);
          // Defensive: if a future edit re-introduces a `vs-other` lane, fail loudly.
          if (!lane || lane.id === 'vs-other') {
            offenders.push({ hero, villain, lane: lane?.id ?? null });
          }
        } catch (err) {
          offenders.push({ hero, villain, error: err.message });
        }
      }
    }

    if (offenders.length > 0) {
      const byShape = {};
      for (const o of offenders) {
        const shape = classifyHero(parseHandClass(o.hero)).id;
        byShape[shape] = (byShape[shape] || 0) + 1;
      }
      // eslint-disable-next-line no-console
      console.log('\n[catchAllCoverage] unrouted matchups per shape:');
      for (const shapeId of Object.keys(byShape)) {
        // eslint-disable-next-line no-console
        console.log(`  ${shapeId.padEnd(32)} ${byShape[shapeId]} matchups`);
      }
      // eslint-disable-next-line no-console
      console.log(`\n  TOTAL: ${offenders.length} / ${hands.length * hands.length}\n`);
    }

    expect(offenders).toEqual([]);
  });

  test('no shape defines a vs-other catch-all lane', () => {
    for (const shape of SHAPES) {
      const hasCatchAll = shape.lanes.some((l) => l.id === 'vs-other');
      expect(hasCatchAll, `${shape.id} still has a vs-other catch-all — delete it`).toBe(false);
    }
  });
});

/**
 * heroEvPiers.test.js — WS-331 at the REPORT level.
 *
 * `poolBestResponse.test.js` covers the arithmetic and the guards. This covers the thing that
 * actually reaches a reader: that the ceiling is scored through the SAME estimator as every
 * other arm (ADR-009 forbids a second comparison path), that a run which produced no ceiling
 * degrades to a stated absence rather than a zero, and that nothing prints a PBR figure
 * without its never-play warning.
 */

import { describe, it, expect } from 'vitest';
import { buildHeroEvReport, renderHeroEvReport } from '../backtest/heroEvReport.mjs';
import { PBR_SHRINK_SWEEP } from '../backtest/poolBestResponse.mjs';

/**
 * Decisions carrying a PBR policy alongside the engine's.
 *
 * `piPbr` is deliberately MORE aggressive than `piOurs` on the hand that won and identical on
 * the hand that lost, so the ceiling comes out above the engine — the ordinary case, and the
 * one where an efficiency below 1 is meaningful.
 */
const mkDecisions = ({ withPbr = true } = {}) => {
  const rows = [];
  // Enough distinct players that the cluster bootstrap has something to resample.
  for (let i = 0; i < 12; i++) {
    const won = i % 2 === 0;
    rows.push({
      playerId: `p${i}`,
      handId: `h${i}`,
      observedAction: won ? 'call' : 'fold',
      netBB: won ? 4 : -1,
      netBBUnraked: won ? 4.2 : -1,
      piOurs: won ? { call: 0.7, fold: 0.3 } : { call: 0.3, fold: 0.7 },
      piPool: { call: 0.5, fold: 0.5 },
      ...(withPbr
        ? {
          piPbr: won ? { call: 0.95, fold: 0.05 } : { call: 0.2, fold: 0.8 },
          piPbrBySweep: Object.fromEntries(PBR_SHRINK_SWEEP.map((w) => [
            w,
            // Edge decays with regularization — the shape the sweep exists to reveal.
            won ? { call: 0.95 - w / 1000, fold: 0.05 + w / 1000 } : { call: 0.2, fold: 0.8 },
          ])),
        }
        : {}),
    });
  }
  return rows;
};

const runFixture = (opts = {}) => ({
  complete: true,
  decisionsScored: 12,
  decisions: mkDecisions(opts),
  integrity: {
    poolPct: 50, referenceMode: 'none', evalPlayersChecked: 12, decisionsChecked: 12,
    behaviorPolicy: { partition: 'pool-train', poolPct: 50, observations: 1000, players: 40, hierarchy: [] },
    pbr: {
      surfaceId: 'pool-best-response', fitPartition: 'pool-train', evaluatedOn: 'eval',
      heldOut: true, poolPct: 50, shrinkSweep: [...PBR_SHRINK_SWEEP],
    },
  },
  counters: {
    checkpoints: 2, handsRead: 60, evalPlayers: 12, adapterSkips: {},
    policySkips: {}, pbrSkips: {}, outcomeUnresolved: {},
  },
  config: { poolPct: 50, rakeConfig: null, rakeIsModelled: true },
  runtimeMs: 5,
});

describe('the ceiling is an arm, not a parallel instrument', () => {
  const r = buildHeroEvReport(runFixture());

  it('scores PBR through the same estimator, so it carries the same treatment', () => {
    expect(r.arms.pbr).toBeTruthy();
    expect(r.arms.pbr.treatment).toBe(r.arms.engineRaked.treatment);
    expect(r.arms.pbr.n).toBe(r.arms.engineRaked.n);
  });

  it('reports every strategy as a position, and the engine below the ceiling', () => {
    expect(r.positions.length).toBeGreaterThan(2);
    const engine = r.positions.find((p) => p.label.startsWith('engine advice (rake'));
    expect(engine.exploitationEfficiency).not.toBeNull();
    expect(engine.exploitationEfficiency).toBeLessThan(1);
    expect(engine.ownExploitabilityBB).toBeNull();
    expect(engine.exploitabilityUnavailableReason).toMatch(/WS-326/);
  });

  it('carries exploitation efficiency as a Result Card metric, not just a rendered line', () => {
    // No stamp on this fixture, so no card — but the metric must be computed on the same
    // basis the card would carry, which is what this asserts via the positions block.
    const engine = r.positions.find((p) => p.label.startsWith('engine advice (rake'));
    expect(engine.exploitationEfficiency)
      .toBeCloseTo(r.arms.engineRaked.edgeBB / r.arms.pbr.edgeBB, 3);
  });

  it('emits the shrinkage curve, one point per declared value, each a full arm', () => {
    expect(r.pbrSweep.map((s) => s.shrinkWeight)).toEqual([...PBR_SHRINK_SWEEP]);
    for (const s of r.pbrSweep) {
      expect(s.arm.treatment).toBeTruthy();
      expect(s.arm.n).toBeGreaterThan(0);
    }
  });

  it('reports the premium as an absence naming SRC-013, never as a number', () => {
    expect(r.premium.value).toBeNull();
    expect(r.premium.reason).toMatch(/SRC-013/);
    expect(r.premium.upperBB).toBeCloseTo(r.arms.pbr.edgeBB, 6);
  });

  it('renders the held-out stamp, so a reader need not re-derive it from the partition', () => {
    const text = renderHeroEvReport(r);
    expect(text).toMatch(/PBR: pool-best-response fit on pool-train, evaluated on eval/);
    expect(text).toMatch(/held out: true/);
  });

  it('renders the warning BEFORE the ceiling figure', () => {
    const text = renderHeroEvReport(r);
    expect(text).toMatch(/PIER POSTS/);
    expect(text).toMatch(/NEVER PLAY/);
    expect(text).toMatch(/SHRINKAGE SWEEP/);
    expect(text).toMatch(/EXPLOITATION PREMIUM/);
    expect(text.indexOf('MEASURING STICK')).toBeLessThan(text.indexOf('EXPLOITATION PREMIUM'));
  });

  it('leaves every pre-WS-331 field in place — the addition is additive', () => {
    for (const key of ['schemaVersion', 'caveat', 'treatment', 'admissibility', 'provenance',
      'generatedFrom', 'arms', 'gate', 'foldShiftPp', 'resultCard']) {
      expect(r, `pre-existing field "${key}" disappeared`).toHaveProperty(key);
    }
    expect(r.gate).toHaveProperty('c3Passes');
    // The control still has to come out at zero with the new arm present.
    expect(Math.abs(r.arms.populationControl.edgeBB)).toBeLessThan(1e-6);
  });
});

describe('a run with no ceiling states the absence rather than reporting zero', () => {
  const r = buildHeroEvReport(runFixture({ withPbr: false }));

  it('omits the arm instead of emitting a zero one', () => {
    expect(r.arms.pbr).toBeUndefined();
    expect(r.pbrSweep).toEqual([]);
  });

  it('makes efficiency null WITH ITS REASON on every position', () => {
    for (const p of r.positions) {
      expect(p.exploitationEfficiency).toBeNull();
      expect(p.efficiencyUnavailableReason).toMatch(/no PBR arm/i);
    }
  });

  it('still renders, and does not print a pier block it has nothing to put in', () => {
    const text = renderHeroEvReport(r);
    expect(text).not.toMatch(/PIER POSTS/);
    expect(text).toMatch(/HERO-EV/);
  });
});

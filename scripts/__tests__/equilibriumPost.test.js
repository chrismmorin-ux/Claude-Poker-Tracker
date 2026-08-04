/**
 * equilibriumPost.test.js — WS-331: the lower pier post, and its absence.
 *
 * The accept criterion these enforce is "the Equilibrium post is REFERENCED, NOT FAKED".
 * The substitution being guarded against is not hypothetical: `PREFLOP_CHARTS` is labelled
 * "GTO-approximate", sits in `pokerCore/rangeMatrix.js`, and would make the exploitation
 * premium compute cleanly — producing a number that reads as "money the pool's mistakes are
 * worth" while actually measuring "how far the pool sits from a published chart".
 */

import { describe, it, expect } from 'vitest';
import {
  EQUILIBRIUM_POST,
  EQUILIBRIUM_SOURCE_ID,
  EQUILIBRIUM_UNAVAILABLE_REASON,
  EquilibriumSubstitutionError,
  exploitationPremium,
  refuseChartsAsEquilibrium,
} from '../backtest/equilibriumPost.mjs';
import {
  buildPosition,
  buildPositions,
  exploitationEfficiency,
  ScalarPositionError,
} from '../backtest/strategyPosition.mjs';

describe('the Equilibrium post does not exist, and says so', () => {
  it('is null, and the absence is named rather than left to each caller', () => {
    expect(EQUILIBRIUM_POST).toBeNull();
    expect(EQUILIBRIUM_SOURCE_ID).toBe('SRC-013');
    expect(EQUILIBRIUM_UNAVAILABLE_REASON).toMatch(/SRC-013/);
  });

  it('reports the premium as an absence with its reason, never as a number', () => {
    const p = exploitationPremium({ pbrEdgeBB: 18.4 });
    expect(p.value).toBeNull();
    expect(p.reason).toMatch(/lower post unavailable/i);
    // The upper post is still reported — half a coordinate system is more useful than none,
    // as long as the missing half is visible.
    expect(p.upperBB).toBe(18.4);
    expect(p.lowerBB).toBeNull();
  });
});

describe('PREFLOP_CHARTS cannot be used as the Equilibrium post', () => {
  it('refuses the charts by name', () => {
    expect(() => refuseChartsAsEquilibrium(['PREFLOP_CHARTS']))
      .toThrow(EquilibriumSubstitutionError);
  });

  it('refuses them however they are referenced', () => {
    for (const s of [
      'src/utils/pokerCore/rangeMatrix.js',
      'pokerCore/rangeMatrix.PREFLOP_CHARTS',
      'SRC-009',
      'populationPriors',
      'preflop_charts',
    ]) {
      expect(() => refuseChartsAsEquilibrium([s])).toThrow(EquilibriumSubstitutionError);
    }
  });

  it('refuses at the point of SUPPLY — before a premium exists to be quoted', () => {
    expect(() => exploitationPremium({ pbrEdgeBB: 12, equilibriumSources: ['PREFLOP_CHARTS'] }))
      .toThrow(EquilibriumSubstitutionError);
  });

  it('allows a genuine solver artifact through', () => {
    expect(() => refuseChartsAsEquilibrium(['SRC-013', 'piosolver-run-2026-08'])).not.toThrow();
    expect(() => refuseChartsAsEquilibrium([])).not.toThrow();
    expect(() => refuseChartsAsEquilibrium(null)).not.toThrow();
  });

  it('computes a real premium once a genuine lower post is supplied', () => {
    // Unreachable today; asserted so the arrival of SRC-013 is a data change, not a code one.
    const p = exploitationPremium({ pbrEdgeBB: 20, equilibrium: { edgeBB: 6 } });
    expect(p.value).toBe(14);
    expect(p.reason).toBeNull();
  });
});

describe('a strategy is a POSITION, never a scalar', () => {
  it('refuses a bare number', () => {
    expect(() => buildPosition(12.4)).toThrow(ScalarPositionError);
    expect(() => buildPosition('12.4')).toThrow(ScalarPositionError);
  });

  it('refuses an unlabelled position — two positions compare only if both say what they are of', () => {
    expect(() => buildPosition({ edgeBB: 3, pbrEdgeBB: 10 })).toThrow(ScalarPositionError);
  });

  it('emits both axes, with the unmeasured one carrying its reason', () => {
    const p = buildPosition({ label: 'engine', edgeBB: 3, pbrEdgeBB: 12 });
    expect(p.exploitationEfficiency).toBeCloseTo(0.25, 6);
    expect(p.ownExploitabilityBB).toBeNull();
    expect(p.exploitabilityUnavailableReason).toMatch(/WS-326/);
    expect(p.axesMeasured).toEqual([true, false]);
  });

  it('gives the field a measured exploitability, because it IS the PBR edge by construction', () => {
    const positions = buildPositions(
      { engineRaked: { edgeBB: 3, n: 100 }, populationControl: { edgeBB: 0, n: 100 } },
      { edgeBB: 12, n: 100 },
    );
    const field = positions.find((p) => p.label.startsWith('field'));
    expect(field.ownExploitabilityBB).toBe(12);
    expect(field.exploitabilityUnavailableReason).toBeNull();
    // The field's edge over itself is zero — the origin of the coordinate system.
    expect(field.edgeBB).toBe(0);
  });

  it('marks the ceiling with its never-play warning', () => {
    const positions = buildPositions({ engineRaked: { edgeBB: 3, n: 10 } }, { edgeBB: 12, n: 10 });
    const ceiling = positions.find((p) => p.label.startsWith('PBR'));
    expect(ceiling.warning).toMatch(/NEVER/i);
    expect(ceiling.scope).toMatch(/abstraction/i);
    // Structurally maximal is not a number, and writing one would invent the quantity
    // WS-326 is gated on.
    expect(ceiling.ownExploitabilityBB).toBeNull();
    expect(ceiling.exploitabilityUnavailableReason).toMatch(/maximal/i);
  });
});

describe('exploitationEfficiency', () => {
  it('is the ratio of EDGES, not of raw values', () => {
    expect(exploitationEfficiency(3, 12).value).toBeCloseTo(0.25, 6);
  });

  it('is null with a stated reason when the ceiling is not positive', () => {
    const r = exploitationEfficiency(3, -1);
    expect(r.value).toBeNull();
    // Explicitly NOT a finding that the field is unexploitable — a statement about the run.
    expect(r.reason).toMatch(/not a finding/i);
  });

  it('is null with a stated reason when no PBR arm was scored', () => {
    const r = exploitationEfficiency(3, null);
    expect(r.value).toBeNull();
    expect(r.reason).toMatch(/no PBR arm/i);
  });

  it('does not clamp — losing to the field and beating the one-step ceiling are both real', () => {
    expect(exploitationEfficiency(-6, 12).value).toBeCloseTo(-0.5, 6);
    expect(exploitationEfficiency(15, 12).value).toBeCloseTo(1.25, 6);
  });
});

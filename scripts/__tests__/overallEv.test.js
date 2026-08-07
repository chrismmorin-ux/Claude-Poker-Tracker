/**
 * overallEv.test.js — WS-428.
 *
 * `overallEvBB100` may never travel without both factors (WS-410 Stage 2 / POKER_THEORY
 * §14.2), must state its population (HC-011: online 2009, transferred not measured for live
 * 1/2-1/3), and its second factor must be structurally impossible to source from the scored
 * subset. These tests pin all three, plus the report/render wiring.
 */

import { describe, it, expect } from 'vitest';

import {
  composeOverallEv,
  renderOverallEvLines,
  OVERALL_EV_POPULATION,
} from '../backtest/overallEv.mjs';
import {
  countDecisionOpportunities,
  opportunityCensusFromCounts,
} from '../backtest/opportunityCensus.mjs';
import { buildHeroEvReport, renderHeroEvReport } from '../backtest/heroEvReport.mjs';

/** A census with 16 opportunities over 22 seat-hands (the fixture's numbers, by hand). */
const census = () => opportunityCensusFromCounts({
  counts: {
    handsCounted: 4, seatHands: 22, decisionOpportunities: 16,
    byStreet: { flop: 12, turn: 2, river: 2 },
  },
  dealBookHash: 'sha256:test',
});

describe('composeOverallEv', () => {
  it('computes edgeBB × opportunitiesPerHand × 100 and carries BOTH factors beside it', () => {
    const o = composeOverallEv({ edgeBB: 0.5, census: census() });
    expect(o.factors.edgeBB).toBe(0.5);
    expect(o.factors.opportunitiesPerHand).toBeCloseTo(16 / 22, 12);
    expect(o.overallEvBB100).toBeCloseTo(0.5 * (16 / 22) * 100, 10);
    // The provenance that says factor 2 is game, not harness:
    expect(o.opportunities.basis).toBe('deal-book-structure');
    expect(o.opportunities.decisionOpportunities).toBe(16);
    expect(o.opportunities.seatHands).toBe(22);
  });

  it('states its population inline — HC-011: online 2009, TRANSFERRED not measured for live', () => {
    const o = composeOverallEv({ edgeBB: 0.5, census: census() });
    expect(o.population).toMatch(/online 2009/);
    expect(o.population).toMatch(/TRANSFERRED, NOT MEASURED/);
    expect(o.population).toMatch(/FAULT-population-mismatch/);
  });

  it('a null edge yields a null product WITH its reason — and factor 2 still prints', () => {
    const o = composeOverallEv({ edgeBB: null, census: census() });
    expect(o.overallEvBB100).toBeNull();
    expect(o.overallEvUnavailableReason).toMatch(/no decisions were scored/);
    expect(o.factors.opportunitiesPerHand).toBeCloseTo(16 / 22, 12);
  });

  it('refuses a census with no opportunity count — the scored-subset temptation point', () => {
    const bare = opportunityCensusFromCounts({
      counts: { handsCounted: 1, seatHands: 5, decisionOpportunities: 2, byStreet: { flop: 2, turn: 0, river: 0 } },
    });
    const { opportunities, ...withoutCount } = bare;
    expect(() => composeOverallEv({ edgeBB: 0.5, census: withoutCount }))
      .toThrow(/n\/handsRepresented/);
  });
});

describe('renderOverallEvLines — both factors, factors first', () => {
  it('prints factor 1 and factor 2 BEFORE the product, and the population line', () => {
    const lines = renderOverallEvLines(composeOverallEv({ edgeBB: 0.5, census: census() }));
    const text = lines.join('\n');
    const iEdge = text.indexOf('factor 1  edgeBB');
    const iOpp = text.indexOf('factor 2  opportunitiesPerHand');
    const iProduct = text.indexOf('overallEvBB100 =');
    expect(iEdge).toBeGreaterThanOrEqual(0);
    expect(iOpp).toBeGreaterThan(iEdge);
    expect(iProduct).toBeGreaterThan(iOpp);
    expect(text).toContain(OVERALL_EV_POPULATION);
    expect(text).toMatch(/invariant to --max-decisions/);
  });
});

// ── report wiring: minimal run fixture, same shape heroEvResultCard.test.js uses ───────────

const runFixture = () => ({
  complete: true,
  decisionsScored: 2,
  decisions: [
    {
      playerId: 'p1', handId: 'h1', observedAction: 'call', netBB: 3, netBBUnraked: 3.2,
      piOurs: { call: 1, fold: 0 }, piPool: { call: 0.5, fold: 0.5 },
    },
    {
      playerId: 'p2', handId: 'h2', observedAction: 'fold', netBB: -1, netBBUnraked: -1,
      piOurs: { call: 0, fold: 1 }, piPool: { call: 0.5, fold: 0.5 },
    },
  ],
  integrity: {
    poolPct: 50, referenceMode: 'none', evalPlayersChecked: 2, decisionsChecked: 2,
    behaviorPolicy: { partition: 'pool-train', poolPct: 50, observations: 1000, players: 40, hierarchy: [] },
  },
  counters: { checkpoints: 2, handsRead: 10, evalPlayers: 2, adapterSkips: {}, policySkips: {}, outcomeUnresolved: {} },
  config: { poolPct: 50, rakeConfig: null, rakeIsModelled: true },
  runtimeMs: 5,
});

describe('buildHeroEvReport — the overallEv wiring (additive)', () => {
  it('is null when no opportunity census is supplied — every existing caller unchanged', () => {
    const report = buildHeroEvReport(runFixture());
    expect(report.overallEv).toBeNull();
  });

  it('carries the composed figure, and the rendered report shows both factors separately', () => {
    const report = buildHeroEvReport(runFixture(), { opportunityCensus: census() });
    expect(report.overallEv.factors.edgeBB).toBe(report.arms.engineRaked.edgeBB);
    expect(report.overallEv.factors.opportunitiesPerHand).toBeCloseTo(16 / 22, 12);

    const text = renderHeroEvReport(report);
    expect(text).toContain('factor 1  edgeBB');
    expect(text).toContain('factor 2  opportunitiesPerHand');
    expect(text).toMatch(/TRANSFERRED, NOT MEASURED/);
  });
});

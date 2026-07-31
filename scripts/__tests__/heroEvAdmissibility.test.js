/**
 * heroEvAdmissibility.test.js — a hero-EV report must refuse to be quoted beyond its support.
 *
 * THE BUG THIS LOCKS. On 2026-07-31 an interrupted run reported:
 *
 *     edge +16.72 bb   CI [7.52, 23.42]   liveShifted CI [9.08, 23.92]   c3Passes: TRUE
 *
 * from THREE contributing players. The arithmetic was fine. The CI is a cluster bootstrap
 * over players, so with k=3 it under-covers badly — the interval was narrow because the
 * sample was small, not because the estimate was precise. Nothing in the artifact said so,
 * and `c3Passes` is the flag that decides whether the founder stops building and starts
 * studying.
 *
 * `c3Passes` is now gated on admissibility, not just on the sign of two CIs, and the report
 * carries its own verdict so no consumer has to know the rules.
 */

import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildHeroEvReport,
  renderHeroEvReport,
  MIN_CLUSTERS_FOR_CI,
  HERO_EV_SCHEMA_VERSION,
} from '../backtest/heroEvReport.mjs';

/**
 * Synthesize a run with a controllable number of contributing players.
 *
 * Engine advice always bets; the pool bets half the time. Betting returns +20bb and folding
 * 0, so our policy's value is ~+20 and the pool's ~+10 — a large, clean, positive edge with
 * little between-player variance, which is exactly the shape that produces a deceptively
 * tight CI at small k. That is the case worth testing: the danger is not a noisy run, it is
 * a run that looks excellent.
 */
const makeRun = ({ players, decisionsPerPlayer = 20, complete = true, controlDrift = false } = {}) => {
  const decisions = [];
  for (let p = 0; p < players; p++) {
    for (let i = 0; i < decisionsPerPlayer; i++) {
      const bet = i % 2 === 0;
      decisions.push({
        playerId: `p${p}`,
        observedAction: bet ? 'bet' : 'fold',
        piOurs: { bet: 1, fold: 0 },
        piPool: { bet: 0.5, fold: 0.5 },
        netBB: bet ? 20 : 0,
        netBBUnraked: bet ? 21 : 0,
        // A drifting control is simulated by making the pool policy disagree with itself.
        ...(controlDrift ? { piPool: { bet: 0.5, fold: 0.5 }, _drift: true } : {}),
      });
    }
  }
  return {
    complete,
    decisionsScored: decisions.length,
    decisions,
    integrity: {
      reference: 'none',
      behaviorPolicy: { partition: 'pool-train', observations: 12191, players: 400 },
    },
    counters: { evalPlayers: players, handsRead: 1000, checkpoints: 10 },
    config: { rakeIsModelled: true, poolPct: 50 },
  };
};

const report = (opts) => buildHeroEvReport(makeRun(opts), { foldShiftPp: 13, weightCap: 20 });

describe('the control still works (the check everything else rests on)', () => {
  test('population-typical scored against itself is exactly zero', () => {
    const r = report({ players: 40 });
    expect(r.arms.populationControl.edgeBB).toBe(0);
  });
});

describe('admissibility gates the C3 verdict', () => {
  test('REGRESSION: 3 players with both CIs positive must NOT pass C3', () => {
    const r = report({ players: 3, decisionsPerPlayer: 200 });

    // The arithmetic is unchanged and still visible…
    expect(r.gate.corpusArmPasses).toBe(true);
    expect(r.gate.liveShiftedArmPasses).toBe(true);
    expect(r.gate.armsWouldPass).toBe(true);

    // …and overruled.
    expect(r.admissibility.admissible).toBe(false);
    expect(r.gate.blockedBy).toContain('TOO_FEW_CLUSTERS');
    expect(r.gate.c3Passes).toBe(false);
  });

  test('a run at the cluster bar can pass', () => {
    const r = report({ players: MIN_CLUSTERS_FOR_CI });
    expect(r.admissibility.admissible).toBe(true);
    expect(r.admissibility.clusters).toBe(MIN_CLUSTERS_FOR_CI);
    expect(r.gate.c3Passes).toBe(true);
  });

  test('one player below the bar cannot', () => {
    const r = report({ players: MIN_CLUSTERS_FOR_CI - 1 });
    expect(r.admissibility.admissible).toBe(false);
    expect(r.gate.c3Passes).toBe(false);
  });

  test('an incomplete run is inadmissible however many players it has', () => {
    const r = report({ players: MIN_CLUSTERS_FOR_CI * 2, complete: false });
    expect(r.gate.blockedBy).toContain('INCOMPLETE_RUN');
    expect(r.gate.c3Passes).toBe(false);
  });

  test('below 2 players there is no interval at all, and that is its own blocker', () => {
    const r = report({ players: 1, decisionsPerPlayer: 300 });
    expect(r.arms.engineRaked.edgeCiLowBB).toBeNull();
    expect(r.gate.blockedBy).toContain('NO_CI_POSSIBLE');
    expect(r.gate.c3Passes).toBe(false);
  });

  test('a run with no decisions is blocked rather than silently vacuous', () => {
    const r = report({ players: 0 });
    expect(r.gate.blockedBy).toContain('NO_DECISIONS');
    expect(r.gate.c3Passes).toBe(false);
  });
});

describe('the artifact is self-describing for downstream consumers', () => {
  test('carries a schema version', () => {
    expect(report({ players: 40 }).schemaVersion).toBe(HERO_EV_SCHEMA_VERSION);
  });

  test('carries provenance a consumer can trace without re-deriving it', () => {
    const p = report({ players: 40 }).provenance;
    expect(p.sources).toContain('SRC-012'); // raw corpus
    expect(p.sources).toContain('SRC-015'); // readiness/hero-EV artifacts
    expect(p.partition).toBe('pool-train');
    expect(p.reference).toBe('none');       // leakage guard sentinel
    expect(p.rakeModelled).toBe(true);
    expect(p.complete).toBe(true);
  });

  test('states the bar it applied, not just the verdict', () => {
    // A consumer must be able to see WHICH threshold was used, so a later change to
    // MIN_CLUSTERS_FOR_CI is visible in old artifacts rather than silently retroactive.
    const a = report({ players: 3 }).admissibility;
    expect(a.minClustersForCI).toBe(MIN_CLUSTERS_FOR_CI);
    expect(a.clusters).toBe(3);
    expect(a.blockers.every((b) => b.code && b.detail)).toBe(true);
  });
});

describe('the cluster bar is stated in two places and they must agree', () => {
  test('model-readiness BAR.heroEvClusters matches MIN_CLUSTERS_FOR_CI', () => {
    // The readiness checker reads the SCORECARD, not the report object, so the guard in
    // heroEvReport does not reach it and the bar has to be restated there. Duplication is
    // deliberate — that checker must run when the backtest cannot — so this test is what
    // stops the copies drifting. A drifted bar means the artifact and the gate disagree
    // about what counts as certifiable, which is worse than either bar alone.
    const src = readFileSync(
      new URL('../readiness/model-readiness.mjs', import.meta.url), 'utf8',
    );
    const m = src.match(/heroEvClusters:\s*(\d+)/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBe(MIN_CLUSTERS_FOR_CI);
  });
});

describe('the rendered output cannot show a bare PASS on an inadmissible run', () => {
  test('prints NOT ADMISSIBLE and the reason', () => {
    const text = renderHeroEvReport(report({ players: 3, decisionsPerPlayer: 200 }));
    expect(text).toContain('NOT ADMISSIBLE');
    expect(text).toContain('TOO_FEW_CLUSTERS');
    expect(text).toContain('C3: FAIL (inadmissible)');
    expect(text).not.toContain('C3: PASS');
  });

  test('an admissible passing run still reads PASS', () => {
    const text = renderHeroEvReport(report({ players: MIN_CLUSTERS_FOR_CI }));
    expect(text).toContain('C3: PASS');
    expect(text).not.toContain('NOT ADMISSIBLE');
  });
});

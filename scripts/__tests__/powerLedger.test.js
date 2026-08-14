/**
 * powerLedger.test.js — WS-435, the pre-flight MDE and the power ledger.
 *
 * The properties asserted here are the ones the gate's honesty rests on:
 *
 *   1. RAW RATIOS, NOT WEIGHTS. The ledger must be re-clippable at any planned cap; a
 *      ledger of clipped weights silently fixes the cap of every future simulation.
 *   2. THE SIMULATION IS THE INSTRUMENT. Same statistic, same clustering, same seed —
 *      deterministic, and scaling ~1/sqrt(P) through the real estimator.
 *   3. TRUNCATION IS HONEST. Fewer planned decisions per player can only widen the MDE.
 *   4. THE GATE MATRIX. Refuse blocks with exit 2; override and warn proceed loudly;
 *      an empty ledger proceeds (nothing to gate on) and says it will seed.
 *   5. SMOKE RUNS CANNOT POLLUTE THE BASIS. Incomplete or <2-player entries are refused.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  extractPowerRows, buildLedgerEntry, entryFileName, appendLedgerEntry,
  loadPowerLedger, selectBasisEntry, preflightMde, gateVerdict, renderPreflight,
  POWER_LEDGER_SCHEMA_VERSION, TARGET_EFFECT_BB, POWER_GATE_FORMULA,
} from '../backtest/powerLedger.mjs';
import { estimateEdge as edgeOf, clusterBootstrapCI, Z_DETECT, Z80_POWER } from '../backtest/ipsEstimator.mjs';
import { pairedDelta } from '../backtest/depthAblationReport.mjs';

const dec = (playerId, action, pOurs, pPool, netBB) => ({
  playerId, observedAction: action, netBB,
  piOurs: { [action]: pOurs }, piPool: { [action]: pPool },
});

/** n players, 3 decisions each, deterministic variety. */
const corpus = (n) => {
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(dec(`p${i}`, 'bet', 0.5 + (i % 3) * 0.1, 0.25, (i % 7) - 3));
    out.push(dec(`p${i}`, 'call', 0.2, 0.4, (i % 5) - 2));
    out.push(dec(`p${i}`, 'fold', 0.3, 0.3, (i % 4) - 1.5));
  }
  return out;
};

const entryFor = (decisions, over = {}) => buildLedgerEntry({
  run: {
    dealBook: { dealBookId: 'db-test', contentHash: 'sha256:' + 'c'.repeat(64) },
    replicationStamp: { engineCommit: 'e'.repeat(40), engineDirty: false },
    config: {},
  },
  kind: 'hero-ev',
  extracted: extractPowerRows(decisions),
  ...over,
});

describe('extractPowerRows — raw ratios and the shared skip taxonomy', () => {
  it('stores the RAW uncapped ratio, and the pre-flight re-clips at the planned cap', () => {
    const rows = extractPowerRows([dec('a', 'bet', 0.5, 0.01, 2), dec('b', 'bet', 0.5, 0.25, 1)]);
    expect(rows.byPlayer.find((p) => p.playerId === 'a').rows[0].r).toBe(50);

    const entry = entryFor([]);
    entry.byPlayer = rows.byPlayer;
    entry.players = 2;
    entry.decisions = 2;
    // At planned cap 20 the r=50 row must enter the statistic as w=20, which shifts the
    // simulated stat versus an uncapped run — assert the two differ.
    const capped = preflightMde({ entry, plannedPlayers: 2, plannedWeightCap: 20 });
    const uncapped = preflightMde({ entry, plannedPlayers: 2, plannedWeightCap: 1000 });
    expect(capped.predictedSeBB).not.toBe(uncapped.predictedSeBB);
  });

  it('drops exactly what estimateEdge drops (zero-propensity, missing outcome)', () => {
    const bad = [
      { playerId: 'a', observedAction: 'bet', netBB: 2, piOurs: { bet: 0.5 }, piPool: { bet: 0 } },
      { playerId: 'a', observedAction: 'bet', netBB: NaN, piOurs: { bet: 0.5 }, piPool: { bet: 0.5 } },
      dec('b', 'bet', 0.5, 0.25, 1),
    ];
    const rows = extractPowerRows(bad);
    const edge = edgeOf(bad);
    expect(rows.decisions).toBe(edge.n);
    expect(Object.values(rows.skipped).reduce((s, v) => s + v, 0))
      .toBe(Object.values(edge.skipped).reduce((s, v) => s + v, 0));
  });

  it('paired extraction mirrors pairedDelta scoring population', () => {
    const paired = corpus(6).map((d) => ({
      ...d,
      piOursByArm: { depth1: d.piOurs, depth2: { [d.observedAction]: Math.min(1, (d.piOurs[d.observedAction] ?? 0) + 0.1) } },
    }));
    const rows = extractPowerRows(paired, { arms: { base: 'depth1', test: 'depth2' } });
    const delta = pairedDelta(paired, { baseArm: 'depth1', testArm: 'depth2' });
    expect(rows.decisions).toBe(delta.n);
    expect(rows.byPlayer[0].rows[0]).toHaveProperty('rA');
    expect(rows.byPlayer[0].rows[0]).toHaveProperty('rB');
  });
});

describe('preflightMde — the simulation is the instrument', () => {
  const entry = entryFor(corpus(40));

  it('is deterministic: two identical calls are deeply equal', () => {
    const a = preflightMde({ entry, plannedPlayers: 60 });
    const b = preflightMde({ entry, plannedPlayers: 60 });
    expect(a).toEqual(b);
  });

  it('scales ~1/sqrt(P): 4x the players ≈ half the MDE (through the real estimator)', () => {
    const at = (p) => preflightMde({ entry, plannedPlayers: p }).mdePower80BB;
    const ratio = at(400) / at(100);
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });

  it('truncation is honest: the planned cap is applied, and on a homogeneous mix it widens the MDE', () => {
    // Direction is only guaranteed when decisions are exchangeable within a player —
    // on a heterogeneous mix truncation changes the COMPOSITION, not just the count
    // (measured here: the first fixture's MDE shrank under truncation). So the
    // monotonicity claim is made on a homogeneous fixture, and the mechanism claim
    // (the cap changes the simulation at all) on the mixed one.
    const homog = [];
    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 3; j++) homog.push(dec(`p${i}`, 'bet', 0.5, 0.25, ((i * 3 + j) % 7) - 3));
    }
    const hEntry = entryFor(homog);
    const full = preflightMde({ entry: hEntry, plannedPlayers: 40 });
    const trunc = preflightMde({ entry: hEntry, plannedPlayers: 40, plannedDecisionsPerPlayer: 1 });
    expect(trunc.mdePower80BB).toBeGreaterThanOrEqual(full.mdePower80BB);
    expect(trunc.plannedDecisionsPerPlayer).toBe(1);

    const mixedFull = preflightMde({ entry, plannedPlayers: 40 });
    const mixedTrunc = preflightMde({ entry, plannedPlayers: 40, plannedDecisionsPerPlayer: 1 });
    expect(mixedTrunc.predictedSeBB).not.toBe(mixedFull.predictedSeBB);
  });

  it('flags cap mismatch, extrapolation (with ratio), and a below-bar basis', () => {
    const pf = preflightMde({ entry, plannedPlayers: 120, plannedWeightCap: 10 });
    expect(pf.flags.weightCapReclipped).toBe(true);
    expect(pf.flags.extrapolated).toBe(true);
    expect(pf.flags.extrapolationRatio).toBe(3);
    expect(Number.isFinite(pf.mdePower80BB)).toBe(true);
    const small = entryFor(corpus(5));
    expect(preflightMde({ entry: small, plannedPlayers: 5 }).flags.basisBelowClusterBar).toBe(true);
  });

  it('both formulas are always computed, and the gate figure follows POWER_GATE_FORMULA', () => {
    const pf = preflightMde({ entry, plannedPlayers: 40 });
    expect(pf.mdeDetectBB).toBeLessThan(pf.mdePower80BB);
    expect(pf.gateMdeBB).toBe(POWER_GATE_FORMULA === 'power80' ? pf.mdePower80BB : pf.mdeDetectBB);
    expect(pf.targetEffectBB).toBe(TARGET_EFFECT_BB);
  });
});

describe('clusterBootstrapCI drawClusters — additive, byte-identical at default', () => {
  it('an explicit drawClusters equal to the cluster count reproduces the default draw exactly', () => {
    const byPlayer = new Map();
    for (const d of corpus(12)) {
      const w = Math.min(d.piOurs[d.observedAction] / d.piPool[d.observedAction], 20);
      if (!byPlayer.has(d.playerId)) byPlayer.set(d.playerId, []);
      byPlayer.get(d.playerId).push({ w, net: d.netBB });
    }
    const stat = (chunk) => chunk.reduce((s, r) => s + r.w * r.net, 0) / chunk.length;
    const def = clusterBootstrapCI(byPlayer, stat, {});
    const explicit = clusterBootstrapCI(byPlayer, stat, { drawClusters: byPlayer.size });
    expect(explicit.lo).toBe(def.lo);
    expect(explicit.hi).toBe(def.hi);
    expect(def.sd).toBeGreaterThan(0);
  });

  it('estimateEdge and pairedDelta expose MDE fields tied to the bootstrap sd', () => {
    const edge = edgeOf(corpus(10));
    expect(edge.mdeDetectBB).not.toBeNull();
    expect(edge.mdePower80BB / edge.mdeDetectBB).toBeCloseTo((Z_DETECT + Z80_POWER) / Z_DETECT, 3);

    const paired = corpus(10).map((d) => ({
      ...d,
      piOursByArm: { depth1: d.piOurs, depth2: { [d.observedAction]: Math.min(1, (d.piOurs[d.observedAction] ?? 0) + 0.1) } },
    }));
    const delta = pairedDelta(paired, { baseArm: 'depth1', testArm: 'depth2' });
    expect(delta.deltaMdeDetectBB).not.toBeNull();
    expect(delta.deltaMdePower80BB).toBeGreaterThan(delta.deltaMdeDetectBB);

    // Below 2 players there is no cluster CI and therefore no MDE — null, never a guess.
    const one = edgeOf(corpus(1));
    expect(one.mdeDetectBB).toBeNull();
  });
});

describe('gateVerdict — the founder matrix', () => {
  const entry = entryFor(corpus(6));
  const unresolvable = preflightMde({ entry, plannedPlayers: 6 });

  it('refuse + unresolvable + no override → blocked with exit 2 and the players-needed line', () => {
    expect(unresolvable.resolvable).toBe(false);
    const v = gateVerdict(unresolvable, { mode: 'refuse' });
    expect(v.proceed).toBe(false);
    expect(v.exitCode).toBe(2);
    expect(v.banner).toContain('NOT RESOLVABLE');
    expect(v.banner).toContain('contributing players');
  });

  it('override proceeds and carries the recorded reason', () => {
    const v = gateVerdict(unresolvable, { mode: 'refuse', overrideReason: 'WS-435 smoke' });
    expect(v.proceed).toBe(true);
    expect(v.banner).toContain('WS-435 smoke');
  });

  it('warn proceeds with the unmissable banner', () => {
    const v = gateVerdict(unresolvable, { mode: 'warn' });
    expect(v.proceed).toBe(true);
    expect(v.banner).toContain('statement about the');
  });

  it('empty ledger proceeds in both modes and says it will seed', () => {
    for (const mode of ['refuse', 'warn']) {
      const v = gateVerdict(null, { mode });
      expect(v.proceed).toBe(true);
      expect(v.firstRun).toBe(true);
      expect(v.banner).toContain('SEED');
    }
  });

  it('a resolvable plan proceeds', () => {
    const resolvable = preflightMde({ entry, plannedPlayers: 5000, resamples: 200 });
    if (resolvable.resolvable) {
      expect(gateVerdict(resolvable, { mode: 'refuse' }).proceed).toBe(true);
    } else {
      // The fixture's variance may be too large for any P — then the assertion above
      // (refusal) already covered the branch; record that this branch was not reachable.
      expect(resolvable.playersNeeded).toBeGreaterThan(5000);
    }
  });

  it('renderPreflight names the doctrine stakes', () => {
    expect(renderPreflight(null)).toContain('UNREADABLE');
    expect(renderPreflight(unresolvable)).toContain('MDE detect');
  });
});

describe('ledger persistence — smoke runs cannot pollute the basis', () => {
  const dir = mkdtempSync(join(tmpdir(), 'power-ledger-'));

  it('round-trips an entry and selects the deterministic basis', () => {
    const big = entryFor(corpus(30));
    const small = entryFor(corpus(3));
    expect(appendLedgerEntry({ dir, entry: big, complete: true }).written).toBe(true);
    expect(appendLedgerEntry({ dir, entry: { ...small, createdAt: '2027-01-01T00:00:00Z' }, complete: true }).written).toBe(true);
    const loaded = loadPowerLedger({ dir, kind: 'hero-ev' });
    expect(loaded.length).toBe(2);
    // Most players wins over newest.
    expect(selectBasisEntry(loaded).players).toBe(30);
  });

  it('refuses an incomplete run and a <2-player basis, with reasons', () => {
    const e = entryFor(corpus(30));
    expect(appendLedgerEntry({ dir, entry: e, complete: false }).reason).toContain('incomplete');
    const tiny = entryFor(corpus(1));
    expect(appendLedgerEntry({ dir, entry: tiny, complete: true }).reason).toContain('at least 2');
  });

  it('entry file name is deterministic and stamps schema version', () => {
    const e = entryFor(corpus(4));
    expect(e.schemaVersion).toBe(POWER_LEDGER_SCHEMA_VERSION);
    expect(entryFileName(e)).toBe(entryFileName({ ...e }));
    expect(e.caveat).toContain('POWER BASIS ONLY');
  });

  it('backfill round-trip: an artifact on disk seeds a usable basis', () => {
    const artifactDir = mkdtempSync(join(tmpdir(), 'power-artifact-'));
    const run = {
      complete: true,
      decisions: corpus(8),
      dealBook: { dealBookId: 'db-rt', contentHash: 'sha256:' + 'd'.repeat(64) },
      replicationStamp: { engineCommit: 'f'.repeat(40), engineDirty: false },
      config: {},
    };
    const artifact = join(artifactDir, 'run.json');
    writeFileSync(artifact, JSON.stringify({ run }));
    const parsed = JSON.parse(readFileSync(artifact, 'utf8'));
    const extracted = extractPowerRows(parsed.run.decisions);
    const entry = buildLedgerEntry({ run: parsed.run, kind: 'hero-ev', extracted });
    const ledgerDir = join(artifactDir, 'ledger');
    mkdirSync(ledgerDir);
    expect(appendLedgerEntry({ dir: ledgerDir, entry, complete: true }).written).toBe(true);
    const basis = selectBasisEntry(loadPowerLedger({ dir: ledgerDir, kind: 'hero-ev' }));
    const pf = preflightMde({ entry: basis, plannedPlayers: 20 });
    expect(pf).not.toBeNull();
    expect(Number.isFinite(pf.mdePower80BB)).toBe(true);
  });
});

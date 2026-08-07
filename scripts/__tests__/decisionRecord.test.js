/**
 * decisionRecord.test.js — WS-393.
 *
 * What these assert is not "the fields are there". It is the RULE the module exists for:
 * a run that costs hours must leave a record whose shape admits questions nobody asked
 * when it was designed, and nothing that costs hours may be pre-aggregated at write time.
 * A test that only checked field presence would pass against a writer that stored
 * `contribution: w * R` and dropped `w` and `R` — which is precisely the failure.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DECISION_RECORD_SCHEMA_VERSION,
  cardLabel, comboLabel, comboClass,
  compactCandidate, compactLatency, compactHeroTruth,
  openDecisionSink,
} from '../backtest/decisionRecord.mjs';
import { parseAndEncode } from '../../src/utils/pokerCore/cardParser.js';

describe('card labelling — the handle a human actually browses by', () => {
  it('round-trips every card through the app encoding', () => {
    for (const s of ['A♠', 'K♥', '2♦', 'T♣', '7♠']) {
      expect(cardLabel(parseAndEncode(s))).toBe(s);
    }
  });

  it('refuses to invent a label for a non-card', () => {
    expect(cardLabel(-1)).toBeNull();
    expect(cardLabel(52)).toBeNull();
    expect(cardLabel(undefined)).toBeNull();
  });

  it('names the specific holding AND the 169-cell class it pools into', () => {
    const as = parseAndEncode('A♠');
    const kd = parseAndEncode('K♦');
    const ks = parseAndEncode('K♠');
    const ah = parseAndEncode('A♥');
    expect(comboLabel(as, kd)).toBe('A♠K♦');
    expect(comboClass(as, kd)).toBe('AKo');
    expect(comboClass(as, ks)).toBe('AKs');
    expect(comboClass(as, ah)).toBe('AA');
  });

  it('orders the class high card first regardless of argument order', () => {
    const seven = parseAndEncode('7♣');
    const queen = parseAndEncode('Q♣');
    expect(comboClass(seven, queen)).toBe('Q7s');
    expect(comboClass(queen, seven)).toBe('Q7s');
  });
});

describe('compactCandidate — the near-ties are the point', () => {
  const rec = {
    action: 'bet',
    ev: 3.88,
    sizing: { betFraction: 0.5 },
    depth: 2,
    blockerScore: -0.01,
    reasoning: 'x'.repeat(4000),
    handPlan: { text: 'y'.repeat(4000) },
    villainResponse: {
      fold: { pct: 0.41, ev: 3 },
      call: { pct: 0.44, ev: -0.68, heroResponse: null },
    },
  };

  it('keeps the EV, the sizing and the depth that produced it', () => {
    const c = compactCandidate(rec);
    expect(c.ev).toBe(3.88);
    expect(c.action).toBe('bet');
    expect(c.depth).toBe(2);
    expect(c.sizing).toEqual({ betFraction: 0.5 });
  });

  it('keeps every villain response branch as pct AND ev, never as a blend', () => {
    const c = compactCandidate(rec);
    expect(c.villainResponse.fold).toEqual({ pct: 0.41, ev: 3, heroResponse: null });
    expect(c.villainResponse.call.ev).toBe(-0.68);
  });

  it('drops the generated prose — the one place this record is deliberately lossy', () => {
    const c = compactCandidate(rec);
    expect(c.reasoning).toBeUndefined();
    expect(c.handPlan).toBeUndefined();
    expect(JSON.stringify(c).length).toBeLessThan(600);
  });
});

describe('compactLatency — reproducibility forensics survive the run', () => {
  it('keeps the fact that the wall clock, not the model, decided the depth', () => {
    const l = compactLatency({
      phase: 'refined', totalMs: 3379, budgetMs: 2000, preRefinementMs: 394,
      overBudget: true, budgetSkipped: ['depth3Barrel'], ranStages: ['betCallDepth2'],
      errored: [], noCandidate: ['callDepth2'], incomplete: [],
    });
    expect(l.overBudget).toBe(true);
    expect(l.budgetSkipped).toEqual(['depth3Barrel']);
    expect(l.ranStages).toEqual(['betCallDepth2']);
    // WS-356: a stage the gate admitted and whose body threw must stay distinguishable
    // from one that ran. Collapsing them is how WS-334 hid.
    expect(l.errored).toEqual([]);
    expect(l.noCandidate).toEqual(['callDepth2']);
  });

  it('returns null rather than a shape full of nulls when there was no ledger', () => {
    expect(compactLatency(null)).toBeNull();
  });
});

describe('compactHeroTruth — the selection is stored, not assumed', () => {
  it('says truth is unavailable rather than pretending nothing was shown', () => {
    const t = compactHeroTruth(null);
    expect(t.truthAvailable).toBe(false);
    expect(t.reason).toBe('not-revealed');
  });

  it('carries the refusal reason when the range was narrowed hypothetically', () => {
    const t = compactHeroTruth({ refused: true, reason: 'hypothesized', revealed: [51, 47] });
    expect(t.truthAvailable).toBe(false);
    expect(t.reason).toBe('hypothesized');
  });

  it('labels the revealed holding at both grains and keeps the coverage score', () => {
    const as = parseAndEncode('A♠');
    const kd = parseAndEncode('K♦');
    const t = compactHeroTruth({
      refused: false, revealed: [as, kd], revealedAt: { street: 'river', order: 12 },
      logLift: 0.4, covered: true,
    });
    expect(t.truthAvailable).toBe(true);
    expect(t.comboLabel).toBe('A♠K♦');
    expect(t.comboClass).toBe('AKo');
    expect(t.coverage).toEqual({ logLift: 0.4, covered: true });
  });
});

describe('openDecisionSink — a killed run keeps every line it wrote', () => {
  const sinkPath = () => join(mkdtempSync(join(tmpdir(), 'decrec-')), 'decisions.jsonl');

  it('writes a self-describing meta line first, then one line per decision, then a summary', () => {
    const p = sinkPath();
    const sink = openDecisionSink(p, { run: 'hero-ev', dealBookId: 'db-1' });
    sink.write({ playerId: 'a', netBB: 1 });
    sink.write({ playerId: 'b', netBB: -2 });
    const ref = sink.close();

    const lines = readFileSync(p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines).toHaveLength(4);
    expect(lines[0].kind).toBe('meta');
    expect(lines[0].schemaVersion).toBe(DECISION_RECORD_SCHEMA_VERSION);
    expect(lines[0].dealBookId).toBe('db-1');
    expect(lines[1]).toMatchObject({ kind: 'decision', playerId: 'a' });
    expect(lines[2]).toMatchObject({ kind: 'decision', playerId: 'b' });
    // v2 (WS-431): close appends a summary carrying the by-hash reference the Result
    // Card uses — never the path.
    expect(lines[3]).toMatchObject({ kind: 'summary', rowCount: 2 });
    expect(lines[3].contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(ref).toMatchObject({ rowCount: 2, contentHash: lines[3].contentHash });
    expect(sink.count).toBe(2);
  });

  it('closes with an identical contentHash when the same rows arrive in a different order', () => {
    // Defect A (WS-431): under the worker pool, rows hit disk in COMPLETION order. The
    // hash is over canonicalized rows — sorted by stable(p,k,d) — so worker timing
    // cannot reach the reference a Result Card carries.
    const rows = [
      { playerId: 'a', stable: { p: 0, k: 0, d: 0 }, netBB: 1 },
      { playerId: 'a', stable: { p: 0, k: 0, d: 1 }, netBB: -2 },
      { playerId: 'b', stable: { p: 1, k: 0, d: 0 }, netBB: 9 },
    ];
    const meta = { run: 'hero-ev', dealBookId: 'db-1' };

    const p1 = sinkPath();
    const s1 = openDecisionSink(p1, meta);
    for (const r of rows) s1.write(r);
    const ref1 = s1.close();

    const p2 = sinkPath();
    const s2 = openDecisionSink(p2, meta);
    for (const r of [rows[2], rows[0], rows[1]]) s2.write(r);
    const ref2 = s2.close();

    expect(ref1.contentHash).toMatch(/^sha256:/);
    expect(ref2.contentHash).toBe(ref1.contentHash);
    expect(ref2.rowCount).toBe(ref1.rowCount);
  });

  it('states that a truncated file is a biased subsample of PLAYERS', () => {
    const p = sinkPath();
    const sink = openDecisionSink(p, {});
    sink.close();
    const meta = JSON.parse(readFileSync(p, 'utf8').trim().split('\n')[0]);
    expect(meta.caveat).toMatch(/sequential/i);
    expect(meta.caveat).toMatch(/biased subsample/i);
  });

  it('has every written line readable before close — an interrupted run loses nothing', () => {
    const p = sinkPath();
    const sink = openDecisionSink(p, {});
    sink.write({ playerId: 'a' });
    // Deliberately NOT closed: this is the SIGINT case. A buffered stream would have
    // nothing on disk here, which is the whole reason this uses writeSync.
    const lines = readFileSync(p, 'utf8').trim().split('\n');
    expect(lines).toHaveLength(2);
    sink.close();
  });
});

/**
 * decisionContextSet.test.js — WS-540 Phase 1.
 *
 * The cases here are chosen because each one FAILS SILENTLY in production if it regresses:
 * a JSON-serialised range comes back as a plain object and every rule that reads it stops
 * firing; a truncated set scores fewer decisions and reports a smaller edge; an arm reading
 * a field the set does not carry gets `undefined` and its rule "buys nothing". None of
 * those raise on their own, and all three produce a number that looks like a finding.
 */

import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  encodeRange, decodeRange, encodeHolding, decodeHolding,
  buildDecisionContext, encodeDecisionContext, decodeDecisionContext,
  decisionContextRowHash, openContextSetWriter, readContextSet,
  restoreDecisionContext, assertRangeRecovery, RANGE_CELLS,
} from '../backtest/decisionContextSet.mjs';

const aRange = (seed = 1) => {
  const r = new Float64Array(RANGE_CELLS);
  for (let i = 0; i < RANGE_CELLS; i++) r[i] = ((i * 7 + seed) % 13) / 13;
  return r;
};

const aRow = (over = {}) => buildDecisionContext({
  stable: { p: 0, k: 0, d: 1 },
  playerId: 'p1',
  handId: 'h1',
  order: 3,
  hand: { seatPlayers: { 1: 'p1' }, gameState: { dealerButtonSeat: 2 } },
  holding: { range: aRange(), provenance: { seedSource: 'rangeProfile' }, truth: null },
  board: [1, 2, 3],
  handIdx: 0,
  street: 'flop',
  heroSeat: 1,
  buttonSeat: 2,
  opponentSeat: 3,
  facingAction: 'bet',
  isAgg: false,
  isIP: true,
  texture: 'dry',
  posCategory: 'IP',
  situationKey: null,
  contextAction: 'call',
  rangeEquityPct: 55,
  segmentation: null,
  observedAction: 'call',
  observedAmount: 10,
  geometry: { spr: 4, sprBand: 'medium', closesAction: true, sBucket: '33-66' },
  sizeBucket: '33-66',
  netBB: 1.5,
  netBBUnraked: 1.6,
  wentToShowdown: true,
  pool: { actions: { call: 0.5, fold: 0.5 }, evidenceN: 20 },
  decisionSeed: 42,
  playersInPot: 2,
  ...over,
});

describe('range codec', () => {
  it('round-trips a Float64Array bit-exactly and returns a typed array, not an object', () => {
    const r = aRange(3);
    const back = decodeRange(encodeRange(r));
    expect(back).toBeInstanceOf(Float64Array);
    expect(Array.from(back)).toEqual(Array.from(r));
  });

  it('round-trips a VIEW onto a larger buffer — byteOffset must not be ignored', () => {
    // The failure this pins: Buffer.from(view.buffer) encodes the whole backing store, so
    // the decode comes back shifted and every range cell is silently wrong.
    const backing = new Float64Array(RANGE_CELLS * 3);
    const src = aRange(5);
    backing.set(src, RANGE_CELLS); // a view starting one range in
    const view = backing.subarray(RANGE_CELLS, RANGE_CELLS * 2);
    expect(view.byteOffset).toBeGreaterThan(0);
    expect(Array.from(decodeRange(encodeRange(view)))).toEqual(Array.from(src));
  });

  it('preserves values JSON would mangle', () => {
    const r = new Float64Array(RANGE_CELLS);
    r[0] = 0.1 + 0.2;           // 0.30000000000000004
    r[1] = Number.MIN_VALUE;
    r[2] = 1 / 3;
    const back = decodeRange(encodeRange(r));
    expect(back[0]).toBe(0.1 + 0.2);
    expect(back[1]).toBe(Number.MIN_VALUE);
    expect(back[2]).toBe(1 / 3);
  });

  it('refuses a buffer that is not RANGE_CELLS wide', () => {
    const short = Buffer.from(new Float64Array(4).buffer).toString('base64');
    expect(() => decodeRange(short)).toThrow(/expected 169 cells/);
  });

  it('passes null through both ways', () => {
    expect(encodeRange(null)).toBeNull();
    expect(decodeRange(null)).toBeNull();
    expect(encodeHolding(null)).toBeNull();
    expect(decodeHolding(null)).toBeNull();
  });

  it('drops truth on encode — a replay must ask for it explicitly', () => {
    const enc = encodeHolding({ range: aRange(), provenance: {}, truth: { revealed: 'AhKd' } });
    expect(enc.truth).toBeUndefined();
    expect(decodeHolding(enc).truth).toBeNull();
  });
});

describe('row encoding and identity', () => {
  it('decode(encode(row)) restores the range as a Float64Array', () => {
    const row = aRow();
    const back = decodeDecisionContext(JSON.parse(JSON.stringify(encodeDecisionContext(row))));
    expect(back.holding.range).toBeInstanceOf(Float64Array);
    expect(Array.from(back.holding.range)).toEqual(Array.from(row.holding.range));
  });

  it('carries NOTHING an arm produced — that is what makes a later rung scorable', () => {
    const keys = Object.keys(aRow());
    for (const forbidden of ['piOursByArm', 'piOurs', 'evStatsByArm', 'combosByArm', 'wRawByArm', 'coverage']) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('row hash is stable across key order and sensitive to a changed cell', () => {
    const a = aRow();
    const b = aRow();
    expect(decisionContextRowHash(a)).toBe(decisionContextRowHash(b));
    const c = aRow();
    c.holding.range[7] += 1e-9;
    expect(decisionContextRowHash(c)).not.toBe(decisionContextRowHash(a));
  });
});

describe('writer / reader', () => {
  const withTmp = async (fn) => {
    const dir = mkdtempSync(join(tmpdir(), 'dcs-'));
    try { return await fn(join(dir, 'set.jsonl')); } finally { rmSync(dir, { recursive: true, force: true }); }
  };

  it('round-trips rows through disk and verifies the content hash', async () => {
    await withTmp(async (p) => {
      const w = await openContextSetWriter(p, { meta: { slice: 'test' } });
      await w.write(aRow({ handId: 'h1' }));
      await w.write(aRow({ handId: 'h2' }));
      const manifest = await w.close();
      expect(manifest.rows).toBe(2);

      const got = [];
      for await (const r of readContextSet(p)) got.push(r);
      expect(got.map((r) => r.handId)).toEqual(['h1', 'h2']);
      expect(got[0].holding.range).toBeInstanceOf(Float64Array);
    });
  });

  it('REFUSES a truncated set rather than scoring the rows it did get', async () => {
    await withTmp(async (p) => {
      const w = await openContextSetWriter(p);
      await w.write(aRow({ handId: 'h1' }));
      await w.write(aRow({ handId: 'h2' }));
      await w.close();

      const lines = readFileSync(p, 'utf8').split('\n').filter(Boolean);
      writeFileSync(p, `${lines[0]}\n`); // drop the second decision

      await expect((async () => {
        for await (const _ of readContextSet(p)) { /* drain */ }
      })()).rejects.toThrow(/content hash mismatch/);
    });
  });

  it('manifest identity excludes forensics — two identical productions agree', async () => {
    const hashes = [];
    for (const _ of [0, 1]) {
      // eslint-disable-next-line no-await-in-loop
      await withTmp(async (p) => {
        const w = await openContextSetWriter(p, { meta: { producedAt: String(Math.random()) } });
        await w.write(aRow());
        hashes.push((await w.close()).contentHash);
      });
    }
    expect(hashes[0]).toBe(hashes[1]);
  });
});

describe('replay ctx', () => {
  it('rebuilds rangeBefore from holding, and assertRangeRecovery agrees with a live ctx', () => {
    const row = aRow();
    const restored = restoreDecisionContext(row);
    const live = { rangeBefore: row.holding.range };
    const v = assertRangeRecovery(live, restored);
    expect(v.ok).toBe(true);
    expect(v.checked).toBe(RANGE_CELLS);
  });

  it('assertRangeRecovery FAILS on a divergence rather than reporting ok', () => {
    const row = aRow();
    const restored = restoreDecisionContext(row);
    const live = { rangeBefore: aRange(99) };
    const v = assertRangeRecovery(live, restored);
    expect(v.ok).toBe(false);
    expect(v.mismatches.length).toBeGreaterThan(0);
  });

  it('serves every field the shipped strategy-arm closure reads', () => {
    const ctx = restoreDecisionContext(aRow());
    for (const f of ['facingAction', 'street', 'texture', 'posCategory', 'isAgg', 'isIP',
      'contextAction', 'rangeBefore', 'board']) {
      expect(() => ctx[f]).not.toThrow();
    }
    expect(ctx.rangeBefore).toBeInstanceOf(Float64Array);
  });

  it('THROWS on a field the set does not carry, instead of returning undefined', () => {
    // The regression this pins: an arm widening its ctx reads gets `undefined`, its rule
    // never fires, and the ladder reports "this rule bought nothing" — a wrong answer in
    // the shape of a finding.
    const ctx = restoreDecisionContext(aRow());
    expect(() => ctx.someFutureAxis).toThrow(/does not carry/);
  });

  it('THROWS on an `in` probe too, closing the back door', () => {
    const ctx = restoreDecisionContext(aRow());
    expect(() => ('someFutureAxis' in ctx)).toThrow(/does not carry/);
  });

  it('strict:false opts out for callers that need a plain object', () => {
    const ctx = restoreDecisionContext(aRow(), { strict: false });
    expect(ctx.someFutureAxis).toBeUndefined();
  });
});

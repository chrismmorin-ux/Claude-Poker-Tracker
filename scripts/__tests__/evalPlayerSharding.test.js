/**
 * WS-512 / WS-293 — the eval pool is scored whole, with only part of it resident.
 *
 * The defect: `indexEvalPlayers` materialised every hand of every eval player into one Map
 * before scoring a single decision, and its only two memory controls (`maxPlayers`,
 * `maxHandsPerPlayer`) both default to Infinity. The WS-293 compute job passed neither, so it
 * died on `JavaScript heap out of memory` twice with retries exhausted.
 *
 * Measured on G16 2026-08-17: 1,300 players held a 3.16 GB peak across 1,070,493 hands, while
 * the unbounded cm-node1 run died at the 12 GB ceiling on ~250k hands. A quarter the hands,
 * four times the memory — peak tracks PLAYER COUNT, not hands read. Raising the ceiling
 * cannot work: cm-node1 has 15.8 GB total and ~10.1 GB free.
 *
 * The property that makes sharding legitimate rather than a sample reduction is that the
 * shards PARTITION the pool — every player lands in exactly one — and that the answer does
 * not depend on how many shards were used. Both are asserted here.
 */
import { describe, it, expect } from 'vitest';
import { shardOf } from '../backtest/runner.mjs';
import { partitionOf, GROUPS } from '../backtest/partition.mjs';
import { mkStat, push, summarize, total } from '../backtest/rangeCalibrationProbe.mjs';

const PLAYERS = Array.from({ length: 4000 }, (_, i) => `player-${i}`);

describe('shardOf partitions the pool', () => {
  it('puts every player in exactly one shard, and inside range', () => {
    for (const shards of [1, 2, 5, 12, 23]) {
      const counts = new Array(shards).fill(0);
      for (const p of PLAYERS) {
        const s = shardOf(p, shards);
        expect(Number.isInteger(s)).toBe(true);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThan(shards);
        counts[s]++;
      }
      expect(counts.reduce((a, b) => a + b, 0)).toBe(PLAYERS.length);
    }
  });

  it('is deterministic — the same player always lands in the same shard', () => {
    for (const p of PLAYERS.slice(0, 200)) {
      expect(shardOf(p, 12)).toBe(shardOf(p, 12));
    }
  });

  it('is independent of the POOL/EVAL partition', () => {
    // Both hash the same pseudonym. An UNSALTED shard key would correlate with `partitionOf`
    // and could hand a shard nothing but POOL players — the pool would look smaller than it
    // is, which is exactly the sample reduction sharding must not cause.
    const shards = 8;
    const evalPerShard = new Array(shards).fill(0);
    for (const p of PLAYERS) {
      if (partitionOf(p, 50) === GROUPS.EVAL) evalPerShard[shardOf(p, shards)]++;
    }
    for (const n of evalPerShard) expect(n).toBeGreaterThan(0);
    // No shard should hold a wildly disproportionate slice of the eval half.
    const mean = evalPerShard.reduce((a, b) => a + b, 0) / shards;
    for (const n of evalPerShard) expect(Math.abs(n - mean) / mean).toBeLessThan(0.35);
  });

  it('collapses to a single shard when shards <= 1', () => {
    for (const p of PLAYERS.slice(0, 50)) expect(shardOf(p, 1)).toBe(0);
  });
});

describe('the accumulator is order-independent', () => {
  /**
   * Sharding changes the order decisions are accumulated in. With plain `+=` that moved 99
   * figures at a max relative difference of 5.4e-14 between a 1-shard and a 5-shard run whose
   * every count and verdict matched. Nothing could flip on 5e-14, but the instrument's
   * replication stamp claims true bit-reproducibility, and a claim true only up to
   * accumulation order is not that claim.
   */
  const sample = (i) => ({
    covered: i % 3 !== 0,
    retained: 0.1 + ((i * 7) % 50) / 100,
    p: 0.001 + ((i * 13) % 900) / 1000,
    u: 0.002 + ((i * 29) % 800) / 1000,
  });

  const accumulate = (order) => {
    const s = mkStat();
    for (const i of order) push(s, sample(i));
    return s;
  };

  it('gives the same summary however the decisions are ordered', () => {
    const forward = [...Array(5000).keys()];
    const reversed = [...forward].reverse();
    // Interleaved is the shape sharding actually produces: shard 0's players, then shard 1's.
    const sharded = [];
    for (let s = 0; s < 7; s++) for (const i of forward) if (i % 7 === s) sharded.push(i);

    const a = summarize(accumulate(forward));
    const b = summarize(accumulate(reversed));
    const c = summarize(accumulate(sharded));

    expect(b).toEqual(a);
    expect(c).toEqual(a);
    // Exact, not approximate — this is the whole point of the compensation.
    expect(c.deltaLogVsUniform).toBe(a.deltaLogVsUniform);
    expect(c.retainedFraction).toBe(a.retainedFraction);
  });

  it('still sums correctly — compensation must not change the value, only its stability', () => {
    const s = mkStat();
    for (let i = 0; i < 100; i++) push(s, { covered: true, retained: 0.5, p: 0.5, u: 0.5 });
    expect(s.n).toBe(100);
    expect(s.covered).toBe(100);
    expect(total(s, 'retainedSum')).toBeCloseTo(50, 10);
    // log(0.5) - log(0.5) = 0 for every decision.
    expect(summarize(s).deltaLogVsUniform).toBeCloseTo(0, 12);
  });

  it('carries a compensation term that is actually used', () => {
    // A large running total plus many tiny terms is where plain `+=` loses bits.
    const s = mkStat();
    push(s, { covered: false, retained: 1e8, p: 0.5, u: 0.5 });
    for (let i = 0; i < 10000; i++) push(s, { covered: false, retained: 1e-8, p: 0.5, u: 0.5 });
    // Naive summation loses the tail entirely; compensated keeps it.
    expect(total(s, 'retainedSum') - 1e8).toBeGreaterThan(0);
  });
});

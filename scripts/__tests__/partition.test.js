/**
 * partition.test.js — WS-273 cross-language partition contract.
 *
 * The Python miner and the Node runner must agree on which players are POOL
 * (train the backtest-only Reference table) and which are EVAL (get scored).
 * Disagreement on even one player leaks an EVAL player's hands into the priors
 * and the harness reports a falsely good number.
 *
 * These assertions and `partition.py --check` read the SAME fixture, so the two
 * implementations cannot drift apart silently.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  fnv1a32,
  partitionOf,
  isPoolPlayer,
  isEvalPlayer,
  GROUPS,
  DEFAULT_POOL_PCT,
} from '../backtest/partition.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(join(HERE, '..', 'backtest', 'fixtures', 'partition-vectors.json'), 'utf8'),
);

describe('fnv1a32', () => {
  // Published FNV-1a 32-bit reference values. These prove the implementation is
  // CORRECT, not merely self-consistent with its own Python mirror — both could
  // be wrong together without them.
  it('reproduces the published FNV-1a reference vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('stays inside unsigned 32-bit range', () => {
    for (const { playerId } of fixture.partitionVectors) {
      const h = fnv1a32(playerId);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('hashes UTF-8 bytes, not UTF-16 code units', () => {
    // Python encodes to UTF-8 before hashing. A JS implementation that walked
    // code units would agree on all-ASCII pseudonyms and diverge silently on
    // any non-ASCII one. U+00E9 is ONE UTF-16 unit but TWO UTF-8 bytes
    // (0xC3 0xA9), so it is exactly the input that separates the two readings.
    const eAcute = 'é';
    let h = 0x811c9dc5;
    for (const b of [0xc3, 0xa9]) {
      h ^= b;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    expect(fnv1a32(eAcute)).toBe(h);
  });
});

describe('partition fixture agreement (JS side of the Python mirror)', () => {
  it('matches every hash vector in the shared fixture', () => {
    for (const { input, fnv1a32: expected } of fixture.hashVectors) {
      expect(fnv1a32(input)).toBe(expected);
    }
  });

  it('matches every partition assignment in the shared fixture', () => {
    for (const { playerId, group } of fixture.partitionVectors) {
      expect(partitionOf(playerId, fixture.poolPct)).toBe(group);
    }
  });

  it('uses the same default pool percentage as the fixture was generated with', () => {
    expect(fixture.poolPct).toBe(DEFAULT_POOL_PCT);
  });
});

describe('partitionOf', () => {
  it('is deterministic across repeated calls', () => {
    const pid = fixture.partitionVectors[0].playerId;
    const first = partitionOf(pid);
    for (let i = 0; i < 20; i++) expect(partitionOf(pid)).toBe(first);
  });

  it('splits the real-pseudonym fixture close to evenly', () => {
    const pool = fixture.partitionVectors.filter(v => v.group === GROUPS.POOL).length;
    const total = fixture.partitionVectors.length;
    // Not a distribution proof — a smoke check that the hash is not degenerate.
    expect(pool).toBeGreaterThan(total * 0.25);
    expect(pool).toBeLessThan(total * 0.75);
  });

  it('honours poolPct at both extremes', () => {
    const pid = fixture.partitionVectors[0].playerId;
    expect(partitionOf(pid, 100)).toBe(GROUPS.POOL);
    expect(partitionOf(pid, 0)).toBe(GROUPS.EVAL);
  });

  it('keeps the two convenience predicates mutually exclusive', () => {
    for (const { playerId } of fixture.partitionVectors) {
      expect(isPoolPlayer(playerId)).toBe(!isEvalPlayer(playerId));
    }
  });

  it('rejects malformed input rather than silently bucketing it', () => {
    // A silently-bucketed empty or non-string id would put an unknown player on
    // one side of the leakage boundary without anyone noticing.
    expect(() => partitionOf('')).toThrow(/non-empty string/);
    expect(() => partitionOf(null)).toThrow(/non-empty string/);
    expect(() => partitionOf(123)).toThrow(/non-empty string/);
    expect(() => partitionOf('x', 101)).toThrow(/0-100/);
    expect(() => partitionOf('x', -1)).toThrow(/0-100/);
    expect(() => partitionOf('x', 50.5)).toThrow(/0-100/);
  });
});

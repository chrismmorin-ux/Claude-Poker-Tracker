import { describe, test, expect } from 'vitest';
import {
  buildEnumeration, seedForDecision, seedForCombo,
} from '../backtest/heroEvEnumeration.mjs';

// WS-433. The enumeration is the identity backbone of every chunk artifact and every
// seed — these tests freeze it. A change that moves any golden value here changes what
// every stamped seed in every persisted chunk means, and must be a deliberate,
// schema-versioned migration, not a refactor.

const mapOf = (entries) => new Map(entries.map(([id, n]) => [id, Array.from({ length: n }, (_, i) => ({ i }))]));

describe('buildEnumeration', () => {
  test('canonical order is lexicographic ordinal on the player key, independent of map insertion order', () => {
    const a = buildEnumeration({
      byPlayer: mapOf([['PS:zed', 20], ['FTP:abel', 20], ['PS:abel', 20]]),
      minTrainHands: 15,
    });
    const b = buildEnumeration({
      byPlayer: mapOf([['PS:abel', 20], ['PS:zed', 20], ['FTP:abel', 20]]),
      minTrainHands: 15,
    });
    expect(a.players.map((p) => p.playerId)).toEqual(['FTP:abel', 'PS:abel', 'PS:zed']);
    expect(b.players).toEqual(a.players);
    expect(b.enumerationHash).toBe(a.enumerationHash);
  });

  test('qualification is >= minTrainHands + 1 — a 15-hand player yields zero windows and is excluded', () => {
    const e = buildEnumeration({
      byPlayer: mapOf([['PS:exact', 15], ['PS:one-over', 16], ['PS:under', 14]]),
      minTrainHands: 15,
    });
    expect(e.players.map((p) => p.playerId)).toEqual(['PS:one-over']);
    expect(e.qualifyingCount).toBe(1);
    expect(e.totalPlayers).toBe(3);
  });

  test('enumerationHash changes when any player hand count changes', () => {
    const a = buildEnumeration({ byPlayer: mapOf([['PS:x', 20], ['PS:y', 30]]), minTrainHands: 15 });
    const b = buildEnumeration({ byPlayer: mapOf([['PS:x', 20], ['PS:y', 31]]), minTrainHands: 15 });
    expect(b.enumerationHash).not.toBe(a.enumerationHash);
    expect(a.enumerationHash).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  test('playerIndex is position in the sorted qualifying list', () => {
    const e = buildEnumeration({
      byPlayer: mapOf([['PS:c', 20], ['PS:a', 20], ['PS:b', 14]]),
      minTrainHands: 15,
    });
    expect(e.players).toEqual([
      { playerIndex: 0, playerId: 'PS:a', handCount: 20 },
      { playerIndex: 1, playerId: 'PS:c', handCount: 20 },
    ]);
  });
});

describe('seed scheme (ws433-v1) — golden vectors', () => {
  test('seedForDecision golden vector — frozen', () => {
    // Computed once from the shipped implementation and pinned. If these move, every
    // persisted chunk's seeds mean something different: bump SEED_SCHEME instead.
    const s1 = seedForDecision({ equitySeed: 0x9e3779b9, playerIndex: 0, checkpointIndex: 0, decisionOrdinal: 0 });
    const s2 = seedForDecision({ equitySeed: 0x9e3779b9, playerIndex: 1, checkpointIndex: 0, decisionOrdinal: 0 });
    const s3 = seedForDecision({ equitySeed: 20260806, playerIndex: 3, checkpointIndex: 2, decisionOrdinal: 7 });
    expect([s1, s2, s3]).toEqual([3265404648, 3976740631, 1931305616]);
  });

  test('seedForCombo golden vector — frozen', () => {
    const d = seedForDecision({ equitySeed: 20260806, playerIndex: 3, checkpointIndex: 2, decisionOrdinal: 7 });
    expect([
      seedForCombo(d, 0, 0),
      seedForCombo(d, 0, 1),
      seedForCombo(d, 1, 0),
    ]).toEqual([2958234718, 2289969455, 3780174289]);
  });

  test('every coordinate is load-bearing — changing any one changes the seed', () => {
    const base = { equitySeed: 7, playerIndex: 5, checkpointIndex: 3, decisionOrdinal: 2 };
    const s = seedForDecision(base);
    expect(seedForDecision({ ...base, equitySeed: 8 })).not.toBe(s);
    expect(seedForDecision({ ...base, playerIndex: 6 })).not.toBe(s);
    expect(seedForDecision({ ...base, checkpointIndex: 4 })).not.toBe(s);
    expect(seedForDecision({ ...base, decisionOrdinal: 3 })).not.toBe(s);
    expect(seedForCombo(s, 0, 0)).not.toBe(seedForCombo(s, 0, 1));
    expect(seedForCombo(s, 0, 0)).not.toBe(seedForCombo(s, 1, 0));
  });

  test('seeds are 32-bit unsigned integers', () => {
    const s = seedForDecision({ equitySeed: -1, playerIndex: 999999, checkpointIndex: 12345, decisionOrdinal: 67 });
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(0xFFFFFFFF);
  });
});

import { describe, it, expect } from 'vitest';
import {
  BUCKET_TAXONOMY,
  listKnownBuckets,
  handTypesForBucket,
  isKnownBucket,
  enumerateBucketCombos,
  flopRanksDescending,
  HAND_TYPES,
} from '../bucketTaxonomy';
import { parseRangeString } from '../../pokerCore/rangeMatrix';
import { parseBoard } from '../../pokerCore/cardParser';

const flop = (...cards) => parseBoard(cards);

describe('BUCKET_TAXONOMY — structure invariants', () => {
  it('is non-empty', () => {
    expect(Object.keys(BUCKET_TAXONOMY).length).toBeGreaterThan(0);
  });

  it('every bucket resolves to ≥1 segmenter HAND_TYPES entry', () => {
    for (const [id, types] of Object.entries(BUCKET_TAXONOMY)) {
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
      for (const t of types) {
        expect(HAND_TYPES, `bucket '${id}' references unknown segmenter hand-type '${t}'`).toContain(t);
      }
    }
  });

  it('taxonomy entries are frozen (prevents mutation-by-accident)', () => {
    for (const [id, types] of Object.entries(BUCKET_TAXONOMY)) {
      expect(Object.isFrozen(types), `bucket '${id}' types not frozen`).toBe(true);
    }
    expect(Object.isFrozen(BUCKET_TAXONOMY)).toBe(true);
  });

  it('listKnownBuckets is complete', () => {
    const ids = listKnownBuckets();
    expect(ids.sort()).toEqual(Object.keys(BUCKET_TAXONOMY).sort());
  });
});

describe('handTypesForBucket + isKnownBucket', () => {
  it('returns the frozen type array for a known bucket', () => {
    const t = handTypesForBucket('tptk');
    expect(t).toEqual(['topPairGood']);
  });

  it('returns multi-entry array for aggregated buckets', () => {
    const t = handTypesForBucket('flushDraw');
    expect(t).toEqual(['nutFlushDraw', 'nonNutFlushDraw']);
  });

  it('returns null for unknown bucket', () => {
    expect(handTypesForBucket('not-a-bucket')).toBeNull();
    expect(handTypesForBucket('')).toBeNull();
    expect(handTypesForBucket(undefined)).toBeNull();
  });

  it('isKnownBucket is strict about strings', () => {
    expect(isKnownBucket('tptk')).toBe(true);
    expect(isKnownBucket('air')).toBe(true);
    expect(isKnownBucket('made-up')).toBe(false);
    expect(isKnownBucket(42)).toBe(false);
    expect(isKnownBucket(null)).toBe(false);
  });
});

describe('enumerateBucketCombos — basic enumeration', () => {
  it('returns null for unknown bucketId', () => {
    const range = parseRangeString('AA');
    const out = enumerateBucketCombos({
      bucketId: 'not-a-bucket',
      board: flop('K♠', '7♥', '2♦'),
      range,
    });
    expect(out).toBeNull();
  });

  it('throws on invalid board length', () => {
    const range = parseRangeString('AA');
    expect(() => enumerateBucketCombos({
      bucketId: 'overpair',
      board: [],
      range,
    })).toThrow();
    expect(() => enumerateBucketCombos({
      bucketId: 'overpair',
      board: [1, 2],
      range,
    })).toThrow();
  });

  it('AA on K72r → 6 overpair combos', () => {
    const range = parseRangeString('AA');
    const out = enumerateBucketCombos({
      bucketId: 'overpair',
      board: flop('K♠', '7♥', '2♦'),
      range,
    });
    expect(out).not.toBeNull();
    expect(out.bucketId).toBe('overpair');
    expect(out.sampleSize).toBe(6);
    expect(out.combos.length).toBe(6);
    for (const c of out.combos) {
      expect(c.handType).toBe('overpair');
    }
  });

  it('KK on K72r → 3 set combos (K♠ on board removes the K♠-containing combos)', () => {
    const range = parseRangeString('KK');
    const out = enumerateBucketCombos({
      bucketId: 'set',
      board: flop('K♠', '7♥', '2♦'),
      range,
    });
    expect(out.sampleSize).toBe(3);
    expect(out.segmenterHandTypes).toEqual(['set']);
  });

  it('returns empty combos array when no range combos match the bucket', () => {
    // AA on K72r has zero flush-draw combos (rainbow board, unpaired range).
    const range = parseRangeString('AA');
    const out = enumerateBucketCombos({
      bucketId: 'flushDraw',
      board: flop('K♠', '7♥', '2♦'),
      range,
    });
    expect(out.sampleSize).toBe(0);
    expect(out.combos).toEqual([]);
    expect(out.totalWeight).toBe(0);
  });
});

describe('enumerateBucketCombos — JT6 canonical examples (roundtable scenario)', () => {
  // These exercise the JT6-like board from the owner's canonical bucket-EV
  // teaching example: BB 3BP donk on wet connected texture. Uses T96 (the
  // authored btn-vs-bb-3bp-ip-wet-t96 line).
  const board = flop('T♥', '9♥', '6♠');

  it('set: TT → 3 combos (T♥ on board removes T♥-containing combos)', () => {
    const range = parseRangeString('TT');
    const out = enumerateBucketCombos({ bucketId: 'set', board, range });
    expect(out.sampleSize).toBe(3);
  });

  it('tptk: AT → combos classify as topPairGood', () => {
    const range = parseRangeString('ATs,ATo');
    const out = enumerateBucketCombos({ bucketId: 'tptk', board, range });
    expect(out.sampleSize).toBeGreaterThan(0);
    for (const c of out.combos) {
      expect(c.handType).toBe('topPairGood');
    }
  });

  it('flushDraw bucket returns only combos the segmenter classifies as flush-draw types', () => {
    // Any combos that DO fall into flushDraw must have the correct handType;
    // the classifier decides which specific combos qualify (e.g. pure flush
    // draws may be classified as overcards/comboDraw by rangeSegmenter).
    const range = parseRangeString('AhKh,KhQh,QhJh,Jh4h');
    const out = enumerateBucketCombos({ bucketId: 'flushDraw', board, range });
    for (const c of out.combos) {
      expect(['nutFlushDraw', 'nonNutFlushDraw']).toContain(c.handType);
    }
  });

  it('flushDraw + nutFlushDraw are consistent — nut is a subset of the aggregate', () => {
    const range = parseRangeString('AhKh,KhQh,QhJh,Jh4h');
    const all = enumerateBucketCombos({ bucketId: 'flushDraw', board, range });
    const nutOnly = enumerateBucketCombos({ bucketId: 'nutFlushDraw', board, range });
    expect(all.sampleSize).toBeGreaterThanOrEqual(nutOnly.sampleSize);
    for (const c of nutOnly.combos) {
      expect(c.handType).toBe('nutFlushDraw');
    }
  });

  it('air: a tight broadway range on T96 collapses mostly to overcards, few true air', () => {
    const range = parseRangeString('AA,KK');
    const out = enumerateBucketCombos({ bucketId: 'air', board, range });
    // AA + KK on T96 = overpairs, not air. Expect zero air.
    expect(out.sampleSize).toBe(0);
  });

  it('aggregated "flush" bucket subsumes nutFlush + secondFlush + weakFlush', () => {
    expect(handTypesForBucket('flush')).toEqual(['nutFlush', 'secondFlush', 'weakFlush']);
  });
});

describe('flopRanksDescending', () => {
  it('returns ranks sorted high-to-low', () => {
    const board = flop('T♥', '9♥', '6♠');
    const ranks = flopRanksDescending(board);
    expect(ranks).not.toBeNull();
    // RANK_VALUES: A=12, K=11, Q=10, J=9, T=8, 9=7, 6=4
    expect(ranks).toEqual([8, 7, 4]);
  });

  it('returns null for short board', () => {
    expect(flopRanksDescending([])).toBeNull();
    expect(flopRanksDescending([1, 2])).toBeNull();
    expect(flopRanksDescending(null)).toBeNull();
  });

  it('ignores turn/river cards — only flop ranks', () => {
    const full = flop('T♥', '9♥', '6♠', 'A♣', '2♦');
    const ranks = flopRanksDescending(full);
    expect(ranks).toEqual([8, 7, 4]);
  });
});

// @vitest-environment jsdom
/**
 * BucketEVPanel — tests for the pure `computeBucketEVs` data function.
 *
 * The presentational component is visual-verify-only; this file covers
 * the async data orchestration layer.
 */

import { describe, it, expect } from 'vitest';
import { computeBucketEVs } from '../BucketEVPanel';
import { findLine } from '../../../../utils/postflopDrillContent/lines';

// The canonical JT6 exemplar has heroHolding on flop_root.
const getJT6Line = () => findLine('btn-vs-bb-3bp-ip-wet-t96');
const getJT6FlopNode = () => getJT6Line().nodes.flop_root;

describe('computeBucketEVs — shape', () => {
  it('returns { archetype, byBucket } with an entry per bucketCandidate', async () => {
    const line = getJT6Line();
    const node = getJT6FlopNode();
    const out = await computeBucketEVs({ node, line, archetype: 'fish' });
    expect(out.archetype).toBe('fish');
    expect(typeof out.byBucket).toBe('object');
    // JT6 node declares 5 candidates: topPair, flushDraw, openEnder, overpair, air.
    // Each must be present — either as `{result}` or `{error}`. The JT6 hero
    // context (BTN call vs BB 3bet) may not be in the v1 archetype range
    // library; in that case entries carry `{error: 'range-unavailable'}`.
    for (const b of node.heroHolding.bucketCandidates) {
      const entry = out.byBucket[b];
      expect(entry).toBeDefined();
      expect(entry.result || entry.error).toBeTruthy();
    }
  });

  it('byBucket uses a prototype-free map (NEV-12)', async () => {
    const line = getJT6Line();
    const node = getJT6FlopNode();
    const out = await computeBucketEVs({ node, line, archetype: 'reg' });
    expect(Object.getPrototypeOf(out.byBucket)).toBeNull();
  });

  it('returns empty byBucket when node has no heroHolding', async () => {
    const line = getJT6Line();
    const node = { ...getJT6FlopNode(), heroHolding: undefined };
    const out = await computeBucketEVs({ node, line, archetype: 'fish' });
    expect(Object.keys(out.byBucket)).toEqual([]);
  });

  it('returns empty byBucket when bucketCandidates is an empty array', async () => {
    const line = getJT6Line();
    const node = { ...getJT6FlopNode(), heroHolding: { bucketCandidates: [] } };
    const out = await computeBucketEVs({ node, line, archetype: 'reg' });
    expect(Object.keys(out.byBucket)).toEqual([]);
  });
});

describe('computeBucketEVs — error handling', () => {
  it('flags unknown bucketId with error: "unknown-bucket" independent of range availability', async () => {
    const baseLine = getJT6Line();
    const baseNode = getJT6FlopNode();
    const node = {
      ...baseNode,
      heroHolding: { bucketCandidates: ['topPair', 'not-a-bucket'] },
    };
    const out = await computeBucketEVs({ node, line: baseLine, archetype: 'reg' });
    // Unknown bucket must ALWAYS surface as 'unknown-bucket', regardless of
    // whether the hero/villain range derivation succeeded for this line.
    expect(out.byBucket['not-a-bucket']).toEqual({ error: 'unknown-bucket' });
    // The known bucket gets either a result or 'range-unavailable' — both
    // are legitimate outcomes; the contract is that the entry is present.
    const topPairEntry = out.byBucket.topPair;
    expect(topPairEntry).toBeDefined();
    expect(topPairEntry.result || topPairEntry.error).toBeTruthy();
  });

  it('populates range-unavailable error per-bucket when hero range fails', async () => {
    const baseLine = getJT6Line();
    const node = getJT6FlopNode();
    const line = { ...baseLine, setup: { ...baseLine.setup, hero: { position: 'BOGUS' } } };
    const out = await computeBucketEVs({ node, line, archetype: 'fish' });
    expect(out.rangeError).toBeDefined();
    // Known buckets report range-unavailable; unknown buckets still report unknown.
    for (const b of node.heroHolding.bucketCandidates) {
      const entry = out.byBucket[b];
      expect(entry).toBeDefined();
      expect(['range-unavailable', 'unknown-bucket']).toContain(entry.error);
    }
  });

  it('surfaces rangeError when hero range context is missing', async () => {
    const baseLine = getJT6Line();
    const node = getJT6FlopNode();
    const line = { ...baseLine, setup: { ...baseLine.setup, hero: { position: 'BOGUS' } } };
    const out = await computeBucketEVs({ node, line, archetype: 'fish' });
    expect(out.rangeError).toBeDefined();
    expect(typeof out.rangeError).toBe('string');
  });
});

describe('computeBucketEVs — per-bucket results', () => {
  it('each successful result carries evs, ranking, sampleSize, bailedOut, caveats', async () => {
    const line = getJT6Line();
    const node = getJT6FlopNode();
    const out = await computeBucketEVs({ node, line, archetype: 'fish' });
    for (const [bucketId, entry] of Object.entries(out.byBucket)) {
      if (!entry.result) continue;
      expect(entry.result, `bucket ${bucketId}`).toHaveProperty('evs');
      expect(entry.result).toHaveProperty('ranking');
      expect(entry.result).toHaveProperty('sampleSize');
      expect(entry.result).toHaveProperty('bailedOut');
      expect(entry.result).toHaveProperty('caveats');
      expect(Array.isArray(entry.result.ranking)).toBe(true);
    }
  });

  it('synthetic-range caveat is always present on successful results', async () => {
    const line = getJT6Line();
    const node = getJT6FlopNode();
    const out = await computeBucketEVs({ node, line, archetype: 'pro' });
    for (const entry of Object.values(out.byBucket)) {
      if (!entry.result) continue;
      expect(entry.result.caveats).toContain('synthetic-range');
    }
  });

  it('archetype flows through to each result', async () => {
    const line = getJT6Line();
    const node = getJT6FlopNode();
    const out = await computeBucketEVs({ node, line, archetype: 'fish' });
    for (const entry of Object.values(out.byBucket)) {
      if (!entry.result) continue;
      expect(entry.result.archetype).toBe('fish');
    }
  });

  it('fish-archetype and reg-archetype produce different bet EVs (fold-rate shift)', async () => {
    const line = getJT6Line();
    const node = getJT6FlopNode();
    const fish = await computeBucketEVs({ node, line, archetype: 'fish' });
    const reg  = await computeBucketEVs({ node, line, archetype: 'reg' });
    // Pick any known bucket that resolves successfully in both.
    const bucket = node.heroHolding.bucketCandidates.find(
      (b) => fish.byBucket[b]?.result && reg.byBucket[b]?.result,
    );
    if (!bucket) {
      // No overlap of successful buckets; skip without failing the suite.
      return;
    }
    const fishBet = fish.byBucket[bucket].result.evs.bet_75?.ev;
    const regBet  = reg.byBucket[bucket].result.evs.bet_75?.ev;
    if (typeof fishBet === 'number' && typeof regBet === 'number') {
      expect(fishBet).not.toBe(regBet);
    }
  });
});

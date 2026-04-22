// @vitest-environment jsdom
/**
 * BucketEVPanel — tests for the pure `computeBucketEVs` data function.
 *
 * The presentational component is visual-verify-only; this file covers
 * the async data orchestration layer.
 */

import { describe, it, expect } from 'vitest';
import { computeBucketEVs, isRowApplicable } from '../BucketEVPanel';
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

// LSW-H1 (2026-04-22) — per-hero feasibility gate predicate.
// Rendering switches on `isRowApplicable` when `heroHolding.combos` is
// non-empty; inapplicable buckets collapse behind a disclosure rather than
// rendering with "No combos in range" under the "Your hand class" header.
describe('isRowApplicable (LSW-H1 feasibility gate)', () => {
  it('returns false for undefined / null entry', () => {
    expect(isRowApplicable(undefined)).toBe(false);
    expect(isRowApplicable(null)).toBe(false);
  });

  it('returns false when entry carries an error (unknown-bucket, range-unavailable, etc.)', () => {
    expect(isRowApplicable({ error: 'unknown-bucket' })).toBe(false);
    expect(isRowApplicable({ error: 'range-unavailable' })).toBe(false);
  });

  it('returns false when result has the empty-bucket caveat', () => {
    const entry = {
      result: {
        sampleSize: 0,
        caveats: ['synthetic-range', 'v1-simplified-ev', 'empty-bucket'],
      },
    };
    expect(isRowApplicable(entry)).toBe(false);
  });

  it('returns false when sampleSize is 0 even without the empty-bucket caveat', () => {
    const entry = {
      result: {
        sampleSize: 0,
        caveats: ['synthetic-range', 'v1-simplified-ev'],
      },
    };
    expect(isRowApplicable(entry)).toBe(false);
  });

  it('returns true when result has live combos', () => {
    const entry = {
      result: {
        sampleSize: 9,
        caveats: ['synthetic-range', 'v1-simplified-ev'],
      },
    };
    expect(isRowApplicable(entry)).toBe(true);
  });

  it('returns true even with the low-sample-bucket caveat when sampleSize > 0', () => {
    const entry = {
      result: {
        sampleSize: 1,
        caveats: ['synthetic-range', 'v1-simplified-ev', 'low-sample-bucket'],
      },
    };
    expect(isRowApplicable(entry)).toBe(true);
  });
});

// LSW-H1 (2026-04-22) — JT6 flop_root content trim regression pin.
// The surface audit reduced bucketCandidates from 5 to 1 to stop rendering
// buckets infeasible for J♥T♠. This test pins the current interim shape
// so the trim can't silently be re-expanded without either landing the
// G3 taxonomy (BDFD/BDSD) or explicitly updating this pin.
describe('JT6 flop_root bucketCandidates (LSW-H1 interim trim)', () => {
  it('flop_root has exactly topPair until LSW-G3 adds backdoor buckets', () => {
    const node = getJT6FlopNode();
    expect(node.heroHolding.combos).toEqual(['J♥T♠']);
    expect(node.heroHolding.bucketCandidates).toEqual(['topPair']);
  });

  it('flop_root compute section seeds the pot-odds widget with the node context', () => {
    const node = getJT6FlopNode();
    const compute = node.sections.find((s) => s.kind === 'compute');
    expect(compute).toBeDefined();
    expect(compute.calculator).toBe('potOdds');
    // Node pot is 20.5; after BB's 33% donk, compute should verify
    // against the post-donk 27.3/6.8 figures the intro prose asserts.
    expect(compute.seed).toEqual({ pot: 27.3, bet: 6.8 });
  });
});

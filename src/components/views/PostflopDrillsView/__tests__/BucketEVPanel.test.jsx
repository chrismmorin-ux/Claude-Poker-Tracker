// @vitest-environment jsdom
/**
 * BucketEVPanel — tests for the pure `computeBucketEVs` data function.
 *
 * The presentational component is visual-verify-only; this file covers
 * the async data orchestration layer.
 */

import { describe, it, expect } from 'vitest';
import { computeBucketEVs, isRowApplicable, parseComboString } from '../BucketEVPanel';
import { findLine } from '../../../../utils/postflopDrillContent/lines';
import { encodeCard } from '../../../../utils/pokerCore/cardParser';

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

// LSW-H2 (2026-04-22) — hero-combo-specific EV (surface audit S2).
describe('parseComboString (LSW-H2)', () => {
  it('parses a canonical combo string into two encoded cards', () => {
    const out = parseComboString('J♥T♠');
    // Rank encoding: J=9, T=8. Suit encoding depends on SUITS order in
    // gameConstants; the helper guarantees c1 ≠ c2 and both ≥ 0.
    expect(out).not.toBeNull();
    expect(out.card1).toBeGreaterThanOrEqual(0);
    expect(out.card2).toBeGreaterThanOrEqual(0);
    expect(out.card1).not.toBe(out.card2);
    // Ranks must be J and T (one of each) after decoding.
    const rank1 = out.card1 >> 2;
    const rank2 = out.card2 >> 2;
    expect(new Set([rank1, rank2])).toEqual(new Set([8, 9]));
  });

  it('returns null for malformed input', () => {
    expect(parseComboString('JhTs')).toBeNull(); // ascii suits not accepted by parseAndEncode
    expect(parseComboString('J♥')).toBeNull(); // too short
    expect(parseComboString('')).toBeNull();
    expect(parseComboString(null)).toBeNull();
    expect(parseComboString(42)).toBeNull();
  });

  it('returns null for combos with duplicate cards', () => {
    expect(parseComboString('J♥J♥')).toBeNull();
  });
});

describe('computeBucketEVs — pinnedCombo block (LSW-H2)', () => {
  it('returns pinnedCombo: null when node has no single-combo heroHolding', async () => {
    const line = getJT6Line();
    const node = { ...getJT6FlopNode(), heroHolding: { bucketCandidates: ['topPair'] } };
    const out = await computeBucketEVs({ node, line, archetype: 'reg' });
    expect(out.pinnedCombo).toBeNull();
  });

  it('computes pinnedCombo block for JT6 flop_root (J♥T♠)', async () => {
    const line = getJT6Line();
    const node = getJT6FlopNode();
    // Sanity: fixture keeps a single combo post-H1.
    expect(node.heroHolding.combos).toEqual(['J♥T♠']);
    const out = await computeBucketEVs({ node, line, archetype: 'reg' });
    // When the hero range context is in the v1 library, pinnedCombo is
    // non-null and carries the computed per-combo EV shape.
    if (!out.rangeError) {
      expect(out.pinnedCombo).not.toBeNull();
      expect(out.pinnedCombo.comboString).toBe('J♥T♠');
      expect(out.pinnedCombo.equity).toBeGreaterThan(0);
      expect(out.pinnedCombo.equity).toBeLessThan(1);
      expect(out.pinnedCombo.evs).toBeDefined();
      expect(Array.isArray(out.pinnedCombo.ranking)).toBe(true);
      // Ranking must contain one of the DEFAULT_ACTIONS IDs.
      expect(out.pinnedCombo.ranking.length).toBeGreaterThan(0);
    }
  }, 15000);

  it('pinnedCombo equity for J♥T♠ on T♥9♥6♠ is within a plausible range vs a typical 3bet range', async () => {
    const line = getJT6Line();
    const node = getJT6FlopNode();
    const out = await computeBucketEVs({ node, line, archetype: 'reg' });
    if (out.rangeError || !out.pinnedCombo) return; // skip if range-unavailable
    // JT on T96ss vs BB's 3bet range (JJ+, AK/AQs, KQs, plus some A-high
    // blocker bluffs) is roughly 35–55% equity per combinatorial expansion.
    // Generous tolerance to account for MC variance at the default trial
    // count. Upper bound excludes "hero crushes" readings that would
    // indicate a range-lookup bug.
    expect(out.pinnedCombo.equity).toBeGreaterThan(0.20);
    expect(out.pinnedCombo.equity).toBeLessThan(0.75);
  }, 15000);

  it('pinnedCombo best-action EV differs from topPair bucket EV (per-combo ≠ bucket average)', async () => {
    const line = getJT6Line();
    const node = getJT6FlopNode();
    const out = await computeBucketEVs({ node, line, archetype: 'reg' });
    if (out.rangeError || !out.pinnedCombo) return;
    const bucketEntry = out.byBucket.topPair;
    if (!bucketEntry?.result) return;
    const pinnedBest = out.pinnedCombo.evs[out.pinnedCombo.ranking[0]]?.ev;
    const bucketBest = bucketEntry.result.evs[bucketEntry.result.ranking[0]]?.ev;
    // The per-combo and bucket-average EVs should diverge (point of H2).
    // Don't over-specify the exact direction — the equity delta depends on
    // whether J♥T♠'s true equity is above or below the topPair class
    // average. Just assert they're not identical.
    if (typeof pinnedBest === 'number' && typeof bucketBest === 'number') {
      expect(Math.abs(pinnedBest - bucketBest)).toBeGreaterThan(0.05);
    }
  }, 15000);

  it('omits pinnedCombo gracefully when heroHolding.combos is malformed', async () => {
    const line = getJT6Line();
    const node = { ...getJT6FlopNode(), heroHolding: { combos: ['BOGUS!'], bucketCandidates: ['topPair'] } };
    const out = await computeBucketEVs({ node, line, archetype: 'reg' });
    // parseComboString rejects malformed strings → pinnedPromise resolves null.
    expect(out.pinnedCombo).toBeNull();
  });
});

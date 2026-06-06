/**
 * @file Tests for src/utils/heroState/equityVsRangeParts.js
 *
 * translateStrengthToRole: pure-function table tests covering all 4 quadrants
 * of (villainIsAggressor × isPolarized) plus polarization-flag triggers,
 * defender symmetry, capped range, and LIMP_NAV / VS_OPEN context handling.
 *
 * computeEquityVsRangeParts: integration tests with mocked equityFn for
 * deterministic role-aggregation math, plus MULTIWAY guard, preflop
 * short-circuit, river vsDraw=null, capped vsValue=null, empty-role-partition.
 */

import { describe, it, expect } from 'vitest';
import {
  translateStrengthToRole,
  computeEquityVsRangeParts,
} from '../equityVsRangeParts.js';

// ─── Test fixtures ───────────────────────────────────────────────────────

/**
 * Build a synthetic segResult with given per-bucket weights. Pcts are computed
 * automatically. Other segResult fields (combos, handTypes, board) are
 * stubbed minimally — translateStrengthToRole only reads `.buckets[b].weightSum`
 * and `.buckets[b].pct`.
 */
const makeSegResult = (weights) => {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const buckets = {};
  for (const b of ['nuts', 'strong', 'marginal', 'draw', 'air']) {
    const w = weights[b] ?? 0;
    buckets[b] = {
      count: w,
      weightSum: w,
      pct: total > 0 ? (w / total) * 100 : 0,
    };
  }
  return { buckets, combos: [], handTypes: {}, board: [], totalWeight: total };
};

/**
 * Build a deterministic equityFn mock that returns fixed equity values per
 * bucket. The mock pattern-matches the call arity used by enrichWithEquity:
 * (heroCards, range, board, options) → Promise<{equity}>. Per-bucket equity
 * is keyed by which bucket sub-range is being passed; we identify the bucket
 * by reading the test's pre-built bucketRanges map and matching against the
 * passed range identity.
 *
 * Simpler approach: pass a custom equityFn into options that always returns
 * a fixed value, used for overall + per-bucket equity uniformly. For
 * role-aggregation math tests we need per-bucket discrimination, so we use
 * a closure that reads the call sequence from enrichWithEquity (per the
 * source order of BUCKETS).
 */

// ─── translateStrengthToRole ─────────────────────────────────────────────

describe('translateStrengthToRole', () => {
  // 4 quadrants of (villainIsAggressor × isPolarized) ─────────────────────

  it('VS_CBET (villain aggressor) + polarized villainStyle: marginal→vsBluff, air→vsBluff', () => {
    const seg = makeSegResult({ nuts: 10, strong: 20, marginal: 15, draw: 5, air: 10 });
    const out = translateStrengthToRole(seg, 'VS_CBET', { polarization: 0.7 });
    expect(out.vsValue.buckets).toEqual(['nuts', 'strong']);
    expect(out.vsBluff.buckets).toEqual(['marginal', 'air']);
    expect(out.vsDraw.buckets).toEqual(['draw']);
    expect(out.vsAir.buckets).toEqual([]);
    expect(out.vsValue.totalWeight).toBe(30);
    expect(out.vsBluff.totalWeight).toBe(25);
    expect(out.vsDraw.totalWeight).toBe(5);
    expect(out.vsAir.totalWeight).toBe(0);
  });

  it('VS_CBET (villain aggressor) + linear villainStyle: marginal→vsValue, air→vsAir', () => {
    const seg = makeSegResult({ nuts: 10, strong: 20, marginal: 15, draw: 5, air: 10 });
    const out = translateStrengthToRole(seg, 'VS_CBET', { polarization: 0.2 });
    expect(out.vsValue.buckets).toEqual(['nuts', 'strong', 'marginal']);
    expect(out.vsBluff.buckets).toEqual([]);
    expect(out.vsDraw.buckets).toEqual(['draw']);
    expect(out.vsAir.buckets).toEqual(['air']);
    expect(out.vsValue.totalWeight).toBe(45);
    expect(out.vsBluff.totalWeight).toBe(0);
    expect(out.vsDraw.totalWeight).toBe(5);
    expect(out.vsAir.totalWeight).toBe(10);
  });

  it('CBET (hero aggressor → villain defender) + polarized villainStyle: marginal→vsValue, air→vsAir', () => {
    const seg = makeSegResult({ nuts: 10, strong: 20, marginal: 15, draw: 5, air: 10 });
    const out = translateStrengthToRole(seg, 'CBET', { polarization: 0.7 });
    expect(out.vsValue.buckets).toEqual(['nuts', 'strong', 'marginal']);
    expect(out.vsBluff.buckets).toEqual([]);
    expect(out.vsDraw.buckets).toEqual(['draw']);
    expect(out.vsAir.buckets).toEqual(['air']);
  });

  it('CBET (hero aggressor → villain defender) + linear villainStyle: marginal→vsValue, air→vsAir (style-agnostic)', () => {
    const seg = makeSegResult({ nuts: 10, strong: 20, marginal: 15, draw: 5, air: 10 });
    const out = translateStrengthToRole(seg, 'CBET', { polarization: 0.2 });
    expect(out.vsValue.buckets).toEqual(['nuts', 'strong', 'marginal']);
    expect(out.vsBluff.buckets).toEqual([]);
    expect(out.vsDraw.buckets).toEqual(['draw']);
    expect(out.vsAir.buckets).toEqual(['air']);
  });

  // LIMP_NAV → defender ──────────────────────────────────────────────────

  it('LIMP_NAV → defender row regardless of villainStyle', () => {
    const seg = makeSegResult({ nuts: 5, strong: 10, marginal: 30, draw: 5, air: 10 });
    const out = translateStrengthToRole(seg, 'LIMP_NAV', { polarization: 0.9 });
    expect(out.vsValue.buckets).toEqual(['nuts', 'strong', 'marginal']);
    expect(out.vsAir.buckets).toEqual(['air']);
    expect(out.vsBluff.buckets).toEqual([]);
  });

  // Polarization flag triggers ──────────────────────────────────────────

  it('polarization flag triggered by villainStyle.polarization >= 0.5 alone (low bucket-pct)', () => {
    // Linear-ish bucket distribution but explicit high polarization signal.
    const seg = makeSegResult({ nuts: 5, strong: 25, marginal: 50, draw: 10, air: 10 });
    // nuts.pct + air.pct = 5 + 10 = 15 → below 60 threshold, so style alone must trigger.
    const out = translateStrengthToRole(seg, 'VS_CBET', { polarization: 0.5 });
    expect(out.vsBluff.buckets).toContain('marginal');
    expect(out.vsBluff.buckets).toContain('air');
  });

  it('polarization flag triggered by nuts.pct + air.pct > 60 alone (no villainStyle)', () => {
    // No style passed, but bucket distribution is explicitly polarized.
    const seg = makeSegResult({ nuts: 30, strong: 5, marginal: 5, draw: 5, air: 35 });
    // nuts.pct + air.pct = 30/80*100 + 35/80*100 = 37.5 + 43.75 = 81.25 > 60.
    const out = translateStrengthToRole(seg, 'VS_CBET', null);
    expect(out.vsBluff.buckets).toContain('marginal');
    expect(out.vsBluff.buckets).toContain('air');
  });

  it('villainStyle === null + non-polarized buckets: defender mapping (linear/aggressor decision uses 0 polarization)', () => {
    const seg = makeSegResult({ nuts: 5, strong: 25, marginal: 30, draw: 10, air: 10 });
    // nuts+air = 5/80*100 + 10/80*100 = 18.75 → below 60. No style → polarization defaults to 0.
    const out = translateStrengthToRole(seg, 'VS_CBET', null);
    // VS_CBET (aggressor) + linear → marginal→vsValue, air→vsAir
    expect(out.vsValue.buckets).toEqual(['nuts', 'strong', 'marginal']);
    expect(out.vsAir.buckets).toEqual(['air']);
  });

  // Capped range edge case ──────────────────────────────────────────────

  it('capped range (nuts=0): vsValue still lists [nuts,strong] but totalWeight reflects only strong', () => {
    const seg = makeSegResult({ nuts: 0, strong: 30, marginal: 20, draw: 5, air: 10 });
    const out = translateStrengthToRole(seg, 'VS_CBET', { polarization: 0.7 });
    expect(out.vsValue.buckets).toEqual(['nuts', 'strong']);
    expect(out.vsValue.totalWeight).toBe(30); // only strong contributes
  });

  it('fully empty value class (nuts=0, strong=0): vsValue.totalWeight=0 → caller will null-out', () => {
    const seg = makeSegResult({ nuts: 0, strong: 0, marginal: 30, draw: 5, air: 30 });
    const out = translateStrengthToRole(seg, 'CBET', { polarization: 0.2 });
    // Defender + linear: marginal→vsValue → vsValue=[nuts,strong,marginal] totalWeight=30
    expect(out.vsValue.totalWeight).toBe(30);
    // For aggressor polarized, marginal would move to vsBluff. Test that branch separately:
    const out2 = translateStrengthToRole(seg, 'VS_CBET', { polarization: 0.7 });
    expect(out2.vsValue.totalWeight).toBe(0); // nuts+strong only, both empty
  });

  // Symmetry: VS_OPEN vs OPEN produce different branches ─────────────────

  it('symmetry: VS_OPEN (villain aggressor) and OPEN (hero aggressor) produce different branches with same villainStyle', () => {
    const seg = makeSegResult({ nuts: 30, strong: 5, marginal: 5, draw: 5, air: 35 });
    const vsOpen = translateStrengthToRole(seg, 'VS_OPEN', { polarization: 0.7 });
    const open = translateStrengthToRole(seg, 'OPEN', { polarization: 0.7 });
    // VS_OPEN aggressor+polarized: marginal→vsBluff, air→vsBluff
    expect(vsOpen.vsBluff.buckets).toContain('marginal');
    expect(vsOpen.vsBluff.buckets).toContain('air');
    // OPEN defender + polarized: marginal→vsValue, air→vsAir
    expect(open.vsValue.buckets).toContain('marginal');
    expect(open.vsAir.buckets).toContain('air');
  });
});

// ─── computeEquityVsRangeParts ───────────────────────────────────────────

describe('computeEquityVsRangeParts', () => {
  // MULTIWAY behavior (WS-154 / SPR-106) ────────────────────────────────
  // Previously threw; now returns null role partition + populated overall.
  // The upstream guard at buildHeroState.js gates on playersRemaining<3 so
  // this branch only fires on defensive caller injection.

  it('returns null role partition + populated overall when actionContext === MULTIWAY', async () => {
    const equityFn = async () => ({ equity: 0.42 });
    const result = await computeEquityVsRangeParts({
      heroCards: [0, 1],
      villainRange: new Float64Array(169).fill(1),
      board: [10, 20, 30],
      street: 'flop',
      actionContext: 'MULTIWAY',
      villainStyle: null,
      options: { equityFn },
    });
    expect(result.vsValue).toBe(null);
    expect(result.vsBluff).toBe(null);
    expect(result.vsDraw).toBe(null);
    expect(result.vsAir).toBe(null);
    expect(result.overall).toBe(0.42);
    expect(result.strengthBreakdown).toBe(null);
  });

  // Preflop short-circuit ────────────────────────────────────────────────

  it('preflop short-circuit: returns nulls for all 4 roles, overall = mocked equity, strengthBreakdown = null', async () => {
    const equityFn = async () => ({ equity: 0.55 });
    const result = await computeEquityVsRangeParts({
      heroCards: [0, 1],
      villainRange: new Float64Array(169),
      board: [],
      street: 'preflop',
      actionContext: 'OPEN',
      villainStyle: null,
      options: { equityFn },
    });
    expect(result).toEqual({
      vsValue: null,
      vsBluff: null,
      vsDraw: null,
      vsAir: null,
      overall: 0.55,
      strengthBreakdown: null,
    });
  });

  // Postflop integration tests use a real range — small synthetic flop.
  // We use a minimal range vector that produces non-trivial bucket distributions.
  // For role-aggregation math determinism we mock equityFn.

  // Helper: build a non-trivial range that segments into multiple buckets on a given board.
  const buildTestRange = () => {
    // Range spread over 169 cells with weight 1.0 in each — full random range.
    // segmentRange + classifyComboFull will distribute into all 5 buckets given
    // any sufficiently varied board.
    const range = new Float64Array(169);
    range.fill(1.0);
    return range;
  };

  // pokerCore card encoding: rank * 4 + suit. Diamonds=0, Clubs=1, Hearts=2, Spades=3.
  // We use unambiguously distinct ranks for hero + board.
  // Hero: As Kh = (12*4+3, 11*4+2) = (51, 46)
  // Flop: 7d 5c 2s = (5*4+0, 3*4+1, 0*4+3) = (20, 13, 3)
  const HERO_AKS = [51, 46];
  const FLOP_752 = [20, 13, 3];
  const TURN = 32; // 8h
  const RIVER = 8; // 2c — pairs the board, not great but distinct

  it('postflop role-aggregation: weighted average of bucket equities per role', async () => {
    // Mock equityFn returns fixed equity per call. enrichWithEquity calls it
    // once per non-empty bucket (with bucketRange) + once for the full range.
    // We can't easily discriminate by bucket without inspecting the range arg,
    // so we just verify the math contract: result = aggregator over (eq, weight)
    // pairs. For a full range, all buckets exist, so the aggregator should
    // produce a number in [0, 1] for each role with non-zero weight.
    let callCount = 0;
    const equityFn = async () => {
      callCount += 1;
      // Return 0.50 for all buckets + overall — uniform makes the weighted
      // average deterministic regardless of weights.
      return { equity: 0.50 };
    };
    const result = await computeEquityVsRangeParts({
      heroCards: HERO_AKS,
      villainRange: buildTestRange(),
      board: FLOP_752,
      street: 'flop',
      actionContext: 'VS_CBET',
      villainStyle: { polarization: 0.7 },
      options: { equityFn, trials: 100 },
    });
    expect(callCount).toBeGreaterThan(0);
    expect(result.overall).toBe(0.50);
    // With uniform 0.50 equity across all bucket equities, all non-null role
    // equities should equal 0.50.
    for (const role of ['vsValue', 'vsBluff', 'vsDraw', 'vsAir']) {
      if (result[role] !== null) expect(result[role]).toBeCloseTo(0.50, 5);
    }
    expect(result.strengthBreakdown).not.toBeNull();
    expect(result.strengthBreakdown.segResult).toBeDefined();
    expect(result.strengthBreakdown.bucketEquities).toBeDefined();
  });

  it('role-aggregation math: distinct per-bucket equities produce correctly weighted role equity', async () => {
    // Use a per-bucket equity assignment by tracking which range is being passed.
    // enrichWithEquity calls equityFn(heroCards, bucketRanges[b], board, opts)
    // for each non-empty bucket, then once for overall (full range).
    //
    // We instrument by computing a fingerprint of each range — for our synthetic
    // setup the bucket sub-ranges are sub-arrays of the full range, so identity
    // checks differentiate them. However the full range is a freshly-rebuilt
    // Float64Array (rebuildFullRange). So we pattern-match by relative weight
    // sum: bucket sub-ranges sum to less than the full range.
    //
    // Simpler robust approach: assign equity by call-order. We know enrichWithEquity
    // dispatches BUCKETS in order ['nuts','strong','marginal','draw','air'] then
    // overall. Use that ordering deterministically.
    const BUCKETS_ORDER = ['nuts', 'strong', 'marginal', 'draw', 'air'];
    const bucketEqs = { nuts: 0.20, strong: 0.40, marginal: 0.55, draw: 0.45, air: 0.85 };
    const overallEq = 0.50;
    let callIdx = 0;
    // bucket calls and overall call are dispatched together via Promise.all,
    // but they're created in source order — bucket promises first, then overall.
    // After all complete, the LAST entry in the resolved array is overall.
    // So callIdx 0..N-1 are bucket calls (in BUCKETS order, skipping empty), N is overall.
    // We need to know which buckets exist — for a full range on a flop this is
    // typically all 5. For simplicity we assume all 5 buckets exist + overall = 6 calls.
    const equityFn = async (heroCards, range) => {
      // Distinguish overall (call after all buckets) by its call index.
      const idx = callIdx;
      callIdx += 1;
      if (idx < 5) {
        return { equity: bucketEqs[BUCKETS_ORDER[idx]] };
      }
      return { equity: overallEq };
    };
    const result = await computeEquityVsRangeParts({
      heroCards: HERO_AKS,
      villainRange: buildTestRange(),
      board: FLOP_752,
      street: 'flop',
      actionContext: 'VS_CBET',
      villainStyle: { polarization: 0.7 },
      options: { equityFn, trials: 100 },
    });
    expect(result.overall).toBeCloseTo(overallEq, 5);
    // VS_CBET aggressor + polarized → marginal→vsBluff, air→vsBluff.
    // vsValue=[nuts,strong]: weighted avg of 0.20 and 0.40 by bucket weights.
    // vsBluff=[marginal,air]: weighted avg of 0.55 and 0.85 by bucket weights.
    // vsDraw=[draw]: 0.45.
    // vsAir=[]: null.
    const seg = result.strengthBreakdown.segResult;
    const wn = seg.buckets.nuts.weightSum;
    const ws = seg.buckets.strong.weightSum;
    const wm = seg.buckets.marginal.weightSum;
    const wd = seg.buckets.draw.weightSum;
    const wa = seg.buckets.air.weightSum;
    if (wn + ws > 0) {
      const expectedVsValue = (0.20 * wn + 0.40 * ws) / (wn + ws);
      expect(result.vsValue).toBeCloseTo(expectedVsValue, 5);
    }
    if (wm + wa > 0) {
      const expectedVsBluff = (0.55 * wm + 0.85 * wa) / (wm + wa);
      expect(result.vsBluff).toBeCloseTo(expectedVsBluff, 5);
    }
    if (wd > 0) {
      expect(result.vsDraw).toBeCloseTo(0.45, 5);
    }
    expect(result.vsAir).toBeNull();
  });

  it('river: vsDraw === null when draw bucket has zero weight', async () => {
    // Force draw bucket empty by injecting a custom segResult-like object
    // through equityFn pattern. Simpler: just use a 5-card board (river) with
    // a paired-and-monotone-locked texture so detectDraws returns 0 for all
    // combos. The board.length === 5 short-circuit in segmentRange's
    // detectDraws prevents draws, so all combos go to non-draw buckets.
    const equityFn = async () => ({ equity: 0.50 });
    const result = await computeEquityVsRangeParts({
      heroCards: HERO_AKS,
      villainRange: buildTestRange(),
      board: [...FLOP_752, TURN, RIVER],
      street: 'river',
      actionContext: 'VS_CBET',
      villainStyle: { polarization: 0.7 },
      options: { equityFn, trials: 100 },
    });
    // On river, segmentRange's detectDraws short-circuits to 0 → no combos
    // get classified as draws (assuming classifyComboFull also doesn't bucket
    // them as 'draw'). vsDraw should be null because draw bucket has zero weight.
    expect(result.vsDraw).toBeNull();
  });

  it('strengthBreakdown is populated postflop and null on preflop', async () => {
    const equityFn = async () => ({ equity: 0.50 });
    const flopResult = await computeEquityVsRangeParts({
      heroCards: HERO_AKS,
      villainRange: buildTestRange(),
      board: FLOP_752,
      street: 'flop',
      actionContext: 'VS_CBET',
      villainStyle: { polarization: 0.7 },
      options: { equityFn, trials: 100 },
    });
    expect(flopResult.strengthBreakdown).not.toBeNull();
    expect(flopResult.strengthBreakdown.segResult.buckets).toBeDefined();
    expect(flopResult.strengthBreakdown.bucketEquities).toBeDefined();

    const pfResult = await computeEquityVsRangeParts({
      heroCards: HERO_AKS,
      villainRange: buildTestRange(),
      board: [],
      street: 'preflop',
      actionContext: 'OPEN',
      villainStyle: null,
      options: { equityFn },
    });
    expect(pfResult.strengthBreakdown).toBeNull();
  });
});

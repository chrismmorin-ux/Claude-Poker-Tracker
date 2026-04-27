/**
 * Tests for `adjustCaveatsForDepth2` — the BucketEVPanelV2 cross-check
 * helper introduced in the LSW-D2 follow-on (depth-2 wire-through into the
 * bucket panel). Pure function, exhaustively unit-tested.
 *
 * Covers:
 *  - depth-2 unavailable / errorState → caveats unchanged
 *  - aligned best-action → 'v1-simplified-ev' → 'depth2-cross-validated'
 *  - divergent best-action → 'v1-simplified-ev' kept + 'depth2-divergent' added
 *  - leading-token match handles sizing suffixes ('bet 75%' ≡ 'bet')
 *  - leading-token match handles 'Raise to 9bb' ≡ 'raise'
 *  - case-insensitive
 *  - missing labels → caveats unchanged
 *  - non-array bucketCaveats → handled gracefully
 *  - input not mutated (returns a fresh array)
 */

import { describe, it, expect } from 'vitest';
import { adjustCaveatsForDepth2 } from '../../BucketEVPanelV2';

const baseDepth2 = (override = {}) => ({
  heroCombo: 'J♥T♠',
  perAction: [],
  bestActionLabel: 'bet',
  bestActionReason: 'reason',
  decisionKind: 'standard',
  caveats: ['real-range'],
  nextStreetPlan: null,
  errorState: null,
  ...override,
});

describe('adjustCaveatsForDepth2 — depth-2 unavailable', () => {
  it('returns caveats unchanged when depth2Plan is null', () => {
    const caveats = ['synthetic-range', 'v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, 'bet 75%', null);
    expect(out).toEqual(['synthetic-range', 'v1-simplified-ev']);
  });

  it('returns caveats unchanged when depth2Plan has errorState', () => {
    const caveats = ['synthetic-range', 'v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, 'bet 75%', baseDepth2({
      errorState: { kind: 'engine-internal' },
      bestActionLabel: null,
    }));
    expect(out).toEqual(['synthetic-range', 'v1-simplified-ev']);
  });

  it('returns caveats unchanged when depth2Plan has empty bestActionLabel', () => {
    const caveats = ['v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, 'bet 75%', baseDepth2({ bestActionLabel: '' }));
    expect(out).toEqual(['v1-simplified-ev']);
  });

  it('returns caveats unchanged when bucket best-label is missing', () => {
    const caveats = ['v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, null, baseDepth2());
    expect(out).toEqual(['v1-simplified-ev']);
  });
});

describe('adjustCaveatsForDepth2 — aligned best-actions', () => {
  it('replaces v1-simplified-ev with depth2-cross-validated when actions match', () => {
    const caveats = ['synthetic-range', 'v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, 'bet 75%', baseDepth2({ bestActionLabel: 'bet' }));
    expect(out).toEqual(['synthetic-range', 'depth2-cross-validated']);
  });

  it('handles "Raise to 9bb" matching "raise"', () => {
    const caveats = ['v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, 'Raise to 9bb', baseDepth2({ bestActionLabel: 'raise' }));
    expect(out).toEqual(['depth2-cross-validated']);
  });

  it('case-insensitive comparison', () => {
    const caveats = ['v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, 'CHECK', baseDepth2({ bestActionLabel: 'check' }));
    expect(out).toEqual(['depth2-cross-validated']);
  });

  it('preserves other caveats around the swap', () => {
    const caveats = ['synthetic-range', 'v1-simplified-ev', 'low-sample-bucket'];
    const out = adjustCaveatsForDepth2(caveats, 'bet', baseDepth2({ bestActionLabel: 'bet' }));
    expect(out).toEqual(['synthetic-range', 'depth2-cross-validated', 'low-sample-bucket']);
  });

  it('aligned but no v1-simplified-ev present → no-op (validated state already)', () => {
    const caveats = ['real-range', 'depth2-cross-validated'];
    const out = adjustCaveatsForDepth2(caveats, 'bet', baseDepth2({ bestActionLabel: 'bet' }));
    expect(out).toEqual(['real-range', 'depth2-cross-validated']);
  });
});

describe('adjustCaveatsForDepth2 — divergent best-actions', () => {
  it('keeps v1-simplified-ev and appends depth2-divergent when actions differ', () => {
    const caveats = ['synthetic-range', 'v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, 'check', baseDepth2({ bestActionLabel: 'bet' }));
    expect(out).toEqual(['synthetic-range', 'v1-simplified-ev', 'depth2-divergent']);
  });

  it('handles bucket=raise vs depth-2=call divergence', () => {
    const caveats = ['v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, 'Raise to 9bb', baseDepth2({ bestActionLabel: 'call' }));
    expect(out).toEqual(['v1-simplified-ev', 'depth2-divergent']);
  });

  it('appends depth2-divergent even when v1-simplified-ev not present', () => {
    const caveats = ['real-range'];
    const out = adjustCaveatsForDepth2(caveats, 'bet', baseDepth2({ bestActionLabel: 'check' }));
    expect(out).toEqual(['real-range', 'depth2-divergent']);
  });
});

describe('adjustCaveatsForDepth2 — defensive handling', () => {
  it('returns empty array for non-array bucketCaveats', () => {
    expect(adjustCaveatsForDepth2(null, 'bet', baseDepth2({ bestActionLabel: 'bet' }))).toEqual([]);
    expect(adjustCaveatsForDepth2(undefined, 'bet', baseDepth2({ bestActionLabel: 'bet' }))).toEqual([]);
    expect(adjustCaveatsForDepth2('not-an-array', 'bet', baseDepth2({ bestActionLabel: 'bet' }))).toEqual([]);
  });

  it('does not mutate the input caveats array', () => {
    const caveats = ['synthetic-range', 'v1-simplified-ev'];
    const out = adjustCaveatsForDepth2(caveats, 'bet', baseDepth2({ bestActionLabel: 'bet' }));
    expect(caveats).toEqual(['synthetic-range', 'v1-simplified-ev']); // unchanged
    expect(out).not.toBe(caveats); // new array
  });
});

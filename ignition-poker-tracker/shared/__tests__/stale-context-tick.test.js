/**
 * stale-context-tick.test.js — coverage for the WS-107 single-owner
 * staleContext decision helper.
 */

import { describe, it, expect } from 'vitest';
import {
  evaluateStaleContext,
  STALE_CONTEXT_THRESHOLDS,
} from '../stale-context-tick.js';

const NOW = 100_000_000;
const ctxAt = (receivedAt) => ({ _receivedAt: receivedAt, state: 'FLOP' });

// ───────────────────────────────────────────────────────────────────────────
describe('evaluateStaleContext — full-clear branch (age > 120s)', () => {
  it('fires full-clear at age = 120_001 ms', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 120_001), false)).toEqual({
      action: 'full-clear',
      renderTag: 'stale_full_clear',
    });
  });

  it('fires full-clear at age = 120_001 ms even when already stale', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 120_001), true)).toEqual({
      action: 'full-clear',
      renderTag: 'stale_full_clear',
    });
  });

  it('fires full-clear at very high ages (10 minutes)', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 600_000), true).action).toBe('full-clear');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('evaluateStaleContext — set-stale branch (60s < age <= 120s, not stale)', () => {
  it('fires set-stale at age = 60_001 ms when not currently stale', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 60_001), false)).toEqual({
      action: 'set-stale',
      renderTag: 'stale_indicator',
    });
  });

  it('fires set-stale just below the full-clear boundary', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 120_000), false).action).toBe('set-stale');
  });

  it('does NOT re-fire set-stale when already stale (idempotent no-op)', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 80_000), true)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('evaluateStaleContext — clear-stale branch (NEW; age <= 60s, currently stale)', () => {
  it('fires clear-stale when a fresh push restored age <= 60s but stale flag is still true', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 5_000), true)).toEqual({
      action: 'clear-stale',
      renderTag: 'stale_cleared',
    });
  });

  it('fires clear-stale exactly at the 60s boundary', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 60_000), true).action).toBe('clear-stale');
  });

  it('fires clear-stale at age = 0 (just-arrived push)', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW), true).action).toBe('clear-stale');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('evaluateStaleContext — no-op cases', () => {
  it('returns null when age <= 60s and not currently stale (steady fresh)', () => {
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 30_000), false)).toBeNull();
  });

  it('returns null when ctx is null', () => {
    expect(evaluateStaleContext(NOW, null, false)).toBeNull();
  });

  it('returns null when ctx is undefined', () => {
    expect(evaluateStaleContext(NOW, undefined, false)).toBeNull();
  });

  it('returns null when ctx is missing _receivedAt', () => {
    expect(evaluateStaleContext(NOW, { state: 'FLOP' }, false)).toBeNull();
  });

  it('returns null when _receivedAt is non-numeric', () => {
    expect(evaluateStaleContext(NOW, { _receivedAt: 'never' }, false)).toBeNull();
  });

  it('returns null when _receivedAt is NaN', () => {
    expect(evaluateStaleContext(NOW, { _receivedAt: NaN }, false)).toBeNull();
  });

  it('returns null when now is not a finite number', () => {
    expect(evaluateStaleContext(NaN, ctxAt(0), false)).toBeNull();
    expect(evaluateStaleContext('not-a-number', ctxAt(0), false)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('evaluateStaleContext — boundary semantics (strict >, lenient <=)', () => {
  it('age = 60_000 exactly does NOT trigger set-stale (uses >, not >=)', () => {
    // At exactly the threshold, the original tick used `> 60_000` (strict),
    // and we preserve that to avoid a 60s-flicker bug.
    expect(evaluateStaleContext(NOW, ctxAt(NOW - 60_000), false)).toBeNull();
  });

  it('age = 120_000 exactly does NOT trigger full-clear (uses >, not >=)', () => {
    // The 120s threshold preserved as strict-greater-than for symmetry.
    // At exactly 120_000, the result is set-stale (60_000 < 120_000) when
    // not stale, or null (already stale) when stale.
    const decisionWhenNotStale = evaluateStaleContext(NOW, ctxAt(NOW - 120_000), false);
    expect(decisionWhenNotStale.action).toBe('set-stale');
    const decisionWhenStale = evaluateStaleContext(NOW, ctxAt(NOW - 120_000), true);
    expect(decisionWhenStale).toBeNull();
  });

  it('exposes thresholds as a frozen constants object', () => {
    expect(STALE_CONTEXT_THRESHOLDS.STALE_MS).toBe(60_000);
    expect(STALE_CONTEXT_THRESHOLDS.FULL_CLEAR_MS).toBe(120_000);
    expect(Object.isFrozen(STALE_CONTEXT_THRESHOLDS)).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('evaluateStaleContext — push-restores-freshness scenario (WS-107 regression case)', () => {
  it('full lifecycle: fresh → stale → fresh-via-push → cleared', () => {
    // 1. Fresh data arrives at t=0
    const ctxFresh = { _receivedAt: 0, state: 'FLOP' };
    expect(evaluateStaleContext(0, ctxFresh, false)).toBeNull();

    // 2. 70s later — stale fires
    const decideAt70s = evaluateStaleContext(70_000, ctxFresh, false);
    expect(decideAt70s.action).toBe('set-stale');

    // 3. Push at t=80s updates _receivedAt to 80_000 (push handler does
    // this via coordinator.handleLiveContext; staleContext STAYS true
    // because the push handler no longer writes it directly per WS-107).
    const ctxRefreshed = { _receivedAt: 80_000, state: 'FLOP' };

    // 4. Next tick at t=85s sees age=5s + currently-stale → clear-stale fires.
    const decideAt85s = evaluateStaleContext(85_000, ctxRefreshed, true);
    expect(decideAt85s.action).toBe('clear-stale');

    // 5. Next tick at t=90s sees age=10s + not-stale → no-op.
    const decideAt90s = evaluateStaleContext(90_000, ctxRefreshed, false);
    expect(decideAt90s).toBeNull();
  });
});

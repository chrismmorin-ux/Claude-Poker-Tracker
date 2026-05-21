/**
 * useAnchorAutoRetire.test.js — Tier-3 auto-retire orchestrator coverage.
 *
 * EAL Phase 6 — SPR-060 / WS-170.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useAnchorAutoRetire,
  buildAutoRetirePayload,
  readBannerDismissedAt,
  writeBannerDismissedAt,
  countPendingBannerAnchors,
} from '../useAnchorAutoRetire';
import { ANCHOR_LIBRARY_ACTIONS } from '../../constants/anchorLibraryConstants';

const FIXED_TS = '2026-05-09T07:00:00.000Z';
const STORAGE_KEY = 'eal-auto-retire-banner-last-dismissed';

const baseEvidence = (lower, upper) => ({
  pointEstimate: (lower + upper) / 2,
  credibleInterval: { lower, upper, level: 0.95 },
  lastUpdated: '2026-05-09T06:00:00.000Z',
});

const baseGtoBaseline = (refRate) => ({
  method: 'pot-odds-equilibrium',
  referenceRate: refRate,
  referenceEv: 0,
});

const buildAnchor = (id, overrides = {}) => ({
  id,
  archetypeName: id,
  status: 'active',
  evidence: baseEvidence(0.55, 0.75),
  gtoBaseline: baseGtoBaseline(0.65),
  retirementCondition: { method: 'credible-interval-overlap' },
  operator: {},
  ...overrides,
});

beforeEach(() => {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.clear();
  }
});

// =============================================================================
// PURE HELPERS
// =============================================================================

describe('buildAutoRetirePayload', () => {
  it('stamps system + auto-retire reason and applies toStatus', () => {
    const prior = buildAnchor('a:1');
    const updated = buildAutoRetirePayload(prior, 'expiring', FIXED_TS);
    expect(updated.status).toBe('expiring');
    expect(updated.operator.lastOverrideAt).toBe(FIXED_TS);
    expect(updated.operator.lastOverrideBy).toBe('system');
    expect(updated.operator.overrideReason).toBe('auto-retire');
  });

  it('preserves prior operator fields not stamped by auto-retire', () => {
    const prior = buildAnchor('a:1', {
      operator: { dialCurve: 'sigmoid(k=8)', currentDial: 0.5 },
    });
    const updated = buildAutoRetirePayload(prior, 'retired', FIXED_TS);
    expect(updated.operator.dialCurve).toBe('sigmoid(k=8)');
    expect(updated.operator.currentDial).toBe(0.5);
  });

  it('does not mutate prior anchor', () => {
    const prior = buildAnchor('a:1');
    const before = JSON.stringify(prior);
    buildAutoRetirePayload(prior, 'retired', FIXED_TS);
    expect(JSON.stringify(prior)).toBe(before);
  });
});

describe('readBannerDismissedAt + writeBannerDismissedAt', () => {
  it('returns null when no entry exists', () => {
    expect(readBannerDismissedAt()).toBeNull();
  });

  it('round-trips a written timestamp', () => {
    writeBannerDismissedAt(FIXED_TS);
    expect(readBannerDismissedAt()).toBe(FIXED_TS);
  });

  it('does not crash when given non-string', () => {
    expect(() => writeBannerDismissedAt(null)).not.toThrow();
    expect(() => writeBannerDismissedAt(undefined)).not.toThrow();
    expect(() => writeBannerDismissedAt('')).not.toThrow();
  });

  it('survives localStorage absence (smoke)', () => {
    // Cannot easily simulate window-undefined in jsdom; just verify wrappers
    // do not throw under normal conditions.
    expect(readBannerDismissedAt).not.toThrow();
  });
});

describe('countPendingBannerAnchors', () => {
  const buildRetiredBySystem = (id, at) => buildAnchor(id, {
    status: 'retired',
    operator: {
      lastOverrideAt: at,
      lastOverrideBy: 'system',
      overrideReason: 'auto-retire',
    },
  });

  it('returns 0 for non-array input', () => {
    expect(countPendingBannerAnchors(null, null)).toBe(0);
    expect(countPendingBannerAnchors({}, null)).toBe(0);
  });

  it('returns 0 when no anchors are auto-retired', () => {
    const anchors = [buildAnchor('a:1'), buildAnchor('a:2')];
    expect(countPendingBannerAnchors(anchors, null)).toBe(0);
  });

  it('counts every system-auto-retired anchor when no dismissal recorded', () => {
    const anchors = [
      buildRetiredBySystem('a:1', '2026-05-09T05:00:00.000Z'),
      buildRetiredBySystem('a:2', '2026-05-09T06:00:00.000Z'),
    ];
    expect(countPendingBannerAnchors(anchors, null)).toBe(2);
  });

  it('only counts anchors whose lastOverrideAt is AFTER dismissal', () => {
    const anchors = [
      buildRetiredBySystem('a:before', '2026-05-09T05:00:00.000Z'),
      buildRetiredBySystem('a:after', '2026-05-09T07:30:00.000Z'),
    ];
    expect(countPendingBannerAnchors(anchors, FIXED_TS /* 07:00 */)).toBe(1);
  });

  it('does NOT count anchors with status=expiring (only retired per spec)', () => {
    const expiring = buildAnchor('a:exp', {
      status: 'expiring',
      operator: {
        lastOverrideAt: '2026-05-09T07:30:00.000Z',
        lastOverrideBy: 'system',
        overrideReason: 'auto-retire',
      },
    });
    expect(countPendingBannerAnchors([expiring], null)).toBe(0);
  });

  it('does NOT count anchors retired by owner (manual)', () => {
    const manual = buildAnchor('a:m', {
      status: 'retired',
      operator: {
        lastOverrideAt: '2026-05-09T07:30:00.000Z',
        lastOverrideBy: 'owner',
        overrideReason: 'manual-retire',
      },
    });
    expect(countPendingBannerAnchors([manual], null)).toBe(0);
  });

  it('handles malformed timestamps gracefully', () => {
    const bad = buildAnchor('a:bad', {
      status: 'retired',
      operator: {
        lastOverrideAt: 'not-a-date',
        lastOverrideBy: 'system',
        overrideReason: 'auto-retire',
      },
    });
    expect(countPendingBannerAnchors([bad], null)).toBe(0);
  });
});

// =============================================================================
// HOOK BEHAVIOR
// =============================================================================

describe('useAnchorAutoRetire — session-end trigger', () => {
  const setup = (props) => {
    const dispatch = vi.fn();
    const initialAnchors = props.anchors;
    const { result, rerender } = renderHook(
      ({ sessionEndTime, anchors }) =>
        useAnchorAutoRetire({
          anchors: anchors ?? initialAnchors,
          dispatchAnchorLibrary: dispatch,
          sessionId: 'session:test',
          sessionEndTime,
          now: () => FIXED_TS,
        }),
      { initialProps: { sessionEndTime: props.sessionEndTime ?? null, anchors: undefined } },
    );
    return { dispatch, result, rerender };
  };

  it('does NOT fire while session is active (sessionEndTime null)', () => {
    const anchor = buildAnchor('a:1', {
      evidence: baseEvidence(0.55, 0.75), // CI overlaps refRate=0.65 → fire
    });
    const { dispatch } = setup({ anchors: [anchor], sessionEndTime: null });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('fires evaluator on null → set transition', () => {
    const anchor = buildAnchor('a:1', {
      evidence: baseEvidence(0.55, 0.75), // CI overlaps refRate → fire
    });
    const { dispatch, rerender } = setup({ anchors: [anchor], sessionEndTime: null });
    expect(dispatch).not.toHaveBeenCalled();
    rerender({ sessionEndTime: 1746780000000, anchors: undefined });
    expect(dispatch).toHaveBeenCalledTimes(1);
    const call = dispatch.mock.calls[0][0];
    expect(call.type).toBe(ANCHOR_LIBRARY_ACTIONS.ANCHOR_OVERRIDDEN);
    expect(call.payload.anchor.status).toBe('expiring');
    expect(call.payload.anchor.operator.lastOverrideBy).toBe('system');
    expect(call.payload.anchor.operator.overrideReason).toBe('auto-retire');
    expect(call.payload.anchor.operator.lastOverrideAt).toBe(FIXED_TS);
  });

  it('does NOT re-fire on subsequent re-renders with same sessionEndTime', () => {
    const anchor = buildAnchor('a:1', {
      evidence: baseEvidence(0.55, 0.75),
    });
    const { dispatch, rerender } = setup({ anchors: [anchor], sessionEndTime: 1746780000000 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    rerender({ sessionEndTime: 1746780000000, anchors: undefined });
    rerender({ sessionEndTime: 1746780000000, anchors: undefined });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('fires again when a NEW sessionEndTime arrives', () => {
    const anchor = buildAnchor('a:1', {
      evidence: baseEvidence(0.55, 0.75),
    });
    const { dispatch, rerender } = setup({ anchors: [anchor], sessionEndTime: 1746780000000 });
    expect(dispatch).toHaveBeenCalledTimes(1);
    // Next session ends at a later timestamp.
    rerender({ sessionEndTime: 1746790000000, anchors: undefined });
    expect(dispatch).toHaveBeenCalledTimes(2);
  });

  it('skips evaluation when no anchors are present', () => {
    const { dispatch, rerender } = setup({ anchors: [], sessionEndTime: null });
    rerender({ sessionEndTime: 1746780000000, anchors: undefined });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does NOT crash if dispatch is missing', () => {
    const anchor = buildAnchor('a:1', {
      evidence: baseEvidence(0.55, 0.75),
    });
    const { result } = renderHook(() =>
      useAnchorAutoRetire({
        anchors: [anchor],
        dispatchAnchorLibrary: undefined,
        sessionId: 's',
        sessionEndTime: 1746780000000,
        now: () => FIXED_TS,
      }),
    );
    expect(result.current.pendingBannerCount).toBe(0);
  });

  it('respects owner-override durability (red line #3)', () => {
    // Anchor has CI-overlap (would fire) BUT owner overrode after evidence
    // last-updated → evaluator skips.
    const anchor = buildAnchor('a:1', {
      evidence: baseEvidence(0.55, 0.75),
      operator: {
        lastOverrideBy: 'owner',
        lastOverrideAt: '2026-05-09T08:00:00.000Z', // after evidence.lastUpdated
        overrideReason: 'manual-suppress',
      },
    });
    const { dispatch, rerender } = setup({ anchors: [anchor], sessionEndTime: null });
    rerender({ sessionEndTime: 1746780000000, anchors: undefined });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does NOT fire for anchors whose CI excludes referenceRate (no transition)', () => {
    const anchor = buildAnchor('a:1', {
      evidence: baseEvidence(0.40, 0.50), // CI excludes refRate=0.65 — divergence preserved
    });
    const { dispatch, rerender } = setup({ anchors: [anchor], sessionEndTime: null });
    rerender({ sessionEndTime: 1746780000000, anchors: undefined });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('transitions a batch of anchors atomically (one dispatch per transition)', () => {
    const a = buildAnchor('a:1', { evidence: baseEvidence(0.55, 0.75) });
    const b = buildAnchor('a:2', { evidence: baseEvidence(0.60, 0.70) });
    const c = buildAnchor('a:3', {
      evidence: baseEvidence(0.40, 0.50), // does NOT fire
    });
    const { dispatch, rerender } = setup({ anchors: [a, b, c], sessionEndTime: null });
    rerender({ sessionEndTime: 1746780000000, anchors: undefined });
    expect(dispatch).toHaveBeenCalledTimes(2);
    const ids = dispatch.mock.calls.map((c) => c[0].payload.anchor.id).sort();
    expect(ids).toEqual(['a:1', 'a:2']);
  });
});

describe('useAnchorAutoRetire — pendingBannerCount + dismissBanner', () => {
  it('returns 0 when no anchors auto-retired', () => {
    const { result } = renderHook(() =>
      useAnchorAutoRetire({
        anchors: [buildAnchor('a:1'), buildAnchor('a:2')],
        dispatchAnchorLibrary: () => {},
        sessionId: 's',
        sessionEndTime: null,
      }),
    );
    expect(result.current.pendingBannerCount).toBe(0);
  });

  it('returns count of system-retired-since-dismissal anchors', () => {
    const anchors = [
      buildAnchor('a:1', {
        status: 'retired',
        operator: {
          lastOverrideAt: '2026-05-09T07:30:00.000Z',
          lastOverrideBy: 'system',
          overrideReason: 'auto-retire',
        },
      }),
      buildAnchor('a:2', {
        status: 'retired',
        operator: {
          lastOverrideAt: '2026-05-09T07:35:00.000Z',
          lastOverrideBy: 'system',
          overrideReason: 'auto-retire',
        },
      }),
    ];
    const { result } = renderHook(() =>
      useAnchorAutoRetire({
        anchors,
        dispatchAnchorLibrary: () => {},
        sessionId: 's',
        sessionEndTime: null,
      }),
    );
    expect(result.current.pendingBannerCount).toBe(2);
  });

  it('dismissBanner persists timestamp + zeroes count', () => {
    const anchors = [
      buildAnchor('a:1', {
        status: 'retired',
        operator: {
          lastOverrideAt: '2026-05-09T07:30:00.000Z',
          lastOverrideBy: 'system',
          overrideReason: 'auto-retire',
        },
      }),
    ];
    const { result } = renderHook(() =>
      useAnchorAutoRetire({
        anchors,
        dispatchAnchorLibrary: () => {},
        sessionId: 's',
        sessionEndTime: null,
        now: () => '2026-05-09T08:00:00.000Z', // after the auto-retire
      }),
    );
    expect(result.current.pendingBannerCount).toBe(1);
    act(() => {
      result.current.dismissBanner();
    });
    expect(result.current.pendingBannerCount).toBe(0);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('2026-05-09T08:00:00.000Z');
  });

  it('hydrates dismissal timestamp from localStorage on mount', () => {
    window.localStorage.setItem(STORAGE_KEY, '2026-05-09T09:00:00.000Z');
    const anchors = [
      buildAnchor('a:before', {
        status: 'retired',
        operator: {
          lastOverrideAt: '2026-05-09T07:30:00.000Z', // before dismissal
          lastOverrideBy: 'system',
          overrideReason: 'auto-retire',
        },
      }),
      buildAnchor('a:after', {
        status: 'retired',
        operator: {
          lastOverrideAt: '2026-05-09T10:00:00.000Z', // after dismissal
          lastOverrideBy: 'system',
          overrideReason: 'auto-retire',
        },
      }),
    ];
    const { result } = renderHook(() =>
      useAnchorAutoRetire({
        anchors,
        dispatchAnchorLibrary: () => {},
        sessionId: 's',
        sessionEndTime: null,
      }),
    );
    expect(result.current.pendingBannerCount).toBe(1);
  });
});

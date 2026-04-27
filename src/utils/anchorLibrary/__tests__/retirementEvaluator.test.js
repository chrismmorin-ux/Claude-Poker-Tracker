/**
 * retirementEvaluator.test.js — Tier-3 retirement evaluator unit tests
 *
 * Covers:
 *   - credible-interval-overlap method (CI spans GTO → fire; CI excludes GTO → no-fire)
 *   - gap-threshold method (single-session + consecutive-session logic)
 *   - Status transitions (active→expiring, expiring→retired)
 *   - Terminal / no-op states (candidate / retired / suppressed skipped)
 *   - Owner override durability (red line #3 — override beats auto-retirement)
 *   - Malformed inputs (missing CI, missing referenceRate, missing retirementCondition)
 *   - Batch evaluateAllAnchors aggregation
 */

import { describe, it, expect } from 'vitest';

import {
  evaluateAnchorRetirement,
  evaluateAllAnchors,
} from '../retirementEvaluator';

// ───────────────────────────────────────────────────────────────────────────
// Fixture builders
// ───────────────────────────────────────────────────────────────────────────

/**
 * Minimal anchor for retirement-evaluator tests (does not need full schema
 * validation since evaluator trusts its input per caller contract).
 */
const makeAnchor = (overrides = {}) => ({
  id: 'anchor:test:1',
  status: 'active',
  evidence: {
    pointEstimate: 0.72,
    credibleInterval: { lower: 0.58, upper: 0.83, level: 0.95 },
    lastUpdated: '2026-04-24T12:00:00Z',
  },
  gtoBaseline: {
    method: 'MDF',
    referenceRate: 0.52,
    referenceEv: 0.04,
  },
  retirementCondition: {
    method: 'credible-interval-overlap',
    params: { level: 0.95 },
  },
  operator: {
    currentDial: 0.78,
    // lastOverrideAt + lastOverrideBy intentionally not set for default
  },
  ...overrides,
});

const ctx = (overrides = {}) => ({
  sessionId: 'session-42',
  currentDate: '2026-04-24T20:00:00Z',
  ...overrides,
});

// ───────────────────────────────────────────────────────────────────────────
// credible-interval-overlap method
// ───────────────────────────────────────────────────────────────────────────

describe('evaluateAnchorRetirement — credible-interval-overlap', () => {
  it('does NOT fire when CI is above GTO baseline (no convergence)', () => {
    const anchor = makeAnchor(); // CI [0.58, 0.83], GTO 0.52 → GTO below CI
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).toBeNull();
  });

  it('fires when CI spans GTO baseline — active → expiring', () => {
    const anchor = makeAnchor({
      evidence: {
        pointEstimate: 0.55,
        credibleInterval: { lower: 0.40, upper: 0.65, level: 0.95 },
        lastUpdated: '2026-04-24T12:00:00Z',
      },
    });
    // GTO 0.52 is within [0.40, 0.65] → fires
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).not.toBeNull();
    expect(result.skipped).toBeUndefined();
    expect(result.fromStatus).toBe('active');
    expect(result.toStatus).toBe('expiring');
    expect(result.method).toBe('credible-interval-overlap');
    expect(result.metrics.ciLower).toBe(0.40);
    expect(result.metrics.ciUpper).toBe(0.65);
    expect(result.metrics.referenceRate).toBe(0.52);
  });

  it('fires when CI exactly touches GTO on lower boundary', () => {
    const anchor = makeAnchor({
      evidence: {
        pointEstimate: 0.65,
        credibleInterval: { lower: 0.52, upper: 0.78, level: 0.95 }, // lower === GTO
        lastUpdated: '2026-04-24T12:00:00Z',
      },
    });
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).not.toBeNull();
    expect(result.toStatus).toBe('expiring');
  });

  it('transitions expiring → retired on subsequent fire', () => {
    const anchor = makeAnchor({
      status: 'expiring',
      evidence: {
        pointEstimate: 0.55,
        credibleInterval: { lower: 0.40, upper: 0.65, level: 0.95 },
        lastUpdated: '2026-04-24T12:00:00Z',
      },
    });
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result.fromStatus).toBe('expiring');
    expect(result.toStatus).toBe('retired');
  });

  it('does not fire when CI missing', () => {
    const anchor = makeAnchor({
      evidence: { pointEstimate: 0.55, lastUpdated: '2026-04-24T12:00:00Z' },
    });
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).toBeNull();
  });

  it('does not fire when referenceRate missing', () => {
    const anchor = makeAnchor({
      gtoBaseline: { method: 'MDF', referenceEv: 0.04 },
    });
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// gap-threshold method
// ───────────────────────────────────────────────────────────────────────────

describe('evaluateAnchorRetirement — gap-threshold (single-session)', () => {
  const gapThresholdAnchor = (overrides = {}) => makeAnchor({
    retirementCondition: {
      method: 'gap-threshold',
      params: { gap: 0.05, sessions: 1 }, // single-session variant
    },
    ...overrides,
  });

  it('does NOT fire when current gap > threshold', () => {
    const anchor = gapThresholdAnchor(); // pointEstimate 0.72, GTO 0.52, gap 0.20 > 0.05
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).toBeNull();
  });

  it('fires when current gap ≤ threshold', () => {
    const anchor = gapThresholdAnchor({
      evidence: {
        pointEstimate: 0.55, // gap = 0.03
        credibleInterval: { lower: 0.50, upper: 0.60, level: 0.95 },
        lastUpdated: '2026-04-24T12:00:00Z',
      },
    });
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).not.toBeNull();
    expect(result.method).toBe('gap-threshold');
    expect(result.metrics.currentGap).toBeCloseTo(0.03, 3);
  });

  it('fires when gap exactly equals threshold', () => {
    const anchor = gapThresholdAnchor({
      evidence: {
        pointEstimate: 0.57, // gap = 0.05
        credibleInterval: { lower: 0.50, upper: 0.60, level: 0.95 },
        lastUpdated: '2026-04-24T12:00:00Z',
      },
    });
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).not.toBeNull();
  });
});

describe('evaluateAnchorRetirement — gap-threshold (consecutive-session)', () => {
  const seed02Anchor = (overrides = {}) => makeAnchor({
    retirementCondition: {
      method: 'gap-threshold',
      params: { gap: 0.05, sessions: 10 }, // SEED-02 pattern
    },
    evidence: {
      pointEstimate: 0.45, // gap from GTO 0.43 = 0.02 ≤ 0.05
      credibleInterval: { lower: 0.35, upper: 0.55, level: 0.95 },
      lastUpdated: '2026-04-24T12:00:00Z',
    },
    gtoBaseline: { method: 'pot-odds-equilibrium', referenceRate: 0.43, referenceEv: 0.16 },
    ...overrides,
  });

  it('does NOT fire without sufficient session history', () => {
    const anchor = seed02Anchor();
    const result = evaluateAnchorRetirement(anchor, ctx({ sessionHistory: [] }));
    expect(result).toBeNull(); // current fires but need 9 prior sessions, have 0
  });

  it('does NOT fire when any prior session gap exceeds threshold', () => {
    const anchor = seed02Anchor();
    const sessionHistory = Array.from({ length: 9 }, (_, i) => ({
      sessionId: `s-${i}`,
      closedAt: `2026-04-${14 + i}T20:00:00Z`,
      anchorGaps: { [anchor.id]: i === 5 ? 0.10 : 0.02 }, // one session fails
    }));
    const result = evaluateAnchorRetirement(anchor, ctx({ sessionHistory }));
    expect(result).toBeNull();
  });

  it('fires when all 10 consecutive sessions have gap ≤ threshold', () => {
    const anchor = seed02Anchor();
    const sessionHistory = Array.from({ length: 9 }, (_, i) => ({
      sessionId: `s-${i}`,
      closedAt: `2026-04-${14 + i}T20:00:00Z`,
      anchorGaps: { [anchor.id]: 0.02 }, // all fire
    }));
    const result = evaluateAnchorRetirement(anchor, ctx({ sessionHistory }));
    expect(result).not.toBeNull();
    expect(result.method).toBe('gap-threshold');
    expect(result.metrics.sessionsConsecutive).toBe(10);
  });

  it('counts consecutive sessions accurately in metrics', () => {
    const anchor = seed02Anchor({
      evidence: {
        pointEstimate: 0.55, // gap 0.12 — CURRENT fails
        credibleInterval: { lower: 0.45, upper: 0.65, level: 0.95 },
        lastUpdated: '2026-04-24T12:00:00Z',
      },
    });
    const sessionHistory = Array.from({ length: 9 }, (_, i) => ({
      sessionId: `s-${i}`,
      closedAt: `2026-04-${14 + i}T20:00:00Z`,
      anchorGaps: { [anchor.id]: 0.02 },
    }));
    const result = evaluateAnchorRetirement(anchor, ctx({ sessionHistory }));
    expect(result).toBeNull(); // current session exceeded threshold
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Terminal / no-op states
// ───────────────────────────────────────────────────────────────────────────

describe('evaluateAnchorRetirement — terminal & no-op status', () => {
  const firingAnchor = () => makeAnchor({
    evidence: {
      pointEstimate: 0.55,
      credibleInterval: { lower: 0.40, upper: 0.65, level: 0.95 },
      lastUpdated: '2026-04-24T12:00:00Z',
    },
  });

  it('SKIPS candidate status (never auto-transition)', () => {
    const anchor = firingAnchor();
    anchor.status = 'candidate';
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('status-candidate');
  });

  it('SKIPS retired status (terminal)', () => {
    const anchor = firingAnchor();
    anchor.status = 'retired';
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('status-terminal-retired');
  });

  it('SKIPS suppressed status (explicit user state)', () => {
    const anchor = firingAnchor();
    anchor.status = 'suppressed';
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('status-user-suppressed');
  });

  it('treats missing status as active (defaults to active)', () => {
    const anchor = firingAnchor();
    delete anchor.status;
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).not.toBeNull();
    expect(result.fromStatus).toBe('active');
    expect(result.toStatus).toBe('expiring');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Owner override durability — red line #3
// ───────────────────────────────────────────────────────────────────────────

describe('evaluateAnchorRetirement — owner override durability', () => {
  const firingAnchor = () => makeAnchor({
    evidence: {
      pointEstimate: 0.55,
      credibleInterval: { lower: 0.40, upper: 0.65, level: 0.95 },
      lastUpdated: '2026-04-24T10:00:00Z',
    },
  });

  it('SKIPS when owner override is more recent than evidence update', () => {
    const anchor = firingAnchor();
    anchor.operator.lastOverrideBy = 'owner';
    anchor.operator.lastOverrideAt = '2026-04-24T11:00:00Z'; // after evidence
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('owner-override-durable');
  });

  it('does NOT skip when owner override is OLDER than evidence update', () => {
    const anchor = firingAnchor();
    anchor.operator.lastOverrideBy = 'owner';
    anchor.operator.lastOverrideAt = '2026-04-24T09:00:00Z'; // before evidence
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).not.toBeNull();
    expect(result.skipped).toBeUndefined();
  });

  it('does NOT skip for non-owner lastOverrideBy', () => {
    const anchor = firingAnchor();
    anchor.operator.lastOverrideBy = 'system'; // not 'owner'
    anchor.operator.lastOverrideAt = '2026-04-24T11:00:00Z';
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).not.toBeNull();
  });

  it('treats owner override as binding when evidence timestamp missing', () => {
    const anchor = firingAnchor();
    delete anchor.evidence.lastUpdated;
    anchor.operator.lastOverrideBy = 'owner';
    anchor.operator.lastOverrideAt = '2026-04-24T11:00:00Z';
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result.skipped).toBe(true);
  });

  it('handles malformed override timestamp gracefully (treat as binding)', () => {
    const anchor = firingAnchor();
    anchor.operator.lastOverrideBy = 'owner';
    anchor.operator.lastOverrideAt = 'not-a-date';
    const result = evaluateAnchorRetirement(anchor, ctx());
    // Per implementation: malformed parse → treat as binding (safer default)
    expect(result.skipped).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Input validation
// ───────────────────────────────────────────────────────────────────────────

describe('evaluateAnchorRetirement — input validation', () => {
  it('rejects non-object anchor', () => {
    expect(evaluateAnchorRetirement(null, ctx())).toMatchObject({ skipped: true });
    expect(evaluateAnchorRetirement(undefined, ctx())).toMatchObject({ skipped: true });
    expect(evaluateAnchorRetirement('anchor-id', ctx())).toMatchObject({ skipped: true });
  });

  it('rejects non-object context', () => {
    expect(evaluateAnchorRetirement(makeAnchor(), null)).toMatchObject({ skipped: true });
  });

  it('handles missing retirementCondition gracefully (no-fire)', () => {
    const anchor = makeAnchor();
    delete anchor.retirementCondition;
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).toBeNull();
  });

  it('handles unknown retirement method (no-fire)', () => {
    const anchor = makeAnchor({
      retirementCondition: { method: 'unknown-method', params: {} },
    });
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Batch evaluateAllAnchors
// ───────────────────────────────────────────────────────────────────────────

describe('evaluateAllAnchors', () => {
  it('aggregates transitions + skipped + errors across a batch', () => {
    const anchors = [
      // Fires (active → expiring)
      makeAnchor({
        id: 'a-1',
        evidence: {
          pointEstimate: 0.55,
          credibleInterval: { lower: 0.40, upper: 0.65, level: 0.95 },
          lastUpdated: '2026-04-24T12:00:00Z',
        },
      }),
      // Does not fire (CI excludes GTO)
      makeAnchor({ id: 'a-2' }),
      // Candidate (skipped)
      makeAnchor({ id: 'a-3', status: 'candidate' }),
      // Retired (skipped)
      makeAnchor({ id: 'a-4', status: 'retired' }),
    ];
    const result = evaluateAllAnchors(anchors, ctx());

    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].anchorId).toBe('a-1');
    expect(result.skipped.map((s) => s.anchorId)).toEqual(['a-3', 'a-4']);
    expect(result.errors).toEqual([]);
  });

  it('returns error entry when anchors input is not an array', () => {
    const result = evaluateAllAnchors(null, ctx());
    expect(result.errors).toHaveLength(1);
    expect(result.transitions).toEqual([]);
  });

  it('handles empty anchor array', () => {
    const result = evaluateAllAnchors([], ctx());
    expect(result).toEqual({ transitions: [], skipped: [], errors: [] });
  });

  it('processes each anchor independently (one bad entry does not poison batch)', () => {
    const anchors = [
      makeAnchor({ id: 'a-1' }), // fine
      null,                       // bad input
      makeAnchor({
        id: 'a-2',
        evidence: {
          pointEstimate: 0.55,
          credibleInterval: { lower: 0.40, upper: 0.65, level: 0.95 },
          lastUpdated: '2026-04-24T12:00:00Z',
        },
      }), // fires
    ];
    const result = evaluateAllAnchors(anchors, ctx());
    expect(result.transitions).toHaveLength(1);
    expect(result.transitions[0].anchorId).toBe('a-2');
    expect(result.errors.length + result.skipped.length).toBeGreaterThanOrEqual(1);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Cross-method — integration sketch with authored seed anchors' retirementCondition shapes
// ───────────────────────────────────────────────────────────────────────────

describe('evaluateAnchorRetirement — integrates with authored seed retirementConditions', () => {
  it('seed-01 shape (ci-overlap, level 0.95) — no-fire when observed CI above GTO', () => {
    // From EAL_SEED_01_ANCHOR: CI [0.58, 0.83], GTO 0.54 → does not overlap (both > 0.54)
    const anchor = makeAnchor({
      id: 'anchor:nit:river:overfold:4flush',
      evidence: {
        pointEstimate: 0.72,
        credibleInterval: { lower: 0.58, upper: 0.83, level: 0.95 },
        lastUpdated: '2026-04-24T12:00:00Z',
      },
      gtoBaseline: { method: 'MDF', referenceRate: 0.54, referenceEv: 0.04 },
      retirementCondition: { method: 'credible-interval-overlap', params: { level: 0.95 } },
    });
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result).toBeNull(); // active anchor; divergence still meaningful
  });

  it('seed-02 shape (gap-threshold) — gap parameters read correctly', () => {
    const anchor = makeAnchor({
      id: 'anchor:lag:river:overbluff:turnxx',
      evidence: {
        pointEstimate: 0.62,
        credibleInterval: { lower: 0.48, upper: 0.74, level: 0.95 },
        lastUpdated: '2026-04-24T12:00:00Z',
      },
      gtoBaseline: { method: 'pot-odds-equilibrium', referenceRate: 0.43, referenceEv: 0.16 },
      retirementCondition: { method: 'gap-threshold', params: { gap: 0.05, sessions: 10 } },
    });
    const result = evaluateAnchorRetirement(anchor, ctx({ sessionHistory: [] }));
    // Current gap 0.19 > 0.05, doesn't fire regardless of history
    expect(result).toBeNull();
  });

  it('seed-04 shape (candidate status) — always skipped', () => {
    const anchor = makeAnchor({
      id: 'anchor:tag:flop:overfold:donk-wet',
      status: 'candidate',
      evidence: {
        pointEstimate: 0.64,
        credibleInterval: { lower: 0.48, upper: 0.78, level: 0.95 },
        lastUpdated: '2026-04-24T12:00:00Z',
      },
      gtoBaseline: { method: 'range-balance', referenceRate: 0.32, referenceEv: 0.05 },
      retirementCondition: { method: 'credible-interval-overlap', params: { level: 0.95 } },
    });
    // Even though CI [0.48, 0.78] excludes GTO 0.32, SEED-04 would never fire
    // retirement regardless — it's candidate status.
    const result = evaluateAnchorRetirement(anchor, ctx());
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('status-candidate');
  });
});

// @vitest-environment jsdom
/**
 * status-registry.test.js — Doctrine v7 R-1.11 + V-status §I lint gates
 * for the §I status vocabulary resolved at SHC Gate 4 V-status walkthrough
 * (2026-04-28) and partially implemented at Gate 5 PR-5 (2026-04-29).
 * Provides INV-STATUS-1..5 partial coverage at the helper layer.
 *
 * Asserts:
 *   - Closed 4-tier connection-state register (V-status §I axis-1) —
 *     live / degraded / disconnected / fatal
 *   - Severity ordering: fatal > degraded > disconnected > live
 *     (INV-STATUS-2 monotonicity foundation)
 *   - mapConnStateToTier() bridges the legacy connState shape
 *     ({ connected, cause }) onto the new register, with no-lying-status
 *     defensive default (INV-STATUS-3 — every unknown cause emits a
 *     defined tier)
 *   - applyMonotonicTier() refuses to downgrade visible severity within
 *     the same render frame (INV-STATUS-2)
 *   - applyMonotonicTier() reads canonical data-status-tier attr first,
 *     then canonical .conn-* class, then legacy .green/.yellow/.red as
 *     final fallback
 *   - writeStatusDot() emits canonical declarations (data-status-tier
 *     attr + .conn-* class + legacy color class for unmigrated CSS)
 *   - tier validation throws on values outside the closed enumeration
 *
 * Doctrine source: docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.11.
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §I.
 */

import { describe, it, expect } from 'vitest';
import {
  STATUS_TIERS,
  STATUS_SEVERITY,
  mapConnStateToTier,
  applyMonotonicTier,
  writeStatusDot,
} from '../../shared/render-status.js';

describe('§I status — closed 4-tier connection-state register (V-status §I)', () => {
  it('exposes exactly 4 tiers', () => {
    expect(Object.keys(STATUS_TIERS)).toHaveLength(4);
  });

  it('the 4 tiers are live / degraded / disconnected / fatal', () => {
    expect(Object.values(STATUS_TIERS).sort()).toEqual(
      ['degraded', 'disconnected', 'fatal', 'live'],
    );
  });

  it('STATUS_TIERS is frozen (closed register)', () => {
    expect(Object.isFrozen(STATUS_TIERS)).toBe(true);
  });
});

describe('§I status — severity ordering (INV-STATUS-2)', () => {
  it('STATUS_SEVERITY is frozen', () => {
    expect(Object.isFrozen(STATUS_SEVERITY)).toBe(true);
  });

  it('every tier has a numeric severity', () => {
    for (const tier of Object.values(STATUS_TIERS)) {
      expect(Number.isFinite(STATUS_SEVERITY[tier]), `severity for "${tier}" not numeric`).toBe(true);
    }
  });

  it('severity ordering is fatal > degraded > disconnected > live', () => {
    expect(STATUS_SEVERITY.fatal).toBeGreaterThan(STATUS_SEVERITY.degraded);
    expect(STATUS_SEVERITY.degraded).toBeGreaterThan(STATUS_SEVERITY.disconnected);
    expect(STATUS_SEVERITY.disconnected).toBeGreaterThan(STATUS_SEVERITY.live);
  });
});

describe('mapConnStateToTier — legacy connState bridge (INV-STATUS-3)', () => {
  it('connected: true → LIVE', () => {
    expect(mapConnStateToTier({ connected: true })).toBe(STATUS_TIERS.LIVE);
  });

  it('cause="contextDead" → FATAL', () => {
    expect(mapConnStateToTier({ connected: false, cause: 'contextDead' })).toBe(STATUS_TIERS.FATAL);
  });

  it('cause="disconnect" → DISCONNECTED', () => {
    expect(mapConnStateToTier({ connected: false, cause: 'disconnect' }))
      .toBe(STATUS_TIERS.DISCONNECTED);
  });

  it('cause="versionMismatch" → DEGRADED', () => {
    expect(mapConnStateToTier({ connected: false, cause: 'versionMismatch' }))
      .toBe(STATUS_TIERS.DEGRADED);
  });

  it('null connState → DEGRADED (defensive default — INV-STATUS-3)', () => {
    expect(mapConnStateToTier(null)).toBe(STATUS_TIERS.DEGRADED);
  });

  it('unknown cause → DEGRADED (no-lying-status default)', () => {
    expect(mapConnStateToTier({ connected: false, cause: 'foobar' })).toBe(STATUS_TIERS.DEGRADED);
  });

  it('connected: false with no cause → DEGRADED', () => {
    expect(mapConnStateToTier({ connected: false })).toBe(STATUS_TIERS.DEGRADED);
  });
});

describe('writeStatusDot — canonical declaration emission', () => {
  const makeDot = () => {
    const dot = document.createElement('div');
    dot.className = 'status-dot';
    return dot;
  };

  it('sets data-status-tier attribute', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.LIVE);
    expect(dot.getAttribute('data-status-tier')).toBe('live');
  });

  it('emits canonical .conn-{tier} class', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.FATAL);
    expect(dot.classList.contains('conn-fatal')).toBe(true);
  });

  it('emits legacy color class for unmigrated CSS (live → green)', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.LIVE);
    expect(dot.classList.contains('green')).toBe(true);
  });

  it('emits legacy color class (degraded → yellow)', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.DEGRADED);
    expect(dot.classList.contains('yellow')).toBe(true);
  });

  it('emits legacy color class (fatal → red)', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.FATAL);
    expect(dot.classList.contains('red')).toBe(true);
  });

  it('preserves the structural .status-dot class', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.LIVE);
    expect(dot.classList.contains('status-dot')).toBe(true);
  });

  it('throws on tier outside closed enumeration', () => {
    const dot = makeDot();
    expect(() => writeStatusDot(dot, 'green')).toThrow(/not in closed 4-tier register/);
  });
});

describe('applyMonotonicTier — INV-STATUS-2 monotonic write', () => {
  const makeDot = () => {
    const dot = document.createElement('div');
    dot.className = 'status-dot';
    return dot;
  };

  it('writes when current tier is unknown (no prior class)', () => {
    const dot = makeDot();
    expect(applyMonotonicTier(dot, STATUS_TIERS.DEGRADED)).toBe(STATUS_TIERS.DEGRADED);
    expect(dot.getAttribute('data-status-tier')).toBe('degraded');
  });

  it('writes when new tier is more severe than current', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.LIVE);
    expect(applyMonotonicTier(dot, STATUS_TIERS.FATAL)).toBe(STATUS_TIERS.FATAL);
    expect(dot.getAttribute('data-status-tier')).toBe('fatal');
  });

  it('writes when new tier equals current severity (idempotent)', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.DEGRADED);
    expect(applyMonotonicTier(dot, STATUS_TIERS.DEGRADED)).toBe(STATUS_TIERS.DEGRADED);
    expect(dot.getAttribute('data-status-tier')).toBe('degraded');
  });

  it('REFUSES to downgrade FATAL to DEGRADED (FM-STATUS-1 closure)', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.FATAL);
    const result = applyMonotonicTier(dot, STATUS_TIERS.DEGRADED);
    expect(result).toBe(STATUS_TIERS.FATAL);
    expect(dot.getAttribute('data-status-tier')).toBe('fatal');
  });

  it('REFUSES to downgrade FATAL to DISCONNECTED', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.FATAL);
    expect(applyMonotonicTier(dot, STATUS_TIERS.DISCONNECTED)).toBe(STATUS_TIERS.FATAL);
  });

  it('REFUSES to downgrade DEGRADED to LIVE within same frame', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.DEGRADED);
    expect(applyMonotonicTier(dot, STATUS_TIERS.LIVE)).toBe(STATUS_TIERS.DEGRADED);
  });

  it('reads canonical data-status-tier attribute first', () => {
    const dot = makeDot();
    dot.setAttribute('data-status-tier', 'fatal');
    expect(applyMonotonicTier(dot, STATUS_TIERS.DEGRADED)).toBe(STATUS_TIERS.FATAL);
  });

  it('reads legacy .red class as FATAL when canonical attr/class absent', () => {
    const dot = makeDot();
    dot.classList.add('red');
    expect(applyMonotonicTier(dot, STATUS_TIERS.DEGRADED)).toBe(STATUS_TIERS.FATAL);
  });

  it('reads legacy .yellow class as DEGRADED', () => {
    const dot = makeDot();
    dot.classList.add('yellow');
    expect(applyMonotonicTier(dot, STATUS_TIERS.LIVE)).toBe(STATUS_TIERS.DEGRADED);
  });

  it('reads legacy .green class as LIVE (allowed to upgrade)', () => {
    const dot = makeDot();
    dot.classList.add('green');
    expect(applyMonotonicTier(dot, STATUS_TIERS.FATAL)).toBe(STATUS_TIERS.FATAL);
  });

  it('throws on tier outside closed enumeration', () => {
    const dot = makeDot();
    expect(() => applyMonotonicTier(dot, 'green')).toThrow(/not in closed 4-tier register/);
  });

  it('returns null when called with no element', () => {
    expect(applyMonotonicTier(null, STATUS_TIERS.LIVE)).toBeNull();
  });
});

// @vitest-environment jsdom
/**
 * status-registry.test.js — Doctrine v7 R-1.11 + V-status §I lint gates
 * for the §I status vocabulary resolved at SHC Gate 4 V-status walkthrough
 * (2026-04-28). Gate 5 PR-5 introduced the canonical writer + a
 * legacy-class bridge; Gate 5 PR-6 migrated all 5 writer sites and deleted
 * the bridge — the .green/.yellow/.red color-literal classes are no
 * longer emitted or read by any production writer, so the read/emit
 * fallback tests were dropped here at PR-6.
 *
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
 *     then canonical .conn-* class as fallback
 *   - writeStatusDot() emits canonical declarations only (data-status-tier
 *     attr + .conn-* class — no legacy color-literal classes)
 *   - tier validation throws on values outside the closed enumeration
 *
 * Doctrine source: docs/SIDEBAR_DESIGN_PRINCIPLES.md §1 R-1.11.
 * Shell-spec source: docs/design/surfaces/sidebar-shell-spec.md §I.
 */

import { describe, it, expect } from 'vitest';
import {
  STATUS_TIERS,
  STATUS_SEVERITY,
  STATUS_APP_TIERS,
  STATUS_PIPELINE_TIERS,
  mapConnStateToTier,
  mapAppConnectedToTier,
  applyMonotonicTier,
  writeStatusDot,
  writeAppStatusBadge,
  writePipelineStageDot,
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

  it('does NOT emit legacy color-literal classes (PR-6 bridge removal)', () => {
    const tiers = [STATUS_TIERS.LIVE, STATUS_TIERS.DEGRADED, STATUS_TIERS.DISCONNECTED, STATUS_TIERS.FATAL];
    for (const tier of tiers) {
      const dot = makeDot();
      writeStatusDot(dot, tier);
      expect(dot.classList.contains('green')).toBe(false);
      expect(dot.classList.contains('yellow')).toBe(false);
      expect(dot.classList.contains('red')).toBe(false);
    }
  });

  it('emits exactly 2 classes — structural .status-dot and canonical .conn-{tier}', () => {
    const dot = makeDot();
    writeStatusDot(dot, STATUS_TIERS.LIVE);
    expect(Array.from(dot.classList).sort()).toEqual(['conn-live', 'status-dot']);
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

  it('reads canonical .conn-{tier} class when attr absent', () => {
    const dot = makeDot();
    dot.classList.add('conn-fatal');
    expect(applyMonotonicTier(dot, STATUS_TIERS.DEGRADED)).toBe(STATUS_TIERS.FATAL);
  });

  it('IGNORES legacy color-literal classes (PR-6 read fallback removed)', () => {
    // Defensive lock: if a stray .red/.yellow/.green legacy class somehow
    // appeared (e.g., DOM clobbering), the read fallback no longer maps it
    // to a tier — applyMonotonicTier treats the dot as untiered and
    // applies the new tier unconditionally.
    const dot = makeDot();
    dot.classList.add('red');
    expect(applyMonotonicTier(dot, STATUS_TIERS.LIVE)).toBe(STATUS_TIERS.LIVE);
  });

  it('throws on tier outside closed enumeration', () => {
    const dot = makeDot();
    expect(() => applyMonotonicTier(dot, 'green')).toThrow(/not in closed 4-tier register/);
  });

  it('returns null when called with no element', () => {
    expect(applyMonotonicTier(null, STATUS_TIERS.LIVE)).toBeNull();
  });
});

// =============================================================================
// V-status §I axis-2 — APP-BRIDGE-STATE (Gate 5 PR-7)
// =============================================================================
// Closed 2-tier binary register. App-bridge state is authoritative — no
// monotonicity helper, since both writer sites (production updateAppStatus
// + harness app-badge writer) are unique sources of truth for their
// respective surfaces.

describe('§I status — closed 2-tier app-bridge-state register (axis-2)', () => {
  it('exposes exactly 2 tiers', () => {
    expect(Object.keys(STATUS_APP_TIERS)).toHaveLength(2);
  });

  it('the 2 tiers are synced / absent', () => {
    expect(Object.values(STATUS_APP_TIERS).sort()).toEqual(['absent', 'synced']);
  });

  it('STATUS_APP_TIERS is frozen (closed register)', () => {
    expect(Object.isFrozen(STATUS_APP_TIERS)).toBe(true);
  });
});

describe('mapAppConnectedToTier — boolean bridge (INV-STATUS-3)', () => {
  it('true → SYNCED', () => {
    expect(mapAppConnectedToTier(true)).toBe(STATUS_APP_TIERS.SYNCED);
  });

  it('false → ABSENT', () => {
    expect(mapAppConnectedToTier(false)).toBe(STATUS_APP_TIERS.ABSENT);
  });

  it('null / undefined → ABSENT (defensive default — no-lying-status)', () => {
    expect(mapAppConnectedToTier(null)).toBe(STATUS_APP_TIERS.ABSENT);
    expect(mapAppConnectedToTier(undefined)).toBe(STATUS_APP_TIERS.ABSENT);
  });
});

describe('writeAppStatusBadge — canonical declaration emission', () => {
  const makeBadge = () => {
    const badge = document.createElement('span');
    badge.className = 'app-status';
    return badge;
  };

  it('sets data-app-status-tier attribute', () => {
    const badge = makeBadge();
    writeAppStatusBadge(badge, STATUS_APP_TIERS.SYNCED);
    expect(badge.getAttribute('data-app-status-tier')).toBe('synced');
  });

  it('emits canonical .app-{tier} class', () => {
    const badge = makeBadge();
    writeAppStatusBadge(badge, STATUS_APP_TIERS.ABSENT);
    expect(badge.classList.contains('app-absent')).toBe(true);
  });

  it('emits exactly 2 classes — structural .app-status + canonical .app-{tier}', () => {
    const badge = makeBadge();
    writeAppStatusBadge(badge, STATUS_APP_TIERS.SYNCED);
    expect(Array.from(badge.classList).sort()).toEqual(['app-status', 'app-synced']);
  });

  it('does NOT emit legacy .connected/.disconnected classes', () => {
    const badge = makeBadge();
    writeAppStatusBadge(badge, STATUS_APP_TIERS.SYNCED);
    expect(badge.classList.contains('connected')).toBe(false);
    expect(badge.classList.contains('disconnected')).toBe(false);
  });

  it('pairs SYNCED tier with "App synced" text', () => {
    const badge = makeBadge();
    writeAppStatusBadge(badge, STATUS_APP_TIERS.SYNCED);
    expect(badge.textContent).toBe('App synced');
  });

  it('pairs ABSENT tier with "App not open" text', () => {
    const badge = makeBadge();
    writeAppStatusBadge(badge, STATUS_APP_TIERS.ABSENT);
    expect(badge.textContent).toBe('App not open');
  });

  it('throws on tier outside closed enumeration', () => {
    const badge = makeBadge();
    expect(() => writeAppStatusBadge(badge, 'connected')).toThrow(
      /not in closed 2-tier register/,
    );
  });

  it('returns silently when called with no element', () => {
    expect(() => writeAppStatusBadge(null, STATUS_APP_TIERS.SYNCED)).not.toThrow();
  });

  it('toggles between tiers cleanly (no class accumulation)', () => {
    const badge = makeBadge();
    writeAppStatusBadge(badge, STATUS_APP_TIERS.SYNCED);
    writeAppStatusBadge(badge, STATUS_APP_TIERS.ABSENT);
    expect(badge.classList.contains('app-synced')).toBe(false);
    expect(badge.classList.contains('app-absent')).toBe(true);
    writeAppStatusBadge(badge, STATUS_APP_TIERS.SYNCED);
    expect(badge.classList.contains('app-synced')).toBe(true);
    expect(badge.classList.contains('app-absent')).toBe(false);
  });
});

// =============================================================================
// V-status §I axis-3 — PIPELINE-STAGE-HEALTH (Gate 5 PR-8)
// =============================================================================
// Closed 4-tier register reflecting the codebase's actual operator-
// distinguishable states. The shell-spec outline declared a binary
// {nominal, failed} shape; PR-8 promotes it to the 4-tier register since
// `unknown` and `warn` each carry distinct actionable information.

describe('§I status — closed 4-tier pipeline-stage register (axis-3)', () => {
  it('exposes exactly 4 tiers', () => {
    expect(Object.keys(STATUS_PIPELINE_TIERS)).toHaveLength(4);
  });

  it('the 4 tiers are ok / warn / fail / unknown', () => {
    expect(Object.values(STATUS_PIPELINE_TIERS).sort()).toEqual(
      ['fail', 'ok', 'unknown', 'warn'],
    );
  });

  it('STATUS_PIPELINE_TIERS is frozen (closed register)', () => {
    expect(Object.isFrozen(STATUS_PIPELINE_TIERS)).toBe(true);
  });
});

describe('writePipelineStageDot — canonical declaration emission', () => {
  const makeDot = () => {
    const dot = document.createElement('div');
    dot.className = 'stage-dot';
    return dot;
  };

  it('sets data-pipeline-tier attribute', () => {
    const dot = makeDot();
    writePipelineStageDot(dot, STATUS_PIPELINE_TIERS.OK);
    expect(dot.getAttribute('data-pipeline-tier')).toBe('ok');
  });

  it('emits canonical .pipeline-{tier} class', () => {
    const dot = makeDot();
    writePipelineStageDot(dot, STATUS_PIPELINE_TIERS.FAIL);
    expect(dot.classList.contains('pipeline-fail')).toBe(true);
  });

  it('emits exactly 2 classes — structural .stage-dot + canonical .pipeline-{tier}', () => {
    const dot = makeDot();
    writePipelineStageDot(dot, STATUS_PIPELINE_TIERS.WARN);
    expect(Array.from(dot.classList).sort()).toEqual(['pipeline-warn', 'stage-dot']);
  });

  it('does NOT emit legacy bare-token classes (.ok / .warn / .fail / .unknown)', () => {
    // Defensive lock against PR-8 bridge regression: the canonical writer
    // emits the namespaced .pipeline-* class; the bare tokens are gone.
    const tiers = [
      STATUS_PIPELINE_TIERS.OK,
      STATUS_PIPELINE_TIERS.WARN,
      STATUS_PIPELINE_TIERS.FAIL,
      STATUS_PIPELINE_TIERS.UNKNOWN,
    ];
    for (const tier of tiers) {
      const dot = makeDot();
      writePipelineStageDot(dot, tier);
      // The exact tier value (e.g., 'ok') must not appear as a standalone
      // class; only the namespaced 'pipeline-ok' is allowed.
      expect(dot.classList.contains(tier)).toBe(false);
    }
  });

  it('preserves the structural .stage-dot class', () => {
    const dot = makeDot();
    writePipelineStageDot(dot, STATUS_PIPELINE_TIERS.OK);
    expect(dot.classList.contains('stage-dot')).toBe(true);
  });

  it('throws on tier outside closed enumeration', () => {
    const dot = makeDot();
    expect(() => writePipelineStageDot(dot, 'green')).toThrow(
      /not in closed 4-tier register/,
    );
  });

  it('returns silently when called with no element', () => {
    expect(() => writePipelineStageDot(null, STATUS_PIPELINE_TIERS.OK)).not.toThrow();
  });

  it('toggles between tiers cleanly (no class accumulation)', () => {
    const dot = makeDot();
    writePipelineStageDot(dot, STATUS_PIPELINE_TIERS.UNKNOWN);
    writePipelineStageDot(dot, STATUS_PIPELINE_TIERS.WARN);
    writePipelineStageDot(dot, STATUS_PIPELINE_TIERS.FAIL);
    expect(dot.classList.contains('pipeline-unknown')).toBe(false);
    expect(dot.classList.contains('pipeline-warn')).toBe(false);
    expect(dot.classList.contains('pipeline-fail')).toBe(true);
    writePipelineStageDot(dot, STATUS_PIPELINE_TIERS.OK);
    expect(dot.classList.contains('pipeline-fail')).toBe(false);
    expect(dot.classList.contains('pipeline-ok')).toBe(true);
  });
});

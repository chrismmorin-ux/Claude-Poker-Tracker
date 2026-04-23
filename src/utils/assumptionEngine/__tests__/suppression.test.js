import { describe, it, expect } from 'vitest';
import {
  resolveSuppressions,
  findSuppressionCycles,
  topologicalSuppressionOrder,
  SuppressionCycleError,
} from '../suppression';

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

const makeAssumption = ({ id, suppresses = [], actionable = true, dial = 0.7 }) => ({
  id,
  operator: {
    currentDial: dial,
    suppresses,
  },
  quality: {
    actionableInDrill: actionable,
    actionableLive: actionable,
    actionable,
  },
});

// ───────────────────────────────────────────────────────────────────────────
// resolveSuppressions — basic behavior
// ───────────────────────────────────────────────────────────────────────────

describe('resolveSuppressions — empty / single', () => {
  it('returns empty for empty input', () => {
    expect(resolveSuppressions([])).toEqual([]);
  });

  it('returns null-safe for null input', () => {
    expect(resolveSuppressions(null)).toEqual([]);
  });

  it('single assumption with no suppresses returns unchanged', () => {
    const a = makeAssumption({ id: 'a1' });
    const result = resolveSuppressions([a]);
    expect(result[0].operator.currentDial).toBe(0.7);
  });
});

describe('resolveSuppressions — trap problem (T1 suppresses L1)', () => {
  it('actionable suppressor zeros suppressed dial', () => {
    const t1 = makeAssumption({ id: 't1', suppresses: ['l1'], actionable: true });
    const l1 = makeAssumption({ id: 'l1', actionable: true });
    const result = resolveSuppressions([t1, l1]);
    const resolvedL1 = result.find((a) => a.id === 'l1');
    expect(resolvedL1.operator.currentDial).toBe(0);
    expect(resolvedL1.operator.suppressedBy).toBe('t1');
    // Suppressor itself untouched
    const resolvedT1 = result.find((a) => a.id === 't1');
    expect(resolvedT1.operator.currentDial).toBe(0.7);
  });

  it('non-actionable suppressor does NOT zero suppressed dial', () => {
    const t1 = makeAssumption({ id: 't1', suppresses: ['l1'], actionable: false });
    const l1 = makeAssumption({ id: 'l1', actionable: true });
    const result = resolveSuppressions([t1, l1]);
    const resolvedL1 = result.find((a) => a.id === 'l1');
    expect(resolvedL1.operator.currentDial).toBe(0.7);
    expect(resolvedL1.operator.suppressedBy).toBeUndefined();
  });

  it('suppression to unknown ID is no-op (silent)', () => {
    const t1 = makeAssumption({ id: 't1', suppresses: ['nonexistent'], actionable: true });
    const result = resolveSuppressions([t1]);
    expect(result[0].operator.currentDial).toBe(0.7);
  });
});

describe('resolveSuppressions — multiple suppressors', () => {
  it('one suppressor affects multiple suppressed', () => {
    const t1 = makeAssumption({ id: 't1', suppresses: ['a', 'b', 'c'], actionable: true });
    const a = makeAssumption({ id: 'a' });
    const b = makeAssumption({ id: 'b' });
    const c = makeAssumption({ id: 'c' });
    const d = makeAssumption({ id: 'd' }); // not suppressed
    const result = resolveSuppressions([t1, a, b, c, d]);
    expect(result.find((x) => x.id === 'a').operator.currentDial).toBe(0);
    expect(result.find((x) => x.id === 'b').operator.currentDial).toBe(0);
    expect(result.find((x) => x.id === 'c').operator.currentDial).toBe(0);
    expect(result.find((x) => x.id === 'd').operator.currentDial).toBe(0.7);
  });

  it('multiple actionable suppressors with shared target: last wins on suppressedBy', () => {
    const t1 = makeAssumption({ id: 't1', suppresses: ['x'], actionable: true });
    const t2 = makeAssumption({ id: 't2', suppresses: ['x'], actionable: true });
    const x = makeAssumption({ id: 'x' });
    const result = resolveSuppressions([t1, t2, x]);
    const resolvedX = result.find((a) => a.id === 'x');
    expect(resolvedX.operator.currentDial).toBe(0);
    // suppressedBy is set — doesn't matter which; test doesn't over-specify
    expect(resolvedX.operator.suppressedBy).toBeDefined();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Cycle detection (I-AE-4)
// ───────────────────────────────────────────────────────────────────────────

describe('resolveSuppressions — cycle detection (I-AE-4)', () => {
  it('throws SuppressionCycleError on direct cycle (A → B → A)', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['b'] });
    const b = makeAssumption({ id: 'b', suppresses: ['a'] });
    expect(() => resolveSuppressions([a, b])).toThrow(SuppressionCycleError);
  });

  it('throws on 3-node cycle (A → B → C → A)', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['b'] });
    const b = makeAssumption({ id: 'b', suppresses: ['c'] });
    const c = makeAssumption({ id: 'c', suppresses: ['a'] });
    expect(() => resolveSuppressions([a, b, c])).toThrow(SuppressionCycleError);
  });

  it('throws on self-loop (A → A)', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['a'] });
    expect(() => resolveSuppressions([a])).toThrow(SuppressionCycleError);
  });

  it('linear chain (A → B → C) does NOT throw', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['b'] });
    const b = makeAssumption({ id: 'b', suppresses: ['c'] });
    const c = makeAssumption({ id: 'c' });
    expect(() => resolveSuppressions([a, b, c])).not.toThrow();
  });

  it('error carries cycle path for diagnostics', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['b'] });
    const b = makeAssumption({ id: 'b', suppresses: ['a'] });
    try {
      resolveSuppressions([a, b]);
      expect.fail('should have thrown');
    } catch (e) {
      expect(e.name).toBe('SuppressionCycleError');
      expect(Array.isArray(e.cycles)).toBe(true);
      expect(e.cycles.length).toBeGreaterThan(0);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
// findSuppressionCycles (diagnostic, non-throwing)
// ───────────────────────────────────────────────────────────────────────────

describe('findSuppressionCycles', () => {
  it('returns empty array when no cycles', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['b'] });
    const b = makeAssumption({ id: 'b' });
    expect(findSuppressionCycles([a, b])).toEqual([]);
  });

  it('detects a single cycle', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['b'] });
    const b = makeAssumption({ id: 'b', suppresses: ['a'] });
    const cycles = findSuppressionCycles([a, b]);
    expect(cycles.length).toBeGreaterThan(0);
    const cycle = cycles[0];
    expect(cycle).toContain('a');
    expect(cycle).toContain('b');
  });

  it('does not throw on malformed input', () => {
    expect(findSuppressionCycles(null)).toEqual([]);
    expect(findSuppressionCycles([])).toEqual([]);
    expect(findSuppressionCycles([{ id: null }])).toEqual([]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// topologicalSuppressionOrder
// ───────────────────────────────────────────────────────────────────────────

describe('topologicalSuppressionOrder', () => {
  it('returns empty for empty input', () => {
    expect(topologicalSuppressionOrder([])).toEqual([]);
  });

  it('places suppressors before suppressed', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['b'] });
    const b = makeAssumption({ id: 'b' });
    const order = topologicalSuppressionOrder([a, b]);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'));
  });

  it('throws on cycle', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['b'] });
    const b = makeAssumption({ id: 'b', suppresses: ['a'] });
    expect(() => topologicalSuppressionOrder([a, b])).toThrow(SuppressionCycleError);
  });

  it('handles disconnected components', () => {
    const a = makeAssumption({ id: 'a', suppresses: ['b'] });
    const b = makeAssumption({ id: 'b' });
    const c = makeAssumption({ id: 'c' }); // disconnected
    const order = topologicalSuppressionOrder([a, b, c]);
    expect(order).toHaveLength(3);
    expect(order).toContain('a');
    expect(order).toContain('b');
    expect(order).toContain('c');
  });
});

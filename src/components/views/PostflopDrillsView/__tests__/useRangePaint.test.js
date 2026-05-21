// @vitest-environment jsdom
/**
 * useRangePaint.test.js — Range Lab Phase 1 (WS-056).
 *
 * Per-stroke undo/redo (ADR-008): tap-toggle and slider-Apply each = one entry;
 * undo reverses exactly one cell; redo clears on new mutation; clear-all wipes
 * the range AND both stacks (not undo-recoverable).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRangePaint } from '../useRangePaint';
import { rangeIndex } from '../../../../utils/pokerCore/rangeMatrix';

const AA = rangeIndex(12, 12, false);
const KK = rangeIndex(11, 11, false);
const QQ = rangeIndex(10, 10, false);

describe('useRangePaint — paint + per-stroke undo', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('tapCell toggles 0 → 1 → 0 and tracks dirty', () => {
    const { result } = renderHook(() => useRangePaint({ enabled: false }));
    expect(result.current.isDirty).toBe(false);

    act(() => result.current.tapCell(AA));
    expect(result.current.range[AA]).toBe(1);
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.tapCell(AA));
    expect(result.current.range[AA]).toBe(0);
  });

  it('applyWeight sets a clamped partial weight', () => {
    const { result } = renderHook(() => useRangePaint({ enabled: false }));
    act(() => result.current.applyWeight(AA, 0.4));
    expect(result.current.range[AA]).toBeCloseTo(0.4, 6);
    act(() => result.current.applyWeight(AA, 1.7)); // clamps to 1
    expect(result.current.range[AA]).toBe(1);
  });

  it('undo reverses exactly one stroke; redo re-applies it', () => {
    const { result } = renderHook(() => useRangePaint({ enabled: false }));
    act(() => result.current.tapCell(AA));
    act(() => result.current.tapCell(KK));
    act(() => result.current.tapCell(QQ));
    expect([result.current.range[AA], result.current.range[KK], result.current.range[QQ]]).toEqual([1, 1, 1]);

    act(() => result.current.undo());
    expect(result.current.range[QQ]).toBe(0); // only the last reverts
    expect(result.current.range[AA]).toBe(1);
    expect(result.current.range[KK]).toBe(1);

    act(() => result.current.redo());
    expect(result.current.range[QQ]).toBe(1);
  });

  it('a new mutation clears the redo stack', () => {
    const { result } = renderHook(() => useRangePaint({ enabled: false }));
    act(() => result.current.tapCell(AA));
    act(() => result.current.undo());
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.tapCell(KK));
    expect(result.current.canRedo).toBe(false);
  });

  it('clearAll empties the range and both undo/redo stacks', () => {
    const { result } = renderHook(() => useRangePaint({ enabled: false }));
    act(() => result.current.tapCell(AA));
    act(() => result.current.tapCell(KK));
    act(() => result.current.clearAll());
    expect(result.current.range[AA]).toBe(0);
    expect(result.current.range[KK]).toBe(0);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('save then restore preserves the painted range', () => {
    const { result: a } = renderHook(() => useRangePaint({ enabled: false }));
    act(() => a.current.tapCell(AA));
    act(() => a.current.applyWeight(KK, 0.25));
    act(() => { a.current.save(['K♠', '7♥', '2♦']); });
    expect(a.current.isDirty).toBe(false);

    const { result: b } = renderHook(() => useRangePaint({ enabled: false }));
    let restoredBoard;
    act(() => { restoredBoard = b.current.restore(); });
    expect(restoredBoard).toEqual(['K♠', '7♥', '2♦']);
    expect(b.current.range[AA]).toBeCloseTo(1, 6);
    expect(b.current.range[KK]).toBeCloseTo(0.25, 6);
  });
});

/**
 * useAnchorCardLongPress.test.js — long-press detector + tooltip-gate tests.
 *
 * EAL Phase 6 — Session 20 (S20).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useAnchorCardLongPress,
  useLongPressTooltipState,
  LONG_PRESS_THRESHOLD_MS,
  MOTION_CANCEL_PX,
  TOOLTIP_DISMISSED_KEY,
} from '../useAnchorCardLongPress';

const buildPointerEvent = (overrides = {}) => ({
  button: 0,
  clientX: 0,
  clientY: 0,
  ...overrides,
});

describe('useAnchorCardLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exports expected constants', () => {
    expect(LONG_PRESS_THRESHOLD_MS).toBe(400);
    expect(MOTION_CANCEL_PX).toBe(10);
    expect(TOOLTIP_DISMISSED_KEY).toBe('eal:longPressTooltip:dismissed');
  });

  it('fires onLongPress after the 400ms threshold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent());
    });
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire if pointer-up before threshold', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent());
      vi.advanceTimersByTime(200);
      result.current.pressHandlers.onPointerUp();
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels on pointer-leave', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent());
      vi.advanceTimersByTime(100);
      result.current.pressHandlers.onPointerLeave();
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels on pointer-cancel', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent());
      vi.advanceTimersByTime(100);
      result.current.pressHandlers.onPointerCancel();
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels when motion exceeds MOTION_CANCEL_PX', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent({ clientX: 100, clientY: 100 }));
      vi.advanceTimersByTime(100);
      // Move 15px in y (Math.hypot(0, 15) > 10) — should cancel
      result.current.pressHandlers.onPointerMove(buildPointerEvent({ clientX: 100, clientY: 115 }));
      vi.advanceTimersByTime(500);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('tolerates micro-jitter below MOTION_CANCEL_PX', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent({ clientX: 100, clientY: 100 }));
      vi.advanceTimersByTime(100);
      // Move 5px (Math.hypot(3, 4) = 5 < 10) — should NOT cancel
      result.current.pressHandlers.onPointerMove(buildPointerEvent({ clientX: 103, clientY: 104 }));
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('ignores secondary mouse buttons (right-click, middle-click)', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent({ button: 2 }));
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('invokes onFire callback alongside onLongPress', () => {
    const onLongPress = vi.fn();
    const onFire = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress, onFire }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent());
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('respects custom threshold prop', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress, threshold: 100 }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent());
      vi.advanceTimersByTime(100);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('isPressing flips during press', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useAnchorCardLongPress({ onLongPress }));

    expect(result.current.isPressing).toBe(false);
    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent());
    });
    expect(result.current.isPressing).toBe(true);
    act(() => {
      result.current.pressHandlers.onPointerUp();
    });
    expect(result.current.isPressing).toBe(false);
  });

  it('handles missing onLongPress without crashing', () => {
    const { result } = renderHook(() => useAnchorCardLongPress());
    expect(() => {
      act(() => {
        result.current.pressHandlers.onPointerDown(buildPointerEvent());
        vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
      });
    }).not.toThrow();
  });

  it('clears timer on unmount to prevent leaks', () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() => useAnchorCardLongPress({ onLongPress }));

    act(() => {
      result.current.pressHandlers.onPointerDown(buildPointerEvent());
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_THRESHOLD_MS);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

describe('useLongPressTooltipState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows tooltip on first mount when localStorage key absent', () => {
    const { result } = renderHook(() => useLongPressTooltipState());
    expect(result.current.showTooltip).toBe(true);
    expect(result.current.hasDismissed).toBe(false);
  });

  it('hides tooltip when localStorage key already set', () => {
    localStorage.setItem(TOOLTIP_DISMISSED_KEY, 'true');
    const { result } = renderHook(() => useLongPressTooltipState());
    expect(result.current.showTooltip).toBe(false);
    expect(result.current.hasDismissed).toBe(true);
  });

  it('dismissTooltip flips state + persists to localStorage', () => {
    const { result } = renderHook(() => useLongPressTooltipState());
    expect(result.current.showTooltip).toBe(true);

    act(() => {
      result.current.dismissTooltip();
    });

    expect(result.current.showTooltip).toBe(false);
    expect(localStorage.getItem(TOOLTIP_DISMISSED_KEY)).toBe('true');
  });

  it('dismissed state survives a fresh hook instance (page reload simulation)', () => {
    const { result: r1 } = renderHook(() => useLongPressTooltipState());
    act(() => {
      r1.current.dismissTooltip();
    });

    const { result: r2 } = renderHook(() => useLongPressTooltipState());
    expect(r2.current.showTooltip).toBe(false);
  });

  it('handles localStorage parse errors gracefully', () => {
    // Force read failure by stubbing getItem to throw
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('quota');
    };

    expect(() => {
      const { result } = renderHook(() => useLongPressTooltipState());
      // Default to "show tooltip" on read error
      expect(result.current.showTooltip).toBe(true);
    }).not.toThrow();

    Storage.prototype.getItem = original;
  });

  it('handles localStorage write errors gracefully', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('quota');
    };

    const { result } = renderHook(() => useLongPressTooltipState());
    expect(() => {
      act(() => {
        result.current.dismissTooltip();
      });
    }).not.toThrow();
    // In-memory state still flips even though persistence failed
    expect(result.current.showTooltip).toBe(false);

    Storage.prototype.setItem = original;
  });
});

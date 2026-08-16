// @vitest-environment jsdom
/**
 * useCanvasFit — the portrait auto-rotate fallback (WS-440).
 *
 * The founder ruling this encodes: orientation may NEVER block the app.
 * RotateDeviceHint (the full-screen "please rotate" wall) is deleted; in its
 * place, a portrait viewport on a touch device renders the 1600×720 canvas
 * rotated 90° and fitted against the SWAPPED viewport dimensions. Fine-pointer
 * (desktop) viewports never rotate — a tall window next to the Ignition client
 * gets plain scale-to-fit.
 *
 * These tests pin:
 *   1. the rotation predicate (portrait × pointer type),
 *   2. the swapped-dimension scale math,
 *   3. the transform string the canvas sites apply,
 *   4. recovery on rotate-away/rotate-back mid-entry (WS-440 accept criterion),
 *      including the late-settling `orientationchange` re-measure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCanvasFit, measureCanvasFit, canvasTransform } from '../useCanvasFit';
import { LAYOUT } from '../../constants/gameConstants';

const setViewport = (width, height) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
};

const setCoarsePointer = (coarse) => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

const fitScale = (fitWidth, fitHeight) =>
  Math.min(
    (fitWidth * 0.95) / LAYOUT.TABLE_WIDTH,
    (fitHeight * 0.95) / LAYOUT.TABLE_HEIGHT,
    1
  );

describe('measureCanvasFit', () => {
  afterEach(() => {
    delete window.matchMedia;
  });

  it('landscape viewport: no rotation, scale fits width/height directly', () => {
    setViewport(1600, 720);
    setCoarsePointer(true);
    const { scale, rotated } = measureCanvasFit();
    expect(rotated).toBe(false);
    expect(scale).toBeCloseTo(0.95, 5);
  });

  it('portrait touch viewport rotates and fits against swapped dimensions', () => {
    // Samsung Galaxy A22 portrait: 720×1600 CSS px.
    setViewport(720, 1600);
    setCoarsePointer(true);
    const { scale, rotated } = measureCanvasFit();
    expect(rotated).toBe(true);
    // Swapped: the 1600px canvas axis lies along the 1600px viewport height.
    expect(scale).toBeCloseTo(fitScale(1600, 720), 5);
    // Full-size, not the ~0.21 letterbox the unrotated fit would produce.
    expect(scale).toBeGreaterThan(0.9);
  });

  it('portrait fine-pointer viewport (desktop tall window) does NOT rotate', () => {
    setViewport(700, 900);
    setCoarsePointer(false);
    const { scale, rotated } = measureCanvasFit();
    expect(rotated).toBe(false);
    expect(scale).toBeCloseTo(fitScale(700, 900), 5);
  });

  it('no matchMedia at all (bare jsdom) never rotates and never throws', () => {
    setViewport(720, 1600);
    const { rotated } = measureCanvasFit();
    expect(rotated).toBe(false);
  });
});

describe('canvasTransform', () => {
  it('composes rotation before scale so one transform carries both', () => {
    expect(canvasTransform(0.95, true)).toBe('rotate(90deg) scale(0.95)');
    expect(canvasTransform(0.6, false)).toBe('scale(0.6)');
  });
});

describe('useCanvasFit — rotate-away / rotate-back recovery (WS-440)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.matchMedia;
  });

  it('recovers through a full portrait→landscape→portrait cycle', () => {
    setCoarsePointer(true);
    setViewport(1600, 720);
    const { result } = renderHook(() => useCanvasFit());
    expect(result.current.rotated).toBe(false);

    // Device rotates to portrait mid-entry (pocket, table bump).
    act(() => {
      setViewport(720, 1600);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.rotated).toBe(true);
    expect(result.current.scale).toBeCloseTo(fitScale(1600, 720), 5);

    // Rotates back — the app must recover on its own, no reload.
    act(() => {
      setViewport(1600, 720);
      window.dispatchEvent(new Event('resize'));
    });
    expect(result.current.rotated).toBe(false);
    expect(result.current.scale).toBeCloseTo(0.95, 5);
  });

  it('orientationchange with late-settling dimensions re-measures after the settle delays', () => {
    setCoarsePointer(true);
    setViewport(1600, 720);
    const { result } = renderHook(() => useCanvasFit());

    // Android Chrome trap: the event fires while dimensions still read the
    // OLD orientation; they settle only after the rotation animation.
    act(() => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    expect(result.current.rotated).toBe(false);

    act(() => {
      setViewport(720, 1600); // dimensions settle late
      vi.advanceTimersByTime(300);
    });
    expect(result.current.rotated).toBe(true);
    expect(result.current.scale).toBeCloseTo(fitScale(1600, 720), 5);
  });
});

// @vitest-environment jsdom
/**
 * useRotatedTouchScroll — the rotated-canvas touch bridge (WS-440).
 *
 * The axis mapping in here was established by MEASUREMENT (CDP touch dispatch
 * on the live app, 2026-08-13): Chromium pans touch scrolls in screen space,
 * so inside the rotate(90deg) canvas the bridge must remap
 *   finger along screen +X (user-visual up, phone turned CCW) → scrollTop +=
 *   finger along screen -Y (user-visual left)                 → scrollLeft +=
 * These tests pin those signs and the engagement rules; if someone flips a
 * sign "to make it feel right" in jsdom, the phone breaks silently.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRotatedTouchScroll } from '../useRotatedTouchScroll';

const setPortraitCoarse = () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 720 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1600 });
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(pointer: coarse)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

/** Build canvas > scroller > child and fake the scroll metrics jsdom lacks. */
const buildDom = ({ insideCanvas = true } = {}) => {
  document.body.innerHTML = '';
  const canvas = document.createElement('div');
  if (insideCanvas) canvas.dataset.canvasRotated = 'true';
  const scroller = document.createElement('div');
  scroller.style.overflowY = 'auto';
  Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 });
  Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 300 });
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: 300 });
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: 300 });
  const child = document.createElement('span');
  scroller.appendChild(child);
  canvas.appendChild(scroller);
  document.body.appendChild(canvas);
  return { canvas, scroller, child };
};

const touchEvent = (type, target, x, y) => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'touches', {
    value: type === 'touchend' ? [] : [{ clientX: x, clientY: y }],
  });
  Object.defineProperty(e, 'target', { value: target });
  return e;
};

describe('useRotatedTouchScroll — axis mapping (measured, do not flip)', () => {
  beforeEach(() => {
    setPortraitCoarse();
  });

  afterEach(() => {
    delete window.matchMedia;
    document.body.innerHTML = '';
  });

  it('finger along screen +X (visual up) increases scrollTop; -Y increases scrollLeft', () => {
    const { child, scroller } = buildDom();
    renderHook(() => useRotatedTouchScroll());

    document.dispatchEvent(touchEvent('touchstart', child, 100, 800));
    // Move +50 in X (past the 6px tap threshold) — user-visual upward swipe.
    const move1 = touchEvent('touchmove', child, 150, 800);
    document.dispatchEvent(move1);
    expect(move1.defaultPrevented).toBe(true);
    expect(scroller.scrollTop).toBe(50);
    expect(scroller.scrollLeft).toBe(0);

    // Move -30 in Y — user-visual leftward swipe → scrollLeft +=.
    document.dispatchEvent(touchEvent('touchmove', child, 150, 770));
    expect(scroller.scrollLeft).toBe(30);
  });

  it('sub-threshold jitter neither scrolls nor preventDefaults (taps stay taps)', () => {
    const { child, scroller } = buildDom();
    renderHook(() => useRotatedTouchScroll());

    document.dispatchEvent(touchEvent('touchstart', child, 100, 800));
    const jitter = touchEvent('touchmove', child, 103, 801);
    document.dispatchEvent(jitter);
    expect(jitter.defaultPrevented).toBe(false);
    expect(scroller.scrollTop).toBe(0);
  });

  it('touches outside a rotated canvas are left alone', () => {
    const { child, scroller } = buildDom({ insideCanvas: false });
    renderHook(() => useRotatedTouchScroll());

    document.dispatchEvent(touchEvent('touchstart', child, 100, 800));
    const move = touchEvent('touchmove', child, 200, 800);
    document.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(false);
    expect(scroller.scrollTop).toBe(0);
  });

  it('attaches nothing when not rotated (fine pointer)', () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    const { child, scroller } = buildDom();
    renderHook(() => useRotatedTouchScroll());

    document.dispatchEvent(touchEvent('touchstart', child, 100, 800));
    const move = touchEvent('touchmove', child, 200, 800);
    document.dispatchEvent(move);
    expect(move.defaultPrevented).toBe(false);
    expect(scroller.scrollTop).toBe(0);
  });
});

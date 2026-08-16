// @vitest-environment jsdom
/**
 * RotatedViewport — chrome rotates with the canvas (WS-440).
 *
 * Pins the three rules that make rotated chrome safe:
 *   1. rotation requires BOTH the canvas fallback (portrait × coarse pointer)
 *      AND a landscape-classified active view — chrome on portrait-native
 *      views (Sessions, Settings…) must never rotate;
 *   2. the wrapper is pointer-events-none (a full-screen fixed layer that
 *      swallowed taps would dead-screen the app — the exact failure class
 *      WS-440 exists to remove);
 *   3. without a UIProvider it degrades to unrotated instead of throwing.
 */

import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RotatedViewport } from '../RotatedViewport';
import { UIContext } from '../../../contexts/UIContext';
import { SCREEN } from '../../../constants/uiConstants';

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

const withUI = (ui, children) => (
  <UIContext.Provider value={ui}>{children}</UIContext.Provider>
);

const child = <span data-testid="chrome-child">chrome</span>;

afterEach(() => {
  delete window.matchMedia;
});

describe('RotatedViewport', () => {
  it('rotates chrome on a landscape view in the portrait-touch fallback', () => {
    setViewport(720, 1600);
    setCoarsePointer(true);
    render(withUI({ currentView: SCREEN.TABLE, isShowdownViewOpen: false }, (
      <RotatedViewport zClassName="z-[55]">{child}</RotatedViewport>
    )));
    const wrapper = screen.getByTestId('rotated-viewport');
    expect(wrapper.className).toContain('pointer-events-none');
    expect(wrapper.className).toContain('z-[55]');
    const inner = wrapper.firstChild;
    expect(inner.style.transform).toBe('rotate(90deg)');
    expect(inner.style.width).toBe('100dvh');
    expect(inner.style.height).toBe('100dvw');
    expect(screen.getByTestId('chrome-child')).toBeInTheDocument();
  });

  it('does NOT rotate chrome on a portrait-native view, even in a portrait touch viewport', () => {
    setViewport(720, 1600);
    setCoarsePointer(true);
    render(withUI({ currentView: SCREEN.SESSIONS, isShowdownViewOpen: false }, (
      <RotatedViewport>{child}</RotatedViewport>
    )));
    expect(screen.queryByTestId('rotated-viewport')).toBeNull();
    expect(screen.getByTestId('chrome-child')).toBeInTheDocument();
  });

  it('Showdown overlay forces rotation regardless of currentView', () => {
    setViewport(720, 1600);
    setCoarsePointer(true);
    render(withUI({ currentView: SCREEN.SESSIONS, isShowdownViewOpen: true }, (
      <RotatedViewport>{child}</RotatedViewport>
    )));
    expect(screen.getByTestId('rotated-viewport')).toBeInTheDocument();
  });

  it('does not rotate in landscape viewports or on fine pointers', () => {
    setViewport(1600, 720);
    setCoarsePointer(true);
    const { unmount } = render(withUI({ currentView: SCREEN.TABLE, isShowdownViewOpen: false }, (
      <RotatedViewport>{child}</RotatedViewport>
    )));
    expect(screen.queryByTestId('rotated-viewport')).toBeNull();
    unmount();

    setViewport(720, 1600);
    setCoarsePointer(false);
    render(withUI({ currentView: SCREEN.TABLE, isShowdownViewOpen: false }, (
      <RotatedViewport>{child}</RotatedViewport>
    )));
    expect(screen.queryByTestId('rotated-viewport')).toBeNull();
  });

  it('degrades to unrotated without a UIProvider instead of throwing', () => {
    setViewport(720, 1600);
    setCoarsePointer(true);
    render(<RotatedViewport>{child}</RotatedViewport>);
    expect(screen.queryByTestId('rotated-viewport')).toBeNull();
    expect(screen.getByTestId('chrome-child')).toBeInTheDocument();
  });
});

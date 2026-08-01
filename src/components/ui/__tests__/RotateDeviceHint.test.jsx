/**
 * RotateDeviceHint.test.jsx — WS-315 Phase 2.
 *
 * The defect being pinned: the overlay used to be an undismissable full-screen
 * block gated on a CSS media variant. For anyone who had not installed the PWA —
 * every first-time entry — that made the app unreachable in portrait.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { RotateDeviceHint, DISMISS_STORAGE_KEY } from '../RotateDeviceHint';

const mockUseUI = vi.fn();
vi.mock('../../../contexts', () => ({
  useUI: () => mockUseUI(),
}));

vi.mock('../../../constants/viewRegistry', () => ({
  VIEW_TO_ORIENTATION: {
    table: 'landscape',
    playerEditor: 'portrait',
  },
}));

const setViewport = (width, height) => {
  window.innerWidth = width;
  window.innerHeight = height;
};

describe('RotateDeviceHint (WS-315)', () => {
  beforeEach(() => {
    mockUseUI.mockReturnValue({ currentView: 'table' });
    sessionStorage.clear();
    // Default: portrait phone on a landscape-classified view.
    setViewport(720, 1600);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows on a landscape view when the viewport is portrait', () => {
    render(<RotateDeviceHint />);
    expect(screen.getByText(/built for landscape/i)).toBeInTheDocument();
  });

  it('renders nothing when the viewport is already landscape', () => {
    setViewport(1600, 720);
    const { container } = render(<RotateDeviceHint />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on a portrait-native view even in a portrait viewport', () => {
    mockUseUI.mockReturnValue({ currentView: 'playerEditor' });
    const { container } = render(<RotateDeviceHint />);
    expect(container).toBeEmptyDOMElement();
  });

  // The core of the fix: there must be a way into the app.
  describe('is a hint, not a gate', () => {
    it('offers a way through rather than blocking entry', () => {
      render(<RotateDeviceHint />);
      expect(screen.getByRole('button', { name: /continue anyway/i })).toBeInTheDocument();
    });

    it('dismisses when the user continues', () => {
      render(<RotateDeviceHint />);
      fireEvent.click(screen.getByRole('button', { name: /continue anyway/i }));
      expect(screen.queryByText(/built for landscape/i)).not.toBeInTheDocument();
    });

    it('stays dismissed across remounts, so it does not re-nag on view changes', () => {
      const first = render(<RotateDeviceHint />);
      fireEvent.click(screen.getByRole('button', { name: /continue anyway/i }));
      first.unmount();

      const { container } = render(<RotateDeviceHint />);
      expect(container).toBeEmptyDOMElement();
    });

    it('records the dismissal in sessionStorage', () => {
      render(<RotateDeviceHint />);
      fireEvent.click(screen.getByRole('button', { name: /continue anyway/i }));
      expect(sessionStorage.getItem(DISMISS_STORAGE_KEY)).toBe('1');
    });

    it('still dismisses for this mount when sessionStorage throws (private mode)', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });
      render(<RotateDeviceHint />);
      fireEvent.click(screen.getByRole('button', { name: /continue anyway/i }));
      expect(screen.queryByText(/built for landscape/i)).not.toBeInTheDocument();
    });
  });

  // The copy must not instruct an action that cannot succeed when the device
  // has auto-rotate switched off — one of the live mechanism candidates.
  it('does not promise that rotating will work', () => {
    render(<RotateDeviceHint />);
    const body = screen.getByText(/auto-rotate/i);
    expect(body).toBeInTheDocument();
    expect(body.textContent).toMatch(/carry on anyway/i);
  });

  describe('orientation is measured, not inferred from a media variant', () => {
    it('clears when the viewport becomes landscape via resize', () => {
      render(<RotateDeviceHint />);
      expect(screen.getByText(/built for landscape/i)).toBeInTheDocument();

      act(() => {
        setViewport(1600, 720);
        window.dispatchEvent(new Event('resize'));
      });

      expect(screen.queryByText(/built for landscape/i)).not.toBeInTheDocument();
    });

    // The regression this guards: `orientationchange` fires before the viewport
    // dimensions settle, so a synchronous read sees the OLD size. If the hook
    // trusted that first read it would conclude "still portrait" and stay up.
    it('clears after orientationchange even when dimensions settle late', async () => {
      vi.useFakeTimers();
      render(<RotateDeviceHint />);
      expect(screen.getByText(/built for landscape/i)).toBeInTheDocument();

      act(() => {
        // Event fires while the viewport still reports the pre-rotation size.
        window.dispatchEvent(new Event('orientationchange'));
      });
      expect(screen.getByText(/built for landscape/i)).toBeInTheDocument();

      act(() => {
        setViewport(1600, 720); // dimensions settle afterwards
        vi.advanceTimersByTime(400);
      });

      expect(screen.queryByText(/built for landscape/i)).not.toBeInTheDocument();
      vi.useRealTimers();
    });
  });
});

// @vitest-environment jsdom
/**
 * @file ViewLoadingFallback — a stalled lazy view must have a way out.
 *
 * chunkRecovery handles a chunk that FAILS. One that never arrives never
 * rejects, so the old bare spinner turned forever with no message and no button.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { SCREEN } from '../../../constants/uiConstants';

let mockSetCurrentScreen;

vi.mock('../../../contexts', () => ({
  useUI: () => ({ setCurrentScreen: mockSetCurrentScreen }),
}));

vi.mock('../../../utils/swUpdate', () => ({ hardRefresh: vi.fn() }));

import { ViewLoadingFallback } from '../ViewLoadingFallback';
import { hardRefresh } from '../../../utils/swUpdate';

beforeEach(() => {
  vi.useFakeTimers();
  mockSetCurrentScreen = vi.fn();
  vi.mocked(hardRefresh).mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

describe('ViewLoadingFallback', () => {
  it('is just a spinner at first — most loads finish immediately', () => {
    render(<ViewLoadingFallback />);

    expect(screen.getByTestId('view-loading-fallback')).toBeInTheDocument();
    expect(screen.queryByText(/Still loading/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('explains the delay and offers Home once it is slow', () => {
    render(<ViewLoadingFallback />);
    advance(6000);

    expect(screen.getByText(/Still loading/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to home/i })).toBeInTheDocument();
    // The heavier hammer is not offered yet — a slow load is usually just slow.
    expect(screen.queryByRole('button', { name: /update app/i })).not.toBeInTheDocument();
  });

  it('adds Update App only once it is genuinely stuck', () => {
    render(<ViewLoadingFallback />);
    advance(18000);

    expect(screen.getByRole('button', { name: /update app/i })).toBeInTheDocument();
  });

  it('never clears caches on its own — that would strip the offline copy on a bad network', () => {
    render(<ViewLoadingFallback />);
    advance(60000);

    expect(hardRefresh).not.toHaveBeenCalled();
  });

  it('Home leaves the Suspense boundary for an eager view', () => {
    render(<ViewLoadingFallback />);
    advance(6000);

    fireEvent.click(screen.getByRole('button', { name: /back to home/i }));
    expect(mockSetCurrentScreen).toHaveBeenCalledWith(SCREEN.HOMEBASE);
  });

  it('Update App runs the hard refresh when the founder chooses it', () => {
    render(<ViewLoadingFallback />);
    advance(18000);

    fireEvent.click(screen.getByRole('button', { name: /update app/i }));
    expect(hardRefresh).toHaveBeenCalledTimes(1);
  });

  it('clears its timers on unmount', () => {
    const { unmount } = render(<ViewLoadingFallback />);
    const clearSpy = vi.spyOn(global, 'clearTimeout');
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });
});

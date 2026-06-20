// @vitest-environment jsdom
/**
 * @file NavShell — the throughpoint Home affordance. Shows on most views, hidden
 * where redundant (Homebase/Table/auth/showdown), routes to Homebase.
 * Plan shimmying-moseying-lantern, Phase E.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SCREEN } from '../../../constants/uiConstants';

let mockUI;

vi.mock('../../../contexts', () => ({
  useUI: () => mockUI,
}));
// Avoid pulling the heavy registry graph — provide a minimal name lookup.
vi.mock('../../../constants/viewRegistry', () => ({
  VIEW_REGISTRY: { stats: { name: 'Stats' }, sessions: { name: 'Sessions' } },
}));

import { NavShell } from '../NavShell';

beforeEach(() => {
  mockUI = { currentView: SCREEN.STATS, isShowdownViewOpen: false, setCurrentScreen: vi.fn() };
});
afterEach(() => cleanup());

describe('NavShell', () => {
  it('renders a Home button on a normal view and routes to Homebase', () => {
    render(<NavShell />);
    const home = screen.getByTestId('nav-shell-home');
    fireEvent.click(home);
    expect(mockUI.setCurrentScreen).toHaveBeenCalledWith(SCREEN.HOMEBASE);
  });

  it('is hidden on Homebase', () => {
    mockUI.currentView = SCREEN.HOMEBASE;
    const { container } = render(<NavShell />);
    expect(container.firstChild).toBeNull();
  });

  it('is hidden on Table (sidebar already has Home there)', () => {
    mockUI.currentView = SCREEN.TABLE;
    const { container } = render(<NavShell />);
    expect(container.firstChild).toBeNull();
  });

  it('is hidden on auth screens', () => {
    mockUI.currentView = SCREEN.LOGIN;
    const { container } = render(<NavShell />);
    expect(container.firstChild).toBeNull();
  });

  it('is hidden while the showdown overlay is open', () => {
    mockUI.isShowdownViewOpen = true;
    const { container } = render(<NavShell />);
    expect(container.firstChild).toBeNull();
  });
});

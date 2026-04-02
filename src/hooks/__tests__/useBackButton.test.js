import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBackButton } from '../useBackButton';

// Mock useUI
const mockSetCurrentScreen = vi.fn();
const mockCloseShowdownView = vi.fn();
const mockCloseCardSelector = vi.fn();
const mockSetContextMenu = vi.fn();
const mockToggleSidebar = vi.fn();

let mockState = {};

vi.mock('../../contexts', () => ({
  useUI: () => ({
    currentView: mockState.currentView ?? 'table',
    setCurrentScreen: mockSetCurrentScreen,
    isShowdownViewOpen: mockState.isShowdownViewOpen ?? false,
    closeShowdownView: mockCloseShowdownView,
    showCardSelector: mockState.showCardSelector ?? false,
    closeCardSelector: mockCloseCardSelector,
    contextMenu: mockState.contextMenu ?? null,
    setContextMenu: mockSetContextMenu,
    isSidebarCollapsed: mockState.isSidebarCollapsed ?? true,
    toggleSidebar: mockToggleSidebar,
  }),
}));

describe('useBackButton', () => {
  let pushStateSpy;
  let popStateListeners;

  beforeEach(() => {
    vi.clearAllMocks();
    mockState = { currentView: 'table' };
    popStateListeners = [];

    pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    vi.spyOn(window, 'addEventListener').mockImplementation((event, handler) => {
      if (event === 'popstate') popStateListeners.push(handler);
    });
    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const firePopState = () => {
    popStateListeners.forEach(fn => fn(new PopStateEvent('popstate')));
  };

  it('pushes a guard entry on mount', () => {
    renderHook(() => useBackButton());
    expect(pushStateSpy).toHaveBeenCalledWith({ pokerGuard: true }, '');
  });

  it('registers a popstate listener', () => {
    renderHook(() => useBackButton());
    expect(popStateListeners.length).toBe(1);
  });

  it('re-pushes guard on back press', () => {
    renderHook(() => useBackButton());
    pushStateSpy.mockClear();

    act(() => firePopState());

    expect(pushStateSpy).toHaveBeenCalledWith({ pokerGuard: true }, '');
  });

  it('closes card selector first if open', () => {
    mockState = { currentView: 'table', showCardSelector: true };
    renderHook(() => useBackButton());

    act(() => firePopState());

    expect(mockCloseCardSelector).toHaveBeenCalled();
    expect(mockCloseShowdownView).not.toHaveBeenCalled();
    expect(mockSetCurrentScreen).not.toHaveBeenCalled();
  });

  it('closes showdown view if card selector is not open', () => {
    mockState = { currentView: 'table', isShowdownViewOpen: true };
    renderHook(() => useBackButton());

    act(() => firePopState());

    expect(mockCloseShowdownView).toHaveBeenCalled();
    expect(mockSetCurrentScreen).not.toHaveBeenCalled();
  });

  it('closes context menu before navigating back', () => {
    mockState = { currentView: 'stats', contextMenu: { x: 10, y: 10, seat: 1 } };
    renderHook(() => useBackButton());

    act(() => firePopState());

    expect(mockSetContextMenu).toHaveBeenCalledWith(null);
    expect(mockSetCurrentScreen).not.toHaveBeenCalled();
  });

  it('collapses sidebar before navigating back', () => {
    mockState = { currentView: 'stats', isSidebarCollapsed: false };
    renderHook(() => useBackButton());

    act(() => firePopState());

    expect(mockToggleSidebar).toHaveBeenCalled();
    expect(mockSetCurrentScreen).not.toHaveBeenCalled();
  });

  it('navigates to previous view when no overlay is open', () => {
    // Start on table, then navigate to stats
    mockState = { currentView: 'table', isSidebarCollapsed: true };
    const { rerender } = renderHook(() => useBackButton());

    // Simulate navigating to stats
    mockState = { currentView: 'stats', isSidebarCollapsed: true };
    rerender();

    act(() => firePopState());

    expect(mockSetCurrentScreen).toHaveBeenCalledWith('table');
  });

  it('does nothing when already at root view with no overlays', () => {
    mockState = { currentView: 'table', isSidebarCollapsed: true };
    renderHook(() => useBackButton());

    act(() => firePopState());

    // Guard re-pushed but no navigation
    expect(mockSetCurrentScreen).not.toHaveBeenCalled();
    expect(mockCloseCardSelector).not.toHaveBeenCalled();
    expect(mockCloseShowdownView).not.toHaveBeenCalled();
  });

  it('tracks multi-step navigation history', () => {
    mockState = { currentView: 'table', isSidebarCollapsed: true };
    const { rerender } = renderHook(() => useBackButton());

    // Navigate: table → stats → players
    mockState = { currentView: 'stats', isSidebarCollapsed: true };
    rerender();
    mockState = { currentView: 'players', isSidebarCollapsed: true };
    rerender();

    // First back: players → stats
    act(() => firePopState());
    expect(mockSetCurrentScreen).toHaveBeenCalledWith('stats');

    // Simulate the view actually changing
    mockState = { currentView: 'stats', isSidebarCollapsed: true };
    rerender();

    // Second back: stats → table
    mockSetCurrentScreen.mockClear();
    act(() => firePopState());
    expect(mockSetCurrentScreen).toHaveBeenCalledWith('table');
  });
});

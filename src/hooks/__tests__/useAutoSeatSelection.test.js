// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSeatSelection } from '../useAutoSeatSelection';

describe('useAutoSeatSelection', () => {
  let setSelectedPlayers;
  let getFirstActionSeat;

  beforeEach(() => {
    vi.useFakeTimers();
    setSelectedPlayers = vi.fn();
    getFirstActionSeat = vi.fn(() => 3);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderAutoSelect = (props = {}) => {
    const defaults = {
      showCardSelector: false,
      currentStreet: 'preflop',
      getFirstActionSeat,
      setSelectedPlayers,
    };
    const merged = { ...defaults, ...props };
    return renderHook(
      ({ showCardSelector, currentStreet, getFirstActionSeat: gfas, setSelectedPlayers: ssp }) =>
        useAutoSeatSelection(showCardSelector, currentStreet, gfas, ssp),
      { initialProps: merged }
    );
  };

  it('auto-selects first action seat on mount', () => {
    renderAutoSelect();
    expect(setSelectedPlayers).toHaveBeenCalledWith([3]);
  });

  it('auto-selects on street change', () => {
    const { rerender } = renderAutoSelect();
    setSelectedPlayers.mockClear();

    rerender({
      showCardSelector: false,
      currentStreet: 'flop',
      getFirstActionSeat,
      setSelectedPlayers,
    });

    expect(setSelectedPlayers).toHaveBeenCalledWith([3]);
  });

  it('auto-selects when card selector closes', () => {
    const { rerender } = renderAutoSelect({ showCardSelector: true });
    setSelectedPlayers.mockClear();

    rerender({
      showCardSelector: false,
      currentStreet: 'preflop',
      getFirstActionSeat,
      setSelectedPlayers,
    });

    expect(setSelectedPlayers).toHaveBeenCalledWith([3]);
  });

  it('skips auto-select when card selector is open', () => {
    setSelectedPlayers.mockClear();
    renderAutoSelect({ showCardSelector: true });
    expect(setSelectedPlayers).not.toHaveBeenCalled();
  });

  it('skips auto-select on showdown', () => {
    setSelectedPlayers.mockClear();
    renderAutoSelect({ currentStreet: 'showdown' });
    expect(setSelectedPlayers).not.toHaveBeenCalled();
  });

  it('does not select when no first action seat', () => {
    getFirstActionSeat.mockReturnValue(null);
    setSelectedPlayers.mockClear();
    renderAutoSelect();
    expect(setSelectedPlayers).not.toHaveBeenCalled();
  });

  it('scheduleAutoSelect dispatches after setTimeout', () => {
    const { result } = renderAutoSelect();
    setSelectedPlayers.mockClear();

    act(() => {
      result.current.scheduleAutoSelect();
      vi.runAllTimers();
    });

    expect(setSelectedPlayers).toHaveBeenCalledWith([3]);
  });
});

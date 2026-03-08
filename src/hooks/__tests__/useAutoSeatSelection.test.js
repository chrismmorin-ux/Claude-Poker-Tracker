// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSeatSelection } from '../useAutoSeatSelection';

vi.mock('../../reducers/uiReducer', () => ({
  UI_ACTIONS: { SET_SELECTION: 'SET_SELECTION' },
}));

describe('useAutoSeatSelection', () => {
  let dispatchUi;
  let getFirstActionSeat;

  beforeEach(() => {
    vi.useFakeTimers();
    dispatchUi = vi.fn();
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
      dispatchUi,
    };
    const merged = { ...defaults, ...props };
    return renderHook(
      ({ showCardSelector, currentStreet, getFirstActionSeat: gfas, dispatchUi: dui }) =>
        useAutoSeatSelection(showCardSelector, currentStreet, gfas, dui),
      { initialProps: merged }
    );
  };

  it('auto-selects first action seat on mount', () => {
    renderAutoSelect();
    expect(dispatchUi).toHaveBeenCalledWith({
      type: 'SET_SELECTION',
      payload: [3],
    });
  });

  it('auto-selects on street change', () => {
    const { rerender } = renderAutoSelect();
    dispatchUi.mockClear();

    rerender({
      showCardSelector: false,
      currentStreet: 'flop',
      getFirstActionSeat,
      dispatchUi,
    });

    expect(dispatchUi).toHaveBeenCalledWith({
      type: 'SET_SELECTION',
      payload: [3],
    });
  });

  it('auto-selects when card selector closes', () => {
    const { rerender } = renderAutoSelect({ showCardSelector: true });
    dispatchUi.mockClear();

    rerender({
      showCardSelector: false,
      currentStreet: 'preflop',
      getFirstActionSeat,
      dispatchUi,
    });

    expect(dispatchUi).toHaveBeenCalledWith({
      type: 'SET_SELECTION',
      payload: [3],
    });
  });

  it('skips auto-select when card selector is open', () => {
    dispatchUi.mockClear();
    renderAutoSelect({ showCardSelector: true });
    expect(dispatchUi).not.toHaveBeenCalled();
  });

  it('skips auto-select on showdown', () => {
    dispatchUi.mockClear();
    renderAutoSelect({ currentStreet: 'showdown' });
    expect(dispatchUi).not.toHaveBeenCalled();
  });

  it('does not select when no first action seat', () => {
    getFirstActionSeat.mockReturnValue(null);
    dispatchUi.mockClear();
    renderAutoSelect();
    expect(dispatchUi).not.toHaveBeenCalled();
  });

  it('scheduleAutoSelect dispatches after setTimeout', () => {
    const { result } = renderAutoSelect();
    dispatchUi.mockClear();

    act(() => {
      result.current.scheduleAutoSelect();
      vi.runAllTimers();
    });

    expect(dispatchUi).toHaveBeenCalledWith({
      type: 'SET_SELECTION',
      payload: [3],
    });
  });
});

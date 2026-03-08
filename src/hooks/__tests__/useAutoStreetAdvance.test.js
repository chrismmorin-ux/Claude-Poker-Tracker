// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutoStreetAdvance } from '../useAutoStreetAdvance';

describe('useAutoStreetAdvance', () => {
  let isStreetComplete;
  let nextStreet;
  let setCurrentStreet;
  let openShowdownScreen;

  beforeEach(() => {
    isStreetComplete = vi.fn(() => false);
    nextStreet = vi.fn();
    setCurrentStreet = vi.fn();
    openShowdownScreen = vi.fn();
  });

  const renderAdvance = (props = {}) => {
    const defaults = {
      actionSequence: [],
      currentStreet: 'preflop',
      showCardSelector: false,
      isStreetComplete,
      nextStreet,
      activeSeatCount: 5,
      setCurrentStreet,
      openShowdownScreen,
    };
    const merged = { ...defaults, ...props };
    return renderHook(
      (p) => useAutoStreetAdvance(
        p.actionSequence, p.currentStreet, p.showCardSelector,
        p.isStreetComplete, p.nextStreet, p.activeSeatCount,
        p.setCurrentStreet, p.openShowdownScreen
      ),
      { initialProps: merged }
    );
  };

  it('advances to next street when street is complete', () => {
    isStreetComplete.mockReturnValue(true);
    const seq = [{ seat: 1, action: 'CALL', street: 'preflop', order: 1 }];
    const { rerender } = renderAdvance({ actionSequence: [] });

    rerender({
      actionSequence: seq,
      currentStreet: 'preflop',
      showCardSelector: false,
      isStreetComplete,
      nextStreet,
      activeSeatCount: 5,
      setCurrentStreet,
      openShowdownScreen,
    });

    expect(nextStreet).toHaveBeenCalled();
  });

  it('goes to showdown when only 1 active seat', () => {
    isStreetComplete.mockReturnValue(true);
    const seq = [{ seat: 1, action: 'FOLD', street: 'preflop', order: 1 }];
    const { rerender } = renderAdvance({ actionSequence: [] });

    rerender({
      actionSequence: seq,
      currentStreet: 'preflop',
      showCardSelector: false,
      isStreetComplete,
      nextStreet,
      activeSeatCount: 1,
      setCurrentStreet,
      openShowdownScreen,
    });

    expect(setCurrentStreet).toHaveBeenCalledWith('showdown');
    expect(openShowdownScreen).toHaveBeenCalled();
  });

  it('does not advance on undo (sequence shrinks)', () => {
    isStreetComplete.mockReturnValue(true);
    const seq = [
      { seat: 1, action: 'CALL', street: 'preflop', order: 1 },
      { seat: 2, action: 'CALL', street: 'preflop', order: 2 },
    ];
    const { rerender } = renderAdvance({ actionSequence: seq });

    rerender({
      actionSequence: [seq[0]], // shrunk
      currentStreet: 'preflop',
      showCardSelector: false,
      isStreetComplete,
      nextStreet,
      activeSeatCount: 5,
      setCurrentStreet,
      openShowdownScreen,
    });

    expect(nextStreet).not.toHaveBeenCalled();
  });

  it('does not advance when card selector is open', () => {
    isStreetComplete.mockReturnValue(true);
    const seq = [{ seat: 1, action: 'CALL', street: 'preflop', order: 1 }];
    const { rerender } = renderAdvance({ actionSequence: [], showCardSelector: true });

    rerender({
      actionSequence: seq,
      currentStreet: 'preflop',
      showCardSelector: true,
      isStreetComplete,
      nextStreet,
      activeSeatCount: 5,
      setCurrentStreet,
      openShowdownScreen,
    });

    expect(nextStreet).not.toHaveBeenCalled();
  });

  it('does not advance on showdown street', () => {
    isStreetComplete.mockReturnValue(true);
    const seq = [{ seat: 1, action: 'CALL', street: 'showdown', order: 1 }];
    const { rerender } = renderAdvance({ actionSequence: [], currentStreet: 'showdown' });

    rerender({
      actionSequence: seq,
      currentStreet: 'showdown',
      showCardSelector: false,
      isStreetComplete,
      nextStreet,
      activeSeatCount: 5,
      setCurrentStreet,
      openShowdownScreen,
    });

    expect(nextStreet).not.toHaveBeenCalled();
  });

  it('does not advance when street is not complete', () => {
    isStreetComplete.mockReturnValue(false);
    const seq = [{ seat: 1, action: 'CALL', street: 'preflop', order: 1 }];
    const { rerender } = renderAdvance({ actionSequence: [] });

    rerender({
      actionSequence: seq,
      currentStreet: 'preflop',
      showCardSelector: false,
      isStreetComplete,
      nextStreet,
      activeSeatCount: 5,
      setCurrentStreet,
      openShowdownScreen,
    });

    expect(nextStreet).not.toHaveBeenCalled();
  });
});

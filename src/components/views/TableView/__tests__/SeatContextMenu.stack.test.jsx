// @vitest-environment jsdom
/**
 * SeatContextMenu.stack.test.jsx — stack correction affordance.
 *
 * Gate 2 commitments under test:
 *   C-5  between hands ONLY — mid-hand the row must not exist at all, not merely
 *        be disabled. A row that exists still occupies space and invites misgrab.
 *   C-6  per-seat, single value — no all-seats reconciliation grid.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeatContextMenu } from '../SeatContextMenu';
import { STACK_SOURCE } from '../../../../utils/seatStacks/stackLedger';

const baseProps = {
  contextMenu: { seat: 4, x: 10, y: 10 },
  onMakeMySeat: vi.fn(),
  onMakeDealer: vi.fn(),
  onFindPlayer: vi.fn(),
  onSwapPlayer: vi.fn(),
  onAssignPlayer: vi.fn(),
  onClearPlayer: vi.fn(),
  recentPlayers: [],
  getSeatPlayerName: () => 'Villain',
};

describe('SeatContextMenu — stack correction (C-5)', () => {
  it('REGRESSION: the row does not exist when onSetStack is withheld mid-hand', () => {
    render(<SeatContextMenu {...baseProps} />);
    expect(screen.queryByTestId('menu-set-stack')).toBeNull();
  });

  it('offers the row between hands', () => {
    render(<SeatContextMenu {...baseProps} onSetStack={vi.fn()} />);
    expect(screen.getByTestId('menu-set-stack')).toBeTruthy();
  });

  it('shows the current value WITH its provenance', () => {
    // A carried figure and an entered one are different evidence; the founder
    // decides which he is correcting.
    render(
      <SeatContextMenu
        {...baseProps}
        onSetStack={vi.fn()}
        seatStack={{ amount: 275, source: STACK_SOURCE.CARRIED, admissible: true }}
      />,
    );
    expect(screen.getByTestId('menu-set-stack').textContent).toContain('275');
    expect(screen.getByTestId('menu-set-stack').textContent).toContain(STACK_SOURCE.CARRIED);
  });
});

describe('SeatContextMenu — stack entry (C-6)', () => {
  const openEntry = (onSetStack) => {
    render(<SeatContextMenu {...baseProps} onSetStack={onSetStack} />);
    fireEvent.click(screen.getByTestId('menu-set-stack'));
  };

  it('commits a single value for a single seat', () => {
    const onSetStack = vi.fn();
    openEntry(onSetStack);
    fireEvent.change(screen.getByTestId('menu-set-stack-input'), { target: { value: '340' } });
    fireEvent.click(screen.getByTestId('menu-set-stack-confirm'));
    expect(onSetStack).toHaveBeenCalledWith(4, 340);
  });

  it('commits on Enter', () => {
    const onSetStack = vi.fn();
    openEntry(onSetStack);
    fireEvent.change(screen.getByTestId('menu-set-stack-input'), { target: { value: '120' } });
    fireEvent.keyDown(screen.getByTestId('menu-set-stack-input'), { key: 'Enter' });
    expect(onSetStack).toHaveBeenCalledWith(4, 120);
  });

  it('abandons on Escape without writing anything', () => {
    const onSetStack = vi.fn();
    openEntry(onSetStack);
    fireEvent.keyDown(screen.getByTestId('menu-set-stack-input'), { key: 'Escape' });
    expect(onSetStack).not.toHaveBeenCalled();
    expect(screen.queryByTestId('menu-set-stack-entry')).toBeNull();
  });

  it('refuses a negative or unparseable amount rather than writing a wrong stack', () => {
    const onSetStack = vi.fn();
    openEntry(onSetStack);
    const input = screen.getByTestId('menu-set-stack-input');

    fireEvent.change(input, { target: { value: '-50' } });
    fireEvent.click(screen.getByTestId('menu-set-stack-confirm'));
    expect(onSetStack).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('menu-set-stack-confirm'));
    expect(onSetStack).not.toHaveBeenCalled();
  });

  it('accepts 0 — a seat can genuinely be stacked off', () => {
    const onSetStack = vi.fn();
    openEntry(onSetStack);
    fireEvent.change(screen.getByTestId('menu-set-stack-input'), { target: { value: '0' } });
    fireEvent.click(screen.getByTestId('menu-set-stack-confirm'));
    expect(onSetStack).toHaveBeenCalledWith(4, 0);
  });

  it('is not a reconciliation grid — one seat is addressable at a time', () => {
    render(<SeatContextMenu {...baseProps} onSetStack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('menu-set-stack'));
    expect(screen.getAllByTestId('menu-set-stack-input')).toHaveLength(1);
  });
});

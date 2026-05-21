// @vitest-environment jsdom
/**
 * BoardPicker.test.jsx — Range Lab Phase 1 (WS-056).
 *
 * 3-card callers unchanged; with maxCards=5, Add turn/river grows the array and
 * remove shrinks it; duplicate detection works across the full 3–5 card board.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BoardPicker } from '../BoardPicker';

describe('BoardPicker — 3-card (backward compatible)', () => {
  it('renders 3 cards and no add/remove controls by default', () => {
    render(<BoardPicker value={['K♠', '7♥', '2♦']} onChange={vi.fn()} />);
    expect(screen.queryByText(/\+ Turn/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(3); // 3 rank dropdowns
  });
});

describe('BoardPicker — extensible 3–5 cards', () => {
  it('shows "+ Turn" when at 3 cards and maxCards=5', () => {
    render(<BoardPicker label="Board" value={['K♠', '7♥', '2♦']} onChange={vi.fn()} minCards={3} maxCards={5} />);
    expect(screen.getByText(/\+ Turn/)).toBeInTheDocument();
  });

  it('Add turn appends a 4th card', () => {
    const onChange = vi.fn();
    render(<BoardPicker label="Board" value={['K♠', '7♥', '2♦']} onChange={onChange} minCards={3} maxCards={5} />);
    fireEvent.click(screen.getByText(/\+ Turn/));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(4);
  });

  it('shows "+ River" at 4 cards and remove control', () => {
    render(<BoardPicker label="Board" value={['K♠', '7♥', '2♦', 'Q♣']} onChange={vi.fn()} minCards={3} maxCards={5} />);
    expect(screen.getByText(/\+ River/)).toBeInTheDocument();
    expect(screen.getByText(/− Turn/)).toBeInTheDocument(); // remove drops the last (4th = turn)
  });

  it('no "+ River" once 5 cards are present', () => {
    render(<BoardPicker label="Board" value={['K♠', '7♥', '2♦', 'Q♣', 'J♦']} onChange={vi.fn()} minCards={3} maxCards={5} />);
    expect(screen.queryByText(/\+ River/)).not.toBeInTheDocument();
  });

  it('flags duplicate cards anywhere in the board', () => {
    render(<BoardPicker label="Board" value={['K♠', '7♥', '2♦', 'K♠']} onChange={vi.fn()} minCards={3} maxCards={5} />);
    expect(screen.getByText(/Duplicate cards/)).toBeInTheDocument();
  });

  it('appended turn card is not a duplicate of existing cards', () => {
    const onChange = vi.fn();
    render(<BoardPicker label="Board" value={['A♠', 'A♥', 'A♦']} onChange={onChange} minCards={3} maxCards={5} />);
    fireEvent.click(screen.getByText(/\+ Turn/));
    const next = onChange.mock.calls[0][0];
    expect(new Set(next).size).toBe(next.length); // no dupes introduced
  });
});

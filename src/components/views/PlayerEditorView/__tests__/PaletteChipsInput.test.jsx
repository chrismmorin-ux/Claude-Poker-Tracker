// @vitest-environment jsdom
/**
 * @file Tests for PaletteChipsInput — shared multi-select chip input.
 * Per WS-163 / SPR-035.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PaletteChipsInput } from '../PaletteChipsInput';

afterEach(() => cleanup());

const PALETTE = [
  { id: 'a', label: 'Apple' },
  { id: 'b', label: 'Banana' },
  { id: 'c', label: 'Cherry' },
];

describe('PaletteChipsInput', () => {
  it('renders all palette entries as chips', () => {
    render(<PaletteChipsInput palette={PALETTE} value={[]} onChange={() => {}} />);
    expect(screen.getByTestId('palette-chip-a')).toBeDefined();
    expect(screen.getByTestId('palette-chip-b')).toBeDefined();
    expect(screen.getByTestId('palette-chip-c')).toBeDefined();
  });

  it('marks selected chips with aria-pressed=true', () => {
    render(<PaletteChipsInput palette={PALETTE} value={['b']} onChange={() => {}} />);
    expect(screen.getByTestId('palette-chip-a').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('palette-chip-b').getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking an unselected chip adds it', () => {
    const onChange = vi.fn();
    render(<PaletteChipsInput palette={PALETTE} value={['a']} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('palette-chip-b'));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);
  });

  it('clicking a selected chip removes it', () => {
    const onChange = vi.fn();
    render(<PaletteChipsInput palette={PALETTE} value={['a', 'b']} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('palette-chip-a'));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('handles non-array value gracefully (treats as empty)', () => {
    const onChange = vi.fn();
    render(<PaletteChipsInput palette={PALETTE} value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('palette-chip-a'));
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('honors testIdPrefix for unique chips across multiple instances', () => {
    render(
      <>
        <PaletteChipsInput palette={PALETTE} value={[]} onChange={() => {}} testIdPrefix="x" />
        <PaletteChipsInput palette={PALETTE} value={[]} onChange={() => {}} testIdPrefix="y" />
      </>,
    );
    expect(screen.getByTestId('x-a')).toBeDefined();
    expect(screen.getByTestId('y-a')).toBeDefined();
  });
});

// @vitest-environment jsdom
/**
 * @file Tests for AgeDecadeSection — radio group for 6-bucket ageDecade.
 * Per WS-163 / SPR-035.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AgeDecadeSection, AGE_DECADE_OPTIONS } from '../AgeDecadeSection';

afterEach(() => cleanup());

describe('AgeDecadeSection', () => {
  it('renders all 6 options', () => {
    render(<AgeDecadeSection value={null} onChange={() => {}} />);
    AGE_DECADE_OPTIONS.forEach((opt) => {
      expect(screen.getByTestId(`player-editor-age-${opt}`)).toBeDefined();
    });
  });

  it('marks the selected option with aria-pressed=true', () => {
    render(<AgeDecadeSection value="30s" onChange={() => {}} />);
    const button = screen.getByTestId('player-editor-age-30s');
    expect(button.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onChange with the value when clicked', () => {
    const onChange = vi.fn();
    render(<AgeDecadeSection value={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('player-editor-age-40s'));
    expect(onChange).toHaveBeenCalledWith('40s');
  });

  it('toggling the same selected value clears it (calls onChange with null)', () => {
    const onChange = vi.fn();
    render(<AgeDecadeSection value="40s" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('player-editor-age-40s'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('AGE_DECADE_OPTIONS exports the canonical 6 buckets', () => {
    expect(AGE_DECADE_OPTIONS).toEqual(['<20', '20s', '30s', '40s', '50s', '60s+']);
  });
});

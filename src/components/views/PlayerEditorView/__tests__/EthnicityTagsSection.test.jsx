// @vitest-environment jsdom
/**
 * @file Tests for EthnicityTagsSection — multi-select chip-input + backward-compat shim.
 * Per WS-163 / SPR-035.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EthnicityTagsSection } from '../EthnicityTagsSection';

afterEach(() => cleanup());

describe('EthnicityTagsSection — basic chip input', () => {
  it('renders an empty state when value is empty array', () => {
    render(<EthnicityTagsSection value={[]} legacyEthnicity={null} onChange={() => {}} />);
    expect(screen.getByTestId('player-editor-ethnicity-tags')).toBeDefined();
    expect(screen.getByTestId('player-editor-ethnicity-input')).toBeDefined();
  });

  it('renders existing tags as chips', () => {
    render(<EthnicityTagsSection value={['Hispanic', 'Asian']} legacyEthnicity={null} onChange={() => {}} />);
    expect(screen.getByTestId('player-editor-ethnicity-tag-Hispanic')).toBeDefined();
    expect(screen.getByTestId('player-editor-ethnicity-tag-Asian')).toBeDefined();
  });

  it('clicking Add appends the input to the tags array', () => {
    const onChange = vi.fn();
    render(<EthnicityTagsSection value={[]} legacyEthnicity={null} onChange={onChange} />);
    const input = screen.getByTestId('player-editor-ethnicity-input');
    fireEvent.change(input, { target: { value: 'Brazilian' } });
    fireEvent.click(screen.getByTestId('player-editor-ethnicity-add'));
    expect(onChange).toHaveBeenCalledWith(['Brazilian']);
  });

  it('Enter key submits a tag', () => {
    const onChange = vi.fn();
    render(<EthnicityTagsSection value={['Hispanic']} legacyEthnicity={null} onChange={onChange} />);
    const input = screen.getByTestId('player-editor-ethnicity-input');
    fireEvent.change(input, { target: { value: 'Asian' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['Hispanic', 'Asian']);
  });

  it('does not add duplicate tags', () => {
    const onChange = vi.fn();
    render(<EthnicityTagsSection value={['Hispanic']} legacyEthnicity={null} onChange={onChange} />);
    const input = screen.getByTestId('player-editor-ethnicity-input');
    fireEvent.change(input, { target: { value: 'Hispanic' } });
    fireEvent.click(screen.getByTestId('player-editor-ethnicity-add'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not add empty/whitespace tags', () => {
    const onChange = vi.fn();
    render(<EthnicityTagsSection value={[]} legacyEthnicity={null} onChange={onChange} />);
    const input = screen.getByTestId('player-editor-ethnicity-input');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('player-editor-ethnicity-add'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Remove button drops a tag', () => {
    const onChange = vi.fn();
    render(<EthnicityTagsSection value={['Hispanic', 'Asian']} legacyEthnicity={null} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('player-editor-ethnicity-tag-remove-Hispanic'));
    expect(onChange).toHaveBeenCalledWith(['Asian']);
  });
});

describe('EthnicityTagsSection — backward-compat shim', () => {
  it('auto-populates from legacyEthnicity when tags is empty on first render', () => {
    const onChange = vi.fn();
    render(<EthnicityTagsSection value={[]} legacyEthnicity="Asian" onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith(['Asian']);
  });

  it('does not auto-populate when tags already has entries', () => {
    const onChange = vi.fn();
    render(<EthnicityTagsSection value={['Hispanic']} legacyEthnicity="Asian" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not auto-populate when legacyEthnicity is empty', () => {
    const onChange = vi.fn();
    render(<EthnicityTagsSection value={[]} legacyEthnicity={null} onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
  });
});

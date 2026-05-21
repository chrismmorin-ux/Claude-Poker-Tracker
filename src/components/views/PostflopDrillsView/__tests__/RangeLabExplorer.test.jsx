// @vitest-environment jsdom
/**
 * RangeLabExplorer.test.jsx — Range Lab Phase 1 (WS-056).
 *
 * ExplorerMode range-source toggle: switching to Custom renders the canonical
 * paint grid; tapping a cell includes the hand (updates the range fed to the
 * breakdown) and flips the primary action to "Save Range".
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExplorerMode } from '../ExplorerMode';

describe('ExplorerMode — Range Lab Custom source', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('defaults to Archetype (no paint grid)', () => {
    render(<ExplorerMode />);
    expect(screen.queryByRole('button', { name: 'AA 0%' })).not.toBeInTheDocument();
  });

  it('switching to Custom renders the 13×13 paint grid', () => {
    render(<ExplorerMode />);
    fireEvent.click(screen.getByText('Custom (Range Lab)'));
    // Canonical matrix: each hand is a labelled cell button.
    expect(screen.getByRole('button', { name: 'AA 0%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AKs 0%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AKo 0%' })).toBeInTheDocument();
  });

  it('tapping a cell includes the hand and surfaces Save Range', () => {
    render(<ExplorerMode />);
    fireEvent.click(screen.getByText('Custom (Range Lab)'));

    const aa = screen.getByRole('button', { name: 'AA 0%' });
    fireEvent.pointerDown(aa);
    fireEvent.pointerUp(aa);

    expect(screen.getByRole('button', { name: 'AA 100%' })).toBeInTheDocument();
    expect(screen.getByText('Save Range')).toBeInTheDocument();
    expect(screen.getByText('• Range not saved')).toBeInTheDocument();
  });

  it('shows the turn/river board controls in Custom mode', () => {
    render(<ExplorerMode />);
    fireEvent.click(screen.getByText('Custom (Range Lab)'));
    expect(screen.getByText(/\+ Turn/)).toBeInTheDocument();
  });
});

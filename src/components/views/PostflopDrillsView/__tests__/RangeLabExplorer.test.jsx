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

  // ── Phase 2b (WS-210): range-vs-range comparison ──
  it('compare is off by default — a single paint grid (no Range A/B labels)', () => {
    render(<ExplorerMode />);
    fireEvent.click(screen.getByText('Custom (Range Lab)'));
    expect(screen.queryByText('Range A')).not.toBeInTheDocument();
    expect(screen.queryByText('Range B')).not.toBeInTheDocument();
    // exactly one AA cell when not comparing
    expect(screen.getAllByRole('button', { name: 'AA 0%' })).toHaveLength(1);
  });

  it('toggling Compare ranges reveals a second paint grid', () => {
    render(<ExplorerMode />);
    fireEvent.click(screen.getByText('Custom (Range Lab)'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Compare ranges' }));

    // two grids → two AA cells, one per range
    expect(screen.getAllByRole('button', { name: 'AA 0%' })).toHaveLength(2);
    // both range labels present (text recurs in toolbar/notes, so allow >= 1)
    expect(screen.getAllByText('Range A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Range B').length).toBeGreaterThanOrEqual(1);
    // the A-vs-B equity compute affordance appears
    expect(screen.getByText(/Compute Range A vs Range B equity/)).toBeInTheDocument();
  });

  it('painting the second grid includes a hand in Range B', () => {
    render(<ExplorerMode />);
    fireEvent.click(screen.getByText('Custom (Range Lab)'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Compare ranges' }));

    const aaCells = screen.getAllByRole('button', { name: 'AA 0%' });
    const bAA = aaCells[1]; // second grid = Range B
    fireEvent.pointerDown(bAA);
    fireEvent.pointerUp(bAA);

    // B's AA cell becomes 100%; A's stays 0%
    expect(screen.getByRole('button', { name: 'AA 100%' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AA 0%' })).toBeInTheDocument();
  });

  it('turning Compare off returns to the single-range surface', () => {
    render(<ExplorerMode />);
    fireEvent.click(screen.getByText('Custom (Range Lab)'));
    const toggle = screen.getByRole('checkbox', { name: 'Compare ranges' });
    fireEvent.click(toggle);
    expect(screen.getByText('Range B')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByText('Range B')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'AA 0%' })).toHaveLength(1);
  });
});

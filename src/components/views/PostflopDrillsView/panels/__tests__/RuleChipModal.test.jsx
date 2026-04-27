// @vitest-environment jsdom
/**
 * RuleChipModal.test.jsx — Stream P P5.
 *
 * Tests the shared rule-chip modal: chip body rendering, citation rendering,
 * dismissal (Esc + backdrop + close button), and unknown-chip error banner.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RuleChipModal } from '../RuleChipModal';

describe('RuleChipModal — render gating', () => {
  it('renders nothing when chipId is null', () => {
    const { container } = render(<RuleChipModal chipId={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when chipId is undefined', () => {
    const { container } = render(<RuleChipModal chipId={undefined} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('RuleChipModal — known chip rendering', () => {
  it('renders chip label as title (mdf-defense)', () => {
    render(<RuleChipModal chipId="mdf-defense" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Rule: MDF Defense');
    expect(screen.getByText('MDF Defense')).toBeInTheDocument();
  });

  it('renders shortBody (italic lead) and fullBody', () => {
    render(<RuleChipModal chipId="range-protection" onClose={vi.fn()} />);
    // shortBody mentions defending wider than +EV calls
    expect(screen.getByText(/aren't individually \+EV calls/)).toBeInTheDocument();
    // fullBody mentions snap fold
    expect(screen.getByText(/snap fold/)).toBeInTheDocument();
  });

  it('renders citation list with source + anchor', () => {
    render(<RuleChipModal chipId="mdf-defense" onClose={vi.fn()} />);
    // mdf-defense carries 2 POKER_THEORY.md citations (§6.2 + §1.5)
    expect(screen.getAllByText('POKER_THEORY.md').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/§6\.2/)).toBeInTheDocument();
  });
});

describe('RuleChipModal — dismissal', () => {
  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<RuleChipModal chipId="mdf-defense" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('Close rule'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(<RuleChipModal chipId="mdf-defense" onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when modal body clicked (event stops propagation)', () => {
    const onClose = vi.fn();
    render(<RuleChipModal chipId="mdf-defense" onClose={onClose} />);
    // Click on the inner body — should not propagate to backdrop handler
    fireEvent.click(screen.getByText('MDF Defense'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape pressed', () => {
    const onClose = vi.fn();
    render(<RuleChipModal chipId="mdf-defense" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('RuleChipModal — unknown chip error banner', () => {
  it('renders the error banner when chipId is not in the taxonomy', () => {
    render(<RuleChipModal chipId="does-not-exist" onClose={vi.fn()} />);
    expect(screen.getByText(/Unknown rule chip/)).toBeInTheDocument();
    expect(screen.getByText('does-not-exist')).toBeInTheDocument();
    expect(screen.getByText(/not registered in/)).toBeInTheDocument();
  });

  it('error banner Close button calls onClose', () => {
    const onClose = vi.fn();
    render(<RuleChipModal chipId="does-not-exist" onClose={onClose} />);
    fireEvent.click(screen.getByText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

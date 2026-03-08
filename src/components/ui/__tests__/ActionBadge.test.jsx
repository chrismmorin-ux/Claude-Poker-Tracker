// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActionBadge } from '../ActionBadge';
import { ACTION_ABBREV } from '../../../test/utils';

vi.mock('../../../utils/actionUtils', () => ({
  getActionColor: vi.fn((action) => {
    if (action === 'fold') return { backgroundColor: '#dc2626', color: '#ffffff' };
    if (action === 'call') return { backgroundColor: '#2563eb', color: '#ffffff' };
    if (action === 'raise') return { backgroundColor: '#ea580c', color: '#ffffff' };
    return { backgroundColor: '#e5e7eb', color: '#111827' };
  }),
  getActionAbbreviation: vi.fn((action) => {
    const abbrevMap = {
      fold: 'FLD', check: 'CHK', call: 'CAL', bet: 'BET',
      raise: 'RSE', fold_to_cr: 'F/CR', fold_to_cbet: 'F/C',
      mucked: 'MCK', won: 'WON',
    };
    return abbrevMap[action] || action?.substring(0, 3).toUpperCase() || '???';
  }),
}));

describe('ActionBadge', () => {
  const defaultProps = {
    action: 'call',
  };

  it('renders action abbreviation', () => {
    render(<ActionBadge {...defaultProps} />);
    expect(screen.getByText('CAL')).toBeInTheDocument();
  });

  it.each([
    ['fold', 'FLD'],
    ['call', 'CAL'],
    ['raise', 'RSE'],
    ['check', 'CHK'],
    ['bet', 'BET'],
  ])('renders %s action as %s', (action, abbrev) => {
    render(<ActionBadge {...defaultProps} action={action} />);
    expect(screen.getByText(abbrev)).toBeInTheDocument();
  });

  it('does not show arrow by default', () => {
    render(<ActionBadge {...defaultProps} />);
    expect(screen.queryByText('→')).not.toBeInTheDocument();
  });

  it('shows arrow when showArrow is true', () => {
    render(<ActionBadge {...defaultProps} showArrow={true} />);
    expect(screen.getByText('→')).toBeInTheDocument();
  });

  it('handles undefined action', () => {
    const { container } = render(<ActionBadge />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles null action', () => {
    const { container } = render(<ActionBadge action={null} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

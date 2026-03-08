// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiagonalOverlay } from '../DiagonalOverlay';

const SEAT_STATUS = {
  FOLDED: 'folded',
  ABSENT: 'absent',
};

describe('DiagonalOverlay', () => {
  it.each([null, undefined, 'unknown'])(
    'returns null for status=%s',
    (status) => {
      const { container } = render(<DiagonalOverlay status={status} />);
      expect(container.firstChild).toBeNull();
    }
  );

  it('renders MUCK label for mucked status', () => {
    render(<DiagonalOverlay status="mucked" />);
    expect(screen.getByText('MUCK')).toBeInTheDocument();
  });

  it('renders WON label for won status', () => {
    render(<DiagonalOverlay status="won" />);
    expect(screen.getByText('WON')).toBeInTheDocument();
  });

  it('renders FOLD label with SEAT_STATUS prop', () => {
    render(<DiagonalOverlay status={SEAT_STATUS.FOLDED} SEAT_STATUS={SEAT_STATUS} />);
    expect(screen.getByText('FOLD')).toBeInTheDocument();
  });

  it('renders ABSENT label with SEAT_STATUS prop', () => {
    render(<DiagonalOverlay status={SEAT_STATUS.ABSENT} SEAT_STATUS={SEAT_STATUS} />);
    expect(screen.getByText('ABSENT')).toBeInTheDocument();
  });

  it('does not render folded without SEAT_STATUS prop', () => {
    const { container } = render(<DiagonalOverlay status="folded" />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render absent without SEAT_STATUS prop', () => {
    const { container } = render(<DiagonalOverlay status="absent" />);
    expect(container.firstChild).toBeNull();
  });
});

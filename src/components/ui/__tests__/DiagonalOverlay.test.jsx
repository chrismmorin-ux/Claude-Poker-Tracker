// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiagonalOverlay } from '../DiagonalOverlay';

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

  it('renders FOLD label for folded status', () => {
    render(<DiagonalOverlay status="folded" />);
    expect(screen.getByText('FOLD')).toBeInTheDocument();
  });

  it('renders ABSENT label for absent status', () => {
    render(<DiagonalOverlay status="absent" />);
    expect(screen.getByText('ABSENT')).toBeInTheDocument();
  });
});

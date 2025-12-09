/**
 * DiagonalOverlay.test.jsx - Tests for DiagonalOverlay component
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiagonalOverlay } from '../DiagonalOverlay';

// Mock SEAT_STATUS for testing
const SEAT_STATUS = {
  FOLDED: 'folded',
  ABSENT: 'absent',
};

describe('DiagonalOverlay', () => {
  describe('rendering', () => {
    it('returns null when status is null', () => {
      const { container } = render(<DiagonalOverlay status={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null when status is undefined', () => {
      const { container } = render(<DiagonalOverlay status={undefined} />);
      expect(container.firstChild).toBeNull();
    });

    it('returns null for unknown status without SEAT_STATUS', () => {
      const { container } = render(<DiagonalOverlay status="unknown" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('mucked overlay', () => {
    it('renders MUCK label', () => {
      render(<DiagonalOverlay status="mucked" />);
      expect(screen.getByText('MUCK')).toBeInTheDocument();
    });

    it('uses gray background for mucked', () => {
      render(<DiagonalOverlay status="mucked" />);
      const label = screen.getByText('MUCK');
      expect(label.className).toContain('bg-gray-700');
    });

    it('works without SEAT_STATUS prop', () => {
      render(<DiagonalOverlay status="mucked" />);
      expect(screen.getByText('MUCK')).toBeInTheDocument();
    });
  });

  describe('won overlay', () => {
    it('renders WON label', () => {
      render(<DiagonalOverlay status="won" />);
      expect(screen.getByText('WON')).toBeInTheDocument();
    });

    it('uses green background for won', () => {
      render(<DiagonalOverlay status="won" />);
      const label = screen.getByText('WON');
      expect(label.className).toContain('bg-green-600');
    });

    it('works without SEAT_STATUS prop', () => {
      render(<DiagonalOverlay status="won" />);
      expect(screen.getByText('WON')).toBeInTheDocument();
    });
  });

  describe('folded overlay (with SEAT_STATUS)', () => {
    it('renders FOLD label when status matches SEAT_STATUS.FOLDED', () => {
      render(<DiagonalOverlay status={SEAT_STATUS.FOLDED} SEAT_STATUS={SEAT_STATUS} />);
      expect(screen.getByText('FOLD')).toBeInTheDocument();
    });

    it('uses red background for folded', () => {
      render(<DiagonalOverlay status={SEAT_STATUS.FOLDED} SEAT_STATUS={SEAT_STATUS} />);
      const label = screen.getByText('FOLD');
      expect(label.className).toContain('bg-red-600');
    });

    it('does not render folded without SEAT_STATUS prop', () => {
      const { container } = render(<DiagonalOverlay status="folded" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('absent overlay (with SEAT_STATUS)', () => {
    it('renders ABSENT label when status matches SEAT_STATUS.ABSENT', () => {
      render(<DiagonalOverlay status={SEAT_STATUS.ABSENT} SEAT_STATUS={SEAT_STATUS} />);
      expect(screen.getByText('ABSENT')).toBeInTheDocument();
    });

    it('uses gray background for absent', () => {
      render(<DiagonalOverlay status={SEAT_STATUS.ABSENT} SEAT_STATUS={SEAT_STATUS} />);
      const label = screen.getByText('ABSENT');
      expect(label.className).toContain('bg-gray-600');
    });

    it('does not render absent without SEAT_STATUS prop', () => {
      const { container } = render(<DiagonalOverlay status="absent" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('styling', () => {
    it('has absolute positioning', () => {
      const { container } = render(<DiagonalOverlay status="won" />);
      expect(container.firstChild.className).toContain('absolute');
      expect(container.firstChild.className).toContain('inset-0');
    });

    it('centers content with flex', () => {
      const { container } = render(<DiagonalOverlay status="won" />);
      expect(container.firstChild.className).toContain('flex');
      expect(container.firstChild.className).toContain('items-center');
      expect(container.firstChild.className).toContain('justify-center');
    });

    it('has pointer-events-none to allow click-through', () => {
      const { container } = render(<DiagonalOverlay status="won" />);
      expect(container.firstChild.className).toContain('pointer-events-none');
    });

    it('applies diagonal rotation', () => {
      render(<DiagonalOverlay status="won" />);
      const label = screen.getByText('WON');
      expect(label.className).toContain('-rotate-45');
    });

    it('has white text color', () => {
      render(<DiagonalOverlay status="won" />);
      const label = screen.getByText('WON');
      expect(label.className).toContain('text-white');
    });

    it('has font-bold styling', () => {
      render(<DiagonalOverlay status="won" />);
      const label = screen.getByText('WON');
      expect(label.className).toContain('font-bold');
    });

    it('has shadow styling', () => {
      render(<DiagonalOverlay status="won" />);
      const label = screen.getByText('WON');
      expect(label.className).toContain('shadow-lg');
    });

    it('has rounded corners', () => {
      render(<DiagonalOverlay status="won" />);
      const label = screen.getByText('WON');
      expect(label.className).toContain('rounded');
    });

    it('has small text size', () => {
      render(<DiagonalOverlay status="won" />);
      const label = screen.getByText('WON');
      expect(label.className).toContain('text-xs');
    });
  });

  describe('all status types', () => {
    const statusTests = [
      { status: 'mucked', label: 'MUCK', bgClass: 'bg-gray-700' },
      { status: 'won', label: 'WON', bgClass: 'bg-green-600' },
    ];

    statusTests.forEach(({ status, label, bgClass }) => {
      it(`renders ${status} with ${label} label and ${bgClass}`, () => {
        render(<DiagonalOverlay status={status} />);
        const labelElement = screen.getByText(label);
        expect(labelElement).toBeInTheDocument();
        expect(labelElement.className).toContain(bgClass);
      });
    });
  });
});

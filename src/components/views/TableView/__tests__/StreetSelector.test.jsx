/**
 * StreetSelector.test.jsx - Tests for street selection component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StreetSelector } from '../StreetSelector';
import { STREETS } from '../../../../constants/gameConstants';

describe('StreetSelector', () => {
  const defaultProps = {
    currentStreet: 'preflop',
    onStreetChange: vi.fn(),
    onNextStreet: vi.fn(),
    onClearStreet: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders all street buttons', () => {
      render(<StreetSelector {...defaultProps} />);

      STREETS.forEach(street => {
        expect(screen.getByText(street)).toBeInTheDocument();
      });
    });

    it('renders Next Street button', () => {
      render(<StreetSelector {...defaultProps} />);
      expect(screen.getByText(/Next Street/)).toBeInTheDocument();
    });

    it('renders Clear Street button', () => {
      render(<StreetSelector {...defaultProps} />);
      expect(screen.getByText('Clear Street')).toBeInTheDocument();
    });
  });

  describe('current street highlighting', () => {
    it('highlights preflop when current', () => {
      render(<StreetSelector {...defaultProps} currentStreet="preflop" />);
      const preflopButton = screen.getByText('preflop');
      expect(preflopButton).toHaveClass('bg-yellow-500');
    });

    it('highlights flop when current', () => {
      render(<StreetSelector {...defaultProps} currentStreet="flop" />);
      const flopButton = screen.getByText('flop');
      expect(flopButton).toHaveClass('bg-yellow-500');
    });

    it('highlights turn when current', () => {
      render(<StreetSelector {...defaultProps} currentStreet="turn" />);
      const turnButton = screen.getByText('turn');
      expect(turnButton).toHaveClass('bg-yellow-500');
    });

    it('highlights river when current', () => {
      render(<StreetSelector {...defaultProps} currentStreet="river" />);
      const riverButton = screen.getByText('river');
      expect(riverButton).toHaveClass('bg-yellow-500');
    });

    it('highlights showdown when current', () => {
      render(<StreetSelector {...defaultProps} currentStreet="showdown" />);
      const showdownButton = screen.getByText('showdown');
      expect(showdownButton).toHaveClass('bg-yellow-500');
    });

    it('non-current streets have gray background', () => {
      render(<StreetSelector {...defaultProps} currentStreet="preflop" />);
      const flopButton = screen.getByText('flop');
      expect(flopButton).toHaveClass('bg-gray-700');
    });
  });

  describe('street button interactions', () => {
    it('calls onStreetChange with preflop when clicked', () => {
      render(<StreetSelector {...defaultProps} currentStreet="flop" />);
      fireEvent.click(screen.getByText('preflop'));
      expect(defaultProps.onStreetChange).toHaveBeenCalledWith('preflop');
    });

    it('calls onStreetChange with flop when clicked', () => {
      render(<StreetSelector {...defaultProps} />);
      fireEvent.click(screen.getByText('flop'));
      expect(defaultProps.onStreetChange).toHaveBeenCalledWith('flop');
    });

    it('calls onStreetChange with turn when clicked', () => {
      render(<StreetSelector {...defaultProps} />);
      fireEvent.click(screen.getByText('turn'));
      expect(defaultProps.onStreetChange).toHaveBeenCalledWith('turn');
    });

    it('calls onStreetChange with river when clicked', () => {
      render(<StreetSelector {...defaultProps} />);
      fireEvent.click(screen.getByText('river'));
      expect(defaultProps.onStreetChange).toHaveBeenCalledWith('river');
    });

    it('calls onStreetChange with showdown when clicked', () => {
      render(<StreetSelector {...defaultProps} />);
      fireEvent.click(screen.getByText('showdown'));
      expect(defaultProps.onStreetChange).toHaveBeenCalledWith('showdown');
    });
  });

  describe('control button interactions', () => {
    it('calls onNextStreet when Next Street button clicked', () => {
      render(<StreetSelector {...defaultProps} />);
      fireEvent.click(screen.getByText(/Next Street/));
      expect(defaultProps.onNextStreet).toHaveBeenCalledTimes(1);
    });

    it('calls onClearStreet when Clear Street button clicked', () => {
      render(<StreetSelector {...defaultProps} />);
      fireEvent.click(screen.getByText('Clear Street'));
      expect(defaultProps.onClearStreet).toHaveBeenCalledTimes(1);
    });
  });

  describe('button styling', () => {
    it('Next Street button has green background', () => {
      render(<StreetSelector {...defaultProps} />);
      const nextStreetButton = screen.getByText(/Next Street/);
      expect(nextStreetButton).toHaveClass('bg-green-600');
    });

    it('Clear Street button has red background', () => {
      render(<StreetSelector {...defaultProps} />);
      const clearStreetButton = screen.getByText('Clear Street');
      expect(clearStreetButton).toHaveClass('bg-red-600');
    });
  });
});

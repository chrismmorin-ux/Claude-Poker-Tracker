/**
 * BankrollDisplay.test.jsx - Tests for bankroll display component
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BankrollDisplay } from '../BankrollDisplay';

describe('BankrollDisplay', () => {
  const defaultProps = {
    totalBankroll: 0,
    completedSessionCount: 0,
  };

  describe('rendering', () => {
    it('renders running total label', () => {
      render(<BankrollDisplay {...defaultProps} />);
      expect(screen.getByText('Running Total Bankroll')).toBeInTheDocument();
    });

    it('renders session count', () => {
      render(<BankrollDisplay {...defaultProps} completedSessionCount={5} />);
      expect(screen.getByText('5 sessions')).toBeInTheDocument();
    });

    it('renders zero sessions correctly', () => {
      render(<BankrollDisplay {...defaultProps} completedSessionCount={0} />);
      expect(screen.getByText('0 sessions')).toBeInTheDocument();
    });

    it('renders one session correctly', () => {
      render(<BankrollDisplay {...defaultProps} completedSessionCount={1} />);
      expect(screen.getByText('1 sessions')).toBeInTheDocument();
    });
  });

  describe('positive bankroll', () => {
    it('displays positive bankroll with + sign', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={150.50} />);
      expect(screen.getByText('+$150.50')).toBeInTheDocument();
    });

    it('displays zero with + sign', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={0} />);
      expect(screen.getByText('+$0.00')).toBeInTheDocument();
    });

    it('displays large positive bankroll', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={10000} />);
      expect(screen.getByText('+$10000.00')).toBeInTheDocument();
    });

    it('displays small positive bankroll', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={0.50} />);
      expect(screen.getByText('+$0.50')).toBeInTheDocument();
    });
  });

  describe('negative bankroll', () => {
    it('displays negative bankroll without extra sign', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={-250.75} />);
      expect(screen.getByText('$-250.75')).toBeInTheDocument();
    });

    it('displays large negative bankroll', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={-5000} />);
      expect(screen.getByText('$-5000.00')).toBeInTheDocument();
    });

    it('displays small negative bankroll', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={-0.25} />);
      expect(screen.getByText('$-0.25')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has white text for positive bankroll', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={100} />);
      const bankrollText = screen.getByText('+$100.00');
      expect(bankrollText).toHaveClass('text-white');
    });

    it('has red text for negative bankroll', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={-100} />);
      const bankrollText = screen.getByText('$-100.00');
      expect(bankrollText).toHaveClass('text-red-200');
    });

    it('has blue gradient background', () => {
      const { container } = render(<BankrollDisplay {...defaultProps} />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('bg-gradient-to-r', 'from-blue-500', 'to-blue-600');
    });
  });

  describe('formatting', () => {
    it('formats to 2 decimal places', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={123.456} />);
      expect(screen.getByText('+$123.46')).toBeInTheDocument();
    });

    it('handles whole numbers with .00', () => {
      render(<BankrollDisplay {...defaultProps} totalBankroll={500} />);
      expect(screen.getByText('+$500.00')).toBeInTheDocument();
    });
  });

  describe('combined display', () => {
    it('shows full context with positive bankroll', () => {
      render(<BankrollDisplay totalBankroll={1500.25} completedSessionCount={12} />);

      expect(screen.getByText('Running Total Bankroll')).toBeInTheDocument();
      expect(screen.getByText('+$1500.25')).toBeInTheDocument();
      expect(screen.getByText('12 sessions')).toBeInTheDocument();
    });

    it('shows full context with negative bankroll', () => {
      render(<BankrollDisplay totalBankroll={-350} completedSessionCount={3} />);

      expect(screen.getByText('Running Total Bankroll')).toBeInTheDocument();
      expect(screen.getByText('$-350.00')).toBeInTheDocument();
      expect(screen.getByText('3 sessions')).toBeInTheDocument();
    });
  });
});

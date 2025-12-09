/**
 * CashOutModal.test.jsx - Tests for cash out modal component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CashOutModal } from '../CashOutModal';

describe('CashOutModal', () => {
  const defaultProps = {
    isOpen: true,
    cashOutAmount: '',
    onCashOutAmountChange: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('returns null when not open', () => {
      const { container } = render(<CashOutModal {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders when open', () => {
      render(<CashOutModal {...defaultProps} />);
      // Header has "End Session" text
      expect(screen.getByRole('heading', { name: 'End Session' })).toBeInTheDocument();
    });

    it('renders description text', () => {
      render(<CashOutModal {...defaultProps} />);
      expect(screen.getByText(/Enter your cash out amount/)).toBeInTheDocument();
    });

    it('renders Cash Out Amount label', () => {
      render(<CashOutModal {...defaultProps} />);
      expect(screen.getByText('Cash Out Amount')).toBeInTheDocument();
    });

    it('renders input field', () => {
      render(<CashOutModal {...defaultProps} />);
      expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
    });

    it('renders dollar sign prefix', () => {
      render(<CashOutModal {...defaultProps} />);
      expect(screen.getByText('$')).toBeInTheDocument();
    });

    it('renders helper text', () => {
      render(<CashOutModal {...defaultProps} />);
      expect(screen.getByText('Leave empty to skip')).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<CashOutModal {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders End Session button', () => {
      render(<CashOutModal {...defaultProps} />);
      // There are two "End Session" - one in header, one on button
      const buttons = screen.getAllByText('End Session');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('input behavior', () => {
    it('displays current cashOutAmount value', () => {
      render(<CashOutModal {...defaultProps} cashOutAmount="250" />);
      const input = screen.getByPlaceholderText('0');
      expect(input).toHaveValue(250);
    });

    it('displays empty string as empty input', () => {
      render(<CashOutModal {...defaultProps} cashOutAmount="" />);
      const input = screen.getByPlaceholderText('0');
      expect(input).toHaveValue(null);
    });

    it('calls onCashOutAmountChange when input changes', () => {
      render(<CashOutModal {...defaultProps} />);
      const input = screen.getByPlaceholderText('0');

      fireEvent.change(input, { target: { value: '500' } });
      expect(defaultProps.onCashOutAmountChange).toHaveBeenCalledWith('500');
    });

    it('handles decimal input', () => {
      render(<CashOutModal {...defaultProps} />);
      const input = screen.getByPlaceholderText('0');

      fireEvent.change(input, { target: { value: '123.45' } });
      expect(defaultProps.onCashOutAmountChange).toHaveBeenCalledWith('123.45');
    });

    it('input is number type', () => {
      render(<CashOutModal {...defaultProps} />);
      const input = screen.getByPlaceholderText('0');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('input has autoFocus', () => {
      render(<CashOutModal {...defaultProps} />);
      const input = screen.getByPlaceholderText('0');
      expect(input).toHaveFocus();
    });
  });

  describe('button interactions', () => {
    it('calls onCancel when Cancel button clicked', () => {
      render(<CashOutModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm when End Session button clicked', () => {
      render(<CashOutModal {...defaultProps} />);
      // Get the button specifically (not the header)
      const buttons = screen.getAllByText('End Session');
      const confirmButton = buttons.find(btn => btn.tagName === 'BUTTON');
      fireEvent.click(confirmButton);
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling', () => {
    it('has backdrop overlay', () => {
      const { container } = render(<CashOutModal {...defaultProps} />);
      const overlay = container.firstChild;
      expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black/50');
    });

    it('Cancel button has gray styling', () => {
      render(<CashOutModal {...defaultProps} />);
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toHaveClass('bg-gray-200');
    });

    it('End Session button has green styling', () => {
      render(<CashOutModal {...defaultProps} />);
      const buttons = screen.getAllByText('End Session');
      const confirmButton = buttons.find(btn => btn.tagName === 'BUTTON');
      expect(confirmButton).toHaveClass('bg-green-600');
    });

    it('modal is centered', () => {
      const { container } = render(<CashOutModal {...defaultProps} />);
      const overlay = container.firstChild;
      expect(overlay).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });

  describe('edge cases', () => {
    it('handles zero value', () => {
      render(<CashOutModal {...defaultProps} cashOutAmount="0" />);
      const input = screen.getByPlaceholderText('0');
      expect(input).toHaveValue(0);
    });

    it('handles large values', () => {
      render(<CashOutModal {...defaultProps} cashOutAmount="99999" />);
      const input = screen.getByPlaceholderText('0');
      expect(input).toHaveValue(99999);
    });

    it('opens and closes correctly', () => {
      const { rerender } = render(<CashOutModal {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('heading', { name: 'End Session' })).toBeInTheDocument();

      rerender(<CashOutModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('heading', { name: 'End Session' })).not.toBeInTheDocument();
    });
  });
});

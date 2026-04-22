// @vitest-environment jsdom
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
      // AUDIT-2026-04-21-SV F2: two inputs now (Cash Out + Tip); cash-out is first.
      render(<CashOutModal {...defaultProps} />);
      const inputs = screen.getAllByPlaceholderText('0');
      expect(inputs.length).toBeGreaterThanOrEqual(1);
      expect(inputs[0]).toBeInTheDocument();
    });

    it('renders dollar sign prefix', () => {
      // AUDIT-2026-04-21-SV F2: two $ prefixes now (one per input field).
      render(<CashOutModal {...defaultProps} />);
      const dollarSigns = screen.getAllByText('$');
      expect(dollarSigns.length).toBeGreaterThanOrEqual(1);
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
    // AUDIT-2026-04-21-SV F2: cashOut input is the FIRST of the two $ inputs.
    const getCashOutInput = () => screen.getAllByPlaceholderText('0')[0];
    const getTipInput = () => screen.getAllByPlaceholderText('0')[1];

    it('displays current cashOutAmount value', () => {
      render(<CashOutModal {...defaultProps} cashOutAmount="250" />);
      // AUDIT-2026-04-21-SV F2: input type is text → value is a string.
      expect(getCashOutInput()).toHaveValue('250');
    });

    it('displays empty string as empty input', () => {
      render(<CashOutModal {...defaultProps} cashOutAmount="" />);
      expect(getCashOutInput()).toHaveValue('');
    });

    it('calls onCashOutAmountChange when input changes', () => {
      render(<CashOutModal {...defaultProps} />);
      fireEvent.change(getCashOutInput(), { target: { value: '500' } });
      expect(defaultProps.onCashOutAmountChange).toHaveBeenCalledWith('500');
    });

    it('handles decimal input', () => {
      render(<CashOutModal {...defaultProps} />);
      fireEvent.change(getCashOutInput(), { target: { value: '123.45' } });
      expect(defaultProps.onCashOutAmountChange).toHaveBeenCalledWith('123.45');
    });

    it('input uses inputMode=decimal for compact numeric keypad (SV-F2)', () => {
      // AUDIT-2026-04-21-SV F2: replaced type=number with type=text + inputMode=decimal.
      render(<CashOutModal {...defaultProps} />);
      const input = getCashOutInput();
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('inputMode', 'decimal');
    });

    it('input has autoFocus', () => {
      render(<CashOutModal {...defaultProps} />);
      expect(getCashOutInput()).toHaveFocus();
    });

    it('renders optional Tip field (SV-F2)', () => {
      render(<CashOutModal {...defaultProps} />);
      expect(screen.getByText(/Tip \(optional\)/)).toBeInTheDocument();
      expect(getTipInput()).toBeInTheDocument();
    });

    it('calls onTipAmountChange when tip input changes (SV-F2)', () => {
      const onTipAmountChange = vi.fn();
      render(<CashOutModal {...defaultProps} tipAmount="" onTipAmountChange={onTipAmountChange} />);
      fireEvent.change(getTipInput(), { target: { value: '20' } });
      expect(onTipAmountChange).toHaveBeenCalledWith('20');
    });

    it('displays current tipAmount value (SV-F2)', () => {
      render(<CashOutModal {...defaultProps} tipAmount="15" />);
      expect(getTipInput()).toHaveValue('15');
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
      expect(cancelButton).toHaveClass('bg-gray-700');
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
    // AUDIT-2026-04-21-SV F2: input type is text → toHaveValue expects string.
    it('handles zero value', () => {
      render(<CashOutModal {...defaultProps} cashOutAmount="0" />);
      const input = screen.getAllByPlaceholderText('0')[0];
      expect(input).toHaveValue('0');
    });

    it('handles large values', () => {
      render(<CashOutModal {...defaultProps} cashOutAmount="99999" />);
      const input = screen.getAllByPlaceholderText('0')[0];
      expect(input).toHaveValue('99999');
    });

    it('opens and closes correctly', () => {
      const { rerender } = render(<CashOutModal {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('heading', { name: 'End Session' })).toBeInTheDocument();

      rerender(<CashOutModal {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('heading', { name: 'End Session' })).not.toBeInTheDocument();
    });
  });
});

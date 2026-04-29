// @vitest-environment jsdom
/**
 * ChipStackPanel.test.jsx - Tests for the tournament chip stack panel
 *
 * Covers the W4-A2 close-out batch:
 *   F4 — toast+undo on stack commit (safety net layered over the existing
 *        order-of-magnitude typo guard)
 *   F8 — explicit "no hero seat selected" empty state in the hero-card slot
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChipStackPanel } from '../ChipStackPanel';

// Mock toast context — capture addToast/showSuccess calls so we can inspect
// the action shape and trigger the undo path.
const toastSpies = {
  addToast: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
};
vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => toastSpies,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Trash2: () => <span data-testid="trash-icon">x</span>,
  Layers: () => <span data-testid="layers-icon">L</span>,
}));

// Mock IcmBadge — it's not under test here
vi.mock('../../../ui/IcmBadge', () => ({
  IcmBadge: () => <span data-testid="icm-badge">ICM</span>,
}));

const baseProps = {
  chipStacks: { 1: 10000, 3: 8500, 5: 12000 },
  currentBlinds: { sb: 50, bb: 100, ante: 25 },
  rankings: [],
  playersRemaining: 6,
  heroSeat: 1,
  totalEntrants: 9,
  mRatioGuidance: null,
  icmPressure: null,
  onUpdateStack: vi.fn(),
  onEliminate: vi.fn(),
  onSetPlayersRemaining: vi.fn(),
};

const renderPanel = (overrides = {}) => render(<ChipStackPanel {...baseProps} {...overrides} />);

beforeEach(() => {
  toastSpies.addToast.mockClear();
  toastSpies.showSuccess.mockClear();
  toastSpies.showError.mockClear();
  baseProps.onUpdateStack.mockClear();
  baseProps.onEliminate.mockClear();
  baseProps.onSetPlayersRemaining.mockClear();
});

// Helper: open the inline editor for a given seat (clicks its stack number),
// then commit a new value via Enter. The hero-card row doesn't have an inline
// stack button — only the non-hero list rows do — so tests use seat 3 or 5.
const editSeatStack = (seat, newValue) => {
  // Find the stack <button> by its rendered formatted number.
  const original = baseProps.chipStacks[seat];
  fireEvent.click(screen.getByText(original.toLocaleString()));
  const input = screen.getByDisplayValue(String(original));
  fireEvent.change(input, { target: { value: String(newValue) } });
  fireEvent.keyDown(input, { key: 'Enter' });
  return input;
};

describe('ChipStackPanel — F4 toast+undo on stack commit', () => {
  it('fires Undo toast after a normal commit (small change, no typo guard)', () => {
    renderPanel();
    editSeatStack(3, 9000); // 8500 → 9000, well under 10× threshold

    expect(baseProps.onUpdateStack).toHaveBeenCalledWith(3, 9000);
    expect(toastSpies.addToast).toHaveBeenCalledTimes(1);

    const [message, opts] = toastSpies.addToast.mock.calls[0];
    expect(message).toMatch(/Seat 3 stack: 8,500 → 9,000/);
    expect(opts.duration).toBe(12000);
    expect(opts.action.label).toBe('Undo');
    expect(typeof opts.action.onClick).toBe('function');
  });

  it('Undo onClick reverts the stack via onUpdateStack(seat, prevVal)', () => {
    renderPanel();
    editSeatStack(3, 9000);

    baseProps.onUpdateStack.mockClear();
    const undo = toastSpies.addToast.mock.calls[0][1].action.onClick;
    undo();

    expect(baseProps.onUpdateStack).toHaveBeenCalledWith(3, 8500);
    expect(toastSpies.showSuccess).toHaveBeenCalledWith(
      expect.stringMatching(/Seat 3 stack restored to 8,500/)
    );
  });

  it('does NOT fire toast on first-entry commit (prevVal=0)', () => {
    // Seat 5 is tracked but has stack=0 (just added, not yet typed). Editor
    // opens with prevVal=0 — first-entry path should suppress the toast.
    renderPanel({ chipStacks: { 1: 10000, 3: 8500, 5: 0 } });

    fireEvent.click(screen.getByText('0'));
    const input = screen.getByDisplayValue('0');
    fireEvent.change(input, { target: { value: '7500' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(baseProps.onUpdateStack).toHaveBeenCalledWith(5, 7500);
    expect(toastSpies.addToast).not.toHaveBeenCalled();
  });

  it('does NOT fire toast when committed value equals previous value', () => {
    renderPanel();
    editSeatStack(3, 8500); // same value

    expect(toastSpies.addToast).not.toHaveBeenCalled();
  });

  it('typo guard still arms on 10× change — toast fires only after the second-Enter confirm', () => {
    renderPanel();
    // 8500 → 850 is a 10× drop — typo guard arms on first Enter
    fireEvent.click(screen.getByText('8,500'));
    const input = screen.getByDisplayValue('8500');
    fireEvent.change(input, { target: { value: '850' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // First Enter: typo guard armed, no commit, no toast yet
    expect(baseProps.onUpdateStack).not.toHaveBeenCalled();
    expect(toastSpies.addToast).not.toHaveBeenCalled();

    // Second Enter: commit fires + toast fires
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(baseProps.onUpdateStack).toHaveBeenCalledWith(3, 850);
    expect(toastSpies.addToast).toHaveBeenCalledTimes(1);
  });
});

describe('ChipStackPanel — F8 explicit no-hero-seat empty state', () => {
  it('renders the "No hero seat selected" panel when heroSeat is null AND stacks exist', () => {
    renderPanel({ heroSeat: null });
    expect(screen.getByText('No hero seat selected')).toBeInTheDocument();
    expect(screen.getByText(/Set your seat in TableView/)).toBeInTheDocument();
  });

  it('does NOT render the empty state when heroSeat is set (hero card renders instead)', () => {
    renderPanel({ heroSeat: 1 });
    expect(screen.queryByText('No hero seat selected')).not.toBeInTheDocument();
    // Hero card renders hero's stack
    expect(screen.getByText('10,000')).toBeInTheDocument();
  });

  it('does NOT render the empty state when there are zero stacks at all (no-stacks empty state covers it)', () => {
    renderPanel({ heroSeat: null, chipStacks: {} });
    expect(screen.queryByText('No hero seat selected')).not.toBeInTheDocument();
    // The pre-existing "No chip stacks tracked" empty state is what shows
    expect(screen.getByText(/No chip stacks tracked/)).toBeInTheDocument();
  });

  it('uses role="status" for accessibility (announce the empty state to screen readers)', () => {
    renderPanel({ heroSeat: null });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/No hero seat selected/);
  });
});
